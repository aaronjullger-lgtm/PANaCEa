/**
 * Socratic ZPD Service — Tier 3 Experimental Feature
 *
 * Operationalizes Vygotsky's Zone of Proximal Development (ZPD) using FSRS
 * state variables (Retrievability R, Difficulty D, Stability S) to calibrate
 * Socratic question depth and type.
 *
 * Integrates Paul & Elder's (2006) six types of Socratic questions:
 *   1. Clarification — "What do you mean by...?"
 *   2. Assumption-probing — "What are you assuming?"
 *   3. Evidence-probing — "What evidence supports that?"
 *   4. Perspective — "What's an alternative view?"
 *   5. Implication — "If that's true, what follows?"
 *   6. Meta-questions — "Why is this question important?"
 *
 * ZPD mapping (per tier3.md research):
 *   R < 0.4 (below ZPD) → Clarification + assumption questions (rebuild foundations)
 *   0.4 ≤ R < 0.75 (in ZPD) → Evidence + perspective questions (strengthen connections)
 *   R ≥ 0.75 (above ZPD) → Implication + meta questions (deepen understanding)
 *
 * 4-step progressive hint escalation:
 *   Step 1: Open-ended Socratic question
 *   Step 2: Narrowing question with a constraint
 *   Step 3: Partial answer with fill-in-the-blank
 *   Step 4: Full explanation with clinical context
 *
 * Research basis:
 *   - Murray & Arroyo (2002): Statistical ZPD — 50–80% success rate with scaffolding
 *   - Chounta et al. (2017, CMU): "Grey Area" model for ZPD estimation
 *   - Paul & Elder (2006/2007): Six types of Socratic questions
 *   - Google LearnLM: 82% preference over GPT-4o, 5.5pp improvement (Eedi RCT)
 *   - PARTS framework: Persona, Act, Recipient, Theme, Structure
 *
 * @module lib/services/socraticZpdService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Paul & Elder's Socratic question taxonomy */
export type SocraticQuestionType =
  | 'clarification'
  | 'assumption_probing'
  | 'evidence_probing'
  | 'perspective'
  | 'implication'
  | 'meta_question';

/** ZPD zone classification based on FSRS state */
export type ZpdZone = 'below_zpd' | 'in_zpd' | 'above_zpd';

/** Progressive hint level (1-indexed, matches tier3 spec) */
export type HintLevel = 1 | 2 | 3 | 4;

/** FSRS learner state for ZPD calibration */
export interface FsrsLearnerState {
  /** Retrievability R ∈ [0, 1] — predicted recall probability */
  retrievability: number;
  /** Difficulty D ∈ [1, 10] — item difficulty */
  difficulty: number;
  /** Stability S in days — memory strength */
  stability: number;
  /** Number of times this card has been reviewed */
  reviewCount: number;
  /** Number of lapses (failures after initial learning) */
  lapseCount: number;
}

/** Complete ZPD assessment for a learner-card pair */
export interface ZpdAssessment {
  /** Which ZPD zone the learner is in for this card */
  zone: ZpdZone;
  /** Recommended question types for this zone */
  recommendedQuestionTypes: SocraticQuestionType[];
  /** Current hint level (escalates with each interaction) */
  hintLevel: HintLevel;
  /** Confidence in this assessment (0–1) */
  assessmentConfidence: number;
  /** Whether prerequisites should be reviewed instead of Socratic questioning */
  needsPrerequisiteReview: boolean;
  /** Descriptive label for the zone */
  zoneLabel: string;
}

/** Parameters for building the ZPD-calibrated system prompt */
export interface SocraticPromptParams {
  /** The ZPD assessment */
  zpd: ZpdAssessment;
  /** Topic being studied */
  topic: string;
  /** Current turn number (0-indexed) */
  turnNumber: number;
  /** Maximum turns before auto-reveal */
  maxTurns: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** R thresholds for ZPD zone classification */
export const ZPD_THRESHOLDS = {
  belowZpd: 0.40,  // R < 0.40 → below ZPD
  aboveZpd: 0.75,  // R ≥ 0.75 → above ZPD
} as const;

/** Maximum hint levels before full reveal */
export const MAX_HINT_LEVELS = 4;

/** Maximum conversation turns (increased from 3 to 4 for ZPD model) */
export const MAX_TURNS = 4;

/** Question type recommendations per ZPD zone */
export const ZONE_QUESTION_TYPES: Record<ZpdZone, SocraticQuestionType[]> = {
  below_zpd: ['clarification', 'assumption_probing'],
  in_zpd: ['evidence_probing', 'perspective'],
  above_zpd: ['implication', 'meta_question'],
};

/** Human-readable zone labels */
const ZONE_LABELS: Record<ZpdZone, string> = {
  below_zpd: 'Building foundations',
  in_zpd: 'Strengthening connections',
  above_zpd: 'Deepening understanding',
};

// ─── ZPD Assessment ──────────────────────────────────────────────────────────

/**
 * Classify the learner's ZPD zone for a specific card.
 *
 * Uses FSRS Retrievability as the primary signal (it directly maps to
 * predicted success probability), with Difficulty and lapse count as
 * secondary signals for edge cases.
 *
 * @param state - FSRS learner state for this card
 * @returns ZPD zone classification
 */
export function classifyZpdZone(state: FsrsLearnerState): ZpdZone {
  const { retrievability, difficulty, lapseCount } = state;

  // Edge case: high lapses + high difficulty → below ZPD even if R is moderate
  // (The student keeps failing this card; scaffolding alone won't help)
  if (lapseCount >= 5 && difficulty >= 7 && retrievability < 0.60) {
    return 'below_zpd';
  }

  if (retrievability < ZPD_THRESHOLDS.belowZpd) return 'below_zpd';
  if (retrievability >= ZPD_THRESHOLDS.aboveZpd) return 'above_zpd';
  return 'in_zpd';
}

/**
 * Compute the full ZPD assessment for a learner-card pair.
 *
 * @param state - FSRS learner state
 * @param currentHintLevel - Current hint level (1-indexed)
 * @returns Complete ZPD assessment with recommendations
 */
export function assessZpd(
  state: FsrsLearnerState,
  currentHintLevel: HintLevel = 1
): ZpdAssessment {
  const zone = classifyZpdZone(state);

  // Needs prerequisite review: below ZPD with very low R and high difficulty
  const needsPrerequisiteReview =
    zone === 'below_zpd' &&
    state.retrievability < 0.20 &&
    state.difficulty >= 8;

  // Assessment confidence: higher when we have more review data
  const reviewDataConfidence = Math.min(1, state.reviewCount / 10);
  const rConfidence = state.retrievability > 0 && state.retrievability < 1 ? 0.9 : 0.5;
  const assessmentConfidence = reviewDataConfidence * rConfidence;

  return {
    zone,
    recommendedQuestionTypes: ZONE_QUESTION_TYPES[zone],
    hintLevel: currentHintLevel,
    assessmentConfidence,
    needsPrerequisiteReview,
    zoneLabel: ZONE_LABELS[zone],
  };
}

// ─── System Prompt Generation (LearnLM PARTS Framework) ──────────────────────

/**
 * Build the ZPD-calibrated system prompt using Google's LearnLM PARTS framework:
 *   P - Persona: Medical education Socratic tutor
 *   A - Act: Guide through questions calibrated to ZPD
 *   R - Recipient: PA student with specific FSRS knowledge state
 *   T - Theme: The medical concept being reviewed
 *   S - Structure: Progressive hint escalation with Paul & Elder taxonomy
 *
 * @param params - Prompt parameters including ZPD assessment
 * @returns System instruction string for Gemini API
 */
export function buildZpdSystemPrompt(params: SocraticPromptParams): string {
  const { zpd, topic, turnNumber, maxTurns } = params;
  const hintLevel = Math.min(MAX_HINT_LEVELS, turnNumber + 1) as HintLevel;

  const questionTypeInstructions = getQuestionTypeInstructions(zpd.zone);
  const hintLevelInstructions = getHintLevelInstructions(hintLevel);
  const prerequisiteNote = zpd.needsPrerequisiteReview
    ? '\nIMPORTANT: This student may need prerequisite review. Start with the most fundamental aspect of this concept. Use very simple, direct clarification questions.'
    : '';

  return `[PERSONA] You are a Socratic medical education tutor for Physician Assistant students preparing for the PANCE exam. You guide through questions, never lecture.

[ACT] Guide the student to discover their error through calibrated Socratic questioning. Your questions should match their current knowledge state.

[RECIPIENT] This PA student's knowledge state for "${topic}":
- Recall probability: ${(zpd.zone === 'below_zpd' ? 'Low' : zpd.zone === 'in_zpd' ? 'Moderate' : 'High')}
- Zone: ${zpd.zoneLabel}
- This is hint ${hintLevel} of ${maxTurns} maximum.${prerequisiteNote}

[THEME] ${topic}

[STRUCTURE]
${questionTypeInstructions}
${hintLevelInstructions}

CRITICAL RULES:
1. Output ONLY the guiding question text — no preamble, no markdown, no "Here's a question:"
2. ONE question only, 1–3 sentences maximum.
3. NEVER give the answer directly until Step 4 (full reveal).
4. Reference specific details from the vignette when possible.
5. Be warm and supportive — frame errors as learning opportunities.
6. If the student's response shows they're close, acknowledge progress.`;
}

/**
 * Get question type instructions based on ZPD zone.
 */
function getQuestionTypeInstructions(zone: ZpdZone): string {
  switch (zone) {
    case 'below_zpd':
      return `QUESTION TYPE: Clarification & Assumption-Probing (student needs foundations rebuilt)
- Ask "What do you mean by...?" or "What are you assuming about...?"
- Break the concept into its most basic components
- Don't assume prior knowledge — check foundational understanding
- Example: "What is the primary mechanism of [drug/process] that relates to this patient's presentation?"`;

    case 'in_zpd':
      return `QUESTION TYPE: Evidence-Probing & Perspective (student can connect with guidance)
- Ask "What evidence in the vignette supports...?" or "What would change if...?"
- Help them connect existing knowledge to the new concept
- Challenge them to consider differential diagnoses
- Example: "What finding in the labs distinguishes this from [similar condition]?"`;

    case 'above_zpd':
      return `QUESTION TYPE: Implication & Meta-questions (student needs deeper challenge)
- Ask "If that's true, what would you expect to see in...?" or "Why is this distinction clinically important?"
- Push toward application and clinical reasoning
- Connect to broader medical principles
- Example: "How would your management change if the patient also had [comorbidity]?"`;
  }
}

/**
 * Get hint level escalation instructions.
 *
 * 4-step progressive disclosure per tier3.md:
 *   Step 1: Open-ended Socratic question
 *   Step 2: Narrowing question with a constraint
 *   Step 3: Partial answer with fill-in-the-blank
 *   Step 4: Full explanation with clinical context
 */
function getHintLevelInstructions(level: HintLevel): string {
  switch (level) {
    case 1:
      return `HINT LEVEL 1 — Open-ended Socratic question:
Ask a broad question that invites the student to think about the concept from a new angle. Do NOT narrow the focus yet.`;

    case 2:
      return `HINT LEVEL 2 — Narrowing question with constraint:
The student has already engaged once. Now ask a MORE SPECIFIC question that narrows toward the correct reasoning. Add a constraint like "Focus specifically on..." or "Given that [key detail from vignette]..."`;

    case 3:
      return `HINT LEVEL 3 — Partial answer with fill-in-the-blank:
The student needs more help. Provide a PARTIAL explanation with a gap for them to fill. Format: "The key mechanism here is [describe part], which leads to _____ [let them fill this in]."`;

    case 4:
      return `HINT LEVEL 4 — Full explanation with clinical context:
Provide the complete explanation. Include: (1) Why the correct answer is right, (2) Why the student's answer was wrong, (3) A memorable clinical pearl or distinguishing feature, (4) How this connects to broader clinical reasoning.`;
  }
}

/**
 * Determine the effective hint level based on turn number and ZPD zone.
 *
 * Below-ZPD students get scaffolding earlier (hint levels escalate faster).
 * Above-ZPD students get more room to work (hint levels escalate slower).
 */
export function getEffectiveHintLevel(turnNumber: number, zone: ZpdZone): HintLevel {
  const base = turnNumber + 1;

  if (zone === 'below_zpd') {
    // Escalate faster: 1 → 2 → 3 → 4 (standard pace)
    return Math.min(MAX_HINT_LEVELS, base) as HintLevel;
  }

  if (zone === 'above_zpd') {
    // Escalate slower: 1 → 1 → 2 → 3 → 4
    const adjusted = Math.max(1, base - 1);
    return Math.min(MAX_HINT_LEVELS, adjusted) as HintLevel;
  }

  // in_zpd: standard pace
  return Math.min(MAX_HINT_LEVELS, base) as HintLevel;
}
