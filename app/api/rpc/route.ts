/**
 * RPC proxy: forwards JSON-RPC POST from the client to Helius with the API key on the server.
 * This avoids sending the Helius key from the browser and bypasses Allowed Domains / 401 issues.
 */

import { NextRequest, NextResponse } from 'next/server';

const HELIUS_MAINNET = 'https://mainnet.helius-rpc.com';
const HELIUS_DEVNET = 'https://devnet.helius-rpc.com';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getHeliusUrl(): string | null {
  const key = process.env.HELIUS_API_KEY?.trim() || process.env.NEXT_PUBLIC_HELIUS_API_KEY?.trim();
  if (!key) return null;
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
  const base = network === 'mainnet-beta' ? HELIUS_MAINNET : HELIUS_DEVNET;
  return `${base}/?api-key=${key}`;
}

export async function POST(request: NextRequest) {
  const url = getHeliusUrl();
  if (!url) {
    return NextResponse.json(
      { error: 'RPC proxy misconfiguration: HELIUS_API_KEY or NEXT_PUBLIC_HELIUS_API_KEY required' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[api/rpc] proxy error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'RPC proxy failed' },
      { status: 502 }
    );
  }
}
