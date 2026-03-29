import { getSiteUrl } from '@/lib/seo/siteUrl';

/** Phantom Portal → SolPit app (prod). Override with NEXT_PUBLIC_PHANTOM_APP_ID if needed. */
export const PHANTOM_CONNECT_APP_ID =
  process.env.NEXT_PUBLIC_PHANTOM_APP_ID?.trim() || 'f415d08c-cc7a-419d-8f83-048ce820203b';

/** Icon URL from Phantom Portal upload; override with NEXT_PUBLIC_PHANTOM_APP_ICON. */
export const PHANTOM_CONNECT_APP_ICON_DEFAULT =
  process.env.NEXT_PUBLIC_PHANTOM_APP_ICON?.trim() ||
  'https://phantom-portal20240925173430423400000001.s3.ca-central-1.amazonaws.com/icons/aa1cfe8e-4f2f-4dbe-b460-f73963305d0f.png';

/**
 * Must match an entry under "URL de redirection" in Phantom Portal.
 * Prefer NEXT_PUBLIC_PHANTOM_REDIRECT_URL in prod; else same origin as getSiteUrl().
 */
export function getPhantomConnectRedirectUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_PHANTOM_REDIRECT_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return getSiteUrl();
}
