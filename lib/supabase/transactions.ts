import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';

/** Type of reclaim for stats/History display. All closers pass this. */
export type ReclaimType = 'empty' | 'dust' | 'pump' | 'pumpswap' | 'drift' | 'full_reclaim' | 'nft_burn' | 'cnft_close' | 'openorders';

export interface TransactionData {
  signature: string;
  wallet_address: string;
  accounts_closed: number;
  sol_reclaimed: number;
  fee: number;
  net_received: number;
  referrer_code?: string;
  referral_earned?: number;
  timestamp: number;
  /** Optional: type of reclaim (empty, dust, Pump PDA, PumpSwap PDA, full reclaim). Requires column `reclaim_type` in Supabase. */
  reclaim_type?: ReclaimType;
  /** Optional: chain (solana, base, etc.). Requires column `chain` in Supabase. Defaults to solana for existing code. */
  chain?: string;
  /** Optional: F1 Creator bonus points for this reclaim (set when wallet held Creator NFT at tx time). Requires column `f1_creator_bonus_pts` in Supabase. */
  f1_creator_bonus_pts?: number;
}

/**
 * Persists one reclaim + stats updates. Use from API routes with `getSupabaseAdmin()` after RLS hardening
 * (anon no longer has INSERT/UPDATE on transactions / user_stats / global_stats).
 */
export async function recordReclaimTransactionWithClient(
  client: SupabaseClient,
  data: TransactionData
): Promise<{ success: true } | { success: false; error: unknown }> {
  try {
    const timestampMs = typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)
      ? data.timestamp
      : new Date(data.timestamp as unknown as string | number).getTime();
    const row: Record<string, unknown> = {
      signature: data.signature,
      wallet_address: data.wallet_address,
      accounts_closed: data.accounts_closed,
      sol_reclaimed: data.sol_reclaimed,
      fee: data.fee,
      net_received: data.net_received,
      referrer_code: data.referrer_code ?? null,
      referral_earned: data.referral_earned ?? null,
      timestamp: timestampMs,
    };
    if (data.reclaim_type != null) {
      row.reclaim_type = data.reclaim_type;
    }
    if (data.chain != null) {
      row.chain = data.chain;
    }
    if (data.f1_creator_bonus_pts != null && Number.isInteger(data.f1_creator_bonus_pts)) {
      row.f1_creator_bonus_pts = data.f1_creator_bonus_pts;
    }
    let { error: txError } = await client.from('transactions').insert([row]);
    if (txError && (data.reclaim_type != null || data.chain != null || data.f1_creator_bonus_pts != null)) {
      if (data.reclaim_type != null) delete row.reclaim_type;
      if (data.chain != null) delete row.chain;
      if (data.f1_creator_bonus_pts != null) delete row.f1_creator_bonus_pts;
      const retry = await client.from('transactions').insert([row]);
      txError = retry.error;
    }
    if (txError) throw txError;

    const dataWithMs = { ...data, timestamp: timestampMs };
    const errUser = await updateUserStats(client, dataWithMs, 'iso');
    if (errUser) throw errUser;
    const errGlobal = await updateGlobalStats(client, dataWithMs, 'iso');
    if (errGlobal) throw errGlobal;

    if (data.referrer_code && data.referral_earned && data.referral_earned > 0) {
      try {
        await updateReferrerStats(client, data.referrer_code, data.referral_earned, data.wallet_address, 'iso');
      } catch (referrerErr) {
        console.warn('[Supabase] Referrer stats update failed (transaction was saved):', (referrerErr as Error)?.message ?? referrerErr);
      }
    }

    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string; details?: string; code?: string };
    console.error('Error saving transaction to Supabase:', err?.message ?? error, err?.details ?? '');
    return { success: false, error };
  }
}

/**
 * Browser: POST to /api/transactions/reclaim (service role on server). After RLS hardening, direct anon inserts are denied.
 */
export async function saveTransaction(data: TransactionData) {
  if (typeof window === 'undefined') {
    console.warn('[saveTransaction] expected browser context');
    return { success: false, error: new Error('saveTransaction must run in the browser') };
  }
  try {
    const res = await fetch('/api/transactions/reclaim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { success: false, error: json?.error ?? res.statusText };
    }
    return { success: true };
  } catch (error: unknown) {
    console.error('Error posting reclaim to API:', error);
    return { success: false, error };
  }
}

type TimestampFormat = 'ms' | 'iso' | 'seconds';

/** Epoch seconds (fits int32 and timestamptz). user_stats/global_stats may use integer or timestamptz; ms overflows int. */
function toStatsTimestamp(ms: number, format: TimestampFormat): number | string {
  if (format === 'iso') return new Date(ms).toISOString();
  if (format === 'seconds') return Math.floor(ms / 1000);
  return ms;
}

/** Returns error if update failed, null on success. */
async function updateUserStats(
  client: SupabaseClient,
  data: TransactionData,
  format: TimestampFormat
): Promise<unknown> {
  const { data: existing, error: fetchError } = await client
    .from('user_stats')
    .select('*')
    .eq('wallet_address', data.wallet_address)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return fetchError;
  }

  const ts = toStatsTimestamp(data.timestamp, format);
  const now = toStatsTimestamp(Date.now(), format);

  if (existing) {
    const { error } = await client
      .from('user_stats')
      .update({
        total_accounts_closed: Number(existing.total_accounts_closed) + Number(data.accounts_closed),
        total_sol_reclaimed: Number(existing.total_sol_reclaimed) + Number(data.sol_reclaimed),
        total_fees_paid: Number(existing.total_fees_paid) + Number(data.fee),
        total_net_received: Number(existing.total_net_received) + Number(data.net_received),
        transaction_count: Number(existing.transaction_count) + 1,
        last_transaction_at: ts,
        updated_at: now,
      })
      .eq('wallet_address', data.wallet_address);

    return error ?? null;
  }
  const { error } = await client.from('user_stats').insert([{
    wallet_address: data.wallet_address,
    total_accounts_closed: data.accounts_closed,
    total_sol_reclaimed: data.sol_reclaimed,
    total_fees_paid: data.fee,
    total_net_received: data.net_received,
    transaction_count: 1,
    first_transaction_at: ts,
    last_transaction_at: ts,
    referral_earnings: 0,
    referral_count: 0,
  }]);
  return error ?? null;
}

/** Returns error if update failed, null on success. */
async function updateGlobalStats(
  client: SupabaseClient,
  data: TransactionData,
  format: TimestampFormat
): Promise<unknown> {
  const { data: stats, error: fetchError } = await client
    .from('global_stats')
    .select('*')
    .eq('id', 1)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return fetchError;
  }

  const now = toStatsTimestamp(Date.now(), format);

  if (stats) {
    const { error } = await client
      .from('global_stats')
      .update({
        total_accounts_closed: Number(stats.total_accounts_closed) + Number(data.accounts_closed),
        total_sol_reclaimed: Number(stats.total_sol_reclaimed) + Number(data.sol_reclaimed),
        total_transactions: Number(stats.total_transactions) + 1,
        updated_at: now,
      })
      .eq('id', 1);

    if (error) return error;
  } else {
    const { error } = await client.from('global_stats').insert([{
      id: 1,
      total_accounts_closed: data.accounts_closed,
      total_sol_reclaimed: data.sol_reclaimed,
      total_transactions: 1,
      total_users: 1,
    }]);

    if (error) return error;
  }

  const { count } = await client.from('user_stats').select('*', { count: 'exact', head: true });

  if (count !== null) {
    await client.from('global_stats').update({ total_users: count }).eq('id', 1);
  }
  return null;
}

async function updateReferrerStats(
  client: SupabaseClient,
  referrerWallet: string,
  amount: number,
  referredWallet: string,
  format: TimestampFormat = 'ms'
) {
  console.log(`📊 Updating referrer stats: ${referrerWallet} earned ${amount} SOL from ${referredWallet}`);

  const { data: referrerStats, error: fetchError } = await client
    .from('user_stats')
    .select('*')
    .eq('wallet_address', referrerWallet)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching referrer stats:', fetchError);
    return;
  }

  const now = toStatsTimestamp(Date.now(), format);

  if (referrerStats) {
    const { error } = await client
      .from('user_stats')
      .update({
        referral_earnings: Number(referrerStats.referral_earnings || 0) + Number(amount),
        referral_count: Number(referrerStats.referral_count || 0) + 1,
        updated_at: now,
      })
      .eq('wallet_address', referrerWallet);

    if (error) {
      console.error('Error updating referrer stats:', error);
    } else {
      console.log(`✅ Referrer ${referrerWallet.slice(0, 8)} credited with ${amount} SOL`);
    }
  } else {
    const { error } = await client.from('user_stats').insert([{
      wallet_address: referrerWallet,
      total_accounts_closed: 0,
      total_sol_reclaimed: 0,
      total_fees_paid: 0,
      total_net_received: 0,
      transaction_count: 0,
      first_transaction_at: now,
      last_transaction_at: now,
      referral_earnings: amount,
      referral_count: 1,
    }]);

    if (error) {
      console.error('Error creating referrer stats:', error);
    } else {
      console.log(`✅ Created referrer stats for ${referrerWallet.slice(0, 8)} with ${amount} SOL`);
    }
  }
}

/** Converts stored stats timestamp (epoch seconds, epoch ms, or ISO string) to ms for Date. */
export function statsTimestampToMs(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'string') return new Date(value).getTime();
  return value < 1e12 ? value * 1000 : value;
}

export async function getUserStats(walletAddress: string) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }

  return data;
}

const EMPTY_GLOBAL_STATS = {
  total_accounts_closed: 0,
  total_sol_reclaimed: 0,
  total_transactions: 0,
  total_users: 0,
} as const;

export async function getGlobalStats() {
  const { data, error } = await supabase
    .from('global_stats')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { ...EMPTY_GLOBAL_STATS };
    }
    console.error('Error fetching global stats:', error);
    return { ...EMPTY_GLOBAL_STATS };
  }

  return data;
}

export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .order('total_sol_reclaimed', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data;
}

export async function getUserTransactions(walletAddress: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data;
}

export async function getRecentTransactions(limit = 5) {
  const { data, error } = await supabase
    .from('transactions')
    .select('wallet_address, accounts_closed, net_received, timestamp')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent transactions:', error);
    return [];
  }

  return data;
}

/**
 * Returns percentile (0-100): share of users who have reclaimed less SOL than this wallet.
 * Used for "Cleaner than X% of users" after reclaim. Returns null if wallet has no stats or error.
 */
export async function getReclaimPercentile(walletAddress: string): Promise<number | null> {
  const { data: userRow, error: userError } = await supabase
    .from('user_stats')
    .select('total_sol_reclaimed')
    .eq('wallet_address', walletAddress)
    .single();

  if (userError || !userRow) return null;
  const userReclaimed = Number(userRow.total_sol_reclaimed ?? 0);

  const { count: totalUsers, error: countError } = await supabase
    .from('user_stats')
    .select('*', { count: 'exact', head: true });
  if (countError || totalUsers === null || totalUsers === 0) return null;

  const { count: countBelow, error: belowError } = await supabase
    .from('user_stats')
    .select('*', { count: 'exact', head: true })
    .lt('total_sol_reclaimed', userReclaimed);
  if (belowError || countBelow === null) return null;

  const percentile = Math.round((countBelow / totalUsers) * 100);
  return Math.min(100, Math.max(0, percentile));
}
