/**
 * Verify on-chain that a Solana transaction is a valid F1 entry payment:
 * System transfer of exactly entryFeeLamports from expectedSourceWallet to the treasury.
 * Ensures the claimed wallet is the actual payer (prevents using someone else's tx to register).
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from './connection';

export interface VerifyF1EntryResult {
  ok: boolean;
  error?: string;
}

interface ParsedTransferInfo {
  source?: string;
  destination?: string;
  lamports?: number;
}

const CONFIRM_RETRIES = 8;
const CONFIRM_RETRY_MS = 1500;

/**
 * Verifies that the transaction is a system transfer of exactly expectedLamports
 * from expectedSourceWallet to treasuryPubkey. Uses getParsedTransaction.
 * Retries when tx not yet confirmed (client often calls API right after sendTransaction).
 * @param expectedSourceWallet - Base58 wallet address that must be the transfer source (payer).
 */
export async function verifyF1EntryTx(
  signature: string,
  expectedLamports: number,
  treasuryPubkey: PublicKey,
  expectedSourceWallet: string,
  connection?: Connection
): Promise<VerifyF1EntryResult> {
  const conn = connection ?? getConnection();
  const treasuryStr = treasuryPubkey.toBase58();
  const sourceNorm = expectedSourceWallet.trim();
  if (!sourceNorm || sourceNorm.length < 32) {
    return { ok: false, error: 'Invalid expected source wallet' };
  }
  try {
    let parsed: Awaited<ReturnType<Connection['getParsedTransaction']>> = null;
    for (let i = 0; i < CONFIRM_RETRIES; i++) {
      parsed = await conn.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (parsed?.meta) break;
      if (i < CONFIRM_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, CONFIRM_RETRY_MS));
      }
    }
    if (!parsed || !parsed.meta) {
      return { ok: false, error: 'Transaction not found or not confirmed' };
    }
    if (parsed.meta.err) {
      return { ok: false, error: 'Transaction failed on-chain' };
    }

    const instructions = parsed.transaction?.message?.instructions ?? [];
    for (const ix of instructions) {
      if ('parsed' in ix && ix.program === 'system') {
        const info = (ix as { parsed: { type: string; info: ParsedTransferInfo } }).parsed?.info;
        if (info?.destination === treasuryStr && info?.lamports !== expectedLamports) {
          return {
            ok: false,
            error: `Wrong amount: expected ${expectedLamports} lamports, got ${info.lamports ?? 0}`,
          };
        }
        if (
          info?.lamports !== undefined &&
          info.destination === treasuryStr &&
          info.lamports === expectedLamports
        ) {
          if (info.source !== sourceNorm) {
            return {
              ok: false,
              error: 'Transaction payer does not match registered wallet',
            };
          }
          return { ok: true };
        }
      }
    }
    return { ok: false, error: 'No system transfer to F1 treasury found in transaction' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Verification failed: ${msg}` };
  }
}
