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

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SRSItem {
  id: string;
  userId: string;
  questionId: string;
  interval: number;        // Days until next review
  repetition: number;      // Number of successful reviews
  easiness: number;        // EF (Easiness Factor), minimum 1.3
  dueDate: Date;
  lastReviewed: Date;
  quality: number;         // Last quality response (0-5)
  difficulty: number;      // Normalized 0-1 difficulty
  stabilityScore: number;  // Research variable for forgetting curve
  createdAt: Date;
  updatedAt: Date;
}

export interface SRSUpdateInput {
  quality: number;         // 0-5 scale
  timeToAnswer: number;    // Milliseconds
  isInRedZone?: boolean;   // Performance < 75%
  isConfusionPair?: boolean;
  streakLevel?: number;
  isGoldMastery?: boolean;
  baselineTime?: number;   // Expected time for this question
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

// ============================================================================
// Local Storage Keys
// ============================================================================

const SRS_STORAGE_KEY = 'panacea_srs_items';
const SRS_VERSION = 'v1';

// ============================================================================
// Helper Functions
// ============================================================================

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
    id: `${userId}_${questionId}_${now.getTime()}`,
    userId,
    questionId,
    interval: 1,
    repetition: 0,
    easiness: DEFAULT_EASINESS_FACTOR,
    dueDate: now,
    lastReviewed: now,
    quality: 0,
    difficulty: DEFAULT_DIFFICULTY,
    stabilityScore: DEFAULT_STABILITY,
    createdAt: now,
    updatedAt: now,
  };
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
function calculateBaseInterval(repetition: number, previousInterval: number, easiness: number): number {
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
    
    const overdueDays = Math.floor((now.getTime() - item.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
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
  return results
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
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
 * Update review outcome and compute next schedule
 * 
 * @param userId - User identifier
 * @param questionId - Question that was reviewed
 * @param input - Review outcome data
 * @returns Computed schedule result
 */
export function updateReviewOutcome(
  userId: string,
  questionId: string,
  input: SRSUpdateInput
): SRSScheduleResult {
  const items = loadSRSItems();
  let item = items.get(questionId);
  
  if (!item) {
    item = createNewSRSItem(userId, questionId);
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
    if (input.quality <= 2 && input.timeToAnswer < input.baselineTime * FAST_WRONG_THRESHOLD_MULTIPLIER) {
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
  
  // Calculate new due date
  const now = new Date();
  const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  
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
    const cloudUpdatedTime = typeof cloudItem.updatedAt === 'string' 
      ? new Date(cloudItem.updatedAt).getTime() 
      : cloudItem.updatedAt.getTime();
    const existingUpdatedTime = existing 
      ? (typeof existing.updatedAt === 'string' 
          ? new Date(existing.updatedAt).getTime() 
          : existing.updatedAt.getTime())
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
  syncToCloud?: (items: SRSItem[]) => Promise<void>
): Promise<SRSScheduleResult> {
  const result = updateReviewOutcome(userId, questionId, input);
  
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

// TODO: integrate forgetting curve visualization
// TODO: enable priority override to support cram mode
// TODO: research SM-15 enhancements for professional education
// TODO: apply Bayesian reinforcement based on global learner data
