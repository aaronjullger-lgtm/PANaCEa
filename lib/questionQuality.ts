/**
 * Question Quality Scoring (Sprint 9)
 *
 * Scoring factors per docs/QUESTION_GENERATION_IMPROVEMENT_PLAN.md Step 9:
 * - Clinical vignette present: +10
 * - Explanation length adequate: +10
 * - Valid conditionId: +15
 * - Accuracy in 30–80% range: +10
 * - High flag rate (>0.1): -20
 *
 * Total possible: 55 (base) + 10 (vignette) + 10 (explanation) + 15 (conditionId) + 10 (accuracy) - 20 (flag) = 70+ before penalty.
 * Score is clamped to 0–100.
 */

export interface PreGeneratedQuestionLike {
  id: string;
  conditionId?: string | null;
  questionData: {
    vignette?: string;
    question?: string;
    options?: string[];
    correctAnswer?: string;
    correctAnswerIndex?: number;
    rationale?: string | Record<string, unknown>;
    explanation?: string;
    [key: string]: unknown;
  };
  conditionAccuracy?: number | null;
  flagRate?: number | null;
}

const MIN_EXPLANATION_WORDS = 30;
const ACCURACY_MIN = 0.3;
const ACCURACY_MAX = 0.8;
const FLAG_RATE_PENALTY_THRESHOLD = 0.1;
const FLAG_RATE_PENALTY = 20;

/**
 * Score a question for quality (0–100).
 * Uses questionData, conditionId, conditionAccuracy, and flagRate when available.
 */
export function scoreQuestion(question: PreGeneratedQuestionLike): number {
  let score = 0;

  const data = question.questionData ?? {};
  const vignette = data.vignette ?? '';
  const explanation =
    typeof data.rationale === 'string'
      ? data.rationale
      : typeof data.explanation === 'string'
        ? data.explanation
        : typeof data.rationale === 'object' && data.rationale !== null && 'whyCorrect' in data.rationale
          ? String((data.rationale as { whyCorrect?: string }).whyCorrect ?? '')
          : '';

  // Clinical vignette present: +10
  if (vignette && vignette.trim().length >= 20) {
    score += 10;
  }

  // Explanation length adequate: +10 (≥30 words)
  const wordCount = explanation.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount >= MIN_EXPLANATION_WORDS) {
    score += 10;
  }

  // Valid conditionId: +15 (non-empty and looks like a real id, e.g. contains __ or is cuid)
  const cid = question.conditionId;
  if (cid && typeof cid === 'string' && cid.trim().length > 0) {
    if (cid.includes('__') || cid.length >= 10) {
      score += 15;
    } else {
      score += 5; // partial: has some id
    }
  }

  // Accuracy in 30–80%: +10 (discriminative but not trivial)
  const acc = question.conditionAccuracy;
  if (typeof acc === 'number' && acc >= ACCURACY_MIN && acc <= ACCURACY_MAX) {
    score += 10;
  }

  // High flag rate: -20 if > 0.1
  const flagRate = question.flagRate;
  if (typeof flagRate === 'number' && flagRate > FLAG_RATE_PENALTY_THRESHOLD) {
    score -= FLAG_RATE_PENALTY;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Whether the question passes the quality gate (e.g. for promotion).
 * Default threshold 70.
 */
export function passesQualityGate(question: PreGeneratedQuestionLike, threshold: number = 70): boolean {
  return scoreQuestion(question) >= threshold;
}
