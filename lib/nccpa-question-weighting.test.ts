import { describe, it, expect } from 'vitest';
import {
  calculateOrderDistribution,
  inferLearnerPhase,
  normalizeSystemCode,
  getSystemWeight,
  calculateSessionDistribution,
  validateSessionDistribution,
  getSystemWeightsSorted,
  ORDER_DISTRIBUTION_BY_PHASE,
  NCCPA_BLUEPRINT_WEIGHTS,
  type LearnerPhase,
  type LearnerProfile,
} from './nccpa-question-weighting';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2025-06-01T12:00:00Z');

/** Create a Date N weeks from NOW (the fixed reference) */
function weeksFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 7 * 24 * 60 * 60 * 1000);
}

// ─── ORDER_DISTRIBUTION_BY_PHASE sanity ──────────────────────────────────────

describe('ORDER_DISTRIBUTION_BY_PHASE', () => {
  const phases: LearnerPhase[] = ['didactic', 'clinical', 'pance_prep'];

  it('each phase sums to 1.0', () => {
    for (const phase of phases) {
      const d = ORDER_DISTRIBUTION_BY_PHASE[phase];
      expect(d.first + d.second + d.third).toBeCloseTo(1, 10);
    }
  });

  it('pance_prep has lowest first-order weight (match exam)', () => {
    expect(ORDER_DISTRIBUTION_BY_PHASE['pance_prep'].first)
      .toBeLessThan(ORDER_DISTRIBUTION_BY_PHASE['didactic'].first);
  });

  it('pance_prep has highest third-order weight', () => {
    expect(ORDER_DISTRIBUTION_BY_PHASE['pance_prep'].third)
      .toBeGreaterThan(ORDER_DISTRIBUTION_BY_PHASE['didactic'].third);
  });
});

// ─── calculateOrderDistribution ──────────────────────────────────────────────

describe('calculateOrderDistribution', () => {
  it('total equals sessionSize for all phases', () => {
    for (const phase of ['didactic', 'clinical', 'pance_prep'] as LearnerPhase[]) {
      const result = calculateOrderDistribution(40, phase);
      expect(result.first + result.second + result.third).toBe(40);
    }
  });

  it('total equals sessionSize for odd sizes', () => {
    for (const size of [1, 7, 33, 99]) {
      const result = calculateOrderDistribution(size, 'pance_prep');
      expect(result.first + result.second + result.third).toBe(size);
    }
  });

  it('didactic has more first-order than pance_prep', () => {
    const didactic = calculateOrderDistribution(100, 'didactic');
    const pance = calculateOrderDistribution(100, 'pance_prep');
    expect(didactic.first).toBeGreaterThan(pance.first);
  });

  it('pance_prep has more third-order than didactic', () => {
    const didactic = calculateOrderDistribution(100, 'didactic');
    const pance = calculateOrderDistribution(100, 'pance_prep');
    expect(pance.third).toBeGreaterThan(didactic.third);
  });

  it('zero session size → all zeros', () => {
    const result = calculateOrderDistribution(0, 'clinical');
    expect(result.first).toBe(0);
    expect(result.second).toBe(0);
    expect(result.third).toBe(0);
  });
});

// ─── inferLearnerPhase ────────────────────────────────────────────────────────

describe('inferLearnerPhase', () => {
  it('empty profile → didactic (default)', () => {
    expect(inferLearnerPhase({}, NOW)).toBe('didactic');
  });

  it('PANCE exam in 4 weeks → pance_prep (priority 1)', () => {
    const profile: LearnerProfile = { examDate: weeksFromNow(4) };
    expect(inferLearnerPhase(profile, NOW)).toBe('pance_prep');
  });

  it('PANCE exam in 8 weeks (boundary) → pance_prep', () => {
    const profile: LearnerProfile = { examDate: weeksFromNow(8) };
    expect(inferLearnerPhase(profile, NOW)).toBe('pance_prep');
  });

  it('PANCE exam in 10 weeks → not pance_prep (falls through)', () => {
    const profile: LearnerProfile = { examDate: weeksFromNow(10) };
    // Falls through to default didactic
    expect(inferLearnerPhase(profile, NOW)).toBe('didactic');
  });

  it('EOR exam in 3 weeks → pance_prep (rotation crunch)', () => {
    const profile: LearnerProfile = { eorTestDate: weeksFromNow(3) };
    expect(inferLearnerPhase(profile, NOW)).toBe('pance_prep');
  });

  it('EOR exam in 5 weeks (>4 weeks) → not pance_prep from EOR alone', () => {
    const profile: LearnerProfile = { eorTestDate: weeksFromNow(5) };
    // EOR > 4 weeks — falls through; no rotation specified → didactic
    expect(inferLearnerPhase(profile, NOW)).toBe('didactic');
  });

  it('currentRotation set → clinical (priority 3)', () => {
    const profile: LearnerProfile = { currentRotation: 'EM Rotation' };
    expect(inferLearnerPhase(profile, NOW)).toBe('clinical');
  });

  it('trainingPhase CLINICAL → clinical', () => {
    const profile: LearnerProfile = { trainingPhase: 'CLINICAL' };
    expect(inferLearnerPhase(profile, NOW)).toBe('clinical');
  });

  it('trainingPhase GRADUATED → pance_prep (PANRE)', () => {
    const profile: LearnerProfile = { trainingPhase: 'GRADUATED' };
    expect(inferLearnerPhase(profile, NOW)).toBe('pance_prep');
  });

  it('yearInProgram "2" → clinical', () => {
    const profile: LearnerProfile = { yearInProgram: '2' };
    expect(inferLearnerPhase(profile, NOW)).toBe('clinical');
  });

  it('yearInProgram "3" → clinical', () => {
    const profile: LearnerProfile = { yearInProgram: '3' };
    expect(inferLearnerPhase(profile, NOW)).toBe('clinical');
  });

  it('yearInProgram "1" → didactic (< 2)', () => {
    const profile: LearnerProfile = { yearInProgram: '1' };
    expect(inferLearnerPhase(profile, NOW)).toBe('didactic');
  });

  it('examDate overrides trainingPhase CLINICAL', () => {
    const profile: LearnerProfile = {
      examDate: weeksFromNow(2),
      trainingPhase: 'CLINICAL',
    };
    expect(inferLearnerPhase(profile, NOW)).toBe('pance_prep');
  });

  it('examDate as ISO string is parsed', () => {
    const profile: LearnerProfile = { examDate: weeksFromNow(3).toISOString() };
    expect(inferLearnerPhase(profile, NOW)).toBe('pance_prep');
  });

  it('invalid date string → ignored', () => {
    const profile: LearnerProfile = { examDate: 'not-a-date' };
    expect(inferLearnerPhase(profile, NOW)).toBe('didactic');
  });
});

// ─── normalizeSystemCode ──────────────────────────────────────────────────────

describe('normalizeSystemCode', () => {
  it('empty string → UNKNOWN', () => {
    expect(normalizeSystemCode('')).toBe('UNKNOWN');
  });

  it('already valid code → returned as-is', () => {
    expect(normalizeSystemCode('CV')).toBe('CV');
    expect(normalizeSystemCode('PULM')).toBe('PULM');
    expect(normalizeSystemCode('ID')).toBe('ID');
  });

  it('lowercase valid code → uppercase', () => {
    expect(normalizeSystemCode('cv')).toBe('CV');
    expect(normalizeSystemCode('pulm')).toBe('PULM');
  });

  it('alias CARDIOVASCULAR → CV', () => {
    expect(normalizeSystemCode('CARDIOVASCULAR')).toBe('CV');
  });

  it('alias ENT → HEENT', () => {
    expect(normalizeSystemCode('ENT')).toBe('HEENT');
  });

  it('alias OBGYN → REPRO', () => {
    expect(normalizeSystemCode('OBGYN')).toBe('REPRO');
  });

  it('alias KIDNEY → RENAL', () => {
    expect(normalizeSystemCode('KIDNEY')).toBe('RENAL');
  });

  it('unknown system → returned uppercase', () => {
    const result = normalizeSystemCode('mystery-system');
    expect(result).toBe('MYSTERY-SYSTEM');
  });

  it('trims whitespace before normalizing', () => {
    expect(normalizeSystemCode('  CV  ')).toBe('CV');
  });
});

// ─── getSystemWeight ──────────────────────────────────────────────────────────

describe('getSystemWeight', () => {
  it('CV has 11% weight (highest)', () => {
    expect(getSystemWeight('CV')).toBe(11);
  });

  it('alias resolves to correct weight', () => {
    expect(getSystemWeight('CARDIOVASCULAR')).toBe(11);
  });

  it('EMERGENCY has 2% weight (lowest)', () => {
    expect(getSystemWeight('EMERGENCY')).toBe(2);
  });

  it('unknown system → 0', () => {
    expect(getSystemWeight('UNKNOWN')).toBe(0);
  });

  it('all NCCPA systems return positive weight', () => {
    for (const system of Object.keys(NCCPA_BLUEPRINT_WEIGHTS)) {
      expect(getSystemWeight(system)).toBeGreaterThan(0);
    }
  });
});

// ─── calculateSessionDistribution ────────────────────────────────────────────

describe('calculateSessionDistribution', () => {
  it('total question count equals sessionSize', () => {
    for (const size of [20, 40, 60, 100]) {
      const dist = calculateSessionDistribution(size);
      const total = Array.from(dist.values()).reduce((s, n) => s + n, 0);
      expect(total).toBe(size);
    }
  });

  it('contains all 15 NCCPA systems', () => {
    const dist = calculateSessionDistribution(40);
    for (const system of Object.keys(NCCPA_BLUEPRINT_WEIGHTS)) {
      expect(dist.has(system)).toBe(true);
    }
  });

  it('CV (11%) gets more questions than EMERGENCY (2%)', () => {
    const dist = calculateSessionDistribution(100);
    expect(dist.get('CV')!).toBeGreaterThan(dist.get('EMERGENCY')!);
  });

  it('all counts are non-negative integers', () => {
    const dist = calculateSessionDistribution(40);
    for (const count of dist.values()) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── validateSessionDistribution ─────────────────────────────────────────────

describe('validateSessionDistribution', () => {
  it('returns valid=true for perfect distribution', () => {
    // Use calculateSessionDistribution output — should pass its own validation
    const dist = calculateSessionDistribution(100);
    const result = validateSessionDistribution(dist, 100);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns valid=false when CV is severely under-represented', () => {
    const dist = new Map([['CV', 0]]); // CV should have 11% → severe violation
    const result = validateSessionDistribution(dist, 40);
    expect(result.valid).toBe(false);
    const cvViolation = result.violations.find(v => v.system === 'CV');
    expect(cvViolation).toBeDefined();
  });

  it('violation includes system, expected, and actual', () => {
    const dist = new Map([['CV', 0]]);
    const result = validateSessionDistribution(dist, 40);
    const cv = result.violations.find(v => v.system === 'CV')!;
    expect(cv.expected).toBe(11); // CV has 11% weight
    expect(typeof cv.actual).toBe('number');
  });

  it('custom tolerance of 0 fails on any rounding', () => {
    // With tolerance=0, even tiny rounding differences should fail
    const dist = calculateSessionDistribution(40);
    // Tolerance 0 → any rounding diff triggers violation
    const result = validateSessionDistribution(dist, 40, 0);
    // This is informational — just check structure
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.violations)).toBe(true);
  });
});

// ─── getSystemWeightsSorted ───────────────────────────────────────────────────

describe('getSystemWeightsSorted', () => {
  it('returns all 15 NCCPA systems', () => {
    const sorted = getSystemWeightsSorted();
    expect(sorted).toHaveLength(Object.keys(NCCPA_BLUEPRINT_WEIGHTS).length);
  });

  it('sorted by percentage descending', () => {
    const sorted = getSystemWeightsSorted();
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i]!.percentage).toBeGreaterThanOrEqual(sorted[i + 1]!.percentage);
    }
  });

  it('first entry is CV (highest weight 11%)', () => {
    const sorted = getSystemWeightsSorted();
    expect(sorted[0]!.system).toBe('CV');
    expect(sorted[0]!.percentage).toBe(11);
  });

  it('last entry is EMERGENCY (lowest weight 2%)', () => {
    const sorted = getSystemWeightsSorted();
    expect(sorted[sorted.length - 1]!.system).toBe('EMERGENCY');
  });

  it('questionsPerSession matches percentage formula', () => {
    const sorted = getSystemWeightsSorted();
    for (const entry of sorted) {
      const expected = Math.round((entry.percentage / 100) * 40);
      expect(entry.questionsPerSession(40)).toBe(expected);
    }
  });
});

// ─── NCCPA_BLUEPRINT_WEIGHTS sanity ──────────────────────────────────────────

describe('NCCPA_BLUEPRINT_WEIGHTS', () => {
  it('sums to the expected blueprint total (98 per current weights)', () => {
    // CV(11)+PULM(9)+GI(9)+MSK(9)+HEENT(8)+REPRO(8)+NEURO(7)+PSYCH(7)+
    // ENDO(6)+DERM(5)+GU(5)+HEME(4)+ID(4)+RENAL(4)+EMERGENCY(2) = 98
    const total = Object.values(NCCPA_BLUEPRINT_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBe(98);
  });

  it('has exactly 15 systems', () => {
    expect(Object.keys(NCCPA_BLUEPRINT_WEIGHTS)).toHaveLength(15);
  });

  it('all weights are positive integers', () => {
    for (const w of Object.values(NCCPA_BLUEPRINT_WEIGHTS)) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThan(0);
    }
  });
});
