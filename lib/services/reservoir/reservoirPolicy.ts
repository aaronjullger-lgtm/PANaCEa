/**
 * Reservoir Policy — Configuration constants for the proactive question queue.
 *
 * The reservoir is a per-student warm buffer of pre-selected questions.
 * These constants control when refills trigger, how large the buffer gets,
 * and how items age out.
 *
 * @module lib/services/reservoir/reservoirPolicy
 */

// ─── Threshold Configuration ────────────────────────────────────────────────

export const RESERVOIR_POLICY = {
  /** Trigger refill when queued items drop below this count */
  LOW_WATER_MARK: 15,

  /** Refill up to this many queued items */
  HIGH_WATER_MARK: 40,

  /** How many to generate per refill job (HIGH - LOW = 25) */
  REFILL_BATCH_SIZE: 25,

  /** TTL for new-card reservoir items (hours) */
  ITEM_TTL_HOURS: 48,

  /** TTL for FSRS review items — shorter because they're time-sensitive (hours) */
  REVIEW_ITEM_TTL_HOURS: 12,

  /** Maximum reservoir size per user+scope (prevent unbounded growth) */
  MAX_RESERVOIR_SIZE: 60,

  /** Minimum time between refill jobs for same user (minutes) */
  REFILL_COOLDOWN_MINUTES: 30,

  /** Reserved but not consumed → release back to queued (minutes) */
  RESERVATION_TIMEOUT_MINUTES: 30,

  /** Hard-delete consumed/expired/failed items older than this (days) */
  RETENTION_DAYS: 7,

  /** Priority weights for different question sources */
  PRIORITY: {
    OVERDUE_REVIEW: 9,
    /** Confusion-pair targeted remediation — above normal due reviews */
    CONFUSION_REMEDIATION: 8,
    DUE_REVIEW: 7,
    NEW_BLUEPRINT_GAP: 6,
    NEW_STANDARD: 5,
    BACKFILL: 3,
  },
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReservoirStatus = 'queued' | 'reserved' | 'consumed' | 'expired' | 'failed';

export type QuestionSource = 'pool' | 'generated' | 'review';

export type RefillReason = 'low_water' | 'post_session' | 'login' | 'manual' | 'cron';

export interface ReservoirItem {
  id: string;
  userId: string;
  questionId: string;
  questionSource: QuestionSource;
  scope: string;
  status: ReservoirStatus;
  priority: number;
  reservedAt: Date | null;
  reservedBy: string | null;
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  system: string | null;
  difficulty: string | null;
  questionOrder: string | null;
  taskCategory: string | null;
  isReview: boolean;
}

export interface RefillResult {
  reviewsQueued: number;
  poolQueued: number;
  generated: number;
  totalInserted: number;
  skipped: number;
  /** Number of items that received a confusion-pair priority boost */
  confusionBoostedCount?: number;
  errors: string[];
}

export interface ReservoirHealthReport {
  totalUsers: number;
  healthyUsers: number;
  lowUsers: number;
  emptyUsers: number;
  totalItems: number;
  avgQueueDepth: number;
  expirationRate: number;
  timestamp: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute TTL expiration date for a reservoir item */
export function computeExpiry(isReview: boolean): Date {
  const hours = isReview
    ? RESERVOIR_POLICY.REVIEW_ITEM_TTL_HOURS
    : RESERVOIR_POLICY.ITEM_TTL_HOURS;
  return new Date(Date.now() + hours * 3600_000);
}

/**
 * Derive scope string from session parameters.
 * Scope groups reservoir items so scoped sessions draw from the right pool.
 */
export function deriveScope(
  mode: string,
  options: { system?: string; subcategory?: string; conditionId?: string; userId?: string }
): string {
  if (mode === 'system' && options.system) return `system:${options.system}`;
  if (mode === 'subcategory' && options.system && options.subcategory) {
    return `subcategory:${options.system}:${encodeURIComponent(options.subcategory)}`;
  }
  if (mode === 'condition' && options.conditionId) return `condition:${options.conditionId}`;
  if (mode === 'confusion-remediation' && options.userId) return `confusion-remediation:${options.userId}`;
  return 'adaptive';
}
