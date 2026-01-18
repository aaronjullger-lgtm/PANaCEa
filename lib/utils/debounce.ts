/**
 * Debounce utility for delaying function execution
 *
 * Creates a debounced version of the provided function that delays its execution
 * until after the specified delay has elapsed since the last time it was invoked.
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Creates a debounced function with cleanup capability for use in React components
 * Returns both the debounced function and a cleanup function to cancel pending invocations
 */
export function createDebouncedFunction<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): {
  debounced: (...args: Parameters<T>) => void;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return { debounced, cancel };
}
