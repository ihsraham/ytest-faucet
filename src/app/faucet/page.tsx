'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { AddToWallet } from '@/components/AddToWallet';
import { FaucetForm } from '@/components/FaucetForm';
import { Badge } from '@/components/ui/badge';
import { Footer } from '@/components/Footer';
import {
  ETHERSCAN_CONTRACT_URL,
  ETHERSCAN_TOKEN_URL,
  FAUCET_CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_SYMBOL,
} from '@/lib/constants';

type StatusResponse = {
  success: boolean;
  health: 'ok' | 'degraded';
  message?: string;
  faucetBalance?: string;
  tokenAddress: string;
  onChainDripAmount?: string;
  cooldownSeconds?: number;
  checks: {
    redisConfigured: boolean;
    turnstileConfigured: boolean;
  };
};

export default function FaucetPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      const payload = (await response.json()) as StatusResponse;
      setStatus(payload);
    } catch {
      setStatus({
        success: false,
        health: 'degraded',
        message: 'Failed to reach faucet status endpoint.',
        tokenAddress: TOKEN_ADDRESS,
        checks: { redisConfigured: false, turnstileConfigured: false },
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = window.setInterval(() => void fetchStatus(), 30_000);
    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  const balanceLabel = useMemo(() => {
    if (!status?.success || !status.faucetBalance) return '--';
    const n = Number(status.faucetBalance);
    if (!Number.isFinite(n)) return status.faucetBalance;
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }, [status]);

  const cooldownLabel = useMemo(() => {
    if (!status?.cooldownSeconds) return '24h';
    const h = Math.floor(status.cooldownSeconds / 3600);
    const m = Math.floor((status.cooldownSeconds % 3600) / 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }, [status]);

  return (
    <>
      <div className="relative min-h-screen px-4 pb-8 pt-24 sm:px-6">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[12%] top-[8%] h-60 w-60 rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute bottom-[8%] right-[12%] h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
          <div className="grid-pattern absolute inset-0 opacity-40 dark:opacity-20" />
        </div>

        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mx-auto mb-6 flex max-w-2xl items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">YellowScout</Link>
          <ChevronRight size={14} />
          <span className="text-foreground">Faucet</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.05 }}
          className="mx-auto max-w-2xl"
        >
          <div className="glass rounded-2xl shadow-glass-light dark:shadow-glass">
            {/* Header */}
            <div className="space-y-4 border-b border-border/40 p-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <Image
                    src="/logo-light.png"
                    alt="Yellow"
                    width={140}
                    height={42}
                    className="h-9 w-auto dark:hidden"
                    priority
                  />
                  <Image
                    src="/logo-dark.png"
                    alt="Yellow"
                    width={140}
                    height={42}
                    className="hidden h-9 w-auto dark:block"
                    priority
                  />
                  <Badge variant="outline" className="w-fit text-xs">Sepolia Testnet</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {TOKEN_SYMBOL} Faucet
                </h1>
                <p className="text-sm text-muted-foreground">
                  Request {TOKEN_SYMBOL} test tokens on Sepolia. Protected by Turnstile CAPTCHA,
                  per-IP throttling, device fingerprinting, and on-chain cooldown ({cooldownLabel}).
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="p-6">
              <FaucetForm
                onRequestComplete={fetchStatus}
                dripAmount={
                  status?.onChainDripAmount
                    ? Number(status.onChainDripAmount).toLocaleString()
                    : undefined
                }
              />
            </div>

            {/* Footer stats */}
            <div className="flex flex-col gap-3 border-t border-border/40 p-6 pt-4 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">
                    Contract balance:{' '}
                    <span className="font-mono">
                      {statusLoading ? 'Loading...' : `${balanceLabel} ${TOKEN_SYMBOL}`}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Drip:{' '}
                    <span className="font-mono">
                      {status?.onChainDripAmount
                        ? `${Number(status.onChainDripAmount).toLocaleString()} ${TOKEN_SYMBOL}`
                        : `-- ${TOKEN_SYMBOL}`}
                    </span>
                    {' / '}
                    {cooldownLabel} cooldown
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={status?.health === 'ok' ? 'success' : 'danger'}>
                    {status?.health === 'ok' ? 'Healthy' : 'Degraded'}
                  </Badge>
                  <Badge variant={status?.checks?.redisConfigured ? 'secondary' : 'warning'}>
                    Redis {status?.checks?.redisConfigured ? 'ok' : 'off'}
                  </Badge>
                  <Badge variant={status?.checks?.turnstileConfigured ? 'secondary' : 'warning'}>
                    Turnstile {status?.checks?.turnstileConfigured ? 'ok' : 'off'}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Token:{' '}
                    <a
                      href={ETHERSCAN_TOKEN_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-4"
                    >
                      {TOKEN_ADDRESS.slice(0, 6)}...{TOKEN_ADDRESS.slice(-4)}
                    </a>
                  </p>
                  <p>
                    Faucet:{' '}
                    <a
                      href={ETHERSCAN_CONTRACT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-4"
                    >
                      {FAUCET_CONTRACT_ADDRESS.slice(0, 6)}...{FAUCET_CONTRACT_ADDRESS.slice(-4)}
                    </a>
                  </p>
                </div>
                <AddToWallet />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </>
  );
}
