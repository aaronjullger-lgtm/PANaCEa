/**
 * Advanced Spaced Repetition System (SRS) Service
 *
 * Implements SM-2 algorithm with PANaCEa-specific enhancements for
 * medical exam learning and high-stakes reasoning tasks.
 *
 * Based on SuperMemo SM-2 with custom modifiers for:
 * - Red zone performance tracking
 * - Confusion pair detection
 * - Streak bonuses
 * - Time-to-answer analysis
 */

import { FSRS, FSRSCard, FSRSState, Rating, defaultParameters, FSRSParameters } from '../fsrs';
import { queueOperation } from './sync/offlineSync';

const fsrs = new FSRS();

/**
 * Minimal Prisma-like contract for FSRS config (edge-safe; no lib/prisma import).
 * Callers from Edge pass createEdgePrismaClient(); callers from Node can pass lib/prisma.
 * Accepts PrismaClient or a narrowly-typed interface with userSRSConfig.
 */
type FSRSConfigPrismaLike = {
  userSRSConfig: {
    findUnique: (args: { where: { userId: string } }) => Promise<{
      requestRetention: number;
      wWeights: unknown; // JsonValue in Prisma, but may be number[] | null
    } | null>;
  };
} | null;

/**
 * Load user-specific FSRS parameters from database when prisma is provided.
 * Falls back to defaults when prisma is null/undefined (e.g. browser or no DB).
 * No dynamic import of lib/prisma so this file stays edge-safe (no pg bundle).
 */
async function loadUserFSRSConfig(
  userId: string,
  prisma: FSRSConfigPrismaLike
): Promise<FSRSParameters> {
  if (!prisma) {
    return defaultParameters;
  }

  try {
    const config = await prisma.userSRSConfig.findUnique({
      where: { userId },
    });
    if (config && Array.isArray(config.wWeights)) {
      return {
        request_retention: config.requestRetention,
        maximum_interval: defaultParameters.maximum_interval,
        w: config.wWeights,
      };
    }
  } catch (error) {
    console.warn('[SRS] Failed to load user config, using defaults:', error);
  }

  return defaultParameters;
}

/**
 * Create FSRS instance with user-specific or default parameters.
 * Pass prisma from Edge (createEdgePrismaClient) or Node (lib/prisma); pass null in browser.
 */
async function createUserFSRS(userId: string, prisma: FSRSConfigPrismaLike): Promise<FSRS> {
  const params = await loadUserFSRSConfig(userId, prisma);
  return new FSRS(params);
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SRSItem {
  id: string;
  userId: string;
  questionId: string;
  interval: number; // Days until next review
  repetition: number; // Number of successful reviews
  easiness: number; // EF (Easiness Factor), minimum 1.3
  dueDate: Date;
  lastReviewed: Date;
  quality: number; // Last quality response (0-5)
  difficulty: number; // Normalized 0-1 difficulty
  stabilityScore: number; // Research variable for forgetting curve
  createdAt: Date;
  updatedAt: Date;

  // FSRS v5 Fields
  fsrsStability?: number;
  fsrsDifficulty?: number;
  fsrsState?: FSRSState;
  fsrsLastReview?: Date;
}

export interface SRSUpdateInput {
  quality: number; // 0-5 scale
  timeToAnswer: number; // Milliseconds
  isInRedZone?: boolean; // Performance < 75%
  isConfusionPair?: boolean;
  streakLevel?: number;
  isGoldMastery?: boolean;
  baselineTime?: number; // Expected time for this question
}

export interface SRSScheduleResult {
  interval: number;
  repetition: number;
  easiness: number;
  dueDate: Date;
  difficulty: number;
  stabilityScore: number;
  qualityAdjusted: number;
  modifiersApplied: string[];
}

export interface NextQuestionResult {
  questionId: string;
  dueDate: Date;
  overdueDays: number;
  priority: number;
  reason: string;
}

// ============================================================================
// Constants
// ============================================================================

const MINIMUM_EASINESS_FACTOR = 1.3;
const DEFAULT_EASINESS_FACTOR = 2.5;
const DEFAULT_DIFFICULTY = 0.3;
const DEFAULT_STABILITY = 0.5;

// Time thresholds (in ms)
const SLOW_ANSWER_THRESHOLD_MULTIPLIER = 2.0;
const FAST_WRONG_THRESHOLD_MULTIPLIER = 0.3;

// PANaCEa modifiers
const RED_ZONE_MODIFIER = 0.4;
const CONFUSION_PAIR_MODIFIER = 0.3;
const STREAK_BONUS_THRESHOLD = 8;
const STREAK_BONUS_MODIFIER = 1.15;
const GOLD_MASTERY_MODIFIER = 1.4;

// Feature Flags
const USE_FSRS = true;

// ============================================================================
// Local Storage Keys
// ============================================================================

import { StorageKeys } from '../storage/storageRegistry';

const SRS_STORAGE_KEY = StorageKeys.SRS_ITEMS;
const SRS_VERSION = 'v1';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure a value is a Date object (handles string/Date from JSON parsing)
 * This fixes the "getTime is not a function" error when dates come from localStorage
 */
function ensureDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  // Handle string dates from JSON parsing
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Load SRS items from localStorage
 */
function loadSRSItems(): Map<string, SRSItem> {
  try {
    const stored = localStorage.getItem(SRS_STORAGE_KEY);
    if (!stored) return new Map();

    const data = JSON.parse(stored);
    if (data.version !== SRS_VERSION) {
      console.log('[SRS] Version mismatch, clearing old data');
      return new Map();
    }

    const items = new Map<string, SRSItem>();
    for (const item of data.items) {
      items.set(item.questionId, {
        ...item,
        dueDate: new Date(item.dueDate),
        lastReviewed: new Date(item.lastReviewed),
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      });
    }
    return items;
  } catch (error) {
    console.error('[SRS] Failed to load items:', error);
    return new Map();
  }
}

/**
 * Save SRS items to localStorage
 */
function saveSRSItems(items: Map<string, SRSItem>): void {
  try {
    const data = {
      version: SRS_VERSION,
      items: Array.from(items.values()),
    };
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[SRS] Failed to save items:', error);
  }
}

/**
 * Create a new SRS item with default values
 */
function createNewSRSItem(userId: string, questionId: string): SRSItem {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    userId,
    questionId,
    interval: 0,
    repetition: 0,
    easiness: DEFAULT_EASINESS_FACTOR,
    dueDate: now,
    lastReviewed: now,
    quality: 0,
    difficulty: DEFAULT_DIFFICULTY,
    stabilityScore: DEFAULT_STABILITY,
    createdAt: now,
    updatedAt: now,
    // FSRS Init
    fsrsStability: 0,
    fsrsDifficulty: 0,
    fsrsState: FSRSState.New,
    fsrsLastReview: now,
  };
}

/**
 * Map quality rating (0-5) to FSRS Rating enum.
 * Note: Hard (2) and Easy (4) are deprecated; UI only sends Again (1) or Good (3).
 */
function mapQualityToRating(quality: number): Rating {
  if (quality <= 1) return Rating.Again;
  if (quality === 2) return Rating.Hard;
  if (quality === 3 || quality === 4) return Rating.Good;
  return Rating.Easy;
}

// ============================================================================
// Core SM-2 Algorithm
// ============================================================================

/**
 * Calculate new Easiness Factor (EF) based on quality response
 * Formula: EF' = EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
 */
function calculateNewEasiness(currentEF: number, quality: number): number {
  const q = Math.max(0, Math.min(5, quality));
  const newEF = currentEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(MINIMUM_EASINESS_FACTOR, newEF);
}

/**
 * Calculate base interval according to SM-2 rules
 */
function calculateBaseInterval(
  repetition: number,
  previousInterval: number,
  easiness: number
): number {
  if (repetition === 1) {
    return 1; // 1 day
  } else if (repetition === 2) {
    return 6; // 6 days
  } else {
    return Math.round(previousInterval * easiness);
  }
}

// ============================================================================
// Main SRS Service Functions
// ============================================================================

/**
 * Get the next questions due for review
 *
 * @param userId - User identifier
 * @param limit - Maximum number of questions to return
 * @returns Array of questions sorted by priority
 */
export function getNextQuestions(userId: string, limit: number = 10): NextQuestionResult[] {
  const items = loadSRSItems();
  const now = new Date();
  const results: NextQuestionResult[] = [];

  for (const item of items.values()) {
    if (item.userId !== userId) continue;

    const overdueDays = Math.floor(
      (now.getTime() - ensureDate(item.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate priority based on overdue days and difficulty
    let priority = overdueDays;
    if (overdueDays > 0) {
      // Overdue items get higher priority
      priority += item.difficulty * 10;
    }

    let reason = 'Scheduled review';
    if (overdueDays > 7) {
      reason = 'Significantly overdue';
    } else if (overdueDays > 0) {
      reason = 'Overdue for review';
    } else if (item.repetition === 0) {
      reason = 'New item - first review';
    } else if (item.quality <= 2) {
      reason = 'Struggled previously';
    }

    results.push({
      questionId: item.questionId,
      dueDate: item.dueDate,
      overdueDays: Math.max(0, overdueDays),
      priority,
      reason,
    });
  }

  // Sort by priority (highest first) and return top N
  return results.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

/**
 * Get count of questions due for review
 */
export function getDueCount(userId: string): number {
  const items = loadSRSItems();
  const now = new Date();
  let count = 0;

  for (const item of items.values()) {
    if (item.userId !== userId) continue;
    if (item.dueDate <= now) {
      count++;
    }
  }

  return count;
}

/**
 * Get due cards with optional rotation filter support.
 * When filterTags are provided (rotation mode), returns ALL cards sorted by difficulty,
 * IGNORING the due date. Otherwise, returns only cards due for review.
 *
 * Note: This function provides the infrastructure for rotation mode. To fully implement
 * tag filtering, you'll need to either:
 * 1. Add a 'tags' or 'system' property to SRSItem interface
 * 2. Pass a filter function as a parameter
 * 3. Filter the results at the call site using question metadata
 *
 * @param userId - User identifier
 * @param filterTags - Optional array of tags/systems to filter by (e.g., ['Surgery', 'CV'])
 *                     When provided, enables rotation mode (ignores due dates, sorts by difficulty)
 * @param sortByDifficulty - Whether to sort by difficulty (true) or due date (false)
 * @returns Array of SRS items ready for review
 */
export function getDueCards(
  userId: string,
  filterTags: string[] = [],
  sortByDifficulty: boolean = false
): SRSItem[] {
  const items = loadSRSItems();
  const now = new Date();
  const results: SRSItem[] = [];

  for (const item of items.values()) {
    if (item.userId !== userId) continue;

    // If rotation mode is active (filterTags provided), return ALL cards
    // The caller should filter by tags using question metadata since
    // SRSItem stores questionId, not tags directly
    if (filterTags.length > 0) {
      // Rotation mode: include all cards regardless of due date
      results.push(item);
    } else {
      // Standard mode: only return items due for review
      if (ensureDate(item.dueDate) <= now) {
        results.push(item);
      }
    }
  }

  // Sort by difficulty (rotation mode) or due date (standard mode)
  if (sortByDifficulty || filterTags.length > 0) {
    // Sort by difficulty (highest difficulty first for rotation mode)
    results.sort((a, b) => b.difficulty - a.difficulty);
  } else {
    // Sort by due date (most overdue first)
    results.sort((a, b) => ensureDate(a.dueDate).getTime() - ensureDate(b.dueDate).getTime());
  }

  return results;
}

/**
 * Update review outcome and compute next schedule
 *
 * @param userId - User identifier
 * @param questionId - Question that was reviewed
 * @param input - Review outcome data
 * @returns Computed schedule result
 */
export async function updateReviewOutcome(
  userId: string,
  questionId: string,
  input: SRSUpdateInput,
  prisma?: FSRSConfigPrismaLike
): Promise<SRSScheduleResult> {
  const userFsrs = await createUserFSRS(userId, prisma ?? null);
  const items = loadSRSItems();
  let item = items.get(questionId);

  if (!item) {
    item = createNewSRSItem(userId, questionId);
  }

  // FSRS Logic Integration
  if (USE_FSRS) {
    const rating = mapQualityToRating(input.quality);

    const card: FSRSCard = {
      stability: item.fsrsStability || 0,
      difficulty: item.fsrsDifficulty || 0,
      state: item.fsrsState || FSRSState.New,
      elapsed_days: item.fsrsLastReview
        ? (new Date().getTime() - ensureDate(item.fsrsLastReview).getTime()) / 86400000
        : 0,
      scheduled_days: item.interval,
      reps: item.repetition,
      lapses: 0,
      last_review: ensureDate(item.fsrsLastReview),
    };

    const { card: newCard } = userFsrs.next(card, new Date(), rating);

    const interval = Math.max(1, Math.round(newCard.scheduled_days));
    // Keep legacy easiness updated for backward compatibility/fallback
    const easiness = Math.max(
      MINIMUM_EASINESS_FACTOR,
      item.easiness + (0.1 - (5 - input.quality) * (0.08 + (5 - input.quality) * 0.02))
    );

    const now = new Date();
    const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    const updatedItem: SRSItem = {
      ...item,
      interval,
      repetition: newCard.reps,
      easiness,
      dueDate,
      lastReviewed: now,
      quality: input.quality,
      fsrsState: newCard.state,
      fsrsStability: newCard.stability,
      fsrsDifficulty: newCard.difficulty,
      fsrsLastReview: now,
      updatedAt: now,
    };

    items.set(questionId, updatedItem);
    saveSRSItems(items);

    return {
      interval,
      repetition: newCard.reps,
      easiness,
      dueDate,
      difficulty: updatedItem.difficulty,
      stabilityScore: updatedItem.stabilityScore,
      qualityAdjusted: input.quality,
      modifiersApplied: ['fsrs_v5'],
    };
  }

  // Apply time-based quality adjustments
  let adjustedQuality = input.quality;
  const modifiersApplied: string[] = [];

  if (input.baselineTime && input.timeToAnswer) {
    // Slow response: treat quality as one level lower
    if (input.timeToAnswer > input.baselineTime * SLOW_ANSWER_THRESHOLD_MULTIPLIER) {
      adjustedQuality = Math.max(0, adjustedQuality - 1);
      modifiersApplied.push('slow_response');
    }

    // Fast wrong answer: anchoring bias penalty
    if (
      input.quality <= 2 &&
      input.timeToAnswer < input.baselineTime * FAST_WRONG_THRESHOLD_MULTIPLIER
    ) {
      adjustedQuality = Math.max(0, adjustedQuality - 1);
      modifiersApplied.push('anchoring_bias');
    }
  }

  // Compute new easiness factor
  const newEasiness = calculateNewEasiness(item.easiness, adjustedQuality);

  // Determine repetition count
  let newRepetition: number;
  if (adjustedQuality < 3) {
    // Failed - reset repetition
    newRepetition = 1;
  } else {
    // Passed - increment repetition
    newRepetition = item.repetition + 1;
  }

  // Calculate base interval
  let interval = calculateBaseInterval(newRepetition, item.interval, newEasiness);

  // Apply PANaCEa modifiers
  if (input.isInRedZone) {
    interval = Math.round(interval * RED_ZONE_MODIFIER);
    modifiersApplied.push('red_zone');
  }

  if (input.isConfusionPair) {
    interval = Math.round(interval * CONFUSION_PAIR_MODIFIER);
    modifiersApplied.push('confusion_pair');
  }

  if (input.streakLevel && input.streakLevel >= STREAK_BONUS_THRESHOLD) {
    interval = Math.round(interval * STREAK_BONUS_MODIFIER);
    modifiersApplied.push('streak_bonus');
  }

  if (input.isGoldMastery) {
    interval = Math.round(interval * GOLD_MASTERY_MODIFIER);
    modifiersApplied.push('gold_mastery');
  }

  // Ensure minimum interval of 1 day
  interval = Math.max(1, interval);

  // Update difficulty based on response pattern
  let newDifficulty = item.difficulty;
  if (adjustedQuality <= 2) {
    newDifficulty = Math.min(1, newDifficulty + 0.1);
  } else if (adjustedQuality >= 4) {
    newDifficulty = Math.max(0, newDifficulty - 0.05);
  }

  // Update stability score (simple exponential smoothing)
  const alpha = 0.3;
  const responseStability = adjustedQuality / 5;
  const newStability = alpha * responseStability + (1 - alpha) * item.stabilityScore;

  // ---------------------------------------------------------
  // FSRS Calculation
  // ---------------------------------------------------------
  const now = new Date();
  const rating = mapQualityToRating(adjustedQuality);

  const fsrsCard: FSRSCard = {
    stability: item.fsrsStability ?? 0,
    difficulty: item.fsrsDifficulty ?? 0,
    state: item.fsrsState ?? FSRSState.New,
    elapsed_days:
      (now.getTime() - ensureDate(item.fsrsLastReview || item.lastReviewed).getTime()) /
      (1000 * 60 * 60 * 24),
    scheduled_days: item.interval,
    reps: item.repetition,
    lapses: 0,
    last_review: ensureDate(item.fsrsLastReview || item.lastReviewed),
  };

  const scheduled = userFsrs.next(fsrsCard, now, rating);

  const newFsrsStability = scheduled.card.stability;
  const newFsrsDifficulty = scheduled.card.difficulty;
  const newFsrsState = scheduled.card.state;
  const newFsrsLastReview = now;

  // Override interval if FSRS is enabled
  if (USE_FSRS) {
    interval = Math.max(1, Math.round(scheduled.card.scheduled_days));
    modifiersApplied.push('fsrs_v5');
  }

  // Calculate new due date
  const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  // Update item
  const updatedItem: SRSItem = {
    ...item,
    interval,
    repetition: newRepetition,
    easiness: newEasiness,
    dueDate,
    lastReviewed: now,
    quality: adjustedQuality,
    difficulty: newDifficulty,
    stabilityScore: newStability,
    updatedAt: now,
    // FSRS
    fsrsStability: newFsrsStability,
    fsrsDifficulty: newFsrsDifficulty,
    fsrsState: newFsrsState,
    fsrsLastReview: newFsrsLastReview,
  };

  items.set(questionId, updatedItem);
  saveSRSItems(items);

  return {
    interval,
    repetition: newRepetition,
    easiness: newEasiness,
    dueDate,
    difficulty: newDifficulty,
    stabilityScore: newStability,
    qualityAdjusted: adjustedQuality,
    modifiersApplied,
  };
}

/**
 * Mark all due items for a user (updates timestamps)
 */
export function markDue(userId: string): void {
  const items = loadSRSItems();
  const now = new Date();

  for (const item of items.values()) {
    if (item.userId !== userId) continue;
    if (item.dueDate > now) continue;

    // Update the item to be reviewed today
    item.updatedAt = now;
  }

  saveSRSItems(items);
}

/**
 * Postpone all due questions by extending their due dates
 * Maintains relative ordering (older items still due before newer ones)
 */
export function postponeDueQuestions(userId: string): number {
  const items = loadSRSItems();
  const now = new Date();
  let postponedCount = 0;

  // Collect all due items and sort by original due date
  const dueItems: SRSItem[] = [];
  for (const item of items.values()) {
    if (item.userId !== userId) continue;
    if (item.dueDate <= now) {
      dueItems.push(item);
    }
  }

  // Sort by due date (oldest first)
  dueItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // Postpone each item by its position in the queue (1 day, 2 days, etc.)
  for (let i = 0; i < dueItems.length; i++) {
    const item = dueItems[i];
    if (item == null) continue;
    const daysToAdd = i; // First item: today, second: tomorrow, etc.
    const newDueDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    item.dueDate = newDueDate;
    item.updatedAt = now;
    postponedCount++;
  }

  saveSRSItems(items);
  return postponedCount;
}

/**
 * Clear all SRS data for a user
 */
export function clearSRSData(userId: string): void {
  const items = loadSRSItems();

  for (const [key, item] of items.entries()) {
    if (item.userId === userId) {
      items.delete(key);
    }
  }

  saveSRSItems(items);
}

// ============================================================================
// Cloud Sync Functions (for authenticated users)
// ============================================================================

/**
 * Get all SRS items for a user (for cloud sync)
 */
export function getAllSRSItems(userId: string): SRSItem[] {
  const items = loadSRSItems();
  const userItems: SRSItem[] = [];

  for (const item of items.values()) {
    if (item.userId === userId) {
      userItems.push(item);
    }
  }

  return userItems;
}

/**
 * Load SRS items from cloud data
 * Merges with existing local data, preferring most recent updates
 */
export function loadSRSItemsFromCloud(cloudItems: SRSItem[]): void {
  const localItems = loadSRSItems();

  for (const cloudItem of cloudItems) {
    const existing = localItems.get(cloudItem.questionId);

    // Ensure dates are properly compared as timestamps
    const cloudUpdatedTime =
      typeof cloudItem.updatedAt === 'string'
        ? new Date(cloudItem.updatedAt).getTime()
        : cloudItem.updatedAt.getTime();
    const existingUpdatedTime = existing
      ? typeof existing.updatedAt === 'string'
        ? new Date(existing.updatedAt).getTime()
        : existing.updatedAt.getTime()
      : 0;

    // If no local item, or cloud item is newer, use cloud data
    if (!existing || cloudUpdatedTime > existingUpdatedTime) {
      localItems.set(cloudItem.questionId, {
        ...cloudItem,
        dueDate: new Date(cloudItem.dueDate),
        lastReviewed: new Date(cloudItem.lastReviewed),
        createdAt: new Date(cloudItem.createdAt),
        updatedAt: new Date(cloudItem.updatedAt),
      });
    }
  }

  saveSRSItems(localItems);
}

/**
 * Async version of updateReviewOutcome for cloud sync
 */
export async function updateReviewOutcomeAsync(
  userId: string,
  questionId: string,
  input: SRSUpdateInput,
  syncToCloud?: (items: SRSItem[]) => Promise<void>,
  prisma?: FSRSConfigPrismaLike
): Promise<SRSScheduleResult> {
  const result = updateReviewOutcome(userId, questionId, input, prisma);

  // If sync function provided, sync to cloud
  if (syncToCloud) {
    try {
      const allItems = getAllSRSItems(userId);
      await syncToCloud(allItems);
    } catch (error) {
      console.error('Failed to sync SRS data to cloud:', error);
      // Continue even if sync fails - data is saved locally
    }
  }

  return result;
}

/**
 * Get SRS statistics for dashboard display
 */
export function getSRSStats(userId: string): {
  totalItems: number;
  dueToday: number;
  overdue: number;
  avgEasiness: number;
  avgDifficulty: number;
  avgStability: number;
} {
  const items = loadSRSItems();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  let totalItems = 0;
  let dueToday = 0;
  let overdue = 0;
  let sumEasiness = 0;
  let sumDifficulty = 0;
  let sumStability = 0;

  for (const item of items.values()) {
    if (item.userId !== userId) continue;

    totalItems++;
    sumEasiness += item.easiness;
    sumDifficulty += item.difficulty;
    sumStability += item.stabilityScore;

    if (item.dueDate < today) {
      overdue++;
    } else if (item.dueDate < tomorrow) {
      dueToday++;
    }
  }

  return {
    totalItems,
    dueToday,
    overdue,
    avgEasiness: totalItems > 0 ? sumEasiness / totalItems : DEFAULT_EASINESS_FACTOR,
    avgDifficulty: totalItems > 0 ? sumDifficulty / totalItems : DEFAULT_DIFFICULTY,
    avgStability: totalItems > 0 ? sumStability / totalItems : DEFAULT_STABILITY,
  };
}

/**
 * Format the next review time for display
 */
export function formatNextReview(dueDate: Date): string {
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  } else if (diffDays === 0) {
    if (diffHours <= 0) {
      return 'Due now';
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays < 7) {
    return `${diffDays} days`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
}

// ============================================================================
// Forgetting Curve Visualization
// ============================================================================

/**
 * Data point for forgetting curve visualization.
 */
export interface ForgettingCurvePoint {
  daysSinceReview: number;
  retentionProbability: number;
  label: string;
}

/**
 * Calculate forgetting curve data for visualization.
 * Based on Ebbinghaus forgetting curve adapted for spaced repetition.
 *
 * @param item - The SRS item to analyze
 * @returns Array of data points for plotting the forgetting curve
 */
export function calculateForgettingCurve(item: SRSItem): ForgettingCurvePoint[] {
  const points: ForgettingCurvePoint[] = [];
  const maxDays = item.interval * 2; // Show curve beyond next review

  // Calculate retention probability using exponential decay
  // R(t) = e^(-t/S) where S is stability (related to easiness and repetition)
  const stability = item.easiness * (1 + item.repetition * 0.5);

  for (let day = 0; day <= maxDays; day += Math.max(1, Math.floor(maxDays / 20))) {
    const retention = Math.exp(-day / stability) * 100;

    let label = '';
    if (day === 0) {
      label = 'Now';
    } else if (day === item.interval) {
      label = 'Next Review';
    } else if (day === maxDays) {
      label = `+${Math.floor(maxDays)} days`;
    }

    points.push({
      daysSinceReview: day,
      retentionProbability: Math.max(0, Math.min(100, retention)),
      label,
    });
  }

  return points;
}

/**
 * Get retention statistics for a collection of SRS items.
 *
 * @param items - Array of SRS items to analyze
 * @returns Statistics about retention levels
 */
export function getRetentionStats(items: SRSItem[]): {
  avgRetention: number;
  criticalItems: number;
  solidItems: number;
  masteredItems: number;
} {
  if (items.length === 0) {
    return { avgRetention: 0, criticalItems: 0, solidItems: 0, masteredItems: 0 };
  }

  let totalRetention = 0;
  let criticalItems = 0;
  let solidItems = 0;
  let masteredItems = 0;

  items.forEach((item) => {
    const daysSinceReview = Math.floor(
      (Date.now() - item.lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
    );
    const stability = item.easiness * (1 + item.repetition * 0.5);
    const retention = Math.exp(-daysSinceReview / stability) * 100;

    totalRetention += retention;

    if (retention < 50) {
      criticalItems++;
    } else if (retention < 80) {
      solidItems++;
    } else {
      masteredItems++;
    }
  });

  return {
    avgRetention: totalRetention / items.length,
    criticalItems,
    solidItems,
    masteredItems,
  };
}

// ============================================================================
// Cram Mode Support
// ============================================================================

/**
 * Priority override modes for different study scenarios.
 */
export type PriorityMode = 'standard' | 'cram' | 'maintenance' | 'weak_areas';

/**
 * Configuration for priority override in different modes.
 */
export interface PriorityOverride {
  mode: PriorityMode;
  /** Weight multiplier for overdue items (default: 1.0) */
  overdueWeight?: number;
  /** Weight multiplier for high-easiness items (default: 1.0) */
  easyWeight?: number;
  /** Weight multiplier for low-easiness items (default: 1.0) */
  hardWeight?: number;
  /** Maximum number of items to review per session */
  maxItems?: number;
}

/**
 * Get the next question to review with priority mode support.
 * Supports different study modes: standard review, cram mode, maintenance, etc.
 *
 * @param userId - User ID to filter items
 * @param priorityOverride - Optional priority mode configuration
 * @returns Next question to review or null if none available
 */
export function getNextReviewWithPriority(
  userId: string,
  priorityOverride?: PriorityOverride
): NextQuestionResult | null {
  const items = loadSRSItems();
  const userItems = Array.from(items.values()).filter((item) => item.userId === userId);

  if (userItems.length === 0) {
    return null;
  }

  const now = new Date();
  const mode = priorityOverride?.mode || 'standard';

  // Apply mode-specific filtering and weighting
  let candidateItems = userItems;

  switch (mode) {
    case 'cram':
      // Cram mode: Focus on items due soon, prioritize overdue and difficult items
      candidateItems = userItems.filter((item) => {
        const daysToDue = Math.floor(
          (item.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysToDue <= 7; // Only items due within a week
      });
      break;

    case 'maintenance':
      // Maintenance mode: Only review items that are actually due
      candidateItems = userItems.filter((item) => item.dueDate <= now);
      break;

    case 'weak_areas':
      // Weak areas mode: Focus on low-easiness items regardless of due date
      candidateItems = userItems.filter((item) => item.easiness < 2.0);
      break;

    case 'standard':
    default:
      // Standard mode: Include items due within the next day
      candidateItems = userItems.filter((item) => {
        const daysToDue = Math.floor(
          (item.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysToDue <= 1;
      });
      break;
  }

  if (candidateItems.length === 0) {
    return null;
  }

  // Calculate priority scores with mode-specific weights
  const weights = {
    overdue: priorityOverride?.overdueWeight || (mode === 'cram' ? 3.0 : 1.0),
    easy: priorityOverride?.easyWeight || (mode === 'cram' ? 0.3 : 1.0),
    hard: priorityOverride?.hardWeight || (mode === 'weak_areas' ? 2.0 : 1.0),
  };

  const scoredItems = candidateItems.map((item) => {
    const overdueDays = Math.max(
      0,
      Math.floor((now.getTime() - item.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Base priority on how overdue the item is
    let priority = overdueDays * weights.overdue;

    // Adjust for difficulty
    if (item.easiness < 2.0) {
      priority *= weights.hard;
    } else if (item.easiness > 2.5) {
      priority *= weights.easy;
    }

    // Boost items with low stability (high forgetting risk)
    if (item.stabilityScore < 0.5) {
      priority *= 1.5;
    }

    let reason = '';
    if (overdueDays > 0) {
      reason = `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`;
    } else if (item.easiness < 2.0) {
      reason = 'Difficult item - needs reinforcement';
    } else {
      reason = 'Scheduled for review';
    }

    return {
      item,
      priority,
      overdueDays,
      reason,
    };
  });

  // Sort by priority (highest first)
  scoredItems.sort((a, b) => b.priority - a.priority);

  // Apply max items limit if specified
  const maxItems = priorityOverride?.maxItems || candidateItems.length;
  const selectedItem = scoredItems[0];

  if (!selectedItem) {
    return null;
  }

  return {
    questionId: selectedItem.item.questionId,
    dueDate: selectedItem.item.dueDate,
    overdueDays: selectedItem.overdueDays,
    priority: selectedItem.priority,
    reason: selectedItem.reason,
  };
}

/**
 * Get a batch of questions for a cram session.
 *
 * @param userId - User ID to filter items
 * @param count - Number of items to retrieve
 * @param priorityMode - Priority mode for selection
 * @returns Array of question IDs prioritized for the session
 */
export function getCramSessionQuestions(
  userId: string,
  count: number = 20,
  priorityMode: PriorityMode = 'cram'
): string[] {
  const items = loadSRSItems();
  const userItems = Array.from(items.values()).filter((item) => item.userId === userId);

  if (userItems.length === 0) {
    return [];
  }

  // Create a set to track already selected question IDs
  const selectedIds = new Set<string>();
  const questionIds: string[] = [];
  const override: PriorityOverride = {
    mode: priorityMode,
    maxItems: count,
  };

  // Get all candidate items and score them
  const now = new Date();
  const candidateItems = userItems.filter((item) => {
    const daysToDue = Math.floor((item.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Apply mode-specific filtering
    switch (priorityMode) {
      case 'cram':
        return daysToDue <= 7;
      case 'maintenance':
        return item.dueDate <= now;
      case 'weak_areas':
        return item.easiness < 2.0;
      default:
        return daysToDue <= 1;
    }
  });

  // Score and sort items
  const scoredItems = candidateItems.map((item) => {
    const overdueDays = Math.max(
      0,
      Math.floor((now.getTime() - item.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    let priority = overdueDays;
    if (overdueDays > 0) {
      // Overdue items get higher priority
      priority += item.difficulty * 10;
    }

    return {
      item,
      priority,
      overdueDays,
    };
  });

  // Sort by priority (highest first)
  scoredItems.sort((a, b) => b.priority - a.priority);

  // Select top N items based on maxItems limit
  const maxItems = scoredItems.length;
  for (let i = 0; i < Math.min(maxItems, scoredItems.length); i++) {
    const entry = scoredItems[i];
    const questionId = entry?.item?.questionId;
    if (questionId) {
      selectedIds.add(questionId);
      questionIds.push(questionId);
    }
  }

  return questionIds;
}

// ============================================================================
// Second Chance Variant-Aware SRS Flow (API-backed)
// ============================================================================

export interface VariantNextResponse {
  srsItemId: string | null;
  topicProgressId?: string;
  question: any; // Question or QuestionVariant content
  isVariant: boolean;
  taskType: string;
  message?: string;
}

export interface VariantSubmitPayload {
  srsItemId?: string | null;
  topicProgressId?: string;
  questionId: string;
  variantId?: string;
  rating: number; // 1=Again, 2=Hard (deprecated), 3=Good, 4=Easy (deprecated)
  isCorrect: boolean;
  userAnswer?: string;
  timeSpent?: number;
}

export interface VariantSubmitResponse {
  success: boolean;
  nextReviewDate?: string;
  queuedVariantId?: string | null;
  /** When user rates Again (1), backend suggests re-generating mnemonic with style "exaggerated" */
  triggerVisualRegeneration?: boolean;
  questionId?: string;
  conditionId?: string;
  topicProgressId?: string;
  visualRegenerationHint?: string;
}

/** Optional auth: when backend requires Bearer token, pass getToken from useAuth() */
export interface SrsAuthOptions {
  getToken?: () => Promise<string | null>;
}

/**
 * Fetch the next SRS item using the variant-aware Second Chance API.
 * This prioritizes variants for users in Learning/Relearning states.
 * Pass options.getToken (e.g. from useAuth()) to send Authorization when the backend requires Bearer auth.
 */
export async function fetchNextVariantCard(
  options?: SrsAuthOptions
): Promise<VariantNextResponse | null> {
  try {
    const token = options?.getToken ? await options.getToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/srs/next', {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('[SRS] User not authenticated for variant fetch');
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      console.error('[SRS] Failed to fetch next card:', errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[SRS] Error fetching next variant card:', error);
    return null;
  }
}

/**
 * Submit an SRS review using the variant-aware Second Chance API.
 * This updates both SRSItem and UserTopicProgress, and triggers variant generation on incorrect answers.
 * When offline, the payload is queued and synced when connectivity returns (PWA offline support).
 * Pass options.getToken to send Authorization when the backend requires Bearer auth.
 */
export async function submitVariantReview(
  payload: VariantSubmitPayload,
  options?: SrsAuthOptions
): Promise<VariantSubmitResponse | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOperation('srs_submit', payload);
    return { success: true };
  }

  try {
    const token = options?.getToken ? await options.getToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/srs/submit', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('[SRS] User not authenticated for variant submit');
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      console.error('[SRS] Failed to submit review:', errorData);
      return null;
    }

    const json = await response.json();
    // API returns { data: { success, nextReviewDate, triggerVisualRegeneration?, ... } }
    const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
    return data as VariantSubmitResponse;
  } catch (error) {
    console.error('[SRS] Error submitting variant review:', error);
    return null;
  }
}

/** Response from POST /api/srs/generate-visual */
export interface GenerateVisualResponse {
  imageBase64: string;
  imageMime: string;
  imageUrl?: string;
  front: string;
  back: string;
  style: 'photorealistic' | 'exaggerated';
  conditionId?: string;
  questionId?: string;
}

/**
 * Request a generative mnemonic image for a flashcard (Pillar 4: FSRS Visual).
 * Call when submit returns triggerVisualRegeneration (user rated Again/1) to get an exaggerated mnemonic.
 * Pass getToken in options to send Authorization when the backend requires Bearer auth.
 */
export async function requestMnemonicImage(
  front: string,
  back: string,
  options: {
    style?: 'photorealistic' | 'exaggerated';
    structureReferenceId?: string;
    structureReferenceUrl?: string;
    conditionId?: string;
    questionId?: string;
    getToken?: () => Promise<string | null>;
  } = {}
): Promise<{ data?: GenerateVisualResponse; error?: string } | null> {
  try {
    const token = options?.getToken ? await options.getToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/srs/generate-visual', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        body: {
          front,
          back,
          style: options.style ?? 'exaggerated',
          structureReferenceId: options.structureReferenceId,
          structureReferenceUrl: options.structureReferenceUrl,
          conditionId: options.conditionId,
          questionId: options.questionId,
        },
      }),
    });
    const json = (await response.json().catch(() => ({}))) as {
      data?: GenerateVisualResponse;
      error?: string;
    };
    const data = json?.data ?? json;
    if (!response.ok) {
      return {
        error: (data as { error?: string })?.error ?? json?.error ?? `HTTP ${response.status}`,
      };
    }
    return { data: data as GenerateVisualResponse };
  } catch (error) {
    console.error('[SRS] Error requesting mnemonic image:', error);
    return null;
  }
}
