import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Providers } from './providers';

import '@solana/wallet-adapter-react-ui/styles.css';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://solcloser.com'),
  title: "SOLcloser - Reclaim Your Locked SOL from Empty Token Accounts",
  description: "Close unused SPL token accounts and recover your rent deposits on Solana. Fast, secure, and transparent. Earn 10% referral rewards.",
  keywords: [
    "reclaim SOL",
    "close token accounts",
    "Solana",
    "SPL token",
    "recover locked SOL",
    "token account rent",
    "Solana wallet cleanup",
    "empty token accounts",
  ],
  authors: [{ name: "SOLcloser" }],
  creator: "SOLcloser",
  publisher: "SOLcloser",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "SOLcloser",
    title: "SOLcloser - Reclaim Your Locked SOL",
    description: "Close unused SPL token accounts and recover your rent deposits on Solana. Fast, secure, transparent.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SOLcloser - Reclaim Your Locked SOL",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SOLcloser - Reclaim Your Locked SOL",
    description: "Close unused SPL token accounts and recover your rent deposits on Solana. Fast, secure, transparent.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
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
      <body className={`${inter.variable} ${orbitron.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
