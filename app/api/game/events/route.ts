import { NextResponse } from 'next/server';
import {
  getOpenEventsForCurrentWeek,
  getMostRecentClosedEvents,
  ensureOpenEventsForCurrentWeek,
  getLeagues,
  getRegistrationsByEvent,
} from '@/lib/supabase/game';

const FEE_PERCENT = 0.1; // 10% platform fee; 90% to prize pool

export const dynamic = 'force-dynamic';

/**
 * GET /api/game/events
 * - events: open events only (current week). Ensures one event per league (e.g. Bronze) so all are joinable.
 * - lastClosedEvents: most recent closed events (one per league) for "last race" leaderboard.
 */
export async function GET() {
  try {
    const [openEvents, leagues] = await Promise.all([
      getOpenEventsForCurrentWeek(),
      getLeagues(),
    ]);
    if (openEvents.length < leagues.length) {
      await ensureOpenEventsForCurrentWeek();
    }
    const [events, lastClosedEvents] = await Promise.all([
      getOpenEventsForCurrentWeek(),
      getMostRecentClosedEvents(),
    ]);
    const registrationsByEvent = await Promise.all(
      events.map((e) => getRegistrationsByEvent(e.id))
    );
    const entryFeeByEvent = events.map((e) => Number(e.league.entry_fee_sol));
    const mapEvent = (e: Awaited<ReturnType<typeof getOpenEventsForCurrentWeek>>[0], index: number) => {
      const regs = registrationsByEvent[index] ?? [];
      const entryFeeSol = entryFeeByEvent[index] ?? 0;
      const participantCount = regs.length;
      const prizePoolSol = participantCount * entryFeeSol * (1 - FEE_PERCENT);
      return {
        id: e.id,
        leagueId: e.league_id,
        leagueName: e.league.name,
        entryFeeSol: e.league.entry_fee_sol,
        weekStart: e.week_start,
        weekEnd: e.week_end,
        status: e.status,
        participantCount,
        prizePoolSol,
      };
    };
    return NextResponse.json({
      events: events.map((e, i) => mapEvent(e, i)),
      lastClosedEvents: lastClosedEvents.map((e, i) => ({
        id: e.id,
        leagueId: e.league_id,
        leagueName: e.league.name,
        entryFeeSol: e.league.entry_fee_sol,
        weekStart: e.week_start,
        weekEnd: e.week_end,
        status: e.status,
      })),
    });
  } catch (error) {
    console.error('[game/events] error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
