'use client';

import { PhantomProvider, darkTheme, AddressType, type PhantomSDKConfig } from '@phantom/react-sdk';
import { useMemo, type ReactNode } from 'react';
import {
  PHANTOM_CONNECT_APP_ICON_DEFAULT,
  PHANTOM_CONNECT_APP_ID,
  getPhantomConnectRedirectUrl,
} from '@/lib/phantom/connectConfig';

/**
 * Phantom Connect (portal SDK) — required for Phantom app directory review.
 * Wraps the app alongside @solana/wallet-adapter; does not replace adapter-based Phantom / Solflare.
 *
 * We enable **injected** only so the session maps to the browser extension — the same path
 * `@solana/wallet-adapter` uses. OAuth-only sessions (google/apple) do not drive the adapter,
 * which caused “connected” in Phantom’s modal while the app still showed “Connect”.
 *
 * @see https://docs.phantom.com/sdks/react-sdk/connect — `injected` vs OAuth providers
 */
export function PhantomConnectProvider({ children }: { children: ReactNode }) {
  const config = useMemo((): PhantomSDKConfig => {
    return {
      appId: PHANTOM_CONNECT_APP_ID,
      providers: ['injected'],
      addressTypes: [AddressType.solana],
      authOptions: {
        redirectUrl: getPhantomConnectRedirectUrl(),
      },
    };
  }, []);

  return (
    <PhantomProvider
      config={config}
      theme={darkTheme}
      appName="SolPit"
      appIcon={PHANTOM_CONNECT_APP_ICON_DEFAULT}
    >
      {children}
    </PhantomProvider>
  );
}
