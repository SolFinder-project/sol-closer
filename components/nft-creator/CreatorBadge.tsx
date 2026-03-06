'use client';

import { useEffect, useState } from 'react';

interface CreatorBadgeProps {
  wallet: string | null;
  className?: string;
}

/**
 * Displays a "Creator" badge when the wallet holds at least one SolPit Creator NFT.
 */
export default function CreatorBadge({ wallet, className = '' }: CreatorBadgeProps) {
  const [hasCreator, setHasCreator] = useState(false);

  useEffect(() => {
    if (!wallet || wallet.length < 32) {
      setHasCreator(false);
      return;
    }
    fetch(`/api/nft-creator/badge?wallet=${encodeURIComponent(wallet)}`)
      .then((res) => res.ok ? res.json() : { hasCreator: false })
      .then((data) => setHasCreator(data?.hasCreator === true))
      .catch(() => setHasCreator(false));
  }, [wallet]);

  if (!hasCreator) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/40 ${className}`}
      title="Holds a SolPit Creator NFT"
    >
      Creator
    </span>
  );
}
