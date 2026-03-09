/**
 * Shared error reporting for user-facing actions.
 * Use in catch blocks so failures are logged and the user sees a message.
 */

import { toast } from 'sonner';

export function reportActionError(
  message: string,
  error?: unknown
): void {
  if (error !== undefined && error !== null) {
    console.error('[Action error]', message, error);
  }
  toast.error(message);
}
