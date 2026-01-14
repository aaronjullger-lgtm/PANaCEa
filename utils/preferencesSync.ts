/**
 * Preferences Sync Utility
 * 
 * Migrates localStorage preferences to database and keeps them in sync.
 * Handles conflict resolution when preferences exist in both locations.
 * 
 * Strategy:
 * - On first login: Check localStorage, migrate to DB if exists
 * - On subsequent logins: Use DB as source of truth
 * - Fallback to localStorage if API fails
 * - Always write to both locations for reliability
 */

import type { UserPreferencesPayload } from '@/types';

// localStorage keys for preferences
export const PREF_KEYS = {
  THEME: 'panceai_theme',
  DAILY_GOAL: 'panceai_daily_goal',
  PREFERRED_SYSTEMS: 'panceai_preferred_systems',
  SESSION_LENGTH: 'panceai_session_length',
  DIFFICULTY: 'panceai_difficulty',
  SOUND_ENABLED: 'panceai_sound_enabled',
  HAPTIC_FEEDBACK: 'panceai_haptic_feedback',
  ANIMATIONS_ENABLED: 'panceai_animations_enabled',
  FONT_SIZE: 'panceai_font_size',
  SHOW_HINTS: 'panceai_show_hints',
  AUTO_ADVANCE: 'panceai_auto_advance',
  EXPLANATION_DEPTH: 'panceai_explanation_depth',
  SHOW_PEARLS: 'panceai_show_pearls',
  KEYBOARD_SHORTCUTS: 'panceai_keyboard_shortcuts',
  FSRS_ENABLED: 'panceai_fsrs_enabled',
  SYNCED_TO_DB: 'panceai_prefs_synced', // Flag to track if synced
};

/**
 * Extract preferences from localStorage
 */
export function extractLocalStoragePreferences(): Partial<UserPreferencesPayload> {
  const prefs: Partial<UserPreferencesPayload> = {};

  try {
    // Study preferences
    const dailyGoal = localStorage.getItem(PREF_KEYS.DAILY_GOAL);
    if (dailyGoal) prefs.dailyGoal = parseInt(dailyGoal, 10);

    const preferredSystems = localStorage.getItem(PREF_KEYS.PREFERRED_SYSTEMS);
    if (preferredSystems) {
      try {
        prefs.preferredSystems = JSON.parse(preferredSystems);
      } catch {
        // Ignore parse errors
      }
    }

    const sessionLength = localStorage.getItem(PREF_KEYS.SESSION_LENGTH);
    if (sessionLength) prefs.sessionLength = parseInt(sessionLength, 10);

    const difficulty = localStorage.getItem(PREF_KEYS.DIFFICULTY);
    if (difficulty) prefs.difficulty = difficulty;

    // UI preferences
    const theme = localStorage.getItem(PREF_KEYS.THEME);
    if (theme) prefs.theme = theme;

    const soundEnabled = localStorage.getItem(PREF_KEYS.SOUND_ENABLED);
    if (soundEnabled !== null) prefs.soundEnabled = soundEnabled === 'true';

    const hapticFeedback = localStorage.getItem(PREF_KEYS.HAPTIC_FEEDBACK);
    if (hapticFeedback !== null) prefs.hapticFeedback = hapticFeedback === 'true';

    const animationsEnabled = localStorage.getItem(PREF_KEYS.ANIMATIONS_ENABLED);
    if (animationsEnabled !== null) prefs.animationsEnabled = animationsEnabled === 'true';

    const fontSize = localStorage.getItem(PREF_KEYS.FONT_SIZE);
    if (fontSize) prefs.fontSize = fontSize;

    // Learning preferences
    const showHints = localStorage.getItem(PREF_KEYS.SHOW_HINTS);
    if (showHints !== null) prefs.showHints = showHints === 'true';

    const autoAdvance = localStorage.getItem(PREF_KEYS.AUTO_ADVANCE);
    if (autoAdvance !== null) prefs.autoAdvance = autoAdvance === 'true';

    const explanationDepth = localStorage.getItem(PREF_KEYS.EXPLANATION_DEPTH);
    if (explanationDepth) prefs.explanationDepth = explanationDepth;

    const showPearls = localStorage.getItem(PREF_KEYS.SHOW_PEARLS);
    if (showPearls !== null) prefs.showPearls = showPearls === 'true';

    // Advanced settings
    const keyboardShortcuts = localStorage.getItem(PREF_KEYS.KEYBOARD_SHORTCUTS);
    if (keyboardShortcuts !== null) prefs.keyboardShortcuts = keyboardShortcuts === 'true';

    const fsrsEnabled = localStorage.getItem(PREF_KEYS.FSRS_ENABLED);
    if (fsrsEnabled !== null) prefs.fsrsEnabled = fsrsEnabled === 'true';
  } catch (error) {
    console.error('[preferencesSync] Error extracting localStorage:', error);
  }

  return prefs;
}

/**
 * Write preferences to localStorage
 */
export function writeToLocalStorage(prefs: Partial<UserPreferencesPayload>): void {
  try {
    if (prefs.dailyGoal !== undefined) {
      localStorage.setItem(PREF_KEYS.DAILY_GOAL, String(prefs.dailyGoal));
    }
    if (prefs.preferredSystems !== undefined) {
      localStorage.setItem(PREF_KEYS.PREFERRED_SYSTEMS, JSON.stringify(prefs.preferredSystems));
    }
    if (prefs.sessionLength !== undefined) {
      localStorage.setItem(PREF_KEYS.SESSION_LENGTH, String(prefs.sessionLength));
    }
    if (prefs.difficulty !== undefined) {
      localStorage.setItem(PREF_KEYS.DIFFICULTY, prefs.difficulty);
    }
    if (prefs.theme !== undefined) {
      localStorage.setItem(PREF_KEYS.THEME, prefs.theme);
    }
    if (prefs.soundEnabled !== undefined) {
      localStorage.setItem(PREF_KEYS.SOUND_ENABLED, String(prefs.soundEnabled));
    }
    if (prefs.hapticFeedback !== undefined) {
      localStorage.setItem(PREF_KEYS.HAPTIC_FEEDBACK, String(prefs.hapticFeedback));
    }
    if (prefs.animationsEnabled !== undefined) {
      localStorage.setItem(PREF_KEYS.ANIMATIONS_ENABLED, String(prefs.animationsEnabled));
    }
    if (prefs.fontSize !== undefined) {
      localStorage.setItem(PREF_KEYS.FONT_SIZE, prefs.fontSize);
    }
    if (prefs.showHints !== undefined) {
      localStorage.setItem(PREF_KEYS.SHOW_HINTS, String(prefs.showHints));
    }
    if (prefs.autoAdvance !== undefined) {
      localStorage.setItem(PREF_KEYS.AUTO_ADVANCE, String(prefs.autoAdvance));
    }
    if (prefs.explanationDepth !== undefined) {
      localStorage.setItem(PREF_KEYS.EXPLANATION_DEPTH, prefs.explanationDepth);
    }
    if (prefs.showPearls !== undefined) {
      localStorage.setItem(PREF_KEYS.SHOW_PEARLS, String(prefs.showPearls));
    }
    if (prefs.keyboardShortcuts !== undefined) {
      localStorage.setItem(PREF_KEYS.KEYBOARD_SHORTCUTS, String(prefs.keyboardShortcuts));
    }
    if (prefs.fsrsEnabled !== undefined) {
      localStorage.setItem(PREF_KEYS.FSRS_ENABLED, String(prefs.fsrsEnabled));
    }
  } catch (error) {
    console.error('[preferencesSync] Error writing to localStorage:', error);
  }
}

/**
 * Check if localStorage has been synced to DB
 */
export function hasSyncedToDb(): boolean {
  try {
    return localStorage.getItem(PREF_KEYS.SYNCED_TO_DB) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark localStorage as synced to DB
 */
export function markAsSynced(): void {
  try {
    localStorage.setItem(PREF_KEYS.SYNCED_TO_DB, 'true');
  } catch (error) {
    console.error('[preferencesSync] Error marking as synced:', error);
  }
}

/**
 * Sync preferences: localStorage → Database (on first login)
 * Returns the merged preferences
 */
export async function syncPreferencesToDb(
  getToken: () => Promise<string | null>
): Promise<UserPreferencesPayload | null> {
  try {
    // Check if already synced
    if (hasSyncedToDb()) {
      console.debug('[preferencesSync] Already synced, skipping migration');
      return null;
    }

    // Extract localStorage preferences
    const localPrefs = extractLocalStoragePreferences();

    // If localStorage is empty, no need to sync
    if (Object.keys(localPrefs).length === 0) {
      console.debug('[preferencesSync] No localStorage preferences to sync');
      markAsSynced();
      return null;
    }

    console.log('[preferencesSync] Migrating preferences to DB:', Object.keys(localPrefs));

    // Get auth token
    const token = await getToken();
    if (!token) {
      console.warn('[preferencesSync] No auth token, skipping sync');
      return null;
    }

    // POST to API (will merge with existing DB preferences if any)
    const response = await fetch('/api/user/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(localPrefs),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[preferencesSync] Successfully synced to DB');

    // Mark as synced
    markAsSynced();

    return result.preferences || null;
  } catch (error) {
    console.error('[preferencesSync] Failed to sync to DB:', error);
    return null;
  }
}

/**
 * Fetch preferences from database
 */
export async function fetchPreferencesFromDb(
  getToken: () => Promise<string | null>
): Promise<UserPreferencesPayload | null> {
  try {
    const token = await getToken();
    if (!token) {
      console.warn('[preferencesSync] No auth token');
      return null;
    }

    const response = await fetch('/api/user/preferences', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.preferences || null;
  } catch (error) {
    console.error('[preferencesSync] Failed to fetch from DB:', error);
    return null;
  }
}

/**
 * Update preferences in database
 */
export async function updatePreferencesInDb(
  prefs: Partial<UserPreferencesPayload>,
  getToken: () => Promise<string | null>
): Promise<UserPreferencesPayload | null> {
  try {
    const token = await getToken();
    if (!token) {
      console.warn('[preferencesSync] No auth token');
      return null;
    }

    const response = await fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(prefs),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.preferences || null;
  } catch (error) {
    console.error('[preferencesSync] Failed to update in DB:', error);
    return null;
  }
}

/**
 * Full sync flow: Migrate localStorage → Fetch from DB → Write to localStorage
 */
export async function fullPreferencesSync(
  getToken: () => Promise<string | null>
): Promise<UserPreferencesPayload | null> {
  try {
    // Step 1: Migrate localStorage to DB (if not already done)
    await syncPreferencesToDb(getToken);

    // Step 2: Fetch from DB (source of truth)
    const dbPrefs = await fetchPreferencesFromDb(getToken);

    if (dbPrefs) {
      // Step 3: Write to localStorage for offline access
      writeToLocalStorage(dbPrefs);
      console.log('[preferencesSync] Full sync complete');
      return dbPrefs;
    }

    // Fallback: Use localStorage if DB fetch failed
    const localPrefs = extractLocalStoragePreferences();
    return localPrefs as UserPreferencesPayload;
  } catch (error) {
    console.error('[preferencesSync] Full sync failed:', error);
    // Return localStorage as fallback
    return extractLocalStoragePreferences() as UserPreferencesPayload;
  }
}
