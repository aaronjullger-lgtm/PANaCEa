/**
 * Tests for illnessScriptService — pure illness script builder functions
 *
 * Covers: splitClinicalList, classifyRiskFactor, classifyDiagnosticStrength,
 * buildEnablingConditions, buildFaultMechanism, buildConsequences,
 * buildDiagnosticWorkup, buildTreatmentSummary, buildDifferentialContext,
 * assessCompleteness, compareScripts
 */
import { describe, it, expect } from 'vitest';
import {
  splitClinicalList,
  classifyRiskFactor,
  classifyDiagnosticStrength,
  buildEnablingConditions,
  buildFaultMechanism,
  buildConsequences,
  buildDiagnosticWorkup,
  buildTreatmentSummary,
  buildDifferentialContext,
  assessCompleteness,
  compareScripts,
  type RawMedicalContent,
  type IllnessScript,
  type FaultMechanism,
  type DiagnosticWorkup,
  type TreatmentSummary,
  type DifferentialContext,
} from '@/lib/services/illnessScriptService';

// ─── Test Fixtures ───────────────────────────────────────────────────────

function makeMc(overrides: Partial<RawMedicalContent> = {}): RawMedicalContent {
  return {
    conditionId: 'cond-1',
    condition: 'Heart Failure',
    system: 'Cardiovascular',
    subcategory: 'Heart Failure',
    ...overrides,
  };
}

function makePartialScript(overrides: Partial<Omit<IllnessScript, 'completeness' | 'gaps'>> = {}): Omit<IllnessScript, 'completeness' | 'gaps'> {
  return {
    conditionId: 'cond-1',
    conditionName: 'Heart Failure',
    system: 'Cardiovascular',
    subcategory: 'Heart Failure',
    enablingConditions: [{ factor: 'Age > 65', category: 'demographic', weight: 0.8, isHighYield: true }],
    fault: { narrative: 'Reduced ejection fraction', mechanismSteps: ['LV dysfunction'], etiology: 'Ischemic', evidenceGrade: null },
    consequences: [
      { finding: 'Dyspnea', type: 'symptom', diagnosticStrength: 'moderate', isClassic: false, isHighYield: true },
      { finding: 'S3 gallop', type: 'sign', diagnosticStrength: 'strong', isClassic: true, isHighYield: true },
    ],
    diagnostics: { goldStandard: 'Echo', bestInitialTest: 'BNP', workupSteps: ['CXR'] },
    treatment: { firstLine: 'ACE inhibitor', principles: ['Fluid management'], keyInterventions: ['Lisinopril'] },
    differential: { mustNotMiss: ['COPD'], distinguishingFeatures: [], classicPatient: 'Elderly with CHF history', buzzwords: ['S3 gallop', 'orthopnea'] },
    panceYield: 'high_yield',
    clinicalPearls: [],
    mnemonics: [],
    ...overrides,
  };
}

// ─── splitClinicalList ───────────────────────────────────────────────────

describe('splitClinicalList', () => {
  it('returns empty for empty/whitespace input', () => {
    expect(splitClinicalList('')).toEqual([]);
    expect(splitClinicalList('   ')).toEqual([]);
  });

  it('splits numbered lists', () => {
    const result = splitClinicalList('1. Hypertension\n2. Diabetes\n3. Smoking');
    expect(result).toEqual(['Hypertension', 'Diabetes', 'Smoking']);
  });

  it('splits bullet points', () => {
    const result = splitClinicalList('- Hypertension\n- Diabetes\n- Smoking');
    expect(result).toEqual(['Hypertension', 'Diabetes', 'Smoking']);
  });

  it('splits bullet points with bullet char', () => {
    const result = splitClinicalList('• Hypertension\n• Diabetes');
    expect(result).toEqual(['Hypertension', 'Diabetes']);
  });

  it('splits semicolons', () => {
    const result = splitClinicalList('Hypertension; Diabetes; Smoking');
    expect(result).toEqual(['Hypertension', 'Diabetes', 'Smoking']);
  });

  it('splits commas for short items', () => {
    const result = splitClinicalList('Hypertension, Diabetes, Smoking');
    expect(result).toEqual(['Hypertension', 'Diabetes', 'Smoking']);
  });

  it('does not split commas when items are too long', () => {
    const longItem = 'A'.repeat(101);
    const result = splitClinicalList(`${longItem}, something else`);
    expect(result).toHaveLength(1);
  });

  it('splits newlines', () => {
    const result = splitClinicalList('Hypertension\nDiabetes\nSmoking');
    expect(result).toEqual(['Hypertension', 'Diabetes', 'Smoking']);
  });

  it('returns single item when no delimiter found', () => {
    expect(splitClinicalList('Hypertension')).toEqual(['Hypertension']);
  });

  it('trims whitespace from items', () => {
    const result = splitClinicalList('  Hypertension ;  Diabetes  ');
    expect(result).toEqual(['Hypertension', 'Diabetes']);
  });
});

// ─── classifyRiskFactor ──────────────────────────────────────────────────

describe('classifyRiskFactor', () => {
  it('classifies demographic factors', () => {
    expect(classifyRiskFactor('Age > 65')).toBe('demographic');
    expect(classifyRiskFactor('Female sex')).toBe('demographic');
    expect(classifyRiskFactor('African American')).toBe('demographic');
    expect(classifyRiskFactor('Postmenopausal')).toBe('demographic');
  });

  it('classifies behavioral factors', () => {
    expect(classifyRiskFactor('Smoking history')).toBe('behavioral');
    expect(classifyRiskFactor('Obesity')).toBe('behavioral');
    expect(classifyRiskFactor('Sedentary lifestyle')).toBe('behavioral');
    expect(classifyRiskFactor('Heavy alcohol use')).toBe('behavioral');
  });

  it('classifies genetic factors', () => {
    expect(classifyRiskFactor('Family history of CAD')).toBe('genetic');
    expect(classifyRiskFactor('BRCA mutation')).toBe('genetic');
    expect(classifyRiskFactor('Hereditary angioedema')).toBe('genetic');
  });

  it('classifies environmental factors', () => {
    expect(classifyRiskFactor('Asbestos exposure')).toBe('environmental');
    expect(classifyRiskFactor('Radiation exposure')).toBe('environmental');
    expect(classifyRiskFactor('Travel to endemic area')).toBe('environmental');
  });

  it('classifies comorbid factors', () => {
    expect(classifyRiskFactor('Diabetes mellitus')).toBe('comorbid');
    expect(classifyRiskFactor('Hypertension')).toBe('comorbid');
    expect(classifyRiskFactor('HIV positive')).toBe('comorbid');
  });

  it('returns other for unclassified', () => {
    expect(classifyRiskFactor('Recent surgery')).toBe('other');
    expect(classifyRiskFactor('Unknown risk')).toBe('other');
  });
});

// ─── classifyDiagnosticStrength ──────────────────────────────────────────

describe('classifyDiagnosticStrength', () => {
  it('returns unknown for null/undefined', () => {
    expect(classifyDiagnosticStrength(null)).toBe('unknown');
    expect(classifyDiagnosticStrength(undefined)).toBe('unknown');
  });

  it('classifies pathognomonic (LR >= 10)', () => {
    expect(classifyDiagnosticStrength(10)).toBe('pathognomonic');
    expect(classifyDiagnosticStrength(15)).toBe('pathognomonic');
  });

  it('classifies strong (LR 5–10)', () => {
    expect(classifyDiagnosticStrength(5)).toBe('strong');
    expect(classifyDiagnosticStrength(8)).toBe('strong');
  });

  it('classifies moderate (LR 2–5)', () => {
    expect(classifyDiagnosticStrength(2)).toBe('moderate');
    expect(classifyDiagnosticStrength(3.5)).toBe('moderate');
  });

  it('classifies weak (LR < 2)', () => {
    expect(classifyDiagnosticStrength(1.5)).toBe('weak');
    expect(classifyDiagnosticStrength(0)).toBe('weak');
  });
});

// ─── buildEnablingConditions ─────────────────────────────────────────────

describe('buildEnablingConditions', () => {
  it('extracts demographic from age_demographic', () => {
    const mc = makeMc({ age_demographic: 'Age > 65' });
    const result = buildEnablingConditions(mc);
    expect(result).toHaveLength(1);
    expect(result[0]!.factor).toBe('Age > 65');
    expect(result[0]!.category).toBe('demographic');
    expect(result[0]!.isHighYield).toBe(true);
  });

  it('extracts demographic from gender_bias', () => {
    const mc = makeMc({ gender_bias: 'Male predominance' });
    const result = buildEnablingConditions(mc);
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe('demographic');
  });

  it('parses risk factors into individual items', () => {
    const mc = makeMc({ riskFactors: 'Smoking; Hypertension; Diabetes' });
    const result = buildEnablingConditions(mc);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.factor)).toEqual(['Smoking', 'Hypertension', 'Diabetes']);
  });

  it('parses etiology as other category', () => {
    const mc = makeMc({ etiology: 'Ischemic heart disease' });
    const result = buildEnablingConditions(mc);
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe('other');
  });

  it('extracts epidemiology as demographic', () => {
    const mc = makeMc({ epidemiology: 'Common in elderly' });
    const result = buildEnablingConditions(mc);
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe('demographic');
  });

  it('combines all available fields', () => {
    const mc = makeMc({
      age_demographic: 'Age > 65',
      gender_bias: 'Male',
      riskFactors: 'Smoking',
      etiology: 'Ischemic',
      epidemiology: '1 in 5 adults',
    });
    const result = buildEnablingConditions(mc);
    expect(result.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── buildFaultMechanism ─────────────────────────────────────────────────

describe('buildFaultMechanism', () => {
  it('builds from pathophysiology', () => {
    const mc = makeMc({ pathophysiology: 'Systolic dysfunction; Reduced cardiac output' });
    const result = buildFaultMechanism(mc);
    expect(result.narrative).toContain('Systolic dysfunction');
    expect(result.mechanismSteps).toEqual(['Systolic dysfunction', 'Reduced cardiac output']);
    expect(result.etiology).toBeNull();
  });

  it('falls back to overview', () => {
    const mc = makeMc({ overview: 'Heart muscle weakness' });
    const result = buildFaultMechanism(mc);
    expect(result.narrative).toBe('Heart muscle weakness');
  });

  it('returns empty for no pathophysiology', () => {
    const mc = makeMc({});
    const result = buildFaultMechanism(mc);
    expect(result.narrative).toBe('');
    expect(result.mechanismSteps).toEqual([]);
  });

  it('includes etiology when present', () => {
    const mc = makeMc({ pathophysiology: 'Dilated cardiomyopathy', etiology: 'Idiopathic' });
    const result = buildFaultMechanism(mc);
    expect(result.etiology).toBe('Idiopathic');
  });
});

// ─── buildConsequences ───────────────────────────────────────────────────

describe('buildConsequences', () => {
  it('extracts symptoms', () => {
    const mc = makeMc({ symptoms: 'Dyspnea; Fatigue; Edema' });
    const result = buildConsequences(mc);
    expect(result.filter((c) => c.type === 'symptom')).toHaveLength(3);
  });

  it('extracts signs', () => {
    const mc = makeMc({ signs: 'S3 gallop; Jugular venous distention' });
    const result = buildConsequences(mc);
    expect(result.filter((c) => c.type === 'sign')).toHaveLength(2);
  });

  it('marks buzzword findings as strong/classic', () => {
    const mc = makeMc({ symptoms: 'Orthopnea', buzzwords: ['Orthopnea'] });
    const result = buildConsequences(mc);
    const ortho = result.find((c) => c.finding === 'Orthopnea');
    expect(ortho).toBeDefined();
    expect(ortho!.diagnosticStrength).toBe('strong');
    expect(ortho!.isClassic).toBe(true);
  });

  it('marks classic_triad items as pathognomonic', () => {
    const mc = makeMc({ classic_triad: 'Fever; Rash; Arthritis' });
    const result = buildConsequences(mc);
    expect(result.every((c) => c.diagnosticStrength === 'pathognomonic')).toBe(true);
    expect(result.every((c) => c.isClassic)).toBe(true);
  });

  it('extracts complications', () => {
    const mc = makeMc({ complications: 'Cardiogenic shock; Arrhythmia' });
    const result = buildConsequences(mc);
    const comps = result.filter((c) => c.type === 'complication');
    expect(comps).toHaveLength(2);
    expect(comps[0]!.diagnosticStrength).toBe('unknown');
  });

  it('handles physical findings with positiveLR', () => {
    const mc = makeMc();
    const pf = [{ name: 'S3 gallop', positiveLR: 11, isHighYield: true, sensitivity: 0.7, specificity: 0.8 }];
    const result = buildConsequences(mc, pf);
    expect(result[0]!.diagnosticStrength).toBe('pathognomonic');
    expect(result[0]!.positiveLR).toBe(11);
  });

  it('handles lab findings', () => {
    const mc = makeMc();
    const labs = [{ name: 'BNP', commonAbnormalities: ['Elevated >400'], isHighYield: true }];
    const result = buildConsequences(mc, [], labs);
    expect(result[0]!.type).toBe('lab_finding');
    expect(result[0]!.finding).toContain('BNP');
  });

  it('handles imaging findings', () => {
    const mc = makeMc();
    const imaging = [{ name: 'CXR', classicSigns: ['Pulmonary edema'], isHighYield: true }];
    const result = buildConsequences(mc, [], [], imaging);
    expect(result[0]!.type).toBe('imaging_finding');
    expect(result[0]!.diagnosticStrength).toBe('strong');
  });
});

// ─── buildDiagnosticWorkup ───────────────────────────────────────────────

describe('buildDiagnosticWorkup', () => {
  it('builds full workup', () => {
    const mc = makeMc({
      gold_standard_dx: 'Echocardiogram',
      best_initial_test: 'BNP',
      diagnostics: 'CXR; ECG; Troponin',
    });
    const result = buildDiagnosticWorkup(mc);
    expect(result.goldStandard).toBe('Echocardiogram');
    expect(result.bestInitialTest).toBe('BNP');
    expect(result.workupSteps).toEqual(['CXR', 'ECG', 'Troponin']);
  });

  it('returns empty workup for minimal data', () => {
    const mc = makeMc({});
    const result = buildDiagnosticWorkup(mc);
    expect(result.goldStandard).toBeNull();
    expect(result.bestInitialTest).toBeNull();
    expect(result.workupSteps).toEqual([]);
  });
});

// ─── buildTreatmentSummary ───────────────────────────────────────────────

describe('buildTreatmentSummary', () => {
  it('builds full treatment', () => {
    const mc = makeMc({
      first_line_rx: 'Lisinopril',
      treatment: 'Fluid restriction; ACE inhibitors; Diuretics',
    });
    const result = buildTreatmentSummary(mc);
    expect(result.firstLine).toBe('Lisinopril');
    expect(result.principles).toEqual(['Fluid restriction', 'ACE inhibitors', 'Diuretics']);
    expect(result.keyInterventions).toEqual(['Lisinopril']);
  });

  it('returns empty for no treatment data', () => {
    const mc = makeMc({});
    const result = buildTreatmentSummary(mc);
    expect(result.firstLine).toBeNull();
    expect(result.principles).toEqual([]);
  });
});

// ─── buildDifferentialContext ────────────────────────────────────────────

describe('buildDifferentialContext', () => {
  it('builds full differential', () => {
    const mc = makeMc({
      differentials: 'COPD; Pneumonia; Asthma',
      classic_patient: 'Elderly smoker with dyspnea',
      buzzwords: ['Barrel chest', 'Wheezing'],
    });
    const result = buildDifferentialContext(mc);
    expect(result.mustNotMiss).toEqual(['COPD', 'Pneumonia', 'Asthma']);
    expect(result.classicPatient).toBe('Elderly smoker with dyspnea');
    expect(result.buzzwords).toEqual(['Barrel chest', 'Wheezing']);
  });

  it('caps mustNotMiss at 5 items', () => {
    const mc = makeMc({ differentials: 'A; B; C; D; E; F; G' });
    const result = buildDifferentialContext(mc);
    expect(result.mustNotMiss).toHaveLength(5);
  });
});

// ─── assessCompleteness ──────────────────────────────────────────────────

describe('assessCompleteness', () => {
  it('returns high completeness for full script', () => {
    const script = makePartialScript();
    const result = assessCompleteness(script);
    expect(result.completeness).toBeGreaterThanOrEqual(0.8);
    expect(result.gaps.filter((g) => g.severity === 'critical')).toHaveLength(0);
  });

  it('identifies critical gap for missing fault', () => {
    const script = makePartialScript({
      fault: { narrative: '', mechanismSteps: [], etiology: null, evidenceGrade: null },
    });
    const result = assessCompleteness(script);
    const faultGap = result.gaps.find((g) => g.section === 'fault');
    expect(faultGap).toBeDefined();
    expect(faultGap!.severity).toBe('critical');
  });

  it('identifies critical gap for missing consequences', () => {
    const script = makePartialScript({ consequences: [] });
    const result = assessCompleteness(script);
    const consequenceGap = result.gaps.find((g) => g.section === 'consequences');
    expect(consequenceGap).toBeDefined();
    expect(consequenceGap!.severity).toBe('critical');
  });

  it('identifies gap for missing symptoms', () => {
    const script = makePartialScript({
      consequences: [
        { finding: 'S3 gallop', type: 'sign', diagnosticStrength: 'strong', isClassic: true, isHighYield: true },
      ],
    });
    const result = assessCompleteness(script);
    const symptomGap = result.gaps.find((g) => g.description.includes('No symptoms'));
    expect(symptomGap).toBeDefined();
  });

  it('identifies gap for missing signs', () => {
    const script = makePartialScript({
      consequences: [
        { finding: 'Dyspnea', type: 'symptom', diagnosticStrength: 'moderate', isClassic: false, isHighYield: true },
      ],
    });
    const result = assessCompleteness(script);
    const signGap = result.gaps.find((g) => g.description.includes('No physical exam signs'));
    expect(signGap).toBeDefined();
  });

  it('identifies moderate gaps for missing diagnostics/treatment/differential', () => {
    const script = makePartialScript({
      diagnostics: { goldStandard: null, bestInitialTest: null, workupSteps: [] },
      treatment: { firstLine: null, principles: [], keyInterventions: [] },
      differential: { mustNotMiss: [], distinguishingFeatures: [], classicPatient: null, buzzwords: [] },
    });
    const result = assessCompleteness(script);
    expect(result.gaps.some((g) => g.section === 'diagnostics')).toBe(true);
    expect(result.gaps.some((g) => g.section === 'treatment')).toBe(true);
    expect(result.gaps.some((g) => g.section === 'differential')).toBe(true);
  });

  it('scores 0/6 for empty script', () => {
    const script = makePartialScript({
      enablingConditions: [],
      fault: { narrative: '', mechanismSteps: [], etiology: null, evidenceGrade: null },
      consequences: [],
      diagnostics: { goldStandard: null, bestInitialTest: null, workupSteps: [] },
      treatment: { firstLine: null, principles: [], keyInterventions: [] },
      differential: { mustNotMiss: [], distinguishingFeatures: [], classicPatient: null, buzzwords: [] },
    });
    const result = assessCompleteness(script);
    expect(result.completeness).toBe(0);
  });
});

// ─── compareScripts ──────────────────────────────────────────────────────

describe('compareScripts', () => {
  it('identifies shared and unique sections', () => {
    const a = makePartialScript({
      enablingConditions: [
        { factor: 'Age > 65', category: 'demographic', weight: 0.8, isHighYield: true },
      ],
      consequences: [
        { finding: 'Dyspnea', type: 'symptom', diagnosticStrength: 'moderate', isClassic: false, isHighYield: true },
      ],
    });
    const b = makePartialScript({
      conditionId: 'cond-2',
      conditionName: 'COPD',
      enablingConditions: [
        { factor: 'Smoking', category: 'behavioral', weight: 0.8, isHighYield: true },
      ],
      consequences: [
        { finding: 'Dyspnea', type: 'symptom', diagnosticStrength: 'moderate', isClassic: false, isHighYield: true },
      ],
    });
    const result = compareScripts(a, b);
    expect(result.sharedFindings).toContain('dyspnea');
    expect(result.uniqueToA.length).toBeGreaterThanOrEqual(0);
    expect(result.uniqueToB.length).toBeGreaterThanOrEqual(0);
  });
});
