import { NextRequest, NextResponse } from 'next/server';
import { JUPITER_API_BASE } from '@/lib/jupiter/config';
import type { JupiterQuoteResponse, JupiterSwapResponse } from '@/types/jupiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jupiter/swap
 * Body: { quoteResponse: JupiterQuoteResponse, userPublicKey: string }
 * Proxies to Jupiter Swap API v1 swap. Returns serialized transaction (base64).
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Jupiter API key required. Set JUPITER_API_KEY in .env.local (get one at portal.jup.ag)' },
      { status: 503 }
    );
  }

  let body: { quoteResponse?: JupiterQuoteResponse; userPublicKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { quoteResponse, userPublicKey } = body;
  if (!quoteResponse || typeof userPublicKey !== 'string' || userPublicKey.length < 32) {
    return NextResponse.json(
      { error: 'Missing or invalid quoteResponse / userPublicKey' },
      { status: 400 }
    );
  }

  const url = `${JUPITER_API_BASE}/swap/v1/swap`;
  const headers: HeadersInit = { 'Content-Type': 'application/json', 'x-api-key': apiKey };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Jupiter swap error:', res.status, text);
      return NextResponse.json(
        { error: 'Swap build failed', details: res.status === 400 ? text : undefined },
        { status: res.status }
      );
    }

    const data = (await res.json()) as JupiterSwapResponse;
    if (!data.swapTransaction) {
      return NextResponse.json({ error: 'No swap transaction in response' }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('Jupiter swap fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to build swap transaction' },
      { status: 500 }
    );
  }
}
