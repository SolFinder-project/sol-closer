/**
 * Drift user account close with fee and referral.
 * Builds the close tx via API (server uses @drift-labs/sdk); client signs and sends.
 */

import {
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { getConnection } from './connection';
import { sendAndConfirmWithRetry } from './sendAndConfirmWithRetry';
import type { CloseAccountResult } from '@/types/token-account';
import type { DriftUserAccount } from './drift';
import { saveTransaction } from '@/lib/supabase/transactions';
import { getCreatorPointsBonus } from '@/lib/nftCreator';
import { safePublicKey, cleanEnvAddress } from './validators';
import { logger } from '@/lib/utils/logger';
import type { ReclaimFeeOptions } from './closer';

export async function closeDriftUserAccounts(
  accounts: DriftUserAccount[],
  walletAdapter: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  referrerWallet?: string | null,
  options?: ReclaimFeeOptions
): Promise<CloseAccountResult> {
  try {
    if (!walletAdapter.publicKey) {
      throw new Error('Wallet not connected');
    }
    if (accounts.length === 0) {
      throw new Error('No Drift user accounts to close');
    }
    if (!process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET) {
      throw new Error('Fee recipient wallet not configured. Please contact support.');
    }

    const connection = getConnection();
    const feePercentage = options?.feePercent ?? Number(process.env.NEXT_PUBLIC_SERVICE_FEE_PERCENTAGE || 20);
    const referralFeePercentage = options?.referralPercent ?? Number(process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || 10);
    const feeRecipient = cleanEnvAddress(process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET);

    let validReferrerPubkey: string | null = null;
    let referralDisabledReason: string | null = null;

    if (referrerWallet && referrerWallet !== walletAdapter.publicKey.toString()) {
      try {
        const referrerPubkey = safePublicKey(referrerWallet);
        if (referrerPubkey && !referrerPubkey.equals(walletAdapter.publicKey)) {
          const accountInfo = await connection.getAccountInfo(referrerPubkey);
          if (accountInfo === null) {
            referralDisabledReason = 'Referrer wallet not initialized on-chain (must have received SOL at least once).';
          } else {
            validReferrerPubkey = referrerWallet;
          }
        }
      } catch {
        referralDisabledReason = 'Invalid referrer address.';
      }
    }

    const totalReclaimable = accounts.reduce((sum, a) => sum + a.lamports, 0);
    const feeLamports = Math.floor((totalReclaimable * feePercentage) / 100);
    const referralLamports = validReferrerPubkey
      ? Math.floor((totalReclaimable * referralFeePercentage) / 100)
      : 0;

    const res = await fetch('/api/drift/build-close-tx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountPubkeys: accounts.map((a) => a.pubkey.toString()),
        authority: walletAdapter.publicKey.toString(),
        feeLamports,
        referralLamports,
        referrerPubkey: validReferrerPubkey,
        feeRecipient,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `API error ${res.status}`);
    }

    const { serializedTransaction } = (await res.json()) as { serializedTransaction: string };
    if (!serializedTransaction) {
      throw new Error('No transaction returned');
    }

    const raw = atob(serializedTransaction);
    const txBuf = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) txBuf[i] = raw.charCodeAt(i);
    const transaction = Transaction.from(txBuf);

    const signed = await walletAdapter.signTransaction(transaction);
    const signature = await sendAndConfirmWithRetry(connection, signed.serialize());

    const solReclaimedGross = totalReclaimable / 1e9;
    const totalFeesPaid = (feeLamports + referralLamports) / 1e9;
    const netReceived = solReclaimedGross - totalFeesPaid;

    try {
      const walletStr = walletAdapter.publicKey.toString();
      const f1CreatorBonusPts = await getCreatorPointsBonus(walletStr).catch(() => 0);
      await saveTransaction({
        signature,
        wallet_address: walletStr,
        accounts_closed: accounts.length,
        sol_reclaimed: solReclaimedGross,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: validReferrerPubkey ?? undefined,
        referral_earned: referralLamports > 0 ? referralLamports / 1e9 : undefined,
        timestamp: Date.now(),
        reclaim_type: 'drift',
        f1_creator_bonus_pts: f1CreatorBonusPts,
      });
    } catch (supabaseError) {
      logger.error('Drift reclaim Supabase save error:', supabaseError);
    }

    return {
      signature,
      accountsClosed: accounts.length,
      solReclaimed: netReceived,
      success: true,
      warningMessage: referralDisabledReason ?? undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('closeDriftUserAccounts error:', message);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: message,
    };
  }
}
