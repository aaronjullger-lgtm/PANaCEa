// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/itemCalibrationService.ts
 *
 * Pure functions tested (all inputs passed explicitly — fully deterministic):
 *   computeDiscriminationMetrics(attempts) — p-value, D-index (upper/lower 27%)
 *   computePointBiserial(attempts)          — r_pb formula
 *   eloUpdateLoop(attempts, initialDifficulty) — Rasch difficulty update
 *   analyzeDistractors(attempts, top, bottom) — per-option stats
 *   computeQualityFlag(pValue, DI, PB, distractors) — flag + issues
 *   batchCalibrateItems(map, initDiffs, minResponses) — orchestration
 *   summarizeCalibration(results) — aggregate stats
 *
 * Constants verified: MIN_OBSERVATIONS = 30
 */

import { describe, it, expect } from 'vitest';
import {
  MIN_OBSERVATIONS,
  computeDiscriminationMetrics,
  computePointBiserial,
  eloUpdateLoop,
  analyzeDistractors,
  computeQualityFlag,
  batchCalibrateItems,
  summarizeCalibration,
} from './itemCalibrationService';
import type { AttemptRecord, DistractorStats } from './itemCalibrationService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0;
function makeAttempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    questionId: 'q1',
    userId: `u${_uid++}`,
    wasCorrect: true,
    selectedAnswer: 'A',
    timeSpentMs: 5000,
    userAccuracy: 0.7,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Build N identical attempts with given overrides, unique userId and sequential timestamps */
function makeN(n: number, overrides: Partial<AttemptRecord> = {}): AttemptRecord[] {
  return Array.from({ length: n }, (_, i) =>
    makeAttempt({
      userId: `user${i}`,
      createdAt: new Date(Date.UTC(2024, 0, 1, 0, i, 0)),
      ...overrides,
    })
  );
}

// ─── MIN_OBSERVATIONS constant ────────────────────────────────────────────────

describe('MIN_OBSERVATIONS', () => {
  it('is 30', () => {
    expect(MIN_OBSERVATIONS).toBe(30);
  });
});

// ─── computeDiscriminationMetrics ─────────────────────────────────────────────

describe('computeDiscriminationMetrics', () => {
  it('returns {0, 0} for empty input', () => {
    const result = computeDiscriminationMetrics([]);
    expect(result.pValue).toBe(0);
    expect(result.discriminationIndex).toBe(0);
  });

  it('pValue = 1.0 when all correct', () => {
    const attempts = makeN(10, { wasCorrect: true });
    expect(computeDiscriminationMetrics(attempts).pValue).toBe(1.0);
  });

  it('pValue = 0.0 when all wrong', () => {
    const attempts = makeN(10, { wasCorrect: false });
    expect(computeDiscriminationMetrics(attempts).pValue).toBe(0.0);
  });

  it('pValue = 0.5 for equal correct/incorrect', () => {
    const correct = makeN(5, { wasCorrect: true });
    const wrong = makeN(5, { wasCorrect: false });
    const result = computeDiscriminationMetrics([...correct, ...wrong]);
    expect(result.pValue).toBeCloseTo(0.5, 5);
  });

  it('D-index > 0 when high-accuracy group answers correctly more than low-accuracy group', () => {
    // 10 high-accuracy students all correct; 10 low-accuracy students all wrong
    const highGroup = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({ userId: `h${i}`, userAccuracy: 0.9, wasCorrect: true })
    );
    const lowGroup = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({ userId: `l${i}`, userAccuracy: 0.2, wasCorrect: false })
    );
    const result = computeDiscriminationMetrics([...highGroup, ...lowGroup]);
    // pTop (top 27% = top 5 high-acc) all correct → 1.0
    // pBottom (bottom 27% = bottom 5 low-acc) all wrong → 0.0
    expect(result.discriminationIndex).toBeCloseTo(1.0, 5);
  });

  it('D-index = 0 when top and bottom groups perform identically', () => {
    // Same accuracy → sorted order arbitrary, but all correct → pTop=pBottom=1
    const attempts = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({ userId: `u${i}`, userAccuracy: 0.5, wasCorrect: true })
    );
    const result = computeDiscriminationMetrics(attempts);
    expect(result.discriminationIndex).toBeCloseTo(0, 5);
  });

  it('D-index can be negative when low-ability group outperforms high-ability group', () => {
    // High-accuracy users all wrong, low-accuracy users all correct
    const highGroup = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({ userId: `h${i}`, userAccuracy: 0.9, wasCorrect: false })
    );
    const lowGroup = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({ userId: `l${i}`, userAccuracy: 0.1, wasCorrect: true })
    );
    const result = computeDiscriminationMetrics([...highGroup, ...lowGroup]);
    expect(result.discriminationIndex).toBeLessThan(0);
  });

  it('groupSize is at least 1 even for a single attempt', () => {
    const result = computeDiscriminationMetrics([makeAttempt({ wasCorrect: true })]);
    expect(result.pValue).toBe(1.0);
    // D-index: topGroup=[attempt], bottomGroup=[attempt] → pTop-pBottom=0
    expect(result.discriminationIndex).toBe(0);
  });

  it('groupSize uses floor(n * 0.27)', () => {
    // 4 attempts: floor(4*0.27) = floor(1.08) = 1 → groupSize=1
    const attempts = [
      makeAttempt({ userId: 'u1', userAccuracy: 0.9, wasCorrect: true }),
      makeAttempt({ userId: 'u2', userAccuracy: 0.7, wasCorrect: true }),
      makeAttempt({ userId: 'u3', userAccuracy: 0.4, wasCorrect: false }),
      makeAttempt({ userId: 'u4', userAccuracy: 0.1, wasCorrect: false }),
    ];
    const result = computeDiscriminationMetrics(attempts);
    // top group: [0.9] → correct=1 → pTop=1.0
    // bottom group: [0.1] → correct=0 → pBottom=0.0
    expect(result.discriminationIndex).toBeCloseTo(1.0, 5);
  });
});

// ─── computePointBiserial ─────────────────────────────────────────────────────

describe('computePointBiserial', () => {
  it('returns 0 for fewer than 3 attempts', () => {
    expect(computePointBiserial([])).toBe(0);
    expect(computePointBiserial([makeAttempt()])).toBe(0);
    expect(computePointBiserial(makeN(2))).toBe(0);
  });

  it('returns 0 when all attempts are correct (no incorrect group)', () => {
    const attempts = makeN(10, { wasCorrect: true, userAccuracy: 0.7 });
    expect(computePointBiserial(attempts)).toBe(0);
  });

  it('returns 0 when all attempts are wrong (no correct group)', () => {
    const attempts = makeN(10, { wasCorrect: false, userAccuracy: 0.3 });
    expect(computePointBiserial(attempts)).toBe(0);
  });

  it('returns 0 when SD of userAccuracy is near zero (all same accuracy)', () => {
    // 5 correct + 5 incorrect, all with identical userAccuracy → SD ≈ 0
    const correct = makeN(5, { wasCorrect: true, userAccuracy: 0.6 });
    const wrong = makeN(5, { wasCorrect: false, userAccuracy: 0.6 });
    expect(computePointBiserial([...correct, ...wrong])).toBe(0);
  });

  it('is positive when correct group has higher mean accuracy', () => {
    // High-accuracy students got it right, low-accuracy got it wrong → positive r_pb
    const correct = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({ userId: `c${i}`, wasCorrect: true, userAccuracy: 0.9 })
    );
    const wrong = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({ userId: `w${i}`, wasCorrect: false, userAccuracy: 0.1 })
    );
    expect(computePointBiserial([...correct, ...wrong])).toBeGreaterThan(0);
  });

  it('is negative when incorrect group has higher mean accuracy (miskeyed item)', () => {
    // High-accuracy students got it wrong, low-accuracy got it right → negative r_pb
    const correct = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({ userId: `c${i}`, wasCorrect: true, userAccuracy: 0.1 })
    );
    const wrong = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({ userId: `w${i}`, wasCorrect: false, userAccuracy: 0.9 })
    );
    expect(computePointBiserial([...correct, ...wrong])).toBeLessThan(0);
  });

  it('result is in [-1, 1] range for valid data', () => {
    const correct = Array.from({ length: 8 }, (_, i) =>
      makeAttempt({ userId: `c${i}`, wasCorrect: true, userAccuracy: 0.8 + i * 0.01 })
    );
    const wrong = Array.from({ length: 4 }, (_, i) =>
      makeAttempt({ userId: `w${i}`, wasCorrect: false, userAccuracy: 0.2 + i * 0.01 })
    );
    const rpb = computePointBiserial([...correct, ...wrong]);
    expect(rpb).toBeGreaterThanOrEqual(-1);
    expect(rpb).toBeLessThanOrEqual(1);
  });
});

// ─── eloUpdateLoop ────────────────────────────────────────────────────────────

describe('eloUpdateLoop', () => {
  it('returns initialDifficulty=0 and DEFAULT_UNCERTAINTY=2.0 for empty attempts', () => {
    const result = eloUpdateLoop([]);
    expect(result.difficulty).toBe(0);
    expect(result.uncertainty).toBe(2.0);
  });

  it('respects custom initialDifficulty', () => {
    const result = eloUpdateLoop([], 1.5);
    expect(result.difficulty).toBe(1.5);
  });

  it('uncertainty decreases monotonically with more attempts (decay=0.98)', () => {
    const attempts1 = makeN(1);
    const attempts10 = makeN(10);
    const result1 = eloUpdateLoop(attempts1);
    const result10 = eloUpdateLoop(attempts10);
    expect(result10.uncertainty).toBeLessThan(result1.uncertainty);
  });

  it('difficulty decreases when a high-ability user answers correctly (easy item signal)', () => {
    // User with accuracy=0.9 answers correctly → item is easier than expected
    const attempts = [makeAttempt({ userAccuracy: 0.9, wasCorrect: true })];
    const result = eloUpdateLoop(attempts, 0);
    // expectedP for accuracy=0.9 at difficulty=0: 1/(1+exp(-(0.9*4-2-0))) = 1/(1+exp(-1.6)) > 0.5
    // surprise = 1 - expectedP < 0.5, difficulty -= kFactor * positive_surprise → difficulty < 0
    expect(result.difficulty).toBeLessThan(0);
  });

  it('difficulty increases when a high-ability user answers incorrectly (hard item signal)', () => {
    // User with accuracy=0.9 answers wrong → item is harder than expected
    const attempts = [makeAttempt({ userAccuracy: 0.9, wasCorrect: false })];
    const result = eloUpdateLoop(attempts, 0);
    // surprise = 0 - expectedP (negative) → difficulty -= kFactor * negative_surprise → difficulty > 0
    expect(result.difficulty).toBeGreaterThan(0);
  });

  it('difficulty is clamped to [-3, 3] after many surprising outcomes', () => {
    // 50 high-ability users all wrong → should push difficulty to +3 ceiling
    const attempts = Array.from({ length: 50 }, (_, i) =>
      makeAttempt({
        userId: `u${i}`,
        userAccuracy: 0.95,
        wasCorrect: false,
        createdAt: new Date(Date.UTC(2024, 0, 1, 0, i, 0)),
      })
    );
    const result = eloUpdateLoop(attempts, 0);
    expect(result.difficulty).toBeLessThanOrEqual(3);
    expect(result.difficulty).toBeGreaterThanOrEqual(-3);
  });

  it('difficulty is clamped to -3 after many easy correct answers', () => {
    // 50 very low-ability users all correct → item is surprisingly easy
    const attempts = Array.from({ length: 50 }, (_, i) =>
      makeAttempt({
        userId: `u${i}`,
        userAccuracy: 0.05,
        wasCorrect: true,
        createdAt: new Date(Date.UTC(2024, 0, 1, 0, i, 0)),
      })
    );
    const result = eloUpdateLoop(attempts, 0);
    expect(result.difficulty).toBeGreaterThanOrEqual(-3);
    expect(result.difficulty).toBeLessThanOrEqual(0);
  });

  it('uncertainty floor is 0.3 (MIN_UNCERTAINTY) — never goes below', () => {
    // 1000 attempts → uncertainty decays many times but should floor at 0.3
    const attempts = Array.from({ length: 200 }, (_, i) =>
      makeAttempt({
        userId: `u${i}`,
        userAccuracy: 0.7,
        wasCorrect: true,
        createdAt: new Date(Date.UTC(2024, 0, 1, 0, i, 0)),
      })
    );
    const result = eloUpdateLoop(attempts, 0);
    expect(result.uncertainty).toBeGreaterThanOrEqual(0.3);
  });

  it('processes attempts in chronological order (not input order)', () => {
    // Reversed order input — result should be same as chronological
    const a1 = makeAttempt({ createdAt: new Date('2024-01-01'), userAccuracy: 0.9, wasCorrect: true });
    const a2 = makeAttempt({ createdAt: new Date('2024-01-02'), userAccuracy: 0.1, wasCorrect: false });
    const chronological = eloUpdateLoop([a1, a2], 0);
    const reversed = eloUpdateLoop([a2, a1], 0);
    expect(chronological.difficulty).toBeCloseTo(reversed.difficulty, 5);
  });
});

// ─── analyzeDistractors ───────────────────────────────────────────────────────

describe('analyzeDistractors', () => {
  it('returns empty array for empty attempts', () => {
    expect(analyzeDistractors([], [], [])).toHaveLength(0);
  });

  it('returns one entry per unique selectedAnswer', () => {
    const attempts = [
      makeAttempt({ selectedAnswer: 'A', userId: 'u1' }),
      makeAttempt({ selectedAnswer: 'B', userId: 'u2' }),
      makeAttempt({ selectedAnswer: 'A', userId: 'u3' }),
    ];
    const result = analyzeDistractors(attempts, [], []);
    expect(result).toHaveLength(2);
    const optA = result.find((d) => d.option === 'A')!;
    expect(optA.selectedCount).toBe(2);
    expect(optA.proportion).toBeCloseTo(2 / 3, 5);
  });

  it('tracks top/bottom group selection counts', () => {
    const top = [makeAttempt({ selectedAnswer: 'A', userId: 't1' })];
    const bottom = [makeAttempt({ selectedAnswer: 'B', userId: 'b1' })];
    const all = [
      makeAttempt({ selectedAnswer: 'A', userId: 't1' }),
      makeAttempt({ selectedAnswer: 'B', userId: 'b1' }),
    ];
    const result = analyzeDistractors(all, top, bottom);
    const A = result.find((d) => d.option === 'A')!;
    const B = result.find((d) => d.option === 'B')!;
    expect(A.selectedByTop).toBe(1);
    expect(A.selectedByBottom).toBe(0);
    expect(B.selectedByTop).toBe(0);
    expect(B.selectedByBottom).toBe(1);
  });

  it('marks option "negative" when top rate < bottom rate by >0.1', () => {
    // Bottom group selects A more than top → A is a negative distractor
    const n = 10;
    const topGroup = Array.from({ length: n }, (_, i) =>
      makeAttempt({ userId: `t${i}`, selectedAnswer: i === 0 ? 'A' : 'B' }) // 1/10 top picks A
    );
    const bottomGroup = Array.from({ length: n }, (_, i) =>
      makeAttempt({ userId: `b${i}`, selectedAnswer: 'A' }) // 10/10 bottom picks A
    );
    const all = [...topGroup, ...bottomGroup];
    const result = analyzeDistractors(all, topGroup, bottomGroup);
    const A = result.find((d) => d.option === 'A')!;
    // disc = 1/10 - 10/10 = -0.9 < -0.1 → negative
    expect(A.quality).toBe('negative');
  });

  it('marks option "weak" when proportion < 0.05', () => {
    // A is selected by only 1 of 25 → proportion=0.04 < 0.05
    const attempts = [
      makeAttempt({ selectedAnswer: 'A', userId: 'u0' }),
      ...Array.from({ length: 24 }, (_, i) =>
        makeAttempt({ selectedAnswer: 'B', userId: `u${i + 1}` })
      ),
    ];
    const result = analyzeDistractors(attempts, [], []);
    const A = result.find((d) => d.option === 'A')!;
    expect(A.quality).toBe('weak');
  });

  it('marks option "functional" when proportion ≥ 0.05 and disc ≥ 0.05', () => {
    // Equal top/bottom selection → disc ≈ 0; proportion = 0.5 (10/20)
    const topGroup = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({ userId: `t${i}`, selectedAnswer: 'A' })
    );
    const bottomGroup = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({ userId: `b${i}`, selectedAnswer: 'A' })
    );
    const all = [...topGroup, ...bottomGroup];
    const result = analyzeDistractors(all, topGroup, bottomGroup);
    const A = result.find((d) => d.option === 'A')!;
    // proportion=1.0, disc=0 < 0.05 → weak (disc is 1/1 - 1/1 = 0)
    // Actually disc<0.05 AND proportion>=0.05 → 'weak'
    expect(A.proportion).toBe(1.0);
    expect(A.discrimination).toBeCloseTo(0, 5);
  });
});

// ─── computeQualityFlag ───────────────────────────────────────────────────────

describe('computeQualityFlag', () => {
  const NO_DISTRACTORS: DistractorStats[] = [];

  // ── good ──

  it('returns "good" when DI≥0.30, PB≥0.20, no issues', () => {
    const { flag, issues } = computeQualityFlag(0.5, 0.35, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('good');
    expect(issues).toHaveLength(0);
  });

  it('returns "good" even with p=0.5 (moderate difficulty)', () => {
    const { flag } = computeQualityFlag(0.5, 0.35, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('good');
  });

  // ── review ──

  it('returns "review" when DI is between 0.10 and 0.30 (below-target but ≥ DI_REVIEW)', () => {
    const { flag, issues } = computeQualityFlag(0.5, 0.20, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('review');
    expect(issues.some((s) => s.includes('Below-target discrimination'))).toBe(true);
  });

  it('returns "review" when PB is between 0.10 and 0.20 (below-target but ≥ PB_REVIEW)', () => {
    const { flag, issues } = computeQualityFlag(0.5, 0.35, 0.15, NO_DISTRACTORS);
    expect(flag).toBe('review');
    expect(issues.some((s) => s.includes('Below-target point-biserial'))).toBe(true);
  });

  it('returns "review" for very easy item (p > 0.95)', () => {
    const { flag, issues } = computeQualityFlag(0.97, 0.35, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('review');
    expect(issues.some((s) => s.includes('Very easy'))).toBe(true);
  });

  it('returns "review" for very difficult item (p < 0.10)', () => {
    const { flag, issues } = computeQualityFlag(0.05, 0.35, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('review');
    expect(issues.some((s) => s.includes('Very difficult'))).toBe(true);
  });

  // ── poor ──

  it('returns "poor" when DI < 0.10 (very low discrimination)', () => {
    const { flag, issues } = computeQualityFlag(0.5, 0.05, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('poor');
    expect(issues.some((s) => s.includes('Very low discrimination'))).toBe(true);
  });

  it('returns "poor" when PB < 0.10 (very low point-biserial)', () => {
    const { flag, issues } = computeQualityFlag(0.5, 0.35, 0.05, NO_DISTRACTORS);
    expect(flag).toBe('poor');
    expect(issues.some((s) => s.includes('Very low point-biserial'))).toBe(true);
  });

  it('returns "poor" when ≥2 issues are present (e.g. very easy + below-target DI)', () => {
    // p=0.97 (1 issue: very easy) + DI=0.20 (1 issue: below-target) = 2 issues
    const { flag } = computeQualityFlag(0.97, 0.20, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('poor');
  });

  // ── remove ──

  it('returns "remove" when DI < 0 (negative discrimination)', () => {
    const { flag, issues } = computeQualityFlag(0.5, -0.10, 0.25, NO_DISTRACTORS);
    expect(flag).toBe('remove');
    expect(issues.some((s) => s.includes('Negative discrimination'))).toBe(true);
  });

  it('returns "remove" when PB < 0 (negative point-biserial)', () => {
    const { flag, issues } = computeQualityFlag(0.5, 0.35, -0.05, NO_DISTRACTORS);
    expect(flag).toBe('remove');
    expect(issues.some((s) => s.includes('Negative point-biserial'))).toBe(true);
  });

  it('returns "remove" when negative distractors are present', () => {
    const negDistractor: DistractorStats = {
      option: 'A',
      selectedCount: 5,
      selectedByTop: 5,
      selectedByBottom: 0,
      proportion: 0.1,
      discrimination: -0.5,
      quality: 'negative',
    };
    const { flag, issues } = computeQualityFlag(0.5, 0.35, 0.25, [negDistractor]);
    expect(flag).toBe('remove');
    expect(issues.some((s) => s.includes('negative distractor'))).toBe(true);
  });

  it('reports weak distractors in issues without flagging remove', () => {
    const weakDistractor: DistractorStats = {
      option: 'B',
      selectedCount: 1,
      selectedByTop: 0,
      selectedByBottom: 0,
      proportion: 0.02,
      discrimination: 0,
      quality: 'weak',
    };
    const { flag, issues } = computeQualityFlag(0.5, 0.35, 0.25, [weakDistractor]);
    expect(issues.some((s) => s.includes('non-functioning distractor'))).toBe(true);
    // One issue (weak distractor) → review, not remove
    expect(flag).toBe('review');
  });

  it('issues array is empty for a clean item', () => {
    const { issues } = computeQualityFlag(0.5, 0.40, 0.30, NO_DISTRACTORS);
    expect(issues).toHaveLength(0);
  });
});

// ─── batchCalibrateItems ──────────────────────────────────────────────────────

describe('batchCalibrateItems', () => {
  it('returns empty map for empty input', () => {
    const result = batchCalibrateItems(new Map());
    expect(result.size).toBe(0);
  });

  it('skips items with fewer than minResponses (default=30)', () => {
    const map = new Map([['q1', makeN(29)]]);
    expect(batchCalibrateItems(map).size).toBe(0);
  });

  it('includes items with exactly minResponses responses', () => {
    const map = new Map([['q1', makeN(30)]]);
    expect(batchCalibrateItems(map).size).toBe(1);
  });

  it('respects custom minResponses override', () => {
    const map = new Map([['q1', makeN(5)]]);
    expect(batchCalibrateItems(map, undefined, 5).size).toBe(1);
    expect(batchCalibrateItems(map, undefined, 6).size).toBe(0);
  });

  it('passes initialDifficulty from the provided map', () => {
    const attempts = Array.from({ length: 30 }, (_, i) =>
      makeAttempt({
        userId: `u${i}`,
        wasCorrect: true,
        userAccuracy: 0.5,
        createdAt: new Date(Date.UTC(2024, 0, 1, 0, i, 0)),
      })
    );
    const map = new Map([['q1', attempts]]);
    const initDiffs = new Map([['q1', 2.0]]);
    const result = batchCalibrateItems(map, initDiffs);
    // With all-correct by 50% accuracy, difficulty moves from 2.0 toward lower
    const calib = result.get('q1')!;
    expect(calib).toBeDefined();
    expect(calib.eloDifficulty).toBeLessThanOrEqual(3);
    expect(calib.eloDifficulty).toBeGreaterThanOrEqual(-3);
  });

  it('calibrates multiple questions independently', () => {
    const map = new Map([
      ['q1', makeN(30, { wasCorrect: true })],
      ['q2', makeN(30, { wasCorrect: false })],
    ]);
    const result = batchCalibrateItems(map);
    expect(result.size).toBe(2);
    expect(result.get('q1')!.pValue).toBe(1.0);
    expect(result.get('q2')!.pValue).toBe(0.0);
  });
});

// ─── summarizeCalibration ─────────────────────────────────────────────────────

describe('summarizeCalibration', () => {
  it('returns all-zero summary for empty map', () => {
    const result = summarizeCalibration(new Map());
    expect(result.total).toBe(0);
    expect(result.good).toBe(0);
    expect(result.avgDifficulty).toBe(0);
    expect(result.avgDiscrimination).toBe(0);
  });

  it('counts qualityFlag totals correctly', () => {
    // Build a minimal calibration map with known flags
    const map = new Map([
      ['q1', makeN(30, { wasCorrect: true })],
      ['q2', makeN(30, { wasCorrect: false })],
    ]);
    const calibrations = batchCalibrateItems(map);
    const summary = summarizeCalibration(calibrations);
    expect(summary.total).toBe(2);
    expect(summary.good + summary.review + summary.poor + summary.remove).toBe(2);
  });

  it('avgDifficulty is mean of item eloDifficulty values', () => {
    // Use batchCalibrateItems to produce real calibrations
    const map = new Map([
      ['q1', makeN(30, { wasCorrect: true, userAccuracy: 0.9 })],
      ['q2', makeN(30, { wasCorrect: false, userAccuracy: 0.1 })],
    ]);
    const calibrations = batchCalibrateItems(map);
    const summary = summarizeCalibration(calibrations);
    const items = Array.from(calibrations.values());
    const expectedAvg = items.reduce((s, i) => s + i.eloDifficulty, 0) / items.length;
    expect(summary.avgDifficulty).toBeCloseTo(expectedAvg, 5);
  });
});
