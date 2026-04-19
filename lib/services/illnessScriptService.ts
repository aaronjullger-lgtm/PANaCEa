/**
 * Illness Script Builder Service
 *
 * Composes structured illness scripts from existing MedicalContent and
 * related clinical data. An illness script is a clinician's mental model
 * with three components:
 *
 *   1. ENABLING CONDITIONS — epidemiology, risk factors, demographics
 *   2. FAULT — pathophysiology, mechanism of disease
 *   3. CONSEQUENCES — signs, symptoms, labs, imaging, complications
 *
 * This service does NOT duplicate data — it orchestrates existing fields
 * from MedicalContent, HistoryComponent, PhysicalExamFinding, LabTest,
 * ImagingStudy, Treatment, and DifferentialDiagnosis into a unified
 * illness script structure.
 *
 * Integration with SRS:
 *   - Each script section maps to a drill-able concept
 *   - Completeness scoring identifies knowledge gaps
 *   - Script comparison supports differential diagnosis reasoning
 *
 * Research basis:
 *   - Charlin et al. (2007): Script Concordance Test
 *   - Schmidt & Rikers (2007): Illness script theory
 *   - Bowen (2006): Diagnostic reasoning and illness scripts
 *   - PA1 Research Report: #1 differentiator vs competitors
 *
 * @module lib/services/illnessScriptService
 */

// ─── Types ───────────────────────────────────────────────────────────────

/** A single enabling condition (risk factor / epidemiological feature) */
export interface EnablingCondition {
  /** Human-readable factor */
  factor: string;
  /** Category: demographic, behavioral, genetic, environmental, comorbid */
  category: EnablingConditionCategory;
  /** Relative importance for this condition (0-1) */
  weight: number;
  /** Whether this is high-yield for PANCE */
  isHighYield: boolean;
}

export type EnablingConditionCategory =
  | 'demographic'    // age, sex, ethnicity
  | 'behavioral'     // smoking, diet, exercise
  | 'genetic'        // family history, genetic markers
  | 'environmental'  // occupational exposure, geography
  | 'comorbid'       // existing conditions that increase risk
  | 'other';

/** Pathophysiology component of the illness script */
export interface FaultMechanism {
  /** Narrative description of pathophysiology */
  narrative: string;
  /** Key mechanistic steps (ordered) */
  mechanismSteps: string[];
  /** Etiology classification */
  etiology: string | null;
  /** Evidence grade for the pathophysiology understanding */
  evidenceGrade: string | null;
}

/** A clinical consequence (sign, symptom, finding, lab result) */
export interface ClinicalConsequence {
  /** The finding/symptom/result */
  finding: string;
  /** Type classification */
  type: ConsequenceType;
  /** How strongly this finding associates with the condition */
  diagnosticStrength: DiagnosticStrength;
  /** Whether this is a classic/pathognomonic finding */
  isClassic: boolean;
  /** Whether this is high-yield for PANCE */
  isHighYield: boolean;
  /** Sensitivity if known (0-1) */
  sensitivity?: number;
  /** Specificity if known (0-1) */
  specificity?: number;
  /** Positive likelihood ratio if known */
  positiveLR?: number;
}

export type ConsequenceType =
  | 'symptom'        // patient-reported
  | 'sign'           // clinician-observed
  | 'lab_finding'    // laboratory result
  | 'imaging_finding'// radiological finding
  | 'complication'   // disease progression outcome
  | 'vital_sign';    // vital sign abnormality

export type DiagnosticStrength =
  | 'pathognomonic'  // virtually diagnostic
  | 'strong'         // highly suggestive
  | 'moderate'       // supportive
  | 'weak'           // nonspecific
  | 'unknown';

/** Diagnostic workup component */
export interface DiagnosticWorkup {
  /** Gold standard diagnostic test */
  goldStandard: string | null;
  /** Best initial test */
  bestInitialTest: string | null;
  /** Ordered workup steps */
  workupSteps: string[];
}

/** Treatment summary within the illness script */
export interface TreatmentSummary {
  /** First-line treatment */
  firstLine: string | null;
  /** Key treatment principles */
  principles: string[];
  /** Must-know medications/interventions */
  keyInterventions: string[];
}

/** Differential diagnosis context */
export interface DifferentialContext {
  /** Conditions commonly confused with this one */
  mustNotMiss: string[];
  /** Key distinguishing features from look-alikes */
  distinguishingFeatures: string[];
  /** Classic patient presentation */
  classicPatient: string | null;
  /** Buzzwords that point to this diagnosis */
  buzzwords: string[];
}

/** The complete illness script */
export interface IllnessScript {
  /** Condition identifier */
  conditionId: string;
  /** Condition name */
  conditionName: string;
  /** Organ system */
  system: string;
  /** Subcategory */
  subcategory: string;

  /** Component 1: Enabling conditions */
  enablingConditions: EnablingCondition[];

  /** Component 2: Fault / pathophysiology */
  fault: FaultMechanism;

  /** Component 3: Consequences */
  consequences: ClinicalConsequence[];

  /** Diagnostic workup */
  diagnostics: DiagnosticWorkup;

  /** Treatment summary */
  treatment: TreatmentSummary;

  /** Differential diagnosis context */
  differential: DifferentialContext;

  /** Overall PANCE yield (high_yield, medium_yield, low_yield) */
  panceYield: string | null;

  /** Script completeness score (0-1) */
  completeness: number;

  /** Which sections have gaps */
  gaps: ScriptGap[];

  /** Clinical pearls */
  clinicalPearls: string[];

  /** Mnemonics if available */
  mnemonics: string[];
}

/** Identifies a gap in the illness script */
export interface ScriptGap {
  /** Which section is incomplete */
  section: 'enabling' | 'fault' | 'consequences' | 'diagnostics' | 'treatment' | 'differential';
  /** What's missing */
  description: string;
  /** How much this gap impacts learning */
  severity: 'critical' | 'moderate' | 'minor';
}

/** Student's personal illness script with mastery overlay */
export interface PersonalIllnessScript {
  /** The reference illness script */
  script: IllnessScript;
  /** Per-section mastery (0-1), derived from drill/quiz performance */
  sectionMastery: {
    enablingConditions: number;
    fault: number;
    consequences: number;
    diagnostics: number;
    treatment: number;
    differential: number;
  };
  /** Overall mastery across all sections */
  overallMastery: number;
  /** Last reviewed timestamp */
  lastReviewed: string | null;
  /** Number of times this script has been studied */
  reviewCount: number;
}

// ─── Raw Data Types (from Prisma queries) ────────────────────────────────

export interface RawMedicalContent {
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string;
  canonicalName?: string | null;
  epidemiology?: string | null;
  etiology?: string | null;
  riskFactors?: string | null;
  age_demographic?: string | null;
  gender_bias?: string | null;
  pathophysiology?: string | null;
  overview?: string | null;
  symptoms?: string | null;
  signs?: string | null;
  physicalExam?: string | null;
  diagnostics?: string | null;
  gold_standard_dx?: string | null;
  best_initial_test?: string | null;
  differentialDiagnosis?: string | null;
  differentials?: string | null;
  complications?: string | null;
  prognosis?: string | null;
  treatment?: string | null;
  first_line_rx?: string | null;
  guidelines?: string | null;
  buzzwords?: string[];
  classic_triad?: string | null;
  classic_patient?: string | null;
  clinical_pearls?: string | null;
  mnemonic?: string | null;
  pance_yield?: string | null;
  evidenceGrade?: string | null;
}

export interface RawPhysicalFinding {
  name: string;
  clinicalSignificance?: string | null;
  sensitivity?: number | null;
  specificity?: number | null;
  positiveLR?: number | null;
  negativeLR?: number | null;
  isHighYield?: boolean;
}

export interface RawLabFinding {
  name: string;
  commonAbnormalities?: string[] | null;
  isHighYield?: boolean;
}

export interface RawImagingFinding {
  name: string;
  classicSigns?: string[] | null;
  isHighYield?: boolean;
}

// ─── Builder Functions ───────────────────────────────────────────────────

/**
 * Parse enabling conditions from MedicalContent fields.
 * Extracts structured risk factors from narrative text fields.
 */
export function buildEnablingConditions(mc: RawMedicalContent): EnablingCondition[] {
  const conditions: EnablingCondition[] = [];

  // Demographics
  if (mc.age_demographic) {
    conditions.push({
      factor: mc.age_demographic,
      category: 'demographic',
      weight: 0.8,
      isHighYield: true,
    });
  }

  if (mc.gender_bias) {
    conditions.push({
      factor: mc.gender_bias,
      category: 'demographic',
      weight: 0.7,
      isHighYield: true,
    });
  }

  // Risk factors (split by common delimiters)
  if (mc.riskFactors) {
    const factors = splitClinicalList(mc.riskFactors);
    for (const factor of factors) {
      conditions.push({
        factor,
        category: classifyRiskFactor(factor),
        weight: 0.6,
        isHighYield: false,
      });
    }
  }

  // Etiology as enabling context
  if (mc.etiology) {
    const etiologies = splitClinicalList(mc.etiology);
    for (const etiology of etiologies) {
      conditions.push({
        factor: etiology,
        category: 'other',
        weight: 0.5,
        isHighYield: false,
      });
    }
  }

  // Epidemiology nuggets
  if (mc.epidemiology) {
    conditions.push({
      factor: mc.epidemiology,
      category: 'demographic',
      weight: 0.6,
      isHighYield: false,
    });
  }

  return conditions;
}

/**
 * Build the fault/pathophysiology component.
 */
export function buildFaultMechanism(mc: RawMedicalContent): FaultMechanism {
  const narrative = mc.pathophysiology ?? mc.overview ?? '';
  const steps = narrative ? splitClinicalList(narrative) : [];

  return {
    narrative,
    mechanismSteps: steps,
    etiology: mc.etiology ?? null,
    evidenceGrade: mc.evidenceGrade ?? null,
  };
}

/**
 * Build the consequences array from symptoms, signs, labs, imaging, and complications.
 */
export function buildConsequences(
  mc: RawMedicalContent,
  physicalFindings: ReadonlyArray<RawPhysicalFinding> = [],
  labFindings: ReadonlyArray<RawLabFinding> = [],
  imagingFindings: ReadonlyArray<RawImagingFinding> = []
): ClinicalConsequence[] {
  const consequences: ClinicalConsequence[] = [];
  const buzzwordSet = new Set((mc.buzzwords ?? []).filter(Boolean).map((b) => b.toLowerCase()));

  // Symptoms (patient-reported)
  if (mc.symptoms) {
    for (const symptom of splitClinicalList(mc.symptoms)) {
      consequences.push({
        finding: symptom,
        type: 'symptom',
        diagnosticStrength: buzzwordSet.has(symptom.toLowerCase()) ? 'strong' : 'moderate',
        isClassic: buzzwordSet.has(symptom.toLowerCase()),
        isHighYield: buzzwordSet.has(symptom.toLowerCase()),
      });
    }
  }

  // Signs (clinician-observed)
  if (mc.signs) {
    for (const sign of splitClinicalList(mc.signs)) {
      consequences.push({
        finding: sign,
        type: 'sign',
        diagnosticStrength: buzzwordSet.has(sign.toLowerCase()) ? 'strong' : 'moderate',
        isClassic: buzzwordSet.has(sign.toLowerCase()),
        isHighYield: buzzwordSet.has(sign.toLowerCase()),
      });
    }
  }

  // Classic triad (always pathognomonic-level)
  if (mc.classic_triad) {
    for (const item of splitClinicalList(mc.classic_triad)) {
      consequences.push({
        finding: item,
        type: 'sign',
        diagnosticStrength: 'pathognomonic',
        isClassic: true,
        isHighYield: true,
      });
    }
  }

  // Physical exam findings with diagnostic accuracy
  for (const pf of physicalFindings) {
    consequences.push({
      finding: pf.name,
      type: 'sign',
      diagnosticStrength: classifyDiagnosticStrength(pf.positiveLR),
      isClassic: false,
      isHighYield: pf.isHighYield ?? false,
      sensitivity: pf.sensitivity ?? undefined,
      specificity: pf.specificity ?? undefined,
      positiveLR: pf.positiveLR ?? undefined,
    });
  }

  // Lab findings
  for (const lf of labFindings) {
    const abnormStr = lf.commonAbnormalities?.length ? lf.commonAbnormalities.join(', ') : '';
    consequences.push({
      finding: lf.name + (abnormStr ? `: ${abnormStr}` : ''),
      type: 'lab_finding',
      diagnosticStrength: 'moderate',
      isClassic: false,
      isHighYield: lf.isHighYield ?? false,
    });
  }

  // Imaging findings
  for (const imf of imagingFindings) {
    const signsStr = imf.classicSigns?.length ? imf.classicSigns.join(', ') : '';
    consequences.push({
      finding: imf.name + (signsStr ? `: ${signsStr}` : ''),
      type: 'imaging_finding',
      diagnosticStrength: imf.classicSigns?.length ? 'strong' : 'moderate',
      isClassic: (imf.classicSigns?.length ?? 0) > 0,
      isHighYield: imf.isHighYield ?? false,
    });
  }

  // Complications
  if (mc.complications) {
    for (const comp of splitClinicalList(mc.complications)) {
      consequences.push({
        finding: comp,
        type: 'complication',
        diagnosticStrength: 'unknown',
        isClassic: false,
        isHighYield: false,
      });
    }
  }

  return consequences;
}

/**
 * Build diagnostic workup section.
 */
export function buildDiagnosticWorkup(mc: RawMedicalContent): DiagnosticWorkup {
  return {
    goldStandard: mc.gold_standard_dx ?? null,
    bestInitialTest: mc.best_initial_test ?? null,
    workupSteps: mc.diagnostics ? splitClinicalList(mc.diagnostics) : [],
  };
}

/**
 * Build treatment summary.
 */
export function buildTreatmentSummary(mc: RawMedicalContent): TreatmentSummary {
  return {
    firstLine: mc.first_line_rx ?? null,
    principles: mc.treatment ? splitClinicalList(mc.treatment) : [],
    keyInterventions: mc.first_line_rx ? splitClinicalList(mc.first_line_rx) : [],
  };
}

/**
 * Build differential diagnosis context.
 */
export function buildDifferentialContext(mc: RawMedicalContent): DifferentialContext {
  return {
    mustNotMiss: mc.differentials ? splitClinicalList(mc.differentials).slice(0, 5) : [],
    distinguishingFeatures: [],  // Enriched from DifferentialDiagnosis model at API layer
    classicPatient: mc.classic_patient ?? null,
    buzzwords: mc.buzzwords ?? [],
  };
}

/**
 * Compute completeness score and identify gaps.
 */
export function assessCompleteness(script: Omit<IllnessScript, 'completeness' | 'gaps'>): {
  completeness: number;
  gaps: ScriptGap[];
} {
  const gaps: ScriptGap[] = [];
  let filledSections = 0;
  const totalSections = 6;

  // Enabling conditions
  if (script.enablingConditions.length > 0) {
    filledSections += 1;
  } else {
    gaps.push({
      section: 'enabling',
      description: 'No risk factors or epidemiological data',
      severity: 'moderate',
    });
  }

  // Fault
  if (script.fault.narrative.length > 0) {
    filledSections += 1;
  } else {
    gaps.push({
      section: 'fault',
      description: 'Missing pathophysiology/mechanism',
      severity: 'critical',
    });
  }

  // Consequences
  if (script.consequences.length > 0) {
    filledSections += 1;
    const hasSymptoms = script.consequences.some((c) => c.type === 'symptom');
    const hasSigns = script.consequences.some((c) => c.type === 'sign');
    if (!hasSymptoms) {
      gaps.push({ section: 'consequences', description: 'No symptoms listed', severity: 'moderate' });
    }
    if (!hasSigns) {
      gaps.push({ section: 'consequences', description: 'No physical exam signs listed', severity: 'moderate' });
    }
  } else {
    gaps.push({
      section: 'consequences',
      description: 'No clinical findings (symptoms, signs, labs)',
      severity: 'critical',
    });
  }

  // Diagnostics
  if (script.diagnostics.goldStandard || script.diagnostics.bestInitialTest || script.diagnostics.workupSteps.length > 0) {
    filledSections += 1;
  } else {
    gaps.push({
      section: 'diagnostics',
      description: 'Missing diagnostic workup information',
      severity: 'moderate',
    });
  }

  // Treatment
  if (script.treatment.firstLine || script.treatment.principles.length > 0) {
    filledSections += 1;
  } else {
    gaps.push({
      section: 'treatment',
      description: 'Missing treatment information',
      severity: 'moderate',
    });
  }

  // Differential
  if (script.differential.mustNotMiss.length > 0 || script.differential.buzzwords.length > 0) {
    filledSections += 1;
  } else {
    gaps.push({
      section: 'differential',
      description: 'No differential diagnosis context',
      severity: 'minor',
    });
  }

  return {
    completeness: filledSections / totalSections,
    gaps,
  };
}

/**
 * Build a complete illness script from raw data.
 *
 * This is the main entry point. The API endpoint fetches data from Prisma
 * and passes it here for pure computation.
 */
export function buildIllnessScript(
  mc: RawMedicalContent,
  physicalFindings: ReadonlyArray<RawPhysicalFinding> = [],
  labFindings: ReadonlyArray<RawLabFinding> = [],
  imagingFindings: ReadonlyArray<RawImagingFinding> = []
): IllnessScript {
  const enablingConditions = buildEnablingConditions(mc);
  const fault = buildFaultMechanism(mc);
  const consequences = buildConsequences(mc, physicalFindings, labFindings, imagingFindings);
  const diagnostics = buildDiagnosticWorkup(mc);
  const treatment = buildTreatmentSummary(mc);
  const differential = buildDifferentialContext(mc);

  const partialScript = {
    conditionId: mc.conditionId,
    conditionName: mc.canonicalName ?? mc.condition,
    system: mc.system,
    subcategory: mc.subcategory,
    enablingConditions,
    fault,
    consequences,
    diagnostics,
    treatment,
    differential,
    panceYield: mc.pance_yield ?? null,
    clinicalPearls: mc.clinical_pearls ? splitClinicalList(mc.clinical_pearls) : [],
    mnemonics: mc.mnemonic ? splitClinicalList(mc.mnemonic) : [],
  };

  const { completeness, gaps } = assessCompleteness(partialScript);

  return {
    ...partialScript,
    completeness,
    gaps,
  };
}

/**
 * Compare two illness scripts for differential diagnosis reasoning.
 * Returns the distinguishing features between two conditions.
 */
export function compareScripts(
  scriptA: IllnessScript,
  scriptB: IllnessScript
): {
  conditionA: string;
  conditionB: string;
  sharedFindings: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  keyDistinguishers: string[];
} {
  const findingsA = new Set(scriptA.consequences.map((c) => c.finding.toLowerCase()));
  const findingsB = new Set(scriptB.consequences.map((c) => c.finding.toLowerCase()));

  const sharedFindings: string[] = [];
  const uniqueToA: string[] = [];
  const uniqueToB: string[] = [];

  for (const f of findingsA) {
    if (findingsB.has(f)) {
      sharedFindings.push(f);
    } else {
      uniqueToA.push(f);
    }
  }

  for (const f of findingsB) {
    if (!findingsA.has(f)) {
      uniqueToB.push(f);
    }
  }

  // Key distinguishers: classic/pathognomonic findings unique to each
  const classicA = scriptA.consequences
    .filter((c) => c.isClassic && !findingsB.has(c.finding.toLowerCase()))
    .map((c) => `${scriptA.conditionName}: ${c.finding}`);
  const classicB = scriptB.consequences
    .filter((c) => c.isClassic && !findingsA.has(c.finding.toLowerCase()))
    .map((c) => `${scriptB.conditionName}: ${c.finding}`);

  return {
    conditionA: scriptA.conditionName,
    conditionB: scriptB.conditionName,
    sharedFindings,
    uniqueToA,
    uniqueToB,
    keyDistinguishers: [...classicA, ...classicB],
  };
}

// ─── Utility Functions ───────────────────────────────────────────────────

/**
 * Split clinical narrative text into a list of items.
 * Handles multiple delimiter formats commonly found in MedicalContent.
 */
export function splitClinicalList(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  // Try common delimiters in order of specificity
  // 1. Numbered lists: "1. item\n2. item"
  const numberedMatch = text.match(/^\d+[.)]\s/m);
  if (numberedMatch) {
    return text
      .split(/\n?\d+[.)]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // 2. Bullet points: "- item" or "• item"
  if (text.includes('\n-') || text.includes('\n•') || text.startsWith('-') || text.startsWith('•')) {
    return text
      .split(/\n?[-•]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // 3. Semicolons
  if (text.includes(';')) {
    return text.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  }

  // 4. Commas (but only if items are short enough to be list items)
  if (text.includes(',') && text.length < 500) {
    const items = text.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    // Only use comma split if items are reasonably short (< 100 chars each)
    if (items.every((item) => item.length < 100)) {
      return items;
    }
  }

  // 5. Newlines
  if (text.includes('\n')) {
    return text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
  }

  // 6. Single item
  return [text.trim()];
}

/**
 * Classify a risk factor string into a category.
 * Simple heuristic based on keyword matching.
 */
export function classifyRiskFactor(factor: string): EnablingConditionCategory {
  const lower = factor.toLowerCase();

  if (/\b(age|sex|male|female|gender|race|ethnicity|african|caucasian|hispanic|asian|elderly|pediatric|postmenopausal)\b/.test(lower)) {
    return 'demographic';
  }
  if (/\b(smoking|tobacco|alcohol|drug|obesity|sedentary|diet|exercise|bmi|overweight)\b/.test(lower)) {
    return 'behavioral';
  }
  if (/\b(family history|genetic|hereditary|autosomal|mutation|gene|familial|inherited)\b/.test(lower)) {
    return 'genetic';
  }
  if (/\b(occupation|exposure|asbestos|radiation|chemical|environmental|travel|geographic)\b/.test(lower)) {
    return 'environmental';
  }
  if (/\b(diabetes|hypertension|htn|dm|ckd|copd|hiv|immunocompromised|immunosuppressed)\b/.test(lower)) {
    return 'comorbid';
  }

  return 'other';
}

/**
 * Classify diagnostic strength based on positive likelihood ratio.
 */
export function classifyDiagnosticStrength(positiveLR: number | null | undefined): DiagnosticStrength {
  if (positiveLR == null) return 'unknown';
  if (positiveLR >= 10) return 'pathognomonic';
  if (positiveLR >= 5) return 'strong';
  if (positiveLR >= 2) return 'moderate';
  return 'weak';
}
