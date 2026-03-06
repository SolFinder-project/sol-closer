import { NextRequest, NextResponse } from 'next/server';
import { getEventById, getResultsByEvent } from '@/lib/supabase/game';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game/results?eventId=...
 * Returns final results for an event (for manual distribution: "Send X SOL to [wallet]").
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const results = await getResultsByEvent(eventId);
  const distribution = results.map((r) => ({
    position: r.position,
    wallet: r.wallet_address,
    prizeSol: r.prize_sol,
    paidAt: r.paid_at,
  }));

  return NextResponse.json({
    eventId,
    leagueName: event.league.name,
    weekEnd: event.week_end,
    distribution,
  });
}
