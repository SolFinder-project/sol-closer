import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { 
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { getConnection } from './connection';
import { sendAndConfirmWithRetry } from './sendAndConfirmWithRetry';
import { TokenAccount, CloseAccountResult } from '@/types/token-account';
import { saveTransaction } from '@/lib/supabase/transactions';
import { safePublicKey, cleanEnvAddress } from './validators';
import { logger } from '@/lib/utils/logger';
import { MAX_EMPTY_CLOSE_PER_TX } from './constants';

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export interface ReclaimFeeOptions {
  feePercent?: number;
  referralPercent?: number;
}

export async function closeTokenAccounts(
  accounts: TokenAccount[],
  walletAdapter: any,
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
    logger.debug('Fee recipient validated:', feeRecipient.toString().slice(0, 8) + '...');

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

    const batches = chunk(accounts, MAX_EMPTY_CLOSE_PER_TX);
    logger.debug('Processing', accounts.length, 'accounts in', batches.length, 'batches (max', MAX_EMPTY_CLOSE_PER_TX, 'per tx)');

    let totalAccountsClosed = 0;
    let totalReclaimable = 0;
    let allSignatures: string[] = [];
    let finalReferralAmount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.debug('Batch', i + 1, '/', batches.length, '(', batch.length, 'accounts)');

      const transaction = new Transaction();
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));

      let batchReclaimable = 0;

      for (const account of batch) {
        const programId = account.programId || TOKEN_PROGRAM_ID;
        transaction.add(createCloseAccountInstruction(
          account.pubkey,
          walletAdapter.publicKey,
          walletAdapter.publicKey,
          [],
          programId
        ));
        batchReclaimable += account.rentExemptReserve;
      }

      totalReclaimable += batchReclaimable;
      const batchFeeAmount = Math.floor(batchReclaimable * feePercentage / 100);
      const batchReferralAmount = validReferrerPubkey ? Math.floor(batchReclaimable * referralFeePercentage / 100) : 0;

      if (batchFeeAmount > 0) {
        transaction.add(SystemProgram.transfer({
          fromPubkey: walletAdapter.publicKey,
          toPubkey: feeRecipient,
          lamports: batchFeeAmount,
        }));
      }

      if (batchReferralAmount > 0 && validReferrerPubkey) {
        transaction.add(SystemProgram.transfer({
          fromPubkey: walletAdapter.publicKey,
          toPubkey: validReferrerPubkey,
          lamports: batchReferralAmount,
        }));
        finalReferralAmount += batchReferralAmount;
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletAdapter.publicKey;

      const signed = await walletAdapter.signTransaction(transaction);
      const signature = await sendAndConfirmWithRetry(connection, signed.serialize());

      totalAccountsClosed += batch.length;
      allSignatures.push(signature);
      logger.debug('Batch', i + 1, 'complete:', signature.slice(0, 8) + '...');
    }

    const solReclaimed = totalReclaimable / 1e9;
    const totalFeeAmount = Math.floor(totalReclaimable * feePercentage / 100);
    const totalFeesPaid = (totalFeeAmount + finalReferralAmount) / 1e9;
    const netReceived = solReclaimed - totalFeesPaid;

    try {
      await saveTransaction({
        signature: allSignatures[0],
        wallet_address: walletAdapter.publicKey.toString(),
        accounts_closed: totalAccountsClosed,
        sol_reclaimed: solReclaimed,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: validReferrerPubkey ? referrerWallet : undefined,
        referral_earned: finalReferralAmount > 0 ? finalReferralAmount / 1e9 : undefined,
        timestamp: Date.now(),
        reclaim_type: 'empty',
      });
    } catch (supabaseError) {
      logger.error('Supabase save error:', supabaseError);
    }

    return {
      signature: allSignatures[0],
      accountsClosed: totalAccountsClosed,
      solReclaimed: netReceived,
      success: true,
      warningMessage: referralDisabledReason || undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('closeTokenAccounts error:', message);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
