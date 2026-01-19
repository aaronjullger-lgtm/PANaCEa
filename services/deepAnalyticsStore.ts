/**
 * Deep Analytics Store
 *
 * Persistent storage system for comprehensive learning analytics.
 * Stores fine-grained data for research-backed analysis including:
 * - Per-question response patterns
 * - Cognitive state over time
 * - Learning trajectory data
 * - Spaced repetition history
 * - Performance correlations
 *
 * Uses IndexedDB for large dataset storage with localStorage fallback.
 */

// ============================================================================
// Types
// ============================================================================

export interface QuestionAttemptRecord {
  id: string;
  questionId: string;
  timestamp: number;

  // Response data
  isCorrect: boolean;
  timeToAnswerMs: number;
  parTimeMs: number;
  timeRatio: number; // timeToAnswer / parTime

  // Question context
  system: string;
  difficulty: string;
  questionType?: string;

  // Behavioral signals
  answerChanges: number;
  firstAnswer: number | null;
  finalAnswer: number;
  correctAnswer: number;
  eliminatedCount: number;
  hesitationMs: number; // Time before first interaction

  // Confidence
  inferredConfidence: number;
  behavioralConfidence: number;

  // Cognitive state at time of answer
  cognitiveLoad: number;
  fatigueLevel: number;
  flowState: number;

  // Session context
  sessionId: string;
  questionNumberInSession: number;
  streakAtQuestion: number;
  sessionAccuracyAtQuestion: number;

  // Temporal context
  hourOfDay: number;
  dayOfWeek: number;
  minutesSinceSessionStart: number;
}

export interface DailyStudyRecord {
  date: string; // YYYY-MM-DD
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  totalStudyTimeMs: number;
  sessionsCount: number;

  // Performance breakdown
  bySystem: Record<string, { attempted: number; correct: number; accuracy: number }>;
  byHour: Record<number, { attempted: number; correct: number; accuracy: number }>;
  byDifficulty: Record<string, { attempted: number; correct: number; accuracy: number }>;

  // Cognitive metrics
  avgCognitiveLoad: number;
  avgFatigueLevel: number;
  avgFlowState: number;

  // Behavioral patterns
  avgAnswerChanges: number;
  firstInstinctAccuracy: number;
  calibrationScore: number;

  // Velocity metrics
  masteryRate: number;
  retentionEstimate: number;
}

export interface LearningMilestone {
  id: string;
  type: 'accuracy' | 'streak' | 'questions' | 'mastery' | 'time' | 'improvement';
  title: string;
  description: string;
  achievedAt: number;
  value: number;
  previousBest?: number;
}

export interface SystemProgressSnapshot {
  system: string;
  date: string;
  mastery: number;
  questionsAttempted: number;
  accuracy: number;
  retentionRate: number;
  forgettingCurveSlope: number;
  optimalInterval: number;
}

export interface AnalyticsSnapshot {
  id: string;
  timestamp: number;
  type: 'session_end' | 'daily' | 'weekly' | 'milestone';

  // Aggregate metrics
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;

  // Predictions
  predictedPANCEScore: number;
  passProbability: number;
  daysToReady: number | null;

  // System mastery
  systemMastery: Record<string, number>;

  // Learning velocity
  velocityTrend: 'accelerating' | 'stable' | 'decelerating';
  masteryRate: number;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  QUESTION_ATTEMPTS: 'panceai_deep_question_attempts',
  DAILY_RECORDS: 'panceai_deep_daily_records',
  MILESTONES: 'panceai_deep_milestones',
  SYSTEM_PROGRESS: 'panceai_deep_system_progress',
  SNAPSHOTS: 'panceai_deep_snapshots',
  META: 'panceai_deep_meta',
} as const;

// ============================================================================
// IndexedDB Setup
// ============================================================================

const DB_NAME = 'PANCEAIAnalytics';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Question attempts store with indexes
      if (!db.objectStoreNames.contains('questionAttempts')) {
        const qaStore = db.createObjectStore('questionAttempts', { keyPath: 'id' });
        qaStore.createIndex('timestamp', 'timestamp');
        qaStore.createIndex('questionId', 'questionId');
        qaStore.createIndex('system', 'system');
        qaStore.createIndex('sessionId', 'sessionId');
        qaStore.createIndex('isCorrect', 'isCorrect');
      }

      // Daily records store
      if (!db.objectStoreNames.contains('dailyRecords')) {
        const drStore = db.createObjectStore('dailyRecords', { keyPath: 'date' });
        drStore.createIndex('date', 'date');
      }

      // System progress snapshots
      if (!db.objectStoreNames.contains('systemProgress')) {
        const spStore = db.createObjectStore('systemProgress', {
          keyPath: 'id',
          autoIncrement: true,
        });
        spStore.createIndex('system', 'system');
        spStore.createIndex('date', 'date');
      }

      // Milestones
      if (!db.objectStoreNames.contains('milestones')) {
        const mStore = db.createObjectStore('milestones', { keyPath: 'id' });
        mStore.createIndex('type', 'type');
        mStore.createIndex('achievedAt', 'achievedAt');
      }

      // Analytics snapshots
      if (!db.objectStoreNames.contains('snapshots')) {
        const sStore = db.createObjectStore('snapshots', { keyPath: 'id' });
        sStore.createIndex('timestamp', 'timestamp');
        sStore.createIndex('type', 'type');
      }
    };
  });

  return dbInitPromise;
}

// ============================================================================
// Core Storage Functions
// ============================================================================

/**
 * Store a question attempt record
 */
export async function storeQuestionAttempt(attempt: QuestionAttemptRecord): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('questionAttempts', 'readwrite');
    const store = tx.objectStore('questionAttempts');
    store.put(attempt);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    // Fallback to localStorage for small batches
    console.warn('IndexedDB failed, using localStorage fallback:', error);
    const existing = getLocalStorageArray<QuestionAttemptRecord>(STORAGE_KEYS.QUESTION_ATTEMPTS);
    // Keep last 1000 in localStorage
    const trimmed = [...existing, attempt].slice(-1000);
    setLocalStorageArray(STORAGE_KEYS.QUESTION_ATTEMPTS, trimmed);
  }
}

/**
 * Get question attempts with optional filters
 */
export async function getQuestionAttempts(options?: {
  limit?: number;
  system?: string;
  sessionId?: string;
  startTime?: number;
  endTime?: number;
}): Promise<QuestionAttemptRecord[]> {
  try {
    const db = await initDB();
    const tx = db.transaction('questionAttempts', 'readonly');
    const store = tx.objectStore('questionAttempts');

    const results: QuestionAttemptRecord[] = [];

    await new Promise<void>((resolve, reject) => {
      const request = store.index('timestamp').openCursor(null, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        const attempt = cursor.value as QuestionAttemptRecord;
        let include = true;

        if (options?.system && attempt.system !== options.system) include = false;
        if (options?.sessionId && attempt.sessionId !== options.sessionId) include = false;
        if (options?.startTime && attempt.timestamp < options.startTime) include = false;
        if (options?.endTime && attempt.timestamp > options.endTime) include = false;

        if (include) {
          results.push(attempt);
        }

        if (options?.limit && results.length >= options.limit) {
          resolve();
          return;
        }

        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });

    return results;
  } catch {
    // Fallback to localStorage
    let attempts = getLocalStorageArray<QuestionAttemptRecord>(STORAGE_KEYS.QUESTION_ATTEMPTS);

    if (options?.system) {
      attempts = attempts.filter((a) => a.system === options.system);
    }
    if (options?.sessionId) {
      attempts = attempts.filter((a) => a.sessionId === options.sessionId);
    }
    if (options?.startTime) {
      attempts = attempts.filter((a) => a.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      attempts = attempts.filter((a) => a.timestamp <= options.endTime!);
    }
    if (options?.limit) {
      attempts = attempts.slice(-options.limit);
    }

    return attempts.reverse();
  }
}

/**
 * Store daily study record
 */
export async function storeDailyRecord(record: DailyStudyRecord): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('dailyRecords', 'readwrite');
    const store = tx.objectStore('dailyRecords');
    store.put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = getLocalStorageArray<DailyStudyRecord>(STORAGE_KEYS.DAILY_RECORDS);
    const idx = existing.findIndex((r) => r.date === record.date);
    if (idx >= 0) {
      existing[idx] = record;
    } else {
      existing.push(record);
    }
    setLocalStorageArray(STORAGE_KEYS.DAILY_RECORDS, existing.slice(-365));
  }
}

/**
 * Get daily records for date range
 */
export async function getDailyRecords(
  startDate?: string,
  endDate?: string
): Promise<DailyStudyRecord[]> {
  try {
    const db = await initDB();
    const tx = db.transaction('dailyRecords', 'readonly');
    const store = tx.objectStore('dailyRecords');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        let records = request.result as DailyStudyRecord[];
        if (startDate) records = records.filter((r) => r.date >= startDate);
        if (endDate) records = records.filter((r) => r.date <= endDate);
        records.sort((a, b) => a.date.localeCompare(b.date));
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    let records = getLocalStorageArray<DailyStudyRecord>(STORAGE_KEYS.DAILY_RECORDS);
    if (startDate) records = records.filter((r) => r.date >= startDate);
    if (endDate) records = records.filter((r) => r.date <= endDate);
    return records.sort((a, b) => a.date.localeCompare(b.date));
  }
}

/**
 * Store a milestone
 */
export async function storeMilestone(milestone: LearningMilestone): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('milestones', 'readwrite');
    tx.objectStore('milestones').put(milestone);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = getLocalStorageArray<LearningMilestone>(STORAGE_KEYS.MILESTONES);
    existing.push(milestone);
    setLocalStorageArray(STORAGE_KEYS.MILESTONES, existing.slice(-100));
  }
}

/**
 * Get all milestones
 */
export async function getMilestones(): Promise<LearningMilestone[]> {
  try {
    const db = await initDB();
    const tx = db.transaction('milestones', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('milestones').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return getLocalStorageArray<LearningMilestone>(STORAGE_KEYS.MILESTONES);
  }
}

/**
 * Store analytics snapshot
 */
export async function storeSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put(snapshot);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = getLocalStorageArray<AnalyticsSnapshot>(STORAGE_KEYS.SNAPSHOTS);
    existing.push(snapshot);
    setLocalStorageArray(STORAGE_KEYS.SNAPSHOTS, existing.slice(-200));
  }
}

/**
 * Get snapshots by type
 */
export async function getSnapshots(type?: AnalyticsSnapshot['type']): Promise<AnalyticsSnapshot[]> {
  try {
    const db = await initDB();
    const tx = db.transaction('snapshots', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('snapshots').getAll();
      request.onsuccess = () => {
        let results = request.result as AnalyticsSnapshot[];
        if (type) results = results.filter((s) => s.type === type);
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    let snapshots = getLocalStorageArray<AnalyticsSnapshot>(STORAGE_KEYS.SNAPSHOTS);
    if (type) snapshots = snapshots.filter((s) => s.type === type);
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getLocalStorageArray<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalStorageArray<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('localStorage write failed:', error);
  }
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get today's date string
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  questionAttempts: number;
  dailyRecords: number;
  milestones: number;
  snapshots: number;
  estimatedSizeKB: number;
}> {
  const attempts = await getQuestionAttempts({ limit: 100000 });
  const daily = await getDailyRecords();
  const milestones = await getMilestones();
  const snapshots = await getSnapshots();

  // Rough size estimate
  const estimatedSizeKB = Math.round(
    (JSON.stringify(attempts).length +
      JSON.stringify(daily).length +
      JSON.stringify(milestones).length +
      JSON.stringify(snapshots).length) /
      1024
  );

  return {
    questionAttempts: attempts.length,
    dailyRecords: daily.length,
    milestones: milestones.length,
    snapshots: snapshots.length,
    estimatedSizeKB,
  };
}

export default {
  storeQuestionAttempt,
  getQuestionAttempts,
  storeDailyRecord,
  getDailyRecords,
  storeMilestone,
  getMilestones,
  storeSnapshot,
  getSnapshots,
  getStorageStats,
  generateId,
  getTodayString,
};
