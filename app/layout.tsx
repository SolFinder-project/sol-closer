import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MobileDevBanner from "@/components/ui/MobileDevBanner";

import "@solana/wallet-adapter-react-ui/styles.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://solcloser.com'),
  title: "SolPit - Reclaim. Refuel. Race.",
  description: "Reclaim SOL from empty accounts, dust, Burn NFT, Pump PDA, PumpSwap PDA, Drift, cNFT close. Weekly F1 race: earn points, best lap wins. Create F1-themed NFTs from your reclaims. Stake with PSOL or Marinade, or swap with Jupiter. 10% referral.",
  keywords: [
    "reclaim SOL",
    "close token accounts",
    "Burn NFT",
    "cNFT close",
    "Solana",
    "F1 race",
    "NFT Creator",
    "SPL token",
    "recover locked SOL",
    "Solana wallet cleanup",
    "empty token accounts",
  ],
  authors: [{ name: "SolPit" }],
  creator: "SolPit",
  publisher: "SolPit",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "SolPit",
    title: "SolPit - Reclaim. Refuel. Race.",
    description: "Reclaim SOL from empty accounts, dust, Burn NFT, Pump PDA, Drift, cNFT close. Weekly F1 race; create F1-themed NFTs. Stake with PSOL or Marinade, or swap in-app.",
    images: [
      {
        url: "/og-image.png",
        width: 1024,
        height: 338,
        alt: "SolPit — reclaim locked SOL, race weekly, mint, earn",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SolPit - Reclaim. Refuel. Race.",
    description: "Reclaim SOL from empty accounts, dust, Burn NFT, Pump PDA, Drift, cNFT close. Weekly F1 race; create F1-themed NFTs. Stake with PSOL or Marinade, or swap in-app.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${orbitron.variable} antialiased overflow-x-hidden`}>
        <Providers>
          <MobileDevBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
