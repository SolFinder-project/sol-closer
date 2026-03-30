'use client';

import type { ConnectResult, WalletAddress } from '@phantom/browser-sdk';
import { usePhantom, useDisconnect, AddressType } from '@phantom/react-sdk';
import type { Adapter } from '@solana/wallet-adapter-base';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { PhantomWalletName } from '@solana/wallet-adapter-phantom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useMemo, useRef } from 'react';

const DEBUG_BRIDGE = process.env.NEXT_PUBLIC_DEBUG_PHANTOM_BRIDGE === '1';

function bridgeLog(...args: unknown[]) {
  if (DEBUG_BRIDGE) console.log('[phantom-wallet-bridge]', ...args);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Phantom Connect (Browser SDK) and @solana/wallet-adapter keep separate connection state.
 * Official docs: https://docs.phantom.com/sdks/react-sdk/connect
 *
 * Phantom is usually exposed via Wallet Standard (`StandardWalletAdapter`). After Phantom
 * Connect completes, the extension can lag behind; `WalletProvider` also runs `connect()`
 * immediately after `select()`, which can fail or no-op before the injected wallet is ready.
 * We defer and retry with `autoConnect()` (silent StandardConnect) when available.
 */
function isEmbeddedOnlyPhantomSession(user: ConnectResult | null): boolean {
  const p = user?.authProvider;
  return p === 'google' || p === 'apple' || p === 'phantom' || p === 'device';
}

/** Solana base58 pubkey length is typically 32–44 chars. */
function looksLikeSolanaAddress(s: string): boolean {
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

function hasSolanaInAddresses(list: WalletAddress[] | null | undefined): boolean {
  if (!list?.length) return false;
  for (const a of list) {
    if (a.addressType === AddressType.solana) return true;
    const t = String(a.addressType ?? '').toLowerCase();
    if (t.includes('solana')) return true;
    if (looksLikeSolanaAddress(a.address)) return true;
  }
  return false;
}

async function syncPhantomAdapter(adapter: Adapter): Promise<void> {
  const std = 'standard' in adapter && adapter.standard === true;
  if (std && typeof adapter.autoConnect === 'function') {
    bridgeLog('adapter.autoConnect() (silent StandardConnect)');
    await adapter.autoConnect();
  }
  bridgeLog('adapter.connect()');
  await adapter.connect();
}

export function PhantomInjectedWalletBridge() {
  const { isConnected: phantomConnected, user, addresses: phantomAddresses } = usePhantom();
  const { disconnect: phantomSdkDisconnect } = useDisconnect();
  const { connected, connecting, select, wallets, wallet } = useWallet();

  const bridgeTriedForSession = useRef<string | null>(null);
  const prevAdapterConnected = useRef<boolean | undefined>(undefined);

  const connectedRef = useRef(connected);
  const connectingRef = useRef(connecting);
  const walletRef = useRef(wallet);
  connectedRef.current = connected;
  connectingRef.current = connecting;
  walletRef.current = wallet;

  const effectiveAddresses = useMemo((): WalletAddress[] | null | undefined => {
    if (phantomAddresses?.length) return phantomAddresses;
    return user?.addresses;
  }, [phantomAddresses, user?.addresses]);

  const shouldSyncAdapter =
    phantomConnected &&
    !isEmbeddedOnlyPhantomSession(user) &&
    hasSolanaInAddresses(effectiveAddresses);

  const sessionKey =
    user?.authUserId ??
    effectiveAddresses?.map((a) => a.address).join(',') ??
    null;

  useEffect(() => {
    if (!DEBUG_BRIDGE) return;
    bridgeLog('tick', {
      shouldSyncAdapter,
      phantomConnected,
      sessionKey: sessionKey?.slice(0, 24),
      adapterName: wallet?.adapter.name,
      readyState: wallet?.readyState,
      connected,
      connecting,
    });
  }, [
    shouldSyncAdapter,
    phantomConnected,
    sessionKey,
    wallet?.adapter.name,
    wallet?.readyState,
    connected,
    connecting,
  ]);

  // Phase 1: select Phantom in the adapter (WalletModal only calls select, not connect).
  useEffect(() => {
    if (!shouldSyncAdapter || connected || connecting) return;
    if (wallet?.adapter.name === PhantomWalletName) return;
    const phantomEntry = wallets.find((w) => w.adapter.name === PhantomWalletName);
    if (!phantomEntry) return;
    select(PhantomWalletName);
  }, [shouldSyncAdapter, connected, connecting, wallet?.adapter.name, wallets, select]);

  // Phase 2: after the provider’s first connect attempt, give the extension time to match the
  // Phantom Connect session, then autoConnect (silent) + connect if still disconnected.
  useEffect(() => {
    if (!shouldSyncAdapter || connected) return;
    if (wallet?.adapter.name !== PhantomWalletName) return;
    const ready =
      wallet.readyState === WalletReadyState.Installed ||
      wallet.readyState === WalletReadyState.Loadable;
    if (!ready || !sessionKey) return;
    if (bridgeTriedForSession.current === sessionKey) return;

    bridgeTriedForSession.current = sessionKey;
    let cancelled = false;
    const keyForThisRun = sessionKey;

    void (async () => {
      try {
        await sleep(320);
        if (cancelled) return;

        for (let i = 0; i < 100; i++) {
          if (cancelled) return;
          if (connectedRef.current) return;
          if (!connectingRef.current) break;
          await sleep(80);
        }
        if (cancelled || connectedRef.current) return;

        const w = walletRef.current;
        if (!w || w.adapter.name !== PhantomWalletName) return;

        await syncPhantomAdapter(w.adapter);
      } catch (e) {
        bridgeLog('sync failed', e);
        if (bridgeTriedForSession.current === keyForThisRun) {
          bridgeTriedForSession.current = null;
        }
        try {
          await phantomSdkDisconnect();
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
      if (bridgeTriedForSession.current === keyForThisRun) {
        bridgeTriedForSession.current = null;
      }
    };
  }, [
    shouldSyncAdapter,
    connected,
    sessionKey,
    phantomSdkDisconnect,
    wallet?.adapter?.name,
    wallet?.readyState,
  ]);

  useEffect(() => {
    if (!phantomConnected) {
      bridgeTriedForSession.current = null;
    }
  }, [phantomConnected]);

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
  }, [connected, connecting, phantomConnected, user, phantomSdkDisconnect]);

  return null;
}
