/**
 * Enhanced Haptic Feedback
 *
 * Extends base haptic feedback with celebration patterns for streaks,
 * milestones, and achievements. Provides richer tactile feedback for
 * motivational moments.
 */

import { feedback as baseFeedback } from '@/services/core/feedbackService';

interface HapticPattern {
  pattern: number[];
  intensity?: 'light' | 'medium' | 'heavy';
}

/**
 * Haptic patterns for different interactions
 */
const PATTERNS = {
  // Existing base patterns (from feedbackService)
  selection: { pattern: [10], intensity: 'light' as const },
  correct: { pattern: [30], intensity: 'medium' as const },
  incorrect: { pattern: [50, 50, 50], intensity: 'medium' as const },

  // New celebration patterns
  streak: { pattern: [20, 40, 20], intensity: 'medium' as const },
  milestone: { pattern: [30, 50, 30, 50, 30], intensity: 'heavy' as const },
  goalComplete: { pattern: [50, 100, 50, 100, 50], intensity: 'heavy' as const },
  levelUp: { pattern: [40, 60, 40, 60, 80], intensity: 'heavy' as const },

  // Soft feedback
  buttonPress: { pattern: [8], intensity: 'light' as const },
  toggle: { pattern: [15], intensity: 'light' as const },
  swipe: { pattern: [12], intensity: 'light' as const },
};

/**
 * Check if device supports haptic feedback
 */
function supportsHaptics(): boolean {
  return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
}

/**
 * Trigger a haptic pattern
 */
function triggerPattern(pattern: HapticPattern): void {
  if (!supportsHaptics()) return;

  try {
    // Check if vibration is allowed (some browsers require user gesture)
    navigator.vibrate(pattern.pattern);
  } catch (error) {
    // Silently fail - haptics are enhancement, not critical
    console.debug('[Haptics] Failed to trigger pattern:', error);
  }
}

/**
 * Enhanced haptic feedback API
 */
export const enhancedHaptics = {
  /**
   * Base feedback (delegates to existing service)
   */
  selection: () => baseFeedback.selection(),
  correct: () => baseFeedback.correct(),
  incorrect: () => baseFeedback.incorrect(),

  /**
   * Celebration patterns for motivational moments
   */

  /** Fired on streak milestones (3, 5, 10+ correct in a row) */
  streak: (streakCount: number) => {
    if (streakCount >= 10) {
      triggerPattern(PATTERNS.milestone); // Big celebration for 10+
    } else if (streakCount >= 5) {
      triggerPattern(PATTERNS.levelUp); // Medium celebration for 5+
    } else {
      triggerPattern(PATTERNS.streak); // Light celebration for 3+
    }
  },

  /** Fired on goal completion (daily target, weekly goal, etc.) */
  goalComplete: () => {
    triggerPattern(PATTERNS.goalComplete);
  },

  /** Fired on level up or mastery threshold */
  levelUp: () => {
    triggerPattern(PATTERNS.levelUp);
  },

  /** Fired on achievement unlock */
  achievementUnlock: () => {
    triggerPattern(PATTERNS.milestone);
  },

  /**
   * Soft feedback for UI interactions
   */

  /** Light tap on button press */
  buttonPress: () => {
    triggerPattern(PATTERNS.buttonPress);
  },

  /** Light tap on toggle switch */
  toggle: () => {
    triggerPattern(PATTERNS.toggle);
  },

  /** Light tap on swipe navigation */
  swipe: () => {
    triggerPattern(PATTERNS.swipe);
  },

  /**
   * Check if haptics are supported
   */
  isSupported: supportsHaptics,
};

export default enhancedHaptics;
