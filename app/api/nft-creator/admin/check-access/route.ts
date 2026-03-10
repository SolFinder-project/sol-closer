import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/nft-creator/admin/check-access?wallet=ADDRESS
 * Server-side check: wallet is in admin list (runtime env, not build-time).
 * Use this so NEXT_PUBLIC_* is read at runtime on Vercel and no redeploy is needed after changing the var.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.trim();
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ allowed: false, error: 'Missing or invalid wallet' }, { status: 400 });
  }

  const raw =
    process.env.NFT_CREATOR_ADMIN_WALLETS?.trim() ||
    process.env.NEXT_PUBLIC_NFT_CREATOR_ADMIN_WALLETS?.trim() ||
    '';
  const list = raw
    .split(',')
    .map((w) => w.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean);

  const allowed = list.length === 0 || list.includes(wallet.toLowerCase());
  return NextResponse.json({ allowed });
}
