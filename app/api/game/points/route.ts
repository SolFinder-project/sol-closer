import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentGameWeekBounds,
  getPointsForWallet,
  getCreatorBonusPointsFromTransactions,
} from '@/lib/supabase/game';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game/points?wallet=<address>
 * Returns F1 points for the current game week (aligned with open events; resets when new week starts).
 * Creator bonus is taken from f1_creator_bonus_pts stored at tx time (so NFT transfer does not add/remove bonus for past reclaims).
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.trim();
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
  }

  try {
    const { startMs, endMs } = await getCurrentGameWeekBounds();
    const [pointsBase, pointsBonus] = await Promise.all([
      getPointsForWallet(wallet, startMs, endMs),
      getCreatorBonusPointsFromTransactions(wallet, startMs, endMs),
    ]);
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
