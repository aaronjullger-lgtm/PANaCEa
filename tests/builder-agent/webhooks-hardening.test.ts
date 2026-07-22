import { describe, expect, it } from 'vitest';
import {
  verifyWebhookRequest,
  requireWebhookDeliveryId,
  WEBHOOK_MAX_AGE_SECONDS,
} from '@/lib/builder-agent/auth/webhooks';
import { AuthError } from '@/lib/builder-agent/auth/policy';

async function sign(secret: string, timestamp: number, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('BuilderAgent webhook hardening', () => {
  const secret = 'webhook-secret-test-value-32chars!!';
  const body = '{"action":"opened"}';
  const now = 1_700_000_000;

  it('verifies raw-body signature with timestamp', async () => {
    const sig = await sign(secret, now, body);
    const result = await verifyWebhookRequest({
      secret,
      rawBody: body,
      signatureHeader: `sha256=${sig}`,
      timestampHeader: String(now),
      nowSeconds: now,
    });
    expect(result.timestamp).toBe(now);
  });

  it('rejects expired timestamps (replay protection)', async () => {
    const old = now - WEBHOOK_MAX_AGE_SECONDS - 10;
    const sig = await sign(secret, old, body);
    await expect(
      verifyWebhookRequest({
        secret,
        rawBody: body,
        signatureHeader: `sha256=${sig}`,
        timestampHeader: String(old),
        nowSeconds: now,
      })
    ).rejects.toThrow(/expired/);
  });

  it('rejects missing delivery id', () => {
    expect(() =>
      requireWebhookDeliveryId('github', {
        githubDelivery: null,
        linearDelivery: null,
        sentryDelivery: null,
      })
    ).toThrow(AuthError);
  });

  it('rejects when webhook secret not configured', async () => {
    await expect(
      verifyWebhookRequest({
        secret: '',
        rawBody: body,
        signatureHeader: 'sha256=abc',
        timestampHeader: String(now),
      })
    ).rejects.toThrow(/not configured/);
  });
});
