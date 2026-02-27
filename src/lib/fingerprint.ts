function fallbackHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export async function generateDeviceFingerprint(): Promise<string> {
  const payload = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    String(navigator.hardwareConcurrency ?? ''),
    String(navigator.maxTouchPoints ?? ''),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  return fallbackHash(payload);
}
