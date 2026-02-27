import { NextResponse } from 'next/server';
import {
  FaucetConfigurationError,
  getFaucetAddress,
  getTokenBalance,
} from '@/lib/blockchain';
import {
  CHAIN,
  COOLDOWN_SECONDS,
  DRIP_AMOUNT,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from '@/lib/constants';
import { isRedisConfigured } from '@/lib/ratelimit';
import { formatUnits } from 'viem';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const faucetAddress = getFaucetAddress();
    const tokenBalanceRaw = await getTokenBalance(faucetAddress);

    return NextResponse.json({
      success: true,
      health: 'ok',
      chainId: CHAIN.id,
      chainName: CHAIN.name,
      faucetAddress,
      tokenAddress: TOKEN_ADDRESS,
      tokenSymbol: TOKEN_SYMBOL,
      tokenDecimals: TOKEN_DECIMALS,
      faucetBalance: formatUnits(tokenBalanceRaw, TOKEN_DECIMALS),
      faucetBalanceRaw: tokenBalanceRaw.toString(),
      dripAmount: DRIP_AMOUNT,
      cooldownSeconds: COOLDOWN_SECONDS,
      checks: {
        redisConfigured: isRedisConfigured(),
        turnstileConfigured: Boolean(
          process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        ),
      },
    });
  } catch (error) {
    const message =
      error instanceof FaucetConfigurationError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'unknown_error';

    return NextResponse.json(
      {
        success: false,
        health: 'degraded',
        message,
        chainId: CHAIN.id,
        chainName: CHAIN.name,
        tokenAddress: TOKEN_ADDRESS,
        tokenSymbol: TOKEN_SYMBOL,
        dripAmount: DRIP_AMOUNT,
        cooldownSeconds: COOLDOWN_SECONDS,
        checks: {
          redisConfigured: isRedisConfigured(),
          turnstileConfigured: Boolean(
            process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          ),
        },
      },
      { status: 503 },
    );
  }
}
