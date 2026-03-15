/**
 * Burn compressed NFTs (cNFTs) via Metaplex Bubblegum, then charge fee + referral on reclaimed SOL.
 * Processes assets in chunks of MAX_CNFT_BURNS_PER_TX (1 recommended: proof size often makes multi-burn tx exceed 1232 bytes).
 *
 * V1 schema (most mainnet cNFTs): we build the burn instruction manually with web3.js so that
 * leaf_owner is explicitly isSigner: true in the account metas. The SDK's burn() can lose the
 * signer flag when the transaction is converted for the wallet (known Anchor/Umi limitation).
 * See: metaplex-program-library#1129, Solana Stack Exchange #6410.
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SystemProgram,
} from '@solana/web3.js';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { none, some } from '@metaplex-foundation/umi';
import {
  getAssetWithProof,
  getCompressionProgramsForV1Ixs,
  burnV2,
} from '@metaplex-foundation/mpl-bubblegum';
import { sendAndConfirmWithRetry } from './sendAndConfirmWithRetry';
import { getRpcUrl } from './connection';
import { getConnection } from './connection';
import { saveTransaction } from '@/lib/supabase/transactions';
import { getCreatorPointsBonus } from '@/lib/nftCreator';
import { cleanEnvAddress, safePublicKey } from './validators';
import { logger } from '@/lib/utils/logger';
import type { CloseAccountResult } from '@/types/token-account';
import type { DasAsset } from './das';
import { MAX_CNFT_BURNS_PER_TX } from './constants';
import type { ReclaimFeeOptions } from './closer';

/** Bubblegum program ID (Metaplex). */
const BUBBLEGUM_PROGRAM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');

/** MPL Noop / Account Compression (used by some Bubblegum deployments when SPL causes InvalidProgramId 0xbc0). */
const MPL_NOOP_PROGRAM_ID = new PublicKey('mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3');
const MPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW');

/** Burn v1 instruction discriminator (from mpl-bubblegum). */
const BURN_V1_DISCRIMINATOR = new Uint8Array([116, 110, 29, 56, 107, 219, 42, 93]);

/** Write u64 and u32 LE without Node Buffer (browser-safe). */
function writeU64LE(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, value, true);
  return new Uint8Array(buf);
}
function writeU32LE(value: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, value, true);
  return new Uint8Array(buf);
}
function concatU8(...arr: Uint8Array[]): Uint8Array {
  const len = arr.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arr) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

/** Wallet adapter–like (publicKey + signTransaction) for Umi. */
type WalletLike = {
  publicKey: PublicKey;
  signTransaction: (tx: unknown) => Promise<unknown>;
};

/** Convert Umi/public key to web3.js PublicKey. */
function toWeb3Pubkey(k: string | Uint8Array | { bytes: Uint8Array } | PublicKey): PublicKey {
  if (k instanceof PublicKey) return k;
  if (typeof k === 'string') return new PublicKey(k);
  if (k instanceof Uint8Array || (k && typeof k === 'object' && 'bytes' in k))
    return new PublicKey('bytes' in k ? (k as { bytes: Uint8Array }).bytes : k);
  return new PublicKey(k as string);
}

/**
 * Build and send a burn v1 transaction with explicit leaf_owner isSigner: true.
 * Avoids SDK path where the signer flag can be lost (LeafAuthorityMustSign 0x1900).
 */
async function sendBurnV1Chunk(
  umi: Awaited<ReturnType<typeof createUmi>>,
  connection: ReturnType<typeof getConnection>,
  walletAdapter: WalletLike,
  chunk: DasAsset[],
  compressionPrograms: { logWrapper: unknown; compressionProgram: unknown }
): Promise<string> {
  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
  );

  for (const asset of chunk) {
    const assetId = umiPublicKey(asset.id);
    const assetWithProof = await getAssetWithProof(umi, assetId, { truncateCanopy: true });

    const merkleTree = toWeb3Pubkey(assetWithProof.merkleTree);
    const treeConfig = PublicKey.findProgramAddressSync(
      [merkleTree.toBuffer()],
      BUBBLEGUM_PROGRAM_ID
    )[0];

    const leafOwner = walletAdapter.publicKey;
    const leafDelegate = toWeb3Pubkey(assetWithProof.leafDelegate);

    const data = concatU8(
      BURN_V1_DISCRIMINATOR,
      new Uint8Array(assetWithProof.root),
      new Uint8Array(assetWithProof.dataHash),
      new Uint8Array(assetWithProof.creatorHash),
      writeU64LE(BigInt(assetWithProof.nonce)),
      writeU32LE(assetWithProof.index)
    );

    const keys = [
      { pubkey: treeConfig, isSigner: false, isWritable: false },
      { pubkey: leafOwner, isSigner: true, isWritable: false },
      { pubkey: leafDelegate, isSigner: false, isWritable: false },
      { pubkey: merkleTree, isSigner: false, isWritable: true },
      { pubkey: toWeb3Pubkey(compressionPrograms.logWrapper), isSigner: false, isWritable: false },
      { pubkey: toWeb3Pubkey(compressionPrograms.compressionProgram), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ...assetWithProof.proof.map((p) => ({
        pubkey: toWeb3Pubkey(p),
        isSigner: false as const,
        isWritable: false as const,
      })),
    ];

    tx.add(
      new TransactionInstruction({
        programId: BUBBLEGUM_PROGRAM_ID,
        keys,
        data,
      })
    );
  }

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = walletAdapter.publicKey;
  const signed = await walletAdapter.signTransaction(tx as Parameters<WalletLike['signTransaction']>[0]);
  return sendAndConfirmWithRetry(
    connection,
    (signed as { serialize: () => Buffer }).serialize()
  );
}

/**
 * Burn selected cNFTs (by asset id), then send fee + referral from reclaimed SOL.
 * Reclaimed = balance after all burns − balance before; fee 20%, referral 10%.
 */
export async function closeCnftAssets(
  assets: DasAsset[],
  walletAdapter: WalletLike,
  referrerWallet?: string | null,
  options?: ReclaimFeeOptions
): Promise<CloseAccountResult> {
  try {
    if (!walletAdapter.publicKey) {
      throw new Error('Wallet not connected');
    }
    if (assets.length === 0) {
      throw new Error('No cNFTs selected');
    }
    if (!process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET) {
      throw new Error('Fee recipient wallet not configured. Please contact support.');
    }

    const rpcUrl = getRpcUrl();
    const connection = getConnection();
    const feePercentage = options?.feePercent ?? Number(process.env.NEXT_PUBLIC_SERVICE_FEE_PERCENTAGE || 20);
    const referralFeePercentage = options?.referralPercent ?? Number(process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || 10);
    const cleanedFeeRecipient = cleanEnvAddress(process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET);
    const feeRecipient = new PublicKey(cleanedFeeRecipient);

    let validReferrerPubkey: PublicKey | null = null;
    let referralDisabledReason: string | null = null;
    if (referrerWallet && referrerWallet !== walletAdapter.publicKey.toString()) {
      try {
        const referrerPubkey = safePublicKey(referrerWallet);
        if (referrerPubkey && !referrerPubkey.equals(walletAdapter.publicKey)) {
          const accountInfo = await connection.getAccountInfo(referrerPubkey);
          if (accountInfo === null) {
            referralDisabledReason = 'Referrer wallet not initialized on-chain (must have received SOL at least once).';
          } else {
            validReferrerPubkey = referrerPubkey;
          }
        }
      } catch {
        referralDisabledReason = 'Invalid referrer address.';
      }
    }

    const umi = createUmi(rpcUrl)
      .use(dasApi())
      .use(walletAdapterIdentity(walletAdapter as Parameters<typeof walletAdapterIdentity>[0]));

    const balanceBefore = await connection.getBalance(walletAdapter.publicKey);
    const allSignatures: string[] = [];

    // Cluster-appropriate compression programs (SPL on mainnet, MPL elsewhere).
    const compressionPrograms = await getCompressionProgramsForV1Ixs(umi);

    for (let chunkStart = 0; chunkStart < assets.length; chunkStart += MAX_CNFT_BURNS_PER_TX) {
      const chunk = assets.slice(chunkStart, chunkStart + MAX_CNFT_BURNS_PER_TX);
      const firstId = chunk[0]?.id?.slice(0, 8) ?? '?';

      const runChunkV2 = async () => {
        let builder: ReturnType<typeof burnV2> | null = null;
        for (const asset of chunk) {
          const assetId = umiPublicKey(asset.id);
          const assetWithProof = await getAssetWithProof(umi, assetId, { truncateCanopy: true });
          const burnIx = burnV2(umi, {
            ...assetWithProof,
            authority: umi.identity,
            leafOwner: assetWithProof.leafOwner,
            leafDelegate: assetWithProof.leafDelegate,
            logWrapper: compressionPrograms.logWrapper,
            compressionProgram: compressionPrograms.compressionProgram,
            assetDataHash: assetWithProof.asset_data_hash
              ? some(assetWithProof.asset_data_hash)
              : none(),
            flags:
              assetWithProof.flags !== undefined ? some(assetWithProof.flags) : none(),
          });
          builder = builder == null ? burnIx : builder.add(burnIx);
        }
        return builder!.send(umi);
      };

      try {
        let signature: string | undefined;
        try {
          signature = await runChunkV2();
        } catch (v2Err) {
          const v2Msg = v2Err instanceof Error ? v2Err.message : String(v2Err);
          // 0x1773 = UnsupportedSchemaVersion: tree/asset is V1, BurnV2 expects V2 → use manual burn v1 with explicit leaf_owner signer.
          if (v2Msg.includes('0x1773') || v2Msg.includes('UnsupportedSchemaVersion') || v2Msg.includes('6003')) {
            const mplPrograms = { logWrapper: MPL_NOOP_PROGRAM_ID, compressionProgram: MPL_ACCOUNT_COMPRESSION_PROGRAM_ID };
            try {
              // Try MPL first: mainnet Bubblegum often expects mnoop/mcmt (Left in 0xbc0 error), not SPL noop.
              signature = await sendBurnV1Chunk(umi, connection, walletAdapter, chunk, mplPrograms);
            } catch (v1Err) {
              const v1Msg = v1Err instanceof Error ? v1Err.message : String(v1Err);
              // If MPL fails with InvalidProgramId, try SPL (e.g. some trees use SPL noop).
              if (v1Msg.includes('0xbc0') || v1Msg.includes('InvalidProgramId') || v1Msg.includes('log_wrapper')) {
                signature = await sendBurnV1Chunk(umi, connection, walletAdapter, chunk, compressionPrograms);
              } else {
                throw v1Err;
              }
            }
          } else {
            throw v2Err;
          }
        }
        if (signature) allSignatures.push(signature);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if ((msg.includes('block height exceeded') || msg.includes('has expired')) && msg.includes('Signature')) {
          const sigMatch = msg.match(/Signature\s+([1-9A-HJ-NP-Za-km-z]{87,88})/);
          if (sigMatch) {
            allSignatures.push(sigMatch[1]);
            continue;
          }
        }
        logger.error('cnft burn failed for chunk starting at', firstId, msg);
        throw new Error(`Failed to burn cNFT batch (${firstId}…): ${msg}`);
      }
    }

    const balanceAfter = await connection.getBalance(walletAdapter.publicKey);
    const totalReclaimedLamports = Math.max(0, Number(balanceAfter) - Number(balanceBefore));
    const feeLamports = Math.floor((totalReclaimedLamports * feePercentage) / 100);
    const referralLamports = validReferrerPubkey
      ? Math.floor((totalReclaimedLamports * referralFeePercentage) / 100)
      : 0;
    let finalReferralAmount = 0;

    if (feeLamports > 0 || referralLamports > 0) {
      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      const tx = new Transaction();
      if (feeLamports > 0) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: walletAdapter.publicKey,
            toPubkey: feeRecipient,
            lamports: feeLamports,
          })
        );
      }
      if (referralLamports > 0 && validReferrerPubkey) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: walletAdapter.publicKey,
            toPubkey: validReferrerPubkey,
            lamports: referralLamports,
          })
        );
        finalReferralAmount = referralLamports;
      }
      const { sendAndConfirmWithRetry } = await import('./sendAndConfirmWithRetry');
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = walletAdapter.publicKey;
      const signed = await walletAdapter.signTransaction(tx as Parameters<WalletLike['signTransaction']>[0]);
      const sig = await sendAndConfirmWithRetry(
        connection,
        (signed as { serialize: () => Buffer }).serialize()
      );
      allSignatures.push(sig);
    }

    const solReclaimed = totalReclaimedLamports / 1e9;
    const totalFeesPaid = (feeLamports + finalReferralAmount) / 1e9;
    const netReceived = solReclaimed - totalFeesPaid;

    try {
      const walletStr = walletAdapter.publicKey.toString();
      const f1CreatorBonusPts = await getCreatorPointsBonus(walletStr).catch(() => 0);
      await saveTransaction({
        signature: allSignatures[0],
        wallet_address: walletStr,
        accounts_closed: assets.length,
        sol_reclaimed: solReclaimed,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: validReferrerPubkey ? referrerWallet ?? undefined : undefined,
        referral_earned: finalReferralAmount > 0 ? finalReferralAmount / 1e9 : undefined,
        timestamp: Date.now(),
        reclaim_type: 'cnft_close',
        f1_creator_bonus_pts: f1CreatorBonusPts,
      });
    } catch (supabaseError) {
      logger.error('Supabase save error:', supabaseError);
    }

    return {
      signature: allSignatures[0],
      accountsClosed: assets.length,
      solReclaimed: netReceived,
      success: true,
      warningMessage: referralDisabledReason ?? undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('closeCnftAssets error:', message);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: message,
    };
  }
}
