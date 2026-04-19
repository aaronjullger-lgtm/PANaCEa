/**
 * Tests for illnessScriptService — Illness script builder
 *
 * @see lib/services/illnessScriptService.ts
 */

import { describe, it, expect } from 'vitest';
import {
  buildEnablingConditions,
  buildFaultMechanism,
  buildConsequences,
  buildDiagnosticWorkup,
  buildTreatmentSummary,
  buildDifferentialContext,
  buildIllnessScript,
  compareScripts,
  assessCompleteness,
  splitClinicalList,
  classifyRiskFactor,
  classifyDiagnosticStrength,
  type RawMedicalContent,
  type RawPhysicalFinding,
  type RawLabFinding,
  type RawImagingFinding,
} from '../lib/services/illnessScriptService';

// ─── Fixture ─────────────────────────────────────────────────────────

const CHF_CONTENT: RawMedicalContent = {
  conditionId: 'chf-001',
  condition: 'Congestive Heart Failure',
  system: 'Cardiovascular',
  subcategory: 'Heart Failure',
  canonicalName: 'Heart Failure',
  epidemiology: 'Most common cause of hospitalization in adults >65',
  etiology: 'Ischemic heart disease; Hypertension; Valvular disease; Cardiomyopathy',
  riskFactors: 'Age >65, Male sex, Hypertension, Diabetes, Obesity, Smoking, Family history of cardiomyopathy',
  age_demographic: 'Adults >65',
  gender_bias: 'Male predominance',
  pathophysiology: 'Reduced cardiac output leads to neurohormonal activation (RAAS, SNS). Fluid retention causes pulmonary congestion and peripheral edema. Ventricular remodeling progresses over time.',
  overview: 'Heart failure is the inability of the heart to pump sufficient blood to meet metabolic demands.',
  symptoms: 'Dyspnea on exertion; Orthopnea; Paroxysmal nocturnal dyspnea; Fatigue; Lower extremity edema',
  signs: 'Jugular venous distension; S3 gallop; Bilateral crackles; Peripheral edema; Hepatojugular reflux',
  physicalExam: 'JVP elevation, S3 gallop, bilateral basilar crackles',
  diagnostics: 'BNP or NT-proBNP; Echocardiography; Chest X-ray; ECG',
  gold_standard_dx: 'Echocardiography',
  best_initial_test: 'BNP or NT-proBNP',
  differentialDiagnosis: 'COPD, Pulmonary embolism, Pneumonia',
  differentials: 'COPD; Pulmonary embolism; Pneumonia; Nephrotic syndrome',
  complications: 'Cardiogenic shock; Arrhythmias; Renal failure; Pulmonary edema',
  prognosis: '50% five-year mortality',
  treatment: 'ACE inhibitors/ARBs; Beta-blockers; Diuretics; Aldosterone antagonists; SGLT2 inhibitors',
  first_line_rx: 'ACE inhibitor + Beta-blocker + Diuretic',
  guidelines: 'ACC/AHA 2022 Heart Failure Guidelines',
  buzzwords: ['S3 gallop', 'JVD', 'Orthopnea', 'PND'],
  classic_triad: null,
  classic_patient: 'Elderly male with HTN presenting with DOE, orthopnea, and bilateral LE edema',
  clinical_pearls: 'BNP >400 highly suggestive; S3 gallop is specific for volume overload; SGLT2i now guideline-directed for HFrEF',
  mnemonic: 'UNLOAD — Upright position, Nitrates, Lasix, Oxygen, ACE inhibitor, Digoxin',
  pance_yield: 'high_yield',
  evidenceGrade: 'A',
};

const EMPTY_CONTENT: RawMedicalContent = {
  conditionId: 'empty-001',
  condition: 'Empty Condition',
  system: 'Other',
  subcategory: 'Test',
};

// ─── splitClinicalList ───────────────────────────────────────────────

describe('splitClinicalList', () => {
  it('splits semicolon-delimited text', () => {
    const items = splitClinicalList('Item A; Item B; Item C');
    expect(items).toEqual(['Item A', 'Item B', 'Item C']);
  });

  it('splits comma-delimited short items', () => {
    const items = splitClinicalList('Fever, Cough, Dyspnea');
    expect(items).toEqual(['Fever', 'Cough', 'Dyspnea']);
  });

  it('splits bullet-pointed text', () => {
    const items = splitClinicalList('- Item A\n- Item B\n- Item C');
    expect(items).toEqual(['Item A', 'Item B', 'Item C']);
  });

  it('splits numbered lists', () => {
    const items = splitClinicalList('1. First\n2. Second\n3. Third');
    expect(items).toEqual(['First', 'Second', 'Third']);
  });

  it('splits newline-separated text', () => {
    const items = splitClinicalList('Line one\nLine two\nLine three');
    expect(items).toEqual(['Line one', 'Line two', 'Line three']);
  });

  it('returns single item for plain text', () => {
    const items = splitClinicalList('Single narrative paragraph.');
    expect(items).toEqual(['Single narrative paragraph.']);
  });

  it('returns empty array for empty/null input', () => {
    expect(splitClinicalList('')).toEqual([]);
    expect(splitClinicalList('   ')).toEqual([]);
  });

  it('trims whitespace from items', () => {
    const items = splitClinicalList('  A  ;  B  ;  C  ');
    expect(items).toEqual(['A', 'B', 'C']);
  });
});

// ─── classifyRiskFactor ──────────────────────────────────────────────

describe('classifyRiskFactor', () => {
  it('classifies demographic factors', () => {
    expect(classifyRiskFactor('Age >65')).toBe('demographic');
    expect(classifyRiskFactor('Male sex')).toBe('demographic');
    expect(classifyRiskFactor('African American descent')).toBe('demographic');
    expect(classifyRiskFactor('Postmenopausal women')).toBe('demographic');
  });

  it('classifies behavioral factors', () => {
    expect(classifyRiskFactor('Smoking history')).toBe('behavioral');
    expect(classifyRiskFactor('Alcohol use disorder')).toBe('behavioral');
    expect(classifyRiskFactor('Obesity BMI >30')).toBe('behavioral');
  });

  it('classifies genetic factors', () => {
    expect(classifyRiskFactor('Family history of cardiomyopathy')).toBe('genetic');
    expect(classifyRiskFactor('Autosomal dominant mutation')).toBe('genetic');
  });

  it('classifies environmental factors', () => {
    expect(classifyRiskFactor('Asbestos exposure')).toBe('environmental');
    expect(classifyRiskFactor('Occupational dust exposure')).toBe('environmental');
  });

  it('classifies comorbid factors', () => {
    expect(classifyRiskFactor('Diabetes mellitus')).toBe('comorbid');
    expect(classifyRiskFactor('Hypertension')).toBe('comorbid');
    expect(classifyRiskFactor('Immunocompromised state')).toBe('comorbid');
  });

  it('defaults to other for unclassifiable', () => {
    expect(classifyRiskFactor('Unknown factor')).toBe('other');
  });
});

// ─── classifyDiagnosticStrength ──────────────────────────────────────

describe('classifyDiagnosticStrength', () => {
  it('returns pathognomonic for LR >= 10', () => {
    expect(classifyDiagnosticStrength(15)).toBe('pathognomonic');
    expect(classifyDiagnosticStrength(10)).toBe('pathognomonic');
  });

  it('returns strong for LR 5-9.99', () => {
    expect(classifyDiagnosticStrength(7)).toBe('strong');
    expect(classifyDiagnosticStrength(5)).toBe('strong');
  });

  it('returns moderate for LR 2-4.99', () => {
    expect(classifyDiagnosticStrength(3)).toBe('moderate');
    expect(classifyDiagnosticStrength(2)).toBe('moderate');
  });

  it('returns weak for LR < 2', () => {
    expect(classifyDiagnosticStrength(1.5)).toBe('weak');
    expect(classifyDiagnosticStrength(0.5)).toBe('weak');
  });

  it('returns unknown for null/undefined', () => {
    expect(classifyDiagnosticStrength(null)).toBe('unknown');
    expect(classifyDiagnosticStrength(undefined)).toBe('unknown');
  });
});

// ─── buildEnablingConditions ─────────────────────────────────────────

describe('buildEnablingConditions', () => {
  it('extracts demographics, risk factors, and epidemiology', () => {
    const conditions = buildEnablingConditions(CHF_CONTENT);
    expect(conditions.length).toBeGreaterThan(0);

    const demographics = conditions.filter((c) => c.category === 'demographic');
    expect(demographics.length).toBeGreaterThanOrEqual(2); // age + gender

    const hasAge = conditions.some((c) => c.factor === 'Adults >65');
    expect(hasAge).toBe(true);
  });

  it('returns empty for empty content', () => {
    expect(buildEnablingConditions(EMPTY_CONTENT)).toHaveLength(0);
  });

  it('classifies risk factors by category', () => {
    const conditions = buildEnablingConditions(CHF_CONTENT);
    const categories = new Set(conditions.map((c) => c.category));
    expect(categories.size).toBeGreaterThan(1);
  });
});

// ─── buildFaultMechanism ─────────────────────────────────────────────

describe('buildFaultMechanism', () => {
  it('extracts pathophysiology narrative', () => {
    const fault = buildFaultMechanism(CHF_CONTENT);
    expect(fault.narrative).toContain('cardiac output');
    expect(fault.etiology).toContain('Ischemic');
    expect(fault.evidenceGrade).toBe('A');
  });

  it('falls back to overview if no pathophysiology', () => {
    const content: RawMedicalContent = {
      ...EMPTY_CONTENT,
      overview: 'Brief overview text',
    };
    const fault = buildFaultMechanism(content);
    expect(fault.narrative).toBe('Brief overview text');
  });

  it('returns empty for missing data', () => {
    const fault = buildFaultMechanism(EMPTY_CONTENT);
    expect(fault.narrative).toBe('');
    expect(fault.mechanismSteps).toHaveLength(0);
    expect(fault.etiology).toBeNull();
  });
});

// ─── buildConsequences ───────────────────────────────────────────────

describe('buildConsequences', () => {
  it('extracts symptoms, signs, and complications', () => {
    const consequences = buildConsequences(CHF_CONTENT);
    const types = new Set(consequences.map((c) => c.type));
    expect(types.has('symptom')).toBe(true);
    expect(types.has('sign')).toBe(true);
    expect(types.has('complication')).toBe(true);
  });

  it('marks buzzword findings as classic/high-yield', () => {
    const consequences = buildConsequences(CHF_CONTENT);
    const s3 = consequences.find((c) => c.finding.toLowerCase().includes('s3 gallop'));
    // S3 gallop is in buzzwords
    expect(s3?.isClassic).toBe(true);
    expect(s3?.diagnosticStrength).toBe('strong');
  });

  it('includes physical findings with diagnostic accuracy', () => {
    const findings: RawPhysicalFinding[] = [
      { name: 'Hepatojugular reflux', sensitivity: 0.24, specificity: 0.96, positiveLR: 6.0, isHighYield: true },
    ];
    const consequences = buildConsequences(CHF_CONTENT, findings);
    // Find the physical-finding-derived entry (has positiveLR), not the text-derived one
    const hjr = consequences.find((c) => c.finding === 'Hepatojugular reflux' && c.positiveLR != null);
    expect(hjr).toBeDefined();
    expect(hjr!.sensitivity).toBe(0.24);
    expect(hjr!.specificity).toBe(0.96);
    expect(hjr!.positiveLR).toBe(6.0);
    expect(hjr!.diagnosticStrength).toBe('strong');
  });

  it('includes lab and imaging findings', () => {
    // commonAbnormalities / classicSigns are string[] per the type — the
    // service joins them with ', ' so the finding text is readable.
    const labs: RawLabFinding[] = [
      { name: 'BNP', commonAbnormalities: ['Elevated >400 pg/mL'], isHighYield: true },
    ];
    const imaging: RawImagingFinding[] = [
      { name: 'Chest X-ray', classicSigns: ['Cephalization', 'Kerley B lines'], isHighYield: true },
    ];
    const consequences = buildConsequences(CHF_CONTENT, [], labs, imaging);
    const bnp = consequences.find((c) => c.finding.includes('BNP'));
    const cxr = consequences.find((c) => c.finding.includes('Chest X-ray'));
    expect(bnp).toBeDefined();
    expect(bnp!.type).toBe('lab_finding');
    expect(cxr).toBeDefined();
    expect(cxr!.type).toBe('imaging_finding');
    expect(cxr!.isClassic).toBe(true);
  });

  it('returns empty for empty content', () => {
    expect(buildConsequences(EMPTY_CONTENT)).toHaveLength(0);
  });
});

// ─── buildDiagnosticWorkup ───────────────────────────────────────────

describe('buildDiagnosticWorkup', () => {
  it('extracts gold standard and initial test', () => {
    const dx = buildDiagnosticWorkup(CHF_CONTENT);
    expect(dx.goldStandard).toBe('Echocardiography');
    expect(dx.bestInitialTest).toBe('BNP or NT-proBNP');
    expect(dx.workupSteps.length).toBeGreaterThan(0);
  });

  it('returns null for missing data', () => {
    const dx = buildDiagnosticWorkup(EMPTY_CONTENT);
    expect(dx.goldStandard).toBeNull();
    expect(dx.bestInitialTest).toBeNull();
    expect(dx.workupSteps).toHaveLength(0);
  });
});

// ─── buildTreatmentSummary ───────────────────────────────────────────

describe('buildTreatmentSummary', () => {
  it('extracts first-line and treatment principles', () => {
    const tx = buildTreatmentSummary(CHF_CONTENT);
    expect(tx.firstLine).toContain('ACE inhibitor');
    expect(tx.principles.length).toBeGreaterThan(0);
  });
});

// ─── buildDifferentialContext ─────────────────────────────────────────

describe('buildDifferentialContext', () => {
  it('extracts must-not-miss differentials and buzzwords', () => {
    const ddx = buildDifferentialContext(CHF_CONTENT);
    expect(ddx.mustNotMiss.length).toBeGreaterThan(0);
    expect(ddx.buzzwords).toContain('S3 gallop');
    expect(ddx.classicPatient).toContain('Elderly male');
  });
});

// ─── assessCompleteness ──────────────────────────────────────────────

describe('assessCompleteness', () => {
  it('returns 1.0 for complete script', () => {
    const script = buildIllnessScript(CHF_CONTENT);
    expect(script.completeness).toBe(1.0);
    expect(script.gaps).toHaveLength(0);
  });

  it('identifies gaps in empty script', () => {
    const script = buildIllnessScript(EMPTY_CONTENT);
    expect(script.completeness).toBeLessThan(1.0);
    expect(script.gaps.length).toBeGreaterThan(0);

    const criticalGaps = script.gaps.filter((g) => g.severity === 'critical');
    expect(criticalGaps.length).toBeGreaterThan(0);
  });

  it('identifies specific missing sections', () => {
    const script = buildIllnessScript(EMPTY_CONTENT);
    const gapSections = script.gaps.map((g) => g.section);
    expect(gapSections).toContain('fault');
    expect(gapSections).toContain('consequences');
  });
});

// ─── buildIllnessScript (integration) ────────────────────────────────

describe('buildIllnessScript', () => {
  it('composes a complete illness script from rich data', () => {
    const script = buildIllnessScript(CHF_CONTENT);

    expect(script.conditionId).toBe('chf-001');
    expect(script.conditionName).toBe('Heart Failure');
    expect(script.system).toBe('Cardiovascular');
    expect(script.panceYield).toBe('high_yield');
    expect(script.enablingConditions.length).toBeGreaterThan(0);
    expect(script.fault.narrative.length).toBeGreaterThan(0);
    expect(script.consequences.length).toBeGreaterThan(0);
    expect(script.diagnostics.goldStandard).toBeTruthy();
    expect(script.treatment.firstLine).toBeTruthy();
    expect(script.differential.buzzwords.length).toBeGreaterThan(0);
    expect(script.clinicalPearls.length).toBeGreaterThan(0);
    expect(script.mnemonics.length).toBeGreaterThan(0);
  });

  it('uses canonicalName over condition name', () => {
    const script = buildIllnessScript(CHF_CONTENT);
    expect(script.conditionName).toBe('Heart Failure'); // canonicalName
  });

  it('handles minimal data gracefully', () => {
    const script = buildIllnessScript(EMPTY_CONTENT);
    expect(script.conditionId).toBe('empty-001');
    expect(script.enablingConditions).toHaveLength(0);
    expect(script.consequences).toHaveLength(0);
    expect(script.completeness).toBeLessThan(1.0);
  });

  it('integrates physical findings with diagnostic accuracy', () => {
    const findings: RawPhysicalFinding[] = [
      { name: 'S3 Gallop', sensitivity: 0.13, specificity: 0.99, positiveLR: 11.0, isHighYield: true },
    ];
    const script = buildIllnessScript(CHF_CONTENT, findings);
    const s3Finding = script.consequences.find(
      (c) => c.finding === 'S3 Gallop' && c.positiveLR === 11.0
    );
    expect(s3Finding).toBeDefined();
    expect(s3Finding!.diagnosticStrength).toBe('pathognomonic');
  });
});

// ─── compareScripts ──────────────────────────────────────────────────

describe('compareScripts', () => {
  const COPD_CONTENT: RawMedicalContent = {
    conditionId: 'copd-001',
    condition: 'COPD',
    system: 'Pulmonary',
    subcategory: 'Obstructive',
    symptoms: 'Dyspnea on exertion; Chronic cough; Sputum production',
    signs: 'Barrel chest; Wheezing; Decreased breath sounds; Pursed lip breathing',
    buzzwords: ['Barrel chest', 'Pink puffer', 'Blue bloater'],
    classic_patient: 'Long-term smoker with progressive dyspnea and chronic productive cough',
    complications: 'Cor pulmonale; Pneumothorax; Respiratory failure',
  };

  it('identifies shared findings between CHF and COPD', () => {
    const chfScript = buildIllnessScript(CHF_CONTENT);
    const copdScript = buildIllnessScript(COPD_CONTENT);
    const comparison = compareScripts(chfScript, copdScript);

    expect(comparison.conditionA).toBe('Heart Failure');
    expect(comparison.conditionB).toBe('COPD');
    // Both share "Dyspnea on exertion"
    expect(comparison.sharedFindings.some((f) => f.includes('dyspnea'))).toBe(true);
    expect(comparison.uniqueToA.length).toBeGreaterThan(0);
    expect(comparison.uniqueToB.length).toBeGreaterThan(0);
  });

  it('surfaces key distinguishers from classic findings', () => {
    const chfScript = buildIllnessScript(CHF_CONTENT);
    const copdScript = buildIllnessScript(COPD_CONTENT);
    const comparison = compareScripts(chfScript, copdScript);

    // Key distinguishers should include classic findings unique to each
    expect(comparison.keyDistinguishers.length).toBeGreaterThan(0);
  });
});
