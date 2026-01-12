/**
 * Wake-Time Calibration System
 * 
 * Personalizes circadian adjustments based on user's natural sleep-wake cycle.
 * 
 * Research basis:
 * - Preckel et al. (2011): "Chronotype and academic achievement"
 * - Tonetti et al. (2015): "Sleep timing and academic performance"
 * - Study showing 8:30 AM wake-time associated with 73.1% high scorers
 * - 7:30 AM wake-time associated with higher failure rates
 * 
 * Key concepts:
 * - Chronotype: Individual's natural tendency for sleep-wake timing
 * - Optimal study windows: Relative to wake time, not clock time
 * - Cognitive peak: ~2-4 hours after waking (late-risers peak later)
 */

/**
 * Chronotype classification
 */
export type Chronotype = 
  | 'early_bird'     // Wake 5-6:30 AM
  | 'moderate_early' // Wake 6:30-7:30 AM
  | 'intermediate'   // Wake 7:30-8:30 AM (optimal)
  | 'moderate_late'  // Wake 8:30-10 AM
  | 'night_owl';     // Wake after 10 AM

/**
 * User's wake-time preferences
 */
export interface WakeTimePreferences {
  /** Typical weekday wake time (24-hour format, e.g., "07:30") */
  weekdayWakeTime: string;
  /** Typical weekend wake time */
  weekendWakeTime: string;
  /** User's preferred study start time (optional override) */
  preferredStudyStart?: string;
  /** Whether user has irregular sleep schedule */
  irregularSchedule: boolean;
  /** Detected chronotype */
  chronotype: Chronotype;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Cognitive window based on wake time
 */
export interface CognitiveWindow {
  /** Start time of peak cognition (24-hour format) */
  peakStart: string;
  /** End time of peak cognition */
  peakEnd: string;
  /** Start of afternoon dip */
  troughStart: string;
  /** End of afternoon dip */
  troughEnd: string;
  /** Evening recovery window start */
  eveningStart: string;
  /** Evening recovery window end */
  eveningEnd: string;
  /** Late night study window (if applicable) */
  lateNightStart?: string;
}

/**
 * Study session recommendation
 */
export interface StudyRecommendation {
  /** Is now a good time to study? */
  isOptimal: boolean;
  /** Current cognitive state */
  cognitiveState: 'peak' | 'good' | 'trough' | 'recovery' | 'late_night' | 'rest';
  /** Recommended action */
  recommendation: string;
  /** Hours until next optimal window */
  hoursUntilOptimal?: number;
  /** Stability modifier to apply */
  stabilityModifier: number;
  /** Confidence in recommendation (0-1) */
  confidence: number;
}

/**
 * Parse time string to minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to time string
 */
export function formatMinutesToTime(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Determine chronotype from wake time
 */
export function determineChronotype(wakeTime: string): Chronotype {
  const minutes = parseTimeToMinutes(wakeTime);
  
  if (minutes < 390) return 'early_bird';       // Before 6:30 AM
  if (minutes < 450) return 'moderate_early';   // 6:30-7:30 AM
  if (minutes < 510) return 'intermediate';     // 7:30-8:30 AM (optimal)
  if (minutes < 600) return 'moderate_late';    // 8:30-10:00 AM
  return 'night_owl';                            // After 10:00 AM
}

/**
 * Calculate cognitive windows based on wake time
 * 
 * Windows are relative to wake time:
 * - Peak: 2-4 hours after waking
 * - Trough: 6-8 hours after waking (post-lunch dip)
 * - Evening Recovery: 10-12 hours after waking
 */
export function calculateCognitiveWindows(wakeTime: string): CognitiveWindow {
  const wakeMinutes = parseTimeToMinutes(wakeTime);
  
  // Peak: 2-4 hours after waking
  const peakStart = wakeMinutes + 120; // +2 hours
  const peakEnd = wakeMinutes + 240;   // +4 hours
  
  // Trough: 6-8 hours after waking
  const troughStart = wakeMinutes + 360; // +6 hours
  const troughEnd = wakeMinutes + 480;   // +8 hours
  
  // Evening recovery: 10-12 hours after waking
  const eveningStart = wakeMinutes + 600; // +10 hours
  const eveningEnd = wakeMinutes + 720;   // +12 hours
  
  // Late night: 14+ hours after waking (for night owls)
  const lateNightStart = wakeMinutes + 840; // +14 hours
  
  return {
    peakStart: formatMinutesToTime(peakStart),
    peakEnd: formatMinutesToTime(peakEnd),
    troughStart: formatMinutesToTime(troughStart),
    troughEnd: formatMinutesToTime(troughEnd),
    eveningStart: formatMinutesToTime(eveningStart),
    eveningEnd: formatMinutesToTime(eveningEnd),
    lateNightStart: formatMinutesToTime(lateNightStart),
  };
}

/**
 * Get current cognitive state based on wake time and current time
 */
export function getCognitiveState(
  wakeTime: string,
  currentTime: Date = new Date()
): StudyRecommendation {
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const wakeMinutes = parseTimeToMinutes(wakeTime);
  
  // Calculate hours since waking
  let minutesSinceWaking = currentMinutes - wakeMinutes;
  if (minutesSinceWaking < -360) {
    // Likely same day, woke up very late
    minutesSinceWaking += 1440;
  } else if (minutesSinceWaking < 0) {
    // Before wake time (very early morning)
    return {
      isOptimal: false,
      cognitiveState: 'rest',
      recommendation: 'Sleep is the best study strategy right now. Rest well!',
      hoursUntilOptimal: Math.ceil((wakeMinutes - currentMinutes + 120) / 60),
      stabilityModifier: 0.8,
      confidence: 0.9,
    };
  }
  
  const hoursSinceWaking = minutesSinceWaking / 60;
  
  // Determine cognitive state
  if (hoursSinceWaking < 1) {
    // Just woke up
    return {
      isOptimal: false,
      cognitiveState: 'good',
      recommendation: 'Still waking up. Light review is okay, save hard topics for later.',
      hoursUntilOptimal: Math.ceil(2 - hoursSinceWaking),
      stabilityModifier: 0.95,
      confidence: 0.8,
    };
  }
  
  if (hoursSinceWaking < 4) {
    // Peak cognitive window
    return {
      isOptimal: true,
      cognitiveState: 'peak',
      recommendation: 'Peak cognition! Tackle your hardest topics now.',
      stabilityModifier: 1.0,
      confidence: 0.9,
    };
  }
  
  if (hoursSinceWaking < 6) {
    // Good but declining
    return {
      isOptimal: true,
      cognitiveState: 'good',
      recommendation: 'Good cognitive state. Continue your study session.',
      stabilityModifier: 1.0,
      confidence: 0.85,
    };
  }
  
  if (hoursSinceWaking < 8) {
    // Post-lunch trough
    return {
      isOptimal: false,
      cognitiveState: 'trough',
      recommendation: 'Afternoon dip detected. Consider a 20-min nap or light review only.',
      hoursUntilOptimal: Math.ceil(10 - hoursSinceWaking),
      stabilityModifier: 1.15, // +15% stability bonus
      confidence: 0.85,
    };
  }
  
  if (hoursSinceWaking < 10) {
    // Transition period
    return {
      isOptimal: false,
      cognitiveState: 'good',
      recommendation: 'Transitioning out of afternoon dip. Good time for moderate review.',
      hoursUntilOptimal: Math.ceil(10 - hoursSinceWaking),
      stabilityModifier: 1.05,
      confidence: 0.75,
    };
  }
  
  if (hoursSinceWaking < 12) {
    // Evening recovery
    return {
      isOptimal: true,
      cognitiveState: 'recovery',
      recommendation: 'Evening cognitive recovery. Good for consolidation and review.',
      stabilityModifier: 1.05,
      confidence: 0.8,
    };
  }
  
  if (hoursSinceWaking < 14) {
    // Declining evening
    return {
      isOptimal: false,
      cognitiveState: 'good',
      recommendation: 'Cognition declining. Wrap up soon for optimal sleep.',
      hoursUntilOptimal: 0,
      stabilityModifier: 1.0,
      confidence: 0.7,
    };
  }
  
  // Late night (14+ hours awake)
  return {
    isOptimal: false,
    cognitiveState: 'late_night',
    recommendation: 'Late night study. Focus on familiar material only. Sleep debt accumulating.',
    stabilityModifier: 1.20, // +20% bonus for late night warriors
    confidence: 0.6,
  };
}

/**
 * Get personalized study schedule for the day
 */
export function getDailyStudySchedule(wakeTime: string): Array<{
  timeRange: string;
  state: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const windows = calculateCognitiveWindows(wakeTime);
  
  return [
    {
      timeRange: `${formatMinutesToTime(parseTimeToMinutes(wakeTime))} - ${windows.peakStart}`,
      state: 'Wake-up',
      recommendation: 'Light review, catch up on notes',
      priority: 'low',
    },
    {
      timeRange: `${windows.peakStart} - ${windows.peakEnd}`,
      state: 'Peak Cognition',
      recommendation: 'Hard topics, new material, challenging questions',
      priority: 'high',
    },
    {
      timeRange: `${windows.peakEnd} - ${windows.troughStart}`,
      state: 'Good',
      recommendation: 'Continue studying, moderate difficulty',
      priority: 'medium',
    },
    {
      timeRange: `${windows.troughStart} - ${windows.troughEnd}`,
      state: 'Afternoon Trough',
      recommendation: 'Take a break, nap, or do light flashcard review',
      priority: 'low',
    },
    {
      timeRange: `${windows.eveningStart} - ${windows.eveningEnd}`,
      state: 'Evening Recovery',
      recommendation: 'Review session, consolidate learned material',
      priority: 'medium',
    },
  ];
}

/**
 * Calculate optimal exam time based on chronotype
 */
export function getOptimalExamTime(chronotype: Chronotype): string {
  const optimalTimes: Record<Chronotype, string> = {
    'early_bird': '08:00-10:00',
    'moderate_early': '09:00-11:00',
    'intermediate': '10:00-12:00',
    'moderate_late': '11:00-13:00',
    'night_owl': '12:00-14:00',
  };
  return optimalTimes[chronotype];
}

/**
 * Create default wake-time preferences
 */
export function createDefaultPreferences(): WakeTimePreferences {
  return {
    weekdayWakeTime: '07:30',
    weekendWakeTime: '08:30',
    irregularSchedule: false,
    chronotype: 'intermediate',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate and update wake-time preferences
 */
export function updatePreferences(
  current: WakeTimePreferences,
  updates: Partial<WakeTimePreferences>
): WakeTimePreferences {
  const newPrefs = { ...current, ...updates };
  
  // Recalculate chronotype if wake time changed
  if (updates.weekdayWakeTime) {
    newPrefs.chronotype = determineChronotype(updates.weekdayWakeTime);
  }
  
  newPrefs.updatedAt = new Date().toISOString();
  
  return newPrefs;
}

/**
 * Serialize preferences for storage
 */
export function serializePreferences(prefs: WakeTimePreferences): Record<string, unknown> {
  return {
    weekdayWake: prefs.weekdayWakeTime,
    weekendWake: prefs.weekendWakeTime,
    studyStart: prefs.preferredStudyStart,
    irregular: prefs.irregularSchedule,
    chronotype: prefs.chronotype,
    updated: prefs.updatedAt,
  };
}

export default {
  determineChronotype,
  calculateCognitiveWindows,
  getCognitiveState,
  getDailyStudySchedule,
  getOptimalExamTime,
  createDefaultPreferences,
  updatePreferences,
  serializePreferences,
  parseTimeToMinutes,
  formatMinutesToTime,
};
