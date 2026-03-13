/**
 * Full Reclaim: close (empty) + burn+close (dust) + burn+close (NFT) + close Pump PDA(s) + close PumpSwap PDA(s) + fee + referral.
 * No artificial limit: batches by Solana instruction limit (64/tx). Multiple txs sent in sequence if needed.
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createCloseAccountInstruction,
  createBurnCheckedInstruction,
  createHarvestWithheldTokensToMintInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { filterToken2022MintsWithTransferFee } from './token2022Harvest';
import { getConnection } from './connection';
import { sendAndConfirmWithRetry } from './sendAndConfirmWithRetry';
import type { TokenAccount } from '@/types/token-account';
import type { DustAccount, NftBurnAccount } from '@/types/token-account';
import type { CloseAccountResult } from '@/types/token-account';
import { saveTransaction } from '@/lib/supabase/transactions';
import { getCreatorPointsBonus } from '@/lib/nftCreator';
import { safePublicKey, cleanEnvAddress } from './validators';
import { buildClosePumpPdaInstruction } from './pumpClose';
import type { PumpPdaAccount } from './pump';
import { buildClosePumpSwapPdaInstruction } from './pumpSwapClose';
import type { PumpSwapPdaAccount } from './pumpSwap';
import { logger } from '@/lib/utils/logger';
import { RECLAIM_ACCOUNT_BUDGET_PER_TX } from './constants';
import type { ReclaimFeeOptions } from './closer';

const NFT_BURN_AMOUNT = 1n;
const NFT_DECIMALS = 0;

/** One batch that fits in RECLAIM_ACCOUNT_BUDGET_PER_TX unique accounts (keeps legacy tx under 1232 bytes). */
function takeNextBatch(
  empty: TokenAccount[],
  dust: DustAccount[],
  nft: NftBurnAccount[],
  pump: PumpPdaAccount[],
  pumpSwap: PumpSwapPdaAccount[]
): {
  emptyBatch: TokenAccount[];
  dustBatch: DustAccount[];
  nftBatch: NftBurnAccount[];
  pumpBatch: PumpPdaAccount[];
  pumpSwapBatch: PumpSwapPdaAccount[];
  remainingEmpty: TokenAccount[];
  remainingDust: DustAccount[];
  remainingNft: NftBurnAccount[];
  remainingPump: PumpPdaAccount[];
  remainingPumpSwap: PumpSwapPdaAccount[];
} {
  let accountBudget = RECLAIM_ACCOUNT_BUDGET_PER_TX;
  const emptyBatch: TokenAccount[] = [];
  const dustBatch: DustAccount[] = [];
  const nftBatch: NftBurnAccount[] = [];
  const pumpBatch: PumpPdaAccount[] = [];
  const pumpSwapBatch: PumpSwapPdaAccount[] = [];

  for (const a of empty) {
    if (accountBudget < 1) break;
    emptyBatch.push(a);
    accountBudget -= 1;
  }
  for (const a of dust) {
    if (accountBudget < 2) break;
    dustBatch.push(a);
    accountBudget -= 2;
  }
  for (const a of nft) {
    if (accountBudget < 2) break;
    nftBatch.push(a);
    accountBudget -= 2;
  }
  for (const p of pump) {
    if (accountBudget < 1) break;
    pumpBatch.push(p);
    accountBudget -= 1;
  }
  for (const p of pumpSwap) {
    if (accountBudget < 1) break;
    pumpSwapBatch.push(p);
    accountBudget -= 1;
  }

  const usedEmpty = emptyBatch.length;
  const usedDust = dustBatch.length;
  const usedNft = nftBatch.length;
  const usedPump = pumpBatch.length;
  const usedPumpSwap = pumpSwapBatch.length;

  return {
    emptyBatch,
    dustBatch,
    nftBatch,
    pumpBatch,
    pumpSwapBatch,
    remainingEmpty: empty.slice(usedEmpty),
    remainingDust: dust.slice(usedDust),
    remainingNft: nft.slice(usedNft),
    remainingPump: pump.slice(usedPump),
    remainingPumpSwap: pumpSwap.slice(usedPumpSwap),
  };
}

export async function fullReclaimSingleTx(
  emptyAccounts: TokenAccount[],
  dustAccounts: DustAccount[],
  nftBurnAccounts: NftBurnAccount[],
  pumpPdas: PumpPdaAccount[],
  pumpSwapPdas: PumpSwapPdaAccount[],
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

    const totalEmptyLamports = emptyAccounts.reduce((s, a) => s + a.rentExemptReserve, 0);
    const totalDustLamports = dustAccounts.reduce((s, a) => s + a.rentExemptReserve, 0);
    const totalNftLamports = nftBurnAccounts.reduce((s, a) => s + a.rentExemptReserve, 0);
    const totalPumpLamports = pumpPdas.reduce((s, p) => s + p.lamports, 0);
    const totalPumpSwapLamports = pumpSwapPdas.reduce((s, p) => s + p.lamports, 0);
    const totalLamports = totalEmptyLamports + totalDustLamports + totalNftLamports + totalPumpLamports + totalPumpSwapLamports;
    const feeLamports = Math.floor((totalLamports * feePercentage) / 100);
    const referralLamports = validReferrerPubkey
      ? Math.floor((totalLamports * referralFeePercentage) / 100)
      : 0;

    const totalClosed = emptyAccounts.length + dustAccounts.length + nftBurnAccounts.length + pumpPdas.length + pumpSwapPdas.length;
    if (totalClosed === 0) {
      return {
        signature: '',
        accountsClosed: 0,
        solReclaimed: 0,
        success: false,
        error: 'No accounts to reclaim.',
      };
    }

    let remainingEmpty = [...emptyAccounts];
    let remainingDust = [...dustAccounts];
    let remainingNft = [...nftBurnAccounts];
    let remainingPump = [...pumpPdas];
    let remainingPumpSwap = [...pumpSwapPdas];
    const allSignatures: string[] = [];

    while (
      remainingEmpty.length > 0 ||
      remainingDust.length > 0 ||
      remainingNft.length > 0 ||
      remainingPump.length > 0 ||
      remainingPumpSwap.length > 0
    ) {
      const { emptyBatch, dustBatch, nftBatch, pumpBatch, pumpSwapBatch, remainingEmpty: nextEmpty, remainingDust: nextDust, remainingNft: nextNft, remainingPump: nextPump, remainingPumpSwap: nextPumpSwap } = takeNextBatch(
        remainingEmpty,
        remainingDust,
        remainingNft,
        remainingPump,
        remainingPumpSwap
      );
      remainingEmpty = nextEmpty;
      remainingDust = nextDust;
      remainingNft = nextNft;
      remainingPump = nextPump;
      remainingPumpSwap = nextPumpSwap;

      const transaction = new Transaction();
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));

      // Token-2022: harvest withheld fees to mint before close, else CloseAccount fails with 0x23.
      const token2022ByMint = new Map<string, { mint: PublicKey; sources: PublicKey[] }>();
      for (const account of emptyBatch) {
        const programId = account.programId ?? TOKEN_PROGRAM_ID;
        if (programId.equals(TOKEN_2022_PROGRAM_ID)) {
          const key = account.mint.toBase58();
          if (!token2022ByMint.has(key)) token2022ByMint.set(key, { mint: account.mint, sources: [] });
          token2022ByMint.get(key)!.sources.push(account.pubkey);
        }
      }
      for (const account of dustBatch) {
        const programId = account.programId ?? TOKEN_PROGRAM_ID;
        if (programId.equals(TOKEN_2022_PROGRAM_ID)) {
          const key = account.mint.toBase58();
          if (!token2022ByMint.has(key)) token2022ByMint.set(key, { mint: account.mint, sources: [] });
          token2022ByMint.get(key)!.sources.push(account.pubkey);
        }
      }
      for (const nft of nftBatch) {
        const programId = nft.programId ?? TOKEN_PROGRAM_ID;
        if (programId.equals(TOKEN_2022_PROGRAM_ID)) {
          const key = nft.mint.toBase58();
          if (!token2022ByMint.has(key)) token2022ByMint.set(key, { mint: nft.mint, sources: [] });
          token2022ByMint.get(key)!.sources.push(nft.pubkey);
        }
      }
      const token2022WithFee = await filterToken2022MintsWithTransferFee(connection, token2022ByMint);
      for (const { mint, sources } of token2022WithFee.values()) {
        transaction.add(createHarvestWithheldTokensToMintInstruction(mint, sources, TOKEN_2022_PROGRAM_ID));
      }

      for (const account of emptyBatch) {
        const programId = account.programId ?? TOKEN_PROGRAM_ID;
        transaction.add(
          createCloseAccountInstruction(
            account.pubkey,
            walletAdapter.publicKey,
            walletAdapter.publicKey,
            [],
            programId
          )
        );
      }
      for (const account of dustBatch) {
        const programId = account.programId ?? TOKEN_PROGRAM_ID;
        transaction.add(
          createBurnCheckedInstruction(
            account.pubkey,
            account.mint,
            walletAdapter.publicKey,
            account.balanceRaw,
            account.decimals,
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
      }
      for (const nft of nftBatch) {
        const programId = nft.programId ?? TOKEN_PROGRAM_ID;
        transaction.add(
          createBurnCheckedInstruction(
            nft.pubkey,
            nft.mint,
            walletAdapter.publicKey,
            NFT_BURN_AMOUNT,
            NFT_DECIMALS,
            [],
            programId
          )
        );
        transaction.add(
          createCloseAccountInstruction(
            nft.pubkey,
            walletAdapter.publicKey,
            walletAdapter.publicKey,
            [],
            programId
          )
        );
      }
      for (const pda of pumpBatch) {
        transaction.add(buildClosePumpPdaInstruction(pda.pubkey, walletAdapter.publicKey));
      }
      for (const pda of pumpSwapBatch) {
        transaction.add(buildClosePumpSwapPdaInstruction(pda.pubkey, walletAdapter.publicKey));
      }

      const isLastBatch = remainingEmpty.length === 0 && remainingDust.length === 0 && remainingNft.length === 0 && remainingPump.length === 0 && remainingPumpSwap.length === 0;
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
      logger.debug('Full reclaim batch sent:', signature.slice(0, 8) + '...');
    }

    const signature = allSignatures[0] ?? '';
    const solReclaimedGross = totalLamports / 1e9;
    const totalFeesPaid = (feeLamports + referralLamports) / 1e9;
    const netReceived = solReclaimedGross - totalFeesPaid;

    try {
      const walletStr = walletAdapter.publicKey.toString();
      const f1CreatorBonusPts = await getCreatorPointsBonus(walletStr).catch(() => 0);
      await saveTransaction({
        signature,
        wallet_address: walletStr,
        accounts_closed: totalClosed,
        sol_reclaimed: solReclaimedGross,
        fee: totalFeesPaid,
        net_received: netReceived,
        referrer_code: validReferrerPubkey ? referrerWallet ?? undefined : undefined,
        referral_earned: referralLamports > 0 ? referralLamports / 1e9 : undefined,
        timestamp: Date.now(),
        reclaim_type: 'full_reclaim',
        f1_creator_bonus_pts: f1CreatorBonusPts,
      });
    } catch (supabaseError) {
      logger.error('Supabase save error:', supabaseError);
    }

    return {
      signature,
      accountsClosed: totalClosed,
      solReclaimed: netReceived,
      success: true,
      warningMessage: referralDisabledReason ?? undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('fullReclaimSingleTx error:', message);
    return {
      signature: '',
      accountsClosed: 0,
      solReclaimed: 0,
      success: false,
      error: message,
    };
  }
}

/** No artificial limit: full reclaim batches by Solana instruction limit; always allowed. */
export function canFullReclaimSingleTx(
  _emptyCount: number,
  _dustCount: number,
  _nftCount = 0,
  _pumpPdaCount = 0,
  _pumpSwapPdaCount = 0
): boolean {
  return true;
}
