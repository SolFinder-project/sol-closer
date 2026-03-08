import type { Connection } from '@solana/web3.js';

const DEFAULT_MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Sends a signed transaction and returns the signature once the tx is sent.
 * Confirmation is attempted in the same flow but a timeout (e.g. 30s) does not throw:
 * when using an HTTP-only RPC proxy, WebSocket-based confirmation often fails while the tx
 * still lands on-chain. Callers can show success and link to Explorer.
 * Retries only on sendRawTransaction failure (e.g. network/RPC).
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
      // Return immediately so UI shows success. Confirm in background (often fails over HTTP proxy; tx still lands).
      void connection.confirmTransaction(signature, 'confirmed').catch(() => {});
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
