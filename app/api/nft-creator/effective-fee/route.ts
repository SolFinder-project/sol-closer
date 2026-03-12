/**
 * GET /api/nft-creator/effective-fee?wallet=<payer>&referrer=<referrer>
 *
 * Returns effective reclaim fee % (for payer) and referral % (for referrer) based on Creator tier.
 * Used by reclaim UI and closers to apply tier-based fee/referral rates.
 * Uses request Origin/Referer to call DAS via the app's RPC proxy so Helius Allowed Domains accept the request.
 * wallet = paying wallet (reclaiming); referrer = referrer wallet (optional).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEffectiveReclaimFeePercent,
  getEffectiveReferralPercent,
} from '@/lib/nftCreator';
import { isValidSolanaAddress } from '@/lib/solana/validators';

export const dynamic = 'force-dynamic';

/** Build proxy RPC options from request so DAS works when route runs on server (avoids 401 / Allowed Domains). */
function dasOptionsFromRequest(request: NextRequest): { rpcUrl: string; fetch: (url: string, init?: RequestInit) => Promise<Response> } | undefined {
  const origin = request.headers.get('origin')?.trim();
  const referer = request.headers.get('referer')?.trim();
  const baseUrl = origin || (referer ? (() => { try { return new URL(referer).origin; } catch { return ''; } })() : '');
  if (!baseUrl) return undefined;
  const rpcUrl = `${baseUrl.replace(/\/$/, '')}/api/rpc`;
  const customFetch: (url: string, init?: RequestInit) => Promise<Response> = (url, init) =>
    fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(origin && { Origin: origin }), ...(referer && { Referer: referer }) } });
  return { rpcUrl, fetch: customFetch };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet')?.trim();
  const referrer = searchParams.get('referrer')?.trim();

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json(
      { error: 'Missing or invalid query parameter: wallet (Solana address)' },
      { status: 400 }
    );
  }

  const defaultFee = Number(process.env.NEXT_PUBLIC_SERVICE_FEE_PERCENTAGE || 20);
  const defaultReferral = Number(process.env.NEXT_PUBLIC_REFERRAL_FEE_PERCENTAGE || 10);
  const dasOpts = dasOptionsFromRequest(request);

  try {
    const [feePercent, referralPercent] = await Promise.all([
      getEffectiveReclaimFeePercent(wallet, dasOpts),
      referrer && isValidSolanaAddress(referrer)
        ? getEffectiveReferralPercent(referrer, dasOpts)
        : Promise.resolve(defaultReferral),
    ]);

    return NextResponse.json({
      feePercent,
      referralPercent,
    });
  } catch (e) {
    console.error('[nft-creator/effective-fee]', e);
    // Return defaults so reclaim flow is not blocked (e.g. RPC 401 / tier fetch failure).
    return NextResponse.json({
      feePercent: defaultFee,
      referralPercent: defaultReferral,
    });
  }
}
