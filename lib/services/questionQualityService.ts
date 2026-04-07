/**
 * Question Quality Service — Phase 3 (Behavioral Analysis Audit)
 *
 * Separates question pedagogical quality from student performance signals.
 * Implements the audit's 4-component quality formula:
 *
 *   Q = 0.40 * DifficultyAlignment
 *     + 0.25 * DiscriminationIndex
 *     + 0.20 * DistractorEffectiveness
 *     + 0.15 * ClinicalRelevance
 *
 * Auto-approve ONLY when ALL four components >= 0.85 (not just composite >= 0.90).
 *
 * This is distinct from the student-facing performance score
 * (accuracy, flags, attempts) which lives in the performance endpoint.
 *
 * @see PANaCEa_Behavioral_Analysis_Audit.md § Gap 5
 * @module lib/services/questionQualityService
 */

// ============================================================================
// Types
// ============================================================================

/** The four independent quality components from the audit. */
export interface QualityComponents {
  /** How well the question's empirical difficulty matches its intended difficulty tier.
   *  1.0 = perfectly aligned; 0.0 = maximally misaligned.
   *  Computed from |targetDifficulty - empiricalDifficulty|. */
  difficultyAlignment: number;

  /** Item discrimination index: correlation between getting this question right
   *  and overall test performance. Approximated via top/bottom tertile accuracy delta.
   *  Range: [-1, 1] but clamped to [0, 1] for scoring (negative = anti-discriminating). */
  discriminationIndex: number;

  /** How well distractors attract incorrect answers. A question where all incorrect
   *  responses cluster on one distractor scores lower than one with even distribution.
   *  Also penalizes distractors never selected. Range: [0, 1]. */
  distractorEffectiveness: number;

  /** Clinical relevance to PANCE/PANRE blueprint. Based on structural signals:
   *  has vignette, mapped to condition, mapped to organ system, adequate explanation.
   *  Range: [0, 1]. */
  clinicalRelevance: number;
}

/** Result of the composite quality assessment. */
export interface QualityAssessmentResult {
  /** Weighted composite score on [0, 1]. */
  compositeScore: number;

  /** Individual component scores. */
  components: QualityComponents;

  /** Whether ALL four components meet the auto-approve threshold. */
  allComponentsPass: boolean;

  /** Recommended validation status based on the quality gate. */
  recommendedStatus: 'approved' | 'pending' | 'needs_revision' | 'rejected';

  /** Human-readable reasons for the status. */
  reasons: string[];
}

/** Input data needed to compute quality components.
 *  Some fields are optional — the service degrades gracefully when data is missing. */
export interface QualityInput {
  // --- Difficulty Alignment ---
  /** Target difficulty tier (0-1 scale, e.g., 0.3 = easy, 0.7 = hard). Null if unspecified. */
  targetDifficulty?: number | null;
  /** Empirical difficulty = 1 - (correctAttempts / totalAttempts). Null if < MIN_ATTEMPTS. */
  empiricalDifficulty?: number | null;

  // --- Discrimination Index ---
  /** Accuracy among top-performing tertile of students. */
  topTertileAccuracy?: number | null;
  /** Accuracy among bottom-performing tertile of students. */
  bottomTertileAccuracy?: number | null;

  // --- Distractor Effectiveness ---
  /** Selection counts per option, keyed by option label (e.g., {A: 10, B: 25, C: 40, D: 15, E: 10}).
   *  Includes the correct answer. */
  optionSelectionCounts?: Record<string, number> | null;
  /** The label of the correct answer (e.g., 'C'). */
  correctOptionLabel?: string | null;
  /** Total number of answer options. */
  totalOptions?: number | null;

  // --- Clinical Relevance ---
  /** Whether the question includes a clinical vignette. */
  hasVignette?: boolean;
  /** Whether the question is mapped to a specific condition. */
  hasMappedCondition?: boolean;
  /** Whether the question is mapped to an organ system. */
  hasMappedSystem?: boolean;
  /** Word count of the explanation/rationale. */
  explanationWordCount?: number | null;
  /** Whether the question has grounding sources (evidence-backed). */
  hasGroundingSources?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Weights for each component in the composite score. Sum = 1.0. */
export const QUALITY_WEIGHTS = {
  difficultyAlignment: 0.40,
  discriminationIndex: 0.25,
  distractorEffectiveness: 0.20,
  clinicalRelevance: 0.15,
} as const;

/** Per-component threshold: ALL must be >= this for auto-approve. */
export const COMPONENT_APPROVE_THRESHOLD = 0.85;

/** Composite threshold for auto-rejection. */
export const COMPOSITE_REJECT_THRESHOLD = 0.40;

/** Minimum attempts before difficulty/discrimination can be computed reliably. */
export const MIN_ATTEMPTS_FOR_STATS = 10;

/** Default score when data is insufficient to compute a component. */
export const INSUFFICIENT_DATA_DEFAULT = 0.50;

/** Minimum explanation word count for full clinical relevance credit. */
export const MIN_EXPLANATION_WORDS = 50;

// ============================================================================
// Component Scoring Functions
// ============================================================================

/**
 * Compute DifficultyAlignment score.
 *
 * Measures how well the question's actual difficulty matches what was intended.
 * Perfect alignment (|target - empirical| = 0) → 1.0
 * Maximum misalignment (|target - empirical| = 1) → 0.0
 *
 * If either target or empirical is unavailable, returns INSUFFICIENT_DATA_DEFAULT.
 */
export function scoreDifficultyAlignment(
  targetDifficulty?: number | null,
  empiricalDifficulty?: number | null
): { score: number; reason: string } {
  if (targetDifficulty == null || empiricalDifficulty == null) {
    return {
      score: INSUFFICIENT_DATA_DEFAULT,
      reason: 'Insufficient data for difficulty alignment (need target + empirical difficulty)',
    };
  }

  const deviation = Math.abs(targetDifficulty - empiricalDifficulty);
  // Linear mapping: 0 deviation → 1.0, 1.0 deviation → 0.0
  const score = Math.max(0, 1.0 - deviation);

  const reason =
    deviation <= 0.15
      ? `Difficulty well-aligned (deviation ${(deviation * 100).toFixed(1)}%)`
      : `Difficulty misaligned by ${(deviation * 100).toFixed(1)}% (target=${(targetDifficulty * 100).toFixed(0)}%, actual=${(empiricalDifficulty * 100).toFixed(0)}%)`;

  return { score, reason };
}

/**
 * Compute DiscriminationIndex score.
 *
 * Classical item discrimination: topTertileAccuracy - bottomTertileAccuracy.
 * High discrimination (> 0.3) means the question separates strong from weak students.
 * Anti-discriminating questions (negative index) get clamped to 0.
 *
 * Maps the raw index [0, 0.7] → score [0, 1] (0.7+ is excellent discrimination).
 */
export function scoreDiscriminationIndex(
  topTertileAccuracy?: number | null,
  bottomTertileAccuracy?: number | null
): { score: number; reason: string } {
  if (topTertileAccuracy == null || bottomTertileAccuracy == null) {
    return {
      score: INSUFFICIENT_DATA_DEFAULT,
      reason: 'Insufficient data for discrimination index (need tertile accuracy data)',
    };
  }

  const rawIndex = topTertileAccuracy - bottomTertileAccuracy;

  if (rawIndex < 0) {
    return {
      score: 0,
      reason: `Anti-discriminating: bottom tertile outperforms top (index=${rawIndex.toFixed(2)})`,
    };
  }

  // Map [0, 0.7] → [0, 1.0], capping at 1.0
  const score = Math.min(1.0, rawIndex / 0.7);

  const reason =
    rawIndex >= 0.3
      ? `Good discrimination (index=${rawIndex.toFixed(2)})`
      : `Weak discrimination (index=${rawIndex.toFixed(2)}, target >= 0.30)`;

  return { score, reason };
}

/**
 * Compute DistractorEffectiveness score.
 *
 * A good question has distractors that each attract some incorrect responses.
 * - Penalizes unused distractors (never selected)
 * - Penalizes uneven distribution (one distractor absorbs all wrong answers)
 * - Uses normalized entropy of distractor selection distribution
 *
 * If selection count data is unavailable, falls back to structural heuristics.
 */
export function scoreDistractorEffectiveness(
  optionSelectionCounts?: Record<string, number> | null,
  correctOptionLabel?: string | null,
  totalOptions?: number | null
): { score: number; reason: string } {
  if (!optionSelectionCounts || !correctOptionLabel) {
    // Structural fallback: penalize if too few options
    const numOptions = totalOptions ?? 5;
    if (numOptions < 4) {
      return { score: 0.4, reason: 'Fewer than 4 options — distractor pool too small' };
    }
    return {
      score: INSUFFICIENT_DATA_DEFAULT,
      reason: 'No distractor selection data available',
    };
  }

  // Extract distractor counts (exclude correct answer)
  const distractorLabels = Object.keys(optionSelectionCounts).filter(
    (label) => label !== correctOptionLabel
  );
  const distractorCounts = distractorLabels.map(
    (label) => optionSelectionCounts[label] ?? 0
  );

  if (distractorLabels.length === 0) {
    return { score: 0, reason: 'No distractors found' };
  }

  const totalDistractorSelections = distractorCounts.reduce((a, b) => a + b, 0);

  if (totalDistractorSelections === 0) {
    return { score: 0.3, reason: 'No incorrect selections recorded yet' };
  }

  // Penalize unused distractors
  const unusedCount = distractorCounts.filter((c) => c === 0).length;
  const unusedPenalty = unusedCount / distractorLabels.length;

  // Compute normalized entropy of distractor distribution
  const probs = distractorCounts.map((c) => c / totalDistractorSelections);
  const maxEntropy = Math.log2(distractorLabels.length);

  let entropy = 0;
  for (const p of probs) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  // Combine: 60% entropy (distribution), 40% usage (all distractors selected)
  const score = Math.max(0, Math.min(1, 0.6 * normalizedEntropy + 0.4 * (1 - unusedPenalty)));

  const reasons: string[] = [];
  if (unusedCount > 0) {
    reasons.push(`${unusedCount} distractor(s) never selected`);
  }
  if (normalizedEntropy < 0.6) {
    reasons.push('Distractor selections heavily skewed');
  }

  return {
    score,
    reason: reasons.length > 0 ? reasons.join('; ') : 'Distractors working well',
  };
}

/**
 * Compute ClinicalRelevance score.
 *
 * Structural assessment of how clinically relevant and well-constructed
 * the question is for PANCE preparation. Checks:
 * - Has clinical vignette (essential for PANCE-style)
 * - Mapped to condition and organ system
 * - Adequate explanation
 * - Evidence-backed (grounding sources)
 */
export function scoreClinicalRelevance(input: {
  hasVignette?: boolean;
  hasMappedCondition?: boolean;
  hasMappedSystem?: boolean;
  explanationWordCount?: number | null;
  hasGroundingSources?: boolean;
}): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Vignette: 30% weight (most important for PANCE)
  if (input.hasVignette) {
    score += 0.30;
  } else {
    reasons.push('Missing clinical vignette');
  }

  // Condition mapping: 20% weight
  if (input.hasMappedCondition) {
    score += 0.20;
  } else {
    reasons.push('Not mapped to a specific condition');
  }

  // System mapping: 15% weight
  if (input.hasMappedSystem) {
    score += 0.15;
  } else {
    reasons.push('Not mapped to an organ system');
  }

  // Explanation quality: 25% weight (scaled by word count)
  const wordCount = input.explanationWordCount ?? 0;
  if (wordCount >= MIN_EXPLANATION_WORDS) {
    score += 0.25;
  } else if (wordCount > 0) {
    score += 0.25 * (wordCount / MIN_EXPLANATION_WORDS);
    reasons.push(`Short explanation (${wordCount}/${MIN_EXPLANATION_WORDS} words)`);
  } else {
    reasons.push('Missing explanation');
  }

  // Evidence-backed: 10% weight
  if (input.hasGroundingSources) {
    score += 0.10;
  } else {
    reasons.push('No grounding sources');
  }

  return {
    score: Math.min(1, score),
    reason: reasons.length > 0 ? reasons.join('; ') : 'Clinically relevant and well-structured',
  };
}

// ============================================================================
// Composite Assessment
// ============================================================================

/**
 * Compute the full 4-component quality assessment for a question.
 *
 * This is the audit's recommended replacement for the conflated qualityScore.
 * Student performance signals (accuracy, flagCount, totalAttempts) are NOT
 * inputs here — those belong in the performance analytics endpoint.
 */
export function assessQuestionQuality(input: QualityInput): QualityAssessmentResult {
  const reasons: string[] = [];

  // Score each component
  const da = scoreDifficultyAlignment(input.targetDifficulty, input.empiricalDifficulty);
  const di = scoreDiscriminationIndex(input.topTertileAccuracy, input.bottomTertileAccuracy);
  const de = scoreDistractorEffectiveness(
    input.optionSelectionCounts,
    input.correctOptionLabel,
    input.totalOptions
  );
  const cr = scoreClinicalRelevance({
    hasVignette: input.hasVignette,
    hasMappedCondition: input.hasMappedCondition,
    hasMappedSystem: input.hasMappedSystem,
    explanationWordCount: input.explanationWordCount,
    hasGroundingSources: input.hasGroundingSources,
  });

  const components: QualityComponents = {
    difficultyAlignment: da.score,
    discriminationIndex: di.score,
    distractorEffectiveness: de.score,
    clinicalRelevance: cr.score,
  };

  // Weighted composite
  const compositeScore =
    QUALITY_WEIGHTS.difficultyAlignment * components.difficultyAlignment +
    QUALITY_WEIGHTS.discriminationIndex * components.discriminationIndex +
    QUALITY_WEIGHTS.distractorEffectiveness * components.distractorEffectiveness +
    QUALITY_WEIGHTS.clinicalRelevance * components.clinicalRelevance;

  // Check all-components gate
  const allComponentsPass =
    components.difficultyAlignment >= COMPONENT_APPROVE_THRESHOLD &&
    components.discriminationIndex >= COMPONENT_APPROVE_THRESHOLD &&
    components.distractorEffectiveness >= COMPONENT_APPROVE_THRESHOLD &&
    components.clinicalRelevance >= COMPONENT_APPROVE_THRESHOLD;

  // Collect component-level reasons
  if (da.score < COMPONENT_APPROVE_THRESHOLD) reasons.push(`DifficultyAlignment: ${da.reason}`);
  if (di.score < COMPONENT_APPROVE_THRESHOLD) reasons.push(`DiscriminationIndex: ${di.reason}`);
  if (de.score < COMPONENT_APPROVE_THRESHOLD)
    reasons.push(`DistractorEffectiveness: ${de.reason}`);
  if (cr.score < COMPONENT_APPROVE_THRESHOLD) reasons.push(`ClinicalRelevance: ${cr.reason}`);

  // Determine recommended status
  let recommendedStatus: QualityAssessmentResult['recommendedStatus'];

  if (allComponentsPass && compositeScore >= 0.90) {
    recommendedStatus = 'approved';
  } else if (compositeScore < COMPOSITE_REJECT_THRESHOLD) {
    recommendedStatus = 'rejected';
    reasons.push(`Composite score ${(compositeScore * 100).toFixed(1)}% below rejection threshold`);
  } else if (!allComponentsPass) {
    recommendedStatus = 'pending';
    reasons.push('Not all components meet auto-approve threshold (0.85)');
  } else {
    recommendedStatus = 'pending';
  }

  return {
    compositeScore,
    components,
    allComponentsPass,
    recommendedStatus,
    reasons,
  };
}

// ============================================================================
// Performance Score (Separated Concern)
// ============================================================================

/**
 * Compute a student-facing performance score for a question.
 *
 * This is DISTINCT from pedagogical quality. It reflects how students
 * are performing on this question, useful for analytics but NOT for
 * question approval decisions.
 *
 * Renamed from the old conflated `calculateQualityScore()` in performance.ts.
 */
export function calculatePerformanceScore(
  accuracy: number,
  flagCount: number,
  totalAttempts: number
): number {
  let score = accuracy;

  // Flag penalty: each flag costs 10 points, max 30
  const flagPenalty = Math.min(flagCount * 10, 30);
  score -= flagPenalty;

  // Confidence boost: more attempts = more reliable metric
  const confidenceBoost = Math.min(totalAttempts / 5, 10);
  score += confidenceBoost;

  return Math.max(0, Math.min(100, Math.round(score)));
}
