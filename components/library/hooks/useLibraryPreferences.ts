/**
 * useLibraryPreferences - Persist user preferences for the Clinical Reference Library
 * 
 * Stores in localStorage:
 * - Last selected system
 * - Last selected subcategory
 * - High Yield Only filter state
 * - Search query (optional)
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'panceai_library_preferences';

interface LibraryPreferences {
  activeSystem: string;
  activeSubcategory: string | null;
  highYieldOnly: boolean;
  lastVisited?: string; // ISO timestamp
}

const DEFAULT_PREFERENCES: LibraryPreferences = {
  activeSystem: 'all',
  activeSubcategory: null,
  highYieldOnly: false,
};

/**
 * Load preferences from localStorage
 */
function loadPreferences(): LibraryPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (err) {
    console.warn('[useLibraryPreferences] Failed to load preferences:', err);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Save preferences to localStorage
 */
function savePreferences(prefs: LibraryPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...prefs,
      lastVisited: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('[useLibraryPreferences] Failed to save preferences:', err);
  }
}

/**
 * Hook for managing library user preferences
 */
export function useLibraryPreferences() {
  const [preferences, setPreferences] = useState<LibraryPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loaded = loadPreferences();
    setPreferences(loaded);
    setIsLoaded(true);
  }, []);

  // Save preferences whenever they change (after initial load)
  useEffect(() => {
    if (isLoaded) {
      savePreferences(preferences);
    }
  }, [preferences, isLoaded]);

  const setActiveSystem = useCallback((system: string) => {
    setPreferences(prev => ({
      ...prev,
      activeSystem: system,
      activeSubcategory: null, // Reset subcategory when system changes
    }));
  }, []);

  const setActiveSubcategory = useCallback((subcategory: string | null) => {
    setPreferences(prev => ({
      ...prev,
      activeSubcategory: subcategory,
    }));
  }, []);

  const setHighYieldOnly = useCallback((enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      highYieldOnly: enabled,
    }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    ...preferences,
    isLoaded,
    setActiveSystem,
    setActiveSubcategory,
    setHighYieldOnly,
    resetPreferences,
  };
}

export default useLibraryPreferences;
