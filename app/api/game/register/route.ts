import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getEventById, insertRegistration } from '@/lib/supabase/game';
import { getConnectionForRequest } from '@/lib/solana/connection';
import { verifyF1EntryTx } from '@/lib/solana/verifyF1Entry';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const LAMPORTS_PER_SOL = 1e9;

/**
 * POST /api/game/register
 * Body: { eventId: string, wallet: string, signature: string }
 * Verifies on-chain that the tx is a transfer of entry_fee to F1 treasury, then records registration.
 */
export async function POST(request: NextRequest) {
  const treasuryStr = process.env.NEXT_PUBLIC_F1_TREASURY_WALLET;
  if (!treasuryStr) {
    return NextResponse.json({ error: 'F1 treasury not configured' }, { status: 500 });
  }

  let body: { eventId?: string; wallet?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { eventId, wallet, signature } = body;
  if (!eventId || !wallet || !signature || typeof wallet !== 'string' || wallet.length < 32) {
    return NextResponse.json(
      { error: 'Missing or invalid eventId, wallet, or signature' },
      { status: 400 }
    );
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.status !== 'open') {
    return NextResponse.json({ error: 'Event is closed for registration' }, { status: 400 });
  }

  const expectedLamports = Math.round(Number(event.league.entry_fee_sol) * LAMPORTS_PER_SOL);
  const treasury = new PublicKey(treasuryStr);

  // Use proxy Connection so getParsedTransaction does not 401 (Helius Allowed Domains) when route runs on server.
  const connection = getConnectionForRequest(request);
  const verification = await verifyF1EntryTx(signature, expectedLamports, treasury, wallet, connection);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error ?? 'Transaction verification failed' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const result = await insertRegistration(eventId, wallet, signature, admin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Registration failed' }, { status: 400 });
  }

  return NextResponse.json({ success: true, eventId });
}
