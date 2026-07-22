import { describe, expect, it } from 'vitest';
import { buildWebhookIdempotencyKey } from '@/lib/builder-agent/idempotency/keys';

/**
 * Simulates BuilderAgent.intakeFromWebhook atomic dedup (single setState).
 * Production code lives in workers/builder-agent/src/agent/BuilderAgent.ts.
 */
function simulateWebhookIntake(
  state: { webhookDeliveries: Record<string, string>; runs: Record<string, unknown> },
  provider: string,
  deliveryId: string
): { duplicate: boolean; runId?: string } {
  const key = buildWebhookIdempotencyKey(provider, deliveryId);
  if (state.webhookDeliveries[key]) {
    return { duplicate: true };
  }
  const runId = `run_${deliveryId}`;
  state.webhookDeliveries[key] = new Date().toISOString();
  state.runs[runId] = { runId };
  return { duplicate: false, runId };
}

describe('BuilderAgent webhook duplicate delivery', () => {
  it('deduplicates identical delivery ids', () => {
    const state = { webhookDeliveries: {} as Record<string, string>, runs: {} as Record<string, unknown> };
    const first = simulateWebhookIntake(state, 'github', 'delivery-abc');
    const second = simulateWebhookIntake(state, 'github', 'delivery-abc');

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(Object.keys(state.runs)).toHaveLength(1);
  });

  it('allows distinct delivery ids', () => {
    const state = { webhookDeliveries: {} as Record<string, string>, runs: {} as Record<string, unknown> };
    simulateWebhookIntake(state, 'github', 'delivery-1');
    const second = simulateWebhookIntake(state, 'github', 'delivery-2');
    expect(second.duplicate).toBe(false);
    expect(Object.keys(state.runs)).toHaveLength(2);
  });
});
