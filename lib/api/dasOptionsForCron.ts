/**
 * RPC/DAS options for server-only jobs (Vercel Cron) that call Helius via the app `/api/rpc` proxy
 * with Origin/Referer so Allowed Domains accepts the request — same idea as dasOptionsFromRequest
 * but without an incoming browser Request.
 *
 * Requires one of: NEXT_PUBLIC_SITE_URL (e.g. https://solpit.app) or VERCEL_URL (set by Vercel).
 */
/** Same shape as GameRpcOptions in lib/supabase/game.ts (avoid importing game from this module). */
export type CronDasRpcOptions = {
  rpcUrl?: string;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

function resolveAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
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
export function getDasOptionsForCron(): CronDasRpcOptions | undefined {
  const normalized = resolveAppOrigin();
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
