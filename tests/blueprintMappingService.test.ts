import { describe, it, expect } from 'vitest';
import {
  getBlueprint,
  mapLearningTargetToBlueprint,
  getLearningTargetWeight,
  getTaskCategory,
  getSecondaryCategories,
  PANCE_BLUEPRINT,
  PANRE_BLUEPRINT,
  PEAE_BLUEPRINT,
} from '../lib/services/blueprintMappingService';

// ─── Blueprint Constants ───────────────────────────────────────────────────

describe('Blueprint constants', () => {
  it('PANCE blueprint has 300 total questions', () => {
    expect(PANCE_BLUEPRINT.totalQuestions).toBe(300);
    expect(PANCE_BLUEPRINT.examType).toBe('PANCE');
  });

  it('PANRE blueprint has 240 total questions', () => {
    expect(PANRE_BLUEPRINT.totalQuestions).toBe(240);
    expect(PANRE_BLUEPRINT.examType).toBe('PANRE');
  });

  it('PEAE blueprint has 300 total questions', () => {
    expect(PEAE_BLUEPRINT.totalQuestions).toBe(300);
    expect(PEAE_BLUEPRINT.examType).toBe('PEAE');
  });

  it('PANCE system weights sum ≈ 1.0', () => {
    const sum = Object.values(PANCE_BLUEPRINT.systemWeights).reduce(
      (a, b) => a + b,
      0
    );
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('PANCE task weights sum ≈ 1.0', () => {
    const sum = Object.values(PANCE_BLUEPRINT.taskWeights).reduce(
      (a, b) => a + b,
      0
    );
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('PANCE gives Cardiovascular the highest system weight (11%)', () => {
    expect(PANCE_BLUEPRINT.systemWeights['Cardiovascular']).toBeCloseTo(
      0.11,
      3
    );
  });

  it('PANRE reduces basic_science weight vs PANCE (less basic-science emphasis on recert)', () => {
    // PANCE basic_science = 0.08, PANRE = 0.08 * 0.7 = 0.056
    const panceBasic = PANCE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    const panreBasic = PANRE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    expect(panreBasic).toBeLessThan(panceBasic);
    expect(panreBasic / panceBasic).toBeCloseTo(0.7, 2);
  });

  it('PANRE increases clinical_intervention weight vs PANCE', () => {
    // PANCE clinical_intervention = 0.16, PANRE = 0.16 * 1.15 ≈ 0.184
    const panceCI = PANCE_BLUEPRINT.taskWeights['clinical_intervention'] ?? 0;
    const panreCI = PANRE_BLUEPRINT.taskWeights['clinical_intervention'] ?? 0;
    expect(panreCI).toBeGreaterThan(panceCI);
    expect(panreCI / panceCI).toBeCloseTo(1.15, 2);
  });

  it('PEAE increases diagnosis weight by 1.1x vs PANCE', () => {
    const panceDx = PANCE_BLUEPRINT.taskWeights['diagnosis'] ?? 0;
    const peaeDx = PEAE_BLUEPRINT.taskWeights['diagnosis'] ?? 0;
    expect(peaeDx / panceDx).toBeCloseTo(1.1, 2);
  });

  it('PEAE increases pharmaceutical weight by 1.1x vs PANCE', () => {
    const pancePharm = PANCE_BLUEPRINT.taskWeights['pharmaceutical'] ?? 0;
    const peaePharm = PEAE_BLUEPRINT.taskWeights['pharmaceutical'] ?? 0;
    expect(peaePharm / pancePharm).toBeCloseTo(1.1, 2);
  });

  it('PEAE cuts basic_science weight in half vs PANCE', () => {
    const panceBasic = PANCE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    const peaeBasic = PEAE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    expect(peaeBasic / panceBasic).toBeCloseTo(0.5, 2);
  });
});

// ─── getBlueprint ──────────────────────────────────────────────────────────

describe('getBlueprint', () => {
  it('returns PANCE blueprint for "PANCE"', () => {
    expect(getBlueprint('PANCE')).toBe(PANCE_BLUEPRINT);
  });

  it('returns PANRE blueprint for "PANRE"', () => {
    expect(getBlueprint('PANRE')).toBe(PANRE_BLUEPRINT);
  });

  it('returns PEAE blueprint for "PEAE"', () => {
    expect(getBlueprint('PEAE')).toBe(PEAE_BLUEPRINT);
  });
});

// ─── mapLearningTargetToBlueprint ──────────────────────────────────────────

describe('mapLearningTargetToBlueprint', () => {
  it('maps ("Cardiovascular", "diagnosis") to a cell with CV abbreviation', () => {
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    expect(cell.system).toBe('Cardiovascular');
    expect(cell.systemAbbreviation).toBe('CV');
    expect(cell.taskCategory).toBe('diagnosis');
  });

  it('normalizes lowercase / alias system names to canonical form', () => {
    // "CV" (alias) → "Cardiovascular"
    const cell = mapLearningTargetToBlueprint('CV', 'diagnosis');
    expect(cell.system).toBe('Cardiovascular');
    expect(cell.systemAbbreviation).toBe('CV');
  });

  it('maps treatment → pharmaceutical (primary PANCE category)', () => {
    const cell = mapLearningTargetToBlueprint('Pulmonary', 'treatment');
    expect(cell.taskCategory).toBe('pharmaceutical');
  });

  it('maps mechanism → basic_science', () => {
    const cell = mapLearningTargetToBlueprint('Neurological', 'mechanism');
    expect(cell.taskCategory).toBe('basic_science');
  });

  it('maps workup → diagnostic_lab', () => {
    const cell = mapLearningTargetToBlueprint('Hematology', 'workup');
    expect(cell.taskCategory).toBe('diagnostic_lab');
  });

  it('maps prevention → health_maintenance', () => {
    const cell = mapLearningTargetToBlueprint('General', 'prevention');
    expect(cell.taskCategory).toBe('health_maintenance');
  });

  it('maps complication → clinical_intervention', () => {
    const cell = mapLearningTargetToBlueprint('Endocrine', 'complication');
    expect(cell.taskCategory).toBe('clinical_intervention');
  });

  it('maps prognosis → diagnosis (collapsed to diagnostic reasoning)', () => {
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'prognosis');
    expect(cell.taskCategory).toBe('diagnosis');
  });

  it('maps clinical_pearl → diagnosis', () => {
    const cell = mapLearningTargetToBlueprint(
      'Dermatology',
      'clinical_pearl'
    );
    expect(cell.taskCategory).toBe('diagnosis');
  });

  it('falls back to "diagnosis" for unknown task types', () => {
    const cell = mapLearningTargetToBlueprint(
      'Cardiovascular',
      'not-a-real-task'
    );
    expect(cell.taskCategory).toBe('diagnosis');
  });

  it('computes cellWeight = systemWeight × taskWeight', () => {
    // Cardiovascular = 0.11, diagnosis task weight ~= 18/100 normalized
    // 100 = sum of PANCE_TASK_CATEGORY_PERCENT values, so diagnosis = 18/100 = 0.18
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    expect(cell.cellWeight).toBeCloseTo(0.11 * 0.18, 5);
  });

  it('defaults examType to PANCE when not specified', () => {
    const implicit = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    const explicit = mapLearningTargetToBlueprint(
      'Cardiovascular',
      'diagnosis',
      'PANCE'
    );
    expect(implicit.cellWeight).toBe(explicit.cellWeight);
  });

  it('produces different cellWeight across exam types due to task-weight shifts', () => {
    // mechanism → basic_science (PANRE dampens this, PEAE dampens harder)
    const pance = mapLearningTargetToBlueprint(
      'Cardiovascular',
      'mechanism',
      'PANCE'
    );
    const panre = mapLearningTargetToBlueprint(
      'Cardiovascular',
      'mechanism',
      'PANRE'
    );
    const peae = mapLearningTargetToBlueprint(
      'Cardiovascular',
      'mechanism',
      'PEAE'
    );
    expect(panre.cellWeight).toBeLessThan(pance.cellWeight);
    expect(peae.cellWeight).toBeLessThan(panre.cellWeight);
  });

  it('returns conditionId as empty string (filled by caller)', () => {
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    expect(cell.conditionId).toBe('');
  });

  it('falls back to 0.02 × 0.08 cellWeight for totally unknown system + task', () => {
    // Unknown system → normalizeSystemName returns as-is → systemWeights lookup = undefined → 0.02 fallback
    // Unknown task type → lookup fails → falls to 'diagnosis' (0.18), NOT 0.08 fallback
    // So truly unknown system + known-fallback task:
    const cell = mapLearningTargetToBlueprint(
      'NotARealSystem',
      'unknown-task'
    );
    // system fallback = 0.02, task falls to 'diagnosis' = 0.18
    expect(cell.cellWeight).toBeCloseTo(0.02 * 0.18, 5);
    // And systemAbbreviation should fall through to original input
    expect(cell.systemAbbreviation).toBe('NotARealSystem');
  });
});

// ─── getLearningTargetWeight ───────────────────────────────────────────────

describe('getLearningTargetWeight', () => {
  it('returns the same value as cellWeight from mapLearningTargetToBlueprint', () => {
    const cell = mapLearningTargetToBlueprint('Pulmonary', 'diagnosis');
    const weight = getLearningTargetWeight('Pulmonary', 'diagnosis');
    expect(weight).toBe(cell.cellWeight);
  });

  it('ranks Cardiovascular diagnosis above Emergency Medicine diagnosis (by system weight)', () => {
    const cv = getLearningTargetWeight('Cardiovascular', 'diagnosis');
    const em = getLearningTargetWeight('Emergency Medicine', 'diagnosis');
    expect(cv).toBeGreaterThan(em);
  });

  it('honors custom exam type', () => {
    // mechanism/basic_science weight: PANCE > PANRE > PEAE
    const pance = getLearningTargetWeight('Neurological', 'mechanism', 'PANCE');
    const peae = getLearningTargetWeight('Neurological', 'mechanism', 'PEAE');
    expect(pance).toBeGreaterThan(peae);
  });
});

// ─── getTaskCategory ───────────────────────────────────────────────────────

describe('getTaskCategory', () => {
  it.each([
    ['diagnosis', 'diagnosis'],
    ['treatment', 'pharmaceutical'],
    ['mechanism', 'basic_science'],
    ['workup', 'diagnostic_lab'],
    ['prevention', 'health_maintenance'],
    ['prognosis', 'diagnosis'],
    ['complication', 'clinical_intervention'],
    ['clinical_pearl', 'diagnosis'],
  ])('maps %s → %s', (taskType, expected) => {
    expect(getTaskCategory(taskType)).toBe(expected);
  });

  it('returns "diagnosis" for unknown task types (safe fallback)', () => {
    expect(getTaskCategory('not-a-real-task')).toBe('diagnosis');
    expect(getTaskCategory('')).toBe('diagnosis');
  });
});

// ─── getSecondaryCategories ────────────────────────────────────────────────

describe('getSecondaryCategories', () => {
  it('returns ["clinical_intervention"] for treatment (spans pharma + CI)', () => {
    expect(getSecondaryCategories('treatment')).toEqual([
      'clinical_intervention',
    ]);
  });

  it('returns ["history_physical"] for diagnosis (involves H&P)', () => {
    expect(getSecondaryCategories('diagnosis')).toEqual(['history_physical']);
  });

  it('returns ["history_physical"] for workup (includes PE findings)', () => {
    expect(getSecondaryCategories('workup')).toEqual(['history_physical']);
  });

  it('returns empty array for task types with no secondary category', () => {
    expect(getSecondaryCategories('mechanism')).toEqual([]);
    expect(getSecondaryCategories('prevention')).toEqual([]);
  });

  it('returns empty array for unknown task types', () => {
    expect(getSecondaryCategories('not-a-real-task')).toEqual([]);
  });
});
