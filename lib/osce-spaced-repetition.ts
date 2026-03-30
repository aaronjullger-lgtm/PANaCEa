/**
 * OSCE Spaced Repetition Module
 * 
 * Implements condition-level spaced repetition scheduling for OSCE encounters.
 * Failed conditions appear sooner in future sessions using localStorage persistence.
 * Uses FSRS-like stability and difficulty mechanics adapted for clinical encounters.
 */

const STORAGE_KEY = 'osce_condition_schedules';

export interface OSCEConditionSchedule {
  conditionId: string;
  conditionName: string;
  system: string;
  lastAttemptDate: string; // ISO date
  lastScore: number; // 0-100
  attemptCount: number;
  stability: number; // days until next review (like FSRS stability)
  difficulty: number; // 0-1 difficulty factor
  nextReviewDate: string; // ISO date
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Add days to a date string and return ISO date
 */
function addDays(dateISO: string, days: number): string {
  const date = new Date(dateISO);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate days between two ISO date strings
 */
function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Load all schedules from localStorage
 */
function loadSchedules(): Record<string, OSCEConditionSchedule> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save schedules to localStorage
 */
function saveSchedules(schedules: Record<string, OSCEConditionSchedule>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  } catch (e) {
    console.warn('Failed to save OSCE schedules to localStorage:', e);
  }
}

/**
 * Update or create a condition schedule based on performance
 * 
 * Pass: stability increases (spaced further out)
 * Fail: stability decreases (reviewed sooner)
 */
export function updateConditionSchedule(
  conditionId: string,
  conditionName: string,
  system: string,
  score: number // 0-100
): void {
  const schedules = loadSchedules();
  const today = getTodayISO();

  const existing = schedules[conditionId];
  const isPass = score >= 70;

  // Initialize or update
  let entry: OSCEConditionSchedule = existing || {
    conditionId,
    conditionName,
    system,
    lastAttemptDate: today,
    lastScore: score,
    attemptCount: 0,
    stability: 1, // Start with 1 day for unseen conditions
    difficulty: 0.5,
    nextReviewDate: today,
  };

  entry.lastAttemptDate = today;
  entry.lastScore = score;
  entry.attemptCount = (entry.attemptCount || 0) + 1;

  // Update stability: FSRS-like mechanics
  if (isPass) {
    // Success: increase stability, cap at 30 days
    entry.stability = Math.min(30, entry.stability * (1.5 + score / 100));
    // Decrease difficulty on pass
    entry.difficulty = Math.max(0, entry.difficulty - 0.1);
  } else {
    // Failure: reduce stability dramatically, min 1 day
    entry.stability = Math.max(1, entry.stability * 0.3);
    // Increase difficulty on fail
    entry.difficulty = Math.min(1, entry.difficulty + 0.15);
  }

  entry.nextReviewDate = addDays(today, Math.ceil(entry.stability));

  schedules[conditionId] = entry;
  saveSchedules(schedules);
}

/**
 * Get all saved condition schedules
 */
export function getConditionSchedules(): OSCEConditionSchedule[] {
  const schedules = loadSchedules();
  return Object.values(schedules);
}

/**
 * Get conditions that are due for review (overdue first)
 */
export function getDueConditions(): OSCEConditionSchedule[] {
  const today = getTodayISO();
  return getConditionSchedules()
    .filter((c) => c.nextReviewDate <= today)
    .sort((a, b) => daysBetween(a.nextReviewDate, today) - daysBetween(b.nextReviewDate, today));
}

/**
 * Get recommended conditions to study next
 * Prioritized by: due conditions, weakest (lowest stability), then unseen
 */
export function getRecommendedConditions(limit: number = 5): string[] {
  const today = getTodayISO();
  const schedules = getConditionSchedules();

  // Separate into categories
  const due = schedules.filter((c) => c.nextReviewDate <= today);
  const notDue = schedules.filter((c) => c.nextReviewDate > today);

  // Sort due by most overdue first
  due.sort((a, b) => daysBetween(a.nextReviewDate, today) - daysBetween(b.nextReviewDate, today));

  // Sort not-due by weakest (lowest stability) first
  notDue.sort((a, b) => a.stability - b.stability);

  // Combine: due first, then not-due by strength
  const recommended = [...due, ...notDue];
  return recommended.slice(0, limit).map((c) => c.conditionId);
}

/**
 * Get overall statistics
 */
export function getConditionStats(): {
  total: number;
  due: number;
  mastered: number;
  struggling: number;
} {
  const schedules = getConditionSchedules();
  const today = getTodayISO();

  return {
    total: schedules.length,
    due: schedules.filter((c) => c.nextReviewDate <= today).length,
    mastered: schedules.filter((c) => c.stability >= 14).length,
    struggling: schedules.filter((c) => c.stability <= 2).length,
  };
}
