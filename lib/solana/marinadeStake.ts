/**
 * Marinade liquid staking helpers.
 * Deposit transaction is built server-side via POST /api/marinade/deposit to avoid
 * pulling @marinade.finance/marinade-ts-sdk (and @coral-xyz/anchor with Node "fs") into the client bundle.
 * See docs/STAKING-INTEGRATION-ANALYSIS.md.
 */

const RESERVE_SOL_FOR_FEES = 0.005 * 1e9; // lamports

/**
 * Max SOL (lamports) that can be staked from wallet balance, leaving reserve for fees.
 */
export function getMaxStakeLamports(walletBalanceLamports: number): number {
  return Math.max(0, Math.floor(walletBalanceLamports - RESERVE_SOL_FOR_FEES));
}
