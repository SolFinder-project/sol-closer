[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](http://creativecommons.org/licenses/by-nc-sa/4.0/)

# SolPit – Reclaim SOL, Race F1, Create NFTs

**Reclaim locked SOL from empty token accounts, dust, Pump/PumpSwap PDAs, Drift, NFT burn & cNFT close. Weekly F1 race, SolPit NFT Creator, referral, swap & stake — all in one app.**

## Features

- **Reclaim** – Empty SPL/Token-2022 accounts, dust (burn + close), Pump.fun & PumpSwap PDAs, Drift accounts, NFT burn, cNFT close. Full reclaim in one transaction.
- **F1 weekly race** – Earn points from reclaims, compete in leagues (Bronze/Silver/Gold), best lap wins.
- **NFT Creator** – Mint F1-themed NFTs from eligible reclaims; verified collection, royalties, tier benefits.
- **Referral** – Earn a share of SOL reclaimed by referred users.
- **Swap & stake** – Jupiter swap after reclaim; stake with PSOL (Phantom) or Marinade.
- **Dashboard** – Real-time stats, leaderboard, transaction history, wallet health.

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/sol-reclaimer.git
cd sol-reclaimer

npm install
cp .env.example .env.local
# Edit .env.local with your keys (Supabase, Helius, fee recipient, etc.)

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Copy the example env and fill in your values:

```bash
cp .env.example .env.local
```

**Required for core reclaim & app:**

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_HELIUS_API_KEY` (or `NEXT_PUBLIC_SOLANA_RPC_URL`)
- `NEXT_PUBLIC_SOLANA_NETWORK` (`mainnet-beta` or `devnet`)
- `NEXT_PUBLIC_FEE_RECIPIENT_WALLET`
- `NEXT_PUBLIC_APP_URL` (e.g. `https://yoursite.com` in production)

**Required for F1 game:** `NEXT_PUBLIC_F1_TREASURY_WALLET`, `F1_ADMIN_SECRET`  
**Required for NFT Creator (verified collection):** `NFT_CREATOR_COLLECTION_MINT`, `NFT_CREATOR_COLLECTION_AUTHORITY`, admin secret  
**Required for swap:** `JUPITER_API_KEY`, `NEXT_PUBLIC_JUPITER_API_KEY`  
**Required for crons (Vercel):** `CRON_SECRET`

See **`.env.example`** for the full list and optional variables (Rugcheck, Google Sheets, etc.).

## Tech stack

- **Next.js** (App Router), React, TypeScript, Tailwind CSS
- **Solana** – Web3.js, SPL Token, Token-2022, Helius RPC
- **Supabase** – PostgreSQL, auth, RLS
- **Jupiter** (swap), **Marinade / PSOL** (stake), **Drift**, **Metaplex** (NFT Creator)

## Security

- Your keys never leave your wallet; all transactions require your signature.
- Sensitive env (service role, admin secrets, collection authority) are server-side only.
- `.env.local` and `/scripts/` are in `.gitignore` — never commit secrets.

## Disclaimer

This tool is provided as-is. Always verify transactions before signing. Reclaim and F1 features involve on-chain actions and fees.

**Built on Solana**
