'use client';

import type { ConnectResult } from '@phantom/browser-sdk';
import { usePhantom, useDisconnect, AddressType } from '@phantom/react-sdk';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { PhantomWalletName } from '@solana/wallet-adapter-phantom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useRef } from 'react';

/**
 * Phantom Connect (Browser SDK) and @solana/wallet-adapter keep separate connection state.
 * Official docs: https://docs.phantom.com/sdks/react-sdk/connect
 *
 * Important: the Browser SDK’s `connect` event payload does **not** include `authProvider`
 * (see emitted object in @phantom/browser-sdk injected provider — only addresses, source,
 * authUserId, walletId). PhantomProvider therefore sets `user` without `authProvider` for
 * extension flows. We must not require `user.authProvider === "injected"` or the bridge
 * never runs.
 *
 * We only skip bridging for explicit **embedded** OAuth / app-wallet sessions (google, apple,
 * phantom, device) which do not map to the injected extension that wallet-adapter uses.
 */
function isEmbeddedOnlyPhantomSession(user: ConnectResult | null): boolean {
  const p = user?.authProvider;
  return p === 'google' || p === 'apple' || p === 'phantom' || p === 'device';
}

function hasSolanaAddress(user: ConnectResult | null): boolean {
  return Boolean(user?.addresses?.some((a) => a.addressType === AddressType.solana));
}

export function PhantomInjectedWalletBridge() {
  const { isConnected: phantomConnected, user, isLoading: phantomLoading } = usePhantom();
  const { disconnect: phantomSdkDisconnect } = useDisconnect();
  const { connected, connecting, connect, select, wallets, wallet } = useWallet();

  const bridgeTriedForSession = useRef<string | null>(null);
  const prevAdapterConnected = useRef<boolean | undefined>(undefined);

  const shouldSyncAdapter =
    phantomConnected &&
    !phantomLoading &&
    !isEmbeddedOnlyPhantomSession(user) &&
    hasSolanaAddress(user);

  const sessionKey =
    user?.authUserId ??
    user?.addresses?.map((a) => a.address).join(',') ??
    null;

  // Phase 1: wallet-adapter’s `connect()` uses the selected wallet from the last render;
  // calling `select` and `connect` in the same tick can connect the wrong adapter.
  useEffect(() => {
    if (!shouldSyncAdapter || connected || connecting) return;
    if (wallet?.adapter.name === PhantomWalletName) return;
    const phantomEntry = wallets.find((w) => w.adapter.name === PhantomWalletName);
    if (!phantomEntry) return;
    select(PhantomWalletName);
  }, [shouldSyncAdapter, connected, connecting, wallet?.adapter.name, wallets, select]);

  useEffect(() => {
    if (!shouldSyncAdapter || connected || connecting) return;
    if (wallet?.adapter.name !== PhantomWalletName) return;
    const ready =
      wallet.readyState === WalletReadyState.Installed ||
      wallet.readyState === WalletReadyState.Loadable;
    if (!ready) return;
    if (!sessionKey) return;
    if (bridgeTriedForSession.current === sessionKey) return;

    bridgeTriedForSession.current = sessionKey;

    void (async () => {
      try {
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
    shouldSyncAdapter,
    connected,
    connecting,
    connect,
    wallet,
    sessionKey,
    phantomSdkDisconnect,
  ]);

  useEffect(() => {
    if (!phantomLoading && !phantomConnected) {
      bridgeTriedForSession.current = null;
    }
  }, [phantomLoading, phantomConnected]);

  useEffect(() => {
    if (prevAdapterConnected.current === undefined) {
      prevAdapterConnected.current = connected;
      return;
    }
    const wasConnected = prevAdapterConnected.current;
    prevAdapterConnected.current = connected;

    if (!wasConnected || connected || connecting) return;
    if (!phantomConnected || isEmbeddedOnlyPhantomSession(user)) return;

    bridgeTriedForSession.current = null;
    void phantomSdkDisconnect().catch(() => {});
  }, [
    connected,
    connecting,
    phantomConnected,
    user,
    phantomSdkDisconnect,
  ]);

  return null;
}
