/**
 * F1 game – Supabase data and helpers.
 * Points: 2000 pts per 1 SOL (net) + bonus by reclaim type.
 * Race: Silverstone 52 tours, moteur déterministe (lib/silverstoneEngine.ts). Temps stocké en ms (course entière).
 * Game week = Sunday 17:00 UTC → next Sunday 17:00 UTC (no gap: as soon as the race ends, the next week opens).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';
import { computeSilverstoneRaceTime, SILVERSTONE_BASE_TIME_MS, SILVERSTONE_CATEGORY_IDS } from '@/lib/silverstoneEngine';

export interface League {
  id: string;
  name: string;
  entry_fee_sol: number;
  sort_order: number;
  created_at: string;
}

export interface WeeklyEvent {
  id: string;
  league_id: string;
  week_start: string;
  week_end: string;
  status: 'open' | 'closed';
  created_at: string;
  closed_at_ms?: number | null;
}

export interface Registration {
  id: string;
  event_id: string;
  wallet_address: string;
  tx_signature: string;
  registered_at: string;
  upgrade_config: UpgradeConfig;
}

/** Upgrade config for lap time: keys = category id, values = points spent. */
export type UpgradeConfig = Record<string, number>;

/** Reclaim type for F1 points bonus (matches transactions.reclaim_type when present). */
export type F1ReclaimType = 'empty' | 'dust' | 'pump' | 'pumpswap' | 'drift' | 'full_reclaim' | 'nft_burn' | 'cnft_close' | 'openorders';

/** Points: 2000 per 1 SOL (net) for wider allocation spread; bonus by reclaim type. Higher total points = more distinct lap times. */
export const POINTS_PER_SOL = 2000;
const BONUS_BY_RECLAIM_TYPE: Record<string, number> = {
  empty: 12,
  dust: 18,
  full_reclaim: 50,
  pump: 28,
  pumpswap: 34,
  drift: 22,
  nft_burn: 22,
  cnft_close: 22,
  openorders: 14,
};
const DEFAULT_RECLAIM_BONUS = 14;

/**
 * 8 catégories Silverstone (moteur déterministe). Pas de costPerLevel : les points sont dépensés tels quels.
 */
export const UPGRADE_CATEGORIES: Array<{ id: string; label: string; shortLabel: string }> = [
  { id: 'aero', label: 'Aérodynamisme', shortLabel: 'Aero' },
  { id: 'power', label: 'Moteur', shortLabel: 'Power' },
  { id: 'tyreMgmt', label: 'Gestion des pneus', shortLabel: 'Tyre mgmt' },
  { id: 'balance', label: 'Équilibre du châssis', shortLabel: 'Balance' },
  { id: 'stability', label: 'Stabilité arrière', shortLabel: 'Stability' },
  { id: 'traction', label: 'Relance / Motricité', shortLabel: 'Traction' },
  { id: 'braking', label: 'Freinage', shortLabel: 'Braking' },
  { id: 'response', label: 'Direction / Braquage', shortLabel: 'Response' },
];

/**
 * Calcule le temps de course Silverstone (52 tours) en ms. Fonction pure.
 * Utilisé pour le tri et le stockage (results.lap_time_ms = temps course entière en ms).
 */
export function computeRaceTimeMs(config: UpgradeConfig, interactionCount: number): number {
  return computeSilverstoneRaceTime(config, interactionCount).finalTimeMs;
}

/** @deprecated Utiliser getRaceTimeMsForRegistration ou computeRaceTimeMs. Conservé pour compat import (tie-breaker = 0). */
export function computeLapTimeMs(config: UpgradeConfig): number {
  return computeRaceTimeMs(config, 0);
}

/**
 * Nombre de transactions (reclaims) du wallet dans la période (pour tie-breaker Silverstone).
 */
export async function getTransactionCountForWallet(
  walletAddress: string,
  startMs: number,
  endMs: number
): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress)
    .gte('timestamp', startMs)
    .lte('timestamp', endMs);
  if (error) {
    console.error('[game] getTransactionCountForWallet error:', error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Temps de course (ms) pour une inscription : utilise la semaine de l'event + tx count pour le tie-breaker.
 * Applies Creator tier race time bonus (0 / −1.5 s / −4 s / −6 s + collector −1 s) at the caller so the Silverstone engine stays pure.
 */
export async function getRaceTimeMsForRegistration(
  eventId: string,
  walletAddress: string,
  upgradeConfig: UpgradeConfig
): Promise<number> {
  const event = await getEventById(eventId);
  if (!event) return SILVERSTONE_BASE_TIME_MS;
  const startMs = new Date(event.week_start).getTime();
  const endMs = new Date(event.week_end).getTime();
  const interactionCount = await getTransactionCountForWallet(walletAddress, startMs, endMs);
  const baseMs = computeRaceTimeMs(upgradeConfig, interactionCount);
  const { getCreatorRaceTimeBonusMs } = await import('@/lib/nftCreator');
  const bonusMs = await getCreatorRaceTimeBonusMs(walletAddress);
  return Math.max(0, baseMs - bonusMs);
}

/** Base temps Silverstone (export pour compat). */
export const BASE_LAP_TIME_MS = SILVERSTONE_BASE_TIME_MS;

export interface Result {
  id: string;
  event_id: string;
  wallet_address: string;
  position: number;
  /** Race time in ms (Silverstone 52 laps full race). Display with formatRaceTime (e.g. 1h 28m 14s 342ms). */
  lap_time_ms: number;
  prize_sol: number;
  paid_at: string | null;
  created_at: string;
}

/** Bonus per reclaim (used only when reclaim_type is missing in DB). */
export const POINTS_PER_RECLAIM = DEFAULT_RECLAIM_BONUS;

/**
 * Current game week bounds: Sunday 17:00 UTC → next Sunday 17:00 UTC (7 days).
 * So as soon as the race ends (Sunday 17h), the next week has already started (same instant = week_start).
 */
export function getCurrentWeekBounds(): { startMs: number; endMs: number } {
  const now = Date.now();
  const d = new Date(now);
  const day = d.getUTCDay();
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  // This Sunday 00:00 UTC
  const thisSunday00 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day, 0, 0, 0, 0));
  const thisSunday17Ms = thisSunday00.getTime() + 17 * 3600000;
  const weekStartMs = now >= thisSunday17Ms ? thisSunday17Ms : thisSunday17Ms - 7 * 86400000;
  const weekEndMs = weekStartMs + 7 * 86400000;
  return { startMs: weekStartMs, endMs: weekEndMs };
}

/**
 * Returns the current game week bounds for points/registration: use open events' week if any (so points
 * and events stay aligned), otherwise getCurrentWeekBounds(). Call this when you need the period
 * that matches the visible "current week" events.
 */
export async function getCurrentGameWeekBounds(): Promise<{ startMs: number; endMs: number }> {
  const open = await getOpenEventsForCurrentWeek();
  if (open.length > 0) {
    const startMs = new Date(open[0].week_start).getTime();
    const endMs = new Date(open[0].week_end).getTime();
    return { startMs, endMs };
  }
  return getCurrentWeekBounds();
}

/**
 * Compute F1 points for a wallet in the given period from `transactions`.
 * Uses net_received (SOL) and reclaim_type for bonus. Formula: floor(sol * 500) + bonus(reclaim_type) per row.
 */
export async function getPointsForWallet(
  walletAddress: string,
  startMs: number,
  endMs: number
): Promise<number> {
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('net_received, sol_reclaimed, reclaim_type')
    .eq('wallet_address', walletAddress)
    .gte('timestamp', startMs)
    .lte('timestamp', endMs);

  if (error) {
    console.error('[game] getPointsForWallet error:', error);
    return 0;
  }
  if (!rows?.length) return 0;

  let total = 0;
  for (const r of rows) {
    const sol = Number(r.net_received ?? r.sol_reclaimed ?? 0);
    const type = (r as { reclaim_type?: string }).reclaim_type;
    const bonus = type && BONUS_BY_RECLAIM_TYPE[type] != null ? BONUS_BY_RECLAIM_TYPE[type] : DEFAULT_RECLAIM_BONUS;
    total += Math.floor(sol * POINTS_PER_SOL) + bonus;
  }
  return total;
}

export async function getLeagues(): Promise<League[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[game] getLeagues error:', error);
    return [];
  }
  return (data ?? []).map(normalizeLeague);
}

function normalizeLeague(r: Record<string, unknown>): League {
  return {
    id: String(r.id),
    name: String(r.name),
    entry_fee_sol: Number(r.entry_fee_sol),
    sort_order: Number(r.sort_order),
    created_at: String(r.created_at),
  };
}

/**
 * Ensures one open event per league for the current game week. Uses week from existing open events if any, else getCurrentWeekBounds().
 * Creates missing events (e.g. Bronze) so all 3 leagues are always joinable.
 */
export async function ensureOpenEventsForCurrentWeek(): Promise<void> {
  const open = await getOpenEventsForCurrentWeek();
  let weekStartIso: string;
  let weekEndIso: string;
  if (open.length > 0) {
    weekStartIso = open[0].week_start;
    weekEndIso = open[0].week_end;
  } else {
    const { startMs, endMs } = getCurrentWeekBounds();
    weekStartIso = new Date(startMs).toISOString();
    weekEndIso = new Date(endMs).toISOString();
  }
  const leagues = await getLeagues();
  const existingLeagueIds = new Set(open.map((e) => e.league_id));
  const missing = leagues.filter((l) => !existingLeagueIds.has(l.id));
  if (missing.length === 0) return;
  const rows = missing.map((league) => ({
    league_id: league.id,
    week_start: weekStartIso,
    week_end: weekEndIso,
    status: 'open' as const,
  }));
  await supabase
    .from('weekly_events')
    .upsert(rows, { onConflict: 'league_id,week_start', ignoreDuplicates: false });
}

/**
 * Open events for the current game week only. One per league (dedupe by league_id, prefer latest week_start).
 * Used for registration, points bounds, and "current week" UI. After rotation, only these are shown for leagues.
 * @param sb Optional client (e.g. service role); when provided, used for the query (avoids RLS blocking admin flows).
 */
export async function getOpenEventsForCurrentWeek(sb?: SupabaseClient | null): Promise<(WeeklyEvent & { league: League })[]> {
  const db = sb ?? supabase;
  const nowIso = new Date().toISOString();
  const { data: events, error: evError } = await db
    .from('weekly_events')
    .select('*, leagues(*)')
    .eq('status', 'open')
    .lte('week_start', nowIso)
    .gte('week_end', nowIso);

  if (evError) {
    console.error('[game] getOpenEventsForCurrentWeek error:', evError);
    return [];
  }
  const mapped = (events ?? []).map((e: Record<string, unknown>) => {
    const league = (e.leagues as Record<string, unknown> | null) ?? {};
    return {
      id: String(e.id),
      league_id: String(e.league_id),
      week_start: String(e.week_start),
      week_end: String(e.week_end),
      status: (e.status as 'open' | 'closed') ?? 'open',
      created_at: String(e.created_at),
      closed_at_ms: e.closed_at_ms != null ? Number(e.closed_at_ms) : null,
      league: {
        id: String(league.id),
        name: String(league.name),
        entry_fee_sol: Number(league.entry_fee_sol),
        sort_order: Number(league.sort_order),
        created_at: String(league.created_at),
      } as League,
    };
  }) as (WeeklyEvent & { league: League })[];
  const byLeague = new Map<string, (WeeklyEvent & { league: League })>();
  for (const e of mapped.sort((a, b) => a.league.sort_order - b.league.sort_order)) {
    const existing = byLeague.get(e.league_id);
    if (!existing || e.week_start >= existing.week_start) byLeague.set(e.league_id, e);
  }
  return Array.from(byLeague.values()).sort((a, b) => a.league.sort_order - b.league.sort_order);
}

/**
 * All events (open + closed) for the current game week. One event per league max (deduplicated by league_id).
 * If multiple events match (e.g. overlapping weeks in DB), keep closed first then most recent week_start.
 */
export async function getEventsForCurrentWeek(): Promise<(WeeklyEvent & { league: League })[]> {
  const nowIso = new Date().toISOString();
  const { data: events, error: evError } = await supabase
    .from('weekly_events')
    .select('*, leagues(*)')
    .lte('week_start', nowIso)
    .gte('week_end', nowIso);

  if (evError) {
    console.error('[game] getEventsForCurrentWeek error:', evError);
    return [];
  }
  const mapped = (events ?? []).map((e: Record<string, unknown>) => {
    const league = (e.leagues as Record<string, unknown> | null) ?? {};
    return {
      id: String(e.id),
      league_id: String(e.league_id),
      week_start: String(e.week_start),
      week_end: String(e.week_end),
      status: (e.status as 'open' | 'closed') ?? 'open',
      created_at: String(e.created_at),
      closed_at_ms: e.closed_at_ms != null ? Number(e.closed_at_ms) : null,
      league: {
        id: String(league.id),
        name: String(league.name),
        entry_fee_sol: Number(league.entry_fee_sol),
        sort_order: Number(league.sort_order),
        created_at: String(league.created_at),
      } as League,
    };
  }) as (WeeklyEvent & { league: League })[];
  // One per league: prefer closed (show results), then latest week_start
  const byLeague = new Map<string, (WeeklyEvent & { league: League })>();
  for (const e of mapped.sort((a, b) => a.league.sort_order - b.league.sort_order)) {
    const existing = byLeague.get(e.league_id);
    const preferThis =
      !existing ||
      (e.status === 'closed' && existing.status !== 'closed') ||
      (e.status === existing.status && e.week_start >= existing.week_start);
    if (preferThis) byLeague.set(e.league_id, e);
  }
  return Array.from(byLeague.values()).sort((a, b) => a.league.sort_order - b.league.sort_order);
}

/**
 * Most recent closed events (one per league), for showing "last race" leaderboard after rotation.
 * Ordered by closed_at_ms desc so the just-finished week appears first.
 */
export async function getMostRecentClosedEvents(): Promise<(WeeklyEvent & { league: League })[]> {
  const { data: events, error } = await supabase
    .from('weekly_events')
    .select('*, leagues(*)')
    .eq('status', 'closed')
    .not('closed_at_ms', 'is', null)
    .order('closed_at_ms', { ascending: false });

  if (error) {
    console.error('[game] getMostRecentClosedEvents error:', error);
    return [];
  }
  const mapped = (events ?? []).map((e: Record<string, unknown>) => {
    const league = (e.leagues as Record<string, unknown> | null) ?? {};
    return {
      id: String(e.id),
      league_id: String(e.league_id),
      week_start: String(e.week_start),
      week_end: String(e.week_end),
      status: (e.status as 'open' | 'closed') ?? 'closed',
      created_at: String(e.created_at),
      closed_at_ms: e.closed_at_ms != null ? Number(e.closed_at_ms) : null,
      league: {
        id: String(league.id),
        name: String(league.name),
        entry_fee_sol: Number(league.entry_fee_sol),
        sort_order: Number(league.sort_order),
        created_at: String(league.created_at),
      } as League,
    };
  }) as (WeeklyEvent & { league: League })[];
  const byLeague = new Map<string, (WeeklyEvent & { league: League })>();
  for (const e of mapped) {
    if (!byLeague.has(e.league_id)) byLeague.set(e.league_id, e);
  }
  return Array.from(byLeague.values()).sort((a, b) => a.league.sort_order - b.league.sort_order);
}

/** Get a single event by id (with league). */
export async function getEventById(eventId: string): Promise<(WeeklyEvent & { league: League }) | null> {
  const { data: e, error } = await supabase
    .from('weekly_events')
    .select('*, leagues(*)')
    .eq('id', eventId)
    .single();
  if (error || !e) return null;
  const league = (e.leagues as Record<string, unknown> | null) ?? {};
  return {
    id: String(e.id),
    league_id: String(e.league_id),
    week_start: String(e.week_start),
    week_end: String(e.week_end),
    status: (e.status as 'open' | 'closed') ?? 'open',
    created_at: String(e.created_at),
    closed_at_ms: e.closed_at_ms != null ? Number(e.closed_at_ms) : null,
    league: {
      id: String(league.id),
      name: String(league.name),
      entry_fee_sol: Number(league.entry_fee_sol),
      sort_order: Number(league.sort_order),
      created_at: String(league.created_at),
    } as League,
  };
}

export async function getRegistration(
  eventId: string,
  walletAddress: string
): Promise<Registration | null> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('wallet_address', walletAddress)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('[game] getRegistration error:', error);
    return null;
  }
  if (!data) return null;
  return {
    id: String(data.id),
    event_id: String(data.event_id),
    wallet_address: String(data.wallet_address),
    tx_signature: String(data.tx_signature),
    registered_at: String(data.registered_at),
    upgrade_config: (data.upgrade_config as UpgradeConfig) ?? {},
  };
}

export async function getRegistrationsByEvent(eventId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId);
  if (error) {
    console.error('[game] getRegistrationsByEvent error:', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    event_id: String(r.event_id),
    wallet_address: String(r.wallet_address),
    tx_signature: String(r.tx_signature),
    registered_at: String(r.registered_at),
    upgrade_config: (r.upgrade_config as UpgradeConfig) ?? {},
  }));
}

export async function getResultsByEvent(eventId: string): Promise<Result[]> {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('event_id', eventId)
    .order('position', { ascending: true });
  if (error) {
    console.error('[game] getResultsByEvent error:', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    event_id: String(r.event_id),
    wallet_address: String(r.wallet_address),
    position: Number(r.position),
    lap_time_ms: Number(r.lap_time_ms),
    prize_sol: Number(r.prize_sol),
    paid_at: r.paid_at ? String(r.paid_at) : null,
    created_at: String(r.created_at),
  }));
}

/**
 * Returns true if this wallet already has a registration for any event of the same week (same week_start).
 * Enforces: one league per user per week.
 */
export async function hasRegistrationForWeek(
  walletAddress: string,
  weekStartIso: string
): Promise<boolean> {
  const { data: eventIds, error: evError } = await supabase
    .from('weekly_events')
    .select('id')
    .eq('week_start', weekStartIso);
  if (evError || !eventIds?.length) return false;
  const ids = eventIds.map((r) => r.id);
  const { data: regs, error: regError } = await supabase
    .from('registrations')
    .select('id')
    .eq('wallet_address', walletAddress)
    .in('event_id', ids)
    .limit(1);
  return !regError && (regs?.length ?? 0) > 0;
}

/** Insert registration (event_id, wallet_address, tx_signature). Fails if already registered for this event or for another league this week. */
export async function insertRegistration(
  eventId: string,
  walletAddress: string,
  txSignature: string
): Promise<{ ok: boolean; error?: string }> {
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: 'Event not found' };
  const alreadyThisWeek = await hasRegistrationForWeek(walletAddress, event.week_start);
  if (alreadyThisWeek) {
    return { ok: false, error: 'You can only register for one league per week. You are already registered this week.' };
  }
  const { error } = await supabase.from('registrations').insert({
    event_id: eventId,
    wallet_address: walletAddress,
    tx_signature: txSignature,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Already registered for this event' };
    console.error('[game] insertRegistration error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Total points spent in upgrade config (sum of the 8 Silverstone categories). */
export function totalPointsSpent(config: UpgradeConfig): number {
  return SILVERSTONE_CATEGORY_IDS.reduce((sum, id) => sum + (Number(config[id] ?? 0) || 0), 0);
}

/** Update registration upgrade_config. Validates totalPointsSpent(config) <= maxPoints and no category can be reduced below already-saved value (upgrades are definitive until race day). */
export async function updateRegistrationUpgrades(
  eventId: string,
  walletAddress: string,
  upgradeConfig: UpgradeConfig,
  maxPoints: number
): Promise<{ ok: boolean; error?: string }> {
  const spent = totalPointsSpent(upgradeConfig);
  if (spent > maxPoints) {
    return { ok: false, error: `Points spent (${spent}) exceeds available (${maxPoints})` };
  }
  const existing = await getRegistration(eventId, walletAddress);
  if (existing?.upgrade_config && typeof existing.upgrade_config === 'object') {
    for (const id of SILVERSTONE_CATEGORY_IDS) {
      const prev = Number((existing.upgrade_config as Record<string, number>)[id] ?? 0) || 0;
      const next = Number((upgradeConfig as Record<string, number>)[id] ?? 0) || 0;
      if (next < prev) {
        return { ok: false, error: 'Saved upgrades cannot be reduced; you can only add more points from new earnings.' };
      }
    }
  }
  const { error } = await supabase
    .from('registrations')
    .update({ upgrade_config: upgradeConfig })
    .eq('event_id', eventId)
    .eq('wallet_address', walletAddress);
  if (error) {
    console.error('[game] updateRegistrationUpgrades error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Prize share: 70% / 20% / 10% for 1st / 2nd / 3rd. */
const PRIZE_SHARES = [0.7, 0.2, 0.1];
const FEE_PERCENT = 0.1;

/**
 * Close a single event: set status=closed, closed_at_ms, write results (Silverstone engine + tie-breaker).
 * @param sb When provided (e.g. service role), used for all writes so RLS does not block admin rotation.
 */
async function closeOneEventAndWriteResults(
  ev: WeeklyEvent & { league: League },
  sb?: SupabaseClient | null
): Promise<{ ok: boolean; error?: string }> {
  const db = sb ?? supabase;
  const nowMs = Date.now();
  const { error: updateError } = await db
    .from('weekly_events')
    .update({ status: 'closed', closed_at_ms: nowMs })
    .eq('id', ev.id);
  if (updateError) {
    console.error('[game] closeEvent update error:', updateError);
    return { ok: false, error: updateError.message };
  }

  const registrations = await getRegistrationsByEvent(ev.id);
  const entryFeeSol = Number(ev.league.entry_fee_sol);
  const prizePoolSol = registrations.length * entryFeeSol * (1 - FEE_PERCENT);

  const startMs = new Date(ev.week_start).getTime();
  const endMs = new Date(ev.week_end).getTime();

  const { getCreatorRaceTimeBonusMs } = await import('@/lib/nftCreator');
  const rows: { wallet_address: string; lap_time_ms: number }[] = [];
  for (const r of registrations) {
    const interactionCount = await getTransactionCountForWallet(r.wallet_address, startMs, endMs);
    const baseMs = computeRaceTimeMs(r.upgrade_config, interactionCount);
    const bonusMs = await getCreatorRaceTimeBonusMs(r.wallet_address);
    const lap_time_ms = Math.max(0, baseMs - bonusMs);
    rows.push({ wallet_address: r.wallet_address, lap_time_ms });
  }
  rows.sort((a, b) => a.lap_time_ms - b.lap_time_ms);

  const toInsert = rows.slice(0, 3).map((r, i) => ({
    event_id: ev.id,
    wallet_address: r.wallet_address,
    position: i + 1,
    lap_time_ms: r.lap_time_ms,
    prize_sol: prizePoolSol * PRIZE_SHARES[i],
  }));

  if (toInsert.length) {
    await db.from('results').delete().eq('event_id', ev.id);
    const { error: insertError } = await db.from('results').insert(toInsert);
    if (insertError) {
      console.error('[game] results insert error:', insertError);
      return { ok: false, error: insertError.message };
    }
  }
  return { ok: true };
}

/**
 * Close one event and all other open events of the same week (same week_start). Ensures all leagues close together.
 * @param adminClient When provided (e.g. service role), used for writes and same-week fetch so RLS does not block admin rotation.
 */
export async function closeEventAndWriteResults(
  eventId: string,
  adminClient?: SupabaseClient | null
): Promise<{ ok: boolean; error?: string }> {
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: 'Event not found' };
  if (event.status === 'closed') return { ok: false, error: 'Event already closed' };

  const db = adminClient ?? supabase;
  const { data: sameWeek, error: fetchErr } = await db
    .from('weekly_events')
    .select('id')
    .eq('week_start', event.week_start)
    .eq('status', 'open');
  if (fetchErr || !sameWeek?.length) {
    const result = await closeOneEventAndWriteResults(event, adminClient);
    return result;
  }

  const toClose = await Promise.all(
    sameWeek.map((r) => getEventById(r.id as string))
  );
  const eventsToClose = toClose.filter((e): e is WeeklyEvent & { league: League } => e != null);

  for (const ev of eventsToClose) {
    if (!ev) continue;
    const result = await closeOneEventAndWriteResults(ev, adminClient);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Find open events whose week has ended (week_end <= now). Used to close them and then create next week.
 * @param sb Optional client (e.g. service role); when provided, used for the query (avoids RLS blocking admin flows).
 */
export async function getOpenEventsWithWeekEnded(sb?: SupabaseClient | null): Promise<(WeeklyEvent & { league: League })[]> {
  const db = sb ?? supabase;
  const nowIso = new Date().toISOString();
  const { data: events, error } = await db
    .from('weekly_events')
    .select('*, leagues(*)')
    .eq('status', 'open')
    .lte('week_end', nowIso);
  if (error) {
    console.error('[game] getOpenEventsWithWeekEnded error:', error);
    return [];
  }
  return (events ?? []).map((e: Record<string, unknown>) => {
    const league = (e.leagues as Record<string, unknown> | null) ?? {};
    return {
      id: String(e.id),
      league_id: String(e.league_id),
      week_start: String(e.week_start),
      week_end: String(e.week_end),
      status: (e.status as 'open' | 'closed') ?? 'open',
      created_at: String(e.created_at),
      closed_at_ms: e.closed_at_ms != null ? Number(e.closed_at_ms) : null,
      league: {
        id: String(league.id),
        name: String(league.name),
        entry_fee_sol: Number(league.entry_fee_sol),
        sort_order: Number(league.sort_order),
        created_at: String(league.created_at),
      } as League,
    };
  }) as (WeeklyEvent & { league: League })[];
}

/**
 * Close all events whose week has ended (or all open events if force=true), write results, then create new events for the next week.
 * Closes by week: each closeEventAndWriteResults(eventId) closes that event and all others with same week_start, so we loop until no open events remain.
 * @param force If true, close all open events regardless of week_end (for testing).
 * @param testWindow If true (and force), create next week with week_start=now, week_end=now+7d so new events are open immediately.
 * @param adminClient When provided (e.g. service role), used for all writes and for listing open events so RLS does not block admin rotation.
 */
export async function closeCurrentWeekAndStartNext(
  force = false,
  testWindow = false,
  adminClient?: SupabaseClient | null
): Promise<{
  ok: boolean;
  error?: string;
  closed?: string[];
  created?: { weekStart: string; weekEnd: string };
}> {
  const closed: string[] = [];
  let open = force
    ? await getOpenEventsForCurrentWeek(adminClient)
    : await getOpenEventsWithWeekEnded(adminClient);
  if (!force && open.length === 0) {
    return { ok: true, closed: [], created: undefined };
  }

  let lastClosedWeekEndIso: string | null = null;
  while (open.length > 0) {
    lastClosedWeekEndIso = open[0].week_end;
    const result = await closeEventAndWriteResults(open[0].id, adminClient);
    if (!result.ok) return { ok: false, error: `Close ${open[0].id}: ${result.error}` };
    closed.push(open[0].id);
    open = await getOpenEventsForCurrentWeek(adminClient);
  }

  let nextWeekStartIso: string;
  let nextWeekEndIso: string;
  if (force && testWindow) {
    const nowMs = Date.now();
    nextWeekStartIso = new Date(nowMs).toISOString();
    nextWeekEndIso = new Date(nowMs + 7 * 86400000).toISOString();
  } else if (lastClosedWeekEndIso) {
    const lastWeekEndMs = new Date(lastClosedWeekEndIso).getTime();
    nextWeekStartIso = new Date(lastWeekEndMs).toISOString();
    nextWeekEndIso = new Date(lastWeekEndMs + 7 * 86400000).toISOString();
  } else {
    const { startMs, endMs } = getCurrentWeekBounds();
    if (Date.now() > endMs) {
      nextWeekStartIso = new Date(startMs).toISOString();
      nextWeekEndIso = new Date(endMs).toISOString();
    } else {
      const nextStartMs = startMs + 7 * 86400000;
      const nextEndMs = endMs + 7 * 86400000;
      nextWeekStartIso = new Date(nextStartMs).toISOString();
      nextWeekEndIso = new Date(nextEndMs).toISOString();
    }
  }

  const leagues = await getLeagues();
  const rows = leagues.map((league) => ({
    league_id: league.id,
    week_start: nextWeekStartIso,
    week_end: nextWeekEndIso,
    status: 'open' as const,
  }));
  const db = adminClient ?? supabase;
  const { error: upsertErr } = await db
    .from('weekly_events')
    .upsert(rows, { onConflict: 'league_id,week_start', ignoreDuplicates: false });
  if (upsertErr) {
    console.error('[game] create next week events error:', upsertErr);
    return { ok: false, error: upsertErr.message };
  }

  return {
    ok: true,
    closed,
    created: { weekStart: nextWeekStartIso, weekEnd: nextWeekEndIso },
  };
}
