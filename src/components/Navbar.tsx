'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, AnimatePresence } from 'motion/react';
import { BarChart3, Droplets, Github, Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/faucet', label: 'Faucet', icon: Droplets },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
] as const;

const COMING_SOON = ['TVL', 'Governance', 'Leaderboard'] as const;

export function Navbar() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible(latest > 60);
  });

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <motion.header
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
      className="fixed inset-x-0 top-0 z-50 transition-opacity duration-300"
    >
      <nav className="glass border-b border-border/40 px-4 sm:px-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-light.png"
              alt="YellowScout"
              width={120}
              height={36}
              className="h-7 w-auto dark:hidden"
            />
            <Image
              src="/logo-dark.png"
              alt="YellowScout"
              width={120}
              height={36}
              className="hidden h-7 w-auto dark:block"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
            {COMING_SOON.map((label) => (
              <span
                key={label}
                className="cursor-default rounded-md px-3 py-1.5 text-sm text-muted-foreground/40"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <a
              href="https://github.com/yellow-scout"
              target="_blank"
              rel="noreferrer"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github size={18} />
            </a>
            <ThemeToggle />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="rounded-md p-2 text-muted-foreground sm:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="glass overflow-hidden border-b border-border/40 sm:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobile}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    pathname === link.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                <a
                  href="https://github.com/yellow-scout"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-2 text-muted-foreground"
                >
                  <Github size={18} />
                </a>
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
