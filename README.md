# ytest.USD Faucet

Production-grade ERC20 faucet for **ytest.USD** on **Ethereum Sepolia** built with Next.js 15.

## Features

- Fixed drip amount: **10 ytest.USD**
- Per-address cooldown: **4 hours**
- Cloudflare Turnstile CAPTCHA (server-side verification)
- IP sliding-window rate limit with Upstash Redis (`3/hour`)
- Device fingerprint sliding-window rate limit (`5/hour`)
- Global faucet sliding-window cap (`50/hour`)
- Optional contract-address recipient blocking
- Transaction safety via in-memory mutex and explicit nonce reads
- `/api/status` health + faucet balance endpoint

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui-style component setup
- viem (Sepolia + ERC20 transfers)
- Upstash Redis + `@upstash/ratelimit`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.local.template .env.local
```

3. Fill values in `.env.local`.

4. Start dev server:

```bash
npm run dev
```

## Required Environment Variables

```bash
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://sepolia.drpc.org
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

## API

### `POST /api/drip`

Body:

```json
{
  "address": "0x...",
  "turnstileToken": "...",
  "fingerprint": "..."
}
```

Validation pipeline:

1. Turnstile verification
2. IP rate limit
3. Device fingerprint limit
4. Address cooldown
5. Global limit
6. Send transaction

### `GET /api/status`

Returns faucet wallet address, token balance, chain metadata, and health checks.

## Deployment

### GitHub

```bash
gh repo create ytest-faucet --public --source=. --push
```

### Vercel

```bash
vercel link
vercel env add PRIVATE_KEY production
vercel env add SEPOLIA_RPC_URL production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production
vercel env add TURNSTILE_SECRET_KEY production
vercel deploy --prod
```

## Security Notes

- Never expose `PRIVATE_KEY` to the client.
- Keep `.env.local` out of git.
- Rotate faucet wallet keys if leaked.
