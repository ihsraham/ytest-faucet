'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { usePostHog } from 'posthog-js/react';
import { type LucideIcon, Droplets, BarChart3, Vote, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  live: boolean;
};

const FEATURES: Feature[] = [
  {
    title: 'Faucet',
    description: 'Get 1,000 YELLOW test tokens with on-chain cooldown and anti-abuse protection.',
    icon: Droplets,
    href: '/faucet',
    live: true,
  },
  {
    title: 'TVL Dashboard',
    description: 'Track Total Value Locked across the Yellow protocol in real-time.',
    icon: BarChart3,
    live: false,
  },
  {
    title: 'Governance',
    description: 'Vote on proposals and shape the direction of the protocol.',
    icon: Vote,
    live: false,
  },
  {
    title: 'Leaderboard',
    description: 'Scout ranks and community standings on the Yellow network.',
    icon: Trophy,
    live: false,
  },
];

function CardShell({ children, href, live }: { children: ReactNode; href?: string; live: boolean }) {
  const classes = cn(
    'feature-glow group relative flex flex-col gap-4 rounded-2xl p-6 transition-all duration-300',
    'glass shadow-glass-light dark:shadow-glass',
    live
      ? 'cursor-pointer hover:-translate-y-1 hover:shadow-glow'
      : 'opacity-50 cursor-default',
  );

  if (href && live) {
    return <Link href={href} className={classes}>{children}</Link>;
  }
  return <div className={classes}>{children}</div>;
}

export function FeatureGrid() {
  const posthog = usePostHog();

  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl"
        style={{ letterSpacing: '-0.02em' }}
      >
        Explore the ecosystem
      </motion.h2>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              delay: index * 0.1,
              type: 'spring',
              stiffness: 200,
              damping: 24,
            }}
          >
            <CardShell href={feature.href} live={feature.live}>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon size={20} />
                </div>
                {feature.live ? (
                  <Badge variant="success" className="text-xs">Live</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                )}
              </div>
              <div>
                <h3 className="mb-1 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
              {feature.live && (
                <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open &rarr;
                </span>
              )}
            </CardShell>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
