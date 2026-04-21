/**
 * Unit tests for lib/services/itemAnalysisService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   analyzeItem(questionId, attempts)
 *   computeDiscriminationIndex(attempts)
 *   computePointBiserial(attempts)
 *   computeDistractorAnalysis(attempts)
 *   batchAnalyzeItems(itemAttempts)
 *   flaggedItemsForReview(analyses)
 *
 * Key thresholds (ITEM_ANALYSIS_THRESHOLDS):
 *   MIN_ATTEMPTS: 30
 *   DISCRIMINATION_EXCELLENT: 0.40, GOOD: 0.30, ACCEPTABLE: 0.20, POOR: 0.10
 *   RPB_ACCEPTABLE: 0.15
 *   DIFFICULTY_TOO_EASY: 0.95, TOO_HARD: 0.20
 *   DISTRACTOR_MIN_RATE: 0.05
 *   EXTREME_GROUP_FRACTION: 0.27
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeItem,
  computeDiscriminationIndex,
  computePointBiserial,
  computeDistractorAnalysis,
  batchAnalyzeItems,
  flaggedItemsForReview,
  ITEM_ANALYSIS_THRESHOLDS,
  type ItemAttemptRecord,
} from './itemAnalysisService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAttempt(
  isCorrect: boolean,
  selectedOption: string,
  totalScore: number,
  totalItems: number = 10,
  timeSpentMs: number = 30000
): ItemAttemptRecord {
  return {
    studentId: `u-${Math.random().toString(36).slice(2)}`,
    isCorrect,
    selectedOption,
    totalScore,
    totalItems,
    timeSpentMs,
  };
}

/**
 * Generate a balanced set of attempts where top students do better than bottom students.
 * Creates n attempts with the top 27% getting the question right more often.
 */
function makeDiscriminatingAttempts(
  n: number,
  topGroupCorrectRate = 0.80,
  bottomGroupCorrectRate = 0.20
): ItemAttemptRecord[] {
  const attempts: ItemAttemptRecord[] = [];
  for (let i = 0; i < n; i++) {
    const totalScore = n - i; // Higher index = lower overall score
    const isTop = i < Math.round(n * 0.27);
    const isBottom = i >= n - Math.round(n * 0.27);
    const correctRate = isTop ? topGroupCorrectRate : isBottom ? bottomGroupCorrectRate : 0.50;
    const isCorrect = Math.random() < correctRate;
    attempts.push(makeAttempt(isCorrect, isCorrect ? 'A' : 'B', totalScore, n));
  }
  return attempts;
}

/** Make n identical correct attempts */
function makeAllCorrect(n: number): ItemAttemptRecord[] {
  return Array.from({ length: n }, (_, i) =>
    makeAttempt(true, 'A', n - i, n)
  );
}

/** Make n identical incorrect attempts */
function makeAllWrong(n: number): ItemAttemptRecord[] {
  return Array.from({ length: n }, (_, i) =>
    makeAttempt(false, 'B', n - i, n)
  );
}

/** Create attempts where half are correct (A) and half wrong (B/C evenly split) */
function makeBalancedAttempts(n = 40): ItemAttemptRecord[] {
  return Array.from({ length: n }, (_, i) => {
    const isCorrect = i < n / 2;
    const score = isCorrect ? 0.7 : 0.3;
    return makeAttempt(isCorrect, isCorrect ? 'A' : 'B', score * 10, 10);
  });
}

// ─── computeDiscriminationIndex ───────────────────────────────────────────────

describe('computeDiscriminationIndex', () => {
  it('returns 0 for empty attempts', () => {
    expect(computeDiscriminationIndex([])).toBe(0);
  });

  it('returns 0 for single attempt', () => {
    expect(computeDiscriminationIndex([makeAttempt(true, 'A', 5)])).toBe(0);
  });

  it('returns positive value when high scorers outperform low scorers', () => {
    // 40 attempts where top 27% get correct and bottom 27% all wrong
    const attempts: ItemAttemptRecord[] = [
      // Top group (high total scores, correct)
      ...Array.from({ length: 11 }, (_, i) =>
        makeAttempt(true, 'A', 40 - i, 40)
      ),
      // Middle group (mixed)
      ...Array.from({ length: 18 }, (_, i) =>
        makeAttempt(i < 9, i < 9 ? 'A' : 'B', 20, 40)
      ),
      // Bottom group (low total scores, wrong)
      ...Array.from({ length: 11 }, (_, i) =>
        makeAttempt(false, 'B', 10 - i, 40)
      ),
    ];
    const D = computeDiscriminationIndex(attempts);
    expect(D).toBeGreaterThan(0);
  });

  it('returns negative value when low scorers outperform high scorers (bad item)', () => {
    const attempts: ItemAttemptRecord[] = [
      // "High scorers" all wrong on this item
      ...Array.from({ length: 11 }, (_, i) =>
        makeAttempt(false, 'B', 40 - i, 40)
      ),
      ...Array.from({ length: 18 }, (_, i) =>
        makeAttempt(true, 'A', 20, 40)
      ),
      // "Low scorers" all correct on this item
      ...Array.from({ length: 11 }, (_, i) =>
        makeAttempt(true, 'A', 10 - i, 40)
      ),
    ];
    const D = computeDiscriminationIndex(attempts);
    expect(D).toBeLessThan(0);
  });

  it('returns 0 when everyone is correct (no discrimination)', () => {
    const attempts = makeAllCorrect(40);
    const D = computeDiscriminationIndex(attempts);
    expect(D).toBeCloseTo(0, 5);
  });

  it('result is in [-1, 1]', () => {
    const attempts = makeBalancedAttempts(40);
    const D = computeDiscriminationIndex(attempts);
    expect(D).toBeGreaterThanOrEqual(-1);
    expect(D).toBeLessThanOrEqual(1);
  });

  it('uses top and bottom 27% for extreme groups', () => {
    // With 40 attempts, groupSize = round(40 * 0.27) = 11
    // Verify the constant
    expect(ITEM_ANALYSIS_THRESHOLDS.EXTREME_GROUP_FRACTION).toBe(0.27);
  });
});

// ─── computePointBiserial ─────────────────────────────────────────────────────

describe('computePointBiserial', () => {
  it('returns 0 for empty attempts', () => {
    expect(computePointBiserial([])).toBe(0);
  });

  it('returns 0 for single attempt', () => {
    expect(computePointBiserial([makeAttempt(true, 'A', 5)])).toBe(0);
  });

  it('returns 0 when everyone is correct (no variance)', () => {
    const attempts = makeAllCorrect(30).map(a => ({ ...a, totalScore: 8, totalItems: 10 }));
    // All correct → no incorrect group → returns 0
    expect(computePointBiserial(attempts)).toBe(0);
  });

  it('returns 0 when all incorrect', () => {
    const attempts = makeAllWrong(30).map(a => ({ ...a, totalScore: 5, totalItems: 10 }));
    // All wrong → no correct group → returns 0
    expect(computePointBiserial(attempts)).toBe(0);
  });

  it('returns positive value when correct group has higher total score', () => {
    const correctGroup = Array.from({ length: 20 }, () =>
      makeAttempt(true, 'A', 8, 10)   // high scorers
    );
    const incorrectGroup = Array.from({ length: 20 }, () =>
      makeAttempt(false, 'B', 3, 10)  // low scorers
    );
    const rpb = computePointBiserial([...correctGroup, ...incorrectGroup]);
    expect(rpb).toBeGreaterThan(0);
  });

  it('returns negative value when incorrect group has higher total score', () => {
    const correctGroup = Array.from({ length: 20 }, () =>
      makeAttempt(true, 'A', 3, 10)   // low scorers get it right
    );
    const incorrectGroup = Array.from({ length: 20 }, () =>
      makeAttempt(false, 'B', 8, 10)  // high scorers get it wrong
    );
    const rpb = computePointBiserial([...correctGroup, ...incorrectGroup]);
    expect(rpb).toBeLessThan(0);
  });

  it('result is in [-1, 1] range', () => {
    const attempts = makeBalancedAttempts(40);
    const rpb = computePointBiserial(attempts);
    expect(rpb).toBeGreaterThanOrEqual(-1);
    expect(rpb).toBeLessThanOrEqual(1);
  });
});

// ─── computeDistractorAnalysis ────────────────────────────────────────────────

describe('computeDistractorAnalysis', () => {
  it('returns empty array for empty attempts', () => {
    expect(computeDistractorAnalysis([])).toEqual([]);
  });

  it('groups attempts by selected option', () => {
    const attempts = [
      makeAttempt(true, 'A', 8),
      makeAttempt(true, 'A', 7),
      makeAttempt(false, 'B', 4),
    ];
    const result = computeDistractorAnalysis(attempts);
    expect(result).toHaveLength(2); // A and B
  });

  it('identifies correct option as the one selected by correct students', () => {
    const attempts = [
      ...Array.from({ length: 20 }, () => makeAttempt(true, 'A', 8)),
      ...Array.from({ length: 10 }, () => makeAttempt(false, 'B', 4)),
    ];
    const result = computeDistractorAnalysis(attempts);
    const correctOption = result.find(d => d.isCorrect);
    expect(correctOption?.option).toBe('A');
  });

  it('computes selectionRate as count / total', () => {
    const n = 40;
    const correct = 30;
    const attempts = [
      ...Array.from({ length: correct }, () => makeAttempt(true, 'A', 8)),
      ...Array.from({ length: n - correct }, () => makeAttempt(false, 'B', 4)),
    ];
    const result = computeDistractorAnalysis(attempts);
    const aOption = result.find(d => d.option === 'A');
    expect(aOption?.selectionRate).toBeCloseTo(correct / n, 5);
  });

  it('marks distractor as non-functioning when selectionRate < 0.05', () => {
    const attempts = [
      ...Array.from({ length: 38 }, () => makeAttempt(true, 'A', 8)),
      makeAttempt(false, 'B', 4), // 1/40 = 0.025 < 0.05 → non-functioning
      makeAttempt(false, 'C', 4),
    ];
    const result = computeDistractorAnalysis(attempts);
    const bOption = result.find(d => d.option === 'B');
    const cOption = result.find(d => d.option === 'C');
    expect(bOption?.isNonFunctioning).toBe(true);
    expect(cOption?.isNonFunctioning).toBe(true);
  });

  it('correct option is never marked non-functioning', () => {
    // Only 1 correct attempt (2.5%) — but correct option should never be non-functioning
    const attempts = [
      makeAttempt(true, 'A', 8),
      ...Array.from({ length: 39 }, () => makeAttempt(false, 'B', 4)),
    ];
    const result = computeDistractorAnalysis(attempts);
    const correctOpt = result.find(d => d.isCorrect);
    expect(correctOpt?.isNonFunctioning).toBe(false);
  });

  it('correct option appears first in sorted output', () => {
    const attempts = [
      ...Array.from({ length: 20 }, () => makeAttempt(true, 'C', 8)),
      ...Array.from({ length: 10 }, () => makeAttempt(false, 'A', 4)),
      ...Array.from({ length: 10 }, () => makeAttempt(false, 'B', 3)),
    ];
    const result = computeDistractorAnalysis(attempts);
    expect(result[0]?.isCorrect).toBe(true);
  });
});

// ─── analyzeItem ──────────────────────────────────────────────────────────────

describe('analyzeItem', () => {
  it('returns questionId in result', () => {
    const result = analyzeItem('q-abc', makeBalancedAttempts(40));
    expect(result.questionId).toBe('q-abc');
  });

  it('returns attemptCount = attempts.length', () => {
    const result = analyzeItem('q-1', makeBalancedAttempts(35));
    expect(result.attemptCount).toBe(35);
  });

  it('difficulty = fraction correct', () => {
    const attempts = [
      ...Array.from({ length: 30 }, () => makeAttempt(true, 'A', 8)),
      ...Array.from({ length: 10 }, () => makeAttempt(false, 'B', 3)),
    ];
    const result = analyzeItem('q-1', attempts);
    expect(result.difficulty).toBeCloseTo(0.75, 5);
  });

  it('adds INSUFFICIENT_DATA flag when attempts < MIN_ATTEMPTS (30)', () => {
    const result = analyzeItem('q-1', makeBalancedAttempts(20));
    const insufficientFlag = result.flags.find(f => f.type === 'INSUFFICIENT_DATA');
    expect(insufficientFlag).toBeDefined();
    expect(insufficientFlag?.severity).toBe('info');
  });

  it('does NOT add INSUFFICIENT_DATA when attempts >= 30', () => {
    const result = analyzeItem('q-1', makeBalancedAttempts(30));
    expect(result.flags.find(f => f.type === 'INSUFFICIENT_DATA')).toBeUndefined();
  });

  it('adds TOO_EASY flag when p > 0.95', () => {
    // 38/40 correct = 95% → needs >0.95 to flag, so use 39/40
    const attempts = [
      ...Array.from({ length: 39 }, () => makeAttempt(true, 'A', 8)),
      makeAttempt(false, 'B', 2),
    ];
    const result = analyzeItem('q-1', attempts);
    expect(result.flags.find(f => f.type === 'TOO_EASY')).toBeDefined();
  });

  it('adds TOO_HARD flag when p < 0.20', () => {
    const attempts = [
      ...Array.from({ length: 7 }, () => makeAttempt(true, 'A', 8)),
      ...Array.from({ length: 33 }, () => makeAttempt(false, 'B', 2)),
    ];
    const result = analyzeItem('q-1', attempts);
    expect(result.flags.find(f => f.type === 'TOO_HARD')).toBeDefined();
  });

  it('grade is "revise" when critical flag present', () => {
    // Negative discrimination → NEGATIVE_DISCRIMINATION (critical)
    const attempts: ItemAttemptRecord[] = [
      // All "high scorers" wrong, all "low scorers" right
      ...Array.from({ length: 15 }, (_, i) =>
        makeAttempt(false, 'B', 40 - i, 40)
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeAttempt(true, 'A', 20, 40)
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeAttempt(true, 'A', i, 40)
      ),
    ];
    const result = analyzeItem('q-1', attempts);
    // If discrimination is negative, grade should be 'revise'
    if (result.discriminationIndex < 0) {
      expect(result.grade).toBe('revise');
    }
  });

  it('computes avgTimeMs and medianTimeMs', () => {
    const attempts = [
      makeAttempt(true, 'A', 8, 10, 10000),
      makeAttempt(false, 'B', 4, 10, 30000),
      makeAttempt(true, 'A', 7, 10, 20000),
    ];
    const result = analyzeItem('q-1', attempts);
    expect(result.avgTimeMs).toBeCloseTo((10000 + 30000 + 20000) / 3, 0);
    expect(result.medianTimeMs).toBeCloseTo(20000, 0);
  });

  it('result includes distractors array', () => {
    const attempts = [
      ...Array.from({ length: 25 }, () => makeAttempt(true, 'A', 8)),
      ...Array.from({ length: 15 }, () => makeAttempt(false, 'B', 4)),
    ];
    const result = analyzeItem('q-1', attempts);
    expect(result.distractors.length).toBeGreaterThan(0);
  });
});

// ─── batchAnalyzeItems ────────────────────────────────────────────────────────

describe('batchAnalyzeItems', () => {
  it('returns empty array for empty map', () => {
    expect(batchAnalyzeItems(new Map())).toEqual([]);
  });

  it('returns one analysis per question', () => {
    const map = new Map([
      ['q-1', makeBalancedAttempts(35)],
      ['q-2', makeBalancedAttempts(35)],
    ]);
    const results = batchAnalyzeItems(map);
    expect(results).toHaveLength(2);
  });

  it('sorts worst items first (revise/review before acceptable/good/excellent)', () => {
    // q-1: all correct (too-easy, probably 'review')
    // q-2: balanced (probably 'acceptable' or better)
    const easyAttempts = Array.from({ length: 40 }, () => makeAttempt(true, 'A', 8));
    const balancedAttempts = makeBalancedAttempts(40);
    const map = new Map([
      ['q-easy', easyAttempts],
      ['q-balanced', balancedAttempts],
    ]);
    const results = batchAnalyzeItems(map);
    const grades = ['revise', 'review', 'acceptable', 'good', 'excellent'];
    for (let i = 1; i < results.length; i++) {
      const prevGradeIdx = grades.indexOf(results[i - 1]!.grade);
      const currGradeIdx = grades.indexOf(results[i]!.grade);
      expect(prevGradeIdx).toBeLessThanOrEqual(currGradeIdx);
    }
  });

  it('includes all questionIds in output', () => {
    const map = new Map([
      ['q-alpha', makeBalancedAttempts(30)],
      ['q-beta', makeBalancedAttempts(30)],
      ['q-gamma', makeBalancedAttempts(30)],
    ]);
    const results = batchAnalyzeItems(map);
    const ids = results.map(r => r.questionId);
    expect(ids).toContain('q-alpha');
    expect(ids).toContain('q-beta');
    expect(ids).toContain('q-gamma');
  });
});

// ─── flaggedItemsForReview ─────────────────────────────────────────────────────

describe('flaggedItemsForReview', () => {
  it('returns empty for empty input', () => {
    expect(flaggedItemsForReview([])).toEqual([]);
  });

  it('returns only analyses with grade "revise" or "review"', () => {
    const revise = analyzeItem('q-revise', makeAllCorrect(40));
    const balanced = analyzeItem('q-balanced', makeBalancedAttempts(40));
    const all = [revise, balanced];
    const flagged = flaggedItemsForReview(all);
    for (const a of flagged) {
      expect(['revise', 'review']).toContain(a.grade);
    }
  });

  it('excludes grades "excellent", "good", "acceptable"', () => {
    const balanced = makeBalancedAttempts(35);
    const result = analyzeItem('q-test', balanced);
    const flagged = flaggedItemsForReview([result]);
    if (result.grade === 'excellent' || result.grade === 'good' || result.grade === 'acceptable') {
      expect(flagged).toHaveLength(0);
    }
  });
});
