/**
 * Promise timeout (edge-safe, no Node APIs).
 * Use to avoid hanging on Gemini or other async calls.
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
 * does not settle within `ms` milliseconds.
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
