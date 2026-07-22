/**
 * Webhook authentication — raw-body HMAC, timestamp window, replay protection.
 *
 * Signature format: sha256=HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
 * Headers: X-Builder-Signature, X-Builder-Timestamp (unix seconds)
 */

import { AuthError } from './policy';

export const WEBHOOK_MAX_AGE_SECONDS = 300; // 5 minutes
export const WEBHOOK_MAX_CLOCK_SKEW_SECONDS = 60; // 1 minute future tolerance

export interface WebhookVerificationInput {
  secret: string;
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  nowSeconds?: number;
}

export interface WebhookVerificationResult {
  timestamp: number;
  deliveryAgeSeconds: number;
}

export async function verifyWebhookRequest(
  input: WebhookVerificationInput
): Promise<WebhookVerificationResult> {
  const { secret, rawBody, signatureHeader, timestampHeader } = input;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!secret?.trim()) {
    throw new AuthError('Webhook secret not configured', 503);
  }
  if (!signatureHeader?.trim()) {
    throw new AuthError('Missing webhook signature', 401);
  }
  if (!timestampHeader?.trim()) {
    throw new AuthError('Missing webhook timestamp', 401);
  }

  const timestamp = Number.parseInt(timestampHeader.trim(), 10);
  if (!Number.isFinite(timestamp)) {
    throw new AuthError('Invalid webhook timestamp', 401);
  }

  const age = nowSeconds - timestamp;
  if (age > WEBHOOK_MAX_AGE_SECONDS) {
    throw new AuthError('Webhook timestamp expired (replay protection)', 401);
  }
  if (age < -WEBHOOK_MAX_CLOCK_SKEW_SECONDS) {
    throw new AuthError('Webhook timestamp too far in the future', 401);
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  const provided = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase();

  if (!timingSafeEqual(provided, expected)) {
    throw new AuthError('Invalid webhook signature', 401);
  }

  return { timestamp, deliveryAgeSeconds: age };
}

/** @deprecated Use verifyWebhookRequest */
export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader: string | null
): Promise<void> {
  await verifyWebhookRequest({
    secret,
    rawBody: payload,
    signatureHeader,
    timestampHeader: String(Math.floor(Date.now() / 1000)),
  });
}

export function requireWebhookDeliveryId(
  provider: string,
  headers: {
    githubDelivery: string | null;
    linearDelivery: string | null;
    sentryDelivery: string | null;
  }
): string {
  const id =
    headers.githubDelivery?.trim() ||
    headers.linearDelivery?.trim() ||
    headers.sentryDelivery?.trim();

  if (!id) {
    throw new AuthError(
      `Missing provider delivery id for ${provider} webhook (required for deduplication)`,
      400
    );
  }
  return id;
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
