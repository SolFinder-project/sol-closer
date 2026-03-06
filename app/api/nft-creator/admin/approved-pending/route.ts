import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function checkAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret') ?? request.nextUrl.searchParams.get('adminSecret');
  const expected = process.env.NFT_CREATOR_ADMIN_SECRET || process.env.F1_ADMIN_SECRET;
  return !!expected && secret === expected;
}

/**
 * GET /api/nft-creator/admin/approved-pending
 * Returns submissions with status = 'approved' (validated by admin, awaiting user to finalize/pay).
 * Requires x-admin-secret header or ?adminSecret=.
 */
export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data, error } = await admin
    .from('nft_creator_submissions')
    .select('id, wallet_address, image_uri, metadata_uri, name, description, tier, approved_at, expires_at, created_at')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });

  if (error) {
    console.error('[nft-creator/admin/approved-pending]', error);
    return NextResponse.json({ error: 'Failed to fetch approved-pending' }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}
