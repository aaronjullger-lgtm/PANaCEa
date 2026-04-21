/**
 * FSRS v7-alpha tests.
 *
 * Pins the three v7 features on top of v6:
 *   1. Fractional intervals (canonical)
 *   2. Refined same-day stability (PANaCEa interpretation)
 *   3. 8-parameter forgetting curve (PANaCEa placeholder)
 *
 * These tests also serve as the regression guard for when ts-fsrs
 * publishes the real v7 formula — swapping computeRetrievabilityV7()
 * without updating these assertions is the intended failure mode.
 */

import { describe, it, expect } from 'vitest';
import {
  V7_MIN_INTERVAL_DAYS,
  V7_ALGORITHM_STATUS,
  V7_CURVE_PARAM_COUNT,
  V7_CURVE_PARAM_OFFSET,
  v7AlphaDefaultParameters,
  extendV6ToV7,
  isV7AlphaParams,
  computeRetrievabilityV7,
  invertRetrievabilityV7,
  v7ShortTermStability,
  FSRSv7,
} from '../lib/fsrs-v7';
import {
  selectFSRS,
  inferVersion,
  isV7Alpha,
} from '../lib/fsrs-version-selector';
import {
  FSRS,
  FSRSState,
  Rating,
  defaultParameters,
  FSRS7_REFERENCE_DEFAULTS,
  type FSRSCard,
} from '../lib/fsrs';

// ──────────────────────────────────────────────────────────────────────────
// Constants and parameter plumbing
// ──────────────────────────────────────────────────────────────────────────

describe('v7 constants', () => {
  it('minimum fractional interval is 10 minutes (0.00694 days)', () => {
    expect(V7_MIN_INTERVAL_DAYS).toBeCloseTo(10 / (24 * 60), 10);
    expect(V7_MIN_INTERVAL_DAYS).toBeLessThan(1 / 24); // under an hour
  });

  it('curve has 8 parameters starting at index 21', () => {
    expect(V7_CURVE_PARAM_COUNT).toBe(8);
    expect(V7_CURVE_PARAM_OFFSET).toBe(21);
    expect(V7_CURVE_PARAM_OFFSET + V7_CURVE_PARAM_COUNT).toBe(29);
  });

  it('algorithm status flags canonical vs placeholder correctly', () => {
    expect(V7_ALGORITHM_STATUS.fractionalIntervals).toBe('canonical');
    expect(V7_ALGORITHM_STATUS.forgettingCurve).toBe('placeholder');
    expect(V7_ALGORITHM_STATUS.shortTermStability).toBe('panacea-interpretation');
  });
});

describe('v7AlphaDefaultParameters', () => {
  it('has 29 parameters', () => {
    expect(v7AlphaDefaultParameters.w).toHaveLength(29);
  });

  it('preserves v6 defaults for w[0..20]', () => {
    for (let i = 0; i < 21; i++) {
      expect(v7AlphaDefaultParameters.w[i]).toBe(defaultParameters.w[i]);
    }
  });

  it('uses FSRS7_REFERENCE_DEFAULTS for w[21..28]', () => {
    for (let i = 21; i < 29; i++) {
      expect(v7AlphaDefaultParameters.w[i]).toBe(FSRS7_REFERENCE_DEFAULTS.w[i]);
    }
  });

  it('is tagged with version 7-alpha', () => {
    expect(v7AlphaDefaultParameters.version).toBe('7-alpha');
  });
});

describe('extendV6ToV7', () => {
  it('appends reference weights to a 21-length v6 param array', () => {
    const v6 = { ...defaultParameters };
    const v7 = extendV6ToV7(v6);
    expect(v7.w).toHaveLength(29);
    expect(v7.version).toBe('7-alpha');
    for (let i = 0; i < 21; i++) {
      expect(v7.w[i]).toBe(v6.w[i]);
    }
  });

  it('throws when given non-v6-length input', () => {
    const bad = { ...defaultParameters, w: [...defaultParameters.w, 0] };
    expect(() => extendV6ToV7(bad)).toThrow();
  });

  it('preserves request_retention and maximum_interval', () => {
    const v6 = { ...defaultParameters, request_retention: 0.85, maximum_interval: 10_000 };
    const v7 = extendV6ToV7(v6);
    expect(v7.request_retention).toBe(0.85);
    expect(v7.maximum_interval).toBe(10_000);
  });
});

describe('isV7AlphaParams', () => {
  it('accepts a 29-length finite array', () => {
    expect(isV7AlphaParams(v7AlphaDefaultParameters.w)).toBe(true);
  });

  it('rejects v6-length (21)', () => {
    expect(isV7AlphaParams(defaultParameters.w)).toBe(false);
  });

  it('rejects malformed inputs', () => {
    expect(isV7AlphaParams(null)).toBe(false);
    expect(isV7AlphaParams(undefined)).toBe(false);
    expect(isV7AlphaParams([])).toBe(false);
    const withNaN = [...v7AlphaDefaultParameters.w];
    withNaN[25] = NaN;
    expect(isV7AlphaParams(withNaN)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 8-parameter forgetting curve
// ──────────────────────────────────────────────────────────────────────────

describe('computeRetrievabilityV7 — 8-parameter forgetting curve', () => {
  it('returns 1 at t=0', () => {
    expect(computeRetrievabilityV7(0, 10, v7AlphaDefaultParameters)).toBe(1);
  });

  it('returns 0 for non-positive stability', () => {
    expect(computeRetrievabilityV7(5, 0, v7AlphaDefaultParameters)).toBe(0);
    expect(computeRetrievabilityV7(5, -1, v7AlphaDefaultParameters)).toBe(0);
  });

  it('is monotonically decreasing in elapsed time', () => {
    const times = [0.1, 1, 5, 10, 30, 90];
    const values = times.map((t) =>
      computeRetrievabilityV7(t, 10, v7AlphaDefaultParameters)
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]!);
    }
  });

  it('stays bounded in [0, 1]', () => {
    const r = computeRetrievabilityV7(1000, 1, v7AlphaDefaultParameters);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });

  it('reduces to v6 power-law when w[21..28] are all zero', () => {
    const zeroed = {
      ...v7AlphaDefaultParameters,
      w: [...defaultParameters.w.slice(0, 21), 0, 0, 0, 0, 0, 0, 0, 0],
    };
    const r7 = computeRetrievabilityV7(5, 10, zeroed);
    const factor = defaultParameters.w[19]!;
    const decay = -defaultParameters.w[20]!;
    const r6 = Math.pow(1 + (factor * 5) / 10, decay);
    expect(r7).toBeCloseTo(r6, 10);
  });

  it('correction factor always scales R downward (never increases it)', () => {
    // With non-negative w[21..28], the v7 R must be <= v6 R at every t.
    for (const t of [1, 5, 10, 30, 60]) {
      const r6Plain = Math.pow(
        1 + (defaultParameters.w[19]! * t) / 10,
        -defaultParameters.w[20]!
      );
      const r7 = computeRetrievabilityV7(t, 10, v7AlphaDefaultParameters);
      expect(r7).toBeLessThanOrEqual(r6Plain + 1e-9);
    }
  });

  it('falls back to v6 math when given v6-length params', () => {
    const r = computeRetrievabilityV7(5, 10, defaultParameters);
    const factor = defaultParameters.w[19]!;
    const decay = -defaultParameters.w[20]!;
    const expected = Math.pow(1 + (factor * 5) / 10, decay);
    expect(r).toBeCloseTo(expected, 10);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Inverse curve
// ──────────────────────────────────────────────────────────────────────────

describe('invertRetrievabilityV7', () => {
  it('is the true inverse of computeRetrievabilityV7 at R=0.9', () => {
    const S = 10;
    const t = invertRetrievabilityV7(S, 0.9, v7AlphaDefaultParameters);
    const r = computeRetrievabilityV7(t, S, v7AlphaDefaultParameters);
    expect(r).toBeCloseTo(0.9, 4);
  });

  it('is the true inverse at R=0.7', () => {
    const S = 25;
    const t = invertRetrievabilityV7(S, 0.7, v7AlphaDefaultParameters);
    const r = computeRetrievabilityV7(t, S, v7AlphaDefaultParameters);
    expect(r).toBeCloseTo(0.7, 4);
  });

  it('higher stability produces longer intervals for the same target', () => {
    const lo = invertRetrievabilityV7(5, 0.9, v7AlphaDefaultParameters);
    const hi = invertRetrievabilityV7(50, 0.9, v7AlphaDefaultParameters);
    expect(hi).toBeGreaterThan(lo);
  });

  it('returns maximum_interval when target is always achievable', () => {
    const smallCurve = {
      ...v7AlphaDefaultParameters,
      // Near-zero decay → R stays near 1 forever
      w: [...defaultParameters.w.slice(0, 19), 0.001, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
      maximum_interval: 365,
    };
    const t = invertRetrievabilityV7(1000, 0.999, smallCurve);
    expect(t).toBeGreaterThan(100);
  });

  it('returns minimum interval when target cannot be maintained', () => {
    // Stability 0.01, target 0.99 — barely any memory, impossibly high retention
    const t = invertRetrievabilityV7(0.01, 0.99, v7AlphaDefaultParameters);
    expect(t).toBeGreaterThanOrEqual(V7_MIN_INTERVAL_DAYS);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Refined same-day stability
// ──────────────────────────────────────────────────────────────────────────

describe('v7ShortTermStability', () => {
  it('applies no boost when elapsed is under the minimum interval (same-second)', () => {
    const s1 = v7ShortTermStability(10, Rating.Good, V7_MIN_INTERVAL_DAYS / 2, v7AlphaDefaultParameters);
    expect(s1).toBe(10); // identity — boostScale = 0
  });

  it('applies full v6 boost when elapsed >= 1 day', () => {
    const s1 = v7ShortTermStability(10, Rating.Good, 1.0, v7AlphaDefaultParameters);
    // Should match the v6 formula exactly (boostScale = 1). For Good (grade >= Hard)
    // the multiplier is masked at max(v6Mult, 1.0), so S stays at 10 when v6Mult < 1.
    const w = v7AlphaDefaultParameters.w;
    const w17 = w[17]!;
    const w18 = w[18]!;
    const w19 = w[19]!;
    const v6 = Math.pow(10, -w19) * Math.exp(w17 * (Rating.Good - 3 + w18));
    const v6Masked = Math.max(v6, 1.0); // Good >= Hard triggers mask
    const expected = 10 * v6Masked;
    expect(s1).toBeCloseTo(expected, 6);
  });

  it('produces a monotonically increasing stability as elapsed time grows (Good rating)', () => {
    const times = [V7_MIN_INTERVAL_DAYS, 0.1, 0.5, 1.0];
    const values = times.map((t) =>
      v7ShortTermStability(10, Rating.Good, t, v7AlphaDefaultParameters)
    );
    // Boost is a linear blend toward v6 stability, which for Good at S=10 is slightly > 10
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]! - 1e-9);
    }
  });

  it('preserves stability floor and ceiling', () => {
    const s1 = v7ShortTermStability(36500, Rating.Good, 0.5, v7AlphaDefaultParameters);
    expect(s1).toBeLessThanOrEqual(36500);
    const s2 = v7ShortTermStability(0.01, Rating.Again, 0.5, v7AlphaDefaultParameters);
    expect(s2).toBeGreaterThanOrEqual(0.01);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// FSRSv7 class
// ──────────────────────────────────────────────────────────────────────────

describe('FSRSv7.next() — fractional intervals for Review-state cards', () => {
  it('produces intervals >= V7_MIN_INTERVAL_DAYS', () => {
    const scheduler = new FSRSv7();
    const card: FSRSCard = {
      stability: 10,
      difficulty: 5,
      state: FSRSState.Review,
      elapsed_days: 10,
      scheduled_days: 10,
      reps: 5,
      lapses: 0,
      last_review: new Date(Date.now() - 10 * 86400000),
    };
    const result = scheduler.next(card, new Date(), Rating.Good);
    expect(result.card.scheduled_days).toBeGreaterThanOrEqual(V7_MIN_INTERVAL_DAYS);
  });

  it('can return fractional days (< 1 day) for low-stability cards', () => {
    const scheduler = new FSRSv7();
    const card: FSRSCard = {
      stability: 0.5, // very low stability
      difficulty: 9,
      state: FSRSState.Review,
      elapsed_days: 0.5,
      scheduled_days: 1,
      reps: 2,
      lapses: 2,
      last_review: new Date(Date.now() - 0.5 * 86400000),
    };
    const result = scheduler.next(card, new Date(), Rating.Good);
    // This is the whole point of v7 — sub-day scheduling when stability is low
    expect(result.card.scheduled_days).toBeLessThan(1);
    expect(result.card.scheduled_days).toBeGreaterThanOrEqual(V7_MIN_INTERVAL_DAYS);
  });

  it('respects maximum_interval cap', () => {
    const customParams = {
      ...v7AlphaDefaultParameters,
      maximum_interval: 100,
    };
    const scheduler = new FSRSv7(customParams);
    const card: FSRSCard = {
      stability: 1000, // very high stability
      difficulty: 1,
      state: FSRSState.Review,
      elapsed_days: 10,
      scheduled_days: 100,
      reps: 50,
      lapses: 0,
      last_review: new Date(Date.now() - 10 * 86400000),
    };
    const result = scheduler.next(card, new Date(), Rating.Good);
    expect(result.card.scheduled_days).toBeLessThanOrEqual(100);
  });

  it('retrievability() returns 1 for new cards', () => {
    const scheduler = new FSRSv7();
    const newCard: FSRSCard = {
      stability: 0,
      difficulty: 0,
      state: FSRSState.New,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      last_review: new Date(),
    };
    expect(scheduler.calculateRetrievability(newCard)).toBe(1);
  });

  it('exposes version 7-alpha-panacea via getVersion', () => {
    expect(FSRSv7.getVersion()).toBe('7-alpha-panacea');
  });

  it('exposes parameter summary with placeholder flags', () => {
    const s = new FSRSv7().getParameterSummary();
    expect(s.version).toBe('7-alpha-panacea');
    expect(s.paramCount).toBe(29);
    expect(s.status.forgettingCurve).toBe('placeholder');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Version selector dispatcher
// ──────────────────────────────────────────────────────────────────────────

describe('selectFSRS dispatcher', () => {
  it('returns v6 FSRS when no params provided', () => {
    const s = selectFSRS();
    expect(s).toBeInstanceOf(FSRS);
  });

  it('returns v6 FSRS when version is absent', () => {
    const s = selectFSRS(defaultParameters);
    expect(s).toBeInstanceOf(FSRS);
  });

  it('returns v6 FSRS when version is explicitly "6"', () => {
    const s = selectFSRS({ ...defaultParameters, version: '6' });
    expect(s).toBeInstanceOf(FSRS);
  });

  it('returns FSRSv7 when version is "7-alpha" AND w has 29 entries', () => {
    const s = selectFSRS(v7AlphaDefaultParameters);
    expect(s).toBeInstanceOf(FSRSv7);
  });

  it('falls back to v6 when version tag is "7-alpha" but w has wrong length', () => {
    const s = selectFSRS({ ...defaultParameters, version: '7-alpha' });
    expect(s).toBeInstanceOf(FSRS);
  });
});

describe('inferVersion', () => {
  it('returns "6" for 21-length w', () => {
    expect(inferVersion(defaultParameters.w)).toBe('6');
  });

  it('returns "7-alpha" for 29-length w', () => {
    expect(inferVersion(v7AlphaDefaultParameters.w)).toBe('7-alpha');
  });

  it('returns "6" for null / empty / wrong-length', () => {
    expect(inferVersion(null)).toBe('6');
    expect(inferVersion(undefined)).toBe('6');
    expect(inferVersion([])).toBe('6');
    expect(inferVersion([0, 0, 0])).toBe('6');
  });
});

describe('isV7Alpha', () => {
  it('true for v7-alpha params', () => {
    expect(isV7Alpha(v7AlphaDefaultParameters)).toBe(true);
  });

  it('false for v6 params', () => {
    expect(isV7Alpha(defaultParameters)).toBe(false);
  });

  it('false for null / undefined', () => {
    expect(isV7Alpha(null)).toBe(false);
    expect(isV7Alpha(undefined)).toBe(false);
  });

  it('false when version tag is wrong', () => {
    expect(isV7Alpha({ ...v7AlphaDefaultParameters, version: '6' })).toBe(false);
  });

  it('false when length is wrong', () => {
    expect(isV7Alpha({ ...defaultParameters, version: '7-alpha' })).toBe(false);
  });
});
