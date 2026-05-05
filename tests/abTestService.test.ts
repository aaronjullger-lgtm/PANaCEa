/**
 * A/B Testing Service — Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashUserToBucket,
  assignVariant,
  analyzeExperiment,
  ensureExposure,
  logConversion,
  isUserInTraffic,
  matchesLearnerStageTarget,
  type ABPrismaClient,
  type ABConversionRecord,
  type ABVariant,
} from '@/lib/services/abTestService';

// ============================================================================
// Mocks
// ============================================================================

// Silence logger in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// hashUserToBucket
// ============================================================================

describe('hashUserToBucket', () => {
  it('returns a value in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const bucket = hashUserToBucket(`user-${i}`, 'exp-1');
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(1);
    }
  });

  it('is deterministic — same inputs always produce the same output', () => {
    const a1 = hashUserToBucket('user-abc', 'exp-1');
    const a2 = hashUserToBucket('user-abc', 'exp-1');
    const a3 = hashUserToBucket('user-abc', 'exp-1');
    expect(a1).toBe(a2);
    expect(a2).toBe(a3);
  });

  it('produces different values for different users in the same experiment', () => {
    const a = hashUserToBucket('user-a', 'exp-1');
    const b = hashUserToBucket('user-b', 'exp-1');
    // Not guaranteed, but extremely unlikely to be equal
    expect(a).not.toBe(b);
  });

  it('produces different values for same user in different experiments', () => {
    const a = hashUserToBucket('user-1', 'exp-alpha');
    const b = hashUserToBucket('user-1', 'exp-beta');
    expect(a).not.toBe(b);
  });

  it('has roughly uniform distribution', () => {
    const n = 10000;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const bucket = hashUserToBucket(`user-${i}`, 'exp-dist');
      if (bucket < 0.5) count++;
    }
    // Expect roughly 50% in [0, 0.5) — allow 3% tolerance
    const ratio = count / n;
    expect(ratio).toBeGreaterThan(0.47);
    expect(ratio).toBeLessThan(0.53);
  });
});

// ============================================================================
// assignVariant
// ============================================================================

describe('assignVariant', () => {
  const twoVariants: ABVariant[] = [
    { name: 'control', weight: 50 },
    { name: 'treatment', weight: 50 },
  ];

  const threeVariants: ABVariant[] = [
    { name: 'control', weight: 1 },
    { name: 'treatment_a', weight: 1 },
    { name: 'treatment_b', weight: 1 },
  ];

  it('returns null for empty variants', () => {
    expect(assignVariant('user-1', 'exp-1', [], 100)).toBeNull();
  });

  it('returns null for zero weights', () => {
    expect(
      assignVariant('user-1', 'exp-1', [
        { name: 'a', weight: 0 },
        { name: 'b', weight: 0 },
      ], 100)
    ).toBeNull();
  });

  it('returns a valid variant name', () => {
    const variant = assignVariant('user-1', 'exp-1', twoVariants, 100);
    expect(['control', 'treatment']).toContain(variant);
  });

  it('is deterministic — same user always gets same variant', () => {
    for (let i = 0; i < 100; i++) {
      const a = assignVariant(`user-${i}`, 'exp-stable', twoVariants, 100);
      const b = assignVariant(`user-${i}`, 'exp-stable', twoVariants, 100);
      expect(a).toBe(b);
    }
  });

  it('respects traffic percentage — users outside are excluded', () => {
    let excluded = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const variant = assignVariant(`user-${i}`, 'exp-traffic', twoVariants, 50);
      if (variant === null) excluded++;
    }
    // Roughly 50% excluded
    const ratio = excluded / n;
    expect(ratio).toBeGreaterThan(0.47);
    expect(ratio).toBeLessThan(0.53);
  });

  it('100% traffic includes all users', () => {
    for (let i = 0; i < 1000; i++) {
      const variant = assignVariant(`user-${i}`, 'exp-100', twoVariants, 100);
      expect(variant).not.toBeNull();
    }
  });

  it('respects variant weights (2:1 split)', () => {
    const variants: ABVariant[] = [
      { name: 'control', weight: 2 },
      { name: 'treatment', weight: 1 },
    ];
    let controlCount = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const variant = assignVariant(`user-${i}`, 'exp-weights', variants, 100);
      if (variant === 'control') controlCount++;
    }
    const ratio = controlCount / n;
    // Roughly 66.7% control
    expect(ratio).toBeGreaterThan(0.63);
    expect(ratio).toBeLessThan(0.70);
  });

  it('works with 3+ variants', () => {
    const counts = { control: 0, treatment_a: 0, treatment_b: 0 };
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const variant = assignVariant(`user-${i}`, 'exp-3var', threeVariants, 100);
      if (variant && variant in counts) {
        counts[variant as keyof typeof counts]++;
      }
    }
    // Each should be roughly 33%
    for (const name of Object.keys(counts)) {
      const ratio = counts[name as keyof typeof counts] / n;
      expect(ratio).toBeGreaterThan(0.30);
      expect(ratio).toBeLessThan(0.37);
    }
  });
});

// ============================================================================
// analyzeExperiment
// ============================================================================

describe('analyzeExperiment', () => {
  it('returns empty result for no conversions', () => {
    const result = analyzeExperiment('exp-1', 'click', []);
    expect(result.experimentId).toBe('exp-1');
    expect(result.eventName).toBe('click');
    expect(result.variants).toHaveLength(0);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBeNull();
  });

  it('returns single variant with no significance data', () => {
    const conversions: ABConversionRecord[] = [
      {
        id: 'c1',
        userId: 'u1',
        experimentId: 'exp-1',
        variantName: 'control',
        eventName: 'click',
        value: 1,
        metadata: null,
        createdAt: new Date(),
      },
    ];

    const result = analyzeExperiment('exp-1', 'click', conversions);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]!.n).toBe(1);
    expect(result.variants[0]!.mean).toBe(1);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBeNull();
  });

  it('computes metrics for two variants', () => {
    const conversions: ABConversionRecord[] = [
      // control: values 1, 2, 3
      makeConversion('exp-1', 'control', 'score', 1),
      makeConversion('exp-1', 'control', 'score', 2),
      makeConversion('exp-1', 'control', 'score', 3),
      // treatment: values 4, 5, 6
      makeConversion('exp-1', 'treatment', 'score', 4),
      makeConversion('exp-1', 'treatment', 'score', 5),
      makeConversion('exp-1', 'treatment', 'score', 6),
    ];

    const result = analyzeExperiment('exp-1', 'score', conversions);
    expect(result.variants).toHaveLength(2);

    const control = result.variants.find((v) => v.variantName === 'control')!;
    const treatment = result.variants.find((v) => v.variantName === 'treatment')!;

    expect(control.n).toBe(3);
    expect(control.mean).toBeCloseTo(2);
    expect(treatment.n).toBe(3);
    expect(treatment.mean).toBeCloseTo(5);

    expect(result.meanDifference).toBeCloseTo(3);
    expect(result.tStatistic).not.toBeNull();
    expect(result.degreesOfFreedom).not.toBeNull();
    expect(result.pValue).not.toBeNull();
  });

  it('detects significant difference with well-separated groups', () => {
    // Generate two clearly separated groups
    const conversions: ABConversionRecord[] = [];

    // Control: values around 1.0 (n=50)
    for (let i = 0; i < 50; i++) {
      conversions.push(
        makeConversion('exp-sig', 'control', 'metric', 1 + Math.random() * 0.2)
      );
    }
    // Treatment: values around 2.0 (n=50)
    for (let i = 0; i < 50; i++) {
      conversions.push(
        makeConversion('exp-sig', 'treatment', 'metric', 2 + Math.random() * 0.2)
      );
    }

    const result = analyzeExperiment('exp-sig', 'metric', conversions);
    expect(result.isSignificant).toBe(true);
    expect(result.pValue!).toBeLessThan(0.05);
  });

  it('does not detect significance with overlapping groups', () => {
    const conversions: ABConversionRecord[] = [];

    // Both groups use the same bounded, overlapping distribution. Avoid Math.random
    // here so this non-significance assertion does not become a probabilistic flake.
    for (let i = 0; i < 30; i++) {
      const value = 5 + (i % 10) * 0.2;
      conversions.push(
        makeConversion('exp-ns', 'control', 'metric', value)
      );
      conversions.push(
        makeConversion('exp-ns', 'treatment', 'metric', value)
      );
    }

    const result = analyzeExperiment('exp-ns', 'metric', conversions);
    expect(result.pValue!).toBeGreaterThan(0.05);
    expect(result.isSignificant).toBe(false);
  });

  it('defaults value to 1 when null (count-based)', () => {
    const conversions: ABConversionRecord[] = [
      makeConversion('exp-1', 'control', 'event', undefined),
      makeConversion('exp-1', 'control', 'event', null),
      makeConversion('exp-1', 'treatment', 'event', undefined),
    ];

    const result = analyzeExperiment('exp-1', 'event', conversions);
    const control = result.variants.find((v) => v.variantName === 'control')!;
    expect(control.mean).toBe(1);
    expect(control.n).toBe(2);
  });

  it('filters by experimentId and eventName', () => {
    const conversions: ABConversionRecord[] = [
      makeConversion('exp-1', 'control', 'click', 1),
      makeConversion('exp-1', 'control', 'click', 2),
      makeConversion('exp-1', 'treatment', 'click', 3),
      // Different event — should be excluded
      makeConversion('exp-1', 'control', 'purchase', 1),
      // Different experiment — should be excluded
      makeConversion('exp-2', 'control', 'click', 99),
    ];

    const result = analyzeExperiment('exp-1', 'click', conversions);
    expect(result.variants).toHaveLength(2);
    expect(result.variants.reduce((s, v) => s + v.n, 0)).toBe(3);
  });

  it('handles single-sample variants gracefully (no significance test)', () => {
    const conversions: ABConversionRecord[] = [
      makeConversion('exp-1', 'control', 'x', 1),
      makeConversion('exp-1', 'treatment', 'x', 2),
    ];

    const result = analyzeExperiment('exp-1', 'x', conversions);
    expect(result.variants).toHaveLength(2);
    expect(result.tStatistic).toBeNull();
    expect(result.pValue).toBeNull();
    expect(result.isSignificant).toBe(false);
    expect(result.meanDifference).toBe(1);
  });
});

// ============================================================================
// isUserInTraffic
// ============================================================================

describe('isUserInTraffic', () => {
  it('includes user when bucket < traffic percentage', () => {
    // We can't control the hash, but we can check the function is consistent
    for (let i = 0; i < 100; i++) {
      const in100 = isUserInTraffic(`user-${i}`, 'exp-t', 100);
      expect(in100).toBe(true);
    }
  });

  it('excludes some users at 50% traffic', () => {
    let included = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      if (isUserInTraffic(`user-${i}`, 'exp-t50', 50)) included++;
    }
    const ratio = included / n;
    expect(ratio).toBeGreaterThan(0.47);
    expect(ratio).toBeLessThan(0.53);
  });

  it('excludes all users at 0% traffic', () => {
    for (let i = 0; i < 100; i++) {
      expect(isUserInTraffic(`user-${i}`, 'exp-t0', 0)).toBe(false);
    }
  });
});

// ============================================================================
// matchesLearnerStageTarget
// ============================================================================

describe('matchesLearnerStageTarget', () => {
  it('returns true for empty target stages (include all)', () => {
    expect(matchesLearnerStageTarget(undefined, [])).toBe(true);
    expect(matchesLearnerStageTarget('DIDACTIC', [])).toBe(true);
    expect(matchesLearnerStageTarget(null as any, [])).toBe(true);
  });

  it('returns false when user has no stage and target is set', () => {
    expect(matchesLearnerStageTarget(undefined, ['DIDACTIC'])).toBe(false);
    expect(matchesLearnerStageTarget(null as any, ['CLINICAL'])).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(matchesLearnerStageTarget('didactic', ['DIDACTIC'])).toBe(true);
    expect(matchesLearnerStageTarget('CLINICAL', ['clinical'])).toBe(true);
    expect(matchesLearnerStageTarget('Graduated', ['GRADUATED'])).toBe(true);
  });

  it('returns false when user stage not in target list', () => {
    expect(matchesLearnerStageTarget('DIDACTIC', ['CLINICAL', 'GRADUATED'])).toBe(
      false
    );
  });

  it('returns true when user stage is in target list', () => {
    expect(matchesLearnerStageTarget('CLINICAL', ['DIDACTIC', 'CLINICAL'])).toBe(
      true
    );
  });
});

// ============================================================================
// ensureExposure (mock DB)
// ============================================================================

describe('ensureExposure', () => {
  let db: ABPrismaClient;

  beforeEach(() => {
    db = createMockDB();
  });

  it('creates new exposure when none exists', async () => {
    const result = await ensureExposure(db, 'u1', 'exp-1', 'control');
    expect(result.userId).toBe('u1');
    expect(result.experimentId).toBe('exp-1');
    expect(result.variantName).toBe('control');
    expect(db.aBExposure.create).toHaveBeenCalledWith({
      data: { userId: 'u1', experimentId: 'exp-1', variantName: 'control' },
    });
  });

  it('returns existing exposure (idempotent)', async () => {
    const existing = {
      id: 'existing-id',
      userId: 'u1',
      experimentId: 'exp-1',
      variantName: 'control',
      createdAt: new Date(),
    };
    const mockDB = createMockDB({
      existingExposure: existing,
    });

    const result = await ensureExposure(mockDB, 'u1', 'exp-1', 'control');
    expect(result.id).toBe('existing-id');
    expect(mockDB.aBExposure.create).not.toHaveBeenCalled();
  });
});

// ============================================================================
// logConversion (mock DB)
// ============================================================================

describe('logConversion', () => {
  it('creates a conversion record with value', async () => {
    const db = createMockDB();
    const result = await logConversion(
      db,
      'u1',
      'exp-1',
      'control',
      'question_answered',
      95,
      { system: 'CV' }
    );

    expect(db.aBConversion.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        experimentId: 'exp-1',
        variantName: 'control',
        eventName: 'question_answered',
        value: 95,
        metadata: { system: 'CV' },
      },
    });
  });

  it('creates a conversion record without value', async () => {
    const db = createMockDB();
    await logConversion(db, 'u1', 'exp-1', 'treatment', 'review_completed');

    expect(db.aBConversion.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        experimentId: 'exp-1',
        variantName: 'treatment',
        eventName: 'review_completed',
        value: undefined,
        metadata: undefined,
      },
    });
  });
});

// ============================================================================
// Helpers
// ============================================================================

function makeConversion(
  experimentId: string,
  variantName: string,
  eventName: string,
  value?: number | null
): ABConversionRecord {
  return {
    id: `c-${Math.random().toString(36).slice(2)}`,
    userId: `u-${Math.random().toString(36).slice(2)}`,
    experimentId,
    variantName,
    eventName,
    value,
    metadata: null,
    createdAt: new Date(),
  };
}

function createMockDB(overrides?: { existingExposure?: any }): ABPrismaClient {
  return {
    aBExperiment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((args: any) => ({
        id: 'new-exp-id',
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn().mockImplementation((args: any) => ({
        id: args.where.id,
        ...args.data,
        updatedAt: new Date(),
      })),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    aBExposure: {
      findUnique: vi.fn().mockResolvedValue(overrides?.existingExposure ?? null),
      create: vi.fn().mockImplementation((args: any) => ({
        id: 'new-exposure-id',
        ...args.data,
        createdAt: new Date(),
      })),
      count: vi.fn().mockResolvedValue(0),
    },
    aBConversion: {
      create: vi.fn().mockImplementation((args: any) => ({
        id: 'new-conversion-id',
        ...args.data,
        createdAt: new Date(),
      })),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}
