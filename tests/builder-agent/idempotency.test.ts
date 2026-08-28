import { describe, expect, it } from 'vitest';
import { buildIdempotencyKey, buildWebhookIdempotencyKey } from '@/lib/builder-agent/idempotency/keys';
import { InMemoryIdempotencyStore, withIdempotency } from '@/lib/builder-agent/idempotency/store';

describe('BuilderAgent idempotency', () => {
  it('builds stable keys', () => {
    const a = buildIdempotencyKey('run_1', 'create_pr', 'org/repo:branch:main');
    const b = buildIdempotencyKey('run_1', 'create_pr', 'org/repo:branch:main');
    expect(a).toBe(b);
    expect(a).toMatch(/^run_1:create_pr:/);
  });

  it('deduplicates webhook deliveries', () => {
    const key = buildWebhookIdempotencyKey('github', 'delivery-abc');
    expect(key).toBe('webhook:github:delivery-abc');
  });

  it('returns cached result on duplicate side effect', async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const first = await withIdempotency(store, 'k1', async () => {
      calls++;
      return { pr: 42 };
    });
    const second = await withIdempotency(store, 'k1', async () => {
      calls++;
      return { pr: 99 };
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.value).toEqual({ pr: 42 });
    expect(calls).toBe(1);
  });
});
