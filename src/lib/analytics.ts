import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (posthogClient) return posthogClient;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;

  posthogClient = new PostHog(key, {
    host: host || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });

  return posthogClient;
}

export function trackServerEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  const ph = getPostHog();
  if (!ph) return;

  ph.capture({
    distinctId: (properties?.address as string) || 'server',
    event,
    properties,
  });
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
