/**
 * OSCE Deterministic Structural Scorer
 *
 * Phase 2.3 — Optimization Strategy Rank #3
 *
 * Scores the structural completeness of a SOAP note or OSCE encounter
 * WITHOUT calling any AI model. Returns an instant score (< 50ms) covering:
 *
 *   1. SOAP section presence and minimum content (25 pts)
 *   2. Essential elements checklist (25 pts)
 *   3. Dangerous action safety net (penalty deductions)
 *   4. Communication markers (10 pts)
 *   5. Efficiency indicators (5 pts)
 *
 * The deterministic score is returned immediately to the client.
 * The AI reasoning score (from Gemini) is appended asynchronously.
 *
 * This splits a single ~5-8 second grading call into:
 *   - Instant structural feedback (this module) — 0ms AI cost
 *   - Async reasoning assessment (existing grade.ts) — 3-8s, only when needed
 *
 * For borderline cases (structural score between 55-70), the system
 * automatically escalates to gemini-2.5-pro for the reasoning assessment.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface StructuralScoreResult {
  /** Total structural score (0-85 scale, leaving 15 pts for AI reasoning) */
  totalScore: number;
  /** Per-section breakdown */
  sections: {
    soapPresence: SoapPresenceScore;
    essentialElements: EssentialElementsScore;
    communication: CommunicationScore;
    efficiency: EfficiencyScore;
  };
  /** Dangerous actions detected by keyword matching */
  dangerousActions: DangerousAction[];
  /** Total penalty from dangerous actions */
  dangerousPenalty: number;
  /** Whether this is a borderline case requiring frontier model escalation */
  isBorderline: boolean;
  /** Whether AI reasoning assessment is recommended */
  needsAIReasoning: boolean;
  /** Processing time in ms */
  processingTimeMs: number;
}

export interface SoapPresenceScore {
  /** Score 0-25 */
  score: number;
  /** Whether each SOAP section was detected */
  subjective: { present: boolean; wordCount: number; score: number };
  objective: { present: boolean; wordCount: number; score: number };
  assessment: { present: boolean; wordCount: number; score: number };
  plan: { present: boolean; wordCount: number; score: number };
}

export interface EssentialElementsScore {
  /** Score 0-25 */
  score: number;
  chiefComplaint: boolean;
  hpiPresent: boolean;
  pmhPresent: boolean;
  medicationsPresent: boolean;
  allergiesPresent: boolean;
  vitalSigns: boolean;
  differentialPresent: boolean;
  followUpPlan: boolean;
}

export interface CommunicationScore {
  /** Score 0-10 */
  score: number;
  openEndedQuestions: boolean;
  empathyMarkers: boolean;
  introductionPresent: boolean;
  patientEducation: boolean;
}

export interface EfficiencyScore {
  /** Score 0-5 */
  score: number;
  /** Estimated word count of the entire encounter */
  totalWords: number;
  /** Whether the encounter seems unfocused (too many tangential topics) */
  seemsUnfocused: boolean;
}

export interface DangerousAction {
  description: string;
  penalty: number;
  matchedKeywords: string[];
}

// ── SOAP Section Detection ─────────────────────────────────────────────────

const SOAP_PATTERNS = {
  subjective: [
    /\bsubjective\b/i,
    /\bchief complaint\b/i,
    /\bcc\s*:/i,
    /\bhpi\b/i,
    /\bhistory of present illness\b/i,
    /\bpatient (?:reports?|states?|complains?|presents?)\b/i,
    /\bROS\b/i,
    /\breview of systems?\b/i,
  ],
  objective: [
    /\bobjective\b/i,
    /\bphysical exam(?:ination)?\b/i,
    /\bvitals?\b/i,
    /\bvital signs?\b/i,
    /\bBP\s*[:=]?\s*\d/i,
    /\bHR\s*[:=]?\s*\d/i,
    /\btemp(?:erature)?\s*[:=]?\s*\d/i,
    /\bauscultation\b/i,
    /\bpalpation\b/i,
    /\binspection\b/i,
    /\blabs?\b/i,
    /\bimaging\b/i,
  ],
  assessment: [
    /\bassessment\b/i,
    /\bdiagnos[ie]s\b/i,
    /\bdifferential\b/i,
    /\bddx\b/i,
    /\bimpression\b/i,
    /\bmost likely\b/i,
    /\bworking diagnosis\b/i,
  ],
  plan: [
    /\bplan\b/i,
    /\btreatment\b/i,
    /\bmanagement\b/i,
    /\bprescri(?:be|ption)\b/i,
    /\bfollow[- ]?up\b/i,
    /\brefer(?:ral)?\b/i,
    /\bdischarge\b/i,
    /\breturn precautions?\b/i,
    /\bpatient education\b/i,
  ],
};

function detectSoapSections(text: string): SoapPresenceScore {
  const sections = { subjective: 0, objective: 0, assessment: 0, plan: 0 };

  // Split into rough sections if labeled
  const soapSplit = text.split(/\n(?=(?:S(?:ubjective)?|O(?:bjective)?|A(?:ssessment)?|P(?:lan)?)\s*[:.\n])/i);

  // Count pattern matches for each section
  for (const [section, patterns] of Object.entries(SOAP_PATTERNS)) {
    const matchCount = patterns.filter(p => p.test(text)).length;
    sections[section as keyof typeof sections] = matchCount;
  }

  // Word count per section (rough estimate from full text)
  const words = text.split(/\s+/).length;
  const wordsPerSection = Math.floor(words / 4);

  const buildSection = (key: keyof typeof sections) => {
    const matchCount = sections[key];
    const present = matchCount >= 1;
    // Score: 0-6.25 per section (total 25)
    // 3 pts for presence, up to 3.25 more for detail (pattern match count)
    const score = present
      ? Math.min(6.25, 3 + Math.min(3.25, matchCount * 0.75))
      : 0;
    return { present, wordCount: wordsPerSection, score: Math.round(score * 100) / 100 };
  };

  const s = buildSection('subjective');
  const o = buildSection('objective');
  const a = buildSection('assessment');
  const p = buildSection('plan');

  return {
    score: Math.round((s.score + o.score + a.score + p.score) * 100) / 100,
    subjective: s,
    objective: o,
    assessment: a,
    plan: p,
  };
}

// ── Essential Elements Detection ───────────────────────────────────────────

function detectEssentialElements(text: string): EssentialElementsScore {
  const lower = text.toLowerCase();

  const chiefComplaint = /chief complaint|cc\s*:|presents? with|complain(?:s|ing) of/i.test(text);
  const hpiPresent = /hpi|history of present|onset|duration|quality|severity|timing/i.test(text);
  const pmhPresent = /pmh|past medical|medical history|surgical history/i.test(text);
  const medicationsPresent = /medications?|meds?|current(?:ly)? (?:taking|on)|rx/i.test(text);
  const allergiesPresent = /allerg(?:y|ies)|nkda|no known (?:drug )?allerg/i.test(text);
  const vitalSigns = /vital|bp\s*[:=]|hr\s*[:=]|temp(?:erature)?\s*[:=]|rr\s*[:=]|spo2|o2 sat/i.test(text);
  const differentialPresent = /differential|ddx|rule out|r\/o|most likely|consider(?:ing)?/i.test(text);
  const followUpPlan = /follow[- ]?up|return|recheck|reassess|refer|discharge|f\/u/i.test(text);

  const checks = [
    chiefComplaint, hpiPresent, pmhPresent, medicationsPresent,
    allergiesPresent, vitalSigns, differentialPresent, followUpPlan,
  ];
  const score = checks.filter(Boolean).length * (25 / 8); // 3.125 per element

  return {
    score: Math.round(score * 100) / 100,
    chiefComplaint,
    hpiPresent,
    pmhPresent,
    medicationsPresent,
    allergiesPresent,
    vitalSigns,
    differentialPresent,
    followUpPlan,
  };
}

// ── Communication Markers ──────────────────────────────────────────────────

function detectCommunicationMarkers(text: string): CommunicationScore {
  const openEndedQuestions = /tell me (?:about|more)|how (?:are you|do you feel|long)|what brings you|can you describe|walk me through/i.test(text);
  const empathyMarkers = /i understand|that must be|i'm sorry|sounds (?:like|difficult)|must be (?:hard|scary|frustrating)|i hear you/i.test(text);
  const introductionPresent = /(?:i'm|i am|my name is)\s+(?:dr\.|doctor|student|[A-Z])/i.test(text);
  const patientEducation = /patient education|let me explain|what this means|important (?:to|that) you|avoid|lifestyle|diet|exercise|signs? to watch/i.test(text);

  let score = 0;
  if (openEndedQuestions) score += 3;
  if (empathyMarkers) score += 3;
  if (introductionPresent) score += 2;
  if (patientEducation) score += 2;

  return {
    score,
    openEndedQuestions,
    empathyMarkers,
    introductionPresent,
    patientEducation,
  };
}

// ── Efficiency Assessment ──────────────────────────────────────────────────

function assessEfficiency(text: string): EfficiencyScore {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  // A focused encounter is typically 200-800 words
  // Very short (< 100) suggests incomplete; very long (> 1500) suggests unfocused
  const seemsUnfocused = totalWords > 1500;

  let score = 5; // Start at full marks
  if (totalWords < 100) score = 1; // Very incomplete
  else if (totalWords < 200) score = 3; // Minimal
  else if (seemsUnfocused) score = 2; // Too long/unfocused

  return { score, totalWords, seemsUnfocused };
}

// ── Dangerous Action Detection ─────────────────────────────────────────────
// (Matches the same safety net in grade.ts but runs deterministically)

const DANGEROUS_ACTIONS: Record<string, Array<{ keywords: string[]; description: string; penalty: number }>> = {
  'acute coronary syndrome': [
    { keywords: ['beta-blocker', 'metoprolol', 'atenolol', 'decompensated'], description: 'Beta-blocker in decompensated heart failure', penalty: 15 },
    { keywords: ['missed aspirin', 'no aspirin', 'without aspirin'], description: 'Missed aspirin administration', penalty: 15 },
  ],
  'stroke': [
    { keywords: ['tpa', 'alteplase', 'late', '4.5 hour', 'window'], description: 'tPA outside treatment window', penalty: 20 },
    { keywords: ['no glucose', 'skip glucose', 'without glucose'], description: 'Failed glucose check', penalty: 15 },
  ],
  'diabetic ketoacidosis': [
    { keywords: ['insulin before potassium', 'without potassium', 'hypokalemia'], description: 'Insulin before verifying potassium', penalty: 20 },
    { keywords: ['bicarbonate', 'bicarb', 'nahco3'], description: 'Inappropriate bicarbonate in DKA', penalty: 10 },
  ],
  'sepsis': [
    { keywords: ['delay antibiotic', 'hold antibiotics'], description: 'Delayed antibiotics in sepsis', penalty: 15 },
    { keywords: ['no cultures', 'skip cultures', 'without cultures'], description: 'Antibiotics without cultures', penalty: 10 },
  ],
  'asthma': [
    { keywords: ['sedative', 'benzodiazepine', 'morphine'], description: 'Sedative in acute asthma', penalty: 15 },
    { keywords: ['beta-blocker', 'propranolol'], description: 'Beta-blocker in acute asthma', penalty: 15 },
  ],
  'pulmonary embolism': [
    { keywords: ['no anticoag', 'skip heparin', 'without anticoag'], description: 'Missed anticoagulation in PE', penalty: 20 },
  ],
};

function detectDangerousActionsStructural(
  diagnosis: string,
  text: string
): DangerousAction[] {
  const diagLower = diagnosis.toLowerCase();
  const textLower = text.toLowerCase();
  const detected: DangerousAction[] = [];

  for (const [condition, actions] of Object.entries(DANGEROUS_ACTIONS)) {
    if (!diagLower.includes(condition)) continue;
    for (const action of actions) {
      const matched = action.keywords.filter(kw => textLower.includes(kw));
      if (matched.length >= 1) {
        detected.push({
          description: action.description,
          penalty: action.penalty,
          matchedKeywords: matched,
        });
      }
    }
  }

  return detected;
}

// ── Main Scoring Function ──────────────────────────────────────────────────

/**
 * Score an OSCE encounter or SOAP note deterministically.
 *
 * Returns immediately (< 50ms) with structural completeness assessment.
 * No AI model calls — purely regex/keyword pattern matching.
 *
 * @param text - Full encounter transcript or SOAP note text
 * @param diagnosis - The correct diagnosis for this case (for safety net)
 * @returns Structural score with detailed breakdown
 */
export function scoreStructural(
  text: string,
  diagnosis: string
): StructuralScoreResult {
  const start = performance.now();

  // Flatten transcript if it's a message array
  const flatText = typeof text === 'string' ? text : JSON.stringify(text);

  // Score each component
  const soapPresence = detectSoapSections(flatText);
  const essentialElements = detectEssentialElements(flatText);
  const communication = detectCommunicationMarkers(flatText);
  const efficiency = assessEfficiency(flatText);

  // Detect dangerous actions
  const dangerousActions = detectDangerousActionsStructural(diagnosis, flatText);
  const dangerousPenalty = dangerousActions.reduce((sum, a) => sum + a.penalty, 0);

  // Compute total (max 65 from structural components, capped)
  const rawTotal =
    soapPresence.score +
    essentialElements.score +
    communication.score +
    efficiency.score;
  const totalScore = Math.max(0, Math.round((rawTotal - dangerousPenalty) * 100) / 100);

  // Borderline detection: scores between 35-50 (out of 65) need careful AI review
  const isBorderline = totalScore >= 35 && totalScore <= 50;

  // AI reasoning is always recommended unless the structural score clearly passes or fails
  const needsAIReasoning = totalScore >= 20; // Don't waste AI on clearly failing encounters

  const processingTimeMs = Math.round((performance.now() - start) * 100) / 100;

  return {
    totalScore,
    sections: {
      soapPresence,
      essentialElements,
      communication,
      efficiency,
    },
    dangerousActions,
    dangerousPenalty,
    isBorderline,
    needsAIReasoning,
    processingTimeMs,
  };
}

/**
 * Convert structural score to a normalized 0-100 scale.
 * The structural scorer covers ~65% of the total grade;
 * the AI reasoning scorer covers the remaining ~35%.
 *
 * Final score = (structuralScore / 65 * 65) + (aiReasoningScore / 100 * 35)
 */
export function combineScores(
  structuralScore: number,
  aiReasoningScore: number
): number {
  const structuralNormalized = Math.min(65, structuralScore); // Cap at 65
  const aiNormalized = (aiReasoningScore / 100) * 35;
  return Math.round(structuralNormalized + aiNormalized);
}
