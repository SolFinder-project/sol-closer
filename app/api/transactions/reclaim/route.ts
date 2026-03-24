import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { recordReclaimTransactionWithClient, type TransactionData } from '@/lib/supabase/transactions';

export const dynamic = 'force-dynamic';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * POST /api/transactions/reclaim
 * Body: TransactionData (same shape as saveTransaction previously sent to Supabase from the browser).
 * Persists reclaim + user/global stats using service_role (RLS blocks anon writes).
 */
export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const signature = body.signature;
  const wallet_address = body.wallet_address;
  if (typeof signature !== 'string' || !signature.trim()) {
    return NextResponse.json({ error: 'Missing or invalid signature' }, { status: 400 });
  }
  if (typeof wallet_address !== 'string' || wallet_address.length < 32) {
    return NextResponse.json({ error: 'Missing or invalid wallet_address' }, { status: 400 });
  }

  const accounts_closed = Number(body.accounts_closed);
  const sol_reclaimed = Number(body.sol_reclaimed);
  const fee = Number(body.fee);
  const net_received = Number(body.net_received);
  const timestamp = Number(body.timestamp);
  if (!Number.isFinite(accounts_closed) || !Number.isFinite(sol_reclaimed) || !Number.isFinite(fee) || !Number.isFinite(net_received) || !Number.isFinite(timestamp)) {
    return NextResponse.json({ error: 'Invalid numeric fields' }, { status: 400 });
  }

  const data: TransactionData = {
    signature: signature.trim(),
    wallet_address: wallet_address.trim(),
    accounts_closed,
    sol_reclaimed,
    fee,
    net_received,
    timestamp,
  };

  if (typeof body.referrer_code === 'string' && body.referrer_code.trim()) {
    data.referrer_code = body.referrer_code.trim();
  }
  if (typeof body.referral_earned === 'number' && Number.isFinite(body.referral_earned)) {
    data.referral_earned = body.referral_earned;
  }
  if (typeof body.reclaim_type === 'string') {
    data.reclaim_type = body.reclaim_type as TransactionData['reclaim_type'];
  }
  if (typeof body.chain === 'string') {
    data.chain = body.chain;
  }
  if (typeof body.f1_creator_bonus_pts === 'number' && Number.isInteger(body.f1_creator_bonus_pts)) {
    data.f1_creator_bonus_pts = body.f1_creator_bonus_pts;
  }

  const result = await recordReclaimTransactionWithClient(admin, data);
  if (!result.success) {
    const msg = (result.error as { message?: string })?.message ?? 'Failed to save transaction';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
