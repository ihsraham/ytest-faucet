'use client';

import { Badge } from '@/components/ui/badge';
import { CooldownTimer } from '@/components/CooldownTimer';
import { ETHERSCAN_TX_URL } from '@/lib/constants';

export type FaucetUiStatus = {
  kind: 'idle' | 'loading' | 'success' | 'error' | 'cooldown';
  message?: string;
  txHash?: string;
  retryAfter?: number;
};

type TransactionStatusProps = {
  status: FaucetUiStatus;
  onCooldownExpire?: () => void;
};

export function TransactionStatus({ status, onCooldownExpire }: TransactionStatusProps) {
  if (status.kind === 'idle') {
    return null;
  }

  if (status.kind === 'loading') {
    return (
      <div className="animate-fade-in-up rounded-md border border-border/70 bg-muted/40 px-4 py-3 text-sm">
        <Badge variant="warning" className="mb-2">
          Pending
        </Badge>
        <p>Submitting your faucet request on Sepolia...</p>
      </div>
    );
  }

  if (status.kind === 'success') {
    return (
      <div className="animate-fade-in-up rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
        <Badge variant="success" className="mb-2">
          Success
        </Badge>
        <p className="mb-2">{status.message}</p>
        {status.txHash && (
          <a
            className="font-medium underline decoration-dotted underline-offset-4"
            href={ETHERSCAN_TX_URL(status.txHash)}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        )}
      </div>
    );
  }

  if (status.kind === 'cooldown') {
    return (
      <div className="animate-fade-in-up rounded-md border border-amber-500/45 bg-amber-500/10 px-4 py-3 text-sm">
        <Badge variant="warning" className="mb-2">
          Cooldown
        </Badge>
        <p className="mb-2">{status.message}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Retry in
          <CooldownTimer initialSeconds={status.retryAfter ?? 0} onExpire={onCooldownExpire} />
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up rounded-md border border-red-500/45 bg-red-500/10 px-4 py-3 text-sm">
      <Badge variant="danger" className="mb-2">
        Error
      </Badge>
      <p>{status.message}</p>
    </div>
  );
}
