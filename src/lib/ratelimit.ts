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

export async function setAddressCooldown(
  address: string,
  txHash: string,
  cooldownSeconds?: number,
): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.set(cooldownKey(address), txHash, {
    ex: cooldownSeconds ?? COOLDOWN_SECONDS,
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordDripMetric(address: string): Promise<void> {
  if (!redis) return;
  const day = todayKey();
  await Promise.all([
    redis.incr(`metrics:drips:daily:${day}`),
    redis.incr('metrics:drips:total'),
    redis.sadd(`metrics:wallets:daily:${day}`, address.toLowerCase()),
    redis.sadd('metrics:wallets:all', address.toLowerCase()),
  ]);
}

export async function recordRejectionMetric(reason: string): Promise<void> {
  if (!redis) return;
  const day = todayKey();
  await redis.incr(`metrics:rejections:${reason}:${day}`);
}

export async function snapshotBalance(balance: string): Promise<void> {
  if (!redis) return;
  const day = todayKey();
  await redis.set(`metrics:balance:${day}`, balance);
}

export async function getMetrics(days: number = 30) {
  if (!redis) return null;

  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const pipeline = redis.pipeline();

  for (const date of dates) {
    pipeline.get(`metrics:drips:daily:${date}`);
    pipeline.scard(`metrics:wallets:daily:${date}`);
    pipeline.get(`metrics:balance:${date}`);
  }

  pipeline.get('metrics:drips:total');
  pipeline.scard('metrics:wallets:all');

  const rejectionReasons = [
    'captcha', 'ip_limit', 'fingerprint',
    'cooldown_redis', 'cooldown_onchain',
    'contract', 'global_limit',
  ];
  const today = todayKey();
  for (const reason of rejectionReasons) {
    pipeline.get(`metrics:rejections:${reason}:${today}`);
  }

  const results = await pipeline.exec();

  const daily: { date: string; drips: number; wallets: number; balance: string | null }[] = [];
  for (let i = 0; i < dates.length; i++) {
    const offset = i * 3;
    daily.push({
      date: dates[i],
      drips: Number(results[offset]) || 0,
      wallets: Number(results[offset + 1]) || 0,
      balance: (results[offset + 2] as string) || null,
    });
  }

  const totalOffset = dates.length * 3;
  const totalDrips = Number(results[totalOffset]) || 0;
  const totalWallets = Number(results[totalOffset + 1]) || 0;

  const rejections: Record<string, number> = {};
  for (let i = 0; i < rejectionReasons.length; i++) {
    rejections[rejectionReasons[i]] = Number(results[totalOffset + 2 + i]) || 0;
  }

  const logsRaw = await redis.lrange('faucet:drip:logs', 0, 9);
  const recentDrips = logsRaw.map((entry) =>
    typeof entry === 'string' ? JSON.parse(entry) : entry,
  );

  return { daily, totalDrips, totalWallets, rejections, recentDrips };
}
