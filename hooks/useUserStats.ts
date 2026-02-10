/**
 * User statistics hook
 * Abstracts localStorage vs cloud storage based on authentication state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import type { PerformanceRecord, Question } from '../types';
import { getAllSRSItems, loadSRSItemsFromCloud } from '../lib/services/srsService';
import { createDebouncedFunction } from '../lib/utils/debounce';
import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';
import { logger } from '@/src/lib/logger';

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
  setPerformanceData: (
    data: PerformanceRecord[] | ((prev: PerformanceRecord[]) => PerformanceRecord[])
  ) => void;
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
  const missed = savedQuestions.filter((q) => q.type === 'missed');
  const flagged = savedQuestions.filter((q) => q.type === 'flagged');
  return { missed, flagged };
}

/**
 * Hook for managing user statistics with automatic cloud sync
 */
export function useUserStats(): UseUserStatsResult {
  const { isSignedIn, user, getToken } = useAuth();

  const persistenceEnabledRef = useRef(false);

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

  // Create debounced sync function with ref to prevent recreating on each render
  const debouncedSyncRef = useRef<ReturnType<typeof createDebouncedFunction> | null>(null);

  // Save to localStorage whenever data changes (for offline support)
  useEffect(() => {
    if (!persistenceEnabledRef.current) return;
    localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(performanceData));
  }, [performanceData]);

  useEffect(() => {
    if (!persistenceEnabledRef.current) return;
    localStorage.setItem(MISSED_KEY, JSON.stringify(missedQuestions));
  }, [missedQuestions]);

  useEffect(() => {
    if (!persistenceEnabledRef.current) return;
    localStorage.setItem(FLAGGED_KEY, JSON.stringify(flaggedQuestions));
  }, [flaggedQuestions]);

  // Enable persistence after initial mount to avoid overwriting pre-seeded localStorage
  useEffect(() => {
    persistenceEnabledRef.current = true;
  }, []);

  /**
   * Upload local data to cloud
   */
  const syncToCloud = useCallback(async () => {
    if (!isSignedIn || !user) {
      logger.warn('useUserStats', 'Cannot sync: user not signed in');
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

      const response = await fetch(getApiEndpoint(API_ENDPOINTS.SYNC), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.clerkId,
          performanceRecords: performanceData,
          srsItems,
          savedQuestions: [...missedQuestions, ...flaggedQuestions].map((q) => ({
            ...q,
            type: missedQuestions.includes(q) ? 'missed' : 'flagged',
            // Ensure updatedAt is present for conflict resolution
            updatedAt: q.lastReviewedAt ? new Date(q.lastReviewedAt) : new Date(),
          })),
        }),
      });

      // Handle 401 Unauthorized - abort sync immediately without retry
      if (response.status === 401) {
        logger.warn('useUserStats', '401 Unauthorized - stopping sync to prevent infinite loop');
        setSyncError('Authentication failed. Please sign in again.');
        setIsSyncing(false);
        setIsLoading(false);
        return; // Exit early, do not throw or retry
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed with status ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Sync failed: server returned ${contentType || 'non-JSON'}`);
      }

      const result = (await response.json()) as {
        success?: boolean;
        data?: { performanceRecords?: PerformanceRecord[]; srsItems?: Parameters<typeof loadSRSItemsFromCloud>[0]; savedQuestions?: SavedQuestionWithType[] };
      };

      // Process server response and update local state with merged data
      if (result.success && result.data) {
        const d = result.data;
        if (d.performanceRecords?.length) {
          setPerformanceDataState(d.performanceRecords);
        }
        if (d.srsItems?.length) {
          loadSRSItemsFromCloud(d.srsItems);
        }
        if (d.savedQuestions?.length) {
          const { missed, flagged } = separateSavedQuestions(d.savedQuestions);
          setMissedQuestionsState(missed);
          setFlaggedQuestionsState(flagged);
        }
      }

      setLastSyncTime(Date.now());
      console.log('Sync to cloud successful:', result);
    } catch (error) {
      logger.warn('useUserStats', 'Sync to cloud failed', error);
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [isSignedIn, user, getToken, performanceData, missedQuestions, flaggedQuestions]);

  /**
   * Download data from cloud
   */
  const syncFromCloud = useCallback(async () => {
    if (!isSignedIn || !user) {
      logger.warn('useUserStats', 'Cannot sync: user not signed in');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const response = await fetch(getApiEndpoint(API_ENDPOINTS.SYNC), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle 401 Unauthorized - abort sync immediately without retry
      if (response.status === 401) {
        logger.warn('useUserStats', '401 Unauthorized - stopping sync to prevent infinite loop');
        setSyncError('Authentication failed. Please sign in again.');
        setIsSyncing(false);
        setIsLoading(false);
        return; // Exit early, do not throw or retry
      }

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Sync failed: server returned ${contentType || 'non-JSON'}`);
      }

      const result = (await response.json()) as {
        success?: boolean;
        data?: { performanceRecords?: PerformanceRecord[]; srsItems?: Parameters<typeof loadSRSItemsFromCloud>[0]; savedQuestions?: SavedQuestionWithType[] };
      };

      if (result.success && result.data) {
        const d = result.data;
        if (d.performanceRecords?.length) {
          setPerformanceDataState(d.performanceRecords);
        }
        if (d.srsItems?.length) {
          loadSRSItemsFromCloud(d.srsItems);
        }
        if (d.savedQuestions?.length) {
          const { missed, flagged } = separateSavedQuestions(d.savedQuestions);
          setMissedQuestionsState(missed);
          setFlaggedQuestionsState(flagged);
        }

      setLastSyncTime(Date.now());
      logger.debug('useUserStats', 'Sync from cloud successful');
      }
    } catch (error) {
      logger.warn('useUserStats', 'Sync from cloud failed', error);
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [isSignedIn, user, getToken]);

  // Initialize debounced sync function
  useEffect(() => {
    debouncedSyncRef.current = createDebouncedFunction(syncToCloud, 2000);

    // Cleanup on unmount
    return () => {
      if (debouncedSyncRef.current) {
        debouncedSyncRef.current.cancel();
      }
    };
  }, [syncToCloud]);

  // Clear loading and sync state when user signs out (handles sign-out before sync completes)
  useEffect(() => {
    if (!isSignedIn || !user) {
      setIsLoading(false);
      setIsSyncing(false);
      setSyncError(null);
    }
  }, [isSignedIn, user]);

  // Auto-sync when user signs in (only once per session). Show loading until first sync completes.
  useEffect(() => {
    if (!isSignedIn || !user) {
      return;
    }

    // Prefer the in-memory state (initialized from localStorage during render).
    // This avoids edge cases where some other test/code clears localStorage between
    // `renderHook()` and this effect running.
    let hasLocalData =
      performanceData.length > 0 || missedQuestions.length > 0 || flaggedQuestions.length > 0;

    // Fallback: if state is empty, re-check localStorage directly.
    if (!hasLocalData) {
      const localPerformance = safeParse<PerformanceRecord[]>(
        localStorage.getItem(PERFORMANCE_KEY),
        []
      );
      const localMissed = safeParse<Question[]>(localStorage.getItem(MISSED_KEY), []);
      const localFlagged = safeParse<Question[]>(localStorage.getItem(FLAGGED_KEY), []);

      hasLocalData =
        localPerformance.length > 0 || localMissed.length > 0 || localFlagged.length > 0;
    }

    setIsLoading(true);
    if (hasLocalData) {
      syncToCloud();
    } else {
      syncFromCloud();
    }
  }, [isSignedIn]); // Only trigger on sign-in state change, not on every clerkId change

  // Listen for external updates (e.g. from performanceService)
  useEffect(() => {
    const handleUpdate = () => {
      const newData = safeParse<PerformanceRecord[]>(localStorage.getItem(PERFORMANCE_KEY), []);
      setPerformanceDataState(newData);
    };

    window.addEventListener('performance-updated', handleUpdate);
    return () => window.removeEventListener('performance-updated', handleUpdate);
  }, []);

  // Wrapper setters that also trigger cloud sync with proper debouncing
  const setPerformanceData = useCallback(
    (data: PerformanceRecord[] | ((prev: PerformanceRecord[]) => PerformanceRecord[])) => {
      setPerformanceDataState(data);
      // Trigger debounced sync if signed in
      if (isSignedIn && debouncedSyncRef.current) {
        debouncedSyncRef.current.debounced();
      }
    },
    [isSignedIn]
  );

  const setMissedQuestions = useCallback(
    (data: Question[] | ((prev: Question[]) => Question[])) => {
      setMissedQuestionsState(data);
      if (isSignedIn && debouncedSyncRef.current) {
        debouncedSyncRef.current.debounced();
      }
    },
    [isSignedIn]
  );

  const setFlaggedQuestions = useCallback(
    (data: Question[] | ((prev: Question[]) => Question[])) => {
      setFlaggedQuestionsState(data);
      if (isSignedIn && debouncedSyncRef.current) {
        debouncedSyncRef.current.debounced();
      }
    },
    [isSignedIn]
  );

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
