'use client';

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getReclaimEstimate } from '@/lib/solana/scanner';
import type { ReclaimEstimate } from '@/types/reclaim';

export function useReclaimEstimate(publicKey: PublicKey | null) {
  const [estimate, setEstimate] = useState<ReclaimEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setEstimate(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getReclaimEstimate(publicKey);
      setEstimate(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate');
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) {
      setEstimate(null);
      setError(null);
      return;
    }
    refresh();
  }, [publicKey, refresh]);

  return { estimate, loading, error, refresh };
}
