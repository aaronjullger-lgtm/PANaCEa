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
    if (/\b(allerg|medication.?allerg)\b/.test(lowerQ)) {
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
