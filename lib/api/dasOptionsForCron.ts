/**
 * RPC/DAS options for server-only jobs (Vercel Cron) that call Helius via the app `/api/rpc` proxy
 * with Origin/Referer so Allowed Domains accepts the request.
 *
 * Prefer the current request origin when available (same deployment host), then fallback to env.
 *
 * Requires one of: NEXT_PUBLIC_APP_URL (preferred, same as rest of app), NEXT_PUBLIC_SITE_URL (legacy),
 * or VERCEL_URL (set by Vercel).
 */
/** Same shape as GameRpcOptions in lib/supabase/game.ts (avoid importing game from this module). */
export type CronDasRpcOptions = {
  rpcUrl?: string;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

function resolveAppOrigin(request?: Request): string {
  if (request?.url) {
    try {
      const fromRequest = new URL(request.url).origin;
      if (fromRequest) return normalizeOrigin(fromRequest);
    } catch {
      // ignore and fallback to env
    }
  }

  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalizeOrigin(explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}`;
  }
  return '';
}

/**
 * Returns proxy + headers for DAS/Creator NFT resolution during cron, or undefined if no base URL is configured.
 */
export function getDasOptionsForCron(request?: Request): CronDasRpcOptions | undefined {
  const normalized = resolveAppOrigin(request);
  if (!normalized) return undefined;

  const rpcUrl = `${normalized}/api/rpc`;
  const origin = normalized;
  const referer = `${normalized}/`;

  const customFetch: NonNullable<CronDasRpcOptions['fetch']> = (url, init) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        Origin: origin,
        Referer: referer,
      },
    });

  return { rpcUrl, fetch: customFetch };
}
