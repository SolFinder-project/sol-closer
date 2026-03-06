/**
 * Types for Rugcheck API integration (badges on token accounts).
 */

export type RugcheckBadgeLabel = 'Verified' | 'Caution' | 'Danger' | 'Unknown';

export interface RugcheckSummaryItem {
  label: RugcheckBadgeLabel;
  url: string;
  score?: number;
}

export type RugcheckSummariesByMint = Record<string, RugcheckSummaryItem>;
