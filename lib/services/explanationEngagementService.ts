/**
 * Explanation Engagement Depth Service (Wave 3A)
 *
 * Measures how deeply the learner engages with the explanation panel after answering:
 * dwell time, scroll depth, expanded "Why not X?" sections.
 *
 * Key signals:
 * - After errors: deep engagement → better error correction → stability bonus (1.08)
 * - After errors: minimal engagement → didn't learn from mistake → stability penalty (0.95)
 * - After correct: long dwell + high scroll → surprise/lucky guess → confidence penalty (0.95)
 *
 * Integration: Apply confidenceModifier to implicitConfidence; apply stabilityModifier to modifiedStability.
 * Only activates when telemetry.explanation_engagement is present (backward compatible).
 *
 * @see plans/behavioral-signals-implementation-plan.md — Feature 3A
 */

// ── Types ──

export interface ExplanationEngagementResult {
  /** Composite engagement score (0.0–1.0) */
  engagementScore: number;
  /** Confidence modifier: post-correct surprise detection */
  confidenceModifier: number;
  /** Stability modifier: post-error learning depth */
  stabilityModifier: number;
}

// ── Constants ──

/** Dwell time scale factor for log-scaled signal (ms) */
const DWELL_SCALE_MS = 5000;

/** Minimum scroll depth assumed even without scrolling (some content always visible) */
const BASE_SCROLL_DEPTH = 0.3;

/** Weight of each expanded section toward engagement */
const SECTION_EXPAND_WEIGHT = 0.15;

/** Engagement threshold for post-error learning reward */
const DEEP_ENGAGEMENT_THRESHOLD = 0.6;

/** Engagement threshold for "didn't learn" penalty (must also have viewed > 1s) */
const SHALLOW_ENGAGEMENT_THRESHOLD = 0.2;

/** Minimum dwell to consider shallow engagement meaningful (not just a misclick) */
const MIN_MEANINGFUL_DWELL_MS = 1000;

/** Post-error deep engagement stability bonus */
const POST_ERROR_DEEP_BONUS = 1.08;

/** Post-error shallow engagement stability penalty */
const POST_ERROR_SHALLOW_PENALTY = 0.95;

/** Post-correct surprise dwell threshold (ms) — long dwell after correct = unsure */
const SURPRISE_DWELL_THRESHOLD_MS = 15000;

/** Post-correct surprise scroll threshold */
const SURPRISE_SCROLL_THRESHOLD = 0.5;

/** Post-correct surprise confidence penalty */
const SURPRISE_CONFIDENCE_PENALTY = 0.95;

// ── Main function ──

/**
 * Analyze explanation engagement to derive confidence and stability modifiers.
 *
 * @param viewedMs - Time spent on the explanation panel (ms)
 * @param scrollDepth - Maximum scroll depth reached (0.0–1.0)
 * @param expandedSections - Number of collapsible "Why not X?" sections expanded
 * @param wasCorrect - Whether the learner answered correctly
 * @returns Engagement analysis with confidence and stability modifiers
 */
export function analyzeExplanationEngagement(
  viewedMs: number,
  scrollDepth: number,
  expandedSections: number,
  wasCorrect: boolean
): ExplanationEngagementResult {
  // Engagement score: log-scaled dwell × (scroll depth + section expansion)
  const dwellSignal = Math.min(1, Math.log(1 + viewedMs / DWELL_SCALE_MS));
  const depthSignal = Math.max(scrollDepth, BASE_SCROLL_DEPTH + expandedSections * SECTION_EXPAND_WEIGHT);
  const engagementScore = dwellSignal * Math.min(1, depthSignal);

  let confidenceModifier = 1.0;
  let stabilityModifier = 1.0;

  if (!wasCorrect) {
    // After errors: deep engagement = better error correction
    if (engagementScore > DEEP_ENGAGEMENT_THRESHOLD) {
      stabilityModifier = POST_ERROR_DEEP_BONUS;
    } else if (engagementScore < SHALLOW_ENGAGEMENT_THRESHOLD && viewedMs > MIN_MEANINGFUL_DWELL_MS) {
      // Minimal engagement with explanation after error — didn't learn from mistake
      stabilityModifier = POST_ERROR_SHALLOW_PENALTY;
    }
  } else {
    // After correct: long dwell + deep scroll suggests surprise (lucky guess?)
    if (viewedMs > SURPRISE_DWELL_THRESHOLD_MS && scrollDepth > SURPRISE_SCROLL_THRESHOLD) {
      confidenceModifier = SURPRISE_CONFIDENCE_PENALTY;
    }
  }

  return {
    engagementScore: Math.round(engagementScore * 1000) / 1000,
    confidenceModifier: Math.round(confidenceModifier * 1000) / 1000,
    stabilityModifier: Math.round(stabilityModifier * 1000) / 1000,
  };
}
