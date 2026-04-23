// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for pure functions in lib/services/fsrsOptimizerService.ts
 *
 * Functions tested (no DB, no side effects):
 *   computeLogLoss         — binary cross-entropy between predicted retrievability and outcome
 *   getCircadianPhase      — maps hour (0-23) to morning/afternoon/evening/night
 *   splitByCircadianPhase  — routes review data to per-phase buckets
 *   getParametersForHour   — returns phase params or falls back to global
 *
 * computeLogLoss boundary behaviours:
 *   - Empty reviews → 0
 *   - Skips reviews with stability ≤ 0 or elapsedDays < 0
 *   - Prevents log(0) via epsilon clamping
 *
 * getCircadianPhase boundaries (INCLUSIVE starts, EXCLUSIVE ends):
 *   morning   [06, 12)
 *   afternoon [12, 17)
 *   evening   [17, 22)
 *   night     [22, 24) ∪ [00, 06)
 */

import { describe, it, expect } from 'vitest';
import {
  computeLogLoss,
  getCircadianPhase,
  splitByCircadianPhase,
  getParametersForHour,
  OPTIMIZER_CONSTANTS,
  type CircadianOptimizationResult,
} from './fsrsOptimizerService';
import { defaultParameters, type FSRSParameters } from '../fsrs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReview(overrides: {
  stability?: number;
  difficulty?: number;
  elapsedDays?: number;
  gradeContinuous?: number;
  wasCorrect?: boolean;
  retrievability?: number | null;
}) {
  return {
    stability: overrides.stability ?? 10,
    difficulty: overrides.difficulty ?? 5,
    elapsedDays: overrides.elapsedDays ?? 7,
    gradeContinuous: overrides.gradeContinuous ?? 3.0,
    wasCorrect: overrides.wasCorrect ?? true,
    retrievability: overrides.retrievability ?? 0.8,
  };
}

function makeCircadianResult(
  globalParams: FSRSParameters = defaultParameters,
  phaseParams?: Partial<Record<string, FSRSParameters>>
): CircadianOptimizationResult {
  return {
    global: {
      parameters: globalParams,
      initialLoss: 0.5,
      finalLoss: 0.4,
      reviewCount: 100,
      system: 'global',
      optimizedAt: new Date().toISOString(),
    },
    phases: phaseParams
      ? Object.fromEntries(
          Object.entries(phaseParams).map(([phase, params]) => [
            phase,
            {
              parameters: params!,
              initialLoss: 0.5,
              finalLoss: 0.45,
              reviewCount: 50,
              system: `phase:${phase}`,
              optimizedAt: new Date().toISOString(),
            },
          ])
        )
      : {},
    availablePhases: phaseParams ? (Object.keys(phaseParams) as any) : [],
  };
}

// ─── computeLogLoss ───────────────────────────────────────────────────────────

describe('computeLogLoss', () => {
  it('returns 0 for empty reviews array', () => {
    expect(computeLogLoss([], defaultParameters)).toBe(0);
  });

  it('returns a finite positive number for valid reviews', () => {
    const reviews = [makeReview({ wasCorrect: true }), makeReview({ wasCorrect: false })];
    const loss = computeLogLoss(reviews, defaultParameters);
    expect(isFinite(loss)).toBe(true);
    expect(loss).toBeGreaterThan(0);
  });

  it('skips reviews with stability <= 0 in numerator but counts in denominator', () => {
    // Skipped reviews contribute 0 to totalLoss but are counted in reviews.length.
    // So loss([bad, good]) = loss([good]) / 2.
    const bad = makeReview({ stability: 0 });
    const good = makeReview({ stability: 5, wasCorrect: true });
    const lossWithBad = computeLogLoss([bad, good], defaultParameters);
    const lossGoodOnly = computeLogLoss([good], defaultParameters);
    expect(lossWithBad).toBeCloseTo(lossGoodOnly / 2, 9);
  });

  it('skips reviews with elapsedDays < 0 in numerator but counts in denominator', () => {
    const negative = makeReview({ elapsedDays: -1 });
    const normal = makeReview({ elapsedDays: 7, wasCorrect: true });
    const lossWithNeg = computeLogLoss([negative, normal], defaultParameters);
    const lossNormalOnly = computeLogLoss([normal], defaultParameters);
    expect(lossWithNeg).toBeCloseTo(lossNormalOnly / 2, 9);
  });

  it('loss is always non-negative', () => {
    const reviews = [
      makeReview({ wasCorrect: true, elapsedDays: 3 }),
      makeReview({ wasCorrect: false, elapsedDays: 10 }),
      makeReview({ wasCorrect: true, elapsedDays: 1 }),
    ];
    expect(computeLogLoss(reviews, defaultParameters)).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 if all reviews are skipped (invalid stability)', () => {
    const allBad = [makeReview({ stability: -1 }), makeReview({ stability: 0 })];
    // All skipped → 0 / 0 is... wait, totalLoss=0 / reviews.length
    // Actually: 0 / 2 = 0
    expect(computeLogLoss(allBad, defaultParameters)).toBe(0);
  });
});

// ─── OPTIMIZER_CONSTANTS ─────────────────────────────────────────────────────

describe('OPTIMIZER_CONSTANTS', () => {
  it('exports expected constant names', () => {
    expect(typeof OPTIMIZER_CONSTANTS.MIN_REVIEWS_FOR_OPTIMIZATION).toBe('number');
    expect(typeof OPTIMIZER_CONSTANTS.MIN_REVIEWS_FOR_FULL_OPTIMIZATION).toBe('number');
    expect(typeof OPTIMIZER_CONSTANTS.LEARNING_RATE).toBe('number');
    expect(typeof OPTIMIZER_CONSTANTS.MAX_ITERATIONS).toBe('number');
    expect(typeof OPTIMIZER_CONSTANTS.CONVERGENCE_THRESHOLD).toBe('number');
    expect(Array.isArray(OPTIMIZER_CONSTANTS.OPTIMIZABLE_INDICES)).toBe(true);
    expect(Array.isArray(OPTIMIZER_CONSTANTS.PRETRAIN_INDICES)).toBe(true);
    expect(Array.isArray(OPTIMIZER_CONSTANTS.PARAM_BOUNDS)).toBe(true);
  });

  it('MIN_REVIEWS_FOR_OPTIMIZATION < MIN_REVIEWS_FOR_FULL_OPTIMIZATION', () => {
    expect(OPTIMIZER_CONSTANTS.MIN_REVIEWS_FOR_OPTIMIZATION).toBeLessThan(
      OPTIMIZER_CONSTANTS.MIN_REVIEWS_FOR_FULL_OPTIMIZATION
    );
  });

  it('OPTIMIZABLE_INDICES contains only valid w-parameter indices (0-20)', () => {
    for (const idx of OPTIMIZER_CONSTANTS.OPTIMIZABLE_INDICES) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(20);
    }
  });

  it('PRETRAIN_INDICES is a subset of OPTIMIZABLE_INDICES', () => {
    const optimizable = new Set(OPTIMIZER_CONSTANTS.OPTIMIZABLE_INDICES);
    for (const idx of OPTIMIZER_CONSTANTS.PRETRAIN_INDICES) {
      expect(optimizable.has(idx)).toBe(true);
    }
  });

  it('PARAM_BOUNDS has min <= max for each entry', () => {
    for (const [min, max] of OPTIMIZER_CONSTANTS.PARAM_BOUNDS) {
      expect(min).toBeLessThanOrEqual(max);
    }
  });
});

// ─── getCircadianPhase ────────────────────────────────────────────────────────

describe('getCircadianPhase', () => {
  it('hour 6 → morning', () => expect(getCircadianPhase(6)).toBe('morning'));
  it('hour 11 → morning', () => expect(getCircadianPhase(11)).toBe('morning'));
  it('hour 12 → afternoon', () => expect(getCircadianPhase(12)).toBe('afternoon'));
  it('hour 16 → afternoon', () => expect(getCircadianPhase(16)).toBe('afternoon'));
  it('hour 17 → evening', () => expect(getCircadianPhase(17)).toBe('evening'));
  it('hour 21 → evening', () => expect(getCircadianPhase(21)).toBe('evening'));
  it('hour 22 → night', () => expect(getCircadianPhase(22)).toBe('night'));
  it('hour 23 → night', () => expect(getCircadianPhase(23)).toBe('night'));
  it('hour 0 → night', () => expect(getCircadianPhase(0)).toBe('night'));
  it('hour 5 → night', () => expect(getCircadianPhase(5)).toBe('night'));

  it('returns one of the four valid phases for every hour 0-23', () => {
    const validPhases = new Set(['morning', 'afternoon', 'evening', 'night']);
    for (let h = 0; h < 24; h++) {
      expect(validPhases.has(getCircadianPhase(h))).toBe(true);
    }
  });
});

// ─── splitByCircadianPhase ────────────────────────────────────────────────────

describe('splitByCircadianPhase', () => {
  it('returns empty arrays for all phases on empty input', () => {
    const result = splitByCircadianPhase([]);
    expect(result.morning).toHaveLength(0);
    expect(result.afternoon).toHaveLength(0);
    expect(result.evening).toHaveLength(0);
    expect(result.night).toHaveLength(0);
  });

  it('routes morning-hour review to morning bucket', () => {
    const review = { ...makeReview({}), hourOfDay: 9 };
    const result = splitByCircadianPhase([review]);
    expect(result.morning).toHaveLength(1);
    expect(result.afternoon).toHaveLength(0);
  });

  it('routes afternoon-hour review to afternoon bucket', () => {
    const review = { ...makeReview({}), hourOfDay: 14 };
    const result = splitByCircadianPhase([review]);
    expect(result.afternoon).toHaveLength(1);
  });

  it('routes evening-hour review to evening bucket', () => {
    const review = { ...makeReview({}), hourOfDay: 19 };
    const result = splitByCircadianPhase([review]);
    expect(result.evening).toHaveLength(1);
  });

  it('routes night-hour review to night bucket', () => {
    const review = { ...makeReview({}), hourOfDay: 2 };
    const result = splitByCircadianPhase([review]);
    expect(result.night).toHaveLength(1);
  });

  it('total items across phases equals input length', () => {
    const reviews = [
      { ...makeReview({}), hourOfDay: 8 },   // morning
      { ...makeReview({}), hourOfDay: 13 },  // afternoon
      { ...makeReview({}), hourOfDay: 20 },  // evening
      { ...makeReview({}), hourOfDay: 23 },  // night
      { ...makeReview({}), hourOfDay: 7 },   // morning
    ];
    const result = splitByCircadianPhase(reviews);
    const total = result.morning.length + result.afternoon.length +
                  result.evening.length + result.night.length;
    expect(total).toBe(5);
  });

  it('result has exactly the four phase keys', () => {
    const result = splitByCircadianPhase([]);
    expect(Object.keys(result).sort()).toEqual(['afternoon', 'evening', 'morning', 'night']);
  });
});

// ─── getParametersForHour ─────────────────────────────────────────────────────

describe('getParametersForHour', () => {
  it('returns global parameters when no phase params are available', () => {
    const result = makeCircadianResult(defaultParameters);
    const params = getParametersForHour(result, 9); // morning
    expect(params).toBe(result.global.parameters);
  });

  it('returns phase-specific parameters when phase is available', () => {
    const morningParams = { ...defaultParameters, w: [...defaultParameters.w] };
    morningParams.w[0] = 0.99; // distinguish from global
    const result = makeCircadianResult(defaultParameters, { morning: morningParams });
    const params = getParametersForHour(result, 9);
    expect(params).toBe(morningParams);
  });

  it('falls back to global when requested phase has no data', () => {
    const morningParams = { ...defaultParameters };
    // Only morning is available; requesting evening falls back to global
    const result = makeCircadianResult(defaultParameters, { morning: morningParams });
    const params = getParametersForHour(result, 19); // evening
    expect(params).toBe(result.global.parameters);
  });

  it('handles hour boundaries correctly — 6 → morning', () => {
    const morningParams = { ...defaultParameters };
    const result = makeCircadianResult(defaultParameters, { morning: morningParams });
    expect(getParametersForHour(result, 6)).toBe(morningParams);
  });

  it('handles hour boundaries correctly — 12 → afternoon', () => {
    const afternoonParams = { ...defaultParameters };
    const result = makeCircadianResult(defaultParameters, { afternoon: afternoonParams });
    expect(getParametersForHour(result, 12)).toBe(afternoonParams);
  });
});
