[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](http://creativecommons.org/licenses/by-nc-sa/4.0/)

# 🔮 SOLcloser - Reclaim Your Locked SOL

**The most efficient way to reclaim locked SOL from unused token accounts on Solana.**

## 🌟 Features

- 🔍 **Smart Scanner** - Automatically detects empty SPL token accounts
- 🔒 **Safe Closer** - Close accounts and reclaim rent deposits (~0.00204 SOL per account)
- ⚡ **Lightning Fast** - Powered by Helius RPC for optimal performance
- 💎 **Token-2022 Support** - Works with both SPL and Token-2022 programs
- 🎁 **Referral System** - Earn 10% of SOL reclaimed by referred users
- 📊 **Real-time Stats** - Live leaderboard and personal dashboard

## 🚀 Quick Start

### Installation
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/sol-closer.git
cd sol-closer

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your keys
nano .env.local

# Run development server
npm run dev
```

## 🔧 Configuration

Create a `.env.local` file with:

- Helius RPC API key
- Supabase project URL and anon key
- Your fee recipient wallet address

## 📊 How It Works

1. **Connect Wallet** - Use Phantom, Solflare, or any Solana wallet
2. **Scan Accounts** - We find all your empty SPL token accounts
3. **Select & Close** - Choose which accounts to close
4. **Receive SOL** - Instantly reclaim your rent deposits (minus 15% service fee)

## 🏗️ Tech Stack

- Next.js 15, React, TypeScript
- Tailwind CSS
- Solana Web3.js, SPL Token, Token-2022
- Supabase (PostgreSQL)
- Helius RPC

## 🛡️ Security

- ✅ Your keys never leave your wallet
- ✅ All transactions require your explicit approval
- ✅ Only empty accounts can be closed
- ✅ Open source and auditable

## ⚠️ Disclaimer

This tool is provided as-is. Always verify transactions before signing.

**Built with 💜 on Solana**

<!-- Force redeploy for cron -->

