/**
 * NFT Creator feature – types.
 * Source of truth: docs/RECAP-INTEGRATION-NFT-CREATOR-SOLCLOSER.md
 */

export type NftCreatorSubmissionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'finalized'
  | 'expired';

export type NftCreatorTier = 'standard' | 'silver' | 'gold' | 'platinum';

export interface NftCreatorSubmission {
  id: string;
  wallet_address: string;
  image_uri: string;
  metadata_uri: string | null;
  name: string;
  description: string;
  attributes: Record<string, unknown> | null;
  status: NftCreatorSubmissionStatus;
  tier: NftCreatorTier | null;
  rejection_reason: string | null;
  approved_at: string | null;
  expires_at: string | null;
  mint_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface NftCreatorTierRow {
  mint_address: string;
  tier: NftCreatorTier;
  created_at: string;
}

/** Per-tier bonus: points per reclaim (added to base points). */
export const CREATOR_POINTS_BONUS: Record<NftCreatorTier, number> = {
  standard: 2,
  silver: 4,
  gold: 8,
  platinum: 14,
};

/** Per-tier race time bonus in ms (subtracted from lap time). 1.5s = 1500ms, 4s = 4000ms, 6s = 6000ms. */
export const CREATOR_TIME_BONUS_MS: Record<NftCreatorTier, number> = {
  standard: 0,
  silver: 1500,
  gold: 4000,
  platinum: 6000,
};

/** Reclaim fee % by tier (paying wallet). Base env = 20. */
export const CREATOR_RECLAIM_FEE_PERCENT: Record<NftCreatorTier, number> = {
  standard: 20,
  silver: 17,
  gold: 14,
  platinum: 10,
};

/** Referral % for the referrer by tier. Base env = 10. */
export const CREATOR_REFERRAL_PERCENT: Record<NftCreatorTier, number> = {
  standard: 10,
  silver: 12,
  gold: 14,
  platinum: 17,
};

/** Collector bonus: extra points per reclaim when holding 2+ Creator NFTs. */
export const CREATOR_COLLECTOR_POINTS = 2;

/** Collector bonus: extra race time deduction in ms when holding 2+ Creator NFTs. */
export const CREATOR_COLLECTOR_TIME_MS = 1000;

/** Minimum net reclaimed (SOL) to unlock "Create NFT". */
export const NFT_CREATOR_MIN_RECLAIM_SOL = 0.02;

/** Default finalization expiry days after approval. */
export const NFT_CREATOR_FINALIZE_DAYS = 7;
