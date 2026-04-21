/**
 * Unit tests for lib/services/blueprintMappingService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   getBlueprint(examType)
 *   mapLearningTargetToBlueprint(conditionSystem, taskType, examType?)
 *   getLearningTargetWeight(conditionSystem, taskType, examType?)
 *   getTaskCategory(taskType)
 *   getSecondaryCategories(taskType)
 *   PANCE_BLUEPRINT, PANRE_BLUEPRINT, PEAE_BLUEPRINT (constants)
 *
 * Internal task type → PANCE category mapping:
 *   diagnosis   → 'diagnosis'
 *   treatment   → 'pharmaceutical'
 *   mechanism   → 'basic_science'
 *   workup      → 'diagnostic_lab'
 *   prevention  → 'health_maintenance'
 *   prognosis   → 'diagnosis'
 *   complication → 'clinical_intervention'
 *   clinical_pearl → 'diagnosis'
 *   unknown     → 'diagnosis' (default)
 *
 * Secondary categories:
 *   treatment   → ['clinical_intervention']
 *   diagnosis   → ['history_physical']
 *   workup      → ['history_physical']
 *   others      → []
 */

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
  type ExamBlueprint,
} from './blueprintMappingService';

// ─── Blueprint constants ───────────────────────────────────────────────────────

describe('blueprint constants', () => {
  it('PANCE_BLUEPRINT.examType = PANCE', () => {
    expect(PANCE_BLUEPRINT.examType).toBe('PANCE');
  });

  it('PANRE_BLUEPRINT.examType = PANRE', () => {
    expect(PANRE_BLUEPRINT.examType).toBe('PANRE');
  });

  it('PEAE_BLUEPRINT.examType = PEAE', () => {
    expect(PEAE_BLUEPRINT.examType).toBe('PEAE');
  });

  it('PANCE has 300 total questions', () => {
    expect(PANCE_BLUEPRINT.totalQuestions).toBe(300);
  });

  it('PANRE has 240 total questions', () => {
    expect(PANRE_BLUEPRINT.totalQuestions).toBe(240);
  });

  it('PEAE has 300 total questions', () => {
    expect(PEAE_BLUEPRINT.totalQuestions).toBe(300);
  });

  it('all blueprints have positive systemWeights for Cardiovascular', () => {
    for (const bp of [PANCE_BLUEPRINT, PANRE_BLUEPRINT, PEAE_BLUEPRINT]) {
      // NCCPA_2025_BLUEPRINT contains Cardiovascular
      const hasCV = Object.keys(bp.systemWeights).some(k =>
        k.toLowerCase().includes('cardiovascular')
      );
      expect(hasCV).toBe(true);
    }
  });

  it('PANRE basic_science weight is lower than PANCE', () => {
    const panceBasic = PANCE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    const panreBasic = PANRE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    expect(panreBasic).toBeLessThan(panceBasic);
  });

  it('PANRE clinical_intervention weight is higher than PANCE', () => {
    const panceCI = PANCE_BLUEPRINT.taskWeights['clinical_intervention'] ?? 0;
    const panreCI = PANRE_BLUEPRINT.taskWeights['clinical_intervention'] ?? 0;
    expect(panreCI).toBeGreaterThan(panceCI);
  });

  it('PEAE basic_science weight is lower than PANCE', () => {
    const panceBasic = PANCE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    const peaeBasic = PEAE_BLUEPRINT.taskWeights['basic_science'] ?? 0;
    expect(peaeBasic).toBeLessThan(panceBasic);
  });

  it('PEAE diagnosis weight is higher than PANCE', () => {
    const panceDx = PANCE_BLUEPRINT.taskWeights['diagnosis'] ?? 0;
    const peaeDx = PEAE_BLUEPRINT.taskWeights['diagnosis'] ?? 0;
    expect(peaeDx).toBeGreaterThan(panceDx);
  });
});

// ─── getBlueprint ─────────────────────────────────────────────────────────────

describe('getBlueprint', () => {
  it('returns PANCE_BLUEPRINT for PANCE', () => {
    expect(getBlueprint('PANCE')).toBe(PANCE_BLUEPRINT);
  });

  it('returns PANRE_BLUEPRINT for PANRE', () => {
    expect(getBlueprint('PANRE')).toBe(PANRE_BLUEPRINT);
  });

  it('returns PEAE_BLUEPRINT for PEAE', () => {
    expect(getBlueprint('PEAE')).toBe(PEAE_BLUEPRINT);
  });

  it('returned blueprint has systemWeights, taskWeights, totalQuestions', () => {
    const bp: ExamBlueprint = getBlueprint('PANCE');
    expect(bp.systemWeights).toBeDefined();
    expect(bp.taskWeights).toBeDefined();
    expect(bp.totalQuestions).toBeGreaterThan(0);
  });
});

// ─── getTaskCategory ──────────────────────────────────────────────────────────

describe('getTaskCategory', () => {
  it('diagnosis → diagnosis', () => {
    expect(getTaskCategory('diagnosis')).toBe('diagnosis');
  });

  it('treatment → pharmaceutical', () => {
    expect(getTaskCategory('treatment')).toBe('pharmaceutical');
  });

  it('mechanism → basic_science', () => {
    expect(getTaskCategory('mechanism')).toBe('basic_science');
  });

  it('workup → diagnostic_lab', () => {
    expect(getTaskCategory('workup')).toBe('diagnostic_lab');
  });

  it('prevention → health_maintenance', () => {
    expect(getTaskCategory('prevention')).toBe('health_maintenance');
  });

  it('prognosis → diagnosis', () => {
    expect(getTaskCategory('prognosis')).toBe('diagnosis');
  });

  it('complication → clinical_intervention', () => {
    expect(getTaskCategory('complication')).toBe('clinical_intervention');
  });

  it('clinical_pearl → diagnosis', () => {
    expect(getTaskCategory('clinical_pearl')).toBe('diagnosis');
  });

  it('unknown task type → diagnosis (default)', () => {
    expect(getTaskCategory('unknown_task')).toBe('diagnosis');
    expect(getTaskCategory('')).toBe('diagnosis');
  });
});

// ─── getSecondaryCategories ───────────────────────────────────────────────────

describe('getSecondaryCategories', () => {
  it('treatment → [clinical_intervention]', () => {
    expect(getSecondaryCategories('treatment')).toEqual(['clinical_intervention']);
  });

  it('diagnosis → [history_physical]', () => {
    expect(getSecondaryCategories('diagnosis')).toEqual(['history_physical']);
  });

  it('workup → [history_physical]', () => {
    expect(getSecondaryCategories('workup')).toEqual(['history_physical']);
  });

  it('mechanism → [] (no secondary categories)', () => {
    expect(getSecondaryCategories('mechanism')).toEqual([]);
  });

  it('unknown task → [] (default empty)', () => {
    expect(getSecondaryCategories('xyz')).toEqual([]);
  });
});

// ─── mapLearningTargetToBlueprint ─────────────────────────────────────────────

describe('mapLearningTargetToBlueprint', () => {
  it('returns a BlueprintCell with expected fields', () => {
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    expect(cell).toHaveProperty('system');
    expect(cell).toHaveProperty('systemAbbreviation');
    expect(cell).toHaveProperty('taskCategory');
    expect(cell).toHaveProperty('cellWeight');
    expect(cell).toHaveProperty('conditionId');
  });

  it('taskCategory matches getTaskCategory output', () => {
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'treatment');
    expect(cell.taskCategory).toBe(getTaskCategory('treatment'));
  });

  it('cellWeight = systemWeight × taskWeight (positive)', () => {
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    expect(cell.cellWeight).toBeGreaterThan(0);
  });

  it('conditionId is empty string (filled by caller)', () => {
    const cell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    expect(cell.conditionId).toBe('');
  });

  it('defaults to PANCE exam type', () => {
    const defaultCell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    const explicitCell = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis', 'PANCE');
    expect(defaultCell.cellWeight).toBeCloseTo(explicitCell.cellWeight, 10);
  });

  it('different exam types produce different cell weights', () => {
    const panceCell = mapLearningTargetToBlueprint('Cardiovascular', 'mechanism', 'PANCE');
    const panreCell = mapLearningTargetToBlueprint('Cardiovascular', 'mechanism', 'PANRE');
    // PANRE basic_science weight is different from PANCE
    expect(panceCell.cellWeight).not.toBeCloseTo(panreCell.cellWeight, 5);
  });

  it('unknown system falls back to default weight (0.02)', () => {
    const cell = mapLearningTargetToBlueprint('NonexistentSystem', 'diagnosis');
    // 0.02 * taskWeight (non-zero)
    expect(cell.cellWeight).toBeGreaterThan(0);
    expect(cell.cellWeight).toBeLessThan(0.1); // bounded by fallback
  });

  it('system names are normalized (Cardiology → Cardiovascular)', () => {
    const cardiology = mapLearningTargetToBlueprint('Cardiology', 'diagnosis');
    const cardiovascular = mapLearningTargetToBlueprint('Cardiovascular', 'diagnosis');
    // Both should resolve to the same system and cell weight
    expect(cardiology.system).toBe(cardiovascular.system);
    expect(cardiology.cellWeight).toBeCloseTo(cardiovascular.cellWeight, 10);
  });
});

// ─── getLearningTargetWeight ──────────────────────────────────────────────────

describe('getLearningTargetWeight', () => {
  it('returns a positive number', () => {
    const weight = getLearningTargetWeight('Cardiovascular', 'diagnosis');
    expect(weight).toBeGreaterThan(0);
  });

  it('matches mapLearningTargetToBlueprint cellWeight', () => {
    const cell = mapLearningTargetToBlueprint('Pulmonary', 'workup');
    const weight = getLearningTargetWeight('Pulmonary', 'workup');
    expect(weight).toBeCloseTo(cell.cellWeight, 10);
  });

  it('higher-weight systems produce higher weights for same task', () => {
    // Cardiovascular (11%) vs GI (~7%) — CV should be higher
    const cvWeight = getLearningTargetWeight('Cardiovascular', 'diagnosis');
    const giWeight = getLearningTargetWeight('GI', 'diagnosis');
    expect(cvWeight).toBeGreaterThan(giWeight);
  });

  it('same system: different tasks produce different weights', () => {
    const diagWeight = getLearningTargetWeight('Cardiovascular', 'diagnosis');
    const mechWeight = getLearningTargetWeight('Cardiovascular', 'mechanism');
    // diagnosis and basic_science have different PANCE weights → different cell weights
    expect(diagWeight).not.toBeCloseTo(mechWeight, 5);
  });
});
