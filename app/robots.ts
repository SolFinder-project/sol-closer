import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
