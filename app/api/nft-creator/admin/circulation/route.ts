import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getConnection } from '@/lib/solana/connection';

export const dynamic = 'force-dynamic';

function checkAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret') ?? request.nextUrl.searchParams.get('adminSecret');
  const expected = process.env.NFT_CREATOR_ADMIN_SECRET || process.env.F1_ADMIN_SECRET;
  return !!expected && secret === expected;
}

/**
 * GET /api/nft-creator/admin/circulation
 * Returns finalized NFT Creator submissions that are still in circulation (mint exists and supply > 0).
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

  const { data: rows, error } = await admin
    .from('nft_creator_submissions')
    .select('id, wallet_address, image_uri, metadata_uri, name, description, attributes, tier, mint_address, created_at, approved_at')
    .eq('status', 'finalized')
    .not('mint_address', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[nft-creator/admin/circulation]', error);
    return NextResponse.json({ error: 'Failed to fetch finalized' }, { status: 500 });
  }

  const list = (rows ?? []) as { mint_address: string; [k: string]: unknown }[];
  if (list.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const connection = getConnection();
  const stillInCirculation: Array<Record<string, unknown> & { current_holder?: string | null }> = [];

  for (const row of list) {
    const mint = typeof row.mint_address === 'string' ? row.mint_address.trim() : '';
    if (!mint) continue;
    try {
      const pk = new PublicKey(mint);
      const supply = await connection.getTokenSupply(pk);
      const amount = supply?.value?.amount;
      const ok = amount != null && BigInt(amount) > 0n;
      if (!ok) continue;

      let currentHolder: string | null = null;
      try {
        const largest = await connection.getTokenLargestAccounts(pk);
        const withBalance = largest.value?.find((a) => a.amount && BigInt(a.amount) > 0n);
        if (withBalance?.address) {
          const accountInfo = await connection.getAccountInfo(new PublicKey(withBalance.address));
          if (accountInfo?.data && accountInfo.data.length >= 64) {
            currentHolder = new PublicKey(accountInfo.data.subarray(32, 64)).toBase58();
          }
        }
      } catch {
        // Best-effort: leave current_holder null
      }

      stillInCirculation.push({ ...row, current_holder: currentHolder });
    } catch {
      // Mint account missing or invalid → consider burned, skip
    }
  }

  return NextResponse.json({ items: stillInCirculation });
}
