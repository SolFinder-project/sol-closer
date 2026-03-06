import { NextRequest, NextResponse } from 'next/server';
import { closeEventAndWriteResults } from '@/lib/supabase/game';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/game/close
 * Body: { eventId: string }
 * Header: x-f1-admin-secret or body adminSecret (must match F1_ADMIN_SECRET).
 * Closes the event and writes results (top 3, prize_sol). Manual distribution.
 * Uses service role so RLS cannot block updates/inserts.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.F1_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Admin close not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('x-f1-admin-secret');
  let body: { eventId?: string; adminSecret?: string } = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body if eventId in query
  }
  const eventId = body.eventId ?? request.nextUrl.searchParams.get('eventId');
  const provided = authHeader ?? body.adminSecret;
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required for admin close. Set it in env.' },
      { status: 500 }
    );
  }

  const result = await closeEventAndWriteResults(eventId, adminClient);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, eventId });
}
