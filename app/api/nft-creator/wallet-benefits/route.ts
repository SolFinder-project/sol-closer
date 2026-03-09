/**
 * GET /api/nft-creator/wallet-benefits?wallet=<address>
 *
 * Returns SolPit Creator NFTs held by the wallet with name and tier.
 * Used by F1 page and reclaim UI to show concrete benefits (points bonus, race time bonus).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCreatorNftsForWallet } from '@/lib/nftCreator';
import { isValidSolanaAddress } from '@/lib/solana/validators';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.trim();
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: 'Missing or invalid query parameter: wallet (Solana address)' },
      { status: 400 }
    );
  }

  try {
    const nfts = await getCreatorNftsForWallet(wallet);
    return NextResponse.json({ nfts });
  } catch (e) {
    console.error('[nft-creator/wallet-benefits]', e);
    // Non-blocking: return empty list so UI (F1 banner, reclaim) still works; RPC/DAS failure must not break the page
    return NextResponse.json({ nfts: [] });
  }
}
