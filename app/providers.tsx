'use client';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { useEffect, useMemo } from 'react';

const PUBLIC_MAINNET = 'https://api.mainnet-beta.solana.com';
const PUBLIC_DEVNET = 'https://api.devnet.solana.com';
function isPublicRpc(url: string): boolean {
  const n = url.replace(/\/$/, '').toLowerCase();
  return n === PUBLIC_MAINNET || n === PUBLIC_DEVNET;
}

function getRpcEndpoint(): string {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
  const explicitRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (explicitRpc && !isPublicRpc(explicitRpc)) return explicitRpc;
  const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY?.trim();
  if (heliusKey) {
    return network === 'mainnet-beta'
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
      : `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return network === 'mainnet-beta' ? PUBLIC_MAINNET : PUBLIC_DEVNET;
}

/** En dev, supprime le spam des erreurs WebSocket Helius (ws error / Close received after close). */
function useSuppressHeliusWsSpam() {
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return;
    const raw = console.error;
    console.error = (...args: unknown[]) => {
      const msg = String(args?.[0] ?? '');
      if (
        msg.includes('ws error') ||
        (msg.includes('WebSocket connection') && msg.includes('failed')) ||
        msg.includes('Close received after close')
      ) return;
      raw.apply(console, args);
    };
    return () => { console.error = raw; };
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useSuppressHeliusWsSpam();
  const endpoint = useMemo(() => getRpcEndpoint(), []);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
