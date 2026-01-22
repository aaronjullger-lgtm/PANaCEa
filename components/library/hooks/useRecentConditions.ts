/**
 * useRecentConditions - Track recently viewed conditions
 *
 * Stores the last 10 viewed conditions in localStorage for quick access.
 */

import { useState, useEffect, useCallback } from 'react';
import type { MedicalContentDisplay } from '@/types/medical-content';

const STORAGE_KEY = 'panceai_recent_conditions';
const MAX_RECENT = 10;

interface RecentCondition {
  id: string;
  condition: string;
  system?: string;
  subcategory?: string;
  viewedAt: string; // ISO timestamp
}

/**
 * Load recent conditions from localStorage
 */
function loadRecentConditions(): RecentCondition[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.warn('[useRecentConditions] Failed to load:', err);
  }
  return [];
}

/**
 * Save recent conditions to localStorage
 */
function saveRecentConditions(conditions: RecentCondition[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conditions));
  } catch (err) {
    console.warn('[useRecentConditions] Failed to save:', err);
  }
}

/**
 * Hook for managing recently viewed conditions
 */
export function useRecentConditions() {
  const [recentConditions, setRecentConditions] = useState<RecentCondition[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    const loaded = loadRecentConditions();
    setRecentConditions(loaded);
    setIsLoaded(true);
  }, []);

  // Save whenever list changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      saveRecentConditions(recentConditions);
    }
  }, [recentConditions, isLoaded]);

  /**
   * Add a condition to the recent list
   * Moves existing entries to top, limits to MAX_RECENT
   */
  const addRecentCondition = useCallback((content: Partial<MedicalContentDisplay>) => {
    if (!content.id || !content.condition) return;

    // Capture values for closure type narrowing
    const contentId = content.id;
    const contentCondition = content.condition;

    setRecentConditions((prev) => {
      // Remove existing entry for this condition
      const filtered = prev.filter((c) => c.id !== contentId);

      // Add to top
      const newEntry: RecentCondition = {
        id: contentId,
        condition: contentCondition,
        system: content.system || undefined,
        subcategory: content.subcategory || undefined,
        viewedAt: new Date().toISOString(),
      };

      // Limit to MAX_RECENT
      return [newEntry, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  /**
   * Clear all recent conditions
   */
  const clearRecentConditions = useCallback(() => {
    setRecentConditions([]);
  }, []);

  /**
   * Remove a specific condition from recent list
   */
  const removeRecentCondition = useCallback((id: string) => {
    setRecentConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    recentConditions,
    isLoaded,
    addRecentCondition,
    clearRecentConditions,
    removeRecentCondition,
  };
}

export default useRecentConditions;