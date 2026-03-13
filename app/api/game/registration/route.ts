import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistration,
  getEventById,
  getCurrentGameWeekBounds,
  getPointsForWallet,
  getCreatorBonusPointsFromTransactions,
  updateRegistrationUpgrades,
  getOpenEventsForCurrentWeek,
} from '@/lib/supabase/game';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game/registration?wallet=...&eventId=...
 * Returns the user's registration for the event (if any) and current week points.
 * Points = base + Creator bonus from tx-time storage (same as GET /api/game/points).
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const eventId = request.nextUrl.searchParams.get('eventId');
  if (!wallet || typeof wallet !== 'string' || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
  }

  const { startMs, endMs } = await getCurrentGameWeekBounds();
  const [pointsBase, pointsBonus] = await Promise.all([
    getPointsForWallet(wallet, startMs, endMs),
    getCreatorBonusPointsFromTransactions(wallet, startMs, endMs),
  ]);
  const points = pointsBase + pointsBonus;

  if (!eventId) {
    // Return points and registration status for open events only (current week). After rotation = new week, no registrations.
    const events = await getOpenEventsForCurrentWeek();
    const registrations = await Promise.all(
      events.map(async (e) => {
        const reg = await getRegistration(e.id, wallet);
        return {
          eventId: e.id,
          leagueName: e.league.name,
          registered: !!reg,
          upgradeConfig: reg?.upgrade_config ?? {},
          // lapTimeMs not exposed before race closes (keeps competition suspense)
        };
      })
    );
    return NextResponse.json({ points, periodStart: startMs, periodEnd: endMs, registrations });
  }

  const registration = await getRegistration(eventId, wallet);
  if (!registration) {
    return NextResponse.json({
      points,
      periodStart: startMs,
      periodEnd: endMs,
      registration: null,
    });
  }

  return NextResponse.json({
    points,
    periodStart: startMs,
    periodEnd: endMs,
    registration: {
      eventId: registration.event_id,
      walletAddress: registration.wallet_address,
      upgradeConfig: registration.upgrade_config,
      // lapTimeMs not exposed before race closes
    },
  });
}

/**
 * PUT /api/game/registration
 * Body: { eventId: string, wallet: string, upgradeConfig: Record<string, number> }
 * Updates upgrade config; total points spent must not exceed user's week points.
 */
export async function PUT(request: NextRequest) {
  let body: { eventId?: string; wallet?: string; upgradeConfig?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { eventId, wallet, upgradeConfig } = body;
  if (!eventId || !wallet || typeof wallet !== 'string' || wallet.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid eventId or wallet' }, { status: 400 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.status === 'closed') {
    return NextResponse.json({ error: 'Race is closed; upgrades cannot be changed' }, { status: 400 });
  }

  const config = upgradeConfig ?? {};
  const { startMs, endMs } = await getCurrentGameWeekBounds();
  const [pointsBase, pointsBonus] = await Promise.all([
    getPointsForWallet(wallet, startMs, endMs),
    getCreatorBonusPointsFromTransactions(wallet, startMs, endMs),
  ]);
  const maxPoints = pointsBase + pointsBonus;
  const result = await updateRegistrationUpgrades(eventId, wallet, config, maxPoints);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
