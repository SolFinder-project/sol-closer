/**
 * PumpSwap user_volume_accumulator PDA reclaim with fee and referral.
 * Same model as Pump.fun: close PDA(s), pay fee + referral.
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { getConnection } from './connection';
import { sendAndConfirmWithRetry } from './sendAndConfirmWithRetry';
import type { CloseAccountResult } from '@/types/token-account';
import type { PumpSwapPdaAccount } from './pumpSwap';
import { buildClosePumpSwapPdaInstruction, isPumpSwapCloseAvailable } from './pumpSwapClose';
import { saveTransaction } from '@/lib/supabase/transactions';
import { getCreatorPointsBonus } from '@/lib/nftCreator';
import { safePublicKey, cleanEnvAddress } from './validators';
import { logger } from '@/lib/utils/logger';
import { MAX_SINGLE_IX_RECLAIM_PER_TX } from './constants';
import type { ReclaimFeeOptions } from './closer';

export async function closePumpSwapPdas(
  pdas: PumpSwapPdaAccount[],
  walletAdapter: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  referrerWallet?: string | null,
  options?: ReclaimFeeOptions
): Promise<CloseAccountResult> {
  if (!isPumpSwapCloseAvailable()) {
    throw new Error('PumpSwap close instruction not available.');
  }

  try {
    if (!walletAdapter.publicKey) {
      throw new Error('Wallet not connected');
    }
    if (pdas.length === 0) {
      throw new Error('No PumpSwap PDAs to close');
    }
    if (!process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET) {
      throw new Error('Fee recipient wallet not configured. Please contact support.');
    }

    const connection = getConnection();
    const feePercentage = options?.feePercent ?? Number(process.env.NEXT_PUBLIC_SERVICE_FEE_PERCENTAGE || 20);
    const referralFeePercentage = options?.referralPercent ?? Number(process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || 10);
    const feeRecipient = new PublicKey(cleanEnvAddress(process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET));

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

    const totalReclaimable = pdas.reduce((sum, p) => sum + p.lamports, 0);
    const feeLamports = Math.floor((totalReclaimable * feePercentage) / 100);
    const referralLamports = validReferrerPubkey
      ? Math.floor((totalReclaimable * referralFeePercentage) / 100)
      : 0;

    const allSignatures: string[] = [];
    for (let i = 0; i < pdas.length; i += MAX_SINGLE_IX_RECLAIM_PER_TX) {
      const batch = pdas.slice(i, i + MAX_SINGLE_IX_RECLAIM_PER_TX);
      const isLastBatch = i + batch.length >= pdas.length;
      const transaction = new Transaction();
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

      for (const pda of batch) {
        transaction.add(buildClosePumpSwapPdaInstruction(pda.pubkey, walletAdapter.publicKey));
      }

      if (isLastBatch) {
        if (feeLamports > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: walletAdapter.publicKey,
              toPubkey: feeRecipient,
              lamports: feeLamports,
            })
          );
        }
        if (referralLamports > 0 && validReferrerPubkey) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: walletAdapter.publicKey,
              toPubkey: validReferrerPubkey,
              lamports: referralLamports,
            })
          );
        }
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletAdapter.publicKey;

      const signed = await walletAdapter.signTransaction(transaction);
      const signature = await sendAndConfirmWithRetry(connection, signed.serialize());
      allSignatures.push(signature);
    }

    const signature = allSignatures[0] ?? '';
    const solReclaimedGross = totalReclaimable / 1e9;
    const totalFeesPaid = (feeLamports + referralLamports) / 1e9;
    const netReceived = solReclaimedGross - totalFeesPaid;

    try {
      const walletStr = walletAdapter.publicKey.toString();
      const f1CreatorBonusPts = await getCreatorPointsBonus(walletStr).catch(() => 0);
      await saveTransaction({
        signature,
        wallet_address: walletStr,
        accounts_closed: pdas.length,
        sol_reclaimed: solReclaimedGross,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: validReferrerPubkey ? referrerWallet ?? undefined : undefined,
        referral_earned: referralLamports > 0 ? referralLamports / 1e9 : undefined,
        timestamp: Date.now(),
        reclaim_type: 'pumpswap',
        f1_creator_bonus_pts: f1CreatorBonusPts,
      });
    } catch (supabaseError) {
      logger.error('PumpSwap reclaim Supabase save error:', supabaseError);
    }

    return {
      signature,
      accountsClosed: pdas.length,
      solReclaimed: netReceived,
      success: true,
      warningMessage: referralDisabledReason ?? undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('closePumpSwapPdas error:', message);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: message,
    };
  }
}
