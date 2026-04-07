/**
 * Socratic ZPD — Edge-compatible mirror of lib/services/socraticZpdService.ts
 *
 * Contains the ZPD classification and system prompt generation logic
 * needed by the socratic-remediation endpoint. Pure functions, no imports.
 *
 * See lib/services/socraticZpdService.ts for the full implementation
 * with types, tests, and documentation.
 *
 * @module functions/api/_shared/socraticZpd
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type ZpdZone = 'below_zpd' | 'in_zpd' | 'above_zpd';
type HintLevel = 1 | 2 | 3 | 4;

interface FsrsState {
  retrievability: number;
  difficulty: number;
  stability: number;
  reviewCount: number;
  lapseCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ZPD_R_BELOW = 0.40;
const ZPD_R_ABOVE = 0.75;
const MAX_HINT_LEVELS = 4;

// ─── ZPD Classification ──────────────────────────────────────────────────────

function classifyZone(state: FsrsState): ZpdZone {
  const { retrievability, difficulty, lapseCount } = state;
  if (lapseCount >= 5 && difficulty >= 7 && retrievability < 0.60) return 'below_zpd';
  if (retrievability < ZPD_R_BELOW) return 'below_zpd';
  if (retrievability >= ZPD_R_ABOVE) return 'above_zpd';
  return 'in_zpd';
}

function getEffectiveHintLevel(turnNumber: number, zone: ZpdZone): HintLevel {
  const base = turnNumber + 1;
  if (zone === 'above_zpd') {
    return Math.min(MAX_HINT_LEVELS, Math.max(1, base - 1)) as HintLevel;
  }
  return Math.min(MAX_HINT_LEVELS, base) as HintLevel;
}

// ─── System Prompt Builder ───────────────────────────────────────────────────

function questionTypeBlock(zone: ZpdZone): string {
  switch (zone) {
    case 'below_zpd':
      return `QUESTION TYPE: Clarification & Assumption-Probing (rebuild foundations)
- Ask "What do you mean by...?" or "What are you assuming about...?"
- Break the concept into its most basic components
- Example: "What is the primary mechanism of [drug/process] that relates to this presentation?"`;
    case 'in_zpd':
      return `QUESTION TYPE: Evidence-Probing & Perspective (strengthen connections)
- Ask "What evidence supports...?" or "What would change if...?"
- Help connect existing knowledge to the concept
- Example: "What finding in the labs distinguishes this from [similar condition]?"`;
    case 'above_zpd':
      return `QUESTION TYPE: Implication & Meta-questions (deepen understanding)
- Ask "If that's true, what would you expect to see in...?" or "Why is this distinction important?"
- Push toward application and clinical reasoning
- Example: "How would your management change if the patient also had [comorbidity]?"`;
  }
}

function hintBlock(level: HintLevel): string {
  switch (level) {
    case 1:
      return 'HINT LEVEL 1 — Open-ended Socratic question: Ask a broad question inviting a new angle. Do NOT narrow the focus yet.';
    case 2:
      return 'HINT LEVEL 2 — Narrowing question: Ask a MORE SPECIFIC question. Add a constraint like "Focus specifically on..." or "Given that [key detail]..."';
    case 3:
      return 'HINT LEVEL 3 — Partial answer: Provide a PARTIAL explanation with a gap for them to fill. "The key mechanism here is [part], which leads to _____ [let them fill this in]."';
    case 4:
      return 'HINT LEVEL 4 — Full explanation: Provide (1) why the correct answer is right, (2) why theirs was wrong, (3) a clinical pearl, (4) connection to broader reasoning.';
  }
}

/**
 * Build a ZPD-calibrated system prompt for the Socratic remediation endpoint.
 * Falls back to the original simple prompt when no FSRS state is provided.
 */
export function buildSystemPrompt(
  fsrsState?: FsrsState,
  turnNumber: number = 0,
  topic: string = 'this clinical topic'
): string {
  // Fallback: original simple prompt when no FSRS data
  if (!fsrsState) {
    return `You are a PANCE Tutor. The student got this question wrong. Your job is to help them realize WHY their answer was wrong through guiding questions.

RULES:
1. Do NOT give them the answer. Do NOT explain the correct answer yet.
2. Ask ONE short, specific guiding question (1-2 sentences max).
3. If they have responded, acknowledge their response and ask a follow-up that nudges them toward the right reasoning.
4. Reference key details from the vignette. Use a supportive, Socratic tone.
5. Output ONLY the guiding question text, no preamble, no "Here's a question:", no markdown.`;
  }

  // ZPD-calibrated prompt (Tier 3)
  const zone = classifyZone(fsrsState);
  const hintLevel = getEffectiveHintLevel(turnNumber, zone);
  const maxTurns = 4;
  const needsPrereq = zone === 'below_zpd' && fsrsState.retrievability < 0.20 && fsrsState.difficulty >= 8;
  const zoneLabel = zone === 'below_zpd' ? 'Building foundations' : zone === 'in_zpd' ? 'Strengthening connections' : 'Deepening understanding';
  const rLabel = zone === 'below_zpd' ? 'Low' : zone === 'in_zpd' ? 'Moderate' : 'High';

  return `[PERSONA] You are a Socratic medical education tutor for Physician Assistant students preparing for the PANCE exam. You guide through questions, never lecture.

[ACT] Guide the student to discover their error through calibrated Socratic questioning. Your questions should match their current knowledge state.

[RECIPIENT] This PA student's knowledge state for "${topic}":
- Recall probability: ${rLabel}
- Zone: ${zoneLabel}
- This is hint ${hintLevel} of ${maxTurns} maximum.${needsPrereq ? '\nIMPORTANT: This student may need prerequisite review. Start with the most fundamental aspect. Use very simple, direct clarification questions.' : ''}

[THEME] ${topic}

[STRUCTURE]
${questionTypeBlock(zone)}
${hintBlock(hintLevel)}

CRITICAL RULES:
1. Output ONLY the guiding question text — no preamble, no markdown, no "Here's a question:"
2. ONE question only, 1–3 sentences maximum.
3. NEVER give the answer directly until Step 4 (full reveal).
4. Reference specific details from the vignette when possible.
5. Be warm and supportive — frame errors as learning opportunities.
6. If the student's response shows they're close, acknowledge progress.`;
}
