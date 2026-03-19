/**
 * Offline Sync Manager
 *
 * Sprint 7: "Offline First" Pivot
 *
 * Manages offline study data:
 * - Queues question answers when offline
 * - Syncs to API when connection is restored
 * - Provides sync status and failure handling
 * - Supports background sync via Service Worker
 */

import { logger } from '@/src/lib/logger';

const SCOPE = 'SyncManager';

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineAnswer {
  id: string;
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  timeSpentMs: number;
  system?: string;
  conditionId?: string;
  confidence?: number;
  rating?: 1 | 2 | 3 | 4; // FSRS rating
  sessionId?: string;
  /** Behavioral telemetry for implicit FSRS (Ghost Grader) */
  telemetryJson?: Record<string, unknown>;
  answerChangedCount?: number;
  durationMs?: number;
  isMainSession?: boolean; // True if this attempt belongs to a main session (not cram/rapid recall)
  attemptId?: string; // Set after first sync for SRS analyze-behavior
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncError?: string;
}

export interface OfflinePearlAction {
  id: string;
  pearlId: string;
  action: 'view' | 'mark_mastered' | 'review_later' | 'save' | 'unsave';
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  // For review_later, track the scheduled date
  scheduledReviewDate?: string;
}

export interface OfflineReview {
  id: string;
  questionId: string;
  selectedAnswer: number;
  timeSpentMs: number;
  timeToFirstClick?: number;
  answerSwitches?: number;
  totalDwellTime?: number;
  timezone?: string;
  wakeTimeHHMM?: string;
  telemetry?: Record<string, unknown>;
  sessionType?: string;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncError?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingAnswers: number;
  pendingPearlActions: number;
  pendingReviews: number;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  isSyncing: boolean;
}

type SyncEventType = 'online' | 'offline' | 'sync-start' | 'sync-complete' | 'sync-error';
type SyncEventCallback = (status: SyncStatus) => void;

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  OFFLINE_ANSWERS: 'panceai_offline_answers',
  OFFLINE_PEARL_ACTIONS: 'panceai_offline_pearl_actions',
  OFFLINE_REVIEWS: 'panceai_offline_reviews',
  LAST_SYNC_TIME: 'panceai_last_sync_time',
  SYNC_ERROR: 'panceai_sync_error',
} as const;

async function parseSyncErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; message?: string; details?: string };
    const message = payload?.error || payload?.message || payload?.details;
    if (message) return message;
  } catch {
    // Non-JSON error payloads (e.g., proxy HTML) fall back to HTTP status.
  }
  return `HTTP ${response.status}`;
}

// ============================================================================
// SYNC MANAGER CLASS
// ============================================================================

class SyncManager {
  private listeners: Map<SyncEventType, Set<SyncEventCallback>> = new Map();
  private isSyncing = false;
  private syncRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Set up online/offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  private handleOnline(): void {
    this.emit('online', this.getStatus());
    // Automatically sync when coming online
    this.syncAll().catch((err) => logger.error(SCOPE, 'Auto-sync failed', err));
  }

  private handleOffline(): void {
    this.emit('offline', this.getStatus());
  }

  public on(event: SyncEventType, callback: SyncEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: SyncEventType, status: SyncStatus): void {
    this.listeners.get(event)?.forEach((callback) => callback(status));
  }

  // ===========================================================================
  // STATUS
  // ===========================================================================

  public getStatus(): SyncStatus {
    const answers = this.getOfflineAnswers();
    const pearlActions = this.getOfflinePearlActions();
    const reviews = this.getOfflineReviews();
    const lastSyncTime = this.getLastSyncTime();
    const lastSyncError = this.getLastSyncError();

    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingAnswers: answers.filter((a) => !a.synced).length,
      pendingPearlActions: pearlActions.filter((p) => !p.synced).length,
      pendingReviews: reviews.filter((r) => !r.synced).length,
      lastSyncTime,
      lastSyncError,
      isSyncing: this.isSyncing,
    };
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // ===========================================================================
  // ANSWER MANAGEMENT
  // ===========================================================================

  public queueAnswer(
    answer: Omit<OfflineAnswer, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>
  ): string {
    const id = `answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const offlineAnswer: OfflineAnswer = {
      ...answer,
      id,
      timestamp: Date.now(),
      synced: false,
      syncAttempts: 0,
    };

    const answers = this.getOfflineAnswers();
    answers.push(offlineAnswer);
    this.saveOfflineAnswers(answers);

    // Debug logging removed for production

    // Try immediate sync if online
    if (this.isOnline()) {
      this.syncAnswers().catch((err) => {
        const message = err instanceof Error ? err.message : 'Immediate answer sync failed';
        this.setLastSyncError(message);
        this.emit('sync-error', this.getStatus());
        this.scheduleRetry();
        logger.error(SCOPE, 'Immediate sync failed', err);
      });
    }

    return id;
  }

  private getOfflineAnswers(): OfflineAnswer[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_ANSWERS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveOfflineAnswers(answers: OfflineAnswer[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.OFFLINE_ANSWERS, JSON.stringify(answers));
  }

  // ===========================================================================
  // PEARL ACTION MANAGEMENT
  // ===========================================================================

  public queuePearlAction(
    action: Omit<OfflinePearlAction, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>
  ): string {
    const id = `pearl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const offlineAction: OfflinePearlAction = {
      ...action,
      id,
      timestamp: Date.now(),
      synced: false,
      syncAttempts: 0,
    };

    const actions = this.getOfflinePearlActions();
    actions.push(offlineAction);
    this.saveOfflinePearlActions(actions);

    // Debug logging removed for production

    // Try immediate sync if online
    if (this.isOnline()) {
      this.syncPearlActions().catch((err) =>
        logger.error(SCOPE, 'Immediate sync failed (pearls)', err)
      );
    }

    return id;
  }

  private getOfflinePearlActions(): OfflinePearlAction[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_PEARL_ACTIONS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveOfflinePearlActions(actions: OfflinePearlAction[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.OFFLINE_PEARL_ACTIONS, JSON.stringify(actions));
  }

  private removePearlAction(id: string): void {
    const actions = this.getOfflinePearlActions().filter((a) => a.id !== id);
    this.saveOfflinePearlActions(actions);
  }

  // ===========================================================================
  // REVIEW MANAGEMENT
  // ===========================================================================

  public queueReview(
    review: Omit<OfflineReview, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>
  ): string {
    const id = `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const offlineReview: OfflineReview = {
      ...review,
      id,
      timestamp: Date.now(),
      synced: false,
      syncAttempts: 0,
    };

    const reviews = this.getOfflineReviews();
    reviews.push(offlineReview);
    this.saveOfflineReviews(reviews);

    // Try immediate sync if online
    if (this.isOnline()) {
      this.syncReviews().catch((err) => {
        const message = err instanceof Error ? err.message : 'Immediate review sync failed';
        this.setLastSyncError(message);
        this.emit('sync-error', this.getStatus());
        this.scheduleRetry();
        logger.error(SCOPE, 'Immediate sync failed (reviews)', err);
      });
    }

    return id;
  }

  private getOfflineReviews(): OfflineReview[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_REVIEWS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveOfflineReviews(reviews: OfflineReview[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.OFFLINE_REVIEWS, JSON.stringify(reviews));
  }

  // ===========================================================================
  // SYNC OPERATIONS
  // ===========================================================================

  public async syncAll(token?: string | null): Promise<{ answers: number; pearls: number; reviews: number }> {
    if (this.isSyncing) {
      logger.debug(SCOPE, 'Sync already in progress');
      return { answers: 0, pearls: 0, reviews: 0 };
    }

    if (!this.isOnline()) {
      logger.debug(SCOPE, 'Offline, skipping sync');
      return { answers: 0, pearls: 0, reviews: 0 };
    }
    

    this.isSyncing = true;
    this.emit('sync-start', this.getStatus());

    try {
      const answersResult = await this.syncAnswers(token);
      const pearlsResult = await this.syncPearlActions(token);
      const reviewsResult = await this.syncReviews(token);

      this.setLastSyncTime(Date.now());
      this.clearLastSyncError();

      this.isSyncing = false;
      this.emit('sync-complete', this.getStatus());

      return {
        answers: answersResult,
        pearls: pearlsResult,
        reviews: reviewsResult,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.setLastSyncError(errorMessage);
      this.isSyncing = false;
      this.emit('sync-error', this.getStatus());

      // Schedule retry
      this.scheduleRetry();

      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncAnswers(token?: string | null): Promise<number> {
    const answers = this.getOfflineAnswers();
    const pending = answers.filter((a) => !a.synced && a.syncAttempts < 5);

    if (pending.length === 0) return 0;

    let synced = 0;

    for (const answer of pending) {
      try {
        const response = await fetch('/api/questions/attempt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            questionId: answer.questionId,
            wasCorrect: answer.isCorrect,
            timeSpentMs: answer.timeSpentMs,
            system: answer.system,
            conditionId: answer.conditionId,
            mode: 'session',
            isMainSession: answer.isMainSession ?? false,
            selectedAnswer: ['A', 'B', 'C', 'D'][answer.selectedAnswer],
            ...(answer.rating != null && { rating: answer.rating }),
            ...(answer.telemetryJson && { telemetryJson: answer.telemetryJson }),
            ...(answer.answerChangedCount != null && {
              answerChangedCount: answer.answerChangedCount,
            }),
            ...(answer.durationMs != null && { durationMs: answer.durationMs }),
          }),
        });

        if (response.ok) {
          answer.synced = true;
          const data = (await response.json().catch(() => ({}))) as {
            data?: { attemptId?: string };
            attemptId?: string;
          };
          const payload = data?.data ?? data;
          if (payload?.attemptId) answer.attemptId = payload.attemptId;
          synced++;
        } else {
          const message = await parseSyncErrorMessage(response);
          answer.syncAttempts++;
          answer.lastSyncError = message;
          this.setLastSyncError(message);
          this.scheduleRetry();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        answer.syncAttempts++;
        answer.lastSyncError = message;
        this.setLastSyncError(message);
        this.scheduleRetry();
      }
    }

    // Clean up synced items (keep for 24 hours for debugging)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = answers.filter((a) => !a.synced || a.timestamp > cutoff);
    this.saveOfflineAnswers(filtered);

    logger.debug(SCOPE, `Synced ${synced}/${pending.length} answers`);
    return synced;
  }

  private async syncPearlActions(token?: string | null): Promise<number> {
    const actions = this.getOfflinePearlActions();
    const pending = actions.filter((a) => !a.synced && a.syncAttempts < 5);

    if (pending.length === 0) return 0;

    let synced = 0;

    for (const action of pending) {
      try {
        // Cloudflare Functions use /api/user/pearls/* paths (not /api/pearls/*)
        // Supported actions: 'save' (toggle saved), 'useful' (mark useful/mastered)
        // Map legacy actions: mark_mastered/view → 'useful', review_later → skip, else → 'save'
        const endpoint =
          action.action === 'mark_mastered' || action.action === 'view'
            ? `/api/user/pearls/${action.pearlId}/useful`
            : action.action === 'review_later'
              ? null // No CF endpoint for schedule; skip sync
              : `/api/user/pearls/${action.pearlId}/save`;

        if (!endpoint) {
          // Skip unsupported action (review_later/schedule not implemented in CF)
          await this.removePearlAction(action.id);
          continue;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: action.action,
            scheduledDate: action.scheduledReviewDate,
            offlineTimestamp: action.timestamp,
          }),
        });

        if (response.ok) {
          action.synced = true;
          synced++;
        } else {
          action.syncAttempts++;
          this.scheduleRetry();
        }
      } catch (error) {
        action.syncAttempts++;
        this.scheduleRetry();
      }
    }

    // Clean up synced items
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = actions.filter((a) => !a.synced || a.timestamp > cutoff);
    this.saveOfflinePearlActions(filtered);

    logger.debug(SCOPE, `Synced ${synced}/${pending.length} pearl actions`);
    return synced;
  }

  private async syncReviews(token?: string | null): Promise<number> {
    const reviews = this.getOfflineReviews();
    const pending = reviews.filter((r) => !r.synced && r.syncAttempts < 5);

    if (pending.length === 0) return 0;

    // Map to batch payload
    const batch = pending.map((r) => ({
      questionId: r.questionId,
      selectedAnswer: r.selectedAnswer,
      timeSpentMs: r.timeSpentMs,
      timeToFirstClick: r.timeToFirstClick,
      answerSwitches: r.answerSwitches,
      totalDwellTime: r.totalDwellTime,
      timezone: r.timezone,
      wakeTimeHHMM: r.wakeTimeHHMM,
      telemetry: r.telemetry,
      sessionType: r.sessionType,
    }));

    let synced = 0;
    try {
      const response = await fetch('/api/drills/submit-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(batch),
      });

      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          data?: Array<{ questionId: string; success: boolean; error?: string }>;
        };
        const results = data?.data ?? [];

        if (!Array.isArray(results) || results.length === 0) {
          const message = 'Review sync did not return per-item status';
          pending.forEach((review) => {
            review.syncAttempts++;
            review.lastSyncError = message;
          });
          this.setLastSyncError(message);
          this.scheduleRetry();
        } else {
          const questionIdBuckets = new Map<
            string,
            { results: Array<{ questionId: string; success: boolean; error?: string }>; cursor: number }
          >();
          for (const result of results) {
            const bucket = questionIdBuckets.get(result.questionId) ?? { results: [], cursor: 0 };
            bucket.results.push(result);
            questionIdBuckets.set(result.questionId, bucket);
          }

          pending.forEach((review, index) => {
            const positionalResult = results[index];
            const bucket = questionIdBuckets.get(review.questionId);
            const fallback =
              bucket && bucket.cursor < bucket.results.length
                ? bucket.results[bucket.cursor++]
                : undefined;
            const result =
              positionalResult?.questionId === review.questionId
                ? positionalResult
                : fallback;
            if (result?.success) {
              review.synced = true;
              synced++;
            } else {
              review.syncAttempts++;
              review.lastSyncError = result?.error || 'Batch failure';
            }
          });
        }
      } else {
        const message = await parseSyncErrorMessage(response);
        // If batch fails, increment attempts for all pending reviews
        pending.forEach((review) => {
          review.syncAttempts++;
          review.lastSyncError = message;
        });
        this.setLastSyncError(message);
        this.scheduleRetry();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      pending.forEach((review) => {
        review.syncAttempts++;
        review.lastSyncError = message;
      });
      this.setLastSyncError(message);
      this.scheduleRetry();
      // Save incremented attempts before rethrowing
      this.saveOfflineReviews(reviews);
      throw error;
    }

    // Clean up synced items (keep for 24 hours for debugging)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = reviews.filter((r) => !r.synced || r.timestamp > cutoff);
    this.saveOfflineReviews(filtered);

    logger.debug(SCOPE, `Synced ${synced}/${pending.length} reviews`);
    return synced;
  }

  private scheduleRetry(): void {
    if (this.syncRetryTimeout) {
      clearTimeout(this.syncRetryTimeout);
    }

    // Exponential backoff: 30s, 60s, 120s, max 5 minutes
    const retryDelay = Math.min(
      30000 * Math.pow(2, this.getStatus().pendingAnswers > 0 ? 1 : 0),
      300000
    );

    this.syncRetryTimeout = setTimeout(() => {
      if (this.isOnline()) {
        this.syncAll().catch(() => {});
      }
    }, retryDelay);
  }

  // ===========================================================================
  // STORAGE HELPERS
  // ===========================================================================

  private getLastSyncTime(): number | null {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
    return stored ? parseInt(stored, 10) : null;
  }

  private setLastSyncTime(time: number): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, String(time));
  }

  private getLastSyncError(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.SYNC_ERROR);
  }

  private setLastSyncError(error: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.SYNC_ERROR, error);
  }

  private clearLastSyncError(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.SYNC_ERROR);
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  public clearAllPending(): void {
    this.saveOfflineAnswers([]);
    this.saveOfflinePearlActions([]);
    logger.debug(SCOPE, 'Cleared all pending items');
  }
}

export { SyncManager };

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const syncManager = new SyncManager();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for sync status and operations
 */
export function useSyncManager() {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

  useEffect(() => {
    const unsubOnline = syncManager.on('online', setStatus);
    const unsubOffline = syncManager.on('offline', setStatus);
    const unsubStart = syncManager.on('sync-start', setStatus);
    const unsubComplete = syncManager.on('sync-complete', setStatus);
    const unsubError = syncManager.on('sync-error', setStatus);

    return () => {
      unsubOnline();
      unsubOffline();
      unsubStart();
      unsubComplete();
      unsubError();
    };
  }, []);

  const queueAnswer = useCallback(
    (answer: Omit<OfflineAnswer, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>) => {
      return syncManager.queueAnswer(answer);
    },
    []
  );

  const queuePearlAction = useCallback(
    (action: Omit<OfflinePearlAction, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>) => {
      return syncManager.queuePearlAction(action);
    },
    []
  );

  const queueReview = useCallback(
    (review: Omit<OfflineReview, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>) => {
      return syncManager.queueReview(review);
    },
    []
  );

  const syncNow = useCallback((token?: string | null) => {
    return syncManager.syncAll(token);
  }, []);

  return {
    status,
    isOnline: status.isOnline,
    pendingCount: status.pendingAnswers + status.pendingPearlActions + status.pendingReviews,
    queueAnswer,
    queuePearlAction,
    queueReview,
    syncNow,
  };
}
