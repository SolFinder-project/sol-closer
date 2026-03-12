/**
 * Burn NFT (SPL/Token-2022 token accounts or Metaplex Core assets) and reclaim rent.
 * Fee (20%) and referral (10%) deducted from reclaimed SOL.
 * SPL: BurnChecked + CloseAccount. Core: Mpl Core BurnV1 instruction.
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createBurnCheckedInstruction,
  createCloseAccountInstruction,
  createHarvestWithheldTokensToMintInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { filterToken2022MintsWithTransferFee } from './token2022Harvest';
import { getConnection } from './connection';
import { sendAndConfirmWithRetry } from './sendAndConfirmWithRetry';
import { MPL_CORE_PROGRAM_ID } from './constants';
import { createCoreBurnInstruction } from './coreBurn';
import { getCoreAssetCollection } from './das';
import type { NftBurnAccount } from '@/types/token-account';
import type { CloseAccountResult } from '@/types/token-account';
import { saveTransaction } from '@/lib/supabase/transactions';
import { safePublicKey, cleanEnvAddress } from './validators';
import { logger } from '@/lib/utils/logger';
import { MAX_BURN_CLOSE_PER_TX, MAX_CORE_BURN_PER_TX } from './constants';
import type { ReclaimFeeOptions } from './closer';

/** Max SPL/T22 NFTs per tx (each = burn + close = 2 ix). Size-safe for 1232 bytes. */
const SPL_BATCH_SIZE = MAX_BURN_CLOSE_PER_TX;
/** Max Metaplex Core burns per tx (1 ix + 1 account each). */
const CORE_BATCH_SIZE = MAX_CORE_BURN_PER_TX;

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Amount to burn: 1 token, decimals 0 (NFT). */
const NFT_AMOUNT = 1n;
const NFT_DECIMALS = 0;

export async function burnNftAccounts(
  accounts: NftBurnAccount[],
  walletAdapter: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  referrerWallet?: string | null,
  options?: ReclaimFeeOptions
): Promise<CloseAccountResult> {
  try {
    if (!walletAdapter.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET) {
      throw new Error('Fee recipient wallet not configured. Please contact support.');
    }

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

    const coreAccounts = accounts.filter((a) => a.programId.equals(MPL_CORE_PROGRAM_ID));
    const splAccounts = accounts.filter(
      (a) => a.programId.equals(TOKEN_PROGRAM_ID) || a.programId.equals(TOKEN_2022_PROGRAM_ID)
    );
    if (coreAccounts.length === 0 && splAccounts.length === 0) {
      return {
        signature: '',
        accountsClosed: 0,
        solReclaimed: 0,
        success: false,
        error: 'No NFTs to burn.',
        warningMessage: referralDisabledReason ?? undefined,
      };
    }

    const allSignatures: string[] = [];
    let totalClosed = 0;
    let totalReclaimable = 0;
    let finalReferralAmount = 0;

    // —— Metaplex Core burns (BurnV1) ——
    const coreBatches = chunk(coreAccounts, CORE_BATCH_SIZE);
    for (const batch of coreBatches) {
      const transaction = new Transaction();
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }));

      let batchReclaimable = 0;
      for (const account of batch) {
        const assetId = account.pubkey.toBase58();
        let collection: PublicKey | null = null;
        try {
          const collAddr = await getCoreAssetCollection(assetId);
          if (collAddr) collection = new PublicKey(collAddr);
        } catch (e) {
          logger.debug('getCoreAssetCollection failed for', assetId.slice(0, 8), (e as Error)?.message);
        }
        transaction.add(
          createCoreBurnInstruction({
            asset: account.pubkey,
            payer: walletAdapter.publicKey,
            authority: walletAdapter.publicKey,
            collection,
          })
        );
        batchReclaimable += account.rentExemptReserve;
      }

      const batchFeeAmount = Math.floor((batchReclaimable * feePercentage) / 100);
      const batchReferralAmount = validReferrerPubkey
        ? Math.floor((batchReclaimable * referralFeePercentage) / 100)
        : 0;
      if (batchFeeAmount > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: walletAdapter.publicKey,
            toPubkey: feeRecipient,
            lamports: batchFeeAmount,
          })
        );
      }
      if (batchReferralAmount > 0 && validReferrerPubkey) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: walletAdapter.publicKey,
            toPubkey: validReferrerPubkey,
            lamports: batchReferralAmount,
          })
        );
        finalReferralAmount += batchReferralAmount;
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletAdapter.publicKey;

      const sim = await connection.simulateTransaction(transaction);
      if (sim.value.err) {
        const logs = (sim.value.logs ?? []).join('\n');
        logger.warn('Core burn simulation failed', { err: sim.value.err, logs });
        let msg: string;
        const err = sim.value.err;
        if (typeof err === 'object' && err !== null && 'InstructionError' in err) {
          const inner = (err as { InstructionError?: unknown[] }).InstructionError?.[1];
          if (inner && typeof inner === 'object' && inner !== null && 'Custom' in inner) {
            const code = (inner as { Custom: number }).Custom;
            msg = `Program error (code ${code}). Asset may already be burned.`;
          } else {
            msg = typeof inner === 'string' ? inner : JSON.stringify(inner);
          }
        } else {
          msg = String(err);
        }
        return {
          success: false,
          error: `Simulation failed (Core burn): ${msg}`,
          totalClosed,
          totalReclaimable,
          signatures: allSignatures,
          referralAmount: finalReferralAmount,
          warningMessage: referralDisabledReason ?? undefined,
        };
      }

      const signed = await walletAdapter.signTransaction(transaction);
      const sig = await sendAndConfirmWithRetry(connection, signed.serialize());
      totalClosed += batch.length;
      totalReclaimable += batchReclaimable;
      allSignatures.push(sig);
    }

    // —— SPL / Token-2022 burns (BurnChecked + CloseAccount) ——
    const splBatches = chunk(splAccounts, SPL_BATCH_SIZE);
    for (let i = 0; i < splBatches.length; i++) {
      const batch = splBatches[i];
      const transaction = new Transaction();
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }));

      // Token-2022: harvest withheld fees to mint before close, else CloseAccount fails with 0x23.
      const token2022ByMint = new Map<string, { mint: PublicKey; sources: PublicKey[] }>();
      for (const account of batch) {
        const programId = account.programId ?? TOKEN_PROGRAM_ID;
        if (programId.equals(TOKEN_2022_PROGRAM_ID)) {
          const key = account.mint.toBase58();
          if (!token2022ByMint.has(key)) token2022ByMint.set(key, { mint: account.mint, sources: [] });
          token2022ByMint.get(key)!.sources.push(account.pubkey);
        }
      }
      const token2022WithFee = await filterToken2022MintsWithTransferFee(connection, token2022ByMint);
      for (const { mint, sources } of token2022WithFee.values()) {
        transaction.add(createHarvestWithheldTokensToMintInstruction(mint, sources, TOKEN_2022_PROGRAM_ID));
      }

      let batchReclaimable = 0;

      for (const account of batch) {
        const programId = account.programId ?? TOKEN_PROGRAM_ID;
        transaction.add(
          createBurnCheckedInstruction(
            account.pubkey,
            account.mint,
            walletAdapter.publicKey,
            NFT_AMOUNT,
            NFT_DECIMALS,
            [],
            programId
          )
        );
        transaction.add(
          createCloseAccountInstruction(
            account.pubkey,
            walletAdapter.publicKey,
            walletAdapter.publicKey,
            [],
            programId
          )
        );
        batchReclaimable += account.rentExemptReserve;
      }

      totalReclaimable += batchReclaimable;
      const batchFeeAmount = Math.floor((batchReclaimable * feePercentage) / 100);
      const batchReferralAmount = validReferrerPubkey
        ? Math.floor((batchReclaimable * referralFeePercentage) / 100)
        : 0;

      if (batchFeeAmount > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: walletAdapter.publicKey,
            toPubkey: feeRecipient,
            lamports: batchFeeAmount,
          })
        );
      }
      if (batchReferralAmount > 0 && validReferrerPubkey) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: walletAdapter.publicKey,
            toPubkey: validReferrerPubkey,
            lamports: batchReferralAmount,
          })
        );
        finalReferralAmount += batchReferralAmount;
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletAdapter.publicKey;

      const signed = await walletAdapter.signTransaction(transaction);
      const signature = await sendAndConfirmWithRetry(connection, signed.serialize());

      totalClosed += batch.length;
      allSignatures.push(signature);
    }

    const solReclaimed = totalReclaimable / 1e9;
    const totalFeeAmount = Math.floor((totalReclaimable * feePercentage) / 100);
    const totalFeesPaid = (totalFeeAmount + finalReferralAmount) / 1e9;
    const netReceived = solReclaimed - totalFeesPaid;

    try {
      await saveTransaction({
        signature: allSignatures[0],
        wallet_address: walletAdapter.publicKey.toString(),
        accounts_closed: totalClosed,
        sol_reclaimed: solReclaimed,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: validReferrerPubkey ? referrerWallet ?? undefined : undefined,
        referral_earned: finalReferralAmount > 0 ? finalReferralAmount / 1e9 : undefined,
        timestamp: Date.now(),
        reclaim_type: 'nft_burn',
      });
    } catch (supabaseError) {
      logger.error('Supabase save error:', supabaseError);
    }

    return {
      signature: allSignatures[0],
      accountsClosed: totalClosed,
      solReclaimed: netReceived,
      success: true,
      warningMessage: referralDisabledReason ?? undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('burnNftAccounts error:', message);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: message,
    };
  }
}
