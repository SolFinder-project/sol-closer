import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentGameWeekBounds,
  getPointsForWallet,
  getTransactionCountForWallet,
} from '@/lib/supabase/game';
import { getCreatorPointsBonus } from '@/lib/nftCreator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game/points?wallet=<address>
 * Returns F1 points for the current game week (aligned with open events; resets when new week starts).
 * Adds Creator tier bonus (points per reclaim × reclaim count) when wallet holds a SolPit Creator NFT.
 * getCreatorPointsBonus uses getCreatorNftsForWallet (same as wallet-benefits) so bonus matches the banner.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.trim();
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
  }

  try {
    const { startMs, endMs } = await getCurrentGameWeekBounds();
    const [pointsBase, reclaimCount, bonusPerReclaim] = await Promise.all([
      getPointsForWallet(wallet, startMs, endMs),
      getTransactionCountForWallet(wallet, startMs, endMs),
      getCreatorPointsBonus(wallet).catch(() => 0),
    ]);
    const pointsBonus = reclaimCount * bonusPerReclaim;
    const points = pointsBase + pointsBonus;

    return NextResponse.json({
      points,
      pointsBase,
      pointsBonus,
      periodStart: startMs,
      periodEnd: endMs,
    });
  } catch (error) {
    console.error('[game/points] error:', error);
    return NextResponse.json({ error: 'Failed to compute points' }, { status: 500 });
  }
}
