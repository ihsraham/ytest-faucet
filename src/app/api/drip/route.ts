import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import {
  FaucetConfigurationError,
  FaucetDryError,
  FaucetRecipientError,
  isContractAddress,
  normalizeAddress,
  sendDripTransaction,
} from '@/lib/blockchain';
import { DRIP_AMOUNT, TOKEN_SYMBOL } from '@/lib/constants';
import {
  checkFingerprintLimit,
  checkGlobalLimit,
  checkIpLimit,
  getAddressCooldown,
  getClientIp,
  logDripAttempt,
  setAddressCooldown,
} from '@/lib/ratelimit';
import { verifyTurnstileToken } from '@/lib/turnstile';

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
      return json(403, {
        success: false,
        message: 'CAPTCHA verification failed.',
        reason: 'captcha_failed',
        details: captcha.errors,
      });
    }

    const ipLimit = await checkIpLimit(ip);
    if (!ipLimit.success) {
      return json(429, {
        success: false,
        message: 'Too many requests from your IP. Try again later.',
        reason: 'ip_rate_limited',
        retryAfter: ipLimit.retryAfterSeconds,
      });
    }

    const fingerprintLimit = await checkFingerprintLimit(fingerprint);
    if (!fingerprintLimit.success) {
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
      return json(400, {
        success: false,
        message: 'Contract addresses are not eligible. Use an EOA wallet address.',
      });
    }

    const cooldownSeconds = await getAddressCooldown(recipientAddress);
    if (cooldownSeconds > 0) {
      return json(429, {
        success: false,
        message: 'This wallet is on cooldown.',
        reason: 'address_cooldown',
        retryAfter: cooldownSeconds,
      });
    }

    const globalLimit = await checkGlobalLimit();
    if (!globalLimit.success) {
      return json(429, {
        success: false,
        message: 'Faucet is currently busy. Please try again later.',
        reason: 'global_rate_limited',
        retryAfter: globalLimit.retryAfterSeconds,
      });
    }

    const { txHash } = await sendDripTransaction(recipientAddress);

    await Promise.all([
      setAddressCooldown(recipientAddress, txHash),
      logDripAttempt({
        ip,
        address: recipientAddress,
        txHash,
        fingerprint,
      }),
    ]);

    return json(200, {
      success: true,
      txHash,
      amount: DRIP_AMOUNT,
      message: `${DRIP_AMOUNT} ${TOKEN_SYMBOL} sent!`,
    });
  } catch (error) {
    if (error instanceof FaucetRecipientError) {
      return json(400, {
        success: false,
        message: error.message,
      });
    }

    if (error instanceof FaucetDryError) {
      return json(503, {
        success: false,
        message: 'Faucet wallet is currently dry. Please try again later.',
      });
    }

    if (error instanceof FaucetConfigurationError) {
      return json(503, {
        success: false,
        message: 'Server faucet configuration is incomplete.',
      });
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return json(503, {
      success: false,
      message,
    });
  }
}
