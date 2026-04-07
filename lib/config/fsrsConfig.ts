/**
 * FSRS Retention Configuration
 *
 * Controls the desired retention targets used when instantiating the FSRS
 * scheduler for TARGETED sessions. Two modes exist:
 *
 * - defaultDesiredRetention: used during normal study (no upcoming exam or
 *   exam is more than `examApproachWindowDays` days away).
 * - examApproachRetention: tighter retention target applied when the user's
 *   exam date falls within `examApproachWindowDays`. Produces shorter review
 *   intervals to maximize recall density near exam time.
 *
 * Only TARGETED sessions use these values; MAIN, DRILL, CRAM, and RAPID_RECALL
 * sessions are unaffected.
 */
export const FSRS_RETENTION_CONFIG = {
  /** Default FSRS request_retention for TARGETED sessions (no exam pressure). */
  defaultDesiredRetention: 0.85,

  /** Tighter retention target applied when exam is within the approach window. */
  examApproachRetention: 0.88,

  /** Days before exam where exam-approach mode activates. */
  examApproachWindowDays: 28,
} as const;
