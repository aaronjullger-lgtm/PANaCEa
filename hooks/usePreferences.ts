/**
 * usePreferences Hook
 *
 * Manages user preferences with automatic DB sync.
 * Provides:
 * - Automatic localStorage → DB migration on first load
 * - Real-time preference updates
 * - Optimistic updates with fallback
 * - Cross-device sync via database
 *
 * Usage:
 * ```tsx
 * const { preferences, updatePreference, isLoading, isSyncing } = usePreferences();
 *
 * // Update a preference
 * await updatePreference('theme', 'dark');
 *
 * // Access preferences
 * console.log(preferences.dailyGoal);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { UserPreferencesPayload } from '../types/preferences';
import {
  fullPreferencesSync,
  updatePreferencesInDb,
  writeToLocalStorage,
  extractLocalStoragePreferences,
} from '../utils/preferencesSync';

interface UsePreferencesReturn {
  /** Current preferences (merged from DB and localStorage) */
  preferences: UserPreferencesPayload;
  /** Update a single preference */
  updatePreference: <K extends keyof UserPreferencesPayload>(
    key: K,
    value: UserPreferencesPayload[K]
  ) => Promise<void>;
  /** Update multiple preferences at once */
  updatePreferences: (updates: Partial<UserPreferencesPayload>) => Promise<void>;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether a sync/update operation is in progress */
  isSyncing: boolean;
  /** Last error, if any */
  error: Error | null;
  /** Manually trigger a sync */
  syncNow: () => Promise<void>;
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferencesPayload = {
  dailyGoal: 40,
  preferredSystems: [],
  sessionLength: 20,
  difficulty: 'adaptive',
  theme: 'light',
  soundEnabled: true,
  hapticFeedback: true,
  animationsEnabled: true,
  fontSize: 'medium',
  showHints: true,
  autoAdvance: false,
  explanationDepth: 'standard',
  showPearls: true,
  showRelatedConcepts: true,
  fsrsEnabled: true,
  reviewBeforeExam: true,
  mixNewAndReview: true,
  keyboardShortcuts: true,
  developerMode: false,
  betaFeatures: false,
  emailDigest: true,
  emailFrequency: 'weekly',
  pushNotifications: false,
  shareAnonymousData: true,
  showOnLeaderboard: true,
};

/**
 * Hook for managing user preferences
 */
export function usePreferences(): UsePreferencesReturn {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferencesPayload>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Initial sync on mount
   */
  useEffect(() => {
    if (!isLoaded) return;

    const loadPreferences = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Validate merged preferences — strip null/undefined values so DEFAULT_PREFERENCES fill gaps
        const sanitize = (raw: Partial<UserPreferencesPayload>): Partial<UserPreferencesPayload> => {
          const clean: Partial<UserPreferencesPayload> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (v != null) (clean as Record<string, unknown>)[k] = v;
          }
          return clean;
        };

        if (!isSignedIn) {
          // Not signed in: Load from localStorage only
          const localPrefs = sanitize(extractLocalStoragePreferences());
          setPreferences({ ...DEFAULT_PREFERENCES, ...localPrefs });
          console.debug('[usePreferences] Loaded from localStorage (not signed in)');
        } else {
          // Signed in: Full sync (localStorage → DB → localStorage)
          const syncedPrefs = await fullPreferencesSync(getToken);
          if (syncedPrefs) {
            setPreferences({ ...DEFAULT_PREFERENCES, ...sanitize(syncedPrefs) });
            if (import.meta.env.DEV) console.debug('[usePreferences] Synced from DB');
          } else {
            // Fallback to localStorage
            const localPrefs = sanitize(extractLocalStoragePreferences());
            setPreferences({ ...DEFAULT_PREFERENCES, ...localPrefs });
            console.warn('[usePreferences] Sync failed, using localStorage');
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load preferences');
        console.error('[usePreferences] Load error:', error);
        setError(error);

        // Fallback to localStorage
        const localPrefs = extractLocalStoragePreferences();
        setPreferences({ ...DEFAULT_PREFERENCES, ...localPrefs });
      } finally {
        setIsLoading(false);
      }
    };

    void loadPreferences();
  }, [isLoaded, isSignedIn, getToken]);

  /**
   * Update a single preference
   */
  const updatePreference = useCallback(
    async <K extends keyof UserPreferencesPayload>(
      key: K,
      value: UserPreferencesPayload[K]
    ): Promise<void> => {
      setIsSyncing(true);
      setError(null);

      // Optimistic update
      setPreferences((prev) => ({ ...prev, [key]: value }));
      writeToLocalStorage({ [key]: value });

      try {
        if (isSignedIn) {
          // Update in DB
          const updated = await updatePreferencesInDb({ [key]: value }, getToken);
          if (updated) {
            setPreferences((prev) => ({ ...prev, ...updated }));
            console.debug(`[usePreferences] Updated ${String(key)} in DB`);
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update preference');
        console.error('[usePreferences] Update error:', error);
        setError(error);
        // Keep optimistic update even if DB sync fails
      } finally {
        setIsSyncing(false);
      }
    },
    [isSignedIn, getToken]
  );

  /**
   * Update multiple preferences at once
   */
  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferencesPayload>): Promise<void> => {
      setIsSyncing(true);
      setError(null);

      // Optimistic update
      setPreferences((prev) => ({ ...prev, ...updates }));
      writeToLocalStorage(updates);

      try {
        if (isSignedIn) {
          // Update in DB
          const updated = await updatePreferencesInDb(updates, getToken);
          if (updated) {
            setPreferences((prev) => ({ ...prev, ...updated }));
            console.debug('[usePreferences] Bulk updated in DB:', Object.keys(updates));
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update preferences');
        console.error('[usePreferences] Bulk update error:', error);
        setError(error);
        // Keep optimistic update even if DB sync fails
      } finally {
        setIsSyncing(false);
      }
    },
    [isSignedIn, getToken]
  );

  /**
   * Manually trigger a sync
   */
  const syncNow = useCallback(async (): Promise<void> => {
    if (!isSignedIn) {
      console.warn('[usePreferences] Cannot sync: not signed in');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const syncedPrefs = await fullPreferencesSync(getToken);
      if (syncedPrefs) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...syncedPrefs });
        if (import.meta.env.DEV) console.debug('[usePreferences] Manual sync complete');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sync');
      console.error('[usePreferences] Sync error:', error);
      setError(error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, getToken]);

  return {
    preferences,
    updatePreference,
    updatePreferences,
    isLoading,
    isSyncing,
    error,
    syncNow,
  };
}

export default usePreferences;
