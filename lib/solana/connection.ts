import { Connection, Commitment } from '@solana/web3.js';
import { COMMITMENT } from './constants';

let connectionInstance: Connection | null = null;

const PUBLIC_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const PUBLIC_DEVNET_RPC = 'https://api.devnet.solana.com';

/** Returns true if url is the public Solana RPC (returns 403 from browser in prod). */
function isPublicSolanaRpc(url: string): boolean {
  const n = url.replace(/\/$/, '').toLowerCase();
  return n === PUBLIC_MAINNET_RPC || n === PUBLIC_DEVNET_RPC;
}

export function getRpcUrl(): string {
  // In the browser, use our RPC proxy so the Helius key stays server-side (avoids 401 / Allowed Domains).
  if (typeof window !== 'undefined') {
    const origin = (window as Window).location?.origin;
    if (origin) return `${origin}/api/rpc`;
  }

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
  const explicitRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (explicitRpc && !isPublicSolanaRpc(explicitRpc)) return explicitRpc;

  const heliusKey = process.env.HELIUS_API_KEY?.trim() || process.env.NEXT_PUBLIC_HELIUS_API_KEY?.trim();
  if (heliusKey) {
    return network === 'mainnet-beta'
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
      : `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return network === 'mainnet-beta' ? PUBLIC_MAINNET_RPC : PUBLIC_DEVNET_RPC;
}

export function getConnection(): Connection {
  if (!connectionInstance) {
    const rpcUrl = getRpcUrl();
    connectionInstance = new Connection(rpcUrl, {
      commitment: COMMITMENT as Commitment,
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connectionInstance;
}

/**
 * Use in API routes that are called from the browser. Returns a Connection that uses the app's
 * /api/rpc proxy with the client's Origin/Referer, so Helius "Allowed Domains" accepts the request.
 * Fallback: when Origin/Referer are missing, derives baseUrl from request.url so proxy still works.
 */
export function getConnectionForRequest(request: Request): Connection {
  const origin = request.headers.get('origin')?.trim();
  const referer = request.headers.get('referer')?.trim();
  let baseUrl = origin;
  if (!baseUrl && referer) {
    try {
      baseUrl = new URL(referer).origin;
    } catch {
      // ignore
    }
  }
  if (!baseUrl && request.url) {
    try {
      baseUrl = new URL(request.url).origin;
    } catch {
      // ignore
    }
  }
  if (baseUrl) {
    const rpcUrl = `${baseUrl.replace(/\/$/, '')}/api/rpc`;
    const effectiveOrigin = origin || baseUrl;
    const effectiveReferer = referer || `${baseUrl}/`;
    const httpHeaders: Record<string, string> = {
      ...(effectiveOrigin && { Origin: effectiveOrigin }),
      ...(effectiveReferer && { Referer: effectiveReferer }),
    };
    return new Connection(rpcUrl, {
      commitment: COMMITMENT as Commitment,
      confirmTransactionInitialTimeout: 60000,
      httpHeaders,
    });
  }
  return getConnection();
}

export function resetConnection(): void {
  connectionInstance = null;
}
