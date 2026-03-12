import { NextRequest, NextResponse } from 'next/server';
import {
  getEventById,
  getRegistrationsByEvent,
  getResultsByEvent,
  getRaceTimeMsForRegistration,
  getTransactionCountForWallet,
} from '@/lib/supabase/game';
import { computeSilverstoneRaceTime } from '@/lib/silverstoneEngine';

export const dynamic = 'force-dynamic';

/** Build proxy RPC options from request so DAS works when route runs on server (avoids 401 / Allowed Domains). */
function dasOptionsFromRequest(request: NextRequest): { rpcUrl: string; fetch: (url: string, init?: RequestInit) => Promise<Response> } | undefined {
  const origin = request.headers.get('origin')?.trim();
  const referer = request.headers.get('referer')?.trim();
  const baseUrl = origin || (referer ? (() => { try { return new URL(referer).origin; } catch { return ''; } })() : '');
  if (!baseUrl) return undefined;
  const rpcUrl = `${baseUrl.replace(/\/$/, '')}/api/rpc`;
  const customFetch: (url: string, init?: RequestInit) => Promise<Response> = (url, init) =>
    fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(origin && { Origin: origin }), ...(referer && { Referer: referer }) } });
  return { rpcUrl, fetch: customFetch };
}

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
    return NextResponse.json({
      eventId,
      leagueName: event.league.name,
      entryFeeSol,
      prizePoolSol,
      participantCount: registrations.length,
      isEventClosed: false,
      leaderboard: [],
    });
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

  const leaderboard = [
    ...results.map((r) => ({
      position: r.position,
      wallet: maskWallet(r.wallet_address),
      lapTimeMs: r.lap_time_ms as number,
      isYou: withIsYou(r.wallet_address),
    })),
    ...remainingWithTimes.map((r, i) => ({
      position: 4 + i,
      wallet: maskWallet(r.wallet_address),
      lapTimeMs: r.lap_time_ms,
      isYou: withIsYou(r.wallet_address),
    })),
  ];

  return NextResponse.json({
    eventId,
    leagueName: event.league.name,
    entryFeeSol,
    prizePoolSol,
    participantCount: registrations.length,
    isEventClosed: true,
    leaderboard,
    playerWarnings,
  });
}

function maskWallet(wallet: string): string {
  if (wallet.length < 12) return '…';
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}
