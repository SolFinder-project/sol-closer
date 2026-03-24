/**
 * Canonical site URL for metadata, OG tags, sitemap, and robots.
 * Priority: explicit env → Vercel deployment URL → production default.
 */
export function getSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://www.sol-pit.com';
}
