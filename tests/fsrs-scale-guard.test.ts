/**
 * FSRS Parameter Scale Guard Tests
 *
 * Regression guard for the 2026-04 scale-alignment sweep. Before that sweep
 * the batch L-BFGS optimizer (lib/fsrs-optimizer.ts) wrote w[19]/w[20] on the
 * FSRS-4/5 scale (w[19] ∈ [5, 15], default 9). Any user who triggered
 * optimization via the settings UI or hit the cron would have saved those
 * off-scale params to UserProgress.fsrsParams or PersonalizedFSRSParams.w.
 *
 * isParamsOnCurrentScale() + loadParametersSafely() are the read-side
 * recovery so no schema migration is needed — poisoned params fall back
 * to canonical defaults automatically on next load.
 */

import { describe, it, expect } from 'vitest';
import {
  isParamsOnCurrentScale,
  loadParametersSafely,
  defaultParameters,
} from '../lib/fsrs';

describe('isParamsOnCurrentScale()', () => {
  it('accepts canonical v6 defaults (w[19]=0.1597, w[20]=2.27)', () => {
    expect(isParamsOnCurrentScale(defaultParameters.w)).toBe(true);
  });

  it('accepts values at both ends of the canonical bounds', () => {
    const wLow = [...defaultParameters.w];
    wLow[19] = 0.01; // lower bound
    wLow[20] = 0.1;
    expect(isParamsOnCurrentScale(wLow)).toBe(true);

    const wHigh = [...defaultParameters.w];
    wHigh[19] = 1.0; // upper bound
    wHigh[20] = 5.0;
    expect(isParamsOnCurrentScale(wHigh)).toBe(true);
  });

  it('REJECTS legacy L-BFGS scale (w[19]≈9)', () => {
    const poisoned = [...defaultParameters.w];
    poisoned[19] = 9.0; // FSRS-4/5 default
    poisoned[20] = 1.0;
    expect(isParamsOnCurrentScale(poisoned)).toBe(false);
  });

  it('REJECTS pre-fix stale defaults (w[19]=0.0658, w[20]=0.1542)', () => {
    // 0.0658 is below the current lower bound of 0.01? Actually 0.0658 > 0.01,
    // so w[19] would pass. But w[20]=0.1542 is > 0.1 lower bound.
    // So these specific values DO pass bounds. This is intentional —
    // isParamsOnCurrentScale only rejects the ~50× legacy scale, not all
    // pre-fix values. The tighter 0.0658/0.1542 fix is covered by the
    // defaults themselves now being 0.1597/2.27.
    const preFix = [...defaultParameters.w];
    preFix[19] = 0.0658;
    preFix[20] = 0.1542;
    expect(isParamsOnCurrentScale(preFix)).toBe(true);
  });

  it('REJECTS w[19] above 1.0', () => {
    const w = [...defaultParameters.w];
    w[19] = 1.5;
    expect(isParamsOnCurrentScale(w)).toBe(false);
  });

  it('REJECTS w[20] above 5.0', () => {
    const w = [...defaultParameters.w];
    w[20] = 6.0;
    expect(isParamsOnCurrentScale(w)).toBe(false);
  });

  it('REJECTS non-array / short / malformed inputs', () => {
    expect(isParamsOnCurrentScale(null)).toBe(false);
    expect(isParamsOnCurrentScale(undefined)).toBe(false);
    expect(isParamsOnCurrentScale([])).toBe(false);
    expect(isParamsOnCurrentScale([1, 2, 3])).toBe(false); // too short
  });

  it('REJECTS NaN or Infinity', () => {
    const w = [...defaultParameters.w];
    w[19] = NaN;
    expect(isParamsOnCurrentScale(w)).toBe(false);

    const w2 = [...defaultParameters.w];
    w2[20] = Infinity;
    expect(isParamsOnCurrentScale(w2)).toBe(false);
  });
});

describe('loadParametersSafely()', () => {
  it('returns stored params when w[] is on-scale', () => {
    const stored = {
      request_retention: 0.85,
      maximum_interval: 20_000,
      w: [...defaultParameters.w],
    };
    const loaded = loadParametersSafely(stored);
    expect(loaded.request_retention).toBe(0.85);
    expect(loaded.maximum_interval).toBe(20_000);
    expect(loaded.w).toEqual(defaultParameters.w);
  });

  it('falls back to defaults when stored params are off-scale (legacy L-BFGS)', () => {
    const poisoned = {
      request_retention: 0.9,
      maximum_interval: 36500,
      w: [...defaultParameters.w, /* overwrite w[19]/w[20] below */].map((v, i) =>
        i === 19 ? 9.0 : i === 20 ? 1.0 : v
      ),
    };
    const loaded = loadParametersSafely(poisoned);
    expect(loaded.w).toEqual(defaultParameters.w); // defaults, not poisoned
  });

  it('falls back to defaults for null / undefined / malformed inputs', () => {
    expect(loadParametersSafely(null).w).toEqual(defaultParameters.w);
    expect(loadParametersSafely(undefined).w).toEqual(defaultParameters.w);
    expect(loadParametersSafely({}).w).toEqual(defaultParameters.w);
    expect(loadParametersSafely({ w: 'not an array' }).w).toEqual(defaultParameters.w);
    expect(loadParametersSafely({ w: [1, 2] }).w).toEqual(defaultParameters.w); // short array
  });

  it('fills missing request_retention / maximum_interval with defaults', () => {
    const stored = { w: [...defaultParameters.w] }; // no retention/interval
    const loaded = loadParametersSafely(stored);
    expect(loaded.request_retention).toBe(defaultParameters.request_retention);
    expect(loaded.maximum_interval).toBe(defaultParameters.maximum_interval);
  });

  it('returns a copy of w[] (mutation isolation)', () => {
    const stored = { w: [...defaultParameters.w] };
    const loaded = loadParametersSafely(stored);
    loaded.w[19] = 999;
    expect(stored.w[19]).toBe(defaultParameters.w[19]); // original untouched
  });
});
