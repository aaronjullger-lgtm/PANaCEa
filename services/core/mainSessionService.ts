/**
 * Main Session Service
 *
 * Client-side orchestrator for the main study session:
 * - Fetches questions from the new /api/questions/session endpoint
 * - Handles fallback to local generation
 * - Manages session state and analytics
 * - Provides hooks for real-time updates
 */

import type { Question, SessionSettings } from '@/types';
import { getQuestionBatch } from './questionService';
import { resetMomentum } from '@/services/session';

// Session analytics from API
interface SessionAnalytics {
  questionsServed: number;
  fromPool: number;
  fromMain: number;
  generated: number;
  fromSeeds: number;
  avgDifficulty: number;
  systemDistribution: Record<string, number>;
}

// Pool status for low-question warnings
interface PoolStatus {
  available: number;
  needsGeneration: boolean;
}

// Full session response
interface SessionResponse {
  questions: Question[];
  analytics: SessionAnalytics;
  poolStatus: PoolStatus;
}

// Session state for tracking
interface SessionState {
  sessionId: string;
  startTime: number;
  questionsAnswered: number;
  correctAnswers: number;
  totalTimeMs: number;
  systemPerformance: Record<string, { correct: number; total: number }>;
}

// Cache for session state
let currentSession: SessionState | null = null;
let lastPoolStatus: PoolStatus | null = null;

/**
 * Initialize a new session
 */
export function initializeSession(): SessionState {
  // Reset momentum tracking from previous session
  resetMomentum();
  
  currentSession = {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startTime: Date.now(),
    questionsAnswered: 0,
    correctAnswers: 0,
    totalTimeMs: 0,
    systemPerformance: {},
  };
  return currentSession;
}

/**
 * Get current session state
 */
export function getSessionState(): SessionState | null {
  return currentSession;
}

/**
 * Get last known pool status
 */
export function getPoolStatus(): PoolStatus | null {
  return lastPoolStatus;
}

/**
 * Fetch questions for a study session
 */
export async function fetchSessionQuestions(
  settings: SessionSettings,
  token?: string | null,
  count: number = 10
): Promise<SessionResponse> {
  // Map frontend settings to API params
  const params = new URLSearchParams();
  params.set('count', String(count));

  if (settings.focus && settings.focus !== 'all') {
    const systemMap: Record<string, string> = {
      cardiology: 'CV',
      pulmonology: 'PULM',
      gastroenterology: 'GI',
      neurology: 'NEURO',
      musculoskeletal: 'MSK',
      dermatology: 'DERM',
      hematology: 'HEME',
      endocrinology: 'ENDO',
      heent: 'HEENT',
      renal: 'RENAL',
      reproductive: 'REPRO',
      psychiatry: 'PSYCH',
      infectious: 'ID',
    };
    const system = systemMap[settings.focus.toLowerCase()] || settings.focus;
    params.set('system', system);
  }

  if (settings.focus === 'review') {
    params.set('mode', 'review');
  } else if (settings.focus === 'growth') {
    params.set('mode', 'weakness');
  }

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/questions/session?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Update pool status cache
    lastPoolStatus = data.poolStatus;

    // Transform API response to frontend Question format
    const questions: Question[] = data.questions.map((q: any) => ({
      id: q.id,
      question: q.question || q.vignette,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
      rationale: q.rationale,
      topic: q.system,
      system: q.system,
      subcategory: q.subcategory,
      conditionId: q.conditionId,
      condition: q.condition,
      pearls: q.pearls || [],
      source: q.source,
      fromStaging: q.fromStaging,
      metadata: q.metadata,
    }));

    return {
      questions,
      analytics: data.analytics,
      poolStatus: data.poolStatus,
    };
  } catch (error) {
    console.error('[SessionService] API fetch failed, using fallback:', error);
    return fallbackQuestionFetch(settings, count);
  }
}

/**
 * Fallback to local generation when API fails
 */
async function fallbackQuestionFetch(
  settings: SessionSettings,
  count: number
): Promise<SessionResponse> {
  try {
    // Use statically imported question service as fallback
    const questions = await getQuestionBatch(settings, [], count);

    return {
      questions,
      analytics: {
        questionsServed: questions.length,
        fromPool: 0,
        fromMain: 0,
        generated: questions.length,
        fromSeeds: 0,
        avgDifficulty: 2,
        systemDistribution: {},
      },
      poolStatus: {
        available: 0,
        needsGeneration: true,
      },
    };
  } catch (fallbackError) {
    console.error('[SessionService] Fallback also failed:', fallbackError);
    return {
      questions: [],
      analytics: {
        questionsServed: 0,
        fromPool: 0,
        fromMain: 0,
        generated: 0,
        fromSeeds: 0,
        avgDifficulty: 0,
        systemDistribution: {},
      },
      poolStatus: {
        available: 0,
        needsGeneration: true,
      },
    };
  }
}

/**
 * Record a question answer in the current session
 */
export function recordSessionAnswer(
  questionId: string,
  isCorrect: boolean,
  system: string,
  timeSpentMs: number
): void {
  if (!currentSession) {
    currentSession = initializeSession();
  }

  currentSession.questionsAnswered++;
  currentSession.totalTimeMs += timeSpentMs;

  if (isCorrect) {
    currentSession.correctAnswers++;
  }

  // Track per-system performance
  if (!currentSession.systemPerformance[system]) {
    currentSession.systemPerformance[system] = { correct: 0, total: 0 };
  }
  currentSession.systemPerformance[system].total++;
  if (isCorrect) {
    currentSession.systemPerformance[system].correct++;
  }
}

/**
 * Get session summary for end-of-session display
 */
export function getSessionSummary(): {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  avgTimePerQuestion: number;
  sessionDuration: number;
  systemPerformance: Array<{
    system: string;
    correct: number;
    total: number;
    accuracy: number;
  }>;
  strengths: string[];
  weaknesses: string[];
} | null {
  if (!currentSession) return null;

  const accuracy =
    currentSession.questionsAnswered > 0
      ? (currentSession.correctAnswers / currentSession.questionsAnswered) * 100
      : 0;

  const avgTimePerQuestion =
    currentSession.questionsAnswered > 0
      ? currentSession.totalTimeMs / currentSession.questionsAnswered
      : 0;

  const sessionDuration = Date.now() - currentSession.startTime;

  // Calculate per-system stats
  const systemStats = Object.entries(currentSession.systemPerformance).map(([system, stats]) => ({
    system,
    correct: stats.correct,
    total: stats.total,
    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
  }));

  // Sort to find strengths and weaknesses
  const sortedSystems = [...systemStats].sort((a, b) => b.accuracy - a.accuracy);
  const strengths = sortedSystems
    .filter((s) => s.accuracy >= 70 && s.total >= 2)
    .map((s) => s.system);
  const weaknesses = sortedSystems
    .filter((s) => s.accuracy < 60 && s.total >= 2)
    .map((s) => s.system);

  return {
    totalQuestions: currentSession.questionsAnswered,
    correctAnswers: currentSession.correctAnswers,
    accuracy,
    avgTimePerQuestion,
    sessionDuration,
    systemPerformance: systemStats,
    strengths,
    weaknesses,
  };
}

/**
 * End the current session
 */
export function endSession(): SessionState | null {
  const session = currentSession;
  currentSession = null;
  return session;
}

/**
 * Prefetch questions for smoother UX
 */
export async function prefetchQuestions(
  settings: SessionSettings,
  token?: string | null,
  count: number = 5
): Promise<void> {
  // Background prefetch - don't await or block
  fetchSessionQuestions(settings, token, count)
    .then((result) => {
      console.log(`[SessionService] Prefetched ${result.questions.length} questions`);
    })
    .catch((err) => {
      console.warn('[SessionService] Prefetch failed:', err);
    });
}

/**
 * Check if pool needs replenishment and trigger background generation
 */
export async function checkAndReplenishPool(token?: string | null): Promise<void> {
  if (!lastPoolStatus?.needsGeneration) return;

  try {
    const response = await fetch('/api/questions/generate-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ count: 20 }),
    });

    if (response.ok) {
      console.log('[SessionService] Triggered background pool replenishment');
    }
  } catch (error) {
    console.warn('[SessionService] Failed to trigger pool replenishment:', error);
  }
}

export default {
  initializeSession,
  getSessionState,
  getPoolStatus,
  fetchSessionQuestions,
  recordSessionAnswer,
  getSessionSummary,
  endSession,
  prefetchQuestions,
  checkAndReplenishPool,
};
