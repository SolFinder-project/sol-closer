/**
 * Burn compressed NFTs (cNFTs) via Metaplex Bubblegum, then charge fee + referral on reclaimed SOL.
 * Processes assets in chunks of MAX_CNFT_BURNS_PER_TX (1 recommended: proof size often makes multi-burn tx exceed 1232 bytes).
 */

import { PublicKey } from '@solana/web3.js';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { getAssetWithProof, burn } from '@metaplex-foundation/mpl-bubblegum';
import { getRpcUrl } from './connection';
import { getConnection } from './connection';
import { saveTransaction } from '@/lib/supabase/transactions';
import { cleanEnvAddress, safePublicKey } from './validators';
import { logger } from '@/lib/utils/logger';
import type { CloseAccountResult } from '@/types/token-account';
import type { DasAsset } from './das';
import { MAX_CNFT_BURNS_PER_TX } from './constants';
import type { ReclaimFeeOptions } from './closer';

/** Wallet adapter–like (publicKey + signTransaction) for Umi. */
type WalletLike = {
  publicKey: PublicKey;
  signTransaction: (tx: unknown) => Promise<unknown>;
};

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

    for (let chunkStart = 0; chunkStart < assets.length; chunkStart += MAX_CNFT_BURNS_PER_TX) {
      const chunk = assets.slice(chunkStart, chunkStart + MAX_CNFT_BURNS_PER_TX);
      let builder: ReturnType<typeof burn> | null = null;

      for (const asset of chunk) {
        const assetId = umiPublicKey(asset.id);
        const assetWithProof = await getAssetWithProof(umi, assetId, { truncateCanopy: true });
        const burnIx = burn(umi, {
          ...assetWithProof,
          leafOwner: assetWithProof.leafOwner,
        });
        builder = builder == null ? burnIx : builder.add(burnIx);
      }

      if (builder == null) continue;
      try {
        // Send only: no confirm wait (same as other closers via sendAndConfirmWithRetry).
        // UI shows success as soon as tx is sent; avoids long delay and websocket errors.
        const signature = await builder.send(umi);
        if (signature) {
          allSignatures.push(signature);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const firstId = chunk[0]?.id?.slice(0, 8) ?? '?';
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
      await saveTransaction({
        signature: allSignatures[0],
        wallet_address: walletAdapter.publicKey.toString(),
        accounts_closed: assets.length,
        sol_reclaimed: solReclaimed,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: validReferrerPubkey ? referrerWallet ?? undefined : undefined,
        referral_earned: finalReferralAmount > 0 ? finalReferralAmount / 1e9 : undefined,
        timestamp: Date.now(),
        reclaim_type: 'cnft_close',
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
