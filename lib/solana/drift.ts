/**
 * Drift Protocol user account reclaim.
 * Close Drift user account(s) to reclaim ~0.035 SOL rent per account.
 * Docs: https://docs.drift.trade/getting-started/withdraw-and-close-account
 * Program ID: dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH (mainnet/devnet).
 * PDA seeds: ["user", authority, subAccountId (2 bytes LE)].
 */

import { PublicKey } from '@solana/web3.js';
import { getConnection } from './connection';

export const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');

/** ~0.035 SOL rent per Drift user account (approximate; actual from chain). */
export const DRIFT_USER_ACCOUNT_RENT_LAMPORTS_EST = 35_000_000;

export type DriftUserAccount = {
  pubkey: PublicKey;
  lamports: number;
  subAccountId: number;
};

/**
 * Derive Drift user account PDA (seeds: "user", authority, subAccountId 2-byte LE).
 */
export function getDriftUserAccountPda(authority: PublicKey, subAccountId = 0): PublicKey {
  const subBuf = Buffer.alloc(2);
  subBuf.writeUInt16LE(subAccountId, 0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user', 'utf8'), authority.toBuffer(), subBuf],
    DRIFT_PROGRAM_ID
  );
  return pda;
}

/**
 * Scan for Drift user accounts. Checks subAccountId 0 then 1 (most users have 0 or 1).
 * Returns accounts that exist and are owned by the Drift program.
 */
export async function scanDriftUserAccounts(wallet: PublicKey): Promise<DriftUserAccount[]> {
  const connection = getConnection();
  const results: DriftUserAccount[] = [];

  for (const subAccountId of [0, 1]) {
    const pda = getDriftUserAccountPda(wallet, subAccountId);
    const info = await connection.getAccountInfo(pda, 'confirmed');
    if (info && info.owner.equals(DRIFT_PROGRAM_ID) && info.lamports > 0) {
      results.push({ pubkey: pda, lamports: info.lamports, subAccountId });
    }
  }

  return results;
}

/** Total reclaimable SOL from Drift user accounts. */
export function driftReclaimableSol(accounts: DriftUserAccount[]): number {
  return accounts.reduce((sum, a) => sum + a.lamports, 0) / 1e9;
}
