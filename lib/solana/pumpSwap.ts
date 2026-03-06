/**
 * PumpSwap user_volume_accumulator PDA reclaim.
 *
 * Program: pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA (PumpSwap AMM).
 * Same instruction and seeds as Pump.fun: user_volume_accumulator (seeds: ["user_volume_accumulator", user]).
 * Source: carbon_pump_swap_decoder (close_user_volume_accumulator), Alphecca docs.
 */

import { PublicKey } from '@solana/web3.js';
import { getConnection } from './connection';

/** PumpSwap program ID (AMM, mainnet). */
export const PUMP_SWAP_PROGRAM_ID = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');

/** Rent per user_volume_accumulator (lamports). Source: Alphecca. */
export const PUMP_SWAP_PDA_RENT_LAMPORTS = 1_844_400;

/** Rent per PDA in SOL. */
export const PUMP_SWAP_PDA_RENT_SOL = PUMP_SWAP_PDA_RENT_LAMPORTS / 1e9;

export type PumpSwapPdaAccount = {
  pubkey: PublicKey;
  lamports: number;
};

const USER_VOLUME_ACCUMULATOR_SEED = 'user_volume_accumulator';

/**
 * Derive the PumpSwap user_volume_accumulator PDA (seeds ["user_volume_accumulator", user]).
 */
export function getPumpSwapUserVolumeAccumulatorPda(wallet: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(USER_VOLUME_ACCUMULATOR_SEED, 'utf8'), wallet.toBuffer()],
    PUMP_SWAP_PROGRAM_ID
  );
  return pda;
}

/**
 * Scan for PumpSwap user_volume_accumulator PDA. One getAccountInfo per wallet.
 */
export async function scanPumpSwapPdas(wallet: PublicKey): Promise<PumpSwapPdaAccount[]> {
  const connection = getConnection();
  const results: PumpSwapPdaAccount[] = [];

  const pda = getPumpSwapUserVolumeAccumulatorPda(wallet);
  const info = await connection.getAccountInfo(pda, 'confirmed');
  if (info && info.owner.equals(PUMP_SWAP_PROGRAM_ID) && info.lamports >= PUMP_SWAP_PDA_RENT_LAMPORTS) {
    results.push({ pubkey: pda, lamports: info.lamports });
  }

  return results;
}

/** Total reclaimable SOL from PumpSwap PDAs (0 or 1 per wallet, ~0.0018444 SOL). */
export function pumpSwapReclaimableSol(pdas: PumpSwapPdaAccount[]): number {
  return pdas.reduce((sum, p) => sum + p.lamports, 0) / 1e9;
}
