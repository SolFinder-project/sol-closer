/**
 * Build RPC/DAS options from the incoming request so DAS works when the route runs on the server.
 * Uses the app's /api/rpc proxy with Origin/Referer so Helius "Allowed Domains" accept the request.
 *
 * Fallback: when Origin and Referer headers are missing (e.g. strict referrer policy, or SSR),
 * derives the app origin from request.url so the proxy URL is still used and Helius receives
 * an allowlisted domain.
 */

import type { NextRequest } from 'next/server';

export type DasOptions = {
  rpcUrl: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
};

export function dasOptionsFromRequest(request: NextRequest): DasOptions | undefined {
  const origin = request.headers.get('origin')?.trim();
  const referer = request.headers.get('referer')?.trim();
  let baseUrl = origin || (referer ? (() => {
    try {
      return new URL(referer).origin;
    } catch {
      return '';
    }
  })() : '');

  // Fallback: derive app origin from request URL so server-side DAS still uses the proxy (avoids 401).
  if (!baseUrl && request.url) {
    try {
      baseUrl = new URL(request.url).origin;
    } catch {
      // ignore
    }
  }

  if (!baseUrl) return undefined;

  const rpcUrl = `${baseUrl.replace(/\/$/, '')}/api/rpc`;
  const effectiveOrigin = origin || baseUrl;
  const effectiveReferer = referer || `${baseUrl}/`;

  const customFetch: (url: string, init?: RequestInit) => Promise<Response> = (url, init) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string>),
        ...(effectiveOrigin && { Origin: effectiveOrigin }),
        ...(effectiveReferer && { Referer: effectiveReferer }),
      },
    });

  return { rpcUrl, fetch: customFetch };
}
