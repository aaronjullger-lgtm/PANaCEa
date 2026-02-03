/**
 * Centralized Storage Registry
 *
 * Manages all localStorage keys in one place to:
 * - Prevent key collisions
 * - Handle user-scoped vs global data
 * - Provide type-safe storage helpers
 * - Enable easy migration when data shapes change
 */

// Storage version for migrations
export const STORAGE_VERSION = 1;

/**
 * Storage key definitions
 * Keys prefixed with 'user:' are user-scoped and require userId
 */
export const StorageKeys = {
  // User data - synced to cloud
  PERFORMANCE_DATA: 'panceai_performance_v2',
  MISSED_QUESTIONS: 'panceai_missed_v2',
  FLAGGED_QUESTIONS: 'panceai_flagged_v2',
  SRS_ITEMS: 'panceai_srs_items',

  // User preferences - local only, user-scoped
  USER_PREFERENCES: 'user:panceai_preferences', // requires userId
  USER_CONTEXT: 'panceai_user_context',
  USER_PROFILE: 'panceai_user_profile',
  ENABLED_SYSTEMS: 'panceai_enabled_systems',
  FONT_SIZE: 'panceai_font_size',

  // Session/temporary data
  DAILY_STREAK: 'panceai_daily_streak',
  GRAND_ROUNDS_COMPLETED: 'date:panceai_grand_rounds', // requires date
  ATTENDING_PERSONA: 'panceai_attending_persona',

  // Feature-specific storage
  OFFLINE_QUEUE: 'panceai_offline_queue',
  DEAD_LETTER_QUEUE: 'panceai_dead_letter_queue',
  COMMUTER_MODE: 'panceai_commuter_mode',
  COMMUTER_SETTINGS: 'panceai_commuter_settings',
  CIRCADIAN_DATA: 'panceai_circadian_data',
  CONFUSION_PAIRS: 'panceai_confusion_pairs',

  // Toolkit/calculator data
  RECENT_CALCULATORS: 'panceai_recent_calculators',
  PINNED_CALCULATORS: 'panceai_pinned_calculators',

  // Apple Watch sync
  WATCH_SCHEDULE: 'panceai_watch_schedule',
  WATCH_FLASHCARDS: 'panceai_watch_flashcards',

  // Feedback preferences
  FEEDBACK_CONFIG: 'panceai_feedback_config',

  // Clinical fidelity (Patient Encounter / EMR)
  CLINICAL_FIDELITY: 'panceai_clinical_fidelity',

  // Drill/session data
  DRILL_RECORDS: 'panceai_drill_records',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/**
 * Keys that require user ID for namespacing
 */
const USER_SCOPED_KEYS = new Set<string>(['user:panceai_preferences']);

/**
 * Keys that require date for namespacing
 */
const DATE_SCOPED_KEYS = new Set<string>(['date:panceai_grand_rounds']);

/**
 * Get the actual localStorage key, handling namespacing
 *
 * @param key - The storage key from StorageKeys
 * @param options - Optional namespacing options
 * @returns The actual key to use with localStorage
 */
export function getStorageKey(
  key: StorageKey,
  options?: { userId?: string; date?: string | Date }
): string {
  // Handle user-scoped keys
  if (USER_SCOPED_KEYS.has(key)) {
    if (!options?.userId) {
      console.warn(`[Storage] Key "${key}" requires userId but none provided`);
      // Return with placeholder to avoid collision, but log warning
      return `${key.replace('user:', '')}_anonymous`;
    }
    return `${key.replace('user:', '')}_${options.userId}`;
  }

  // Handle date-scoped keys
  if (DATE_SCOPED_KEYS.has(key)) {
    const dateStr = options?.date
      ? options.date instanceof Date
        ? options.date.toDateString()
        : options.date
      : new Date().toDateString();
    return `${key.replace('date:', '')}_${dateStr}`;
  }

  return key;
}

/**
 * Type-safe localStorage wrapper
 */
export const localStore = {
  /**
   * Get a value from localStorage with type safety
   */
  get<T>(key: StorageKey, options?: { userId?: string; date?: string | Date }): T | null {
    try {
      const actualKey = getStorageKey(key, options);
      const raw = localStorage.getItem(actualKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error(`[Storage] Failed to get "${key}":`, error);
      return null;
    }
  },

  /**
   * Get a value with a fallback default
   */
  getOrDefault<T>(
    key: StorageKey,
    defaultValue: T,
    options?: { userId?: string; date?: string | Date }
  ): T {
    const value = localStore.get<T>(key, options);
    return value ?? defaultValue;
  },

  /**
   * Set a value in localStorage
   */
  set<T>(key: StorageKey, value: T, options?: { userId?: string; date?: string | Date }): boolean {
    try {
      const actualKey = getStorageKey(key, options);
      localStorage.setItem(actualKey, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to set "${key}":`, error);
      return false;
    }
  },

  /**
   * Remove a value from localStorage
   */
  remove(key: StorageKey, options?: { userId?: string; date?: string | Date }): boolean {
    try {
      const actualKey = getStorageKey(key, options);
      localStorage.removeItem(actualKey);
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to remove "${key}":`, error);
      return false;
    }
  },

  /**
   * Check if a key exists
   */
  has(key: StorageKey, options?: { userId?: string; date?: string | Date }): boolean {
    const actualKey = getStorageKey(key, options);
    return localStorage.getItem(actualKey) !== null;
  },

  /**
   * Clear all PANaCEa data from localStorage
   * Useful for logout or data reset
   */
  clearAll(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('panceai_') || key.startsWith('panacea_'))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.log(`[Storage] Cleared ${keysToRemove.length} PANaCEa storage keys`);
  },

  /**
   * Clear user-specific data (for logout)
   * Preserves global settings
   */
  clearUserData(userId: string): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(`_${userId}`)) {
        keysToRemove.push(key);
      }
    }

    // Also clear performance data (not user-prefixed but user-specific)
    keysToRemove.push(StorageKeys.PERFORMANCE_DATA);
    keysToRemove.push(StorageKeys.MISSED_QUESTIONS);
    keysToRemove.push(StorageKeys.FLAGGED_QUESTIONS);
    keysToRemove.push(StorageKeys.SRS_ITEMS);

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.log(`[Storage] Cleared ${keysToRemove.length} user data keys for ${userId}`);
  },

  /**
   * Get all PANaCEa storage keys and their sizes (for debugging)
   */
  getStorageInfo(): { key: string; size: number }[] {
    const info: { key: string; size: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('panceai_') || key.startsWith('panacea_'))) {
        const value = localStorage.getItem(key) || '';
        info.push({ key, size: value.length * 2 }); // UTF-16 = 2 bytes per char
      }
    }

    return info.sort((a, b) => b.size - a.size);
  },
};

/**
 * Dispatch a custom event when storage is updated
 * Components can listen for this to react to changes
 */
export function dispatchStorageUpdate(key: StorageKey): void {
  window.dispatchEvent(new CustomEvent('panacea-storage-update', { detail: { key } }));
}
