import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  InvalidStateTransitionError,
  isTerminal,
} from '@/lib/builder-agent/state/transitions';

describe('BuilderAgent state transitions', () => {
  it('allows valid intake → analyzing', () => {
    expect(canTransition('intake', 'analyzing')).toBe(true);
    expect(() => assertTransition('intake', 'analyzing')).not.toThrow();
  });

  it('rejects invalid intake → completed', () => {
    expect(canTransition('intake', 'completed')).toBe(false);
    expect(() => assertTransition('intake', 'completed')).toThrow(InvalidStateTransitionError);
  });

  it('allows same-status no-op', () => {
    expect(canTransition('testing', 'testing')).toBe(true);
  });

  it('marks terminal statuses', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('executing')).toBe(false);
  });

  it('allows revision loop testing ↔ revising', () => {
    expect(canTransition('testing', 'revising')).toBe(true);
    expect(canTransition('revising', 'testing')).toBe(true);
  });
});
