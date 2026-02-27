export type TurnstileResult = {
  success: boolean;
  errors: string[];
};

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: false, errors: ['turnstile_secret_not_configured'] };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      idempotency_key: crypto.randomUUID(),
    });

    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        errors: [`http_${response.status}`],
      };
    }

    const data = (await response.json()) as TurnstileVerifyResponse;
    return {
      success: data.success,
      errors: data.success ? [] : (data['error-codes'] ?? ['turnstile_verification_failed']),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return {
      success: false,
      errors: [message],
    };
  }
}
