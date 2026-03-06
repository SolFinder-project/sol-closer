/**
 * PumpSwap close_user_volume_accumulator instruction builder.
 *
 * Same instruction name and account layout as Pump.fun (carbon_pump_swap_decoder):
 * Accounts: user, user_volume_accumulator, event_authority, program.
 * Anchor discriminator is identical for "global:close_user_volume_accumulator".
 */

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { PUMP_SWAP_PROGRAM_ID } from './pumpSwap';

/** 8-byte discriminator for close_user_volume_accumulator (same as Pump.fun, Anchor). */
const CLOSE_USER_VOLUME_ACCUMULATOR_DISCRIMINATOR = new Uint8Array([
  249, 69, 164, 218, 150, 103, 84, 138,
]);

/** event_authority PDA (seeds ["__event_authority"] for PumpSwap program). */
function getPumpSwapEventAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority', 'utf8')],
    PUMP_SWAP_PROGRAM_ID
  );
  return pda;
}

export function isPumpSwapCloseAvailable(): boolean {
  return CLOSE_USER_VOLUME_ACCUMULATOR_DISCRIMINATOR.length === 8;
}

/**
 * Build the PumpSwap close_user_volume_accumulator instruction.
 * Accounts: user (signer, writable), user_volume_accumulator (writable), event_authority, program.
 */
export function buildClosePumpSwapPdaInstruction(
  pda: PublicKey,
  user: PublicKey
): TransactionInstruction {
  const eventAuthority = getPumpSwapEventAuthority();

  return new TransactionInstruction({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_SWAP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PUMP_SWAP_PROGRAM_ID,
    data: Buffer.from(CLOSE_USER_VOLUME_ACCUMULATOR_DISCRIMINATOR),
  });
}
