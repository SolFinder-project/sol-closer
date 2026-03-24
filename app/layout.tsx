import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MobileDevBanner from "@/components/ui/MobileDevBanner";
import { getSiteUrl } from "@/lib/seo/siteUrl";

import "@solana/wallet-adapter-react-ui/styles.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const appUrl = getSiteUrl();

const metaDescription =
  "SolPit: reclaim SOL from empty token accounts, dust, and more on Solana. Weekly F1 league, points and lap bonuses. SolPit Creator NFTs with tier-based utility (reclaim fee, referral, F1). Stake with PSOL or Marinade, or swap with Jupiter.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "SolPit - Reclaim. Refuel. Race.",
  description: metaDescription,
  keywords: [
    "SolPit",
    "reclaim SOL",
    "Solana",
    "close token accounts",
    "Burn NFT",
    "cNFT",
    "F1 race",
    "SolPit Creator NFT",
    "NFT Creator",
    "SPL token",
    "recover locked SOL",
    "wallet cleanup",
    "Jupiter swap",
  ],
  authors: [{ name: "SolPit" }],
  creator: "SolPit",
  publisher: "SolPit",
  alternates: {
    canonical: appUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: appUrl,
    locale: "en_US",
    siteName: "SolPit",
    title: "SolPit - Reclaim. Refuel. Race.",
    description: metaDescription,
    images: [
      {
        url: "/og-image.png?v=5",
        width: 1024,
        height: 574,
        alt: "SolPit — reclaim SOL on Solana, F1 league, Creator NFTs",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SolPit - Reclaim. Refuel. Race.",
    description: metaDescription,
    images: ["/og-image.png?v=5"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/favicon-32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png?v=3", sizes: "16x16", type: "image/png" },
      { url: "/favicon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" },
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
