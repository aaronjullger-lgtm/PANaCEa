/**
 * Centralized UX Copy Constants
 *
 * Maintains a consistent "Encouraging Professional" voice throughout the app.
 * Reframes negative language into growth-oriented alternatives while keeping
 * the clinical tone appropriate for PA education.
 *
 * Usage: Import specific constants rather than the whole file.
 *
 * @see plans/SPRINT_PLANS.md — Feature 12: UX Copy Refinements
 */

// ─── Reframed Labels ────────────────────────────────────────────────

/** Previously "Missed Questions" — reframed for growth mindset */
export const LABEL_LEARNING_OPPORTUNITIES = 'Learning Opportunities';

/** Previously "Weakness" / "Weak Areas" — reframed as actionable */
export const LABEL_FOCUS_AREAS = 'Focus Areas';

/** Previously "Clear Data" — clearer intent */
export const LABEL_RESET_STUDY_DATA = 'Reset Study Data';

/** Previously "0%" for unassessed systems — less discouraging */
export const LABEL_NOT_YET_ASSESSED = 'Not yet assessed';

/** Previously "Weak Area" badge text */
export const LABEL_NEEDS_REVIEW = 'Needs Review';

/** Previously "Weakness Cheatsheet Export" */
export const LABEL_FOCUS_AREAS_EXPORT = 'Focus Areas Export';

// ─── Encouraging Phrases ────────────────────────────────────────────

/** Shown when a student gets a question wrong */
export const PHRASE_LEARNING_MOMENT = 'Every miss is a learning moment.';

/** Shown when student has 0 cards in a system */
export const PHRASE_START_EXPLORING = 'Start exploring this system';

/** Shown on empty states */
export const PHRASE_EMPTY_PROGRESS = "You haven't studied this area yet — that's okay, everyone starts somewhere.";

/** Shown when streak is broken */
export const PHRASE_STREAK_RESTART = 'Fresh start! Your knowledge is still there.';

// ─── AI Score Tooltips ──────────────────────────────────────────────

/** Tooltip for implicit confidence scores displayed in the UI */
export const TOOLTIP_IMPLICIT_CONFIDENCE =
  'This confidence score is derived from your response patterns — how quickly you answered, whether you changed answers, and how long you spent reviewing. It helps the system schedule your reviews optimally.';

/** Tooltip for FSRS stability values */
export const TOOLTIP_STABILITY =
  'Stability measures how well you know this material. Higher stability means longer intervals between reviews. It updates after every practice session based on your performance.';

/** Tooltip for FSRS difficulty values */
export const TOOLTIP_DIFFICULTY =
  'Difficulty reflects how challenging this material is for you personally. It adjusts based on your success rate and response patterns over time.';

/** Tooltip for mastery/retrievability scores */
export const TOOLTIP_MASTERY =
  'Mastery represents the estimated probability that you can recall this material right now. It naturally decreases over time, which is why spaced repetition schedules reviews before you forget.';

/** Tooltip for calibration scores (Brier) */
export const TOOLTIP_CALIBRATION =
  'Calibration measures how well your confidence matches your actual accuracy. A well-calibrated student knows what they know and what they don\'t — a critical clinical skill.';

// ─── Section Headers ────────────────────────────────────────────────

/** Dashboard section: areas needing attention */
export const HEADER_FOCUS_AREAS = 'Focus Areas';
export const SUBHEADER_FOCUS_AREAS = 'Systems and topics that need extra attention';

/** Dashboard section: study streak */
export const HEADER_CONSISTENCY = 'Study Consistency';

/** Session end: missed questions summary */
export const HEADER_REVIEW_THESE = 'Review These';
export const SUBHEADER_REVIEW_THESE = 'Questions to revisit for stronger retention';
