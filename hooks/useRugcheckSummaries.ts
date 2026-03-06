'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RugcheckSummariesByMint } from '@/types/rugcheck';

/**
 * Fetches Rugcheck badge summaries for a list of mints (bulk).
 * Returns a map mint -> { label, url } and loading state.
 */
export function useRugcheckSummaries(mints: string[]) {
  const [summaries, setSummaries] = useState<RugcheckSummariesByMint>({});
  const [loading, setLoading] = useState(false);

  const fetchSummaries = useCallback(async (mintList: string[]) => {
    const unique = [...new Set(mintList)].filter(Boolean);
    if (unique.length === 0) {
      setSummaries({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/rugcheck/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mints: unique }),
      });
      const data = await res.json();
      setSummaries(data.summaries ?? {});
    } catch {
      setSummaries({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mints.length === 0) {
      setSummaries({});
      return;
    }
    fetchSummaries(mints);
  }, [mints.join(','), fetchSummaries]);

  return { summaries, loading };
}
