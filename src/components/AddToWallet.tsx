'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TOKEN_ADDRESS, TOKEN_DECIMALS, TOKEN_SYMBOL } from '@/lib/constants';

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function AddToWallet() {
  const [hasWallet, setHasWallet] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setHasWallet(typeof window !== 'undefined' && Boolean(window.ethereum));
  }, []);

  const handleAdd = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: TOKEN_ADDRESS,
            symbol: TOKEN_SYMBOL,
            decimals: TOKEN_DECIMALS,
            image: `${window.location.origin}/favicon.ico`,
          },
        },
      });
      setAdded(true);
    } catch {
      // User rejected or wallet error — no action needed
    }
  }, []);

  if (!hasWallet) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleAdd}
      disabled={added}
      className="gap-1.5 text-xs"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="h-3.5 w-3.5"
      >
        <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
      </svg>
      {added ? 'Added to wallet' : `Add ${TOKEN_SYMBOL} to wallet`}
    </Button>
  );
}
