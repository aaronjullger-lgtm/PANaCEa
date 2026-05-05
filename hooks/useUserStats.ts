/**
 * User statistics hook
 * Abstracts localStorage vs cloud storage based on authentication state
 *
 * Data Integrity Features (Session 2 improvements):
 * - Timestamp-based conflict resolution for saved questions
 * - Local deletion tracking to prevent deletions being overwritten by cloud sync
 * - Stale closure prevention in debounced sync
 * - Exponential backoff for sync failures
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import type { PerformanceRecord, Question } from '../types';
import { createDebouncedFunction } from '../lib/utils/debounce';
import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';
import { logger } from "@/lib/simple-logger";
import { getSyncCircuitBreaker } from '../lib/utils/circuitBreaker';

const PERFORMANCE_KEY = 'panceai_performance_v2';
const MISSED_KEY = 'panceai_missed_v2';
const FLAGGED_KEY = 'panceai_flagged_v2';
const DELETIONS_KEY = 'panceai_deletions_v2';
const userStatsLogger = logger.scope('useUserStats');

// Retry configuration
const MAX_SYNC_RETRIES = 3;
const BASE_RETRY_DELAY = 2000;

/**
 * Get a unique, consistent key for a question
 * Handles both question.questionId and question.id formats
 */
function getQuestionKey(question: Question): string {
  return question.questionId || question.id || '';
}

/**
 * Get timestamp from question, prioritizing updatedAt over lastReviewedAt
 */
function getQuestionTimestamp(question: Question): number {
  if (question.updatedAt) {
    return new Date(question.updatedAt).getTime();
  }
  if (question.lastReviewedAt) {
    return new Date(question.lastReviewedAt).getTime();
  }
  return 0;
}

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

type SyncDataPayload = {
  performanceRecords?: PerformanceRecord[];
  srsItems?: unknown[];
  savedQuestions?: SavedQuestionWithType[];
};

type SyncResponsePayload = {
  success?: boolean;
  sessionId?: string;
  data?: SyncDataPayload | { success?: boolean; data?: SyncDataPayload };
};

function unwrapSyncResponse(result: SyncResponsePayload): { success: boolean; data: SyncDataPayload | null } {
  const maybeEnvelope = result.data as { success?: boolean; data?: SyncDataPayload } | SyncDataPayload | undefined;
  const nested =
    maybeEnvelope && 'data' in maybeEnvelope && maybeEnvelope.data
      ? maybeEnvelope
      : null;
  const data = (nested?.data ?? maybeEnvelope ?? null) as SyncDataPayload | null;
  const success = Boolean(result.success ?? nested?.success ?? data);
  return { success, data };
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
 * Helper to merge questions with timestamp-based conflict resolution
 */
function mergeQuestionsWithTimestamps(
  local: Question[],
  remote: Question[]
): Question[] {
  const merged = new Map<string, Question>();

  // Add local questions first
  local.forEach((q) => {
    const id = getQuestionKey(q);
    if (id) {
      merged.set(id, q);
    }
  });

  // Merge remote questions, keeping newer version
  remote.forEach((q) => {
    const id = getQuestionKey(q);
    if (!id) return;

    const existing = merged.get(id);
    if (!existing) {
      // No local version, add remote
      merged.set(id, q);
    } else {
      // Compare timestamps, keep newer
      const existingTime = getQuestionTimestamp(existing);
      const remoteTime = getQuestionTimestamp(q);

      if (remoteTime > existingTime) {
        merged.set(id, q);
      }
      // Otherwise keep existing (local is newer or equal)
    }
  });

  return Array.from(merged.values());
}

/**
 * Hook for managing user statistics with automatic cloud sync
 */
export function useUserStats(): UseUserStatsResult {
  const { isSignedIn, user, getToken } = useAuth();

  const persistenceEnabledRef = useRef(false);

  // Track local deletions to prevent cloud sync from restoring deleted questions
  const localDeletionsRef = useRef<Map<string, number>>(new Map(
    safeParse<Array<[string, number]>>(localStorage.getItem(DELETIONS_KEY), [])
  ));

  // Track sync retry attempts for exponential backoff
  const syncRetryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [performanceData, setPerformanceDataState] = useState<PerformanceRecord[]>(() =>
    safeParse<PerformanceRecord[]>(localStorage.getItem(PERFORMANCE_KEY), [])
  );
  const [missedQuestions, setMissedQuestionsState] = useState<Question[]>(() =>
    safeParse<Question[]>(localStorage.getItem(MISSED_KEY), [])
  );
  const [flaggedQuestions, setFlaggedQuestionsState] = useState<Question[]>(() =>
    safeParse<Question[]>(localStorage.getItem(FLAGGED_KEY), [])
  );

  // Refs to hold latest state for sync callbacks (avoids recreating callbacks on state changes)
  const performanceDataRef = useRef(performanceData);
  const missedQuestionsRef = useRef(missedQuestions);
  const flaggedQuestionsRef = useRef(flaggedQuestions);
  performanceDataRef.current = performanceData;
  missedQuestionsRef.current = missedQuestions;
  flaggedQuestionsRef.current = flaggedQuestions;

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Create debounced sync function with ref to prevent recreating on each render
  const debouncedSyncRef = useRef<ReturnType<typeof createDebouncedFunction> | null>(null);

  // Save to localStorage whenever data changes (for offline support)
  useEffect(() => {
    if (!persistenceEnabledRef.current) return;
    try { localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(performanceData)); } catch { /* quota exceeded — non-fatal */ }
  }, [performanceData]);

  useEffect(() => {
    if (!persistenceEnabledRef.current) return;
    try { localStorage.setItem(MISSED_KEY, JSON.stringify(missedQuestions)); } catch { /* quota exceeded — non-fatal */ }
  }, [missedQuestions]);

  useEffect(() => {
    if (!persistenceEnabledRef.current) return;
    try { localStorage.setItem(FLAGGED_KEY, JSON.stringify(flaggedQuestions)); } catch { /* quota exceeded — non-fatal */ }
  }, [flaggedQuestions]);

  // Enable persistence after initial mount to avoid overwriting pre-seeded localStorage
  useEffect(() => {
    persistenceEnabledRef.current = true;
  }, []);

  // Track that we've run initial sync for this sign-in (avoids re-running when other state updates)
  const initialSyncDoneRef = useRef(false);

  /**
   * Calculate exponential backoff delay
   */
  const calculateBackoffDelay = useCallback((): number => {
    return BASE_RETRY_DELAY * Math.pow(2, syncRetryCountRef.current);
  }, []);

  /**
   * Upload local data to cloud
   */
  const syncToCloud = useCallback(async () => {
    if (!isSignedIn || !user) {
      userStatsLogger.warn('Cannot sync: user not signed in');
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

      // Read latest state from refs (avoids stale closures and unstable callback deps)
      const currentPerformanceData = performanceDataRef.current;
      const currentMissedQuestions = missedQuestionsRef.current;
      const currentFlaggedQuestions = flaggedQuestionsRef.current;

      // Create Set for O(1) lookup instead of O(n) array.includes()
      const missedQuestionIds = new Set(currentMissedQuestions.map(getQuestionKey));

      // Use circuit breaker to prevent cascading failures
      const circuitBreaker = getSyncCircuitBreaker();
      const response = await circuitBreaker.execute(() =>
        fetch(getApiEndpoint(API_ENDPOINTS.SYNC), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user.clerkId,
            performanceRecords: currentPerformanceData,
            savedQuestions: [...currentMissedQuestions, ...currentFlaggedQuestions].map((q) => {
              const questionId = getQuestionKey(q);
              return {
                ...q,
                type: missedQuestionIds.has(questionId) ? 'missed' : 'flagged',
                // Ensure updatedAt is present for conflict resolution
                updatedAt: q.updatedAt || q.lastReviewedAt || new Date().toISOString(),
              };
            }),
            // Send local deletions (as Record<questionId, ISO timestamp>) so server can honor them
            localDeletions: Object.fromEntries(
              Array.from(localDeletionsRef.current.entries()).map(([id, timestamp]) => [
                id,
                new Date(timestamp).toISOString(),
              ])
            ),
          }),
        })
      );

      // Handle 401 Unauthorized - abort sync immediately without retry
      if (response.status === 401) {
        userStatsLogger.warn('401 Unauthorized - stopping sync to prevent infinite loop');
        setSyncError('Authentication failed. Please sign in again.');
        setIsSyncing(false);
        setIsLoading(false);
        syncRetryCountRef.current = 0;
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

      const result = (await response.json()) as SyncResponsePayload;
      const syncPayload = unwrapSyncResponse(result);

      // Process server response and update local state with merged data
      if (syncPayload.success && syncPayload.data) {
        const d = syncPayload.data;
        
        // Merge performance records by ID, keeping newer records
        if (d.performanceRecords?.length) {
          setPerformanceDataState((prev) => {
            const merged = new Map<string, PerformanceRecord>();
            prev.forEach((r) => merged.set(r.id || '', r));
            d.performanceRecords.forEach((r) => {
              const existing = merged.get(r.id || '');
              if (!existing || r.timestamp > existing.timestamp) {
                merged.set(r.id || '', r);
              }
            });
            return Array.from(merged.values());
          });
        }
        
        // Merge saved questions with timestamp-based conflict resolution
        if (d.savedQuestions?.length) {
          const { missed, flagged } = separateSavedQuestions(d.savedQuestions);
          
          setMissedQuestionsState((prev) => {
            // Filter out locally deleted questions before merging
            const prevFiltered = prev.filter((q) => {
              const id = getQuestionKey(q);
              return !localDeletionsRef.current.has(id);
            });
            return mergeQuestionsWithTimestamps(prevFiltered, missed);
          });
          
          setFlaggedQuestionsState((prev) => {
            const prevFiltered = prev.filter((q) => {
              const id = getQuestionKey(q);
              return !localDeletionsRef.current.has(id);
            });
            return mergeQuestionsWithTimestamps(prevFiltered, flagged);
          });
        }

        // Clear deletions after successful sync
        localDeletionsRef.current.clear();
        localStorage.removeItem(DELETIONS_KEY);
      }

      setLastSyncTime(Date.now());
      syncRetryCountRef.current = 0; // Reset retry counter on success
      userStatsLogger.info('Sync to cloud successful', { sessionId: result?.sessionId });
    } catch (error) {
      userStatsLogger.warn('Sync to cloud failed', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncError(errorMessage);

      // Implement exponential backoff for retries
      if (syncRetryCountRef.current < MAX_SYNC_RETRIES) {
        syncRetryCountRef.current++;
        const delay = calculateBackoffDelay();
        
        userStatsLogger.warn(
          `Scheduling retry ${syncRetryCountRef.current}/${MAX_SYNC_RETRIES} after ${delay}ms`
        );
        
        // Schedule retry with exponential backoff (cancel on unmount via ref)
        retryTimeoutRef.current = setTimeout(() => {
          if (debouncedSyncRef.current) {
            debouncedSyncRef.current.debounced();
          }
        }, delay);
      } else {
        // Max retries reached
        setSyncError(`Sync failed after ${MAX_SYNC_RETRIES} retries. Please check your connection.`);
        syncRetryCountRef.current = 0;
      }
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [isSignedIn, user, getToken, calculateBackoffDelay]);

  /**
   * Download data from cloud
   */
  const syncFromCloud = useCallback(async () => {
    if (!isSignedIn || !user) {
      userStatsLogger.warn('Cannot sync: user not signed in');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      // Use circuit breaker to prevent cascading failures
      const circuitBreaker = getSyncCircuitBreaker();
      const response = await circuitBreaker.execute(() =>
        fetch(getApiEndpoint(API_ENDPOINTS.SYNC), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );

      // Handle 401 Unauthorized - abort sync immediately without retry
      if (response.status === 401) {
        userStatsLogger.warn('401 Unauthorized - stopping sync to prevent infinite loop');
        setSyncError('Authentication failed. Please sign in again.');
        setIsSyncing(false);
        setIsLoading(false);
        syncRetryCountRef.current = 0;
        return; // Exit early, do not throw or retry
      }

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Sync failed: server returned ${contentType || 'non-JSON'}`);
      }

      const result = (await response.json()) as SyncResponsePayload;
      const syncPayload = unwrapSyncResponse(result);

      if (syncPayload.success && syncPayload.data) {
        const d = syncPayload.data;
        const syncErrors: string[] = [];

        // Merge performance records by ID, keeping newer records
        try {
          if (d.performanceRecords?.length) {
            setPerformanceDataState((prev) => {
              const merged = new Map<string, PerformanceRecord>();
              prev.forEach((r) => merged.set(r.id || '', r));
              d.performanceRecords!.forEach((r) => {
                const existing = merged.get(r.id || '');
                if (!existing || r.timestamp > existing.timestamp) {
                  merged.set(r.id || '', r);
                }
              });
              return Array.from(merged.values());
            });
          }
        } catch (e) { syncErrors.push(`performanceRecords: ${e instanceof Error ? e.message : String(e)}`); }

        if (syncErrors.length > 0) {
          userStatsLogger.warn('Partial sync errors during download', { syncErrors });
        }

        // Merge saved questions with timestamp-based conflict resolution
        if (d.savedQuestions?.length) {
          const { missed, flagged } = separateSavedQuestions(d.savedQuestions);
          
          setMissedQuestionsState((prev) => {
            // Filter out locally deleted questions before merging
            const prevFiltered = prev.filter((q) => {
              const id = getQuestionKey(q);
              return !localDeletionsRef.current.has(id);
            });
            return mergeQuestionsWithTimestamps(prevFiltered, missed);
          });
          
          setFlaggedQuestionsState((prev) => {
            const prevFiltered = prev.filter((q) => {
              const id = getQuestionKey(q);
              return !localDeletionsRef.current.has(id);
            });
            return mergeQuestionsWithTimestamps(prevFiltered, flagged);
          });
        }

        setLastSyncTime(Date.now());
        syncRetryCountRef.current = 0; // Reset retry counter on success
        userStatsLogger.debug('Sync from cloud successful');
      }
    } catch (error) {
      userStatsLogger.warn('Sync from cloud failed', { error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncError(errorMessage);

      // Implement exponential backoff for retries
      if (syncRetryCountRef.current < MAX_SYNC_RETRIES) {
        syncRetryCountRef.current++;
        const delay = calculateBackoffDelay();
        
        userStatsLogger.warn(
          `Scheduling retry ${syncRetryCountRef.current}/${MAX_SYNC_RETRIES} after ${delay}ms`
        );
        
        // Schedule retry with exponential backoff (cancel on unmount via ref)
        retryTimeoutRef.current = setTimeout(() => {
          if (debouncedSyncRef.current) {
            debouncedSyncRef.current.debounced();
          }
        }, delay);
      } else {
        setSyncError(`Sync failed after ${MAX_SYNC_RETRIES} retries. Please check your connection.`);
        syncRetryCountRef.current = 0;
      }
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, [isSignedIn, user, getToken, calculateBackoffDelay]);

  // Initialize debounced sync function with proper dependency tracking
  // Recreate when syncToCloud or syncFromCloud dependencies change
  useEffect(() => {
    debouncedSyncRef.current = createDebouncedFunction(syncToCloud, 2000);

    // Cleanup on unmount or when sync function changes
    return () => {
      if (debouncedSyncRef.current) {
        debouncedSyncRef.current.cancel();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [syncToCloud, syncFromCloud, getToken, user, isSignedIn]); // Include all auth dependencies

  // Clear loading and sync state when user signs out
  useEffect(() => {
    if (!isSignedIn || !user) {
      initialSyncDoneRef.current = false;
      setIsLoading(false);
      setIsSyncing(false);
      setSyncError(null);
      syncRetryCountRef.current = 0;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    }
  }, [isSignedIn, user]);

  // Auto-sync when user signs in (only once per session)
  useEffect(() => {
    if (!isSignedIn || !user) {
      return;
    }
    if (initialSyncDoneRef.current) {
      return;
    }
    initialSyncDoneRef.current = true;

    // Prefer the in-memory state (initialized from localStorage during render).
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

    // Use refs to capture latest sync functions to avoid stale closures
    const performSync = async () => {
      if (hasLocalData) {
        await syncToCloud();
      } else {
        await syncFromCloud();
      }
    };

    performSync().catch((error) => {
      userStatsLogger.warn('Initial sync failed', { error });
      setIsLoading(false);
    });
  }, [isSignedIn, syncToCloud, syncFromCloud]); // Include sync functions in deps

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
  // Now with local deletion tracking for missed questions
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
      setMissedQuestionsState((prev) => {
        const newData = typeof data === 'function' ? data(prev) : data;

        // Track which questions were deleted locally
        const newIds = new Set(newData.map(getQuestionKey));
        prev.forEach((q) => {
          const id = getQuestionKey(q);
          if (id && !newIds.has(id)) {
            // Mark this question as deleted locally
            localDeletionsRef.current.set(id, Date.now());
            // Persist deletions to localStorage
            try { localStorage.setItem(
              DELETIONS_KEY,
              JSON.stringify(Array.from(localDeletionsRef.current.entries()))
            ); } catch { /* quota exceeded — non-fatal */ }
          }
        });

        return newData;
      });
      
      if (isSignedIn && debouncedSyncRef.current) {
        debouncedSyncRef.current.debounced();
      }
    },
    [isSignedIn]
  );

  const setFlaggedQuestions = useCallback(
    (data: Question[] | ((prev: Question[]) => Question[])) => {
      setFlaggedQuestionsState((prev) => {
        const newData = typeof data === 'function' ? data(prev) : data;

        // Track which questions were deleted locally
        const newIds = new Set(newData.map(getQuestionKey));
        prev.forEach((q) => {
          const id = getQuestionKey(q);
          if (id && !newIds.has(id)) {
            // Mark this question as deleted locally
            localDeletionsRef.current.set(id, Date.now());
            // Persist deletions to localStorage
            try { localStorage.setItem(
              DELETIONS_KEY,
              JSON.stringify(Array.from(localDeletionsRef.current.entries()))
            ); } catch { /* quota exceeded — non-fatal */ }
          }
        });

        return newData;
      });
      
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
