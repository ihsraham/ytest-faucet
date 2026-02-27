import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  COOLDOWN_SECONDS,
  FINGERPRINT_LIMIT_PER_HOUR,
  GLOBAL_LIMIT_PER_HOUR,
  IP_LIMIT_PER_HOUR,
} from '@/lib/constants';

const redisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const redis = redisConfigured ? Redis.fromEnv() : null;

const ipRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(IP_LIMIT_PER_HOUR, '1 h'),
      analytics: true,
      prefix: 'ratelimit:ip',
    })
  : null;

const fingerprintRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(FINGERPRINT_LIMIT_PER_HOUR, '1 h'),
      analytics: true,
      prefix: 'ratelimit:fingerprint',
    })
  : null;

const globalRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(GLOBAL_LIMIT_PER_HOUR, '1 h'),
      analytics: true,
      prefix: 'ratelimit:global',
    })
  : null;

export type LimitCheckResult = {
  success: boolean;
  retryAfterSeconds: number;
};

export function isRedisConfigured() {
  return redisConfigured;
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'unknown';
}

function toRetryAfter(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

export async function checkIpLimit(ip: string): Promise<LimitCheckResult> {
  if (!ipRatelimit) {
    return { success: true, retryAfterSeconds: 0 };
  }

  const result = await ipRatelimit.limit(ip);
  return {
    success: result.success,
    retryAfterSeconds: result.success ? 0 : toRetryAfter(result.reset),
  };
}

export async function checkFingerprintLimit(fingerprint: string): Promise<LimitCheckResult> {
  if (!fingerprintRatelimit) {
    return { success: true, retryAfterSeconds: 0 };
  }

  const result = await fingerprintRatelimit.limit(fingerprint);
  return {
    success: result.success,
    retryAfterSeconds: result.success ? 0 : toRetryAfter(result.reset),
  };
}

export async function checkGlobalLimit(): Promise<LimitCheckResult> {
  if (!globalRatelimit) {
    return { success: true, retryAfterSeconds: 0 };
  }

  const result = await globalRatelimit.limit('faucet-global');
  return {
    success: result.success,
    retryAfterSeconds: result.success ? 0 : toRetryAfter(result.reset),
  };
}

function cooldownKey(address: string) {
  return `cooldown:${address.toLowerCase()}`;
}

export async function getAddressCooldown(address: string): Promise<number> {
  if (!redis) {
    return 0;
  }

  const ttl = await redis.ttl(cooldownKey(address));
  if (ttl < 0) {
    return 0;
  }
  return ttl;
}

export async function setAddressCooldown(address: string, txHash: string): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.set(cooldownKey(address), txHash, {
    ex: COOLDOWN_SECONDS,
  });
}

export async function logDripAttempt(input: {
  ip: string;
  address: string;
  txHash: string;
  fingerprint?: string;
}) {
  if (!redis) {
    return;
  }

  const key = 'faucet:drip:logs';
  await redis.lpush(
    key,
    JSON.stringify({
      ...input,
      at: new Date().toISOString(),
    }),
  );
  await redis.ltrim(key, 0, 499);
}
