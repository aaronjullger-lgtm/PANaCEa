/**
 * Shared session configuration constants.
 *
 * Single source of truth for default session sizes, caps, and thresholds
 * used across the study pipeline: generate, anti-gaming, CoreAdaptiveSession.
 */

/** Default number of questions per study session */
export const DEFAULT_SESSION_SIZE = 20;

/** Maximum questions per session (hard cap, even in cram mode) */
export const MAX_SESSION_SIZE = 50;

/** Minimum questions per session (floor for low-urgency) */
export const MIN_SESSION_SIZE = 10;