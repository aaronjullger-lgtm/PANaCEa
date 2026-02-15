/**
 * Promise timeout for Cloudflare Workers (edge-safe).
 * Use to avoid Worker "code had hung" kills when DB or external calls are slow.
 *
 * For fetch(): use fetchWithTimeout() so the request is actually aborted.
 * For Prisma/DB: withTimeout() races the promise; the underlying call is not
 * aborted (Prisma has no AbortSignal in this setup), but we return 503 before
 * the Worker is killed.
 */

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly ms: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Race a promise against a timeout. Rejects with TimeoutError if the promise
 * does not settle within `ms` milliseconds. The original promise is not cancelled.
 *
 * @param promise - The work to complete
 * @param ms - Timeout in milliseconds (e.g. 8000 for 8s)
 * @param message - Optional message for TimeoutError
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Request timed out'
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new TimeoutError(message, ms)), ms);
  });
  const work = promise.finally(() => {
    if (timerId !== undefined) clearTimeout(timerId);
  });
  return Promise.race([work, timeout]);
}

/**
 * fetch() with strict timeout via AbortController.
 * Use for any external HTTP call so the Worker never hangs waiting on a
 * connection that never closes.
 *
 * @param input - URL or Request
 * @param init - fetch init (signal will be overridden)
 * @param ms - Timeout in milliseconds (e.g. 5000–10000)
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeout?: number } = {},
  ms: number = init.timeout ?? 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timerId);
  }
}
