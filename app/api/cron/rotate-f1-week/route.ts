import { NextResponse } from 'next/server';
import { closeCurrentWeekAndStartNext } from '@/lib/supabase/game';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getDasOptionsForCron } from '@/lib/api/dasOptionsForCron';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/rotate-f1-week
 * Called by Vercel Cron every Sunday at 17:00 UTC (vercel.json).
 * Auth: Authorization: Bearer <CRON_SECRET>. Closes events whose week has ended and creates next week's events.
 * Passes DAS options using the current request origin first (same deployment), then env fallback
 * (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, VERCEL_URL) so Creator NFT race-time bonus is applied at close.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secretSet = Boolean(process.env.CRON_SECRET);
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(
      '❌ Unauthorized cron attempt: rotate-f1-week',
      secretSet ? '(header missing or mismatch)' : '(CRON_SECRET not set in env)'
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY required for rotate-f1-week' },
      { status: 500 }
    );
  }

  try {
    const rpcOptions = getDasOptionsForCron(request);
    const result = await closeCurrentWeekAndStartNext(false, false, adminClient, rpcOptions ?? undefined);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? 'Rotation failed', closed: result.closed },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      closed: result.closed ?? [],
      created: result.created,
    });
  } catch (error) {
    console.error('❌ Cron rotate-f1-week failed:', error);
    return NextResponse.json(
      {
        error: 'Rotation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
