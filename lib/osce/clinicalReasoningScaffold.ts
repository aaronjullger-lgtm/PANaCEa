/**
 * Clinical Reasoning Scaffold for OSCE Encounters
 *
 * Implements a structured "Clinical Reasoning Ladder" that guides
 * students through the H&P → PE → Dx → DDx → Tx workflow.
 *
 * Each step is scored independently. Gemini evaluates reasoning
 * quality, not just correct/incorrect binary.
 */

export type ReasoningPhase =
  | 'history'      // What history questions would you ask?
  | 'physical_exam' // What PE maneuvers would you perform?
  | 'diagnostics'  // What labs/imaging would you order?
  | 'differential' // What's your differential diagnosis?
  | 'management';  // What's your management plan?

export interface ReasoningStep {
  phase: ReasoningPhase;
  label: string;
  prompt: string;
  /** What the student should demonstrate at this step */
  objectives: string[];
  /** Max points available for this step */
  maxPoints: number;
}

export interface StepScore {
  phase: ReasoningPhase;
  pointsEarned: number;
  maxPoints: number;
  feedback: string;
  /** Items the student covered */
  covered: string[];
  /** Items the student missed */
  missed: string[];
}

export interface ReasoningScaffoldState {
  currentPhase: ReasoningPhase;
  completedPhases: ReasoningPhase[];
  scores: StepScore[];
  totalScore: number;
  maxTotalScore: number;
}

/**
 * The standard 5-step clinical reasoning ladder.
 * Used to scaffold OSCE encounters into structured phases.
 */
export const REASONING_STEPS: ReasoningStep[] = [
  {
    phase: 'history',
    label: 'History Taking',
    prompt: 'Based on the chief complaint, what history questions would you ask this patient?',
    objectives: [
      'HPI (onset, location, duration, character, aggravating/alleviating, radiation, timing, severity)',
      'Relevant PMH, PSH, medications, allergies',
      'Family history relevant to complaint',
      'Social history (tobacco, alcohol, drugs, occupation)',
      'Review of systems targeting likely differentials',
    ],
    maxPoints: 25,
  },
  {
    phase: 'physical_exam',
    label: 'Physical Examination',
    prompt: 'Based on the history, what physical exam maneuvers would you perform?',
    objectives: [
      'Vitals assessment',
      'Focused exam of affected system',
      'Relevant associated system exams',
      'Special tests or maneuvers specific to differential',
      'Documentation of pertinent negatives',
    ],
    maxPoints: 20,
  },
  {
    phase: 'diagnostics',
    label: 'Diagnostic Workup',
    prompt: 'Based on your findings, what diagnostic studies would you order?',
    objectives: [
      'Appropriate lab work (CBC, CMP, specific markers)',
      'Imaging if indicated (correct modality for presentation)',
      'Special studies (ECG, ABG, cultures, etc.)',
      'Cost-effective ordering (not shotgun approach)',
      'Urgency-appropriate prioritization',
    ],
    maxPoints: 20,
  },
  {
    phase: 'differential',
    label: 'Differential Diagnosis',
    prompt: 'What is your differential diagnosis? List in order of likelihood.',
    objectives: [
      'Most likely diagnosis supported by findings',
      'At least 2-3 reasonable alternatives',
      'Life-threatening diagnoses considered (even if unlikely)',
      'Reasoning for ranking (what supports/refutes each)',
      'Key distinguishing features between top differentials',
    ],
    maxPoints: 20,
  },
  {
    phase: 'management',
    label: 'Management Plan',
    prompt: "What is your management plan for the most likely diagnosis?",
    objectives: [
      'Immediate interventions (if urgent)',
      'Pharmacologic treatment (drug, dose, route, duration)',
      'Non-pharmacologic measures',
      'Patient education and counseling',
      'Follow-up plan and return precautions',
      'Referral if indicated',
    ],
    maxPoints: 15,
  },
];

/**
 * Initialize a new reasoning scaffold state.
 */
export function initializeScaffold(): ReasoningScaffoldState {
  return {
    currentPhase: 'history',
    completedPhases: [],
    scores: [],
    totalScore: 0,
    maxTotalScore: REASONING_STEPS.reduce((sum, s) => sum + s.maxPoints, 0),
  };
}

/**
 * Advance to the next reasoning phase.
 */
export function advancePhase(
  state: ReasoningScaffoldState,
  stepScore: StepScore
): ReasoningScaffoldState {
  const phaseOrder: ReasoningPhase[] = ['history', 'physical_exam', 'diagnostics', 'differential', 'management'];
  const currentIndex = phaseOrder.indexOf(state.currentPhase);

  const newScores = [...state.scores, stepScore];
  const newTotalScore = newScores.reduce((sum, s) => sum + s.pointsEarned, 0);
  const newCompleted = [...state.completedPhases, state.currentPhase];

  const nextIndex = currentIndex + 1;
  const nextPhase = nextIndex < phaseOrder.length
    ? phaseOrder[nextIndex]!
    : state.currentPhase; // Stay on last if done

  return {
    currentPhase: nextPhase,
    completedPhases: newCompleted,
    scores: newScores,
    totalScore: newTotalScore,
    maxTotalScore: state.maxTotalScore,
  };
}

/**
 * Get the current reasoning step details.
 */
export function getCurrentStep(state: ReasoningScaffoldState): ReasoningStep | undefined {
  return REASONING_STEPS.find(s => s.phase === state.currentPhase);
}

/**
 * Check if all phases are complete.
 */
export function isScaffoldComplete(state: ReasoningScaffoldState): boolean {
  return state.completedPhases.length >= REASONING_STEPS.length;
}

/**
 * Calculate overall performance grade.
 */
export function getPerformanceGrade(state: ReasoningScaffoldState): {
  percentage: number;
  grade: 'Excellent' | 'Good' | 'Satisfactory' | 'Needs Improvement' | 'Unsatisfactory';
  summary: string;
} {
  const percentage = state.maxTotalScore > 0
    ? (state.totalScore / state.maxTotalScore) * 100
    : 0;

  let grade: 'Excellent' | 'Good' | 'Satisfactory' | 'Needs Improvement' | 'Unsatisfactory';
  let summary: string;

  if (percentage >= 90) {
    grade = 'Excellent';
    summary = 'Outstanding clinical reasoning. Thorough and systematic approach.';
  } else if (percentage >= 80) {
    grade = 'Good';
    summary = 'Strong clinical reasoning with minor gaps.';
  } else if (percentage >= 70) {
    grade = 'Satisfactory';
    summary = 'Adequate reasoning but some important elements were missed.';
  } else if (percentage >= 60) {
    grade = 'Needs Improvement';
    summary = 'Several gaps in clinical reasoning. Review missed elements.';
  } else {
    grade = 'Unsatisfactory';
    summary = 'Significant gaps in clinical reasoning. Consider reviewing fundamentals.';
  }

  return { percentage, grade, summary };
}

/**
 * Build a Gemini prompt for grading a specific reasoning step.
 * The prompt instructs Gemini to evaluate the student's response
 * against the step's objectives.
 */
export function buildStepGradingPrompt(
  step: ReasoningStep,
  studentResponse: string,
  caseContext: {
    chiefComplaint: string;
    correctDiagnosis: string;
    keyFindings?: string[];
  }
): string {
  return `You are grading a PA student's clinical reasoning on an OSCE encounter.

CASE CONTEXT:
- Chief complaint: ${caseContext.chiefComplaint}
- Correct diagnosis: ${caseContext.correctDiagnosis}
${caseContext.keyFindings ? `- Key findings: ${caseContext.keyFindings.join(', ')}` : ''}

PHASE: ${step.label} (${step.phase})
OBJECTIVES TO EVALUATE:
${step.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

STUDENT'S RESPONSE:
"${studentResponse}"

GRADING INSTRUCTIONS:
1. Score out of ${step.maxPoints} points total
2. List which objectives the student covered (even partially)
3. List which objectives were missed or incomplete
4. Provide constructive feedback focusing on clinical reasoning quality
5. Be fair — partial credit for relevant but incomplete answers

Respond in JSON:
{
  "pointsEarned": <number>,
  "covered": [<list of covered items as strings>],
  "missed": [<list of missed items as strings>],
  "feedback": "<constructive feedback paragraph>"
}`;
}
