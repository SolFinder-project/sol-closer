import { NextRequest, NextResponse } from 'next/server';
import { closeCurrentWeekAndStartNext } from '@/lib/supabase/game';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/game/admin/rotate-week
 * Closes all events whose week has ended, writes results, creates next week's events.
 * Use at Sunday 17:00 UTC (cron) or manually for tests.
 * Auth: Header x-f1-admin-secret or body { adminSecret } must match F1_ADMIN_SECRET.
 * Uses service role client so RLS cannot block updates/inserts (weekly_events, results).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.F1_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'F1 admin not configured' }, { status: 500 });
  }

  let body: { adminSecret?: string; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // allow no body
  }
  const provided = request.headers.get('x-f1-admin-secret') ?? body.adminSecret;
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const force = body.force === true || request.nextUrl.searchParams.get('force') === 'true';
  const testWindow = body.testWindow === true || request.nextUrl.searchParams.get('testWindow') === 'true';

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required for rotate-week (bypasses RLS). Set it in env.' },
      { status: 500 }
    );
  }

  const result = await closeCurrentWeekAndStartNext(force, testWindow, adminClient);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    closed: result.closed ?? [],
    created: result.created,
  });
}
