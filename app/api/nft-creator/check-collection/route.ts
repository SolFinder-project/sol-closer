/**
 * GET /api/nft-creator/check-collection
 *
 * Validates that the configured SolPit Creator collection (NFT_CREATOR_COLLECTION_MINT +
 * NFT_CREATOR_COLLECTION_AUTHORITY) is valid on-chain: metadata and master edition exist,
 * update authority matches. Use this to verify config before testing Finalize (add-to-collection).
 */

import { NextResponse } from 'next/server';
import { validateCollectionConfig } from '@/lib/nftCreator/buildMintTransaction';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await validateCollectionConfig();
    if (result.ok) {
      return NextResponse.json({
        ok: true,
        mint: result.mint,
        updateAuthority: result.updateAuthority,
        message: 'Collection is valid. Add-to-collection (Verify Collection) should succeed.',
      });
    }
    return NextResponse.json({
      ok: false,
      reason: result.reason,
      message: result.reason,
    });
  } catch (error) {
    console.error('[nft-creator/check-collection]', error);
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : 'Failed to validate collection',
      },
      { status: 500 }
    );
  }
}
