/**
 * Question Attempt Service
 *
 * Client-side service for recording question attempts to the database.
 * Handles the API call to /api/questions/attempt with proper error handling.
 */

import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

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
  timestamp: number;
  retries: number;
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
  queued.push({
    data,
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
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

/**
 * Record a question attempt to the database
 * Uses retry queue for offline resilience
 */
export async function recordQuestionAttempt(
  data: AttemptData,
  token?: string | null
): Promise<AttemptResponse | null> {
  try {
    const result = await sendAttemptToServer(data, token);

    if (result) {
      // Success - also try to process any queued attempts
      processRetryQueue(token).catch((err) => {
        console.warn('[AttemptService] Background retry processing failed:', err);
      });
      return result;
    } else {
      // Failed - queue for retry
      queueAttemptForRetry(data);
      return null;
    }
  } catch (error) {
    // Network error - queue for retry
    console.error('[AttemptService] Error recording attempt, queueing for retry:', error);
    queueAttemptForRetry(data);
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
      console.error('[AttemptService] Failed to fetch user stats:', response.status);
      return null;
    }

    const result = await response.json();
    return result.stats;
  } catch (error) {
    console.error('[AttemptService] Error fetching user stats:', error);
    return null;
  }
}

export default {
  recordQuestionAttempt,
  getUserStats,
  processRetryQueue,
  getQueuedAttemptCount: () => getQueuedAttempts().length,
};
