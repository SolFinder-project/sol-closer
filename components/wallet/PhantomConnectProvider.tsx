'use client';

import { PhantomProvider, darkTheme, AddressType, type PhantomSDKConfig } from '@phantom/react-sdk';
import { useMemo, type ReactNode } from 'react';
import {
  PHANTOM_CONNECT_APP_ICON_DEFAULT,
  PHANTOM_CONNECT_APP_ID,
  getPhantomConnectRedirectUrl,
} from '@/lib/phantom/connectConfig';

/**
 * Phantom Connect — config aligned with Phantom Portal (Authentification) for SolPit:
 * appId, appIcon, appName, addressTypes, redirectUrl, and providers google + apple + injected.
 *
 * `PhantomInjectedWalletBridge` syncs only **injected** (extension) sessions to
 * `@solana/wallet-adapter` (header, signatures). Google/Apple sessions stay SDK-only, same as
 * Phantom’s own “Connected” UI vs dApp adapter split for non-injected providers.
 *
 * @see https://docs.phantom.com/sdks/react-sdk/connect
 */
export function PhantomConnectProvider({ children }: { children: ReactNode }) {
  const config = useMemo((): PhantomSDKConfig => {
    return {
      appId: PHANTOM_CONNECT_APP_ID,
      providers: ['google', 'apple', 'injected'],
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
