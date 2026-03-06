import { NextResponse } from 'next/server';
import { formatUnits } from 'viem';
import {
  FaucetConfigurationError,
  getFaucetAddress,
  getFaucetContractBalance,
  getOnChainCooldown,
  getOnChainDripAmount,
} from '@/lib/blockchain';
import {
  CHAIN,
  DRIP_AMOUNT,
  FAUCET_CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from '@/lib/constants';
import { isRedisConfigured, snapshotBalance } from '@/lib/ratelimit';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const faucetAddress = getFaucetAddress();

    const [contractBalanceRaw, onChainDripAmount, onChainCooldown] = await Promise.all([
      getFaucetContractBalance(),
      getOnChainDripAmount(),
      getOnChainCooldown(),
    ]);

    const formattedBalance = formatUnits(contractBalanceRaw, TOKEN_DECIMALS);
    void snapshotBalance(formattedBalance);

    return NextResponse.json({
      success: true,
      health: 'ok',
      chainId: CHAIN.id,
      chainName: CHAIN.name,
      faucetAddress,
      faucetContractAddress: FAUCET_CONTRACT_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      tokenSymbol: TOKEN_SYMBOL,
      tokenDecimals: TOKEN_DECIMALS,
      faucetBalance: formattedBalance,
      faucetBalanceRaw: contractBalanceRaw.toString(),
      dripAmount: DRIP_AMOUNT,
      onChainDripAmount: formatUnits(onChainDripAmount, TOKEN_DECIMALS),
      cooldownSeconds: Number(onChainCooldown),
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
        faucetContractAddress: FAUCET_CONTRACT_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
        tokenSymbol: TOKEN_SYMBOL,
        dripAmount: DRIP_AMOUNT,
        cooldownSeconds: 86_400,
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
