/**
 * useConditionBookmarks - Manage bookmarked conditions
 *
 * Stores bookmarked condition IDs in localStorage for quick access.
 * Useful for marking conditions to review later.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'panceai_condition_bookmarks';

interface BookmarkedCondition {
  id: string;
  condition: string;
  system?: string;
  bookmarkedAt: string;
  notes?: string; // Optional user notes
}

/**
 * Load bookmarks from localStorage
 */
function loadBookmarks(): BookmarkedCondition[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.warn('[useConditionBookmarks] Failed to load:', err);
  }
  return [];
}

/**
 * Save bookmarks to localStorage
 */
function saveBookmarks(bookmarks: BookmarkedCondition[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (err) {
    console.warn('[useConditionBookmarks] Failed to save:', err);
  }
}

/**
 * Hook for managing condition bookmarks
 */
export function useConditionBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkedCondition[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    const loaded = loadBookmarks();
    setBookmarks(loaded);
    setIsLoaded(true);
  }, []);

  // Save whenever bookmarks change (after initial load)
  useEffect(() => {
    if (isLoaded) {
      saveBookmarks(bookmarks);
    }
  }, [bookmarks, isLoaded]);

  /**
   * Check if a condition is bookmarked
   */
  const isBookmarked = useCallback(
    (conditionId: string): boolean => {
      return bookmarks.some((b) => b.id === conditionId);
    },
    [bookmarks]
  );

  /**
   * Toggle bookmark status for a condition
   */
  const toggleBookmark = useCallback(
    (condition: { id: string; condition: string; system?: string }) => {
      setBookmarks((prev) => {
        const exists = prev.find((b) => b.id === condition.id);
        if (exists) {
          // Remove bookmark
          return prev.filter((b) => b.id !== condition.id);
        } else {
          // Add bookmark
          return [
            ...prev,
            {
              id: condition.id,
              condition: condition.condition,
              system: condition.system,
              bookmarkedAt: new Date().toISOString(),
            },
          ];
        }
      });
    },
    []
  );

  /**
   * Add a note to a bookmarked condition
   */
  const addNote = useCallback((conditionId: string, note: string) => {
    setBookmarks((prev) => prev.map((b) => (b.id === conditionId ? { ...b, notes: note } : b)));
  }, []);

  /**
   * Remove a specific bookmark
   */
  const removeBookmark = useCallback((conditionId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== conditionId));
  }, []);

  /**
   * Clear all bookmarks
   */
  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  /**
   * Get bookmarks sorted by most recent
   */
  const sortedBookmarks = [...bookmarks].sort(
    (a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime()
  );

  return {
    bookmarks: sortedBookmarks,
    bookmarkCount: bookmarks.length,
    isLoaded,
    isBookmarked,
    toggleBookmark,
    addNote,
    removeBookmark,
    clearBookmarks,
  };
}

export default useConditionBookmarks;
