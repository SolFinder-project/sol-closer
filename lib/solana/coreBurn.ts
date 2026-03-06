/**
 * Metaplex Core (Mpl Core) burn instruction – build the instruction for burning a Core asset
 * and reclaiming rent. Uses official program ID and instruction layout (discriminator 12).
 * @see https://developers.metaplex.com/smart-contracts/core/burn
 */

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { MPL_CORE_PROGRAM_ID } from './constants';

/** BurnV1 discriminator (u8). */
const BURN_V1_DISCRIMINATOR = 12;

/** Option: none = 0 byte (no compression proof). */
const BURN_V1_DATA = new Uint8Array([BURN_V1_DISCRIMINATOR, 0]);

const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

/**
 * Build the Metaplex Core BurnV1 instruction.
 * Accounts (per burnV1): asset, collection (optional), payer, authority, systemProgram, logWrapper.
 * When collection is not provided, Kinobi/UMi use the programId as placeholder for optional accounts.
 */
export function createCoreBurnInstruction(params: {
  asset: PublicKey;
  payer: PublicKey;
  authority: PublicKey;
  collection?: PublicKey | null;
}): TransactionInstruction {
  const { asset, payer, authority, collection } = params;
  const collectionPubkey = collection ?? MPL_CORE_PROGRAM_ID;
  const keys = [
    { pubkey: asset, isSigner: false, isWritable: true },
    { pubkey: collectionPubkey, isSigner: false, isWritable: true },
    { pubkey: payer, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: true, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId: MPL_CORE_PROGRAM_ID,
    data: Buffer.from(BURN_V1_DATA),
  });
}
