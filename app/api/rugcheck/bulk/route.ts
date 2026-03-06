import { NextRequest, NextResponse } from 'next/server';
import type { RugcheckBadgeLabel, RugcheckSummariesByMint } from '@/types/rugcheck';

const RUGCHECK_BASE = 'https://api.rugcheck.xyz';
const RUGCHECK_URL_TOKEN = 'https://rugcheck.xyz/tokens';

/**
 * Map Rugcheck report to a simple badge label.
 * risks[].level can be "danger" | "warning" | etc.; score lower = riskier.
 */
function toBadgeLabel(score: number | undefined, risks: { level?: string }[] | undefined): RugcheckBadgeLabel {
  const hasDanger = risks?.some((r) => r.level === 'danger');
  const hasWarning = risks?.some((r) => r.level === 'warning');
  if (hasDanger) return 'Danger';
  if (hasWarning) return 'Caution';
  if (typeof score === 'number') {
    if (score >= 70) return 'Verified';
    if (score >= 40) return 'Caution';
    return 'Danger';
  }
  return 'Verified';
}

/**
 * POST /api/rugcheck/bulk
 * Body: { mints: string[] }
 * Returns: { summaries: Record<mint, { label, url, score? }> }
 * If RUGCHECK_API_KEY is not set, returns empty object (all mints will show Unknown in UI).
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.RUGCHECK_API_KEY;
  const result: RugcheckSummariesByMint = {};

  let body: { mints?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const mints = Array.isArray(body.mints) ? body.mints : [];
  if (mints.length === 0) {
    return NextResponse.json({ summaries: result });
  }

  // Dedupe and limit to avoid rate limits
  const unique = [...new Set(mints)].slice(0, 50);

  if (!apiKey) {
    unique.forEach((mint) => {
      result[mint] = { label: 'Unknown', url: `${RUGCHECK_URL_TOKEN}/${mint}` };
    });
    return NextResponse.json({ summaries: result });
  }

  try {
    const res = await fetch(`${RUGCHECK_BASE}/v1/bulk/tokens/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ tokens: unique }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Rugcheck bulk error:', res.status, err);
      unique.forEach((mint) => {
        result[mint] = { label: 'Unknown', url: `${RUGCHECK_URL_TOKEN}/${mint}` };
      });
      return NextResponse.json({ summaries: result });
    }

    const data = (await res.json()) as { reports?: Array<{ mint?: string; score?: number; score_normalised?: number; risks?: Array<{ level?: string }> }> };
    const reports = data.reports ?? [];

    unique.forEach((mint, i) => {
      const report = reports[i] ?? reports.find((r) => r.mint === mint);
      const score = report?.score_normalised ?? report?.score;
      const label = toBadgeLabel(score, report?.risks);
      result[mint] = {
        label,
        url: `${RUGCHECK_URL_TOKEN}/${mint}`,
        ...(typeof score === 'number' && { score }),
      };
    });
  } catch (e) {
    console.error('Rugcheck bulk fetch error:', e);
    unique.forEach((mint) => {
      result[mint] = { label: 'Unknown', url: `${RUGCHECK_URL_TOKEN}/${mint}` };
    });
  }

  return NextResponse.json({ summaries: result });
}
