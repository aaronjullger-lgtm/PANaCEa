import { describe, it, expect } from 'vitest';
import {
  hashUserToBucket,
  assignVariant,
  analyzeExperiment,
  type ABVariant,
  type ABConversionRecord,
} from './abTestService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConversion(
  variant: string,
  value?: number,
  experimentId = 'exp-1',
  eventName = 'click'
): ABConversionRecord {
  return {
    id: `conv-${Math.random()}`,
    userId: 'user-1',
    experimentId,
    variantName: variant,
    eventName,
    value: value ?? null,
    createdAt: new Date(),
  };
}

const EQUAL_VARIANTS: ABVariant[] = [
  { name: 'control', weight: 1 },
  { name: 'treatment', weight: 1 },
];

// ─── hashUserToBucket ─────────────────────────────────────────────────────────

describe('hashUserToBucket', () => {
  it('returns a float in [0, 1)', () => {
    for (const [u, e] of [['userA', 'exp1'], ['userB', 'exp2'], ['user-xyz', 'test-exp']]) {
      const r = hashUserToBucket(u!, e!);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('is deterministic: same inputs → same output', () => {
    const r1 = hashUserToBucket('alice', 'my-experiment');
    const r2 = hashUserToBucket('alice', 'my-experiment');
    expect(r1).toBe(r2);
  });

  it('different users → different buckets (high probability)', () => {
    const r1 = hashUserToBucket('alice', 'exp-1');
    const r2 = hashUserToBucket('bob', 'exp-1');
    expect(r1).not.toBe(r2);
  });

  it('same user, different experiments → different buckets', () => {
    const r1 = hashUserToBucket('alice', 'exp-1');
    const r2 = hashUserToBucket('alice', 'exp-2');
    expect(r1).not.toBe(r2);
  });

  it('distributes reasonably across users (sanity check)', () => {
    const buckets = Array.from({ length: 100 }, (_, i) =>
      hashUserToBucket(`user-${i}`, 'test-exp')
    );
    const avgBucket = buckets.reduce((s, b) => s + b, 0) / buckets.length;
    // Rough uniformity: mean should be near 0.5
    expect(avgBucket).toBeGreaterThan(0.3);
    expect(avgBucket).toBeLessThan(0.7);
  });

  it('empty strings → still returns a number in [0, 1)', () => {
    const r = hashUserToBucket('', '');
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  });
});

// ─── assignVariant ────────────────────────────────────────────────────────────

describe('assignVariant', () => {
  it('returns null for empty variants list', () => {
    expect(assignVariant('user-1', 'exp-1', [])).toBeNull();
  });

  it('returns null when user is outside traffic percentage', () => {
    // 0% traffic → no one gets assigned
    const result = assignVariant('user-1', 'exp-1', EQUAL_VARIANTS, 0);
    expect(result).toBeNull();
  });

  it('100% traffic → always assigns a variant', () => {
    const result = assignVariant('user-1', 'exp-1', EQUAL_VARIANTS, 100);
    expect(['control', 'treatment']).toContain(result);
  });

  it('is deterministic for same user+experiment', () => {
    const r1 = assignVariant('alice', 'exp-A', EQUAL_VARIANTS);
    const r2 = assignVariant('alice', 'exp-A', EQUAL_VARIANTS);
    expect(r1).toBe(r2);
  });

  it('only returns variants in the provided list', () => {
    const variants: ABVariant[] = [
      { name: 'v1', weight: 1 },
      { name: 'v2', weight: 1 },
      { name: 'v3', weight: 1 },
    ];
    for (let i = 0; i < 50; i++) {
      const result = assignVariant(`user-${i}`, 'exp-multi', variants);
      if (result !== null) {
        expect(['v1', 'v2', 'v3']).toContain(result);
      }
    }
  });

  it('single variant → always assigns that variant (within traffic)', () => {
    const single: ABVariant[] = [{ name: 'only', weight: 1 }];
    // Try many users to find one in traffic
    for (let i = 0; i < 20; i++) {
      const result = assignVariant(`user-${i}`, 'exp-1', single, 100);
      expect(result).toBe('only');
    }
  });

  it('zero total weight → returns null', () => {
    const zeroWeight: ABVariant[] = [{ name: 'v1', weight: 0 }, { name: 'v2', weight: 0 }];
    const result = assignVariant('user-1', 'exp-1', zeroWeight, 100);
    expect(result).toBeNull();
  });

  it('distributes roughly equally with equal weights (50-user sample)', () => {
    const counts: Record<string, number> = { control: 0, treatment: 0, unassigned: 0 };
    for (let i = 0; i < 200; i++) {
      const r = assignVariant(`user-${i}`, 'dist-exp', EQUAL_VARIANTS, 100);
      if (r === null) counts['unassigned']!++;
      else counts[r] = (counts[r] ?? 0) + 1;
    }
    // Rough 50/50 split: each variant should get 60-140 of 200
    expect(counts['control']!).toBeGreaterThan(60);
    expect(counts['treatment']!).toBeGreaterThan(60);
  });
});

// ─── analyzeExperiment ────────────────────────────────────────────────────────

describe('analyzeExperiment', () => {
  it('returns all required fields', () => {
    const conversions = [
      makeConversion('control', 1),
      makeConversion('treatment', 2),
    ];
    const result = analyzeExperiment('exp-1', 'click', conversions);
    expect(result).toHaveProperty('experimentId');
    expect(result).toHaveProperty('eventName');
    expect(result).toHaveProperty('variants');
    expect(result).toHaveProperty('meanDifference');
    expect(result).toHaveProperty('tStatistic');
    expect(result).toHaveProperty('degreesOfFreedom');
    expect(result).toHaveProperty('pValue');
    expect(result).toHaveProperty('isSignificant');
  });

  it('experimentId and eventName passed through', () => {
    const result = analyzeExperiment('my-exp', 'purchase', []);
    expect(result.experimentId).toBe('my-exp');
    expect(result.eventName).toBe('purchase');
  });

  it('empty conversions → no significance, null stats', () => {
    const result = analyzeExperiment('exp-1', 'click', []);
    expect(result.isSignificant).toBe(false);
    expect(result.tStatistic).toBeNull();
  });

  it('ignores conversions for wrong experiment or event', () => {
    const conversions = [
      makeConversion('control', 1, 'other-exp'),
      makeConversion('control', 1, 'exp-1', 'other-event'),
    ];
    const result = analyzeExperiment('exp-1', 'click', conversions);
    expect(result.variants).toHaveLength(0);
  });

  it('single variant → no t-statistic (need ≥2 variants)', () => {
    const conversions = Array.from({ length: 5 }, () => makeConversion('control', 1));
    const result = analyzeExperiment('exp-1', 'click', conversions);
    expect(result.tStatistic).toBeNull();
  });

  it('detects clear difference as significant (large effect)', () => {
    // Control: values around 1; Treatment: values around 10 — huge effect with variance
    const controlVals = [1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2,
                         1, 2, 1, 1, 2, 1, 2, 1, 1, 2];
    const treatmentVals = [9, 10, 11, 10, 9, 10, 11, 10, 9, 10, 11, 10, 9, 10, 11, 10,
                           9, 10, 11, 10, 9, 10, 11, 10, 9, 10, 11, 10, 9, 10];
    const conversions = [
      ...controlVals.map(v => makeConversion('control', v)),
      ...treatmentVals.map(v => makeConversion('treatment', v)),
    ];
    const result = analyzeExperiment('exp-1', 'click', conversions);
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).not.toBeNull();
    expect(result.pValue!).toBeLessThan(0.05);
  });

  it('detects no significance for identical distributions', () => {
    const conversions = [
      ...Array.from({ length: 20 }, () => makeConversion('control', 5)),
      ...Array.from({ length: 20 }, () => makeConversion('treatment', 5)),
    ];
    const result = analyzeExperiment('exp-1', 'click', conversions);
    expect(result.isSignificant).toBe(false);
    expect(result.meanDifference).toBeCloseTo(0, 5);
  });

  it('uses value=1 when conversion has no value (count-based)', () => {
    const conversions = [
      makeConversion('control', undefined),
      makeConversion('control', undefined),
      makeConversion('treatment', undefined),
      makeConversion('treatment', undefined),
    ];
    const result = analyzeExperiment('exp-1', 'click', conversions);
    // Both variants mean should be 1 since value defaults to 1
    const controlVariant = result.variants.find(v => v.variantName === 'control');
    const treatmentVariant = result.variants.find(v => v.variantName === 'treatment');
    expect(controlVariant?.mean).toBeCloseTo(1, 5);
    expect(treatmentVariant?.mean).toBeCloseTo(1, 5);
  });

  it('variant metrics include n, mean, std, sum', () => {
    const conversions = [
      makeConversion('control', 2),
      makeConversion('control', 4),
      makeConversion('treatment', 3),
      makeConversion('treatment', 5),
    ];
    const result = analyzeExperiment('exp-1', 'click', conversions);
    const ctrl = result.variants.find(v => v.variantName === 'control')!;
    expect(ctrl.n).toBe(2);
    expect(ctrl.mean).toBeCloseTo(3, 5); // (2+4)/2
    expect(ctrl.sum).toBe(6);
  });

  it('meanDifference = treatment.mean - control.mean', () => {
    // control mean=1, treatment mean=5
    const conversions = [
      ...Array.from({ length: 10 }, () => makeConversion('control', 1)),
      ...Array.from({ length: 10 }, () => makeConversion('treatment', 5)),
    ];
    const result = analyzeExperiment('exp-1', 'click', conversions);
    // Variants sorted alphabetically: control[0], treatment[1]
    expect(result.meanDifference).toBeCloseTo(4, 1);
  });
});
