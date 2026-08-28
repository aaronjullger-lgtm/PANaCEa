/**
 * Idempotency key construction for external side effects.
 */

export type IdempotentAction =
  | 'linear_comment'
  | 'create_branch'
  | 'create_commit'
  | 'create_pr'
  | 'deploy_attempt'
  | 'webhook_intake';

export function buildIdempotencyKey(
  runId: string,
  action: IdempotentAction,
  target: string
): string {
  const normalized = target.trim().toLowerCase().slice(0, 256);
  return `${runId}:${action}:${hashString(normalized)}`;
}

export function buildWebhookIdempotencyKey(
  provider: string,
  deliveryId: string
): string {
  return `webhook:${provider}:${deliveryId}`;
}

function hashString(input: string): string {
  // Simple deterministic hash for idempotency (not cryptographic)
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
