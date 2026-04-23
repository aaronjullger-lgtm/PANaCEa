// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/illnessScriptService.ts — pure deterministic functions
 *
 * Functions tested:
 *   splitClinicalList(text)              — numbered / bullet / semicolon / comma / newline / single
 *   classifyRiskFactor(factor)           — keyword regex → category
 *   classifyDiagnosticStrength(positiveLR) — LR+ threshold classification
 *   assessCompleteness(script)           — filledSections/6, gaps array
 *
 * classifyDiagnosticStrength thresholds:
 *   null/undefined → 'unknown'
 *   LR+ >= 10  → 'pathognomonic'
 *   LR+ >= 5   → 'strong'
 *   LR+ >= 2   → 'moderate'
 *   LR+ < 2    → 'weak'
 *
 * assessCompleteness sections (6 total):
 *   enablingConditions.length > 0      (+1)
 *   fault.narrative.length > 0         (+1)
 *   consequences.length > 0            (+1, extra gaps if no symptoms/signs)
 *   diagnostics has goldStandard OR bestInitialTest OR workupSteps (+1)
 *   treatment.firstLine OR principles  (+1)
 *   differential.mustNotMiss OR buzzwords (+1)
 */

import { describe, it, expect } from 'vitest';
import {
  splitClinicalList,
  classifyRiskFactor,
  classifyDiagnosticStrength,
  assessCompleteness,
} from './illnessScriptService';
import type {
  EnablingCondition,
  FaultMechanism,
  ClinicalConsequence,
  DiagnosticWorkup,
  TreatmentSummary,
  DifferentialContext,
  IllnessScript,
} from './illnessScriptService';

// ─── Helpers for assessCompleteness ──────────────────────────────────────────

type ScriptInput = Omit<IllnessScript, 'completeness' | 'gaps'>;

const EMPTY_FAULT: FaultMechanism = { narrative: '', mechanismSteps: [], etiology: null, evidenceGrade: null };
const FILLED_FAULT: FaultMechanism = { narrative: 'Inflammation of the pericardium', mechanismSteps: ['Step 1', 'Step 2'], etiology: 'viral', evidenceGrade: 'B' };

const EMPTY_DIAGNOSTICS: DiagnosticWorkup = { goldStandard: null, bestInitialTest: null, workupSteps: [] };
const FILLED_DIAGNOSTICS: DiagnosticWorkup = { goldStandard: 'Echo', bestInitialTest: 'ECG', workupSteps: ['ECG first'] };

const EMPTY_TREATMENT: TreatmentSummary = { firstLine: null, principles: [], keyInterventions: [] };
const FILLED_TREATMENT: TreatmentSummary = { firstLine: 'NSAIDs', principles: ['Rest'], keyInterventions: ['Ibuprofen'] };

const EMPTY_DIFFERENTIAL: DifferentialContext = { mustNotMiss: [], distinguishingFeatures: [], classicPatient: null, buzzwords: [] };
const FILLED_DIFFERENTIAL: DifferentialContext = { mustNotMiss: ['MI', 'PE'], distinguishingFeatures: ['pleuritic pain'], classicPatient: null, buzzwords: ['friction rub'] };

const ENABLING_CONDITION: EnablingCondition = { factor: 'Viral infection', category: 'other', weight: 0.5, isHighYield: true };

const SYMPTOM: ClinicalConsequence = { finding: 'Chest pain', type: 'symptom', diagnosticStrength: 'strong', isClassic: true, isHighYield: true };
const SIGN: ClinicalConsequence = { finding: 'Friction rub', type: 'sign', diagnosticStrength: 'pathognomonic', isClassic: true, isHighYield: true };

function makeScript(overrides: Partial<ScriptInput> = {}): ScriptInput {
  return {
    conditionId: 'pericarditis-1',
    conditionName: 'Acute Pericarditis',
    system: 'Cardiovascular',
    subcategory: 'Pericardial',
    enablingConditions: [],
    fault: EMPTY_FAULT,
    consequences: [],
    diagnostics: EMPTY_DIAGNOSTICS,
    treatment: EMPTY_TREATMENT,
    differential: EMPTY_DIFFERENTIAL,
    ...overrides,
  };
}

// ─── splitClinicalList ────────────────────────────────────────────────────────

describe('splitClinicalList', () => {
  it('returns [] for empty string', () => {
    expect(splitClinicalList('')).toEqual([]);
  });

  it('returns [] for whitespace-only string', () => {
    expect(splitClinicalList('   ')).toEqual([]);
  });

  it('splits numbered list (1. style)', () => {
    const result = splitClinicalList('1. Alpha\n2. Beta\n3. Gamma');
    expect(result).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('splits numbered list (1) style)', () => {
    const result = splitClinicalList('1) Alpha\n2) Beta');
    expect(result).toEqual(['Alpha', 'Beta']);
  });

  it('splits bullet list starting with "- "', () => {
    const result = splitClinicalList('- Alpha\n- Beta\n- Gamma');
    expect(result).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('splits bullet list starting with "• "', () => {
    const result = splitClinicalList('• Alpha\n• Beta');
    expect(result).toEqual(['Alpha', 'Beta']);
  });

  it('prefers numbered list over semicolon split', () => {
    // Contains both a number and semicolons — numbered wins
    const result = splitClinicalList('1. Alpha; extra\n2. Beta');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Alpha; extra');
  });

  it('splits by semicolon when no bullets or numbers', () => {
    const result = splitClinicalList('Alpha; Beta; Gamma');
    expect(result).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('splits by comma when text < 500 chars and items < 100 chars', () => {
    const result = splitClinicalList('Alpha, Beta, Gamma');
    expect(result).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('does NOT split by comma when any item is >= 100 chars', () => {
    const longItem = 'A'.repeat(100);
    const text = `Short item, ${longItem}`;
    const result = splitClinicalList(text);
    // Falls through comma split to newline (no newlines) → single item
    expect(result).toHaveLength(1);
  });

  it('splits by newline when no other delimiter applies', () => {
    const result = splitClinicalList('Alpha\nBeta\nGamma');
    expect(result).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('returns single-item array for plain text with no delimiter', () => {
    const result = splitClinicalList('Just one item');
    expect(result).toEqual(['Just one item']);
  });

  it('filters out empty strings after splitting', () => {
    const result = splitClinicalList('Alpha\n\nBeta\n');
    expect(result).not.toContain('');
  });
});

// ─── classifyRiskFactor ───────────────────────────────────────────────────────

describe('classifyRiskFactor', () => {
  it('classifies age-related factors as "demographic"', () => {
    expect(classifyRiskFactor('age > 65')).toBe('demographic');
    expect(classifyRiskFactor('elderly patients')).toBe('demographic');
    expect(classifyRiskFactor('postmenopausal women')).toBe('demographic');
    expect(classifyRiskFactor('male sex')).toBe('demographic');
  });

  it('classifies race/ethnicity as "demographic"', () => {
    expect(classifyRiskFactor('African American ancestry')).toBe('demographic');
    expect(classifyRiskFactor('Hispanic ethnicity')).toBe('demographic');
  });

  it('classifies behavioral factors', () => {
    expect(classifyRiskFactor('smoking history')).toBe('behavioral');
    expect(classifyRiskFactor('alcohol use disorder')).toBe('behavioral');
    expect(classifyRiskFactor('obesity (BMI > 30)')).toBe('behavioral');
    expect(classifyRiskFactor('sedentary lifestyle')).toBe('behavioral');
  });

  it('classifies genetic factors', () => {
    expect(classifyRiskFactor('family history of colon cancer')).toBe('genetic');
    expect(classifyRiskFactor('BRCA gene mutation')).toBe('genetic');
    expect(classifyRiskFactor('hereditary condition')).toBe('genetic');
  });

  it('classifies environmental factors', () => {
    expect(classifyRiskFactor('asbestos exposure')).toBe('environmental');
    expect(classifyRiskFactor('occupational chemical exposure')).toBe('environmental');
    expect(classifyRiskFactor('radiation exposure')).toBe('environmental');
  });

  it('classifies comorbid conditions', () => {
    expect(classifyRiskFactor('diabetes mellitus')).toBe('comorbid');
    expect(classifyRiskFactor('hypertension (HTN)')).toBe('comorbid');
    expect(classifyRiskFactor('HIV infection')).toBe('comorbid');
    expect(classifyRiskFactor('immunocompromised state')).toBe('comorbid');
  });

  it('returns "other" for unrecognized factors', () => {
    expect(classifyRiskFactor('prior surgery')).toBe('other');
    expect(classifyRiskFactor('unknown factor')).toBe('other');
    expect(classifyRiskFactor('')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(classifyRiskFactor('SMOKING')).toBe('behavioral');
    expect(classifyRiskFactor('AGE > 40')).toBe('demographic');
    expect(classifyRiskFactor('DIABETES')).toBe('comorbid');
  });
});

// ─── classifyDiagnosticStrength ───────────────────────────────────────────────

describe('classifyDiagnosticStrength', () => {
  it('returns "unknown" for null', () => {
    expect(classifyDiagnosticStrength(null)).toBe('unknown');
  });

  it('returns "unknown" for undefined', () => {
    expect(classifyDiagnosticStrength(undefined)).toBe('unknown');
  });

  it('returns "pathognomonic" for LR+ >= 10', () => {
    expect(classifyDiagnosticStrength(10)).toBe('pathognomonic');
    expect(classifyDiagnosticStrength(25)).toBe('pathognomonic');
    expect(classifyDiagnosticStrength(100)).toBe('pathognomonic');
  });

  it('returns "strong" for 5 <= LR+ < 10', () => {
    expect(classifyDiagnosticStrength(5)).toBe('strong');
    expect(classifyDiagnosticStrength(7.5)).toBe('strong');
    expect(classifyDiagnosticStrength(9.9)).toBe('strong');
  });

  it('returns "moderate" for 2 <= LR+ < 5', () => {
    expect(classifyDiagnosticStrength(2)).toBe('moderate');
    expect(classifyDiagnosticStrength(3)).toBe('moderate');
    expect(classifyDiagnosticStrength(4.9)).toBe('moderate');
  });

  it('returns "weak" for LR+ < 2', () => {
    expect(classifyDiagnosticStrength(1)).toBe('weak');
    expect(classifyDiagnosticStrength(1.9)).toBe('weak');
    expect(classifyDiagnosticStrength(0)).toBe('weak');
    expect(classifyDiagnosticStrength(0.5)).toBe('weak');
  });

  it('boundary: exactly 10 → pathognomonic, exactly 5 → strong, exactly 2 → moderate', () => {
    expect(classifyDiagnosticStrength(10)).toBe('pathognomonic');
    expect(classifyDiagnosticStrength(5)).toBe('strong');
    expect(classifyDiagnosticStrength(2)).toBe('moderate');
  });
});

// ─── assessCompleteness ───────────────────────────────────────────────────────

describe('assessCompleteness', () => {
  // ── Completely empty script ──

  it('returns completeness=0 and 6+ gaps for fully empty script', () => {
    const { completeness, gaps } = assessCompleteness(makeScript());
    expect(completeness).toBe(0);
    // 6 critical gaps (one per section)
    expect(gaps.length).toBeGreaterThanOrEqual(6);
  });

  // ── Section-by-section ──

  it('completeness increases when enablingConditions are present', () => {
    const { completeness } = assessCompleteness(makeScript({ enablingConditions: [ENABLING_CONDITION] }));
    expect(completeness).toBeGreaterThan(0);
  });

  it('no "enabling" gap when enablingConditions.length > 0', () => {
    const { gaps } = assessCompleteness(makeScript({ enablingConditions: [ENABLING_CONDITION] }));
    expect(gaps.some(g => g.section === 'enabling')).toBe(false);
  });

  it('includes "fault" gap when fault.narrative is empty', () => {
    const { gaps } = assessCompleteness(makeScript());
    expect(gaps.some(g => g.section === 'fault')).toBe(true);
  });

  it('no "fault" gap when fault.narrative is non-empty', () => {
    const { gaps } = assessCompleteness(makeScript({ fault: FILLED_FAULT }));
    expect(gaps.some(g => g.section === 'fault')).toBe(false);
  });

  it('adds moderate gap for missing symptoms when consequences present but no symptom type', () => {
    // Has consequences but all are 'sign' type — no symptoms
    const { gaps } = assessCompleteness(makeScript({ consequences: [SIGN] }));
    const sympGap = gaps.find(g => g.section === 'consequences' && g.description.includes('symptom'));
    expect(sympGap).toBeDefined();
    expect(sympGap!.severity).toBe('moderate');
  });

  it('adds moderate gap for missing signs when consequences present but no sign type', () => {
    const { gaps } = assessCompleteness(makeScript({ consequences: [SYMPTOM] }));
    const signGap = gaps.find(g => g.section === 'consequences' && g.description.includes('sign'));
    expect(signGap).toBeDefined();
  });

  it('no extra consequences gaps when both symptom and sign are present', () => {
    const { gaps } = assessCompleteness(makeScript({ consequences: [SYMPTOM, SIGN] }));
    const consGaps = gaps.filter(g => g.section === 'consequences');
    expect(consGaps).toHaveLength(0);
  });

  it('diagnostics section filled by goldStandard alone', () => {
    const dx: DiagnosticWorkup = { goldStandard: 'Biopsy', bestInitialTest: null, workupSteps: [] };
    const { gaps } = assessCompleteness(makeScript({ diagnostics: dx }));
    expect(gaps.some(g => g.section === 'diagnostics')).toBe(false);
  });

  it('diagnostics section filled by workupSteps alone', () => {
    const dx: DiagnosticWorkup = { goldStandard: null, bestInitialTest: null, workupSteps: ['CBC'] };
    const { gaps } = assessCompleteness(makeScript({ diagnostics: dx }));
    expect(gaps.some(g => g.section === 'diagnostics')).toBe(false);
  });

  it('treatment section filled by firstLine', () => {
    const tx: TreatmentSummary = { firstLine: 'NSAIDs', principles: [], keyInterventions: [] };
    const { gaps } = assessCompleteness(makeScript({ treatment: tx }));
    expect(gaps.some(g => g.section === 'treatment')).toBe(false);
  });

  it('treatment section filled by principles alone (no firstLine)', () => {
    const tx: TreatmentSummary = { firstLine: null, principles: ['Rest and analgesia'], keyInterventions: [] };
    const { gaps } = assessCompleteness(makeScript({ treatment: tx }));
    expect(gaps.some(g => g.section === 'treatment')).toBe(false);
  });

  it('differential section filled by mustNotMiss', () => {
    const diff: DifferentialContext = { mustNotMiss: ['MI'], distinguishingFeatures: [], classicPatient: null, buzzwords: [] };
    const { gaps } = assessCompleteness(makeScript({ differential: diff }));
    expect(gaps.some(g => g.section === 'differential')).toBe(false);
  });

  it('differential section filled by buzzwords alone', () => {
    const diff: DifferentialContext = { mustNotMiss: [], distinguishingFeatures: [], classicPatient: null, buzzwords: ['friction rub'] };
    const { gaps } = assessCompleteness(makeScript({ differential: diff }));
    expect(gaps.some(g => g.section === 'differential')).toBe(false);
  });

  // ── Completeness score ──

  it('completeness=1 for a fully populated script with symptoms and signs', () => {
    const { completeness } = assessCompleteness(makeScript({
      enablingConditions: [ENABLING_CONDITION],
      fault: FILLED_FAULT,
      consequences: [SYMPTOM, SIGN],
      diagnostics: FILLED_DIAGNOSTICS,
      treatment: FILLED_TREATMENT,
      differential: FILLED_DIFFERENTIAL,
    }));
    expect(completeness).toBe(1);
  });

  it('completeness is a number in [0, 1]', () => {
    const cases = [
      makeScript(),
      makeScript({ enablingConditions: [ENABLING_CONDITION] }),
      makeScript({ enablingConditions: [ENABLING_CONDITION], fault: FILLED_FAULT }),
    ];
    for (const s of cases) {
      const { completeness } = assessCompleteness(s);
      expect(completeness).toBeGreaterThanOrEqual(0);
      expect(completeness).toBeLessThanOrEqual(1);
    }
  });

  it('completeness = filledSections / 6', () => {
    // 3 sections filled: enablingConditions, fault, treatment
    const { completeness } = assessCompleteness(makeScript({
      enablingConditions: [ENABLING_CONDITION],
      fault: FILLED_FAULT,
      treatment: FILLED_TREATMENT,
    }));
    expect(completeness).toBeCloseTo(3 / 6, 5);
  });

  // ── Gap severity ──

  it('fault gap has "critical" severity', () => {
    const { gaps } = assessCompleteness(makeScript());
    const faultGap = gaps.find(g => g.section === 'fault');
    expect(faultGap?.severity).toBe('critical');
  });

  it('differential gap has "minor" severity', () => {
    const { gaps } = assessCompleteness(makeScript());
    const diffGap = gaps.find(g => g.section === 'differential');
    expect(diffGap?.severity).toBe('minor');
  });
});
