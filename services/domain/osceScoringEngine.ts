// services/osceScoringEngine.ts
// Comprehensive OSCE Scoring & Critical Action Tracking Engine

import type {
  CriticalAction,
  CriticalActionCategory,
  CompetencyScore,
  ScoringEvent,
  TimelineEntry,
  ExpertComparison,
  LearningGap,
  OSCEScoreReport,
  PlacedOrder,
  ExamFinding,
} from '@/types/osce-enhanced';
import type { PatientEncounterCase } from '@/types/drill-modes';

// =============================================================================
// DANGEROUS ACTION INTERFACE
// =============================================================================

interface DangerousAction {
  id: string;
  description: string;
  penalty: number; // score points deducted
  category: 'medication_error' | 'missed_emergency' | 'inappropriate_test' | 'safety_violation';
}

// =============================================================================
// CRITICAL ACTION DEFINITIONS
// =============================================================================

/**
 * Critical actions that should be tracked in all cases
 */
const UNIVERSAL_CRITICAL_ACTIONS: CriticalAction[] = [
  {
    id: 'verify_patient_id',
    category: 'safety',
    description: 'Verify patient identity',
    weight: 8,
    triggered: false,
    missedPenalty: 5,
    context: 'Beginning of encounter',
  },
  {
    id: 'hand_hygiene',
    category: 'safety',
    description: 'Perform hand hygiene before exam',
    weight: 7,
    triggered: false,
    missedPenalty: 3,
    context: 'Before physical exam',
  },
  {
    id: 'obtain_consent',
    category: 'communication',
    description: 'Obtain verbal consent before exam',
    weight: 6,
    triggered: false,
    missedPenalty: 4,
  },
  {
    id: 'explain_procedure',
    category: 'communication',
    description: 'Explain what you are going to do',
    weight: 5,
    triggered: false,
    missedPenalty: 2,
  },
  {
    id: 'assess_pain',
    category: 'diagnosis',
    description: 'Assess pain level and characteristics',
    weight: 8,
    triggered: false,
    missedPenalty: 5,
  },
  {
    id: 'medication_allergies',
    category: 'safety',
    description: 'Ask about medication allergies',
    weight: 9,
    triggered: false,
    missedPenalty: 8,
  },
  {
    id: 'current_medications',
    category: 'diagnosis',
    description: 'Review current medications',
    weight: 7,
    triggered: false,
    missedPenalty: 4,
  },
];

/**
 * Condition-specific critical actions
 */
const CONDITION_CRITICAL_ACTIONS: Record<string, CriticalAction[]> = {
  // Chest Pain / ACS
  'acute coronary syndrome': [
    {
      id: 'acs_ecg',
      category: 'diagnosis',
      description: 'Order ECG within 10 minutes',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
    },
    {
      id: 'acs_troponin',
      category: 'diagnosis',
      description: 'Order serial troponins',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
    },
    {
      id: 'acs_aspirin',
      category: 'procedure',
      description: 'Administer Aspirin 325mg',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
    },
  ],
  'myocardial infarction': [
    {
      id: 'mi_ecg',
      category: 'diagnosis',
      description: 'Order ECG within 10 minutes',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
    },
    {
      id: 'mi_troponin',
      category: 'diagnosis',
      description: 'Order serial troponins',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
    },
    {
      id: 'mi_aspirin',
      category: 'procedure',
      description: 'Administer Aspirin 325mg',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
    },
    {
      id: 'mi_cath_consult',
      category: 'procedure',
      description: 'Consider cardiology/cath lab consult',
      weight: 8,
      triggered: false,
      missedPenalty: 10,
    },
  ],

  // Stroke
  stroke: [
    {
      id: 'stroke_ct',
      category: 'diagnosis',
      description: 'Order non-contrast head CT immediately',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
    },
    {
      id: 'stroke_glucose',
      category: 'diagnosis',
      description: 'Check blood glucose',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
    },
    {
      id: 'stroke_nihss',
      category: 'diagnosis',
      description: 'Calculate NIH Stroke Scale',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
    },
    {
      id: 'stroke_time',
      category: 'communication',
      description: 'Document last known well time',
      weight: 10,
      triggered: false,
      missedPenalty: 12,
    },
  ],

  // Sepsis
  sepsis: [
    {
      id: 'sepsis_lactate',
      category: 'diagnosis',
      description: 'Order serum lactate',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
    },
    {
      id: 'sepsis_cultures',
      category: 'diagnosis',
      description: 'Obtain blood cultures before antibiotics',
      weight: 10,
      triggered: false,
      missedPenalty: 12,
    },
    {
      id: 'sepsis_abx',
      category: 'procedure',
      description: 'Start broad-spectrum antibiotics within 1 hour',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
    },
    {
      id: 'sepsis_fluids',
      category: 'procedure',
      description: 'Initiate fluid resuscitation (30ml/kg)',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
    },
  ],

  // Appendicitis
  appendicitis: [
    {
      id: 'appy_rbq',
      category: 'diagnosis',
      description: 'Assess RLQ tenderness',
      weight: 8,
      triggered: false,
      missedPenalty: 6,
    },
    {
      id: 'appy_imaging',
      category: 'diagnosis',
      description: 'Order CT or ultrasound',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
    },
    {
      id: 'appy_npo',
      category: 'procedure',
      description: 'Keep patient NPO',
      weight: 7,
      triggered: false,
      missedPenalty: 5,
    },
    {
      id: 'appy_surgical',
      category: 'procedure',
      description: 'Surgical consultation',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
    },
  ],

  // Pneumonia
  pneumonia: [
    {
      id: 'pna_cxr',
      category: 'diagnosis',
      description: 'Order chest X-ray',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
    },
    {
      id: 'pna_o2',
      category: 'diagnosis',
      description: 'Assess oxygenation status',
      weight: 8,
      triggered: false,
      missedPenalty: 6,
    },
    {
      id: 'pna_curb65',
      category: 'diagnosis',
      description: 'Calculate severity score (CURB-65 or PSI)',
      weight: 7,
      triggered: false,
      missedPenalty: 5,
    },
    {
      id: 'pna_abx',
      category: 'procedure',
      description: 'Start appropriate antibiotics',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
    },
  ],

  // Pulmonary Embolism
  'pulmonary embolism': [
    {
      id: 'pe_wells',
      category: 'diagnosis',
      description: 'Calculate Wells score for PE',
      weight: 8,
      triggered: false,
      missedPenalty: 6,
    },
    {
      id: 'pe_ddimer',
      category: 'diagnosis',
      description: 'Order D-dimer if appropriate',
      weight: 7,
      triggered: false,
      missedPenalty: 5,
    },
    {
      id: 'pe_ctpa',
      category: 'diagnosis',
      description: 'Order CT pulmonary angiogram',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
    },
    {
      id: 'pe_anticoag',
      category: 'procedure',
      description: 'Initiate anticoagulation',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
    },
  ],

  // Diabetic Ketoacidosis
  'diabetic ketoacidosis': [
    {
      id: 'dka_fluids',
      category: 'procedure',
      description: 'Initiate aggressive IV fluid resuscitation (NS 1-1.5L/hr)',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'Critical for DKA management',
    },
    {
      id: 'dka_insulin',
      category: 'procedure',
      description: 'Start continuous insulin drip (0.1 units/kg/hr)',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'After potassium replacement initiated',
    },
    {
      id: 'dka_potassium',
      category: 'safety',
      description: 'Check and replace potassium before/with insulin',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'Prevents hypokalemia complications',
    },
    {
      id: 'dka_gap',
      category: 'diagnosis',
      description: 'Monitor anion gap and bicarbonate serially',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Track resolution of metabolic acidosis',
    },
  ],
  'dka': [
    {
      id: 'dka_fluids',
      category: 'procedure',
      description: 'Initiate aggressive IV fluid resuscitation (NS 1-1.5L/hr)',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'Critical for DKA management',
    },
    {
      id: 'dka_insulin',
      category: 'procedure',
      description: 'Start continuous insulin drip (0.1 units/kg/hr)',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'After potassium replacement initiated',
    },
    {
      id: 'dka_potassium',
      category: 'safety',
      description: 'Check and replace potassium before/with insulin',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'Prevents hypokalemia complications',
    },
    {
      id: 'dka_gap',
      category: 'diagnosis',
      description: 'Monitor anion gap and bicarbonate serially',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Track resolution of metabolic acidosis',
    },
  ],

  // Ectopic Pregnancy
  'ectopic pregnancy': [
    {
      id: 'ectopic_hcg',
      category: 'diagnosis',
      description: 'Order quantitative beta-hCG',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'Confirms pregnancy',
    },
    {
      id: 'ectopic_us',
      category: 'diagnosis',
      description: 'Order transvaginal ultrasound',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
      context: 'Locates pregnancy, rules out intrauterine',
    },
    {
      id: 'ectopic_type_screen',
      category: 'safety',
      description: 'Type and screen/crossmatch',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
      context: 'Prepare for emergency surgery if needed',
    },
    {
      id: 'ectopic_obgyn',
      category: 'procedure',
      description: 'Emergent OB/GYN consultation',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'For management/surgical intervention',
    },
  ],

  // Asthma Exacerbation
  'asthma exacerbation': [
    {
      id: 'asthma_saba',
      category: 'procedure',
      description: 'Administer continuous nebulized albuterol',
      weight: 10,
      triggered: false,
      missedPenalty: 12,
      context: 'Rapid bronchodilation critical',
    },
    {
      id: 'asthma_steroids',
      category: 'procedure',
      description: 'Administer systemic corticosteroids early',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
      context: 'Reduces inflammation and recurrence',
    },
    {
      id: 'asthma_o2',
      category: 'procedure',
      description: 'Provide supplemental oxygen targeting SpO2 >92%',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Maintain oxygenation',
    },
    {
      id: 'asthma_severity',
      category: 'diagnosis',
      description: 'Assess severity (peak flow, accessory muscle use, speech)',
      weight: 8,
      triggered: false,
      missedPenalty: 6,
      context: 'Determines need for intensive care',
    },
  ],
  'asthma': [
    {
      id: 'asthma_saba',
      category: 'procedure',
      description: 'Administer continuous nebulized albuterol',
      weight: 10,
      triggered: false,
      missedPenalty: 12,
      context: 'Rapid bronchodilation critical',
    },
    {
      id: 'asthma_steroids',
      category: 'procedure',
      description: 'Administer systemic corticosteroids early',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
      context: 'Reduces inflammation and recurrence',
    },
    {
      id: 'asthma_o2',
      category: 'procedure',
      description: 'Provide supplemental oxygen targeting SpO2 >92%',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Maintain oxygenation',
    },
    {
      id: 'asthma_severity',
      category: 'diagnosis',
      description: 'Assess severity (peak flow, accessory muscle use, speech)',
      weight: 8,
      triggered: false,
      missedPenalty: 6,
      context: 'Determines need for intensive care',
    },
  ],

  // Heart Failure
  'heart failure': [
    {
      id: 'chf_diuretic',
      category: 'procedure',
      description: 'Administer IV loop diuretic (furosemide)',
      weight: 10,
      triggered: false,
      missedPenalty: 12,
      context: 'Reduces volume overload',
    },
    {
      id: 'chf_bnp',
      category: 'diagnosis',
      description: 'Order BNP/NT-proBNP',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Confirms heart failure diagnosis',
    },
    {
      id: 'chf_o2',
      category: 'procedure',
      description: 'Provide supplemental oxygen/NIPPV if needed',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
      context: 'Supports oxygenation in pulmonary edema',
    },
    {
      id: 'chf_daily_weight',
      category: 'diagnosis',
      description: 'Assess fluid status (weight, I&O, JVD, edema)',
      weight: 7,
      triggered: false,
      missedPenalty: 5,
      context: 'Monitor fluid management response',
    },
  ],
  'chf': [
    {
      id: 'chf_diuretic',
      category: 'procedure',
      description: 'Administer IV loop diuretic (furosemide)',
      weight: 10,
      triggered: false,
      missedPenalty: 12,
      context: 'Reduces volume overload',
    },
    {
      id: 'chf_bnp',
      category: 'diagnosis',
      description: 'Order BNP/NT-proBNP',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Confirms heart failure diagnosis',
    },
    {
      id: 'chf_o2',
      category: 'procedure',
      description: 'Provide supplemental oxygen/NIPPV if needed',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
      context: 'Supports oxygenation in pulmonary edema',
    },
    {
      id: 'chf_daily_weight',
      category: 'diagnosis',
      description: 'Assess fluid status (weight, I&O, JVD, edema)',
      weight: 7,
      triggered: false,
      missedPenalty: 5,
      context: 'Monitor fluid management response',
    },
  ],

  // Deep Vein Thrombosis
  'deep vein thrombosis': [
    {
      id: 'dvt_wells',
      category: 'diagnosis',
      description: 'Calculate Wells score for DVT',
      weight: 8,
      triggered: false,
      missedPenalty: 6,
      context: 'Stratifies risk and guides testing',
    },
    {
      id: 'dvt_us',
      category: 'diagnosis',
      description: 'Order compression/duplex ultrasonography',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
      context: 'Gold standard imaging for DVT',
    },
    {
      id: 'dvt_anticoag',
      category: 'procedure',
      description: 'Initiate anticoagulation therapy',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
      context: 'Prevents clot extension and embolization',
    },
    {
      id: 'dvt_pe_assess',
      category: 'diagnosis',
      description: 'Assess for concurrent PE symptoms',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Rule out pulmonary embolism',
    },
  ],
  'dvt': [
    {
      id: 'dvt_wells',
      category: 'diagnosis',
      description: 'Calculate Wells score for DVT',
      weight: 8,
      triggered: false,
      missedPenalty: 6,
      context: 'Stratifies risk and guides testing',
    },
    {
      id: 'dvt_us',
      category: 'diagnosis',
      description: 'Order compression/duplex ultrasonography',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
      context: 'Gold standard imaging for DVT',
    },
    {
      id: 'dvt_anticoag',
      category: 'procedure',
      description: 'Initiate anticoagulation therapy',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
      context: 'Prevents clot extension and embolization',
    },
    {
      id: 'dvt_pe_assess',
      category: 'diagnosis',
      description: 'Assess for concurrent PE symptoms',
      weight: 8,
      triggered: false,
      missedPenalty: 8,
      context: 'Rule out pulmonary embolism',
    },
  ],

  // Urosepsis
  'urosepsis': [
    {
      id: 'urosepsis_cultures',
      category: 'diagnosis',
      description: 'Obtain blood cultures x2 AND urine culture before antibiotics',
      weight: 10,
      triggered: false,
      missedPenalty: 12,
      context: 'Critical for organism identification',
    },
    {
      id: 'urosepsis_abx',
      category: 'procedure',
      description: 'Start empiric broad-spectrum antibiotics within 1 hour',
      weight: 10,
      triggered: false,
      missedPenalty: 15,
      context: 'Sepsis bundle compliance',
    },
    {
      id: 'urosepsis_fluids',
      category: 'procedure',
      description: 'Aggressive fluid resuscitation (30mL/kg crystalloid)',
      weight: 9,
      triggered: false,
      missedPenalty: 12,
      context: 'Critical for sepsis management',
    },
    {
      id: 'urosepsis_lactate',
      category: 'diagnosis',
      description: 'Order serum lactate and monitor',
      weight: 9,
      triggered: false,
      missedPenalty: 10,
      context: 'Marker of tissue perfusion and sepsis severity',
    },
  ],
};

// =============================================================================
// DANGEROUS ACTIONS TRACKING
// =============================================================================

/**
 * Dangerous actions that result in point deductions
 * Keyed by condition name
 */
const DANGEROUS_ACTIONS: Record<string, DangerousAction[]> = {
  // Acute Coronary Syndrome
  'acute coronary syndrome': [
    {
      id: 'acs_beta_blocker_in_hf',
      description: 'Giving beta-blockers in decompensated heart failure',
      penalty: 20,
      category: 'medication_error',
    },
    {
      id: 'acs_missed_aspirin',
      description: 'Missing aspirin administration in ACS',
      penalty: 25,
      category: 'missed_emergency',
    },
  ],

  // Stroke
  'stroke': [
    {
      id: 'stroke_tpa_after_window',
      description: 'Administering tPA after 4.5 hour window',
      penalty: 30,
      category: 'safety_violation',
    },
    {
      id: 'stroke_no_glucose_check',
      description: 'Not checking glucose before thrombolytics',
      penalty: 25,
      category: 'missed_emergency',
    },
  ],

  // Diabetic Ketoacidosis
  'diabetic ketoacidosis': [
    {
      id: 'dka_insulin_before_potassium',
      description: 'Giving insulin before checking potassium',
      penalty: 30,
      category: 'safety_violation',
    },
    {
      id: 'dka_inappropriate_bicarb',
      description: 'Giving bicarbonate inappropriately in DKA',
      penalty: 20,
      category: 'medication_error',
    },
  ],
  'dka': [
    {
      id: 'dka_insulin_before_potassium',
      description: 'Giving insulin before checking potassium',
      penalty: 30,
      category: 'safety_violation',
    },
    {
      id: 'dka_inappropriate_bicarb',
      description: 'Giving bicarbonate inappropriately in DKA',
      penalty: 20,
      category: 'medication_error',
    },
  ],

  // Sepsis
  'sepsis': [
    {
      id: 'sepsis_delayed_antibiotics',
      description: 'Delaying antibiotics more than 1 hour',
      penalty: 25,
      category: 'missed_emergency',
    },
    {
      id: 'sepsis_no_cultures',
      description: 'Not obtaining blood cultures before antibiotics',
      penalty: 15,
      category: 'inappropriate_test',
    },
  ],

  // Pulmonary Embolism
  'pulmonary embolism': [
    {
      id: 'pe_missed_anticoagulation',
      description: 'Missing anticoagulation in confirmed PE',
      penalty: 30,
      category: 'missed_emergency',
    },
    {
      id: 'pe_inappropriate_thrombolytics',
      description: 'Inappropriate thrombolytics in submassive PE',
      penalty: 20,
      category: 'medication_error',
    },
  ],
  'pe': [
    {
      id: 'pe_missed_anticoagulation',
      description: 'Missing anticoagulation in confirmed PE',
      penalty: 30,
      category: 'missed_emergency',
    },
    {
      id: 'pe_inappropriate_thrombolytics',
      description: 'Inappropriate thrombolytics in submassive PE',
      penalty: 20,
      category: 'medication_error',
    },
  ],

  // Asthma Exacerbation
  'asthma exacerbation': [
    {
      id: 'asthma_sedatives',
      description: 'Giving sedatives in acute asthma',
      penalty: 25,
      category: 'medication_error',
    },
    {
      id: 'asthma_beta_blockers',
      description: 'Giving beta-blockers in acute asthma',
      penalty: 25,
      category: 'medication_error',
    },
  ],
  'asthma': [
    {
      id: 'asthma_sedatives',
      description: 'Giving sedatives in acute asthma',
      penalty: 25,
      category: 'medication_error',
    },
    {
      id: 'asthma_beta_blockers',
      description: 'Giving beta-blockers in acute asthma',
      penalty: 25,
      category: 'medication_error',
    },
  ],
};

// =============================================================================
// SCORING ENGINE
// =============================================================================

export class OSCEScoringEngine {
  private caseData: PatientEncounterCase;
  private criticalActions: CriticalAction[];
  private scoringEvents: ScoringEvent[];
  private timeline: TimelineEntry[];
  private startTime: number;

  constructor(caseData: PatientEncounterCase) {
    this.caseData = caseData;
    this.criticalActions = this.initializeCriticalActions();
    this.scoringEvents = [];
    this.timeline = [];
    this.startTime = Date.now();
  }

  private initializeCriticalActions(): CriticalAction[] {
    const actions = [...UNIVERSAL_CRITICAL_ACTIONS];

    // Add condition-specific actions
    const diagnosis = this.caseData.correctDiagnosis?.toLowerCase() || '';

    Object.entries(CONDITION_CRITICAL_ACTIONS).forEach(([condition, conditionActions]) => {
      if (diagnosis.includes(condition.toLowerCase())) {
        actions.push(...conditionActions.map((a) => ({ ...a, triggered: false })));
      }
    });

    return actions;
  }

  /**
   * Track a question asked during history taking
   */
  trackQuestion(question: string, phase: TimelineEntry['phase']): ScoringEvent | null {
    const lowerQ = question.toLowerCase();
    let event: ScoringEvent | null = null;

    // Check for critical action triggers
    if (/\b(medication.?allerg(?:y|ies)?)\b/.test(lowerQ)) {
      event = this.triggerCriticalAction('medication_allergies', phase);
    }

    if (/\b(current.?med|taking.?any|medications)\b/.test(lowerQ)) {
      event = this.triggerCriticalAction('current_medications', phase);
    }

    if (/\b(pain|hurt|discomfort|where.?does.?it)\b/.test(lowerQ)) {
      event = this.triggerCriticalAction('assess_pain', phase);
    }

    // Add timeline entry
    this.timeline.push({
      timestamp: Date.now(),
      phase,
      action: `Asked: "${question.substring(0, 50)}..."`,
    });

    return event;
  }

  /**
   * Track an exam performed
   */
  trackExam(examFinding: ExamFinding): ScoringEvent | null {
    const maneuver = examFinding.maneuverName.toLowerCase();
    let event: ScoringEvent | null = null;

    // Check for condition-specific exam triggers
    if (maneuver.includes('rlq') || maneuver.includes('mcburney')) {
      event = this.triggerCriticalAction('appy_rbq', 'physical');
    }

    // Hand hygiene inference
    if (this.timeline.filter((t) => t.phase === 'physical').length === 0) {
      // First physical exam action - assume hand hygiene was done
      this.triggerCriticalAction('hand_hygiene', 'physical');
    }

    // Add timeline entry
    this.timeline.push({
      timestamp: Date.now(),
      phase: 'physical',
      action: `Performed: ${examFinding.maneuverName}`,
      evaluation: examFinding.isAbnormal ? 'good' : 'fair', // Finding abnormality is good
    });

    return event;
  }

  /**
   * Track an order placed
   */
  trackOrder(order: PlacedOrder): ScoringEvent | null {
    const orderName = order.itemName.toLowerCase();
    let event: ScoringEvent | null = null;

    // ECG
    if (orderName.includes('ecg') || orderName.includes('ekg')) {
      event = this.triggerCriticalAction('acs_ecg', 'diagnostic');
      event = event || this.triggerCriticalAction('mi_ecg', 'diagnostic');
    }

    // Troponin
    if (orderName.includes('troponin')) {
      event = this.triggerCriticalAction('acs_troponin', 'diagnostic');
      event = event || this.triggerCriticalAction('mi_troponin', 'diagnostic');
    }

    // CT Head
    if (orderName.includes('ct') && orderName.includes('head')) {
      event = this.triggerCriticalAction('stroke_ct', 'diagnostic');
    }

    // Chest X-ray
    if (
      orderName.includes('chest') &&
      (orderName.includes('x-ray') || orderName.includes('xray') || orderName.includes('cxr'))
    ) {
      event = this.triggerCriticalAction('pna_cxr', 'diagnostic');
    }

    // Lactate
    if (orderName.includes('lactate')) {
      event = this.triggerCriticalAction('sepsis_lactate', 'diagnostic');
    }

    // Blood culture
    if (orderName.includes('blood culture')) {
      event = this.triggerCriticalAction('sepsis_cultures', 'diagnostic');
    }

    // CT PE
    if (
      orderName.includes('ct') &&
      (orderName.includes('pe') || orderName.includes('pulmonary') || orderName.includes('angio'))
    ) {
      event = this.triggerCriticalAction('pe_ctpa', 'diagnostic');
    }

    // D-dimer
    if (orderName.includes('d-dimer') || orderName.includes('ddimer')) {
      event = this.triggerCriticalAction('pe_ddimer', 'diagnostic');
    }

    // Add timeline entry
    this.timeline.push({
      timestamp: Date.now(),
      phase: 'diagnostic',
      action: `Ordered: ${order.itemName}`,
    });

    return event;
  }

  /**
   * Track treatment/medication given
   */
  trackTreatment(treatment: string): ScoringEvent | null {
    const lowerTx = treatment.toLowerCase();
    let event: ScoringEvent | null = null;

    if (/\baspirin\b/.test(lowerTx)) {
      event = this.triggerCriticalAction('acs_aspirin', 'treatment');
      event = event || this.triggerCriticalAction('mi_aspirin', 'treatment');
    }

    if (
      /\bantibiotic|ceftriaxone|azithromycin|levofloxacin|vancomycin|piperacillin|meropenem\b/.test(
        lowerTx
      )
    ) {
      event = this.triggerCriticalAction('sepsis_abx', 'treatment');
      event = event || this.triggerCriticalAction('pna_abx', 'treatment');
    }

    if (/\bfluid|bolus|saline|lactated|crystalloid\b/.test(lowerTx)) {
      event = this.triggerCriticalAction('sepsis_fluids', 'treatment');
    }

    if (
      /\bheparin|lovenox|enoxaparin|anticoag|eliquis|xarelto|apixaban|rivaroxaban\b/.test(lowerTx)
    ) {
      event = this.triggerCriticalAction('pe_anticoag', 'treatment');
    }

    if (/\bnpo|nothing by mouth\b/.test(lowerTx)) {
      event = this.triggerCriticalAction('appy_npo', 'treatment');
    }

    // Add timeline entry
    this.timeline.push({
      timestamp: Date.now(),
      phase: 'treatment',
      action: `Treatment: ${treatment}`,
    });

    return event;
  }

  /**
   * Trigger a specific critical action
   */
  private triggerCriticalAction(
    actionId: string,
    phase: TimelineEntry['phase']
  ): ScoringEvent | null {
    const action = this.criticalActions.find((a) => a.id === actionId);
    if (!action || action.triggered) return null;

    action.triggered = true;
    action.triggeredAt = Date.now();

    const event: ScoringEvent = {
      timestamp: Date.now(),
      eventType: 'positive',
      category: action.category,
      description: `Completed: ${action.description}`,
      pointsAwarded: action.weight,
      criticalActionId: action.id,
    };

    this.scoringEvents.push(event);

    // Update timeline
    this.timeline.push({
      timestamp: Date.now(),
      phase,
      action: action.description,
      evaluation: 'excellent',
      criticalAction: action,
    });

    return event;
  }

  /**
   * Calculate competency scores
   */
  calculateCompetencyScores(): CompetencyScore {
    const scores: CompetencyScore = {
      history: 0,
      physicalExam: 0,
      diagnosticReasoning: 0,
      treatment: 0,
      communication: 0,
      efficiency: 0,
    };

    // Calculate based on triggered critical actions
    const triggeredActions = this.criticalActions.filter((a) => a.triggered);
    const totalWeight = this.criticalActions.reduce((sum, a) => sum + a.weight, 0);
    const achievedWeight = triggeredActions.reduce((sum, a) => sum + a.weight, 0);

    // Base score from critical actions
    const baseScore = totalWeight > 0 ? (achievedWeight / totalWeight) * 100 : 50;

    // Calculate per-category scores
    const byCategory = (cat: CriticalActionCategory) => {
      const catActions = this.criticalActions.filter((a) => a.category === cat);
      const catTriggered = catActions.filter((a) => a.triggered);
      if (catActions.length === 0) return 70; // Default if no actions in category
      return (catTriggered.length / catActions.length) * 100;
    };

    scores.history = Math.min(
      100,
      50 + this.timeline.filter((t) => t.phase === 'history').length * 5
    );
    scores.physicalExam = Math.min(
      100,
      40 + this.timeline.filter((t) => t.phase === 'physical').length * 8
    );
    scores.diagnosticReasoning = byCategory('diagnosis');
    scores.treatment = byCategory('procedure');
    scores.communication = byCategory('communication');

    // Efficiency based on time
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    scores.efficiency =
      elapsedMinutes < 10 ? 100 : elapsedMinutes < 15 ? 85 : elapsedMinutes < 20 ? 70 : 55;

    return scores;
  }

  /**
   * Generate learning gaps
   */
  generateLearningGaps(): LearningGap[] {
    const gaps: LearningGap[] = [];
    const missedActions = this.criticalActions.filter((a) => !a.triggered);

    // Group missed actions by category
    const byCategory: Record<CriticalActionCategory, CriticalAction[]> = {
      safety: [],
      diagnosis: [],
      communication: [],
      procedure: [],
      efficiency: [],
    };

    missedActions.forEach((a) => {
      byCategory[a.category].push(a);
    });

    // Generate gaps for categories with significant misses
    Object.entries(byCategory).forEach(([category, actions]) => {
      if (actions.length === 0) return;

      const totalPenalty = actions.reduce((sum, a) => sum + a.missedPenalty, 0);
      const severity = totalPenalty > 15 ? 'significant' : totalPenalty > 8 ? 'moderate' : 'minor';

      gaps.push({
        category: category as CriticalActionCategory,
        topic: actions.map((a) => a.description).join(', '),
        severity,
        recommendation: `Review: ${actions.map((a) => a.description).join('; ')}`,
      });
    });

    return gaps;
  }

  /**
   * Generate expert comparisons
   */
  generateExpertComparisons(): ExpertComparison[] {
    const comparisons: ExpertComparison[] = [];

    this.criticalActions.forEach((action) => {
      const expertTiming =
        action.category === 'safety'
          ? 60 // 1 minute
          : action.category === 'diagnosis'
            ? 300 // 5 minutes
            : action.category === 'communication'
              ? 120 // 2 minutes
              : 600; // 10 minutes for procedures

      comparisons.push({
        action: action.description,
        expertTiming,
        userTiming: action.triggeredAt ? action.triggeredAt - this.startTime : undefined,
        expertComment: action.triggered
          ? `Good job completing: ${action.description}`
          : `Consider: ${action.description}`,
        wasPerformed: action.triggered,
        timingDifference: action.triggeredAt
          ? action.triggeredAt - this.startTime - expertTiming
          : undefined,
      });
    });

    return comparisons;
  }

  /**
   * Generate the complete score report
   */
  generateReport(finalDiagnosis?: string, differentials?: string[]): OSCEScoreReport {
    const competencyScores = this.calculateCompetencyScores();

    // Calculate overall score
    const weights = {
      history: 0.15,
      physicalExam: 0.15,
      diagnosticReasoning: 0.25,
      treatment: 0.25,
      communication: 0.1,
      efficiency: 0.1,
    };

    const overallScore =
      competencyScores.history * weights.history +
      competencyScores.physicalExam * weights.physicalExam +
      competencyScores.diagnosticReasoning * weights.diagnosticReasoning +
      competencyScores.treatment * weights.treatment +
      competencyScores.communication * weights.communication +
      competencyScores.efficiency * weights.efficiency;

    // Check diagnosis accuracy
    const diagnosisCorrect =
      finalDiagnosis &&
      this.caseData.correctDiagnosis?.toLowerCase().includes(finalDiagnosis.toLowerCase());

    // Generate strengths and improvements
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];

    const triggeredActions = this.criticalActions.filter((a) => a.triggered);
    const missedActions = this.criticalActions.filter((a) => !a.triggered);

    if (triggeredActions.length > missedActions.length) {
      strengths.push('Good completion of critical actions');
    }
    if (competencyScores.communication >= 80) {
      strengths.push('Strong communication with patient');
    }
    if (competencyScores.efficiency >= 80) {
      strengths.push('Efficient time management');
    }
    if (diagnosisCorrect) {
      strengths.push('Correct final diagnosis');
    }

    if (missedActions.some((a) => a.category === 'safety')) {
      areasForImprovement.push('Review safety protocols');
    }
    if (competencyScores.physicalExam < 60) {
      areasForImprovement.push('More thorough physical examination');
    }
    if (competencyScores.diagnosticReasoning < 60) {
      areasForImprovement.push('Consider additional diagnostic workup');
    }
    if (!diagnosisCorrect) {
      areasForImprovement.push(`Correct diagnosis was: ${this.caseData.correctDiagnosis}`);
    }

    // Calculate ACGME milestone level
    const acgmeMilestoneLevel =
      overallScore >= 90
        ? 5
        : overallScore >= 75
          ? 4
          : overallScore >= 60
            ? 3
            : overallScore >= 45
              ? 2
              : 1;

    return {
      overallScore: Math.round(overallScore),
      competencyScores,
      criticalActions: this.criticalActions,
      timeline: this.timeline,
      expertComparisons: this.generateExpertComparisons(),
      learningGaps: this.generateLearningGaps(),
      strengths,
      areasForImprovement,
      acgmeMilestoneLevel,
    };
  }
}

// =============================================================================
// PHYSICAL EXAM THOROUGHNESS SCORING
// =============================================================================

/**
 * Maps condition names to expected physical exam maneuvers
 * Used for calculating exam thoroughness scores
 */
const CONDITION_EXPECTED_EXAMS: Record<string, string[]> = {
  'acute coronary syndrome': [
    'cardiac auscultation',
    'lung auscultation',
    'peripheral pulses',
    'JVD assessment',
    'peripheral edema',
  ],
  'stroke': [
    'neurological exam',
    'cranial nerves',
    'motor strength',
    'sensation',
    'reflexes',
    'NIHSS',
  ],
  'pneumonia': [
    'lung auscultation',
    'respiratory rate',
    'oxygen saturation',
    'percussion',
  ],
  'appendicitis': [
    'abdominal palpation',
    'McBurney point',
    'rebound tenderness',
    'Rovsing sign',
    'psoas sign',
  ],
  'diabetic ketoacidosis': [
    'mental status',
    'mucous membranes',
    'skin turgor',
    'Kussmaul breathing',
    'abdominal exam',
  ],
  'heart failure': [
    'cardiac auscultation',
    'lung auscultation',
    'JVD assessment',
    'peripheral edema',
    'hepatojugular reflux',
  ],
  'deep vein thrombosis': [
    'calf palpation',
    'Homan sign',
    'calf circumference',
    'lower extremity inspection',
    'popliteal fossa',
  ],
  'sepsis': [
    'vitals assessment',
    'skin assessment',
    'mental status',
    'capillary refill',
    'source identification',
  ],
};

interface ExamThoroughnessResult {
  score: number;
  performed: string[];
  missed: string[];
  extra: string[];
}

/**
 * Calculate physical exam thoroughness for a given condition
 * Uses fuzzy matching (substring matching) to compare performed exams against expected
 * 
 * @param condition - The clinical condition/diagnosis
 * @param performedExams - Array of exam maneuvers the student performed
 * @returns Object containing thoroughness score (0-100%) and exam breakdown
 */
/** @internal Not currently wired — kept for future exam thoroughness scoring */
function calculateExamThoroughness(
  condition: string,
  performedExams: string[]
): ExamThoroughnessResult {
  // Find matching condition (case-insensitive with basic alias support)
  let matchedCondition: string | undefined;
  const conditionLower = condition.toLowerCase().trim();

  for (const key of Object.keys(CONDITION_EXPECTED_EXAMS)) {
    if (
      conditionLower.includes(key) ||
      key.includes(conditionLower) ||
      conditionLower === key
    ) {
      matchedCondition = key;
      break;
    }
  }

  // If no match found, return default result
  if (!matchedCondition) {
    return {
      score: 0,
      performed: performedExams,
      missed: [],
      extra: performedExams,
    };
  }

  const expectedExams = CONDITION_EXPECTED_EXAMS[matchedCondition];
  if (!expectedExams) {
    return {
      score: 0,
      performed: performedExams,
      missed: [],
      extra: performedExams,
    };
  }
  const performedLower = performedExams.map((exam) => exam.toLowerCase().trim());

  // Helper function for fuzzy matching using substring matching
  const fuzzyMatch = (performed: string, expected: string): boolean => {
    // Exact match or substring match (either direction)
    if (performed === expected) return true;
    if (performed.includes(expected)) return true;
    if (expected.includes(performed)) return true;

    // Check for significant word overlap
    const performedWords = performed.split(/\s+/);
    const expectedWords = expected.split(/\s+/);
    const overlap = performedWords.filter((word) =>
      expectedWords.some((expWord) => expWord.includes(word) || word.includes(expWord))
    );

    return overlap.length >= Math.max(1, Math.ceil(performedWords.length * 0.5));
  };

  // Find performed and missed exams
  const performed: string[] = [];
  const missed: string[] = [];

  expectedExams.forEach((expected) => {
    const foundPerformed = performedLower.find((perf) => fuzzyMatch(perf, expected.toLowerCase()));
    if (foundPerformed) {
      performed.push(expected);
    } else {
      missed.push(expected);
    }
  });

  // Find extra exams (performed but not expected)
  const extra: string[] = [];
  performedExams.forEach((perf) => {
    const isExpected = expectedExams.some(
      (exp) => fuzzyMatch(perf.toLowerCase(), exp.toLowerCase())
    );
    if (!isExpected) {
      extra.push(perf);
    }
  });

  // Calculate score as percentage of expected exams performed
  const score = expectedExams.length > 0 
    ? Math.round((performed.length / expectedExams.length) * 100)
    : 0;

  return {
    score,
    performed,
    missed,
    extra,
  };
}

/**
 * Create a new scoring engine instance
 */
export function createScoringEngine(caseData: PatientEncounterCase): OSCEScoringEngine {
  return new OSCEScoringEngine(caseData);
}

/**
 * Get all critical actions for a specific condition
 */
export function getCriticalActionsForCondition(diagnosis: string): CriticalAction[] {
  const actions = [...UNIVERSAL_CRITICAL_ACTIONS];

  Object.entries(CONDITION_CRITICAL_ACTIONS).forEach(([condition, conditionActions]) => {
    if (diagnosis.toLowerCase().includes(condition.toLowerCase())) {
      actions.push(...conditionActions);
    }
  });

  return actions;
}

/**
 * Get all dangerous actions for a specific condition
 */
/** @internal Used by checkForDangerousActions — not currently wired externally */
function getDangerousActionsForCondition(condition: string): DangerousAction[] {
  const actions: DangerousAction[] = [];

  Object.entries(DANGEROUS_ACTIONS).forEach(([condKey, dangerousActionsList]) => {
    if (condition.toLowerCase().includes(condKey.toLowerCase())) {
      actions.push(...dangerousActionsList);
    }
  });

  return actions;
}

/**
 * Check if student actions triggered any dangerous actions for a given condition
 * Uses fuzzy keyword matching to identify dangerous actions in student behavior
 */
/** @internal Not currently wired — kept for future client-side dangerous action detection */
function checkForDangerousActions(
  condition: string,
  studentActions: string[]
): { triggered: DangerousAction[]; totalPenalty: number } {
  const dangerousActionsForCondition = getDangerousActionsForCondition(condition);
  const triggered: DangerousAction[] = [];

  // Helper function to extract keywords from dangerous action description
  const getKeywords = (description: string): string[] => {
    return description
      .toLowerCase()
      .split(/[\s\-,]+/)
      .filter((word) => word.length > 2);
  };

  // Check each dangerous action against student actions
  dangerousActionsForCondition.forEach((dangerousAction) => {
    const keywords = getKeywords(dangerousAction.description);

    studentActions.forEach((studentAction) => {
      const studentActionLower = studentAction.toLowerCase();

      // Fuzzy match: check if student action contains key terms from dangerous action
      const matchedKeywords = keywords.filter((keyword) => studentActionLower.includes(keyword));

      // If we find a significant match (at least 2 keywords or 50% of keywords), trigger
      if (
        matchedKeywords.length >= 2 ||
        (keywords.length > 0 && matchedKeywords.length / keywords.length >= 0.5)
      ) {
        if (!triggered.some((d) => d.id === dangerousAction.id)) {
          triggered.push(dangerousAction);
        }
      }
    });
  });

  const totalPenalty = triggered.reduce((sum, action) => sum + action.penalty, 0);

  return {
    triggered,
    totalPenalty,
  };
}
