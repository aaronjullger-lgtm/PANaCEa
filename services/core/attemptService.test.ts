import { describe, expect, it } from 'vitest';
import { unwrapUserStatsResponse } from './attemptService';

describe('unwrapUserStatsResponse', () => {
  it('supports direct, middleware-wrapped, and nested API envelopes', () => {
    const stats = { overall: { totalAttempts: 3 } };

    expect(unwrapUserStatsResponse({ stats })).toBe(stats);
    expect(unwrapUserStatsResponse({ data: { stats } })).toBe(stats);
    expect(unwrapUserStatsResponse({ ok: true, data: { data: { stats } } })).toBe(stats);
  });

  it('returns null for malformed payloads', () => {
    expect(unwrapUserStatsResponse(null)).toBeNull();
    expect(unwrapUserStatsResponse({ data: { ok: true } })).toBeNull();
  });
});
