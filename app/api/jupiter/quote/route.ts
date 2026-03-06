import { NextRequest, NextResponse } from 'next/server';
import { JUPITER_API_BASE } from '@/lib/jupiter/config';
import type { JupiterQuoteResponse } from '@/types/jupiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jupiter/quote?inputMint=...&outputMint=...&amount=...&slippageBps=50
 * Proxies to Jupiter Swap API v1 quote. Keeps API key server-side if set.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Jupiter API key required. Set JUPITER_API_KEY in .env.local (get one at portal.jup.ag)' },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const slippageBps = searchParams.get('slippageBps') || '50';

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing inputMint, outputMint or amount' },
      { status: 400 }
    );
  }

  const url = new URL(`${JUPITER_API_BASE}/swap/v1/quote`);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', amount);
  url.searchParams.set('slippageBps', slippageBps);
  url.searchParams.set('restrictIntermediateTokens', 'true');

  const headers: HeadersInit = { 'Content-Type': 'application/json', 'x-api-key': apiKey };

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text();
      console.error('Jupiter quote error:', res.status, text);
      if (res.status === 401) {
        return NextResponse.json(
          { error: 'Invalid Jupiter API key. Check JUPITER_API_KEY in .env.local (portal.jup.ag)' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Quote failed', details: res.status === 400 ? text : undefined },
        { status: res.status }
      );
    }
    const data = (await res.json()) as JupiterQuoteResponse;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Jupiter quote fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to get quote' },
      { status: 500 }
    );
  }
}
