/**
 * Shared error reporting for user-facing actions.
 * Use in catch blocks so failures are logged and the user sees a message.
 *
 * Errors are sent to Sentry (if initialized) for production visibility,
 * and a toast is shown to the user.
 */

import { toast } from 'sonner';
import { captureError } from '@/lib/monitoring/sentry';
import { logger } from '@/lib/logger';

/**
 * Messages that indicate expected user-facing conditions (not bugs).
 * These are shown to the user via toast but should NOT be sent to Sentry
 * because they would create noise in the monitoring dashboard.
 */
const EXPECTED_ERROR_PATTERNS = [
  'sign in',
  'log in',
  'logged in',
  'please authenticate',
  'session expired',
  'unauthorized',
];

function isExpectedError(message: string): boolean {
  const lower = message.toLowerCase();
  return EXPECTED_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function reportActionError(
  message: string,
  error?: unknown
): void {
  if (error !== undefined && error !== null) {
    logger.error('[Action error]', { message, error });

    // Only send unexpected errors to Sentry; expected user-facing conditions
    // (e.g. "please sign in") are not bugs and would create noise.
    if (!isExpectedError(message)) {
      const sentryError = error instanceof Error ? error : new Error(String(error));
      captureError(sentryError, {
        tags: { source: 'action_error' },
        extra: { userMessage: message },
        level: 'error',
      });
    }
  }
  toast.error(message);
}
