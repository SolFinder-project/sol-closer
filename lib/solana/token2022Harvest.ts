/**
 * Token-2022: HarvestWithheldTokensToMint is only valid for mints with the Transfer Fee extension.
 * Calling it for other Token-2022 mints yields InvalidAccountData. This module filters mints by extension.
 */

import { PublicKey } from '@solana/web3.js';
import {
  getMint,
  getTransferFeeConfig,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';

/** Only mints with Transfer Fee extension support HarvestWithheldTokensToMint; others yield InvalidAccountData. */
export async function filterToken2022MintsWithTransferFee(
  connection: import('@solana/web3.js').Connection,
  token2022ByMint: Map<string, { mint: PublicKey; sources: PublicKey[] }>
): Promise<Map<string, { mint: PublicKey; sources: PublicKey[] }>> {
  const result = new Map<string, { mint: PublicKey; sources: PublicKey[] }>();
  for (const [key, { mint, sources }] of token2022ByMint) {
    try {
      const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      if (getTransferFeeConfig(mintInfo) != null) result.set(key, { mint, sources });
    } catch {
      // Mint missing or not Token-2022 with extension: skip harvest (close may still work or fail 0x23).
    }
  }
  return result;
}
