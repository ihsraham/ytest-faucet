'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAddress } from 'viem';
import { TransactionStatus, type FaucetUiStatus } from '@/components/TransactionStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DRIP_AMOUNT, TOKEN_SYMBOL } from '@/lib/constants';
import { generateDeviceFingerprint } from '@/lib/fingerprint';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'auto' | 'light' | 'dark';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type FaucetFormProps = {
  onRequestComplete?: () => void;
};

type DripResponse = {
  success: boolean;
  message?: string;
  txHash?: string;
  retryAfter?: number;
};

export function FaucetForm({ onRequestComplete }: FaucetFormProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [address, setAddress] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [status, setStatus] = useState<FaucetUiStatus>({ kind: 'idle' });

  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const addressTrimmed = address.trim();
  const addressHasError = useMemo(
    () => Boolean(addressTrimmed) && !isAddress(addressTrimmed),
    [addressTrimmed],
  );

  const isSubmitting = status.kind === 'loading';

  useEffect(() => {
    generateDeviceFingerprint()
      .then((nextFingerprint) => {
        setFingerprint(nextFingerprint);
      })
      .catch(() => {
        setFingerprint('fingerprint_unavailable');
      });
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!siteKey || !window.turnstile || !turnstileContainerRef.current || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: siteKey,
      theme: 'auto',
      callback: (token: string) => {
        setTurnstileToken(token);
      },
      'expired-callback': () => {
        setTurnstileToken(null);
      },
      'error-callback': () => {
        setTurnstileToken(null);
      },
    });
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    if (window.turnstile) {
      renderTurnstile();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', renderTurnstile);
      return () => existingScript.removeEventListener('load', renderTurnstile);
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.addEventListener('load', renderTurnstile);
    document.head.appendChild(script);

    return () => script.removeEventListener('load', renderTurnstile);
  }, [renderTurnstile, siteKey]);

  const resetTurnstile = useCallback(() => {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setTurnstileToken(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!turnstileToken) {
        setStatus({
          kind: 'error',
          message: 'Complete the Turnstile challenge before requesting tokens.',
        });
        return;
      }

      if (!isAddress(addressTrimmed)) {
        setStatus({
          kind: 'error',
          message: 'Enter a valid Ethereum address.',
        });
        return;
      }

      setStatus({ kind: 'loading' });

      try {
        const response = await fetch('/api/drip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: addressTrimmed,
            turnstileToken,
            fingerprint,
          }),
        });

        const payload = (await response.json()) as DripResponse;

        if (response.ok && payload.success && payload.txHash) {
          setStatus({
            kind: 'success',
            message: payload.message ?? `${DRIP_AMOUNT} ${TOKEN_SYMBOL} sent!`,
            txHash: payload.txHash,
          });
          setAddress('');
          onRequestComplete?.();
          resetTurnstile();
          return;
        }

        if (response.status === 429) {
          setStatus({
            kind: 'cooldown',
            message: payload.message ?? 'Rate limit hit. Please wait before trying again.',
            retryAfter: Number(payload.retryAfter ?? 60),
          });
          resetTurnstile();
          return;
        }

        setStatus({
          kind: 'error',
          message: payload.message ?? 'Faucet request failed.',
        });
        resetTurnstile();
      } catch {
        setStatus({
          kind: 'error',
          message: 'Network error while requesting faucet tokens.',
        });
        resetTurnstile();
      }
    },
    [addressTrimmed, fingerprint, onRequestComplete, resetTurnstile, turnstileToken],
  );

  const submitDisabled =
    isSubmitting || !siteKey || !turnstileToken || !addressTrimmed || Boolean(addressHasError);

  return (
    <Card className="border-primary/25 shadow-glow animate-fade-in-up">
      <CardHeader className="space-y-2">
        <CardTitle>Request Test Tokens</CardTitle>
        <CardDescription>
          Fixed drip amount: {DRIP_AMOUNT} {TOKEN_SYMBOL} on Sepolia. One request every 4 hours per wallet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              Wallet Address
            </label>
            <Input
              id="address"
              type="text"
              placeholder="0x..."
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {addressHasError && <p className="text-xs text-red-400">Address format looks invalid.</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Human Verification</p>
            {siteKey ? (
              <div
                ref={turnstileContainerRef}
                className="min-h-[66px] rounded-md border border-input/70 bg-background/60 p-2"
              />
            ) : (
              <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Missing <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={submitDisabled}>
            {isSubmitting ? 'Submitting request...' : `Request ${DRIP_AMOUNT} ${TOKEN_SYMBOL}`}
          </Button>
        </form>

        <div className="mt-4">
          <TransactionStatus
            status={status}
            onCooldownExpire={() => {
              setStatus({ kind: 'idle' });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
