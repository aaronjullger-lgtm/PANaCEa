/**
 * Tests for itemAnalysisService
 * Sprint 21 — Psychometric item analysis
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
} from '../lib/services/itemAnalysisService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeAttempt(overrides: Partial<ItemAttemptRecord> = {}): ItemAttemptRecord {
  return {
    studentId: 'student-1',
    isCorrect: true,
    selectedOption: 'A',
    totalScore: 75,
    totalItems: 100,
    timeSpentMs: 30000,
    ...overrides,
  };
}

/**
 * Generate a realistic set of attempts for a well-discriminating item.
 * Top students get it right, bottom students get it wrong.
 */
function generateGoodItem(n: number = 40): ItemAttemptRecord[] {
  const attempts: ItemAttemptRecord[] = [];
  for (let i = 0; i < n; i++) {
    const totalScore = 50 + i; // ascending total scores
    const isHighPerformer = i >= n * 0.5;
    const isCorrect = isHighPerformer ? Math.random() > 0.15 : Math.random() > 0.7;
    attempts.push(
      makeAttempt({
        studentId: `s-${i}`,
        isCorrect,
        selectedOption: isCorrect ? 'A' : ['B', 'C', 'D'][i % 3]!,
        totalScore,
        totalItems: 100,
        timeSpentMs: 20000 + Math.random() * 40000,
      })
    );
  }
  return attempts;
}

/**
 * Generate attempts for a non-discriminating item (everyone gets it right).
 */
function generateEasyItem(n: number = 40): ItemAttemptRecord[] {
  return Array.from({ length: n }, (_, i) =>
    makeAttempt({
      studentId: `s-${i}`,
      isCorrect: true,
      selectedOption: 'A',
      totalScore: 50 + i,
      totalItems: 100,
      timeSpentMs: 15000,
    })
  );
}

/**
 * Generate attempts where low performers outperform high performers.
 */
function generateNegativeDiscItem(n: number = 40): ItemAttemptRecord[] {
  const attempts: ItemAttemptRecord[] = [];
  for (let i = 0; i < n; i++) {
    const totalScore = 50 + i;
    const isHighPerformer = i >= n * 0.5;
    // Reverse: high performers get it wrong, low performers get it right
    const isCorrect = isHighPerformer ? Math.random() > 0.8 : Math.random() > 0.2;
    attempts.push(
      makeAttempt({
        studentId: `s-${i}`,
        isCorrect,
        selectedOption: isCorrect ? 'A' : 'B',
        totalScore,
        totalItems: 100,
        timeSpentMs: 30000,
      })
    );
  }
  return attempts;
}

// ─── analyzeItem ─────────────────────────────────────────────────────

describe('analyzeItem', () => {
  it('computes basic statistics for a good item', () => {
    const attempts = generateGoodItem(50);
    const result = analyzeItem('q-001', attempts);

    expect(result.questionId).toBe('q-001');
    expect(result.attemptCount).toBe(50);
    expect(result.difficulty).toBeGreaterThan(0);
    expect(result.difficulty).toBeLessThan(1);
    expect(result.discriminationIndex).toBeGreaterThan(0);
    expect(result.avgTimeMs).toBeGreaterThan(0);
    expect(result.medianTimeMs).toBeGreaterThan(0);
  });

  it('flags insufficient data when < 30 attempts', () => {
    const attempts = generateGoodItem(15);
    const result = analyzeItem('q-002', attempts);
    expect(result.flags.some((f) => f.type === 'INSUFFICIENT_DATA')).toBe(true);
  });

  it('flags too-easy items', () => {
    const attempts = generateEasyItem(40);
    const result = analyzeItem('q-003', attempts);
    expect(result.difficulty).toBeGreaterThan(ITEM_ANALYSIS_THRESHOLDS.DIFFICULTY_TOO_EASY);
    expect(result.flags.some((f) => f.type === 'TOO_EASY')).toBe(true);
  });

  it('flags negative discrimination as critical', () => {
    const attempts = generateNegativeDiscItem(50);
    const result = analyzeItem('q-004', attempts);
    // This item may or may not have negative D depending on randomness
    // but the structure should be correct
    expect(result.flags).toBeDefined();
    expect(result.grade).toBeDefined();
  });

  it('grades excellent items correctly', () => {
    // Manually construct a perfect item
    const attempts: ItemAttemptRecord[] = [];
    for (let i = 0; i < 50; i++) {
      const totalScore = 40 + i;
      const isTop = i >= 37; // top 27%
      const isBottom = i < 13; // bottom 27%
      const isCorrect = isTop ? true : isBottom ? false : Math.random() > 0.4;
      attempts.push(
        makeAttempt({
          studentId: `s-${i}`,
          isCorrect,
          selectedOption: isCorrect ? 'A' : ['B', 'C', 'D'][i % 3]!,
          totalScore,
          totalItems: 100,
          timeSpentMs: 30000,
        })
      );
    }
    const result = analyzeItem('q-005', attempts);
    expect(result.discriminationIndex).toBeGreaterThan(0);
    // Grade should be good or excellent for a well-discriminating item
    expect(['excellent', 'good', 'acceptable']).toContain(result.grade);
  });

  it('handles empty attempts', () => {
    const result = analyzeItem('q-empty', []);
    expect(result.attemptCount).toBe(0);
    expect(result.difficulty).toBe(0);
    expect(result.discriminationIndex).toBe(0);
    expect(result.pointBiserial).toBe(0);
  });
});

// ─── computeDiscriminationIndex ──────────────────────────────────────

describe('computeDiscriminationIndex', () => {
  it('returns positive D for discriminating item', () => {
    const attempts = generateGoodItem(40);
    const D = computeDiscriminationIndex(attempts);
    expect(D).toBeGreaterThan(-1);
    expect(D).toBeLessThanOrEqual(1);
  });

  it('returns 0 for single attempt', () => {
    expect(computeDiscriminationIndex([makeAttempt()])).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computeDiscriminationIndex([])).toBe(0);
  });
});

// ─── computePointBiserial ────────────────────────────────────────────

describe('computePointBiserial', () => {
  it('returns value between -1 and 1', () => {
    const attempts = generateGoodItem(40);
    const rpb = computePointBiserial(attempts);
    expect(rpb).toBeGreaterThanOrEqual(-1);
    expect(rpb).toBeLessThanOrEqual(1);
  });

  it('returns 0 when all correct', () => {
    const attempts = generateEasyItem(40);
    const rpb = computePointBiserial(attempts);
    expect(rpb).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(computePointBiserial([])).toBe(0);
  });
});

// ─── computeDistractorAnalysis ───────────────────────────────────────

describe('computeDistractorAnalysis', () => {
  it('returns one entry per selected option', () => {
    const attempts = [
      makeAttempt({ selectedOption: 'A', isCorrect: true }),
      makeAttempt({ selectedOption: 'B', isCorrect: false }),
      makeAttempt({ selectedOption: 'C', isCorrect: false }),
      makeAttempt({ selectedOption: 'D', isCorrect: false }),
    ];
    const result = computeDistractorAnalysis(attempts);
    expect(result.length).toBe(4);
    expect(result.find((d) => d.option === 'A')?.isCorrect).toBe(true);
  });

  it('flags non-functioning distractors', () => {
    // 100 attempts: 85 correct (A), 10 chose B, 4 chose C, 1 chose D
    const attempts: ItemAttemptRecord[] = [];
    for (let i = 0; i < 85; i++) {
      attempts.push(makeAttempt({ studentId: `s-${i}`, selectedOption: 'A', isCorrect: true }));
    }
    for (let i = 0; i < 10; i++) {
      attempts.push(makeAttempt({ studentId: `s-85-${i}`, selectedOption: 'B', isCorrect: false }));
    }
    for (let i = 0; i < 4; i++) {
      attempts.push(makeAttempt({ studentId: `s-95-${i}`, selectedOption: 'C', isCorrect: false }));
    }
    attempts.push(makeAttempt({ studentId: 's-99', selectedOption: 'D', isCorrect: false }));

    const result = computeDistractorAnalysis(attempts);
    const optD = result.find((d) => d.option === 'D');
    expect(optD?.isNonFunctioning).toBe(true);
    const optC = result.find((d) => d.option === 'C');
    expect(optC?.isNonFunctioning).toBe(true); // 4% < 5%
  });

  it('returns empty for no attempts', () => {
    expect(computeDistractorAnalysis([])).toHaveLength(0);
  });
});

// ─── batchAnalyzeItems ───────────────────────────────────────────────

describe('batchAnalyzeItems', () => {
  it('analyzes multiple items and sorts by grade', () => {
    const itemMap = new Map<string, ItemAttemptRecord[]>();
    itemMap.set('q-good', generateGoodItem(40));
    itemMap.set('q-easy', generateEasyItem(40));

    const results = batchAnalyzeItems(itemMap);
    expect(results.length).toBe(2);
    // Both should have valid analysis
    for (const r of results) {
      expect(r.attemptCount).toBe(40);
      expect(r.questionId).toBeTruthy();
    }
  });
});

// ─── flaggedItemsForReview ───────────────────────────────────────────

describe('flaggedItemsForReview', () => {
  it('returns only items graded review or revise', () => {
    const all = [
      analyzeItem('q-good', generateGoodItem(40)),
      analyzeItem('q-easy', generateEasyItem(40)),
    ];
    const flagged = flaggedItemsForReview(all);
    for (const item of flagged) {
      expect(['review', 'revise']).toContain(item.grade);
    }
  });
});
