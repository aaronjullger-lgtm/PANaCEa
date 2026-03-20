/**
 * Implicit FSRS Rating Mapping
 *
 * Single entry point: `deriveFsrsRatingFromBehavior` — for PANCE-style MCQ questions.
 * Uses the full behavioral-signal pipeline (deriveContinuousRating +
 * Ghost Grader applyHonestRating) to produce a 1–4 rating from
 * time-to-first-click, answer switches, cursor entropy, oscillations, etc.
 * Matches the server-side computation so the sync-queue estimate is accurate.
 * No self-rating buttons are ever shown — all scheduling is fully implicit.
 */

import { deriveContinuousRating, type ImplicitBehaviorMetrics } from '../implicit-metrics';
import { applyHonestRating } from '../srs/ghostGrader';

export type FsrsRating = 1 | 2 | 3 | 4;

/**
 * Behavioral signals captured during a PANCE-style MCQ interaction.
 * Maps 1-to-1 with what `BehavioralTrackerProvider` and `useMicroKinetics`
 * produce at submission time in `QuizView`.
 */
export interface PanceQuestionBehavior {
  isCorrect: boolean;
  /** Time from question display to first answer hover/click (ms). null when not captured. */
  timeToFirstClickMs: number | null;
  /** Total time on the question screen before submission (ms). */
  totalDwellTimeMs: number;
  /** Par (expected) time for this question's complexity (ms). */
  parTimeMs: number;
  /** Number of answer-selection changes before submitting. */
  answerSwitches: number;
  /** Cursor path entropy — pathLength / idealDistance; >1 = meandering. */
  cursorEntropy?: number;
  /** Hover oscillation count: A→B→A revisits indicating indecision. */
  hoverOscillations?: number;
  /** Scroll regressions over the vignette after the answer is revealed. */
  vignetteRegressions?: number;
  /**
   * Time from final answer selection to Submit click (ms).
   * Used for both the latency commitment-gap penalty and the Ghost Grader
   * selection-drift check — they measure the same thing.
   */
  selectionDriftMs?: number | null;
  /** Mouse tremor score 0-1; high values indicate cognitive load/frustration. */
  tremorScore?: number;
}

/**
 * Derive FSRS rating (1–4) from PANCE question behavioral signals.
 *
 * Pipeline (mirrors server-side drillReviewService):
 *   deriveContinuousRating → Ghost Grader applyHonestRating
 *
 * No self-rating buttons are shown; the rating is fully implicit.
 */
export function deriveFsrsRatingFromBehavior(behavior: PanceQuestionBehavior): FsrsRating {
  // When first-click time is not captured, substitute a neutral value at 85 % of
  // par time — the same fallback used by drillReviewService.ts — to avoid
  // inflating the latency ratio with the full dwell time (which includes
  // rationale-reading after answer reveal).
  const effectiveFirstClick =
    behavior.timeToFirstClickMs !== null && behavior.timeToFirstClickMs !== undefined
      ? behavior.timeToFirstClickMs
      : Math.min(behavior.totalDwellTimeMs, behavior.parTimeMs * 0.85);

  const metrics: ImplicitBehaviorMetrics = {
    isCorrect: behavior.isCorrect,
    timeToFirstClick: effectiveFirstClick,
    answerSwitches: behavior.answerSwitches,
    totalDwellTime: behavior.totalDwellTimeMs,
    parTimeMs: behavior.parTimeMs,
    // selectionDriftMs doubles as the commitment-gap signal
    commitmentGapMs: behavior.selectionDriftMs,
    cursorEntropy: behavior.cursorEntropy,
    hoverOscillationCount: behavior.hoverOscillations,
  };

  const { discreteRating } = deriveContinuousRating(metrics);

  const honestRating = applyHonestRating({
    userRating: discreteRating,
    isCorrect: behavior.isCorrect,
    oscillations: behavior.hoverOscillations,
    vignetteRegressions: behavior.vignetteRegressions,
    selectionDriftMs: behavior.selectionDriftMs,
    tremorScore: behavior.tremorScore,
  });

  return honestRating as FsrsRating;
}
