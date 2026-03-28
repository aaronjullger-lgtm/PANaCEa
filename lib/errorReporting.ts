/**
 * Shared error reporting for user-facing actions.
 * Use in catch blocks so failures are logged and the user sees a message.
 *
 * Errors are sent to Sentry (if initialized) for production visibility,
 * and a toast is shown to the user.
 */

import { toast } from 'sonner';
import { captureError } from '@/lib/monitoring/sentry';

export function reportActionError(
  message: string,
  error?: unknown
): void {
  if (error !== undefined && error !== null) {
    console.error('[Action error]', message, error);

    // Send to Sentry so production errors are visible in the monitoring dashboard
    const sentryError = error instanceof Error ? error : new Error(String(error));
    captureError(sentryError, {
      tags: { source: 'action_error' },
      extra: { userMessage: message },
      level: 'error',
    });
  }
  toast.error(message);
}
