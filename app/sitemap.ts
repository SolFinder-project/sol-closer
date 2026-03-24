import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const legalPaths = [
    '/legal/en/terms',
    '/legal/en/privacy',
    '/legal/en/risks',
    '/legal/fr/terms',
    '/legal/fr/privacy',
    '/legal/fr/mentions',
    '/legal/fr/risks',
  ];

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...legalPaths.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
  ];
}
