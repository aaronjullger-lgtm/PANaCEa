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

interface SessionEmptyState {
  code: string;
  message: string;
}

// Full session response
interface SessionResponse {
  questions: Question[];
  analytics: SessionAnalytics;
  poolStatus: PoolStatus;
  emptyState?: SessionEmptyState;
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
 * Fallback identity mapping for API payloads that predate explicit
 * per-question `questionSource` (mirrors SessionService.recordQuestionSeen).
 */
const SOURCE_TO_QUESTION_SOURCE: Record<string, NonNullable<Question['questionSource']>> = {
  pool: 'pre_generated',
  main: 'question',
  seed: 'seed',
  generated: 'generated',
};

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
 *
 * S5 — Accepts an optional external `AbortSignal` so callers (e.g. the
 * replenishment hook) can cancel on unmount or route change. The external
 * signal composes with the internal 15-second timeout controller: either
 * firing aborts the in-flight request. AbortError short-circuits the retry
 * loop — we never retry a cancelled request.
 */
export async function fetchSessionQuestions(
  settings: SessionSettings,
  token?: string | null,
  count: number = 10,
  signal?: AbortSignal
): Promise<SessionResponse> {
  // Map frontend settings to API params
  const params = new URLSearchParams();
  params.set('count', String(count));

  if (settings.simulationStrict) {
    params.set('simulationStrict', 'true');
  }

  if (settings.focus && settings.focus !== 'all' && !settings.simulationStrict) {
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
    // Only set system parameter if focus is a known system (not a special focus like 'growth', 'review', etc.)
    const knownNonSystemFocuses = ['growth', 'review', 'reviewFlagged', 'due'];
    if (!knownNonSystemFocuses.includes(settings.focus)) {
      const system = systemMap[settings.focus.toLowerCase()] || settings.focus;
      params.set('system', system);
    }
  }

  if (!settings.simulationStrict) {
    if (settings.focus === 'review') {
      params.set('mode', 'review');
    } else if (settings.focus === 'growth') {
      params.set('mode', 'weakness');
    }
  }

  const maxRetries = 2;
  const retryDelay = 1000; // 1 second
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // If caller already cancelled before we even start this attempt, bail
      // immediately with a proper AbortError so the outer catch can detect it.
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Add timeout to prevent hanging — composed with the optional external
      // signal. Either the 15 s timeout OR the caller aborting will cancel
      // the in-flight fetch.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds
      const onExternalAbort = () => controller.abort();
      if (signal) {
        signal.addEventListener('abort', onExternalAbort);
      }
      let response: Response;
      try {
        response = await fetch(`/api/questions/session?${params.toString()}`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', onExternalAbort);
        }
      }

      if (!response.ok) {
        let errorMessage = `API error: ${response.status}`;
        try {
          const payload = await response.json();
          if (payload && typeof payload === 'object') {
            const typed = payload as { error?: string; message?: string };
            errorMessage = typed.message || typed.error || errorMessage;
          }
        } catch {
          // Ignore JSON parse errors and keep status-based message.
        }

        // If 503 and not last attempt, retry
        if (response.status === 503 && attempt < maxRetries) {
          console.warn(`[SessionService] API 503 (attempt ${attempt}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
        throw new Error(errorMessage);
      }

      const payload = await response.json();
      const data = (
        payload && typeof payload === 'object' && 'data' in payload
          ? (payload as { data: SessionResponse }).data
          : payload
      ) as SessionResponse;

      // Update pool status cache
      lastPoolStatus = data.poolStatus;

      // Transform API response to frontend Question format.
      // Identity fields (questionSource/canonicalQuestionId/sourceQuestionId) MUST
      // survive this transform: getQuestionIdentity() infers 'question' from any
      // non-derived id, which mis-routes pool/seed submissions in submit-review.
      const questions: Question[] = data.questions.map((q: any) => {
        const questionSource: Question['questionSource'] =
          q.questionSource ?? SOURCE_TO_QUESTION_SOURCE[q.source as string] ?? 'question';
        return {
          id: q.id,
          canonicalQuestionId:
            q.canonicalQuestionId ?? (questionSource === 'question' ? q.id : null),
          sourceQuestionId: q.sourceQuestionId ?? q.id,
          questionSource,
          question: q.question || q.vignette,
          vignette: q.vignette,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
          rationale: q.rationale,
          topic: q.system,
          system: q.system,
          subcategory: q.subcategory,
          conditionId: q.conditionId,
          medicalContentId: q.medicalContentId ?? null,
          condition: q.condition,
          difficulty: q.difficulty,
          pearls: q.pearls || [],
          source: q.source,
          fromStaging: q.fromStaging,
          metadata: q.metadata,
        };
      });

      return {
        questions,
        analytics: data.analytics,
        poolStatus: data.poolStatus,
        emptyState: data.emptyState,
      };
    } catch (error) {
      lastError = error as Error;
      // S5 — Never retry a cancelled fetch. If the caller (or the internal
      // 15 s timeout composed with an external abort) cancelled us, rethrow
      // immediately so the caller can handle it as a silent cancellation.
      const isAbort =
        (error as { name?: string })?.name === 'AbortError' || signal?.aborted === true;
      if (isAbort) {
        throw error;
      }
      console.warn(`[SessionService] API fetch attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  console.error('[SessionService] All API fetch attempts failed:', lastError);
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
      needsGeneration: false,
    },
    emptyState: {
      code: settings.simulationStrict
        ? 'SESSION_SERVICE_UNAVAILABLE'
        : 'SESSION_CANONICAL_SOURCE_UNAVAILABLE',
      message: settings.simulationStrict
        ? 'Simulation is temporarily unavailable. Please try again shortly.'
        : 'Question service is temporarily unavailable. Please try again shortly.',
    },
  };
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
  console.info(
    '[SessionService] Pool refill is handled by reviewed reservoir/admin jobs; client hot-path generation suppressed.',
    { authenticated: Boolean(token) }
  );
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
