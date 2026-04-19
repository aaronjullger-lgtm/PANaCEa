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
  type ItemAnalysis,
} from '../lib/services/itemAnalysisService';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build one attempt record with sensible defaults. */
function attempt(opts: Partial<ItemAttemptRecord> & {
  studentId?: string;
  isCorrect: boolean;
  selectedOption?: string;
  totalScore?: number;
  totalItems?: number;
  timeSpentMs?: number;
}): ItemAttemptRecord {
  return {
    studentId: opts.studentId ?? `s-${Math.random().toString(36).slice(2, 8)}`,
    isCorrect: opts.isCorrect,
    selectedOption: opts.selectedOption ?? (opts.isCorrect ? 'A' : 'B'),
    totalScore: opts.totalScore ?? (opts.isCorrect ? 80 : 40),
    totalItems: opts.totalItems ?? 100,
    timeSpentMs: opts.timeSpentMs ?? 30_000,
  };
}

/**
 * Build `n` attempts where `correctCount` of them are correct,
 * and the top (ranked by totalScore/totalItems) get the correct answers.
 * This is the canonical "healthy" item — high performers score better.
 */
function makeDiscriminatingAttempts(n: number, correctCount: number): ItemAttemptRecord[] {
  const out: ItemAttemptRecord[] = [];
  for (let i = 0; i < n; i++) {
    // Higher score rate for those who got it correct
    const isCorrect = i < correctCount;
    out.push(
      attempt({
        studentId: `s${i}`,
        isCorrect,
        // Correct students' total scores are uniformly higher
        totalScore: isCorrect ? 90 - (i % 10) : 30 + (i % 10),
        totalItems: 100,
        selectedOption: isCorrect ? 'A' : ['B', 'C', 'D'][i % 3]!,
      })
    );
  }
  return out;
}

// ─── ITEM_ANALYSIS_THRESHOLDS ───────────────────────────────────────────────

describe('ITEM_ANALYSIS_THRESHOLDS', () => {
  it('requires at least 30 attempts for reliable statistics (NBME-aligned)', () => {
    expect(ITEM_ANALYSIS_THRESHOLDS.MIN_ATTEMPTS).toBe(30);
  });

  it('excellent discrimination is D >= 0.40', () => {
    expect(ITEM_ANALYSIS_THRESHOLDS.DISCRIMINATION_EXCELLENT).toBe(0.40);
  });

  it('acceptable discrimination is D >= 0.20 (NBME baseline)', () => {
    expect(ITEM_ANALYSIS_THRESHOLDS.DISCRIMINATION_ACCEPTABLE).toBe(0.20);
  });

  it('non-functioning distractor threshold is < 5% selection rate', () => {
    expect(ITEM_ANALYSIS_THRESHOLDS.DISTRACTOR_MIN_RATE).toBe(0.05);
  });

  it('extreme-group fraction is 0.27 (Kelley 27%)', () => {
    expect(ITEM_ANALYSIS_THRESHOLDS.EXTREME_GROUP_FRACTION).toBe(0.27);
  });
});

// ─── computeDiscriminationIndex ─────────────────────────────────────────────

describe('computeDiscriminationIndex', () => {
  it('returns 0 for fewer than 2 attempts', () => {
    expect(computeDiscriminationIndex([])).toBe(0);
    expect(computeDiscriminationIndex([attempt({ isCorrect: true })])).toBe(0);
  });

  it('returns 1.0 when top performers all correct and bottom performers all wrong', () => {
    // 100 students: top 27 correct (high score), bottom 27 wrong (low score)
    const items: ItemAttemptRecord[] = [];
    for (let i = 0; i < 100; i++) {
      items.push(
        attempt({
          studentId: `s${i}`,
          isCorrect: i < 50,
          totalScore: i < 50 ? 90 : 20,
          totalItems: 100,
        })
      );
    }
    // Top 27 are the first 50 (all correct); bottom 27 are from the last 50 (all wrong)
    expect(computeDiscriminationIndex(items)).toBeCloseTo(1.0, 5);
  });

  it('returns negative D when high performers fail and low performers succeed', () => {
    // Inverted item — misleading question
    const items: ItemAttemptRecord[] = [];
    for (let i = 0; i < 100; i++) {
      items.push(
        attempt({
          studentId: `s${i}`,
          // Low-score students correct, high-score students wrong
          isCorrect: i >= 50,
          totalScore: i < 50 ? 90 : 20,
          totalItems: 100,
        })
      );
    }
    expect(computeDiscriminationIndex(items)).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 when correctness is uncorrelated with total score', () => {
    // 50% correct uniformly, all same total score
    const items = Array.from({ length: 100 }, (_, i) =>
      attempt({
        studentId: `s${i}`,
        isCorrect: i % 2 === 0,
        totalScore: 50,
        totalItems: 100,
      })
    );
    expect(computeDiscriminationIndex(items)).toBeCloseTo(0, 1);
  });

  it('uses groupSize ≥ 1 even for tiny samples', () => {
    // 2 attempts → groupSize = round(2 * 0.27) = 1
    const items = [
      attempt({ studentId: 'a', isCorrect: true, totalScore: 90, totalItems: 100 }),
      attempt({ studentId: 'b', isCorrect: false, totalScore: 10, totalItems: 100 }),
    ];
    // top = 1 correct (rate 1), bottom = 1 wrong (rate 0) → D = 1
    expect(computeDiscriminationIndex(items)).toBe(1);
  });
});

// ─── computePointBiserial ───────────────────────────────────────────────────

describe('computePointBiserial', () => {
  it('returns 0 for fewer than 2 attempts', () => {
    expect(computePointBiserial([])).toBe(0);
    expect(computePointBiserial([attempt({ isCorrect: true })])).toBe(0);
  });

  it('returns 0 when all attempts are correct (no contrast group)', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      attempt({ studentId: `s${i}`, isCorrect: true, totalScore: 80 + i })
    );
    expect(computePointBiserial(items)).toBe(0);
  });

  it('returns 0 when all attempts are incorrect', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      attempt({ studentId: `s${i}`, isCorrect: false, totalScore: 30 + i })
    );
    expect(computePointBiserial(items)).toBe(0);
  });

  it('returns 0 when all students have identical total scores (no variance)', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      attempt({ studentId: `s${i}`, isCorrect: i % 2 === 0, totalScore: 50, totalItems: 100 })
    );
    expect(computePointBiserial(items)).toBe(0);
  });

  it('returns a positive rpb when correct students have higher total scores', () => {
    const items = makeDiscriminatingAttempts(60, 30);
    const rpb = computePointBiserial(items);
    expect(rpb).toBeGreaterThan(0);
  });

  it('returns a negative rpb when correct students have LOWER total scores', () => {
    const items: ItemAttemptRecord[] = [];
    for (let i = 0; i < 60; i++) {
      items.push(
        attempt({
          studentId: `s${i}`,
          isCorrect: i >= 30, // last 30 correct
          totalScore: i < 30 ? 90 : 30, // but they have lower scores
          totalItems: 100,
        })
      );
    }
    expect(computePointBiserial(items)).toBeLessThan(0);
  });

  it('returns a number in the range [-1, 1]', () => {
    const items = makeDiscriminatingAttempts(60, 30);
    const rpb = computePointBiserial(items);
    expect(rpb).toBeGreaterThanOrEqual(-1);
    expect(rpb).toBeLessThanOrEqual(1);
  });
});

// ─── computeDistractorAnalysis ──────────────────────────────────────────────

describe('computeDistractorAnalysis', () => {
  it('returns empty array for no attempts', () => {
    expect(computeDistractorAnalysis([])).toEqual([]);
  });

  it('identifies the correct option (most common among correct attempts)', () => {
    // 20 students pick A and are correct; 5 pick B and are wrong; 5 pick C and are wrong
    const items: ItemAttemptRecord[] = [
      ...Array.from({ length: 20 }, (_, i) =>
        attempt({ studentId: `s${i}`, isCorrect: true, selectedOption: 'A' })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        attempt({ studentId: `b${i}`, isCorrect: false, selectedOption: 'B' })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        attempt({ studentId: `c${i}`, isCorrect: false, selectedOption: 'C' })
      ),
    ];
    const result = computeDistractorAnalysis(items);
    const correct = result.find((d) => d.isCorrect);
    expect(correct?.option).toBe('A');
  });

  it('places the correct option first in the sorted output', () => {
    const items: ItemAttemptRecord[] = [
      attempt({ studentId: '1', isCorrect: true, selectedOption: 'A' }),
      attempt({ studentId: '2', isCorrect: false, selectedOption: 'B' }),
      attempt({ studentId: '3', isCorrect: false, selectedOption: 'C' }),
      attempt({ studentId: '4', isCorrect: false, selectedOption: 'D' }),
    ];
    const result = computeDistractorAnalysis(items);
    expect(result[0]?.isCorrect).toBe(true);
  });

  it('flags non-functioning distractors (< 5% selection rate)', () => {
    // 40 students: 30 pick A (correct), 8 pick B, 1 pick C, 1 pick D
    // C and D have 1/40 = 2.5% each → non-functioning
    const items: ItemAttemptRecord[] = [
      ...Array.from({ length: 30 }, (_, i) =>
        attempt({ studentId: `a${i}`, isCorrect: true, selectedOption: 'A' })
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        attempt({ studentId: `b${i}`, isCorrect: false, selectedOption: 'B' })
      ),
      attempt({ studentId: 'c1', isCorrect: false, selectedOption: 'C' }),
      attempt({ studentId: 'd1', isCorrect: false, selectedOption: 'D' }),
    ];
    const result = computeDistractorAnalysis(items);
    const optC = result.find((d) => d.option === 'C');
    const optD = result.find((d) => d.option === 'D');
    const optB = result.find((d) => d.option === 'B');
    expect(optC?.isNonFunctioning).toBe(true);
    expect(optD?.isNonFunctioning).toBe(true);
    expect(optB?.isNonFunctioning).toBe(false); // 8/40 = 20%
  });

  it('never marks the correct option as non-functioning even at <5%', () => {
    // Edge: rare correct answer on a hard question
    const items: ItemAttemptRecord[] = [
      attempt({ studentId: 'a1', isCorrect: true, selectedOption: 'A' }),
      ...Array.from({ length: 40 }, (_, i) =>
        attempt({ studentId: `b${i}`, isCorrect: false, selectedOption: 'B' })
      ),
    ];
    const result = computeDistractorAnalysis(items);
    const correct = result.find((d) => d.isCorrect);
    expect(correct?.isNonFunctioning).toBe(false);
  });

  it('computes selectionRate as fraction of total attempts', () => {
    const items: ItemAttemptRecord[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        attempt({ studentId: `a${i}`, isCorrect: true, selectedOption: 'A' })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        attempt({ studentId: `b${i}`, isCorrect: false, selectedOption: 'B' })
      ),
    ];
    const result = computeDistractorAnalysis(items);
    for (const d of result) {
      expect(d.selectionRate).toBe(0.5);
    }
  });
});

// ─── analyzeItem ────────────────────────────────────────────────────────────

describe('analyzeItem', () => {
  it('sets difficulty = fraction correct', () => {
    const items = makeDiscriminatingAttempts(40, 20); // 50% correct
    const result = analyzeItem('q1', items);
    expect(result.difficulty).toBe(0.5);
  });

  it('flags INSUFFICIENT_DATA when attempts < 30', () => {
    const items = makeDiscriminatingAttempts(10, 5);
    const result = analyzeItem('q1', items);
    expect(result.flags.some((f) => f.type === 'INSUFFICIENT_DATA')).toBe(true);
  });

  it('does NOT flag INSUFFICIENT_DATA at exactly 30 attempts', () => {
    const items = makeDiscriminatingAttempts(30, 15);
    const result = analyzeItem('q1', items);
    expect(result.flags.some((f) => f.type === 'INSUFFICIENT_DATA')).toBe(false);
  });

  it('flags TOO_EASY when difficulty > 0.95', () => {
    // 49/50 correct → 0.98
    const items: ItemAttemptRecord[] = [];
    for (let i = 0; i < 50; i++) {
      items.push(
        attempt({
          studentId: `s${i}`,
          isCorrect: i < 49,
          totalScore: 80,
          totalItems: 100,
        })
      );
    }
    const result = analyzeItem('q1', items);
    expect(result.flags.some((f) => f.type === 'TOO_EASY')).toBe(true);
  });

  it('flags TOO_HARD when difficulty < 0.20', () => {
    // 5/50 correct = 0.10
    const items: ItemAttemptRecord[] = [];
    for (let i = 0; i < 50; i++) {
      items.push(
        attempt({
          studentId: `s${i}`,
          isCorrect: i < 5,
          totalScore: 50,
          totalItems: 100,
        })
      );
    }
    const result = analyzeItem('q1', items);
    expect(result.flags.some((f) => f.type === 'TOO_HARD')).toBe(true);
  });

  it('flags NEGATIVE_DISCRIMINATION with critical severity when D < 0', () => {
    // Invert: top scorers wrong, bottom scorers correct
    const items: ItemAttemptRecord[] = [];
    for (let i = 0; i < 40; i++) {
      items.push(
        attempt({
          studentId: `s${i}`,
          isCorrect: i >= 20, // bottom half correct
          totalScore: i < 20 ? 90 : 20,
          totalItems: 100,
        })
      );
    }
    const result = analyzeItem('q1', items);
    const negFlag = result.flags.find((f) => f.type === 'NEGATIVE_DISCRIMINATION');
    expect(negFlag).toBeDefined();
    expect(negFlag?.severity).toBe('critical');
  });

  it('flags NON_DISCRIMINATING (warning) when 0 <= D < 0.10', () => {
    // Near-zero D: random correctness, uniform scores
    const items = Array.from({ length: 40 }, (_, i) =>
      attempt({
        studentId: `s${i}`,
        isCorrect: i % 2 === 0,
        totalScore: 50,
        totalItems: 100,
      })
    );
    const result = analyzeItem('q1', items);
    const flag = result.flags.find((f) => f.type === 'NON_DISCRIMINATING');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('warning');
  });

  it('assigns grade="revise" when any critical flag is present', () => {
    // Negative discrimination case → critical flag
    const items: ItemAttemptRecord[] = [];
    for (let i = 0; i < 40; i++) {
      items.push(
        attempt({
          studentId: `s${i}`,
          isCorrect: i >= 20,
          totalScore: i < 20 ? 90 : 20,
          totalItems: 100,
        })
      );
    }
    const result = analyzeItem('q1', items);
    expect(result.grade).toBe('revise');
  });

  it('assigns grade="review" when >=2 warning-level flags are present', () => {
    // TOO_HARD (p=0.10) + NON_DISCRIMINATING (D=0)
    // Trick: put the 4 correct students in the MIDDLE-scored group so neither
    // the top 27% nor the bottom 27% contain any correct answers → D=0.
    const items: ItemAttemptRecord[] = [];
    // Top 11 scorers — all wrong
    for (let i = 0; i < 11; i++) {
      items.push(
        attempt({ studentId: `top${i}`, isCorrect: false, totalScore: 90, totalItems: 100 })
      );
    }
    // Middle 18 — 4 of them correct
    for (let i = 0; i < 18; i++) {
      items.push(
        attempt({
          studentId: `mid${i}`,
          isCorrect: i < 4,
          totalScore: 50,
          totalItems: 100,
        })
      );
    }
    // Bottom 11 — all wrong
    for (let i = 0; i < 11; i++) {
      items.push(
        attempt({ studentId: `bot${i}`, isCorrect: false, totalScore: 10, totalItems: 100 })
      );
    }
    const result = analyzeItem('q1', items);
    const warnings = result.flags.filter((f) => f.severity === 'warning');
    expect(warnings.length).toBeGreaterThanOrEqual(2);
    expect(result.grade).toBe('review');
  });

  it('assigns grade="excellent" when D>=0.40, rpb>=0.30, and difficulty in [0.30,0.80]', () => {
    // Strong discriminating item: top half correct high score, bottom half wrong low score
    const items = makeDiscriminatingAttempts(60, 30);
    const result = analyzeItem('q1', items);
    expect(result.discriminationIndex).toBeGreaterThanOrEqual(0.40);
    expect(result.difficulty).toBe(0.5);
    expect(result.grade).toBe('excellent');
  });

  it('computes avgTimeMs and medianTimeMs from sorted times', () => {
    const items: ItemAttemptRecord[] = [
      attempt({ studentId: 'a', isCorrect: true, totalScore: 50, timeSpentMs: 10_000 }),
      attempt({ studentId: 'b', isCorrect: true, totalScore: 50, timeSpentMs: 20_000 }),
      attempt({ studentId: 'c', isCorrect: true, totalScore: 50, timeSpentMs: 30_000 }),
    ];
    const result = analyzeItem('q1', items);
    expect(result.avgTimeMs).toBe(20_000);
    expect(result.medianTimeMs).toBe(20_000);
  });

  it('computes median with even-count dataset (average of middle two)', () => {
    const items: ItemAttemptRecord[] = [
      attempt({ studentId: 'a', isCorrect: true, timeSpentMs: 10_000 }),
      attempt({ studentId: 'b', isCorrect: true, timeSpentMs: 20_000 }),
      attempt({ studentId: 'c', isCorrect: true, timeSpentMs: 30_000 }),
      attempt({ studentId: 'd', isCorrect: true, timeSpentMs: 40_000 }),
    ];
    const result = analyzeItem('q1', items);
    // Median of [10k, 20k, 30k, 40k] = (20k + 30k) / 2 = 25k
    expect(result.medianTimeMs).toBe(25_000);
  });

  it('handles empty attempts array without crashing', () => {
    const result = analyzeItem('q1', []);
    expect(result.attemptCount).toBe(0);
    expect(result.difficulty).toBe(0);
    expect(result.discriminationIndex).toBe(0);
    expect(result.pointBiserial).toBe(0);
    expect(result.avgTimeMs).toBe(0);
    expect(result.medianTimeMs).toBe(0);
  });

  it('preserves questionId in the result', () => {
    const result = analyzeItem('custom-qid-42', makeDiscriminatingAttempts(40, 20));
    expect(result.questionId).toBe('custom-qid-42');
  });
});

// ─── batchAnalyzeItems ──────────────────────────────────────────────────────

describe('batchAnalyzeItems', () => {
  it('returns one analysis per question in the map', () => {
    const map = new Map<string, ItemAttemptRecord[]>();
    map.set('q1', makeDiscriminatingAttempts(40, 20));
    map.set('q2', makeDiscriminatingAttempts(40, 30));
    const results = batchAnalyzeItems(map);
    expect(results.length).toBe(2);
    expect(new Set(results.map((r) => r.questionId))).toEqual(
      new Set(['q1', 'q2'])
    );
  });

  it('sorts results worst-first (revise before excellent) for review queue', () => {
    const map = new Map<string, ItemAttemptRecord[]>();
    // Excellent item
    map.set('great', makeDiscriminatingAttempts(60, 30));
    // Revise item (negative discrimination)
    const badItems: ItemAttemptRecord[] = [];
    for (let i = 0; i < 40; i++) {
      badItems.push(
        attempt({
          studentId: `s${i}`,
          isCorrect: i >= 20,
          totalScore: i < 20 ? 90 : 20,
          totalItems: 100,
        })
      );
    }
    map.set('bad', badItems);

    const results = batchAnalyzeItems(map);
    expect(results[0]?.grade).toBe('revise');
    expect(results[0]?.questionId).toBe('bad');
    expect(results[results.length - 1]?.grade).toBe('excellent');
  });

  it('handles empty map', () => {
    expect(batchAnalyzeItems(new Map())).toEqual([]);
  });
});

// ─── flaggedItemsForReview ──────────────────────────────────────────────────

describe('flaggedItemsForReview', () => {
  function stub(grade: ItemAnalysis['grade']): ItemAnalysis {
    return {
      questionId: `q-${grade}`,
      attemptCount: 40,
      difficulty: 0.5,
      discriminationIndex: 0.3,
      pointBiserial: 0.2,
      distractors: [],
      avgTimeMs: 30_000,
      medianTimeMs: 30_000,
      flags: [],
      grade,
    };
  }

  it('returns only items graded "revise" or "review"', () => {
    const analyses = [
      stub('excellent'),
      stub('good'),
      stub('acceptable'),
      stub('review'),
      stub('revise'),
    ];
    const flagged = flaggedItemsForReview(analyses);
    expect(flagged.length).toBe(2);
    expect(flagged.map((a) => a.grade).sort()).toEqual(['review', 'revise']);
  });

  it('returns empty array when nothing needs review', () => {
    const analyses = [stub('excellent'), stub('good'), stub('acceptable')];
    expect(flaggedItemsForReview(analyses)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(flaggedItemsForReview([])).toEqual([]);
  });
});
