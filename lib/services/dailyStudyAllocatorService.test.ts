// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/dailyStudyAllocatorService.ts
 *
 * Pure functions tested:
 *   scoreReadinessPriority  — coverage gap + accuracy gap + calibration risk → 0-100
 *   scoreRetentionPriority  — due/overdue/unstable counts → 0-100
 *   decideSplit             — readiness vs retention priority → StudySplit
 *   rankSystemsForMain      — rank systems by composite gap score → top 3
 *   buildReasonSummary      — human-readable plan string
 *
 * Constants:
 *   SPLIT_THRESHOLD = 15  (points before a side is "heavy")
 *   DAILY_LOAD_REF = 25   (dueCount at which dueFraction = 1.0)
 *   MAX_MAIN_SYSTEMS = 3
 */

import { describe, it, expect } from 'vitest';
import {
  scoreReadinessPriority,
  scoreRetentionPriority,
  decideSplit,
  rankSystemsForMain,
  buildReasonSummary,
  type SystemStats,
  type RetentionStats,
  type StudySplit,
} from './dailyStudyAllocatorService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSystem(overrides: Partial<SystemStats> = {}): SystemStats {
  return {
    system: 'Cardiology',
    blueprintWeight: 0.2,
    attemptFraction: 0.2,
    accuracy: 0.80,
    calibrationRisk: 0,
    ...overrides,
  };
}

function makeRetention(overrides: Partial<RetentionStats> = {}): RetentionStats {
  return {
    dueCount: 0,
    overdueCount: 0,
    unstableCount: 0,
    topDueConditions: [],
    ...overrides,
  };
}

// ─── scoreReadinessPriority ───────────────────────────────────────────────────

describe('scoreReadinessPriority', () => {
  it('returns 50 when systems array is empty (no data default)', () => {
    expect(scoreReadinessPriority([])).toBe(50);
  });

  it('returns 0 when coverage, accuracy, and calibration are all perfect', () => {
    // blueprintWeight = attemptFraction: no gap
    // accuracy = 0.80 ≥ 0.70: no gap
    // calibrationRisk = 0
    const sys = makeSystem({ blueprintWeight: 0.2, attemptFraction: 0.2, accuracy: 0.80, calibrationRisk: 0 });
    expect(scoreReadinessPriority([sys])).toBe(0);
  });

  it('returns 100 when all five systems have maximal gaps', () => {
    // 5 systems each with blueprintWeight=0.2, no attempts, accuracy=0, calibrationRisk=1
    // coverageGapScore per system = (0.2/0.15)*0.2 = 0.2667 → sum = 1.333 → min(1,…)=1 → *40=40
    // accuracyGapScore per system = (0.70/0.70)*0.2 = 0.2   → sum = 1.0   → min(1,…)=1 → *35=35
    // calibrationScore per system = 1.0*0.2 = 0.2           → sum = 1.0   → min(1,…)=1 → *25=25
    const systems = Array.from({ length: 5 }, (_, i) =>
      makeSystem({ system: `Sys${i}`, blueprintWeight: 0.2, attemptFraction: 0, accuracy: 0, calibrationRisk: 1 })
    );
    expect(scoreReadinessPriority(systems)).toBe(100);
  });

  it('coverage gap above blueprint weight contributes positively', () => {
    // blueprintWeight=0.20, attemptFraction=0: gap = 0.20
    const sys = makeSystem({ blueprintWeight: 0.20, attemptFraction: 0, accuracy: 0.80, calibrationRisk: 0 });
    const score = scoreReadinessPriority([sys]);
    expect(score).toBeGreaterThan(0);
  });

  it('over-represented systems (attemptFraction > blueprintWeight) get no coverage penalty', () => {
    // Over-represented: attemptFraction=0.5 > blueprintWeight=0.2 → gap=0
    const sys = makeSystem({ blueprintWeight: 0.2, attemptFraction: 0.5, accuracy: 0.80, calibrationRisk: 0 });
    expect(scoreReadinessPriority([sys])).toBe(0);
  });

  it('accuracy below 70% threshold contributes to score', () => {
    const good = makeSystem({ accuracy: 0.80, calibrationRisk: 0 });
    const poor = makeSystem({ accuracy: 0.40, calibrationRisk: 0 });
    expect(scoreReadinessPriority([poor])).toBeGreaterThan(scoreReadinessPriority([good]));
  });

  it('accuracy above 70% threshold does not add accuracy penalty', () => {
    const sys1 = makeSystem({ accuracy: 0.75 });
    const sys2 = makeSystem({ accuracy: 0.95 });
    // Both above 0.70 threshold → no accuracy gap
    expect(scoreReadinessPriority([sys1])).toEqual(scoreReadinessPriority([sys2]));
  });

  it('calibration risk linearly increases score', () => {
    const low = makeSystem({ calibrationRisk: 0.1 });
    const high = makeSystem({ calibrationRisk: 0.9 });
    expect(scoreReadinessPriority([high])).toBeGreaterThan(scoreReadinessPriority([low]));
  });

  it('result is always in [0, 100]', () => {
    const systems = Array.from({ length: 10 }, (_, i) =>
      makeSystem({ system: `Sys${i}`, blueprintWeight: 0.5, attemptFraction: 0, accuracy: 0, calibrationRisk: 1 })
    );
    const score = scoreReadinessPriority(systems);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('result is an integer (rounded)', () => {
    const sys = makeSystem({ blueprintWeight: 0.13, attemptFraction: 0.07, accuracy: 0.50, calibrationRisk: 0.3 });
    const score = scoreReadinessPriority([sys]);
    expect(score).toBe(Math.round(score));
  });
});

// ─── scoreRetentionPriority ───────────────────────────────────────────────────

describe('scoreRetentionPriority', () => {
  it('returns 0 when all counts are 0', () => {
    expect(scoreRetentionPriority(makeRetention())).toBe(0);
  });

  it('returns 100 at maximum pressure (25 due, 13 overdue, 20 unstable)', () => {
    // dueFraction = min(1, 25/25) = 1.0 → *40 = 40
    // overdueFraction = min(1, 13/12.5) = 1.0 → *35 = 35
    // unstableFraction = min(1, 20/20) = 1.0 → *25 = 25
    const stats = makeRetention({ dueCount: 25, overdueCount: 13, unstableCount: 20 });
    expect(scoreRetentionPriority(stats)).toBe(100);
  });

  it('due count alone: 25 due → 40 points', () => {
    const stats = makeRetention({ dueCount: 25 });
    expect(scoreRetentionPriority(stats)).toBe(40);
  });

  it('overdue alone: 13 overdue → 35 points', () => {
    // min(1, 13/12.5) = 1.0 → *35 = 35
    const stats = makeRetention({ overdueCount: 13 });
    expect(scoreRetentionPriority(stats)).toBe(35);
  });

  it('unstable alone: 20 unstable → 25 points', () => {
    const stats = makeRetention({ unstableCount: 20 });
    expect(scoreRetentionPriority(stats)).toBe(25);
  });

  it('due count is proportional below cap', () => {
    // 12 due → min(1, 12/25) = 0.48 → *40 = 19.2 → round → 19
    const stats = makeRetention({ dueCount: 12 });
    expect(scoreRetentionPriority(stats)).toBe(19);
  });

  it('due count capped at 100 even with very high numbers', () => {
    const stats = makeRetention({ dueCount: 999, overdueCount: 999, unstableCount: 999 });
    expect(scoreRetentionPriority(stats)).toBe(100);
  });

  it('result is an integer (rounded)', () => {
    const stats = makeRetention({ dueCount: 7 });
    const score = scoreRetentionPriority(stats);
    expect(score).toBe(Math.round(score));
  });

  it('result is always in [0, 100]', () => {
    const extremes = [
      makeRetention({ dueCount: 0, overdueCount: 0, unstableCount: 0 }),
      makeRetention({ dueCount: 1000, overdueCount: 1000, unstableCount: 1000 }),
    ];
    for (const stats of extremes) {
      const s = scoreRetentionPriority(stats);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ─── decideSplit ──────────────────────────────────────────────────────────────

describe('decideSplit', () => {
  it('returns balanced when priorities are equal', () => {
    expect(decideSplit(50, 50)).toBe('balanced');
  });

  it('returns balanced when difference is exactly SPLIT_THRESHOLD (15)', () => {
    // diff = 15: NOT strictly > 15 → balanced
    expect(decideSplit(50, 65)).toBe('balanced');
    // diff = -15: NOT strictly < -15 → balanced
    expect(decideSplit(65, 50)).toBe('balanced');
  });

  it('returns targeted_heavy when retention exceeds readiness by more than 15', () => {
    expect(decideSplit(50, 66)).toBe('targeted_heavy');
    expect(decideSplit(30, 80)).toBe('targeted_heavy');
  });

  it('returns main_heavy when readiness exceeds retention by more than 15', () => {
    expect(decideSplit(66, 50)).toBe('main_heavy');
    expect(decideSplit(80, 30)).toBe('main_heavy');
  });

  it('returns balanced for close but unequal priorities', () => {
    expect(decideSplit(55, 60)).toBe('balanced');
    expect(decideSplit(70, 65)).toBe('balanced');
  });
});

// ─── rankSystemsForMain ───────────────────────────────────────────────────────

describe('rankSystemsForMain', () => {
  it('returns empty array for empty input', () => {
    expect(rankSystemsForMain([])).toHaveLength(0);
  });

  it('returns at most 3 systems (MAX_MAIN_SYSTEMS)', () => {
    const systems = Array.from({ length: 6 }, (_, i) =>
      makeSystem({ system: `Sys${i}`, blueprintWeight: 0.1 })
    );
    expect(rankSystemsForMain(systems)).toHaveLength(3);
  });

  it('returns all systems when fewer than 3', () => {
    const systems = [
      makeSystem({ system: 'CardioA', blueprintWeight: 0.3 }),
      makeSystem({ system: 'CardioB', blueprintWeight: 0.2 }),
    ];
    expect(rankSystemsForMain(systems)).toHaveLength(2);
  });

  it('prioritizes systems with larger coverage gaps', () => {
    const underRep = makeSystem({ system: 'Under', blueprintWeight: 0.3, attemptFraction: 0.0, accuracy: 0.80 });
    const overRep = makeSystem({ system: 'Over', blueprintWeight: 0.3, attemptFraction: 0.5, accuracy: 0.80 });
    const result = rankSystemsForMain([overRep, underRep]);
    expect(result[0]).toBe('Under');
  });

  it('prioritizes systems with lower accuracy (below 70%)', () => {
    const poor = makeSystem({ system: 'Poor', blueprintWeight: 0.2, accuracy: 0.40, attemptFraction: 0.2 });
    const good = makeSystem({ system: 'Good', blueprintWeight: 0.2, accuracy: 0.85, attemptFraction: 0.2 });
    const result = rankSystemsForMain([good, poor]);
    expect(result[0]).toBe('Poor');
  });

  it('returns system names (strings), not objects', () => {
    const sys = makeSystem({ system: 'Cardiology' });
    const result = rankSystemsForMain([sys]);
    expect(typeof result[0]).toBe('string');
    expect(result[0]).toBe('Cardiology');
  });
});

// ─── buildReasonSummary ───────────────────────────────────────────────────────

describe('buildReasonSummary', () => {
  it('labels main_heavy split as readiness-heavy', () => {
    const s = buildReasonSummary('main_heavy', 80, 30, [], 0, 0);
    expect(s).toContain('readiness-heavy');
  });

  it('labels targeted_heavy split as retention-heavy', () => {
    const s = buildReasonSummary('targeted_heavy', 30, 80, [], 0, 0);
    expect(s).toContain('retention-heavy');
  });

  it('labels balanced split as balanced', () => {
    const s = buildReasonSummary('balanced', 50, 50, [], 0, 0);
    expect(s).toContain('balanced');
  });

  it('includes readiness and retention scores in summary', () => {
    const s = buildReasonSummary('balanced', 42, 67, [], 0, 0);
    expect(s).toContain('42/100');
    expect(s).toContain('67/100');
  });

  it('includes mainSystems in the summary when provided', () => {
    const s = buildReasonSummary('main_heavy', 70, 40, ['Cardiology', 'Pulmonology'], 0, 0);
    expect(s).toContain('Cardiology');
    expect(s).toContain('Pulmonology');
    expect(s).toContain('Focus MAIN sessions on');
  });

  it('does not include systems line when mainSystems is empty', () => {
    const s = buildReasonSummary('balanced', 50, 50, [], 0, 0);
    expect(s).not.toContain('Focus MAIN sessions on');
  });

  it('mentions overdue count when overdueCount > 0', () => {
    const s = buildReasonSummary('targeted_heavy', 30, 80, [], 10, 3);
    expect(s).toContain('overdue');
    expect(s).toContain('3');
  });

  it('uses singular "card" for overdueCount=1', () => {
    const s = buildReasonSummary('targeted_heavy', 30, 80, [], 0, 1);
    expect(s).toMatch(/1 overdue FSRS card\b/); // no trailing 's'
  });

  it('uses plural "cards" for overdueCount=2', () => {
    const s = buildReasonSummary('targeted_heavy', 30, 80, [], 0, 2);
    expect(s).toContain('2 overdue FSRS cards');
  });

  it('mentions due count when overdueCount=0 but dueCount>0', () => {
    const s = buildReasonSummary('balanced', 50, 50, [], 5, 0);
    expect(s).toContain('5 cards due');
    expect(s).not.toContain('overdue');
  });

  it('uses singular "card" for dueCount=1', () => {
    const s = buildReasonSummary('balanced', 50, 50, [], 1, 0);
    expect(s).toMatch(/1 card\b/);
  });

  it('includes no due/overdue sentence when both are 0', () => {
    const s = buildReasonSummary('main_heavy', 80, 30, [], 0, 0);
    expect(s).not.toContain('due');
  });

  it('returns a non-empty string', () => {
    const s = buildReasonSummary('balanced', 50, 50, [], 0, 0);
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  });
});
