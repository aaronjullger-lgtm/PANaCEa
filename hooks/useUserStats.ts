/**
 * User statistics hook
 * Abstracts localStorage vs cloud storage based on authentication state
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { PerformanceRecord, Question } from '../types';
import { getAllSRSItems, loadSRSItemsFromCloud } from '../lib/services/srsService';

const PERFORMANCE_KEY = 'panceai_performance_v2';
const MISSED_KEY = 'panceai_missed_v2';
const FLAGGED_KEY = 'panceai_flagged_v2';

interface UserStatsState {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
}

interface UseUserStatsResult extends UserStatsState {
  setPerformanceData: (data: PerformanceRecord[] | ((prev: PerformanceRecord[]) => PerformanceRecord[])) => void;
  setMissedQuestions: (data: Question[] | ((prev: Question[]) => Question[])) => void;
  setFlaggedQuestions: (data: Question[] | ((prev: Question[]) => Question[])) => void;
  syncToCloud: () => Promise<void>;
  syncFromCloud: () => Promise<void>;
}

interface SavedQuestionWithType extends Question {
  type: 'missed' | 'flagged';
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Helper to separate saved questions by type
 */
function separateSavedQuestions(savedQuestions: SavedQuestionWithType[]): {
  missed: Question[];
  flagged: Question[];
} {
  const missed = savedQuestions.filter(q => q.type === 'missed');
  const flagged = savedQuestions.filter(q => q.type === 'flagged');
  return { missed, flagged };
}

/**
 * Hook for managing user statistics with automatic cloud sync
 */
export function useUserStats(): UseUserStatsResult {
  const { isSignedIn, user, getToken } = useAuth();

  const [performanceData, setPerformanceDataState] = useState<PerformanceRecord[]>(() =>
    safeParse<PerformanceRecord[]>(localStorage.getItem(PERFORMANCE_KEY), [])
  );
  const [missedQuestions, setMissedQuestionsState] = useState<Question[]>(() =>
    safeParse<Question[]>(localStorage.getItem(MISSED_KEY), [])
  );
  const [flaggedQuestions, setFlaggedQuestionsState] = useState<Question[]>(() =>
    safeParse<Question[]>(localStorage.getItem(FLAGGED_KEY), [])
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Save to localStorage whenever data changes (for offline support)
  useEffect(() => {
    localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(performanceData));
  }, [performanceData]);

  useEffect(() => {
    localStorage.setItem(MISSED_KEY, JSON.stringify(missedQuestions));
  }, [missedQuestions]);

  useEffect(() => {
    localStorage.setItem(FLAGGED_KEY, JSON.stringify(flaggedQuestions));
  }, [flaggedQuestions]);

  /**
   * Upload local data to cloud
   */
  const syncToCloud = useCallback(async () => {
    if (!isSignedIn || !user) {
      console.warn('Cannot sync: user not signed in');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Get fresh token from Clerk
      const token = await getToken();
      if (!token) {
        throw new Error('Failed to get authentication token. Please try signing in again.');
      }

      // Get SRS items from srsService
      const srsItems = getAllSRSItems(user.clerkId);

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.clerkId,
          performanceRecords: performanceData,
          srsItems,
          savedQuestions: [...missedQuestions, ...flaggedQuestions].map(q => ({
            ...q,
            type: missedQuestions.includes(q) ? 'missed' : 'flagged',
          })),
        }),
      });

      if (response.status === 401) {
        throw new Error('Authentication failed: Your session may have expired. Please sign in again.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      // Process server response and update local state with merged data
      if (result.success && result.data) {
        // Update local state with merged data from server
        if (result.data.performanceRecords) {
          setPerformanceDataState(result.data.performanceRecords);
        }
        
        if (result.data.srsItems) {
          loadSRSItemsFromCloud(result.data.srsItems);
        }
        
        if (result.data.savedQuestions) {
          const { missed, flagged } = separateSavedQuestions(result.data.savedQuestions);
          setMissedQuestionsState(missed);
          setFlaggedQuestionsState(flagged);
        }
      }
      
      setLastSyncTime(Date.now());
      console.log('Sync to cloud successful:', result);
    } catch (error) {
      console.error('Sync to cloud failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, user, getToken, performanceData, missedQuestions, flaggedQuestions]);

  /**
   * Download data from cloud
   */
  const syncFromCloud = useCallback(async () => {
    if (!isSignedIn || !user) {
      console.warn('Cannot sync: user not signed in');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const response = await fetch('/api/sync', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Merge cloud data with local data (keep most recent)
        if (result.data.performanceRecords) {
          setPerformanceDataState(result.data.performanceRecords);
        }
        
        if (result.data.srsItems) {
          loadSRSItemsFromCloud(result.data.srsItems);
        }
        
        if (result.data.savedQuestions) {
          const { missed, flagged } = separateSavedQuestions(result.data.savedQuestions);
          setMissedQuestionsState(missed);
          setFlaggedQuestionsState(flagged);
        }

        setLastSyncTime(Date.now());
        console.log('Sync from cloud successful:', result);
      }
    } catch (error) {
      console.error('Sync from cloud failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSignedIn, user, getToken]);

  // Auto-sync when user signs in (only once per session)
  useEffect(() => {
    if (isSignedIn && user) {
      // Check if there is local data
      if (performanceData.length > 0) {
        // If local data exists, upload and merge with server
        syncToCloud();
      } else {
        // If no local data, download from server
        syncFromCloud();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]); // Only trigger on sign-in state change, not on every clerkId change

  // Wrapper setters that also trigger cloud sync
  // Note: These use a simple delay for sync. In production, consider using
  // a debouncing library or queue-based sync for better reliability
  const setPerformanceData = useCallback((data: PerformanceRecord[] | ((prev: PerformanceRecord[]) => PerformanceRecord[])) => {
    setPerformanceDataState(data);
    // Trigger sync after a delay (simple debounce)
    // In production, use a proper debouncing utility
    if (isSignedIn) {
      const timeoutId = setTimeout(() => syncToCloud(), 2000);
      // Note: Cleanup would be needed if component unmounts
      return () => clearTimeout(timeoutId);
    }
  }, [isSignedIn, syncToCloud]);

  const setMissedQuestions = useCallback((data: Question[] | ((prev: Question[]) => Question[])) => {
    setMissedQuestionsState(data);
    if (isSignedIn) {
      const timeoutId = setTimeout(() => syncToCloud(), 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isSignedIn, syncToCloud]);

  const setFlaggedQuestions = useCallback((data: Question[] | ((prev: Question[]) => Question[])) => {
    setFlaggedQuestionsState(data);
    if (isSignedIn) {
      const timeoutId = setTimeout(() => syncToCloud(), 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isSignedIn, syncToCloud]);

  return {
    performanceData,
    missedQuestions,
    flaggedQuestions,
    isLoading,
    isSyncing,
    lastSyncTime,
    syncError,
    setPerformanceData,
    setMissedQuestions,
    setFlaggedQuestions,
    syncToCloud,
    syncFromCloud,
  };
}
