/**
 * Build a partially-signed NFT mint transaction for the NFT Creator flow.
 * Server builds createNft (+ optional verified collection) + fee transfer, signs with mint keypair
 * (and collection authority when configured); client signs as payer and sends.
 *
 * Collection: createNft is called with collection (verified: false); then updateMetadataAccountV2 +
 * verifyCollection (same as "Add to collection" flow) are appended so one tx can include both.
 * If that fails on-chain, the frontend automatically sends the add-to-collection tx after mint (one click, two signatures).
 *
 * To have all Creator NFTs in the same verified collection: set NFT_CREATOR_COLLECTION_MINT
 * and NFT_CREATOR_COLLECTION_AUTHORITY (JSON array secret key). Create the collection NFT once
 * via scripts/create-nft-creator-collection.mjs.
 *
 * Signing is done manually with value-based signer index lookup because UMI's addTransactionSignature
 * uses reference equality (===) for public keys; the compiled message may use different key instances
 * and would otherwise throw "The provided signer is not required to sign this transaction."
 */

import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { getConnection } from '@/lib/solana/connection';
import { createNoopSigner, createSignerFromKeypair, generateSigner, percentAmount, transactionBuilder } from '@metaplex-foundation/umi';
import type { Transaction } from '@metaplex-foundation/umi';
import {
  createNft,
  findMetadataPda,
  findMasterEditionPda,
  mplTokenMetadata,
  safeFetchMetadataFromSeeds,
  updateMetadataAccountV2,
  verifyCollection,
} from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi-public-keys';
import { getRpcUrl } from '@/lib/solana/connection';

const FEE_LAMPORTS = 5_000_000; // 0.005 SOL
const SYSTEM_PROGRAM_ID = publicKey('11111111111111111111111111111111');

const COLLECTION_MINT_ENV = 'NFT_CREATOR_COLLECTION_MINT';
const COLLECTION_AUTHORITY_ENV = 'NFT_CREATOR_COLLECTION_AUTHORITY';
/** Platform wallet receiving 5% royalties on secondary sales. Use NFT_CREATOR_ROYALTY_RECIPIENT or fallback to fee recipient. */
const ROYALTY_RECIPIENT_ENV = 'NFT_CREATOR_ROYALTY_RECIPIENT';
const SELLER_FEE_BASIS_POINTS = 500; // 5%

export interface BuildMintTransactionParams {
  userWallet: string;
  name: string;
  metadataUri: string;
  feeRecipient: string;
}

/** Optional: pass connection and blockhash from API route so RPC goes through proxy (avoids 401). */
export interface BuildMintTransactionOptions {
  connection?: import('@solana/web3.js').Connection;
  blockhash?: string;
  lastValidBlockHeight?: number;
}

export interface BuildMintTransactionResult {
  serializedTransaction: string;
  mintAddress: string;
  /** True when the mint tx includes collection verification (no second signature needed). */
  collectionIncludedInMintTx: boolean;
}

// System Program Transfer expects: 4-byte u32 LE instruction index (2 = Transfer), then 8-byte u64 LE lamports.
function createTransferInstruction(
  from: ReturnType<typeof publicKey>,
  to: ReturnType<typeof publicKey>,
  lamports: number
): { instruction: { keys: { pubkey: ReturnType<typeof publicKey>; isSigner: boolean; isWritable: boolean }[]; programId: ReturnType<typeof publicKey>; data: Uint8Array }; signers: unknown[]; bytesCreatedOnChain: number } {
  const data = new Uint8Array(4 + 8);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); // SystemInstruction.Transfer
  view.setBigUint64(4, BigInt(lamports), true);
  return {
    instruction: {
      keys: [
        { pubkey: from, isSigner: true, isWritable: true },
        { pubkey: to, isSigner: false, isWritable: true },
      ],
      programId: SYSTEM_PROGRAM_ID,
      data,
    },
    signers: [],
    bytesCreatedOnChain: 0,
  };
}

async function getCollectionConfig(): Promise<{ mint: string; authoritySecretKey: number[] } | null> {
  const mint = process.env[COLLECTION_MINT_ENV]?.trim();
  const raw = process.env[COLLECTION_AUTHORITY_ENV]?.trim();
  if (!mint || !raw) return null;
  let bytes: Uint8Array;
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw) as number[];
      if (!Array.isArray(arr) || arr.length !== 64) return null;
      bytes = Uint8Array.from(arr);
    } catch {
      return null;
    }
  } else {
    try {
      const { decode } = await import('bs58');
      bytes = new Uint8Array(decode(raw));
      if (bytes.length !== 64) return null;
    } catch {
      return null;
    }
  }
  const authoritySecretKey = Array.from(bytes);
  return { mint, authoritySecretKey };
}

/**
 * Partially sign the transaction with the given keypair signers.
 * Only signs signers that are in the transaction's required signers list (first numRequiredSignatures accounts).
 * Resolves signer index by comparing publicKey.toString() so it works when the message
 * uses different PublicKey instances than the signers (UMI uses === in addTransactionSignature).
 */
function signTransactionWithKeypairs(
  umi: { eddsa: { sign: (message: Uint8Array, keypair: { publicKey: unknown; secretKey: Uint8Array }) => Uint8Array } },
  tx: Transaction,
  signers: Array<{ publicKey: { toString: () => string }; secretKey: Uint8Array }>
): Transaction {
  const maxSigners = tx.message.header.numRequiredSignatures;
  const signerAccounts = tx.message.accounts.slice(0, maxSigners);
  let signatures = [...tx.signatures];
  const message = tx.serializedMessage;
  for (const signer of signers) {
    const signerKeyStr = signer.publicKey.toString();
    const index = signerAccounts.findIndex((k) => k.toString() === signerKeyStr);
    if (index < 0) {
      continue;
    }
    const signature = umi.eddsa.sign(message, { publicKey: signer.publicKey, secretKey: signer.secretKey });
    signatures[index] = signature;
  }
  return { ...tx, signatures };
}

/**
 * Builds a Transaction that: create NFT (mint + metadata + master edition), optionally add to
 * verified collection, then transfer SOL fee. Signs with mint keypair (and collection authority
 * when collection is configured); client must sign as payer and send.
 */
export async function buildMintTransaction(
  params: BuildMintTransactionParams,
  options?: BuildMintTransactionOptions
): Promise<BuildMintTransactionResult> {
  const rpcUrl = getRpcUrl();
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());
  const { connection: optsConnection, blockhash: optsBlockhash } = options ?? {};

  const userPubkey = publicKey(params.userWallet);
  const feeRecipientPubkey = publicKey(params.feeRecipient);

  umi.identity = createNoopSigner(userPubkey);
  umi.payer = umi.identity;

  const mint = generateSigner(umi);
  const collectionConfig = await getCollectionConfig();
  let collectionAuthoritySigner: ReturnType<typeof createSignerFromKeypair> | null = null;
  if (collectionConfig) {
    const solanaKp = Keypair.fromSecretKey(Uint8Array.from(collectionConfig.authoritySecretKey));
    collectionAuthoritySigner = createSignerFromKeypair(umi, {
      publicKey: publicKey(solanaKp.publicKey.toBase58()),
      secretKey: solanaKp.secretKey,
    });
  }

  const useCollection = Boolean(collectionConfig && collectionAuthoritySigner);
  const collectionMintForInput = useCollection && collectionConfig ? publicKey(collectionConfig.mint) : null;

  const royaltyRecipientStr =
    process.env[ROYALTY_RECIPIENT_ENV]?.trim() ||
    process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET?.trim();
  const royaltyRecipient = royaltyRecipientStr ? publicKey(royaltyRecipientStr) : feeRecipientPubkey;

  // createV1 expects Amount<'%', 2> (use percentAmount(5) = 5%); raw 500 would be read as value.basisPoints → undefined → 0 on-chain
  const createNftInput: Parameters<typeof createNft>[1] = {
    mint,
    authority: umi.identity,
    name: params.name.slice(0, 32),
    symbol: 'SOLPIT',
    uri: params.metadataUri,
    sellerFeeBasisPoints: percentAmount(5),
    creators: [{ address: royaltyRecipient, verified: false, share: 100 }],
    ...(collectionMintForInput ? { collection: { key: collectionMintForInput, verified: false } } : {}),
  };

  const mainBuilder = createNft(umi, createNftInput);

  // Single-tx: same sequence as "Add to collection" (updateMetadataAccountV2 + verifyCollection) in same tx as mint.
  // This is the exact instruction pair that works when the user clicks the button; doing it right after createNft
  // puts mint + collection verification in one transaction so the button is never needed.
  if (useCollection && collectionAuthoritySigner && collectionConfig) {
    const collectionMintPubkey = publicKey(collectionConfig.mint);
    const nftMetadataPda = findMetadataPda(umi, { mint: mint.publicKey });
    const collectionMetadataPda = findMetadataPda(umi, { mint: collectionMintPubkey });
    const collectionMasterEditionPda = findMasterEditionPda(umi, { mint: collectionMintPubkey });
    const dataV2 = {
      name: params.name.slice(0, 32),
      symbol: 'SOLPIT',
      uri: params.metadataUri,
      sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS,
      creators: [{ address: royaltyRecipient, verified: true, share: 100 }],
      collection: { key: collectionMintPubkey, verified: false },
      uses: null,
    };
    mainBuilder
      .append(
        updateMetadataAccountV2(umi, {
          metadata: nftMetadataPda,
          updateAuthority: umi.identity,
          data: dataV2,
        })
      )
      .append(
        verifyCollection(umi, {
          metadata: nftMetadataPda,
          collectionAuthority: collectionAuthoritySigner,
          payer: umi.identity,
          collectionMint: collectionMintPubkey,
          collection: collectionMetadataPda,
          collectionMasterEditionAccount: collectionMasterEditionPda,
        })
      );
  }

  const transferWrap = createTransferInstruction(umi.identity.publicKey, feeRecipientPubkey, FEE_LAMPORTS);
  transferWrap.signers = [umi.identity];
  mainBuilder.append(transferWrap);

  // When using a collection, prepend a no-op transfer (0 lamports from collection authority to itself)
  // so that the collection authority appears in the message's first accounts and is a required signer.
  // Otherwise the compiled message may only list payer and mint first, so we would not sign collection
  // authority and verifyCollection would fail, forcing a second transaction.
  let builder = mainBuilder;
  if (useCollection && collectionAuthoritySigner) {
    const noOpTransfer = createTransferInstruction(
      collectionAuthoritySigner.publicKey,
      collectionAuthoritySigner.publicKey,
      0
    );
    builder = transactionBuilder().prepend(noOpTransfer).add(mainBuilder);
  }

  const tx = optsBlockhash
    ? builder.setBlockhash({ blockhash: optsBlockhash, lastValidBlockHeight: options?.lastValidBlockHeight ?? 0 }).build(umi)
    : await builder.buildWithLatestBlockhash(umi);

  if (useCollection && collectionAuthoritySigner) {
    const requiredSignerKeys = tx.message.accounts
      .slice(0, tx.message.header.numRequiredSignatures)
      .map((k) => k.toString());
    const authorityInTx = requiredSignerKeys.includes(collectionAuthoritySigner.publicKey.toString());
    if (!authorityInTx) {
      throw new Error(
        'Collection authority is not a required signer in the mint transaction. Single-tx collection verification cannot proceed.'
      );
    }
  }

  const keypairSigners: Array<{ publicKey: { toString: () => string }; secretKey: Uint8Array }> = [mint];
  if (useCollection && collectionAuthoritySigner) {
    keypairSigners.push(collectionAuthoritySigner as { publicKey: { toString: () => string }; secretKey: Uint8Array });
  }
  const signedTx = signTransactionWithKeypairs(umi, tx, keypairSigners);
  const serialized = umi.transactions.serialize(signedTx);

  if (useCollection && collectionAuthoritySigner) {
    try {
      const connection = optsConnection ?? getConnection();
      const versionedTx = VersionedTransaction.deserialize(Buffer.from(serialized));
      const sim = await connection.simulateTransaction(versionedTx, { sigVerify: false });
      if (sim.value.err) {
        const logs = (sim.value.logs ?? []).join('\n');
        throw new Error(
          `Mint+collection simulation failed. The NFT would not be in the collection. ${sim.value.err}${logs ? `\nLogs:\n${logs}` : ''}`
        );
      }
    } catch (e) {
      throw e;
    }
  }

  return {
    serializedTransaction: Buffer.from(serialized).toString('base64'),
    mintAddress: mint.publicKey.toString(),
    collectionIncludedInMintTx: useCollection,
  };
}

/**
 * Build a transaction that adds an existing NFT to the SolPit Creator collection using
 * UpdateMetadataAccountV2 (user sets collection, verified: false) + VerifyCollection (collection
 * authority verifies). set_and_verify_collection requires the same update authority on both NFT and
 * collection (error 0x7); this two-instruction flow works when the user owns the NFT and the
 * server owns the collection.
 * Server signs with collection authority; client signs as payer and as NFT update authority.
 */
/** Optional: pass connection (and blockhash) from API route so RPC goes through proxy (avoids 401). */
export interface BuildAddToCollectionOptions {
  connection?: import('@solana/web3.js').Connection;
  blockhash?: string;
  lastValidBlockHeight?: number;
}

export async function buildAddToCollectionTransaction(
  nftMintAddress: string,
  userWallet: string,
  options?: BuildAddToCollectionOptions
): Promise<{ serializedTransaction: string }> {
  const collectionConfig = await getCollectionConfig();
  if (!collectionConfig) {
    throw new Error('Collection not configured (NFT_CREATOR_COLLECTION_MINT and NFT_CREATOR_COLLECTION_AUTHORITY).');
  }

  const { connection: optsConnection, blockhash: optsBlockhash, lastValidBlockHeight } = options ?? {};
  const umi = (optsConnection
    ? createUmi(optsConnection)
    : createUmi(getRpcUrl())
  ).use(mplTokenMetadata());
  const userPubkey = publicKey(userWallet);

  umi.identity = createNoopSigner(userPubkey);
  umi.payer = umi.identity;

  const solanaKp = Keypair.fromSecretKey(Uint8Array.from(collectionConfig.authoritySecretKey));
  const collectionAuthoritySigner = createSignerFromKeypair(umi, {
    publicKey: publicKey(solanaKp.publicKey.toBase58()),
    secretKey: solanaKp.secretKey,
  });

  const nftMintPubkey = publicKey(nftMintAddress);
  const collectionMintPubkey = publicKey(collectionConfig.mint);
  const nftMetadataPda = findMetadataPda(umi, { mint: nftMintPubkey });
  const collectionMetadataPda = findMetadataPda(umi, { mint: collectionMintPubkey });
  const collectionMasterEditionPda = findMasterEditionPda(umi, { mint: collectionMintPubkey });

  // Validate collection on-chain to avoid Verify Collection 0x39 (Incorrect account owner).
  const collectionMetadata = await safeFetchMetadataFromSeeds(umi, { mint: collectionMintPubkey });
  if (!collectionMetadata) {
    throw new Error(
      'Collection NFT has no metadata on-chain. Set NFT_CREATOR_COLLECTION_MINT to a mint created with Metaplex Token Metadata (metadata + master edition). Create the collection first, then set the env var.'
    );
  }
  const collectionAuthorityPubkeyStr = collectionAuthoritySigner.publicKey.toString();
  const collectionUpdateAuthorityStr = collectionMetadata.updateAuthority?.toString?.() ?? '';
  if (collectionUpdateAuthorityStr && collectionAuthorityPubkeyStr !== collectionUpdateAuthorityStr) {
    throw new Error(
      `Collection update authority mismatch: env NFT_CREATOR_COLLECTION_AUTHORITY must be the update authority of the collection mint. Expected ${collectionUpdateAuthorityStr}, got ${collectionAuthorityPubkeyStr}.`
    );
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const delaysMs = [0, 1500, 3500, 6000];
  let nftMetadata: Awaited<ReturnType<typeof safeFetchMetadataFromSeeds>> = null;
  for (let i = 0; i < delaysMs.length; i++) {
    if (i > 0) await sleep(delaysMs[i]);
    nftMetadata = await safeFetchMetadataFromSeeds(umi, { mint: nftMintPubkey });
    if (nftMetadata) break;
  }
  if (!nftMetadata) {
    throw new Error('NFT metadata not found on-chain. Is the mint address correct? The RPC may need a few seconds after mint—try again shortly.');
  }

  if (!nftMetadata.isMutable) {
    throw new Error('NFT metadata is immutable; collection cannot be set.');
  }

  // 1) UpdateMetadataAccountV2: set collection on NFT (verified: false). NFT update authority (user) must sign.
  const dataV2 = {
    name: nftMetadata.name,
    symbol: nftMetadata.symbol,
    uri: nftMetadata.uri,
    sellerFeeBasisPoints: nftMetadata.sellerFeeBasisPoints,
    creators: nftMetadata.creators ?? null,
    collection: { key: collectionMintPubkey, verified: false },
    uses: nftMetadata.uses ?? null,
  };

  const builder = updateMetadataAccountV2(umi, {
    metadata: nftMetadataPda,
    updateAuthority: umi.identity,
    data: dataV2,
  }).append(
    verifyCollection(umi, {
      metadata: nftMetadataPda,
      collectionAuthority: collectionAuthoritySigner,
      payer: umi.identity,
      collectionMint: collectionMintPubkey,
      collection: collectionMetadataPda,
      collectionMasterEditionAccount: collectionMasterEditionPda,
    })
  );

  const tx = optsBlockhash
    ? builder.setBlockhash({ blockhash: optsBlockhash, lastValidBlockHeight: lastValidBlockHeight ?? 0 }).build(umi)
    : await builder.buildWithLatestBlockhash(umi);
  const requiredSignerKeys = tx.message.accounts
    .slice(0, tx.message.header.numRequiredSignatures)
    .map((k) => k.toString());
  const authorityInTx = requiredSignerKeys.includes(collectionAuthoritySigner.publicKey.toString());
  if (!authorityInTx) {
    throw new Error(
      'Collection authority is not a required signer in the add-to-collection transaction. Cannot proceed.'
    );
  }
  const signedTx = signTransactionWithKeypairs(umi, tx, [
    collectionAuthoritySigner as { publicKey: { toString: () => string }; secretKey: Uint8Array },
  ]);
  const serialized = umi.transactions.serialize(signedTx);
  return {
    serializedTransaction: Buffer.from(serialized).toString('base64'),
  };
}

/** Result of validating the configured NFT Creator collection (for GET /api/nft-creator/check-collection). */
export type ValidateCollectionConfigResult =
  | { ok: true; mint: string; updateAuthority: string }
  | { ok: false; reason: string };

/**
 * Validates that the collection in env (NFT_CREATOR_COLLECTION_MINT + AUTHORITY) exists on-chain
 * with metadata, master edition, and matching update authority. Use to verify config before Finalize.
 */
export async function validateCollectionConfig(): Promise<ValidateCollectionConfigResult> {
  const collectionConfig = await getCollectionConfig();
  if (!collectionConfig) {
    return {
      ok: false,
      reason: 'Collection not configured (set NFT_CREATOR_COLLECTION_MINT and NFT_CREATOR_COLLECTION_AUTHORITY).',
    };
  }

  const umi = createUmi(getRpcUrl()).use(mplTokenMetadata());
  const collectionMintPubkey = publicKey(collectionConfig.mint);
  const solanaKp = Keypair.fromSecretKey(Uint8Array.from(collectionConfig.authoritySecretKey));
  const collectionAuthoritySigner = createSignerFromKeypair(umi, {
    publicKey: publicKey(solanaKp.publicKey.toBase58()),
    secretKey: solanaKp.secretKey,
  });

  const collectionMetadata = await safeFetchMetadataFromSeeds(umi, { mint: collectionMintPubkey });
  if (!collectionMetadata) {
    return {
      ok: false,
      reason:
        'Collection NFT has no metadata on-chain. Create the collection with scripts/create-nft-creator-collection.mjs or a Metaplex-compatible tool.',
    };
  }

  const expectedAuthority = collectionAuthoritySigner.publicKey.toString();
  const onChainAuthority = collectionMetadata.updateAuthority?.toString?.() ?? '';
  if (onChainAuthority && expectedAuthority !== onChainAuthority) {
    return {
      ok: false,
      reason: `Collection update authority mismatch: env has ${expectedAuthority}, on-chain has ${onChainAuthority}.`,
    };
  }

  const mePda = findMasterEditionPda(umi, { mint: collectionMintPubkey });
  const meAddress =
    (mePda as { bytes?: Uint8Array }).bytes ??
    (typeof (mePda as { toString?: () => string }).toString === 'function'
      ? (mePda as { toString: () => string }).toString()
      : String(mePda));
  const mePubkey = meAddress instanceof Uint8Array ? new PublicKey(meAddress) : new PublicKey(meAddress);
  const connection = getConnection();
  const meInfo = await connection.getAccountInfo(mePubkey);
  if (!meInfo?.data?.length) {
    return {
      ok: false,
      reason:
        'Collection has no Master Edition on-chain. The collection NFT must be created with Metaplex Token Metadata (metadata + master edition).',
    };
  }

  return {
    ok: true,
    mint: collectionConfig.mint,
    updateAuthority: expectedAuthority,
  };
}
