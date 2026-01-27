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

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineAnswer {
  id: string;
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  timeSpentMs: number;
  confidence?: number;
  rating?: 1 | 2 | 3 | 4; // FSRS rating
  sessionId?: string;
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

export interface SyncStatus {
  isOnline: boolean;
  pendingAnswers: number;
  pendingPearlActions: number;
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
  LAST_SYNC_TIME: 'panceai_last_sync_time',
  SYNC_ERROR: 'panceai_sync_error',
} as const;

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
    this.syncAll().catch((err) => console.error('[SyncManager] Auto-sync failed:', err));
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
    const lastSyncTime = this.getLastSyncTime();
    const lastSyncError = this.getLastSyncError();

    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingAnswers: answers.filter((a) => !a.synced).length,
      pendingPearlActions: pearlActions.filter((p) => !p.synced).length,
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

  public queueAnswer(answer: Omit<OfflineAnswer, 'id' | 'timestamp' | 'synced' | 'syncAttempts'>): string {
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
      this.syncAnswers().catch((err) => console.error('[SyncManager] Immediate sync failed:', err));
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
      this.syncPearlActions().catch((err) => console.error('[SyncManager] Immediate sync failed:', err));
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

  // ===========================================================================
  // SYNC OPERATIONS
  // ===========================================================================

  public async syncAll(token?: string | null): Promise<{ answers: number; pearls: number }> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress');
      return { answers: 0, pearls: 0 };
    }

    if (!this.isOnline()) {
      console.log('[SyncManager] Offline, skipping sync');
      return { answers: 0, pearls: 0 };
    }

    this.isSyncing = true;
    this.emit('sync-start', this.getStatus());

    try {
      const answersResult = await this.syncAnswers(token);
      const pearlsResult = await this.syncPearlActions(token);

      this.setLastSyncTime(Date.now());
      this.clearLastSyncError();

      this.emit('sync-complete', this.getStatus());

      return {
        answers: answersResult,
        pearls: pearlsResult,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.setLastSyncError(errorMessage);
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
        const response = await fetch('/api/questions/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            questionId: answer.questionId,
            selectedAnswer: answer.selectedAnswer,
            isCorrect: answer.isCorrect,
            timeSpentMs: answer.timeSpentMs,
            confidence: answer.confidence,
            rating: answer.rating,
            sessionId: answer.sessionId,
            offlineTimestamp: answer.timestamp,
          }),
        });

        if (response.ok) {
          answer.synced = true;
          synced++;
        } else {
          answer.syncAttempts++;
          answer.lastSyncError = `HTTP ${response.status}`;
        }
      } catch (error) {
        answer.syncAttempts++;
        answer.lastSyncError = error instanceof Error ? error.message : 'Network error';
      }
    }

    // Clean up synced items (keep for 24 hours for debugging)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = answers.filter((a) => !a.synced || a.timestamp > cutoff);
    this.saveOfflineAnswers(filtered);

    console.log(`[SyncManager] Synced ${synced}/${pending.length} answers`);
    return synced;
  }

  private async syncPearlActions(token?: string | null): Promise<number> {
    const actions = this.getOfflinePearlActions();
    const pending = actions.filter((a) => !a.synced && a.syncAttempts < 5);

    if (pending.length === 0) return 0;

    let synced = 0;

    for (const action of pending) {
      try {
        const endpoint =
          action.action === 'view'
            ? `/api/pearls/${action.pearlId}/view`
            : action.action === 'mark_mastered'
            ? `/api/pearls/${action.pearlId}/mastered`
            : action.action === 'review_later'
            ? `/api/pearls/${action.pearlId}/schedule`
            : `/api/pearls/${action.pearlId}/save`;

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
        }
      } catch (error) {
        action.syncAttempts++;
      }
    }

    // Clean up synced items
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = actions.filter((a) => !a.synced || a.timestamp > cutoff);
    this.saveOfflinePearlActions(filtered);

    console.log(`[SyncManager] Synced ${synced}/${pending.length} pearl actions`);
    return synced;
  }

  private scheduleRetry(): void {
    if (this.syncRetryTimeout) {
      clearTimeout(this.syncRetryTimeout);
    }

    // Exponential backoff: 30s, 60s, 120s, max 5 minutes
    const retryDelay = Math.min(30000 * Math.pow(2, this.getStatus().pendingAnswers > 0 ? 1 : 0), 300000);

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
    console.log('[SyncManager] Cleared all pending items');
  }
}

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

  const syncNow = useCallback((token?: string | null) => {
    return syncManager.syncAll(token);
  }, []);

  return {
    status,
    isOnline: status.isOnline,
    pendingCount: status.pendingAnswers + status.pendingPearlActions,
    queueAnswer,
    queuePearlAction,
    syncNow,
  };
}
