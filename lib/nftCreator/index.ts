/**
 * NFT Creator feature – eligibility, tier bonuses, badge.
 * Uses: transactions (last reclaim net), nft_creator_submissions.reclaim_signature (one reclaim = one NFT), nft_creator_tiers (mint → tier), DAS (wallet NFTs).
 */

import { PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase/client';
import { getClassicNftMintsByOwner } from '@/lib/solana/das';
import type { NftCreatorTier } from '@/types/nftCreator';
import {
  CREATOR_POINTS_BONUS,
  CREATOR_TIME_BONUS_MS,
  CREATOR_RECLAIM_FEE_PERCENT,
  CREATOR_REFERRAL_PERCENT,
  CREATOR_COLLECTOR_POINTS,
  CREATOR_COLLECTOR_TIME_MS,
  NFT_CREATOR_MIN_RECLAIM_SOL,
} from '@/types/nftCreator';

/** Last reclaim net (SOL) for wallet from `transactions`. */
export async function getLastReclaimNet(walletAddress: string): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('net_received')
    .eq('wallet_address', walletAddress)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 0;
  const net = Number((data as { net_received?: number }).net_received ?? 0);
  return Number.isFinite(net) ? net : 0;
}

/** Last reclaim for wallet: net (SOL) and signature. Uses provided client (e.g. admin) for server-side check. */
export async function getLastReclaim(
  walletAddress: string,
  db: { from: (table: string) => ReturnType<ReturnType<typeof supabase.from>> }
): Promise<{ net_received: number; signature: string } | null> {
  const { data, error } = await db
    .from('transactions')
    .select('net_received, signature')
    .eq('wallet_address', walletAddress)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { net_received?: number; signature?: string };
  const net = Number(row?.net_received ?? 0);
  const sig = typeof row?.signature === 'string' && row.signature.trim() ? row.signature.trim() : null;
  if (!Number.isFinite(net) || !sig) return null;
  return { net_received: net, signature: sig };
}

/** Check if this reclaim signature was already used for a finalized NFT by this wallet. */
export async function isReclaimAlreadyUsed(
  walletAddress: string,
  reclaimSignature: string,
  db: { from: (table: string) => ReturnType<ReturnType<typeof supabase.from>> }
): Promise<boolean> {
  const { data, error } = await db
    .from('nft_creator_submissions')
    .select('id')
    .eq('wallet_address', walletAddress)
    .eq('status', 'finalized')
    .eq('reclaim_signature', reclaimSignature)
    .limit(1)
    .maybeSingle();

  return !error && data != null;
}

/** Reason why the user cannot create an NFT (when canCreateNft is false). */
export type EligibilityReason = 'min_not_met' | 'reclaim_already_used' | 'no_reclaim';

export interface EligibilityResult {
  lastNetSol: number;
  canCreateNft: boolean;
  ceilingSol: number;
  /** Set when canCreateNft is false: why creation is locked. */
  reason?: EligibilityReason;
}

/**
 * Eligibility for "Create NFT": last reclaim net >= NFT_CREATOR_MIN_RECLAIM_SOL and that reclaim not yet used for a finalized NFT.
 * Pass a Supabase client (e.g. admin) as second arg for the "one reclaim = one NFT" check; otherwise only net threshold is applied.
 */
export async function getEligibility(
  walletAddress: string,
  db?: { from: (table: string) => ReturnType<ReturnType<typeof supabase.from>> }
): Promise<EligibilityResult> {
  if (db) {
    const last = await getLastReclaim(walletAddress, db);
    if (!last) {
      return { lastNetSol: 0, canCreateNft: false, ceilingSol: 0, reason: 'no_reclaim' };
    }
    const aboveThreshold = last.net_received >= NFT_CREATOR_MIN_RECLAIM_SOL;
    const alreadyUsed = aboveThreshold && (await isReclaimAlreadyUsed(walletAddress, last.signature, db));
    const canCreateNft = aboveThreshold && !alreadyUsed;
    const reason: EligibilityReason | undefined = canCreateNft
      ? undefined
      : alreadyUsed
        ? 'reclaim_already_used'
        : 'min_not_met';
    return {
      lastNetSol: last.net_received,
      canCreateNft,
      ceilingSol: last.net_received,
      reason,
    };
  }

  const lastNetSol = await getLastReclaimNet(walletAddress);
  const canCreateNft = lastNetSol >= NFT_CREATOR_MIN_RECLAIM_SOL;
  return {
    lastNetSol,
    canCreateNft,
    ceilingSol: lastNetSol,
    reason: canCreateNft ? undefined : lastNetSol === 0 ? 'no_reclaim' : 'min_not_met',
  };
}

/** All creator mints and their tier from DB. */
async function getCreatorTiersMap(): Promise<Map<string, NftCreatorTier>> {
  const { data, error } = await supabase
    .from('nft_creator_tiers')
    .select('mint_address, tier');
  if (error || !data) return new Map();
  const map = new Map<string, NftCreatorTier>();
  for (const row of data as { mint_address: string; tier: string }[]) {
    if (row.tier === 'standard' || row.tier === 'silver' || row.tier === 'gold' || row.tier === 'platinum') {
      map.set(row.mint_address, row.tier as NftCreatorTier);
    }
  }
  return map;
}

/** Best tier first (platinum > gold > silver > standard). */
const TIER_ORDER: NftCreatorTier[] = ['platinum', 'gold', 'silver', 'standard'];

/** Best Creator tier for wallet (among NFTs they hold that are in nft_creator_tiers). */
export async function getBestCreatorTierForWallet(
  walletAddress: string,
  rpcOptions?: CreatorNftsRpcOptions
): Promise<NftCreatorTier | null> {
  const [tiersMap, walletMints] = await Promise.all([
    getCreatorTiersMap(),
    getClassicNftMintsByOwner(new PublicKey(walletAddress), rpcOptions),
  ]);
  if (tiersMap.size === 0 || walletMints.length === 0) return null;
  const walletMintSet = new Set(walletMints.map((m) => m.mint).filter(Boolean));
  let best: NftCreatorTier | null = null;
  for (const tier of TIER_ORDER) {
    for (const [mint, t] of tiersMap) {
      if (t === tier && walletMintSet.has(mint)) {
        return tier;
      }
    }
  }
  return null;
}

/** Options for RPC/DAS when calling from server (proxy + headers to avoid 401). */
export type CreatorNftsRpcOptions = { rpcUrl?: string; fetch?: import('@/lib/solana/das').DasFetch };

/** Whether wallet holds at least one NFT from SolPit Creator collection (in nft_creator_tiers). */
export async function hasCreatorNft(walletAddress: string): Promise<boolean> {
  const tier = await getBestCreatorTierForWallet(walletAddress);
  return tier != null;
}

/** Creator NFTs held by wallet with name and tier (for F1/reclaim benefits UI). */
export async function getCreatorNftsForWallet(
  walletAddress: string,
  rpcOptions?: CreatorNftsRpcOptions
): Promise<{ mint: string; name: string; tier: NftCreatorTier }[]> {
  const [tiersMap, walletMints] = await Promise.all([
    getCreatorTiersMap(),
    getClassicNftMintsByOwner(new PublicKey(walletAddress), rpcOptions),
  ]);
  const walletMintSet = new Set(walletMints.map((m) => m.mint).filter(Boolean));
  const creatorMints = [...tiersMap.entries()].filter(([mint]) => walletMintSet.has(mint));
  if (creatorMints.length === 0) return [];
  const mints = creatorMints.map(([m]) => m);
  const { data: rows } = await supabase
    .from('nft_creator_submissions')
    .select('mint_address, name')
    .in('mint_address', mints)
    .eq('status', 'finalized');
  const nameByMint = new Map<string, string>();
  for (const r of rows ?? []) {
    const row = r as { mint_address: string; name: string };
    if (row.mint_address && row.name) nameByMint.set(row.mint_address, row.name);
  }
  return creatorMints.map(([mint, tier]) => ({
    mint,
    name: nameByMint.get(mint) ?? 'SolPit Creator',
    tier,
  }));
}

/** Points bonus (per reclaim) for Creator tier + collector bonus (2+ NFTs). Uses same source as getCreatorNftsForWallet (banner). */
export async function getCreatorPointsBonus(
  walletAddress: string,
  rpcOptions?: CreatorNftsRpcOptions
): Promise<number> {
  const nfts = await getCreatorNftsForWallet(walletAddress, rpcOptions);
  if (nfts.length === 0) return 0;
  const best = nfts.reduce((a, b) =>
    TIER_ORDER.indexOf(b.tier) < TIER_ORDER.indexOf(a.tier) ? b : a
  );
  let points = CREATOR_POINTS_BONUS[best.tier];
  if (nfts.length >= 2) points += CREATOR_COLLECTOR_POINTS;
  return points;
}

/** Race time bonus in ms (subtract from lap time) for Creator tier + collector bonus (2+ NFTs). Uses same source as getCreatorNftsForWallet (banner). */
export async function getCreatorRaceTimeBonusMs(
  walletAddress: string,
  rpcOptions?: CreatorNftsRpcOptions
): Promise<number> {
  const nfts = await getCreatorNftsForWallet(walletAddress, rpcOptions);
  if (nfts.length === 0) return 0;
  const best = nfts.reduce((a, b) =>
    TIER_ORDER.indexOf(b.tier) < TIER_ORDER.indexOf(a.tier) ? b : a
  );
  let ms = CREATOR_TIME_BONUS_MS[best.tier];
  if (nfts.length >= 2) ms += CREATOR_COLLECTOR_TIME_MS;
  return ms;
}

const DEFAULT_FEE_PERCENT = Number(process.env.NEXT_PUBLIC_SERVICE_FEE_PERCENTAGE || 20);
const DEFAULT_REFERRAL_PERCENT = Number(process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || 10);

/** Effective reclaim fee % for payer wallet (by tier). For use in closers when tier is known server-side or from API. */
export async function getEffectiveReclaimFeePercent(
  payerWalletAddress: string,
  rpcOptions?: CreatorNftsRpcOptions
): Promise<number> {
  const tier = await getBestCreatorTierForWallet(payerWalletAddress, rpcOptions);
  return tier != null ? CREATOR_RECLAIM_FEE_PERCENT[tier] : DEFAULT_FEE_PERCENT;
}

/** Effective referral % for referrer wallet (by tier). For use in closers when tier is known server-side or from API. */
export async function getEffectiveReferralPercent(
  referrerWalletAddress: string,
  rpcOptions?: CreatorNftsRpcOptions
): Promise<number> {
  const tier = await getBestCreatorTierForWallet(referrerWalletAddress, rpcOptions);
  return tier != null ? CREATOR_REFERRAL_PERCENT[tier] : DEFAULT_REFERRAL_PERCENT;
}
