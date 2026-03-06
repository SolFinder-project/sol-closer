/**
 * Pump.fun user fee / volume PDA reclaim.
 *
 * Source: official IDL https://github.com/pump-fun/pump-public-docs (idl/pump.json).
 * The reclaimable account is user_volume_accumulator (seeds: ["user_volume_accumulator", user]).
 * Instruction: close_user_volume_accumulator. Program: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P.
 * PumpSwap (pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA) is a separate program; support can be added later.
 */

import { PublicKey } from '@solana/web3.js';
import { getConnection } from './connection';

/** Pump.fun program ID (bonding curve). */
export const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

/** Rent per user_volume_accumulator (lamports). Source: Alphecca / IDL. */
export const PUMP_PDA_RENT_LAMPORTS = 1_844_400;

/** Rent per PDA in SOL. */
export const PUMP_PDA_RENT_SOL = PUMP_PDA_RENT_LAMPORTS / 1e9;

export type PumpPdaAccount = {
  pubkey: PublicKey;
  lamports: number;
};

/** Seed for user_volume_accumulator PDA (from pump IDL). */
const USER_VOLUME_ACCUMULATOR_SEED = 'user_volume_accumulator';

/**
 * Derive the Pump.fun user_volume_accumulator PDA (IDL: seeds ["user_volume_accumulator", user]).
 * Single getAccountInfo — no mass scan.
 */
export function getPumpUserVolumeAccumulatorPda(wallet: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(USER_VOLUME_ACCUMULATOR_SEED, 'utf8'), wallet.toBuffer()],
    PUMP_PROGRAM_ID
  );
  return pda;
}

/**
 * Scan for Pump.fun user_volume_accumulator PDA (IDL-based).
 * One getAccountInfo on the derived PDA — fast whether a PDA exists or not. No fallback scan.
 */
export async function scanPumpPdas(wallet: PublicKey): Promise<PumpPdaAccount[]> {
  const connection = getConnection();
  const results: PumpPdaAccount[] = [];

  const pda = getPumpUserVolumeAccumulatorPda(wallet);
  const info = await connection.getAccountInfo(pda, 'confirmed');
  if (info && info.owner.equals(PUMP_PROGRAM_ID) && info.lamports >= PUMP_PDA_RENT_LAMPORTS) {
    results.push({ pubkey: pda, lamports: info.lamports });
  }

  return results;
}

/** Total reclaimable SOL from Pump PDAs (up to 2 × 0.0018444). */
export function pumpReclaimableSol(pdas: PumpPdaAccount[]): number {
  return pdas.reduce((sum, p) => sum + p.lamports, 0) / 1e9;
}
