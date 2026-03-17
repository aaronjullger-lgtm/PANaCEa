/**
 * Circuit Breaker Pattern for API Calls
 * Prevents cascading failures by stopping requests after repeated failures
 */

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting to close the circuit (half-open state) */
  resetTimeout: number;
  /** Optional: custom function to determine if an error should count as a failure */
  shouldCountFailure?: (error: unknown) => boolean;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      shouldCountFailure: () => true,
      ...options,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime >= this.options.resetTimeout
      ) {
        this.state = 'half-open';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is open - too many failures');
      }
    }

    try {
      const result = await fn();
      // Success - reset failure count and close circuit if it was half-open
      if (this.state === 'half-open') {
        this.state = 'closed';
      }
      this.failureCount = 0;
      return result;
    } catch (error) {
      // Check if this error should count as a failure
      if (this.options.shouldCountFailure(error)) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.options.failureThreshold) {
          this.state = 'open';
        }
      }
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    // Auto-transition from open to half-open if timeout has passed
    if (
      this.state === 'open' &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime >= this.options.resetTimeout
    ) {
      this.state = 'half-open';
      this.failureCount = 0;
    }
    return this.state;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Create a circuit breaker instance for API calls
 * Default: 5 failures in 60 seconds opens the circuit, 30s reset timeout
 */
export function createApiCircuitBreaker(
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
    shouldCountFailure: (error) => {
      // Don't count 401/403 as failures (auth issues, not service failures)
      if (error instanceof Error && error.message.includes('401')) return false;
      if (error instanceof Error && error.message.includes('403')) return false;
      return true;
    },
    ...options,
  });
}

/**
 * Global circuit breaker for sync API (shared across all sync calls)
 */
let syncCircuitBreaker: CircuitBreaker | null = null;

export function getSyncCircuitBreaker(): CircuitBreaker {
  if (!syncCircuitBreaker) {
    syncCircuitBreaker = createApiCircuitBreaker({
      failureThreshold: 3, // Lower threshold for sync (more critical)
      resetTimeout: 60000, // 60 seconds
    });
  }
  return syncCircuitBreaker;
}
