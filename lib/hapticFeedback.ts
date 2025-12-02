/**
 * Haptic Feedback Utility
 * Triggers device vibration if available for enhanced tactile feedback
 */

export type HapticFeedbackType = 'success' | 'error' | 'warning' | 'selection';

const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  success: [50, 30, 50], // Double pulse for success
  error: [100], // Long single pulse for error
  warning: [30, 20, 30, 20, 30], // Triple short pulse for warning
  selection: [10], // Very short pulse for selection/tap
};

/**
 * Trigger haptic feedback if navigator.vibrate is available
 * @param type - The type of haptic feedback to trigger
 * @returns true if vibration was triggered, false otherwise
 */
export function triggerHapticFeedback(type: HapticFeedbackType = 'selection'): boolean {
  // Check if vibration API is available
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return false;
  }

  const pattern = HAPTIC_PATTERNS[type];
  
  try {
    return navigator.vibrate(pattern);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
    return false;
  }
}

/**
 * Trigger success feedback (e.g., correct answer)
 */
export function hapticSuccess(): void {
  triggerHapticFeedback('success');
}

/**
 * Trigger error feedback (e.g., incorrect answer)
 */
export function hapticError(): void {
  triggerHapticFeedback('error');
}

/**
 * Trigger warning feedback (e.g., time running out)
 */
export function hapticWarning(): void {
  triggerHapticFeedback('warning');
}

/**
 * Trigger selection feedback (e.g., button tap)
 */
export function hapticSelection(): void {
  triggerHapticFeedback('selection');
}
