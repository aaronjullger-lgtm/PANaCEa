import { describe, it, expect } from 'vitest';
import {
  computeDiscriminationMetrics,
  computePointBiserial,
  eloUpdateLoop,
  computeQualityFlag,
  analyzeDistractors,
  calibrateItem,
  batchCalibrateItems,
  summarizeCalibration,
  type AttemptRecord,
} from '@/lib/services/itemCalibrationService';

// ─── Deterministic Test Data ──────────────────────────────────────

function makeAttempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    questionId: 'q-001',
    userId: 'u-001',
    wasCorrect: true,
    selectedAnswer: 'A',
    timeSpentMs: 15000,
    userAccuracy: 0.70,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

/** Generate a realistic set of attempts with known properties */
function generateAttempts(count: number, correctRate: number): AttemptRecord[] {
  const attempts: AttemptRecord[] = [];
  for (let i = 0; i < count; i++) {
    const userAcc = 0.3 + (i / count) * 0.5; // 0.3 to 0.8 range
    const isCorrect = i / count < correctRate;
    attempts.push(
      makeAttempt({
        userId: `u-${String(i).padStart(3, '0')}`,
        wasCorrect: isCorrect,
        selectedAnswer: isCorrect ? 'A' : ['B', 'C', 'D'][i % 3]!,
        userAccuracy: userAcc,
        createdAt: new Date(Date.now() - (count - i) * 60000),
      })
    );
  }
  return attempts;
}

// ─── computeDiscriminationMetrics ─────────────────────────────────

describe('computeDiscriminationMetrics', () => {
  it('returns zero for empty attempts', () => {
    const { pValue, discriminationIndex } = computeDiscriminationMetrics([]);
    expect(pValue).toBe(0);
    expect(discriminationIndex).toBe(0);
  });

  it('computes correct p-value', () => {
    const attempts = [
      makeAttempt({ wasCorrect: true }),
      makeAttempt({ wasCorrect: true }),
      makeAttempt({ wasCorrect: false }),
      makeAttempt({ wasCorrect: false }),
    ];
    const { pValue } = computeDiscriminationMetrics(attempts);
    expect(pValue).toBeCloseTo(0.5, 5);
  });

  it('computes positive discrimination when high-ability students do better', () => {
    // High-ability users get it right, low-ability get it wrong
    const attempts = generateAttempts(40, 0.6);
    // Override: top accuracy students are correct, bottom are incorrect
    for (let i = 0; i < 40; i++) {
      attempts[i]!.wasCorrect = i >= 16; // top 60% correct
      attempts[i]!.userAccuracy = i / 40;
    }
    const { discriminationIndex } = computeDiscriminationMetrics(attempts);
    expect(discriminationIndex).toBeGreaterThan(0);
  });

  it('all-correct yields pValue=1 and DI=0', () => {
    const attempts = generateAttempts(20, 1.0);
    const { pValue, discriminationIndex } = computeDiscriminationMetrics(attempts);
    expect(pValue).toBe(1);
    expect(discriminationIndex).toBe(0);
  });
});

// ─── computePointBiserial ─────────────────────────────────────────

describe('computePointBiserial', () => {
  it('returns 0 for fewer than 3 attempts', () => {
    expect(computePointBiserial([makeAttempt()])).toBe(0);
  });

  it('returns 0 when all correct (no variance)', () => {
    const attempts = generateAttempts(20, 1.0);
    expect(computePointBiserial(attempts)).toBe(0);
  });

  it('returns positive rpb when high-ability students get correct', () => {
    const attempts: AttemptRecord[] = [];
    for (let i = 0; i < 30; i++) {
      const acc = i / 30;
      attempts.push(
        makeAttempt({
          userId: `u-${i}`,
          wasCorrect: acc > 0.5, // high-ability → correct
          userAccuracy: acc,
        })
      );
    }
    const rpb = computePointBiserial(attempts);
    expect(rpb).toBeGreaterThan(0);
  });

  it('returns negative rpb when high-ability students get it wrong (miskey)', () => {
    const attempts: AttemptRecord[] = [];
    for (let i = 0; i < 30; i++) {
      const acc = i / 30;
      attempts.push(
        makeAttempt({
          userId: `u-${i}`,
          wasCorrect: acc < 0.5, // high-ability → incorrect (miskeyed)
          userAccuracy: acc,
        })
      );
    }
    const rpb = computePointBiserial(attempts);
    expect(rpb).toBeLessThan(0);
  });
});

// ─── eloUpdateLoop ────────────────────────────────────────────────

describe('eloUpdateLoop', () => {
  it('difficulty stays near 0 for balanced item', () => {
    const attempts: AttemptRecord[] = [];
    for (let i = 0; i < 50; i++) {
      attempts.push(
        makeAttempt({
          wasCorrect: i % 2 === 0,
          userAccuracy: 0.5,
          createdAt: new Date(Date.now() - (50 - i) * 60000),
        })
      );
    }
    const { difficulty } = eloUpdateLoop(attempts);
    expect(Math.abs(difficulty)).toBeLessThan(1.5);
  });

  it('difficulty increases for very hard items', () => {
    const attempts: AttemptRecord[] = [];
    for (let i = 0; i < 50; i++) {
      attempts.push(
        makeAttempt({
          wasCorrect: false, // everyone gets it wrong
          userAccuracy: 0.7,
          createdAt: new Date(Date.now() - (50 - i) * 60000),
        })
      );
    }
    const { difficulty } = eloUpdateLoop(attempts);
    expect(difficulty).toBeGreaterThan(0.5);
  });

  it('uncertainty decreases with more observations', () => {
    const attempts = generateAttempts(100, 0.6);
    const { uncertainty } = eloUpdateLoop(attempts);
    expect(uncertainty).toBeLessThan(2.0);
    expect(uncertainty).toBeGreaterThanOrEqual(0.3);
  });

  it('respects initial difficulty', () => {
    const attempts = generateAttempts(5, 0.5);
    const { difficulty: fromZero } = eloUpdateLoop(attempts, 0);
    const { difficulty: fromHigh } = eloUpdateLoop(attempts, 2.0);
    // Starting from a higher difficulty should result in different final value
    expect(fromHigh).not.toBeCloseTo(fromZero, 1);
  });
});

// ─── computeQualityFlag ───────────────────────────────────────────

describe('computeQualityFlag', () => {
  it('flags "good" for healthy metrics', () => {
    const { flag } = computeQualityFlag(0.65, 0.40, 0.35, []);
    expect(flag).toBe('good');
  });

  it('flags "review" for below-target discrimination', () => {
    const { flag, issues } = computeQualityFlag(0.65, 0.20, 0.25, []);
    expect(flag).toBe('review');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags "remove" for negative discrimination', () => {
    const { flag } = computeQualityFlag(0.65, -0.10, 0.25, []);
    expect(flag).toBe('remove');
  });

  it('flags "remove" for negative point-biserial', () => {
    const { flag } = computeQualityFlag(0.65, 0.30, -0.05, []);
    expect(flag).toBe('remove');
  });

  it('flags extreme p-values', () => {
    const { issues: easy } = computeQualityFlag(0.98, 0.40, 0.30, []);
    expect(easy.some((i) => i.includes('Very easy'))).toBe(true);

    const { issues: hard } = computeQualityFlag(0.05, 0.40, 0.30, []);
    expect(hard.some((i) => i.includes('Very difficult'))).toBe(true);
  });
});

// ─── calibrateItem ────────────────────────────────────────────────

describe('calibrateItem', () => {
  it('produces complete calibration for realistic data', () => {
    const attempts = generateAttempts(50, 0.65);
    const cal = calibrateItem('q-test', attempts);

    expect(cal.questionId).toBe('q-test');
    expect(cal.totalResponses).toBe(50);
    expect(cal.pValue).toBeGreaterThan(0);
    expect(cal.pValue).toBeLessThanOrEqual(1);
    expect(cal.lastCalibratedAt).toBeTruthy();
    expect(['good', 'review', 'poor', 'remove']).toContain(cal.qualityFlag);
  });
});

// ─── batchCalibrateItems ──────────────────────────────────────────

describe('batchCalibrateItems', () => {
  it('skips items below minimum observations', () => {
    const map = new Map<string, AttemptRecord[]>();
    map.set('q-small', generateAttempts(5, 0.5));  // too few
    map.set('q-big', generateAttempts(50, 0.6));    // enough
    const results = batchCalibrateItems(map);
    expect(results.has('q-small')).toBe(false);
    expect(results.has('q-big')).toBe(true);
  });

  it('respects custom minimum responses', () => {
    const map = new Map<string, AttemptRecord[]>();
    map.set('q-ten', generateAttempts(10, 0.6));
    const results = batchCalibrateItems(map, undefined, 5);
    expect(results.has('q-ten')).toBe(true);
  });
});

// ─── summarizeCalibration ─────────────────────────────────────────

describe('summarizeCalibration', () => {
  it('returns zero counts for empty results', () => {
    const summary = summarizeCalibration(new Map());
    expect(summary.total).toBe(0);
    expect(summary.good).toBe(0);
  });

  it('correctly counts quality categories', () => {
    const map = new Map<string, AttemptRecord[]>();
    map.set('q-1', generateAttempts(50, 0.65));
    map.set('q-2', generateAttempts(50, 0.65));
    const calibrations = batchCalibrateItems(map, undefined, 30);
    const summary = summarizeCalibration(calibrations);
    expect(summary.total).toBe(2);
    expect(summary.good + summary.review + summary.poor + summary.remove).toBe(2);
  });
});
