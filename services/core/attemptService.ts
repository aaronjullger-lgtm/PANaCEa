/**
 * Question Attempt Service
 *
 * Client-side service for recording question attempts to the database.
 * Handles the API call to /api/questions/attempt with proper error handling.
 */

import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { logger } from "@/lib/simple-logger";
import { unwrapApiEnvelope, getApiEnvelopeError } from '@/lib/utils/apiEnvelope';

const attemptLogger = logger.scope('AttemptService');

interface AttemptData {
  questionId: string;
  wasCorrect: boolean;
  system?: string;
  conditionId?: string;
  questionType?: string;
  mode?: string;
  timeSpentMs?: number;
  answerChangedCount?: number;
  isRankedAttempt?: boolean;
  idempotencyKey?: string;
}

interface AttemptResponse {
  success: boolean;
  attemptId?: string;
  systemStats?: {
    system: string;
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    recentTrend: 'improving' | 'declining' | 'neutral';
  };
  error?: string;
}

// Retry queue key for localStorage
const RETRY_QUEUE_KEY = 'panceai_attempt_retry_queue';

interface QueuedAttempt {
  data: AttemptData;
  idempotencyKey: string;
  timestamp: number;
  retries: number;
}

function createAttemptIdempotencyKey(questionId: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `attempt-${crypto.randomUUID()}`;
  }
  return `attempt-${questionId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function unwrapUserStatsResponse(payload: unknown): any | null {
  try {
    const data = unwrapApiEnvelope<any>(payload);
    // Try common nesting patterns: { stats } or { data: { stats } }
    if (data && typeof data === 'object') {
      if (data.stats) return data.stats;
      if (data.data && typeof data.data === 'object' && data.data.stats) return data.data.stats;
    }
    // Malformed: no recognizable stats structure found
    return null;
  } catch {
    return null;
  }
}

/**
 * Get queued attempts from localStorage
 */
function getQueuedAttempts(): QueuedAttempt[] {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save queued attempts to localStorage
 */
function saveQueuedAttempts(attempts: QueuedAttempt[]): void {
  try {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(attempts));
  } catch (error) {
    console.error('[AttemptService] Failed to save retry queue:', error);
  }
}

/**
 * Queue an attempt for retry when offline
 */
function queueAttemptForRetry(data: AttemptData): void {
  const queued = getQueuedAttempts();
  const idempotencyKey = data.idempotencyKey ?? createAttemptIdempotencyKey(data.questionId);
  queued.push({
    data: { ...data, idempotencyKey },
    idempotencyKey,
    timestamp: Date.now(),
    retries: 0,
  });
  saveQueuedAttempts(queued);
  console.log('[AttemptService] Queued attempt for retry, queue size:', queued.length);
}

/**
 * Process queued attempts when back online
 */
export async function processRetryQueue(token?: string | null): Promise<{
  processed: number;
  failed: number;
}> {
  const queued = getQueuedAttempts();
  if (queued.length === 0) {
    return { processed: 0, failed: 0 };
  }

  console.log('[AttemptService] Processing retry queue, items:', queued.length);

  let processed = 0;
  let failed = 0;
  const remaining: QueuedAttempt[] = [];

  for (const item of queued) {
    try {
      const result = await sendAttemptToServer(item.data, token);
      if (result) {
        processed++;
      } else {
        // Increment retry count
        item.retries++;
        if (item.retries < 3) {
          remaining.push(item);
        } else {
          failed++;
          console.warn(
            '[AttemptService] Attempt exceeded max retries, dropping:',
            item.data.questionId
          );
        }
      }
    } catch {
      item.retries++;
      if (item.retries < 3) {
        remaining.push(item);
      } else {
        failed++;
      }
    }
  }

  saveQueuedAttempts(remaining);
  console.log('[AttemptService] Retry queue processed:', {
    processed,
    failed,
    remaining: remaining.length,
  });

  return { processed, failed };
}

/**
 * Send attempt to server (internal function)
 */
async function sendAttemptToServer(
  data: AttemptData,
  token?: string | null
): Promise<AttemptResponse | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/questions/attempt', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...data,
      idempotencyKey: data.idempotencyKey ?? createAttemptIdempotencyKey(data.questionId),
    }),
  });

  if (!response.ok) {
    return null;
  }

  return unwrapApiEnvelope<AttemptResponse>(await response.json());
}

/**
 * Record a question attempt to the database
 * Uses retry queue for offline resilience
 */
export async function recordQuestionAttempt(
  data: AttemptData,
  token?: string | null
): Promise<AttemptResponse | null> {
  const idempotentData = {
    ...data,
    idempotencyKey: data.idempotencyKey ?? createAttemptIdempotencyKey(data.questionId),
  };

  try {
    const result = await sendAttemptToServer(idempotentData, token);

    if (result) {
      // Success - also try to process any queued attempts
      processRetryQueue(token).catch((err) => {
        console.warn('[AttemptService] Background retry processing failed:', err);
      });
      return result;
    } else {
      // Failed - queue for retry
      queueAttemptForRetry(idempotentData);
      return null;
    }
  } catch (error) {
    // Network error - queue for retry
    console.error('[AttemptService] Error recording attempt, queueing for retry:', error);
    queueAttemptForRetry(idempotentData);
    return null;
  }
}

/**
 * Get user statistics from the database
 */
export async function getUserStats(token?: string | null): Promise<any | null> {
  try {
    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(getApiEndpoint(API_ENDPOINTS.USER_STATS), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errPayload = await response.json().catch(() => null);
      if (response.status === 404) {
        attemptLogger.warn('User stats not found (404) – user may not be synced yet');
      } else {
        attemptLogger.error('Failed to fetch user stats', {
          status: response.status,
          error: getApiEnvelopeError(errPayload, ''),
        });
      }
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      attemptLogger.warn('User stats response was not JSON', { contentType });
      return null;
    }

    const stats = unwrapApiEnvelope<any>(await response.json());
    if (!stats) {
      attemptLogger.warn('User stats response did not contain stats payload');
    }
    return stats;
  } catch (error) {
    attemptLogger.error('Error fetching user stats', { error });
    return null;
  }
}

export default {
  recordQuestionAttempt,
  getUserStats,
  processRetryQueue,
  getQueuedAttemptCount: () => getQueuedAttempts().length,
};
