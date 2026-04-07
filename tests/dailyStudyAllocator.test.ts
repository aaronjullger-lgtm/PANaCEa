/**
 * Tests for lib/services/dailyStudyAllocatorService.ts — pure scoring functions.
 *
 * All DB-integrated functions are excluded (they require Prisma).
 * Coverage:
 *   - scoreReadinessPriority: coverage gap, accuracy gap, calibration risk
 *   - scoreRetentionPriority: due/overdue/unstable fractions
 *   - decideSplit: threshold-based split decisions
 *   - rankSystemsForMain: composite ranking
 *   - buildReasonSummary: human-readable output
 *   - interleaveBySystem (indirectly via getDailyStudyAllocation)
 *
 * Sprint: Dual-Study Allocator — April 2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scoreReadinessPriority,
  scoreRetentionPriority,
  decideSplit,
  rankSystemsForMain,
  buildReasonSummary,
  getDailyStudyAllocation,
  type SystemStats,
  type RetentionStats,
  type StudySplit,
} from '../lib/services/dailyStudyAllocatorService';

// Mock normalizeSystemName for the DB-integrated tests
vi.mock('../lib/services/rolling360Service', () => ({
  normalizeSystemName: vi.fn((s: string | null | undefined) => {
    if (!s) return 'Unknown';
    const map: Record<string, string> = {
      CV: 'Cardiovascular', PULM: 'Pulmonary', GI: 'Gastrointestinal',
      MSK: 'Musculoskeletal', HEENT: 'HEENT', REPRO: 'Reproductive',
      NEURO: 'Neurological', PSYCH: 'Psychiatry', ENDO: 'Endocrine',
      DERM: 'Dermatology', GU: 'Genitourinary', HEME: 'Hematology',
      ID: 'Infectious Disease', RENAL: 'Renal', EMERGENCY: 'Emergency Medicine',
    };
    const upper = s.toUpperCase().trim();
    return map[upper] ?? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }),
  getRolling360Service: vi.fn(),
  ROLLING_WINDOW_SIZE: 360,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSystem(overrides: Partial<SystemStats> & { system: string }): SystemStats {
  return {
    system: overrides.system,
    blueprintWeight: overrides.blueprintWeight ?? 0.10,
    attemptFraction: overrides.attemptFraction ?? 0.10,
    accuracy: overrides.accuracy ?? 0.75,
    calibrationRisk: overrides.calibrationRisk ?? 0,
  };
}

function makeRetention(overrides: Partial<RetentionStats> = {}): RetentionStats {
  return {
    dueCount: overrides.dueCount ?? 0,
    overdueCount: overrides.overdueCount ?? 0,
    unstableCount: overrides.unstableCount ?? 0,
    topDueConditions: overrides.topDueConditions ?? [],
  };
}

// ─── scoreReadinessPriority ───────────────────────────────────────────────────

describe('scoreReadinessPriority', () => {
  it('returns 50 when no systems provided (moderate default)', () => {
    expect(scoreReadinessPriority([])).toBe(50);
  });

  it('returns 0 when all systems are perfectly covered, accurate, and calibrated', () => {
    const systems = [
      makeSystem({ system: 'Cardiovascular', blueprintWeight: 0.11, attemptFraction: 0.11, accuracy: 1.0, calibrationRisk: 0 }),
      makeSystem({ system: 'Pulmonary', blueprintWeight: 0.09, attemptFraction: 0.09, accuracy: 1.0, calibrationRisk: 0 }),
    ];
    expect(scoreReadinessPriority(systems)).toBe(0);
  });

  it('scores coverage gap when attempt fraction is below blueprint weight', () => {
    // Blueprint 11%, attempted 0% → large coverage gap
    const systems = [
      makeSystem({ system: 'Cardiovascular', blueprintWeight: 0.11, attemptFraction: 0, accuracy: 1.0, calibrationRisk: 0 }),
    ];
    const score = scoreReadinessPriority(systems);
    // Coverage gap = 0.11, normalized / 0.15 = 0.733, * 0.11 (bpWeight) * 40 ≈ 3.2
    // Should be positive and > 0
    expect(score).toBeGreaterThan(0);
  });

  it('scores accuracy gap when accuracy is below 70%', () => {
    const systems = [
      makeSystem({ system: 'Cardiovascular', blueprintWeight: 0.11, attemptFraction: 0.11, accuracy: 0.40, calibrationRisk: 0 }),
    ];
    const score = scoreReadinessPriority(systems);
    // accGap = 0.30, normalized 0.30/0.70 ≈ 0.43, * 0.11 * 35 ≈ 1.65
    expect(score).toBeGreaterThan(0);
  });

  it('scores calibration risk contribution', () => {
    const systems = [
      makeSystem({ system: 'Cardiovascular', blueprintWeight: 0.11, attemptFraction: 0.11, accuracy: 0.75, calibrationRisk: 0.5 }),
    ];
    const score = scoreReadinessPriority(systems);
    // calibration = 0.5 * 0.11 * 25 ≈ 1.375
    expect(score).toBeGreaterThan(0);
  });

  it('returns higher score when there are many gaps across multiple systems', () => {
    const gapped = Array.from({ length: 10 }, (_, i) =>
      makeSystem({ system: `System${i}`, blueprintWeight: 0.10, attemptFraction: 0, accuracy: 0.30, calibrationRisk: 0.8 })
    );
    const score = scoreReadinessPriority(gapped);
    expect(score).toBeGreaterThan(50);
  });

  it('caps output at 100', () => {
    const extreme = Array.from({ length: 20 }, (_, i) =>
      makeSystem({ system: `S${i}`, blueprintWeight: 0.15, attemptFraction: 0, accuracy: 0, calibrationRisk: 1.0 })
    );
    expect(scoreReadinessPriority(extreme)).toBeLessThanOrEqual(100);
  });

  it('returns 0 when no accuracy gap (accuracy >= 70%)', () => {
    const systems = [
      makeSystem({ system: 'Cardio', blueprintWeight: 0.10, attemptFraction: 0.10, accuracy: 0.85, calibrationRisk: 0 }),
    ];
    expect(scoreReadinessPriority(systems)).toBe(0);
  });
});

// ─── scoreRetentionPriority ───────────────────────────────────────────────────

describe('scoreRetentionPriority', () => {
  it('returns 0 when nothing is due, overdue, or unstable', () => {
    expect(scoreRetentionPriority(makeRetention())).toBe(0);
  });

  it('scores due count: 25 items = full due pressure (40 pts)', () => {
    const score = scoreRetentionPriority(makeRetention({ dueCount: 25 }));
    expect(score).toBe(40);
  });

  it('scores due count proportionally: 12 items ≈ 19 pts', () => {
    const score = scoreRetentionPriority(makeRetention({ dueCount: 12 }));
    // 12/25 * 40 = 19.2 → 19
    expect(score).toBe(19);
  });

  it('scores overdue count: 12 items = full overdue pressure (35 pts)', () => {
    const score = scoreRetentionPriority(makeRetention({ overdueCount: 13 }));
    // 13 / 12.5 = 1.04, capped at 1 → 35
    expect(score).toBe(35);
  });

  it('scores unstable count: 20 items = full unstable pressure (25 pts)', () => {
    const score = scoreRetentionPriority(makeRetention({ unstableCount: 20 }));
    expect(score).toBe(25);
  });

  it('scores all three components together', () => {
    const score = scoreRetentionPriority(makeRetention({ dueCount: 25, overdueCount: 13, unstableCount: 20 }));
    expect(score).toBe(100);
  });

  it('caps output at 100 with extreme values', () => {
    const score = scoreRetentionPriority(makeRetention({ dueCount: 1000, overdueCount: 1000, unstableCount: 1000 }));
    expect(score).toBe(100);
  });

  it('partial components sum correctly', () => {
    // dueCount=12 → 19.2 pts, overdueCount=6 → 16.8 pts, unstableCount=10 → 12.5 pts
    // total ≈ 48.5 → 49 (all rounded individually in raw, then Math.round applied to sum)
    const score = scoreRetentionPriority(makeRetention({ dueCount: 12, overdueCount: 6, unstableCount: 10 }));
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(60);
  });
});

// ─── decideSplit ──────────────────────────────────────────────────────────────

describe('decideSplit', () => {
  it('returns balanced when scores are equal', () => {
    expect(decideSplit(50, 50)).toBe('balanced');
  });

  it('returns balanced when difference < 15', () => {
    expect(decideSplit(50, 60)).toBe('balanced');  // diff = 10
    expect(decideSplit(60, 50)).toBe('balanced');  // diff = -10
  });

  it('returns balanced when difference is exactly 15', () => {
    // threshold is STRICT >15, so 15 is still balanced
    expect(decideSplit(50, 65)).toBe('balanced');
    expect(decideSplit(65, 50)).toBe('balanced');
  });

  it('returns targeted_heavy when retention > readiness by >15 pts', () => {
    expect(decideSplit(40, 60)).toBe('targeted_heavy');  // diff = 20
    expect(decideSplit(0, 100)).toBe('targeted_heavy');
  });

  it('returns main_heavy when readiness > retention by >15 pts', () => {
    expect(decideSplit(60, 40)).toBe('main_heavy');  // diff = -20
    expect(decideSplit(100, 0)).toBe('main_heavy');
  });

  it('returns targeted_heavy at exactly 16 point difference', () => {
    expect(decideSplit(40, 56)).toBe('targeted_heavy');
  });

  it('returns main_heavy at exactly -16 point difference', () => {
    expect(decideSplit(56, 40)).toBe('main_heavy');
  });
});

// ─── rankSystemsForMain ───────────────────────────────────────────────────────

describe('rankSystemsForMain', () => {
  it('returns empty array when no systems provided', () => {
    expect(rankSystemsForMain([])).toEqual([]);
  });

  it('returns at most 3 systems', () => {
    const systems = Array.from({ length: 10 }, (_, i) =>
      makeSystem({ system: `System${i}`, blueprintWeight: 0.10 })
    );
    expect(rankSystemsForMain(systems).length).toBeLessThanOrEqual(3);
  });

  it('ranks high-coverage-gap systems first', () => {
    const systems = [
      makeSystem({ system: 'A', blueprintWeight: 0.15, attemptFraction: 0, accuracy: 0.75 }),   // large gap
      makeSystem({ system: 'B', blueprintWeight: 0.10, attemptFraction: 0.10, accuracy: 0.75 }), // no gap
    ];
    const ranked = rankSystemsForMain(systems);
    expect(ranked[0]).toBe('A');
  });

  it('ranks low-accuracy systems higher (below 70% threshold)', () => {
    const systems = [
      makeSystem({ system: 'Weak', blueprintWeight: 0.10, attemptFraction: 0.10, accuracy: 0.40 }),
      makeSystem({ system: 'Strong', blueprintWeight: 0.10, attemptFraction: 0.10, accuracy: 0.90 }),
    ];
    const ranked = rankSystemsForMain(systems);
    expect(ranked[0]).toBe('Weak');
  });

  it('ranks high-calibration-risk systems higher', () => {
    const systems = [
      makeSystem({ system: 'Risky', blueprintWeight: 0.10, attemptFraction: 0.10, accuracy: 0.75, calibrationRisk: 0.8 }),
      makeSystem({ system: 'Safe', blueprintWeight: 0.10, attemptFraction: 0.10, accuracy: 0.75, calibrationRisk: 0 }),
    ];
    const ranked = rankSystemsForMain(systems);
    expect(ranked[0]).toBe('Risky');
  });

  it('returns system names (not objects)', () => {
    const systems = [makeSystem({ system: 'Cardio' })];
    const ranked = rankSystemsForMain(systems);
    expect(typeof ranked[0]).toBe('string');
    expect(ranked[0]).toBe('Cardio');
  });
});

// ─── buildReasonSummary ───────────────────────────────────────────────────────

describe('buildReasonSummary', () => {
  it('includes the split label for balanced', () => {
    const summary = buildReasonSummary('balanced', 50, 50, [], 0, 0);
    expect(summary).toContain('balanced');
  });

  it('includes readiness-heavy label for main_heavy split', () => {
    const summary = buildReasonSummary('main_heavy', 70, 40, [], 0, 0);
    expect(summary).toContain('readiness-heavy');
  });

  it('includes retention-heavy label for targeted_heavy split', () => {
    const summary = buildReasonSummary('targeted_heavy', 40, 70, [], 0, 0);
    expect(summary).toContain('retention-heavy');
  });

  it('includes priority scores in summary', () => {
    const summary = buildReasonSummary('balanced', 55, 45, [], 0, 0);
    expect(summary).toContain('55');
    expect(summary).toContain('45');
  });

  it('mentions main systems when provided', () => {
    const summary = buildReasonSummary('balanced', 50, 50, ['Cardiovascular', 'Pulmonary'], 0, 0);
    expect(summary).toContain('Cardiovascular');
    expect(summary).toContain('Pulmonary');
  });

  it('mentions overdue count when > 0', () => {
    const summary = buildReasonSummary('targeted_heavy', 40, 70, [], 10, 5);
    expect(summary).toContain('5');
    expect(summary).toContain('overdue');
  });

  it('mentions due count when overdue is 0 but due > 0', () => {
    const summary = buildReasonSummary('targeted_heavy', 40, 70, [], 8, 0);
    expect(summary).toContain('8');
    expect(summary).toContain('due');
  });

  it('returns a non-empty string in all cases', () => {
    const cases: Array<[StudySplit, number, number, string[], number, number]> = [
      ['main_heavy', 80, 30, [], 0, 0],
      ['balanced', 50, 50, ['Cardio'], 5, 2],
      ['targeted_heavy', 20, 80, ['Pulm', 'GI'], 20, 15],
    ];
    for (const args of cases) {
      const summary = buildReasonSummary(...args);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(10);
    }
  });

  it('uses singular "card" for overdueCount=1', () => {
    const summary = buildReasonSummary('targeted_heavy', 40, 70, [], 5, 1);
    expect(summary).toContain('1 overdue FSRS card ');
    expect(summary).not.toContain('cards');
  });

  it('uses plural "cards" for overdueCount > 1', () => {
    const summary = buildReasonSummary('targeted_heavy', 40, 70, [], 10, 3);
    expect(summary).toContain('cards');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DB-integrated getDailyStudyAllocation
// ════════════════════════════════════════════════════════════════════════════

describe('getDailyStudyAllocation', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      questionAttempt: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      reviewLog: {
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      userProgress: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
  });

  it('returns a valid DailyStudyAllocation with empty data', async () => {
    const result = await getDailyStudyAllocation(prisma, 'user-001');

    expect(result.recommendedMainCount).toBeGreaterThan(0);
    expect(result.recommendedTargetedCount).toBeGreaterThan(0);
    expect(result.mainSystems).toBeInstanceOf(Array);
    expect(result.targetedConditions).toBeInstanceOf(Array);
    expect(result.readinessPriority).toBeGreaterThanOrEqual(0);
    expect(result.readinessPriority).toBeLessThanOrEqual(100);
    expect(result.retentionPriority).toBeGreaterThanOrEqual(0);
    expect(result.retentionPriority).toBeLessThanOrEqual(100);
    expect(['main_heavy', 'balanced', 'targeted_heavy']).toContain(result.recommendedSplit);
    expect(result.reasonSummary).toBeTruthy();
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('recommends targeted_heavy when many FSRS cards are overdue', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Many overdue TARGETED cards
    prisma.userProgress.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        conditionId: `cond-${i}`,
        nextReviewAt: yesterday,
        fsrsStability: 3.0,
        system: i % 2 === 0 ? 'CV' : 'PULM',
      }))
    );

    const result = await getDailyStudyAllocation(prisma, 'user-002');
    expect(result.retentionPriority).toBeGreaterThan(result.readinessPriority);
    expect(result.recommendedSplit).toBe('targeted_heavy');
    expect(result.targetedConditions.length).toBeGreaterThan(0);
    expect(result.targetedConditions.length).toBeLessThanOrEqual(8);
  });

  it('interleaves targeted conditions by system (round-robin)', async () => {
    const now = new Date();
    const pastDue = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    prisma.userProgress.findMany.mockResolvedValue([
      { conditionId: 'cv-1', nextReviewAt: pastDue, fsrsStability: 5, system: 'CV' },
      { conditionId: 'cv-2', nextReviewAt: pastDue, fsrsStability: 5, system: 'CV' },
      { conditionId: 'pulm-1', nextReviewAt: pastDue, fsrsStability: 5, system: 'PULM' },
      { conditionId: 'pulm-2', nextReviewAt: pastDue, fsrsStability: 5, system: 'PULM' },
      { conditionId: 'gi-1', nextReviewAt: pastDue, fsrsStability: 5, system: 'GI' },
    ]);

    const result = await getDailyStudyAllocation(prisma, 'user-003');

    // Round-robin interleave: one from each system before repeating
    expect(result.targetedConditions[0]).toBe('cv-1');
    expect(result.targetedConditions[1]).toBe('pulm-1');
    expect(result.targetedConditions[2]).toBe('gi-1');
    expect(result.targetedConditions[3]).toBe('cv-2');
    expect(result.targetedConditions[4]).toBe('pulm-2');
  });

  it('identifies weak systems for MAIN focus', async () => {
    // Simulate attempts heavily skewed toward CV, barely any on Pulmonary
    prisma.questionAttempt.groupBy
      .mockResolvedValueOnce([ // total by system
        { system: 'CV', _count: { id: 50 } },
        { system: 'PULM', _count: { id: 2 } },
        { system: 'GI', _count: { id: 30 } },
      ])
      .mockResolvedValueOnce([ // correct by system (wasCorrect: true filter)
        { system: 'CV', _count: { id: 40 } },
        { system: 'PULM', _count: { id: 0 } },
        { system: 'GI', _count: { id: 15 } },
      ]);

    const result = await getDailyStudyAllocation(prisma, 'user-004');

    // Pulmonary should be in mainSystems (very few attempts, 0% accuracy)
    expect(result.mainSystems).toContain('Pulmonary');
  });

  it('question counts are always positive and bounded', async () => {
    const result = await getDailyStudyAllocation(prisma, 'user-005');
    expect(result.recommendedMainCount).toBeGreaterThan(0);
    expect(result.recommendedTargetedCount).toBeGreaterThan(0);
    expect(result.recommendedMainCount + result.recommendedTargetedCount).toBeLessThanOrEqual(80);
  });
});
