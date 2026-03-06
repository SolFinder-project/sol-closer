/**
 * Pump.fun close_user_volume_accumulator instruction builder.
 *
 * Source: official IDL https://github.com/pump-fun/pump-public-docs (idl/pump.json).
 * Instruction: close_user_volume_accumulator. Accounts: user, user_volume_accumulator, event_authority, program.
 */

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { PUMP_PROGRAM_ID } from './pump';

/** 8-byte discriminator for close_user_volume_accumulator (from pump IDL). */
const CLOSE_USER_VOLUME_ACCUMULATOR_DISCRIMINATOR = new Uint8Array([
  249, 69, 164, 218, 150, 103, 84, 138,
]);

/** event_authority PDA (IDL: seeds ["__event_authority"]). */
function getPumpEventAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority', 'utf8')],
    PUMP_PROGRAM_ID
  );
  return pda;
}

export const PUMP_CLOSE_DISCRIMINATOR = CLOSE_USER_VOLUME_ACCUMULATOR_DISCRIMINATOR;

export function isPumpCloseAvailable(): boolean {
  return PUMP_CLOSE_DISCRIMINATOR != null && PUMP_CLOSE_DISCRIMINATOR.length === 8;
}

/**
 * Build the Pump close_user_volume_accumulator instruction (IDL).
 * Accounts: user (signer, writable), user_volume_accumulator (writable), event_authority, program.
 */
export function buildClosePumpPdaInstruction(
  pda: PublicKey,
  user: PublicKey
): TransactionInstruction {
  const eventAuthority = getPumpEventAuthority();

  return new TransactionInstruction({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PUMP_PROGRAM_ID,
    data: Buffer.from(CLOSE_USER_VOLUME_ACCUMULATOR_DISCRIMINATOR),
  });
}
