/**
 * GET /api/nft-creator/verify-royalties?mint=<mint_address>
 *
 * Returns the on-chain royalty settings for a given NFT mint (Metaplex Token Metadata).
 * Use this to verify that Creator NFTs have 5% royalties set (e.g. after minting on devnet).
 * Works on both devnet and mainnet depending on NEXT_PUBLIC_SOLANA_NETWORK / RPC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, safeFetchMetadataFromSeeds } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi-public-keys';
import { getRpcUrl } from '@/lib/solana/connection';
import { isValidSolanaAddress } from '@/lib/solana/validators';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint')?.trim();
  if (!mint || !isValidSolanaAddress(mint)) {
    return NextResponse.json(
      { error: 'Missing or invalid query parameter: mint (Solana address)' },
      { status: 400 }
    );
  }

  try {
    const rpcUrl = getRpcUrl();
    const umi = createUmi(rpcUrl).use(mplTokenMetadata());
    const metadata = await safeFetchMetadataFromSeeds(umi, { mint: publicKey(mint) });
    if (!metadata) {
      return NextResponse.json(
        { error: 'No Metaplex metadata found for this mint. It may not be an NFT or the RPC may need a moment after mint.' },
        { status: 404 }
      );
    }

    const sellerFeeBasisPoints = metadata.sellerFeeBasisPoints ?? 0;
    const royaltyPercent = sellerFeeBasisPoints / 100;
    // SDK may return creators as array or Option-like { value: [...] }; normalize to array
    const raw = metadata.creators;
    const creatorsList: { address: unknown; share: number; verified: boolean }[] = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' && 'value' in raw && Array.isArray((raw as { value: unknown }).value))
        ? ((raw as { value: { address: unknown; share: number; verified: boolean }[] }).value)
        : [];
    const creators = creatorsList.map((c) => ({
      address: c.address != null && typeof (c.address as { toString?: () => string }).toString === 'function' ? (c.address as { toString: () => string }).toString() : String(c.address),
      share: c.share,
      verified: Boolean(c.verified),
    }));

    return NextResponse.json({
      mint,
      sellerFeeBasisPoints,
      royaltyPercent,
      creators,
      message:
        sellerFeeBasisPoints === 500
          ? '5% royalties are set (sellerFeeBasisPoints: 500).'
          : `Royalties: ${royaltyPercent}% (sellerFeeBasisPoints: ${sellerFeeBasisPoints}).`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Failed to fetch metadata', details: message }, { status: 500 });
  }
}
