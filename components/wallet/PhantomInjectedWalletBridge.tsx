'use client';

import { usePhantom, useDisconnect } from '@phantom/react-sdk';
import { PhantomWalletName } from '@solana/wallet-adapter-phantom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useRef } from 'react';

/**
 * Phantom Connect (Browser SDK) and @solana/wallet-adapter maintain separate connection state.
 * When the user completes an **injected** (extension) session via Phantom Connect, we select the
 * Phantom adapter and connect so `useWallet().connected` matches Phantom’s UI.
 *
 * @see https://docs.phantom.com/sdks/react-sdk/connect — Connect / provider configuration
 */
export function PhantomInjectedWalletBridge() {
  const { isConnected: phantomConnected, user, isLoading: phantomLoading } = usePhantom();
  const { disconnect: phantomSdkDisconnect } = useDisconnect();
  const { connected, connecting, connect, select, wallets, wallet } = useWallet();

  const bridgeTriedForSession = useRef<string | null>(null);
  const prevAdapterConnected = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (phantomLoading || !phantomConnected) {
      bridgeTriedForSession.current = null;
      return;
    }
    if (user?.authProvider !== 'injected') return;
    if (connected || connecting) return;

    const sessionKey =
      user.authUserId ??
      user.addresses?.map((a) => a.address).join(',') ??
      'phantom-session';
    if (bridgeTriedForSession.current === sessionKey) return;

    const phantomEntry = wallets.find((w) => w.adapter.name === PhantomWalletName);
    if (!phantomEntry) return;

    bridgeTriedForSession.current = sessionKey;

    (async () => {
      try {
        if (wallet?.adapter.name !== PhantomWalletName) {
          select(PhantomWalletName);
        }
        await connect();
      } catch {
        bridgeTriedForSession.current = null;
        try {
          await phantomSdkDisconnect();
        } catch {
          /* ignore */
        }
      }
    })();
  }, [
    phantomLoading,
    phantomConnected,
    user,
    connected,
    connecting,
    connect,
    select,
    wallets,
    wallet?.adapter.name,
    phantomSdkDisconnect,
  ]);

  useEffect(() => {
    if (prevAdapterConnected.current === undefined) {
      prevAdapterConnected.current = connected;
      return;
    }
    const wasConnected = prevAdapterConnected.current;
    prevAdapterConnected.current = connected;

    if (!wasConnected || connected || connecting) return;
    if (!phantomConnected || user?.authProvider !== 'injected') return;

    bridgeTriedForSession.current = null;
    void phantomSdkDisconnect().catch(() => {});
  }, [
    connected,
    connecting,
    phantomConnected,
    user?.authProvider,
    phantomSdkDisconnect,
  ]);

  return null;
}
