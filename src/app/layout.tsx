import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { Navbar } from '@/components/Navbar';
import { PostHogProvider } from '@/components/PostHogProvider';
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
  title: {
    default: 'YellowScout — Yellow Community Portal',
    template: '%s | YellowScout',
  },
  description: 'Community-led portal for the Yellow protocol. Faucet, TVL, Governance, Leaderboard.',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: 'YellowScout — Your Gateway to the Yellow Ecosystem',
    description: 'Community-led portal for the Yellow protocol. Faucet, TVL, Governance, Leaderboard.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'YellowScout' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YellowScout — Yellow Community Portal',
    description: 'Community-led portal for the Yellow protocol. Faucet, TVL, Governance, Leaderboard.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased`}>
        <PostHogProvider>
          <Navbar />
          {children}
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
