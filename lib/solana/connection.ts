import { Connection, Commitment } from '@solana/web3.js';
import { COMMITMENT } from './constants';

let connectionInstance: Connection | null = null;

export function getRpcUrl(): string {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
  const explicitRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  // Prefer explicit RPC URL when set (e.g. Helius Secure URL): works from any domain, no 401 from allowlist.
  if (explicitRpc) {
    return explicitRpc;
  }
  const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY?.trim();
  if (heliusKey) {
    return network === 'mainnet-beta'
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
      : `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return network === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com';
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

export function resetConnection(): void {
  connectionInstance = null;
}
