import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
  weight: ['400', '500'],
});

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: 'YELLOW Faucet',
  description: 'YELLOW test token faucet for Ethereum Sepolia with on-chain cooldown and anti-abuse protections.',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: 'YELLOW Faucet — Sepolia Testnet',
    description: 'Request 1,000 YELLOW test tokens on Sepolia. On-chain cooldown, Turnstile CAPTCHA, and rate limiting.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'YELLOW Faucet' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YELLOW Faucet — Sepolia Testnet',
    description: 'Request 1,000 YELLOW test tokens on Sepolia.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
