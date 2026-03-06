import type { WalletHealthScore } from '@/types/reclaim';

/**
 * Compute wallet health score (0-10) from number of empty token accounts.
 * 0 empty = 10/10; more empty = lower score. Simple rule-based.
 */
export function getWalletHealthFromEmptyCount(emptyCount: number): Pick<WalletHealthScore, 'score' | 'label'> {
  let score: number;
  if (emptyCount === 0) score = 10;
  else if (emptyCount <= 2) score = 9;
  else if (emptyCount <= 5) score = 8;
  else if (emptyCount <= 10) score = 7;
  else if (emptyCount <= 20) score = 6;
  else if (emptyCount <= 40) score = 5;
  else if (emptyCount <= 80) score = 4;
  else if (emptyCount <= 150) score = 3;
  else if (emptyCount <= 300) score = 2;
  else score = 1;

  return { score, label: `${score}/10` };
}

export function formatPercentileLabel(percentile: number): string {
  if (percentile >= 99) return 'Cleaner than 99%+ of users';
  if (percentile >= 90) return `Cleaner than ${percentile}% of users`;
  if (percentile >= 50) return `Cleaner than ${percentile}% of users`;
  if (percentile >= 25) return `Cleaner than ${percentile}% of users`;
  return `You're in the top ${100 - percentile}%`;
}
