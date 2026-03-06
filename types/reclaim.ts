/**
 * Shared types for reclaim features (estimation, wallet health, etc.).
 * Additive only – does not change existing TokenAccount / CloseAccountResult.
 */

export interface ReclaimEstimate {
  emptyCount: number;
  dustCount: number;
  /** NFTs (balance 1, decimals 0) burnable for token account rent. */
  nftBurnCount: number;
  /** 0 or 1 (Pump.fun user_volume_accumulator per wallet). */
  pumpPdaCount: number;
  /** 0 or 1 (PumpSwap user_volume_accumulator per wallet). */
  pumpSwapPdaCount: number;
  /** Compressed NFTs (burn = wallet cleanup, 0 SOL recovered). */
  cnftCount: number;
  estimatedLamports: number;
  estimatedSol: number;
}

export interface WalletHealthScore {
  /** 0-10 scale, 10 = no empty accounts */
  score: number;
  /** e.g. "8/10" */
  label: string;
  /** "Cleaner than X% of users" (percentile of total_sol_reclaimed) */
  percentileLabel?: string;
  /** Raw percentile 0-100 if available */
  percentile?: number;
}
