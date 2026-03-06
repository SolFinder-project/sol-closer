import type { Connection } from '@solana/web3.js';

const DEFAULT_MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Sends a signed transaction and confirms it with retries.
 * Improves reliability when RPC is slow or temporarily unavailable.
 */
export async function sendAndConfirmWithRetry(
  connection: Connection,
  signedSerialized: Buffer | Uint8Array,
  options?: { maxRetries?: number }
): Promise<string> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const signature = await connection.sendRawTransaction(
        Buffer.isBuffer(signedSerialized) ? signedSerialized : Buffer.from(signedSerialized)
      );
      await connection.confirmTransaction(signature, 'confirmed');
      return signature;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delayMs = INITIAL_DELAY_MS * attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
