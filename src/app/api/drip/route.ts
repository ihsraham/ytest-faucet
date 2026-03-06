import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import {
  FaucetConfigurationError,
  FaucetCooldownError,
  FaucetDryError,
  FaucetRecipientError,
  getOnChainCooldown,
  getOnChainCooldownRemaining,
  getOnChainDripAmount,
  isContractAddress,
  normalizeAddress,
  sendDripTransaction,
} from '@/lib/blockchain';
import { TOKEN_DECIMALS, TOKEN_SYMBOL } from '@/lib/constants';
import {
  checkFingerprintLimit,
  checkGlobalLimit,
  checkIpLimit,
  getAddressCooldown,
  getClientIp,
  logDripAttempt,
  recordDripMetric,
  recordRejectionMetric,
  setAddressCooldown,
} from '@/lib/ratelimit';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { trackServerEvent } from '@/lib/analytics';

export const runtime = 'nodejs';

type DripRequest = {
  address?: string;
  turnstileToken?: string;
  fingerprint?: string;
};

function json(status: number, payload: Record<string, unknown>) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);

  let body: DripRequest;
  try {
    body = (await request.json()) as DripRequest;
  } catch {
    return json(400, {
      success: false,
      message: 'Invalid JSON payload.',
    });
  }

  try {
    const addressInput = body.address?.trim() ?? '';
    const turnstileToken = body.turnstileToken?.trim() ?? '';
    const fingerprint = body.fingerprint?.trim() || `ip:${ip}`;

    if (!addressInput || !turnstileToken) {
      return json(400, {
        success: false,
        message: 'Address and Turnstile token are required.',
      });
    }

    if (!isAddress(addressInput)) {
      return json(400, {
        success: false,
        message: 'Invalid Ethereum address.',
      });
    }

    const captcha = await verifyTurnstileToken(turnstileToken, ip);
    if (!captcha.success) {
      trackServerEvent('drip_rejected_captcha', { address: addressInput });
      void recordRejectionMetric('captcha');
      return json(403, {
        success: false,
        message: 'CAPTCHA verification failed.',
        reason: 'captcha_failed',
        details: captcha.errors,
      });
    }

    const ipLimit = await checkIpLimit(ip);
    if (!ipLimit.success) {
      trackServerEvent('drip_rejected_ip_limit', { address: addressInput });
      void recordRejectionMetric('ip_limit');
      return json(429, {
        success: false,
        message: 'Too many requests from your IP. Try again later.',
        reason: 'ip_rate_limited',
        retryAfter: ipLimit.retryAfterSeconds,
      });
    }

    const fingerprintLimit = await checkFingerprintLimit(fingerprint);
    if (!fingerprintLimit.success) {
      trackServerEvent('drip_rejected_fingerprint', { address: addressInput });
      void recordRejectionMetric('fingerprint');
      return json(429, {
        success: false,
        message: 'Too many requests from this device. Try again later.',
        reason: 'fingerprint_rate_limited',
        retryAfter: fingerprintLimit.retryAfterSeconds,
      });
    }

    const recipientAddress = normalizeAddress(addressInput);

    const contractTarget = await isContractAddress(recipientAddress);
    if (contractTarget) {
      trackServerEvent('drip_rejected_contract', { address: recipientAddress });
      void recordRejectionMetric('contract');
      return json(400, {
        success: false,
        message: 'Contract addresses are not eligible. Use an EOA wallet address.',
      });
    }

    const cooldownSeconds = await getAddressCooldown(recipientAddress);
    if (cooldownSeconds > 0) {
      trackServerEvent('drip_rejected_cooldown_redis', { address: recipientAddress, retryAfter: cooldownSeconds });
      void recordRejectionMetric('cooldown_redis');
      return json(429, {
        success: false,
        message: 'This wallet is on cooldown.',
        reason: 'address_cooldown',
        retryAfter: cooldownSeconds,
      });
    }

    const onChainCooldown = await getOnChainCooldownRemaining(recipientAddress);
    if (onChainCooldown > 0) {
      trackServerEvent('drip_rejected_cooldown_onchain', { address: recipientAddress, retryAfter: onChainCooldown });
      void recordRejectionMetric('cooldown_onchain');
      return json(429, {
        success: false,
        message: 'This wallet is on cooldown (on-chain).',
        reason: 'address_cooldown',
        retryAfter: onChainCooldown,
      });
    }

    const globalLimit = await checkGlobalLimit();
    if (!globalLimit.success) {
      trackServerEvent('drip_rejected_global_limit', { address: recipientAddress });
      void recordRejectionMetric('global_limit');
      return json(429, {
        success: false,
        message: 'Faucet is currently busy. Please try again later.',
        reason: 'global_rate_limited',
        retryAfter: globalLimit.retryAfterSeconds,
      });
    }

    const [{ txHash }, onChainCooldownPeriod, onChainDripRaw] = await Promise.all([
      sendDripTransaction(recipientAddress),
      getOnChainCooldown(),
      getOnChainDripAmount(),
    ]);

    const { formatUnits } = await import('viem');
    const dripAmountFormatted = Number(formatUnits(onChainDripRaw, TOKEN_DECIMALS)).toLocaleString();

    await Promise.all([
      setAddressCooldown(recipientAddress, txHash, Number(onChainCooldownPeriod)),
      logDripAttempt({ ip, address: recipientAddress, txHash, fingerprint }),
      recordDripMetric(recipientAddress),
    ]);

    trackServerEvent('drip_completed', {
      address: recipientAddress,
      txHash,
      amount: dripAmountFormatted,
    });

    return json(200, {
      success: true,
      txHash,
      amount: dripAmountFormatted,
      message: `${dripAmountFormatted} ${TOKEN_SYMBOL} sent!`,
    });
  } catch (error) {
    if (error instanceof FaucetRecipientError) {
      return json(400, { success: false, message: error.message });
    }

    if (error instanceof FaucetCooldownError) {
      trackServerEvent('drip_rejected_cooldown_onchain', { retryAfter: error.remainingSeconds });
      void recordRejectionMetric('cooldown_onchain');
      return json(429, {
        success: false,
        message: 'This wallet is on cooldown (on-chain).',
        reason: 'address_cooldown',
        retryAfter: error.remainingSeconds,
      });
    }

    if (error instanceof FaucetDryError) {
      trackServerEvent('drip_failed_dry');
      return json(503, {
        success: false,
        message: 'Faucet contract is currently dry. Please try again later.',
      });
    }

    if (error instanceof FaucetConfigurationError) {
      trackServerEvent('drip_failed_config');
      return json(503, {
        success: false,
        message: 'Server faucet configuration is incomplete.',
      });
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error';
    trackServerEvent('drip_failed_unknown', { error: message });
    return json(503, { success: false, message });
  }
}
