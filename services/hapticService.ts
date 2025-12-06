/**
 * Haptic Feedback Service
 * Provides vibration patterns for mobile devices to enhance user experience
 * Phase 19: Requirement 82
 */

export type HapticPattern = 'correct' | 'incorrect' | 'streak' | 'notification';

interface VibrationPattern {
  pattern: number[];
  description: string;
}

const HAPTIC_PATTERNS: Record<HapticPattern, VibrationPattern> = {
  correct: {
    pattern: [10], // Crisp, light "tick"
    description: 'Correct answer feedback'
  },
  incorrect: {
    pattern: [50], // Heavier "thud"
    description: 'Incorrect answer feedback'
  },
  streak: {
    pattern: [10, 30, 10, 30, 10], // Rapid "success" vibration
    description: 'Streak milestone achievement'
  },
  notification: {
    pattern: [20, 50, 20], // Gentle attention grab
    description: 'General notification'
  }
};

/**
 * Trigger haptic feedback if supported by the device
 */
export function triggerHaptic(pattern: HapticPattern): void {
  // Check if the browser supports vibration API
  if (!navigator.vibrate) {
    console.debug('Haptic feedback not supported on this device');
    return;
  }

  const vibration = HAPTIC_PATTERNS[pattern];
  
  try {
    navigator.vibrate(vibration.pattern);
    console.debug(`Haptic: ${vibration.description}`);
  } catch (error) {
    console.error('Failed to trigger haptic feedback:', error);
  }
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Stop any ongoing vibration
 */
export function stopHaptic(): void {
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/**
 * Custom haptic pattern for specific durations
 */
export function triggerCustomHaptic(pattern: number[]): void {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
