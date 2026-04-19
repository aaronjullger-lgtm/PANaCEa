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

import { logger } from "@/lib/simple-logger";
import type { TelemetryData } from '@/types/telemetry';
import { offlineStore, isIndexedDBAvailable } from './offlineStore';

const SCOPE = 'SyncManager';
const syncLog = logger.scope(SCOPE);

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
  /** Sprint S1: True once this item exhausted MAX_SYNC_ATTEMPTS. Excluded from pending, surfaced to UI for user-driven recovery. */
  deadLettered?: boolean;
}

export interface OfflinePearlAction {
  id: string;
  pearlId: string;
  action: 'view' | 'mark_mastered' | 'review_later' | 'save' | 'unsave';
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncError?: string;
  /** Sprint S1: True once this item exhausted MAX_SYNC_ATTEMPTS. Excluded from pending, surfaced to UI for user-driven recovery. */
  deadLettered?: boolean;
  // For review_later, track the scheduled date
  scheduledReviewDate?: string;
}

export interface OfflineReview {
  id: string;
  questionId: string;
  selectedAnswer: string | number;
  timeSpentMs: number;
  timeToFirstClick?: number;
  answerSwitches?: number;
  totalDwellTime?: number;
  timezone?: string;
  wakeTimeHHMM?: string;
  telemetry?: TelemetryData | Record<string, unknown>;
  sessionType?: string;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncError?: string;
  /** Sprint S1: True once this item exhausted MAX_SYNC_ATTEMPTS. Excluded from pending, surfaced to UI for user-driven recovery. */
  deadLettered?: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingAnswers: number;
  pendingPearlActions: number;
  pendingReviews: number;
  /** Sprint S1: Items that exhausted MAX_SYNC_ATTEMPTS and need user-driven recovery. */
  deadLetteredAnswers: number;
  deadLetteredPearlActions: number;
  deadLetteredReviews: number;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  isSyncing: boolean;
}

type SyncEventType =
  | 'online'
  | 'offline'
  | 'sync-start'
  | 'sync-complete'
  | 'sync-error'
  /** Sprint S1: An item transitioned to dead-letter state (exhausted MAX_SYNC_ATTEMPTS). */
  | 'dead-letter'
  /** Sprint S2: localStorage quota exceeded; IndexedDB fallback is active for new writes. */
  | 'storage-full';
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

/**
 * Sprint S1: Maximum sync attempts before an item is marked dead-lettered.
 * Dead-lettered items are excluded from auto-retry and require explicit user action
 * (retry via `retryDeadLettered()` or discard via `discardDeadLettered()`).
 */
const MAX_SYNC_ATTEMPTS = 5;

/** Structural shape shared by OfflineAnswer / OfflineReview / OfflinePearlAction for predicates. */
interface SyncableItem {
  synced: boolean;
  syncAttempts: number;
  deadLettered?: boolean;
}

/** True if item is eligible for automatic sync retry. */
function isPendingItem<T extends SyncableItem>(item: T): boolean {
  return !item.synced && item.syncAttempts < MAX_SYNC_ATTEMPTS && item.deadLettered !== true;
}

/**
 * True if item has exhausted automatic retries and needs user-driven recovery.
 * Also catches legacy items written before the deadLettered field existed (syncAttempts >= MAX).
 */
function isDeadLetteredItem<T extends SyncableItem>(item: T): boolean {
  return !item.synced && (item.deadLettered === true || item.syncAttempts >= MAX_SYNC_ATTEMPTS);
}

/**
 * Sprint S2: Detect QuotaExceededError across browsers.
 * Chrome/Edge/Safari throw DOMException with name 'QuotaExceededError';
 * Firefox uses code 1014 ('NS_ERROR_DOM_QUOTA_REACHED').
 */
function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  if (e.name === 'QuotaExceededError') return true;
  if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (e.code === 22 || e.code === 1014) return true;
  if (typeof e.message === 'string' && /quota/i.test(e.message)) return true;
  return false;
}

/**
 * Best-effort filter of `synced === true` items out of a JSON-serialized array.
 * Used by safeSetItem's quota-retry path to ensure we don't overwrite the
 * post-prune localStorage state with the caller's pre-prune array. Falls back
 * to the original value on any parse/shape surprise — correctness of the write
 * matters more than the extra bytes reclaimed.
 */
function pruneSyncedFromJsonValue(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return value;
    const filtered = parsed.filter(
      (item: unknown) =>
        !item || typeof item !== 'object' || (item as { synced?: boolean }).synced !== true,
    );
    if (filtered.length === parsed.length) return value;
    return JSON.stringify(filtered);
  } catch {
    return value;
  }
}

async function parseSyncErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; message?: string; details?: string };
    const message = payload?.error || payload?.message || payload?.details;
    if (message) return message;
  } catch (err) {
    console.debug('[SyncManager] non-JSON error payload, falling back to HTTP status', err);
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
  /** Tracks consecutive sync failures for true exponential backoff (Finding 7 fix). */
  private consecutiveFailures = 0;
  /** Async token provider (e.g., Clerk's getToken). Called before each sync to get a fresh JWT. */
  private tokenProvider: (() => Promise<string | null>) | null = null;

  constructor() {
    // Set up online/offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * Register an async token provider (e.g., Clerk's getToken).
   * Called automatically before each sync to obtain a fresh auth token.
   * This fixes the critical bug where immediate syncs and auto-retries
   * sent requests without Authorization headers, causing silent 401s.
   */
  public setTokenProvider(provider: (() => Promise<string | null>) | null): void {
    this.tokenProvider = provider;
  }

  /**
   * Get a fresh auth token from the registered provider, or fall back to the explicit token.
   * Returns null if no provider is registered and no explicit token was given.
   */
  private async resolveToken(explicitToken?: string | null): Promise<string | null> {
    if (explicitToken) return explicitToken;
    if (this.tokenProvider) {
      try {
        return await this.tokenProvider();
      } catch (err) {
        syncLog.warn('Token provider failed, proceeding without auth', { error: err });
        return null;
      }
    }
    return null;
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  private handleOnline(): void {
    this.emit('online', this.getStatus());
    // Automatically sync when coming online
    this.syncAll().catch((err) => syncLog.error('Auto-sync failed', { error: err }));
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
      // Sprint S1: pending excludes dead-lettered items so UI doesn't spin forever on exhausted items.
      pendingAnswers: answers.filter(isPendingItem).length,
      pendingPearlActions: pearlActions.filter(isPendingItem).length,
      pendingReviews: reviews.filter(isPendingItem).length,
      deadLetteredAnswers: answers.filter(isDeadLetteredItem).length,
      deadLetteredPearlActions: pearlActions.filter(isDeadLetteredItem).length,
      deadLetteredReviews: reviews.filter(isDeadLetteredItem).length,
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

    // Dual-write to IndexedDB for Background Sync support
    this.writeToIndexedDB('answers', offlineAnswer);

    // Try immediate sync if online
    if (this.isOnline()) {
      this.syncAnswers().catch((err) => {
        const message = err instanceof Error ? err.message : 'Immediate answer sync failed';
        this.setLastSyncError(message);
        this.emit('sync-error', this.getStatus());
        this.scheduleRetry();
        syncLog.error('Immediate sync failed', { error: err });
      });
    } else {
      // Register Background Sync so the SW retries when connectivity returns
      this.registerBackgroundSync('sync-answers');
    }

    return id;
  }

  private getOfflineAnswers(): OfflineAnswer[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_ANSWERS);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.debug('[SyncManager] failed to parse offline answers from localStorage', err);
      return [];
    }
  }

  private saveOfflineAnswers(answers: OfflineAnswer[]): void {
    // Sprint S2: quota-aware write — on QuotaExceededError, prune synced items across
    // all three stores and retry once. IndexedDB dual-write still captures the record.
    this.safeSetItem(STORAGE_KEYS.OFFLINE_ANSWERS, JSON.stringify(answers));
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
        syncLog.error('Immediate sync failed (pearls)', { error: err })
      );
    }

    return id;
  }

  private getOfflinePearlActions(): OfflinePearlAction[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_PEARL_ACTIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.debug('[SyncManager] failed to parse offline pearl actions from localStorage', err);
      return [];
    }
  }

  private saveOfflinePearlActions(actions: OfflinePearlAction[]): void {
    this.safeSetItem(STORAGE_KEYS.OFFLINE_PEARL_ACTIONS, JSON.stringify(actions));
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

    // Dual-write to IndexedDB for Background Sync support
    this.writeToIndexedDB('reviews', offlineReview);

    // Try immediate sync if online
    if (this.isOnline()) {
      this.syncReviews().catch((err) => {
        const message = err instanceof Error ? err.message : 'Immediate review sync failed';
        this.setLastSyncError(message);
        this.emit('sync-error', this.getStatus());
        this.scheduleRetry();
        syncLog.error('Immediate sync failed (reviews)', { error: err });
      });
    } else {
      // Register Background Sync so the SW retries when connectivity returns
      this.registerBackgroundSync('sync-reviews');
    }

    return id;
  }

  private getOfflineReviews(): OfflineReview[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_REVIEWS);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.debug('[SyncManager] failed to parse offline reviews from localStorage', err);
      return [];
    }
  }

  private saveOfflineReviews(reviews: OfflineReview[]): void {
    this.safeSetItem(STORAGE_KEYS.OFFLINE_REVIEWS, JSON.stringify(reviews));
  }

  // ===========================================================================
  // SYNC OPERATIONS
  // ===========================================================================

  public async syncAll(token?: string | null): Promise<{ answers: number; pearls: number; reviews: number }> {
    if (this.isSyncing) {
      syncLog.debug('Sync already in progress');
      return { answers: 0, pearls: 0, reviews: 0 };
    }

    if (!this.isOnline()) {
      syncLog.debug('Offline, skipping sync');
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

      // Only reset consecutiveFailures if all pending items synced successfully.
      // If some items failed (partial sync), increment the counter so backoff
      // increases on the next retry — this covers per-item failures inside
      // syncAnswers/syncReviews/syncPearlActions that don't throw at syncAll level.
      // Sprint S1: use isPendingItem to exclude dead-lettered items from partial-failure detection.
      const hadPartialFailure =
        this.getOfflineAnswers().some((a) => isPendingItem(a) && a.syncAttempts > 0) ||
        this.getOfflineReviews().some((r) => isPendingItem(r) && r.syncAttempts > 0) ||
        this.getOfflinePearlActions().some((p) => isPendingItem(p) && p.syncAttempts > 0);
      if (hadPartialFailure) {
        this.consecutiveFailures++;
      } else {
        this.consecutiveFailures = 0;
      }

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
      this.consecutiveFailures++;
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
    const resolvedToken = await this.resolveToken(token);
    const answers = this.getOfflineAnswers();
    const pending = answers.filter(isPendingItem);

    if (pending.length === 0) return 0;

    let synced = 0;

    for (const answer of pending) {
      try {
        const response = await fetch('/api/questions/attempt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
          },
          body: JSON.stringify({
            questionId: answer.questionId,
            wasCorrect: answer.isCorrect,
            timeSpentMs: answer.timeSpentMs,
            system: answer.system,
            conditionId: answer.conditionId,
            mode: 'session',
            // isMainSession is recorded on the QuestionAttempt for stats/Rolling360 dedup
            // but is NOT used for FSRS — that flows through queueReview → drillReviewService.
            isMainSession: answer.isMainSession ?? false,
            selectedAnswer: ['A', 'B', 'C', 'D', 'E'][answer.selectedAnswer],
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
          this.maybeDeadLetter(answer);
          this.setLastSyncError(message);
          this.scheduleRetry();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        answer.syncAttempts++;
        answer.lastSyncError = message;
        this.maybeDeadLetter(answer);
        this.setLastSyncError(message);
        this.scheduleRetry();
      }
    }

    // Clean up synced items (keep for 24 hours for debugging)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = answers.filter((a) => !a.synced || a.timestamp > cutoff);
    this.saveOfflineAnswers(filtered);

    syncLog.debug(`Synced ${synced}/${pending.length} answers`);
    return synced;
  }

  private async syncPearlActions(token?: string | null): Promise<number> {
    const resolvedToken = await this.resolveToken(token);
    const actions = this.getOfflinePearlActions();
    const pending = actions.filter(isPendingItem);

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
            ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
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
          const message = await parseSyncErrorMessage(response);
          action.syncAttempts++;
          action.lastSyncError = message;
          this.maybeDeadLetter(action);
          this.scheduleRetry();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        action.syncAttempts++;
        action.lastSyncError = message;
        this.maybeDeadLetter(action);
        // Log at debug so repeated transient failures don't flood, but the error
        // isn't invisible when a pearl sync genuinely breaks for every action.
        syncLog.debug('Pearl action sync attempt failed', {
          error,
          attempts: action.syncAttempts,
        });
        this.scheduleRetry();
      }
    }

    // Clean up synced items
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = actions.filter((a) => !a.synced || a.timestamp > cutoff);
    this.saveOfflinePearlActions(filtered);

    syncLog.debug(`Synced ${synced}/${pending.length} pearl actions`);
    return synced;
  }

  private async syncReviews(token?: string | null): Promise<number> {
    const resolvedToken = await this.resolveToken(token);
    const reviews = this.getOfflineReviews();
    const pending = reviews.filter(isPendingItem);

    if (pending.length === 0) return 0;

    // Map to batch payload.
    //
    // Sprint S3 — each item carries its queued `id` as the idempotencyKey.
    // The Edge endpoint caches successful per-item responses under this key,
    // so a retry of the same batch after a transient failure will short-circuit
    // items that already landed instead of creating duplicate FSRS rows.
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
      idempotencyKey: r.id,
    }));

    let synced = 0;
    try {
      const response = await fetch('/api/drills/submit-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
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
              this.maybeDeadLetter(review);
            }
          });
        }
      } else {
        const message = await parseSyncErrorMessage(response);
        // If batch fails, increment attempts for all pending reviews
        pending.forEach((review) => {
          review.syncAttempts++;
          review.lastSyncError = message;
          this.maybeDeadLetter(review);
        });
        this.setLastSyncError(message);
        this.scheduleRetry();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      pending.forEach((review) => {
        review.syncAttempts++;
        review.lastSyncError = message;
        this.maybeDeadLetter(review);
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

    syncLog.debug(`Synced ${synced}/${pending.length} reviews`);
    return synced;
  }

  private scheduleRetry(): void {
    if (this.syncRetryTimeout) {
      clearTimeout(this.syncRetryTimeout);
    }

    // Exponential backoff using consecutive failure count: 30s → 60s → 120s → 240s → 300s (cap)
    const baseDelay = Math.min(
      30000 * Math.pow(2, Math.min(this.consecutiveFailures, 4)),
      300000
    );

    // ±25% jitter to prevent thundering herd when multiple clients reconnect simultaneously
    const jitter = baseDelay * (0.75 + Math.random() * 0.5);
    const retryDelay = Math.round(jitter);

    this.syncRetryTimeout = setTimeout(() => {
      if (this.isOnline()) {
        this.syncAll().catch((err) => syncLog.warn('Background sync failed', { error: err }));
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
  // SPRINT S1: DEAD-LETTER TRANSITION
  // ===========================================================================

  /**
   * Mark an item as dead-lettered if it has reached MAX_SYNC_ATTEMPTS.
   * Emits a 'dead-letter' event so UI can surface the recovery affordance.
   * Idempotent: safe to call repeatedly on the same item.
   */
  private maybeDeadLetter<T extends SyncableItem>(item: T): void {
    if (item.synced) return;
    if (item.deadLettered === true) return;
    if (item.syncAttempts < MAX_SYNC_ATTEMPTS) return;

    item.deadLettered = true;
    syncLog.warn('Item exhausted retries and is now dead-lettered', {
      attempts: item.syncAttempts,
    });
    // Defer the status snapshot until listeners run — the caller is mid-loop
    // and will save the updated array before returning.
    this.emit('dead-letter', this.getStatus());
  }

  // ===========================================================================
  // SPRINT S2: QUOTA-AWARE LOCALSTORAGE WRITES
  // ===========================================================================

  /**
   * Set a key in localStorage with QuotaExceededError recovery.
   * On quota error: prune synced items across all three stores and retry once.
   * If retry still fails, emit 'storage-full' so the UI can warn the user —
   * IndexedDB dual-write still holds the record, so no data is lost.
   */
  private safeSetItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      if (!isQuotaError(err)) {
        syncLog.warn('localStorage.setItem failed with non-quota error', { error: err, key });
        throw err;
      }
      syncLog.warn('localStorage quota exceeded; pruning synced items and retrying', { key });
      const pruned = this.pruneSyncedItems();
      syncLog.debug(`Pruned ${pruned} synced items to reclaim space`);
      // Filter synced items out of the caller-supplied value too — otherwise the
      // retry would overwrite the just-pruned localStorage with the full unpruned
      // array that the caller built from a pre-prune in-memory snapshot.
      const retryValue = pruneSyncedFromJsonValue(value);
      try {
        localStorage.setItem(key, retryValue);
      } catch (retryErr) {
        if (!isQuotaError(retryErr)) {
          syncLog.warn('localStorage.setItem retry failed with non-quota error', {
            error: retryErr,
            key,
          });
          throw retryErr;
        }
        // Still full after pruning — persist-to-IndexedDB path already captured the record,
        // so we surface a warning instead of crashing the session.
        syncLog.error('localStorage remains full after pruning; record persisted to IndexedDB only', {
          key,
        });
        this.emit('storage-full', this.getStatus());
      }
    }
  }

  /**
   * Drop all items across answers/reviews/pearl-actions that are already synced.
   * Called on quota-exceeded to reclaim space before retrying a write.
   * Returns the total number of items pruned.
   */
  private pruneSyncedItems(): number {
    if (typeof localStorage === 'undefined') return 0;
    let pruned = 0;

    const pruneKey = <T extends { synced: boolean }>(key: string): number => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return 0;
        const items = JSON.parse(raw) as T[];
        if (!Array.isArray(items)) return 0;
        const before = items.length;
        const kept = items.filter((item) => !item.synced);
        if (kept.length === before) return 0;
        // Use direct setItem — we're already inside a quota-recovery path,
        // and JSON.stringify of a smaller array is guaranteed to fit if the
        // original did plus at minimum one extra item.
        localStorage.setItem(key, JSON.stringify(kept));
        return before - kept.length;
      } catch (err) {
        syncLog.debug('pruneSyncedItems key failed', { key, error: err });
        return 0;
      }
    };

    pruned += pruneKey<OfflineAnswer>(STORAGE_KEYS.OFFLINE_ANSWERS);
    pruned += pruneKey<OfflineReview>(STORAGE_KEYS.OFFLINE_REVIEWS);
    pruned += pruneKey<OfflinePearlAction>(STORAGE_KEYS.OFFLINE_PEARL_ACTIONS);
    return pruned;
  }

  // ===========================================================================
  // SPRINT S1: DEAD-LETTER RECOVERY API (public)
  // ===========================================================================

  /**
   * Return all dead-lettered items (answers, reviews, pearl actions) for UI display.
   * Users can inspect these, then call retryDeadLettered() or discardDeadLettered().
   */
  public getDeadLetteredItems(): {
    answers: OfflineAnswer[];
    reviews: OfflineReview[];
    pearlActions: OfflinePearlAction[];
  } {
    return {
      answers: this.getOfflineAnswers().filter(isDeadLetteredItem),
      reviews: this.getOfflineReviews().filter(isDeadLetteredItem),
      pearlActions: this.getOfflinePearlActions().filter(isDeadLetteredItem),
    };
  }

  /**
   * Reset all dead-lettered items back to pending (syncAttempts=0, deadLettered=false)
   * and trigger a fresh sync. If the underlying issue is still present, they will
   * be re-flagged after MAX_SYNC_ATTEMPTS.
   */
  public async retryDeadLettered(token?: string | null): Promise<{ answers: number; pearls: number; reviews: number }> {
    const answers = this.getOfflineAnswers();
    answers.forEach((a) => {
      if (isDeadLetteredItem(a)) {
        a.syncAttempts = 0;
        a.deadLettered = false;
        a.lastSyncError = undefined;
      }
    });
    this.saveOfflineAnswers(answers);

    const reviews = this.getOfflineReviews();
    reviews.forEach((r) => {
      if (isDeadLetteredItem(r)) {
        r.syncAttempts = 0;
        r.deadLettered = false;
        r.lastSyncError = undefined;
      }
    });
    this.saveOfflineReviews(reviews);

    const pearlActions = this.getOfflinePearlActions();
    pearlActions.forEach((p) => {
      if (isDeadLetteredItem(p)) {
        p.syncAttempts = 0;
        p.deadLettered = false;
        p.lastSyncError = undefined;
      }
    });
    this.saveOfflinePearlActions(pearlActions);

    // Reset consecutive failure counter so backoff starts fresh.
    this.consecutiveFailures = 0;
    this.clearLastSyncError();

    return this.syncAll(token);
  }

  /**
   * Permanently discard all dead-lettered items. Caller should confirm with the user
   * first — this data will not reach the server.
   */
  public discardDeadLettered(): { answers: number; reviews: number; pearlActions: number } {
    const counts = { answers: 0, reviews: 0, pearlActions: 0 };

    const answers = this.getOfflineAnswers();
    const keptAnswers = answers.filter((a) => !isDeadLetteredItem(a));
    counts.answers = answers.length - keptAnswers.length;
    if (counts.answers > 0) this.saveOfflineAnswers(keptAnswers);

    const reviews = this.getOfflineReviews();
    const keptReviews = reviews.filter((r) => !isDeadLetteredItem(r));
    counts.reviews = reviews.length - keptReviews.length;
    if (counts.reviews > 0) this.saveOfflineReviews(keptReviews);

    const pearlActions = this.getOfflinePearlActions();
    const keptActions = pearlActions.filter((p) => !isDeadLetteredItem(p));
    counts.pearlActions = pearlActions.length - keptActions.length;
    if (counts.pearlActions > 0) this.saveOfflinePearlActions(keptActions);

    // Best-effort IndexedDB cleanup
    isIndexedDBAvailable().then((available) => {
      if (!available) return;
      // IndexedDB doesn't track dead-letter flags; full clear is too aggressive,
      // so we leave IDB records to fall out via the normal 24h cleanup window.
      syncLog.debug('discardDeadLettered: localStorage pruned; IDB retains records');
    }).catch(() => {});

    if (counts.answers + counts.reviews + counts.pearlActions > 0) {
      this.emit('sync-complete', this.getStatus());
    }
    return counts;
  }

  // ===========================================================================
  // INDEXEDDB + BACKGROUND SYNC
  // ===========================================================================

  /**
   * Dual-write a record to IndexedDB (for Background Sync / service worker access).
   * Fire-and-forget — localStorage remains the primary store.
   */
  private writeToIndexedDB(
    store: 'answers' | 'reviews' | 'pearlActions',
    record: OfflineAnswer | OfflineReview | OfflinePearlAction
  ): void {
    isIndexedDBAvailable().then((available) => {
      if (!available) return;
      const target = offlineStore[store];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (target as any).add(record).catch((err: unknown) => {
        syncLog.warn(`IndexedDB write failed for ${store}`, { error: err });
      });
    }).catch(() => { syncLog.debug('IndexedDB not available for persist'); });
  }

  /**
   * Register a Background Sync event with the service worker.
   * Progressive enhancement — silently no-ops if not supported.
   */
  private registerBackgroundSync(tag: string): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        // Background Sync API (Chrome/Edge/Android)
        if ('sync' in reg) {
          return (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
        }
        return undefined;
      })
      .then(() => {
        syncLog.debug(`Background sync registered: ${tag}`);
      })
      .catch((err) => {
        // Expected on iOS/Firefox — they don't support Background Sync
        syncLog.debug(`Background sync registration failed (expected on some browsers): ${tag}`, {
          error: err,
        });
      });
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  public clearAllPending(): void {
    this.saveOfflineAnswers([]);
    this.saveOfflinePearlActions([]);
    // Finding 8 fix: also clear offline reviews from localStorage.
    // IndexedDB reviews were already cleared below, but localStorage reviews
    // were not — stale reviews could re-sync as ghost records.
    this.saveOfflineReviews([]);
    // Also clear IndexedDB stores
    isIndexedDBAvailable().then((available) => {
      if (available) {
        offlineStore.answers.clear().catch((e) => syncLog.debug('IndexedDB answers clear skipped', { error: e }));
        offlineStore.pearlActions.clear().catch((e) => syncLog.debug('IndexedDB pearlActions clear skipped', { error: e }));
        offlineStore.reviews.clear().catch((e) => syncLog.debug('IndexedDB reviews clear skipped', { error: e }));
      }
    }).catch(() => { syncLog.debug('IndexedDB not available for clear'); });
    syncLog.debug('Cleared all pending items');
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

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * React hook for sync status and operations.
 *
 * @param tokenProvider - Optional async function that returns a fresh auth token
 *   (e.g., Clerk's `getToken`). When provided, the SyncManager will call it
 *   before every sync so that immediate syncs, auto-retries, and online-recovery
 *   syncs all include the Authorization header. This fixes the critical bug where
 *   answers were queued to localStorage but never reached the database.
 */
export function useSyncManager(tokenProvider?: () => Promise<string | null>) {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

  // Keep the token provider ref stable to avoid re-registering on every render
  const tokenProviderRef = useRef(tokenProvider);
  tokenProviderRef.current = tokenProvider;

  useEffect(() => {
    // Register token provider so ALL sync paths (immediate, retry, online-recovery) are authenticated
    if (tokenProviderRef.current) {
      syncManager.setTokenProvider(() => tokenProviderRef.current!());
    }
    return () => {
      // Clean up on unmount — don't leave a stale provider
      syncManager.setTokenProvider(null);
    };
  }, []); // Intentionally empty: ref tracks latest provider without re-running effect

  useEffect(() => {
    const unsubOnline = syncManager.on('online', setStatus);
    const unsubOffline = syncManager.on('offline', setStatus);
    const unsubStart = syncManager.on('sync-start', setStatus);
    const unsubComplete = syncManager.on('sync-complete', setStatus);
    const unsubError = syncManager.on('sync-error', setStatus);
    // Sprint S1+S2: subscribe to dead-letter and storage-full so the UI updates
    // immediately when an item exhausts retries or when localStorage fills up.
    const unsubDeadLetter = syncManager.on('dead-letter', setStatus);
    const unsubStorageFull = syncManager.on('storage-full', setStatus);

    return () => {
      unsubOnline();
      unsubOffline();
      unsubStart();
      unsubComplete();
      unsubError();
      unsubDeadLetter();
      unsubStorageFull();
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

  // Sprint S1: expose dead-letter recovery actions to UI.
  const retryDeadLettered = useCallback((token?: string | null) => {
    return syncManager.retryDeadLettered(token);
  }, []);

  const discardDeadLettered = useCallback(() => {
    return syncManager.discardDeadLettered();
  }, []);

  const getDeadLetteredItems = useCallback(() => {
    return syncManager.getDeadLetteredItems();
  }, []);

  const deadLetteredCount =
    status.deadLetteredAnswers + status.deadLetteredPearlActions + status.deadLetteredReviews;

  return {
    status,
    isOnline: status.isOnline,
    pendingCount: status.pendingAnswers + status.pendingPearlActions + status.pendingReviews,
    deadLetteredCount,
    queueAnswer,
    queuePearlAction,
    queueReview,
    syncNow,
    retryDeadLettered,
    discardDeadLettered,
    getDeadLetteredItems,
  };
}
