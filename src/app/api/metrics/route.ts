import { NextResponse } from 'next/server';
import { getMetrics } from '@/lib/ratelimit';

export const runtime = 'nodejs';

export async function GET() {
  const metrics = await getMetrics(30);

  if (!metrics) {
    return NextResponse.json(
      { success: false, message: 'Metrics unavailable (Redis not configured)' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    ...metrics,
  });
}
