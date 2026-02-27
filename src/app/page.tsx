'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaucetForm } from '@/components/FaucetForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ETHERSCAN_TOKEN_URL, TOKEN_ADDRESS, TOKEN_SYMBOL } from '@/lib/constants';

type StatusResponse = {
  success: boolean;
  health: 'ok' | 'degraded';
  message?: string;
  faucetAddress?: string;
  faucetBalance?: string;
  tokenAddress: string;
  checks: {
    redisConfigured: boolean;
    turnstileConfigured: boolean;
  };
};

export default function HomePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as StatusResponse;
      setStatus(payload);
    } catch {
      setStatus({
        success: false,
        health: 'degraded',
        message: 'Failed to reach faucet status endpoint.',
        tokenAddress: TOKEN_ADDRESS,
        checks: {
          redisConfigured: false,
          turnstileConfigured: false,
        },
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = window.setInterval(() => {
      void fetchStatus();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  const balanceLabel = useMemo(() => {
    if (!status || !status.success || !status.faucetBalance) {
      return '--';
    }

    const numericBalance = Number(status.faucetBalance);
    if (!Number.isFinite(numericBalance)) {
      return status.faucetBalance;
    }

    return numericBalance.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  }, [status]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[8%] h-60 w-60 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute bottom-[8%] right-[12%] h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card className="animate-fade-in-up border-primary/25">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
            <div className="space-y-3">
              <Badge variant="outline" className="w-fit">
                Sepolia ERC20 Faucet
              </Badge>
              <CardTitle className="text-3xl tracking-tight sm:text-4xl">{TOKEN_SYMBOL} Faucet</CardTitle>
              <p className="max-w-xl text-sm text-muted-foreground">
                Request test tokens with layered abuse protection: Turnstile, per-IP throttling,
                device fingerprint checks, wallet cooldowns, and global rate controls.
              </p>
            </div>
            <ThemeToggle />
          </CardHeader>
          <CardContent className="space-y-5">
            <FaucetForm onRequestComplete={fetchStatus} />
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2 border-t border-border/60 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium">
                Faucet balance:{' '}
                <span className="font-mono">
                  {statusLoading ? 'Loading...' : `${balanceLabel} ${TOKEN_SYMBOL}`}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Token:{' '}
                <a
                  href={ETHERSCAN_TOKEN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-4"
                >
                  {status?.tokenAddress ?? TOKEN_ADDRESS}
                </a>
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
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
