/**
 * Circadian Optimization System
 *
 * Optimizes study efficiency based on biological peaks and user's wake/sleep patterns.
 * Research basis: Memory consolidation varies with circadian rhythm, with peaks typically
 * occurring in late morning and early afternoon, and troughs in early afternoon (post-lunch dip).
 *
 * References:
 * - Schmidt et al. (2007): "Time-of-day effects on memory"
 * - Valdez et al. (2012): "Circadian variations in cognitive performance"
 */

/**
 * Circadian phase classifications
 *
 * Research basis:
 * - 2:00 PM threshold: Sessions before 2 PM show higher success rates
 * - Afternoon trough (2-4 PM): "Post-lunch dip" with reduced task-switching accuracy
 * - Late night (>11 PM): Exceptional retention when successfully learning during fatigue
 */
export type CircadianPhase = 'peak' | 'trough' | 'neutral' | 'evening_recovery' | 'late_night';

/**
 * Full circadian context for a review session
 */
export interface CircadianContext {
  /** Local hour (0-23) derived from browser timezone */
  localHour: number;
  /** IANA timezone string (e.g., "America/New_York") */
  timezone: string;
  /** Hours since user's typical wake time (if available) */
  hoursSinceWake?: number;
  /** Calculated circadian phase */
  circadianPhase: CircadianPhase;
  /** Stability modifier to apply to FSRS calculations */
  stabilityModifier: number;
  /** Par time modifier to apply to baseline question timing */
  parTimeModifier: number;
  /** ISO timestamp of when this context was captured */
  capturedAt: string;
}

/**
 * User circadian preferences (stored in User.preferences JSONB)
 */
export interface UserCircadianPrefs {
  /** Typical wake time in HH:mm format (e.g., "06:30") */
  typicalWakeTime?: string;
  /** Typical sleep time in HH:mm format (e.g., "22:30") */
  typicalSleepTime?: string;
  /** User's preferred study times */
  preferredStudyTimes?: ('early_morning' | 'morning' | 'afternoon' | 'evening' | 'night')[];
  /** Whether user has verified their circadian preferences */
  prefsVerified?: boolean;
}

/**
 * Default wake time assumption if user hasn't set preference
 */
const DEFAULT_WAKE_TIME = '07:00';

/**
 * Circadian phase boundaries (hours since wake)
 * Based on typical circadian rhythm research
 */
const PHASE_BOUNDARIES = {
  /** 0-2 hours after wake: Still in sleep inertia */
  WAKE_INERTIA_END: 2,
  /** 2-6 hours after wake: Morning peak (optimal for learning) */
  MORNING_PEAK_END: 6,
  /** 6-8 hours after wake: Post-lunch dip (trough) */
  AFTERNOON_TROUGH_END: 8,
  /** 8-12 hours after wake: Afternoon recovery */
  AFTERNOON_RECOVERY_END: 12,
  /** 12-15 hours after wake: Evening peak (second optimal window) */
  EVENING_PEAK_END: 15,
  /** 15+ hours after wake: Declining alertness */
};

/**
 * Stability modifiers for each circadian phase
 *
 * Rationale:
 * - Peak times: Standard stability gains (1.0) - optimal encoding
 * - Trough times: Higher stability gains (1.15) - rewards effort during harder periods
 * - Wake inertia: Slight penalty (0.9) - incomplete alertness
 * - Evening decline: Standard (1.0) - variable by individual
 */
/**
 * Stability modifiers for each circadian phase
 *
 * Research basis:
 * - Peak (9-12): Baseline (1.0x) - optimal encoding conditions
 * - Trough (14-16 / 2-4 PM): +15% bonus - rewards persistence during biological dip
 * - Late Night (>23 / 11 PM+): +20% bonus - exceptional retention indicator
 * - Evening Recovery (18-21): +5% bonus - second wind studying
 */
const PHASE_MODIFIERS: Record<CircadianPhase, number> = {
  peak: 1.0, // 9-12: Optimal encoding
  trough: 1.15, // +15% S for studying during biological trough (2-4 PM)
  neutral: 1.0, // Standard periods
  evening_recovery: 1.05, // +5% for second wind studying (6-9 PM)
  late_night: 1.2, // +20% for late night (>11 PM) - exceptional retention
};

/**
 * Par time modifiers for each circadian phase
 *
 * Adjusts baseline question timing based on circadian phase to account for natural
 * cognitive speed variations. Used when deriving implicit ratings to avoid unfairly
 * penalizing students for natural circadian slowdown.
 *
 * Rationale:
 * - Peak (9-12): Baseline (1.0x) - optimal speed, no adjustment
 * - Trough (14-16 / 2-4 PM): +15% - acknowledge post-lunch dip cognitive slowdown
 * - Neutral: 1.0x - standard timing
 * - Evening Recovery (18-21): +5% - slight leniency for second wind
 * - Late Night (>23 / 11 PM+): +25% - significant cognitive slowdown at night
 */
const PAR_TIME_MODIFIERS: Record<CircadianPhase, number> = {
  peak: 1.0, // Baseline — optimal cognition
  trough: 1.15, // +15% par time during afternoon dip
  neutral: 1.0, // Standard
  evening_recovery: 1.05, // +5% slight leniency
  late_night: 1.25, // +25% — significant cognitive slowdown
};

/**
 * Parse HH:mm time string to hours since midnight
 */
function parseTimeToHours(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours + minutes / 60;
}

/**
 * Calculate hours since wake time
 */
function calculateHoursSinceWake(currentHour: number, wakeTimeStr: string): number {
  const wakeHour = parseTimeToHours(wakeTimeStr);
  let hoursSinceWake = currentHour - wakeHour;

  // Handle crossing midnight
  if (hoursSinceWake < 0) {
    hoursSinceWake += 24;
  }

  return hoursSinceWake;
}

/**
 * Determine circadian phase based on hours since wake
 */
function determinePhaseFromWake(hoursSinceWake: number): CircadianPhase {
  if (hoursSinceWake < PHASE_BOUNDARIES.WAKE_INERTIA_END) {
    return 'neutral'; // Sleep inertia - not penalized heavily
  }
  if (hoursSinceWake < PHASE_BOUNDARIES.MORNING_PEAK_END) {
    return 'peak'; // Morning peak
  }
  if (hoursSinceWake < PHASE_BOUNDARIES.AFTERNOON_TROUGH_END) {
    return 'trough'; // Post-lunch dip
  }
  if (hoursSinceWake < PHASE_BOUNDARIES.AFTERNOON_RECOVERY_END) {
    return 'neutral'; // Afternoon recovery
  }
  if (hoursSinceWake < PHASE_BOUNDARIES.EVENING_PEAK_END) {
    return 'evening_recovery'; // Evening second wind
  }
  return 'neutral'; // Late evening decline
}

/**
 * Fallback phase determination based on clock time
 * Used when wake time is not available
 *
 * Research-backed time windows:
 * - 9-12: Morning peak (optimal learning)
 * - 14-16 (2-4 PM): Afternoon trough ("post-lunch dip")
 * - 18-21 (6-9 PM): Evening recovery (second wind)
 * - 23+ (11 PM+): Late night (exceptional retention bonus)
 */
function determinePhaseFromClock(localHour: number): CircadianPhase {
  // Late night (11 PM - 5 AM): Exceptional retention bonus
  if (localHour >= 23 || localHour < 5) {
    return 'late_night';
  }
  // Morning peak (9 AM - 12 PM)
  if (localHour >= 9 && localHour < 12) {
    return 'peak';
  }
  // Afternoon trough - refined to 2-4 PM (14:00-16:00)
  // Research: Task-switching accuracy drops significantly after 2 PM
  if (localHour >= 14 && localHour < 16) {
    return 'trough';
  }
  // Evening recovery / second wind (6-9 PM)
  if (localHour >= 18 && localHour < 21) {
    return 'evening_recovery';
  }
  // All other times are neutral
  return 'neutral';
}

/**
 * Get browser timezone
 * Safe to call on client side
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Get current local hour based on timezone
 */
export function getLocalHour(timezone: string = getBrowserTimezone()): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    return new Date().getHours();
  }
}

/**
 * Build full circadian context for a study session
 *
 * @param userPrefs - Optional user circadian preferences
 * @param overrideTimezone - Override browser timezone (for testing)
 */
export function buildCircadianContext(
  userPrefs?: UserCircadianPrefs,
  overrideTimezone?: string
): CircadianContext {
  const timezone = overrideTimezone || getBrowserTimezone();
  const localHour = getLocalHour(timezone);
  const now = new Date();

  let hoursSinceWake: number | undefined;
  let circadianPhase: CircadianPhase;

  // Calculate hours since wake if user has set wake time
  if (userPrefs?.typicalWakeTime) {
    hoursSinceWake = calculateHoursSinceWake(localHour, userPrefs.typicalWakeTime);
    circadianPhase = determinePhaseFromWake(hoursSinceWake);
  } else {
    // Fallback to clock-based estimation
    circadianPhase = determinePhaseFromClock(localHour);
  }

  return {
    localHour,
    timezone,
    hoursSinceWake,
    circadianPhase,
    stabilityModifier: PHASE_MODIFIERS[circadianPhase],
    parTimeModifier: PAR_TIME_MODIFIERS[circadianPhase],
    capturedAt: now.toISOString(),
  };
}

/**
 * Apply circadian modifier to FSRS stability calculation
 *
 * @param baseStability - Raw stability from FSRS algorithm
 * @param context - Circadian context from buildCircadianContext
 * @returns Modified stability value
 */
export function applyCircadianModifier(baseStability: number, context: CircadianContext): number {
  return baseStability * context.stabilityModifier;
}

/**
 * Apply circadian modifier to baseline par time
 *
 * @param baseParTimeMs - Baseline par time in milliseconds (content-based)
 * @param context - Circadian context from buildCircadianContext
 * @returns Adjusted par time in milliseconds
 */
export function applyCircadianParTimeModifier(baseParTimeMs: number, context: CircadianContext): number {
  return Math.round(baseParTimeMs * context.parTimeModifier);
}

/**
 * Get stability modifier for a specific local hour
 * Simplified version for quick calculations
 */
export function getCircadianModifier(localHour: number): number {
  const phase = determinePhaseFromClock(localHour);
  return PHASE_MODIFIERS[phase];
}

/**
 * Check if current time is optimal for studying
 */
export function isOptimalStudyTime(context: CircadianContext): boolean {
  return context.circadianPhase === 'peak' || context.circadianPhase === 'evening_recovery';
}

/**
 * Get study recommendation based on circadian context
 */
export function getStudyRecommendation(context: CircadianContext): {
  recommendation: 'optimal' | 'acceptable' | 'suboptimal';
  message: string;
  suggestedDuration: number; // minutes
} {
  switch (context.circadianPhase) {
    case 'peak':
      return {
        recommendation: 'optimal',
        message: 'Great time to tackle difficult material! Your brain is at peak performance.',
        suggestedDuration: 45,
      };
    case 'evening_recovery':
      return {
        recommendation: 'optimal',
        message: 'Evening study window active. Good for review and consolidation.',
        suggestedDuration: 30,
      };
    case 'trough':
      return {
        recommendation: 'acceptable',
        message:
          'Studying during your afternoon dip - extra effort will be rewarded with bonus stability!',
        suggestedDuration: 20,
      };
    default:
      return {
        recommendation: 'acceptable',
        message: 'Neutral time for studying. Consistent practice builds habits.',
        suggestedDuration: 25,
      };
  }
}

/**
 * Serialize circadian context for storage in review history
 */
export function serializeCircadianContext(context: CircadianContext): Record<string, unknown> {
  return {
    localHour: context.localHour,
    timezone: context.timezone,
    hoursSinceWake: context.hoursSinceWake,
    phase: context.circadianPhase,
    modifier: context.stabilityModifier,
    parTimeModifier: context.parTimeModifier,
    capturedAt: context.capturedAt,
  };
}

/**
 * Deserialize circadian context from stored data
 */
export function deserializeCircadianContext(
  data: Record<string, unknown>
): CircadianContext | null {
  if (!data || typeof data.localHour !== 'number') return null;

  return {
    localHour: data.localHour as number,
    timezone: (data.timezone as string) || 'UTC',
    hoursSinceWake: data.hoursSinceWake as number | undefined,
    circadianPhase: (data.phase as CircadianPhase) || 'neutral',
    stabilityModifier: (data.modifier as number) || 1.0,
    parTimeModifier: (data.parTimeModifier as number) || 1.0,
    capturedAt: (data.capturedAt as string) || new Date().toISOString(),
  };
}

export default {
  buildCircadianContext,
  applyCircadianModifier,
  getCircadianModifier,
  isOptimalStudyTime,
  getStudyRecommendation,
  getBrowserTimezone,
  getLocalHour,
};
