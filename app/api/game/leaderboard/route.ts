import { NextRequest, NextResponse } from 'next/server';
import {
  getEventById,
  getRegistrationsByEvent,
  getResultsByEvent,
  getRaceTimeMsForRegistration,
  getTransactionCountForWallet,
} from '@/lib/supabase/game';
import { computeSilverstoneRaceTime } from '@/lib/silverstoneEngine';
import { dasOptionsFromRequest } from '@/lib/api/dasOptionsFromRequest';

export const dynamic = 'force-dynamic';

const FEE_PERCENT = 0.1; // 10% platform fee; 90% to prize pool

/**
 * GET /api/game/leaderboard?eventId=...
 * - Event open: no ranking revealed. Returns only participantCount, prizePoolSol, isEventClosed: false, leaderboard: [].
 * - Event closed: full leaderboard (position, wallet, lapTimeMs) revealed at once.
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId');
  const currentWallet = request.nextUrl.searchParams.get('wallet') ?? undefined;
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const registrations = await getRegistrationsByEvent(eventId);
  const entryFeeSol = Number(event.league.entry_fee_sol);
  const prizePoolSol = registrations.length * entryFeeSol * (1 - FEE_PERCENT);
  const isEventClosed = event.status === 'closed';

  if (!isEventClosed) {
    const res = NextResponse.json({
      eventId,
      leagueName: event.league.name,
      entryFeeSol,
      prizePoolSol,
      participantCount: registrations.length,
      isEventClosed: false,
      leaderboard: [],
    });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  }

  const results = await getResultsByEvent(eventId);
  const top3Wallets = new Set(results.map((r) => r.wallet_address));
  const remainingRegistrations = registrations.filter((r) => !top3Wallets.has(r.wallet_address));
  const dasOpts = dasOptionsFromRequest(request);
  const remainingWithTimes = await Promise.all(
    remainingRegistrations.map(async (r) => ({
      wallet_address: r.wallet_address,
      lap_time_ms: await getRaceTimeMsForRegistration(eventId, r.wallet_address, r.upgrade_config, dasOpts),
    }))
  );
  remainingWithTimes.sort((a, b) => a.lap_time_ms - b.lap_time_ms);
  const withIsYou = (wallet_address: string) => (currentWallet && wallet_address === currentWallet) || false;

  let playerWarnings: string[] = [];
  if (currentWallet) {
    const myReg = registrations.find((r) => r.wallet_address === currentWallet);
    if (myReg) {
      const startMs = new Date(event.week_start).getTime();
      const endMs = new Date(event.week_end).getTime();
      const interactionCount = await getTransactionCountForWallet(currentWallet, startMs, endMs);
      const result = computeSilverstoneRaceTime(myReg.upgrade_config, interactionCount, { lang: 'en' });
      playerWarnings = result.warnings ?? [];
    }
  }

  // Positions 1..N: top 3 from results table, then remaining by lap time. Use results.length + 1 + i
  // so that when results is empty (e.g. close failed to write), the only participant gets #1, not #4.
  const firstRemainingPosition = results.length + 1;
  const leaderboard = [
    ...results.map((r) => ({
      position: r.position,
      wallet: maskWallet(r.wallet_address),
      lapTimeMs: r.lap_time_ms as number,
      isYou: withIsYou(r.wallet_address),
    })),
    ...remainingWithTimes.map((r, i) => ({
      position: firstRemainingPosition + i,
      wallet: maskWallet(r.wallet_address),
      lapTimeMs: r.lap_time_ms,
      isYou: withIsYou(r.wallet_address),
    })),
  ];

  const res = NextResponse.json({
    eventId,
    leagueName: event.league.name,
    entryFeeSol,
    prizePoolSol,
    participantCount: registrations.length,
    isEventClosed: true,
    leaderboard,
    playerWarnings,
  });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

function maskWallet(wallet: string): string {
  if (wallet.length < 12) return '…';
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}
