/**
 * Webhook signature verification.
 */

import { AuthError } from './policy';

export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader: string | null
): Promise<void> {
  if (!secret?.trim()) {
    throw new AuthError('Webhook secret not configured', 503);
  }
  if (!signatureHeader?.trim()) {
    throw new AuthError('Missing webhook signature', 401);
  }

  const expected = await hmacSha256Hex(secret, payload);
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();

  if (!timingSafeEqual(provided, expected)) {
    throw new AuthError('Invalid webhook signature', 401);
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
