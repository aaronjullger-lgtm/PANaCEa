import { describe, expect, it } from 'vitest';
import { resolvePoolRegenerationClearPlan } from '../scripts/regenerate-pool-v2-safety';

describe('resolvePoolRegenerationClearPlan', () => {
  it('does not clear by default and reports the deprecated implicit-clear behavior', () => {
    const plan = resolvePoolRegenerationClearPlan([], {});

    expect(plan.clearFirst).toBe(false);
    expect(plan.warnings[0]).toContain('Implicit pool clearing is disabled');
  });

  it('does not clear in add mode', () => {
    const plan = resolvePoolRegenerationClearPlan(['--add', '50'], {
      ALLOW_DESTRUCTIVE_POOL_REGENERATION: 'true',
    });

    expect(plan.clearFirst).toBe(false);
    expect(plan.warnings).toEqual([]);
  });

  it('rejects explicit clear without environment confirmation', () => {
    expect(() => resolvePoolRegenerationClearPlan(['--clear'], {})).toThrow(
      /Refusing to clear/
    );
  });

  it('allows explicit clear only with environment confirmation', () => {
    const plan = resolvePoolRegenerationClearPlan(['--clear'], {
      ALLOW_DESTRUCTIVE_POOL_REGENERATION: 'true',
    });

    expect(plan.clearFirst).toBe(true);
    expect(plan.warnings).toEqual([]);
  });
});
