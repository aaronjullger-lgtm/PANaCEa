/**
 * Comprehensive loading state management hook
 * Provides standardized loading patterns for async operations across the application
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface LoadingState {
  /** Whether the operation is currently loading */
  isLoading: boolean;
  /** Error message if the operation failed */
  error: string | null;
  /** Progress percentage (0-100) for operations with known progress */
  progress: number | null;
  /** Time elapsed since loading started (in milliseconds) */
  elapsedTime: number;
  /** Whether the operation has timed out */
  hasTimedOut: boolean;
  /** Estimated time remaining (in milliseconds) */
  estimatedRemaining: number | null;
}

export interface UseLoadingStateOptions {
  /** Timeout in milliseconds before marking as timed out */
  timeoutMs?: number;
  /** Whether to show progress indicators */
  showProgress?: boolean;
  /** Estimated total duration for progress calculation */
  estimatedDurationMs?: number;
  /** Callback when timeout occurs */
  onTimeout?: () => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
  /** Callback when loading completes successfully */
  onComplete?: () => void;
}

export interface LoadingActions {
  /** Start loading with optional initial state */
  start: (initialProgress?: number) => void;
  /** Update progress percentage */
  updateProgress: (progress: number) => void;
  /** Mark as completed successfully */
  complete: () => void;
  /** Set error state */
  setError: (error: string) => void;
  /** Reset loading state */
  reset: () => void;
  /** Retry the operation */
  retry: () => void;
}

/**
 * Hook for managing loading state with timeout, progress tracking, and error handling
 */
export function useLoadingState(
  options: UseLoadingStateOptions = {}
): [LoadingState, LoadingActions] {
  const {
    timeoutMs = 30000, // 30 seconds default timeout
    showProgress = false,
    estimatedDurationMs,
    onTimeout,
    onError,
    onComplete,
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    progress: null,
    elapsedTime: 0,
    hasTimedOut: false,
    estimatedRemaining: estimatedDurationMs || null,
  });

  const startTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup intervals and timeouts
  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  // Update elapsed time periodically
  const startElapsedTimer = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        setState((prev) => ({
          ...prev,
          elapsedTime: elapsed,
          // Update estimated remaining if we have an estimated duration
          estimatedRemaining: estimatedDurationMs
            ? Math.max(0, estimatedDurationMs - elapsed)
            : null,
        }));
      }
    }, 100); // Update every 100ms for smooth progress
  }, [estimatedDurationMs]);

  const start = useCallback(
    (initialProgress = 0) => {
      cleanup();

      startTimeRef.current = Date.now();
      setState({
        isLoading: true,
        error: null,
        progress: showProgress ? initialProgress : null,
        elapsedTime: 0,
        hasTimedOut: false,
        estimatedRemaining: estimatedDurationMs || null,
      });

      startElapsedTimer();

      // Set timeout
      if (timeoutMs > 0) {
        timeoutRef.current = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            hasTimedOut: true,
            isLoading: false,
          }));
          onTimeout?.();
        }, timeoutMs);
      }
    },
    [cleanup, showProgress, estimatedDurationMs, timeoutMs, startElapsedTimer, onTimeout]
  );

  const updateProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  }, []);

  const complete = useCallback(() => {
    cleanup();
    setState((prev) => ({
      ...prev,
      isLoading: false,
      progress: showProgress ? 100 : null,
      hasTimedOut: false,
    }));
    onComplete?.();
  }, [cleanup, showProgress, onComplete]);

  const setError = useCallback(
    (error: string) => {
      cleanup();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
        hasTimedOut: false,
      }));
      onError?.(error);
    },
    [cleanup, onError]
  );

  const reset = useCallback(() => {
    cleanup();
    setState({
      isLoading: false,
      error: null,
      progress: null,
      elapsedTime: 0,
      hasTimedOut: false,
      estimatedRemaining: estimatedDurationMs || null,
    });
  }, [cleanup, estimatedDurationMs]);

  const retry = useCallback(() => {
    reset();
    start();
  }, [reset, start]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return [state, { start, updateProgress, complete, setError, reset, retry }];
}

/**
 * Hook for managing loading state for a specific async operation
 */
export function useAsyncLoading<T = void>(
  asyncFn: () => Promise<T>,
  options: UseLoadingStateOptions = {}
): [LoadingState, () => Promise<T | null>, LoadingActions] {
  const [state, actions] = useLoadingState(options);

  const execute = useCallback(async (): Promise<T | null> => {
    actions.start();
    try {
      const result = await asyncFn();
      actions.complete();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      actions.setError(errorMessage);
      return null;
    }
  }, [asyncFn, actions]);

  return [state, execute, actions];
}

/**
 * Hook for managing loading state with progress updates for long-running operations
 */
export function useProgressLoading(
  options: UseLoadingStateOptions & {
    /** Callback to update progress at regular intervals */
    onProgressUpdate?: (progress: number, elapsed: number) => void;
  } = {}
): [
  LoadingState,
  LoadingActions & {
    /** Increment progress by a specific amount */
    incrementProgress: (amount: number) => void;
    /** Set progress to a specific value */
    setProgress: (progress: number) => void;
  },
] {
  const [state, actions] = useLoadingState({
    ...options,
    showProgress: true,
  });

  const incrementProgress = useCallback(
    (amount: number) => {
      if (state.progress !== null) {
        actions.updateProgress(state.progress + amount);
      }
    },
    [state.progress, actions]
  );

  const setProgress = useCallback(
    (progress: number) => {
      actions.updateProgress(progress);
    },
    [actions]
  );

  return [state, { ...actions, incrementProgress, setProgress }];
}

/**
 * Hook for managing multiple parallel loading states
 */
export function useMultiLoading(
  count: number,
  options: UseLoadingStateOptions = {}
): {
  states: LoadingState[];
  actions: Array<LoadingActions>;
  allComplete: boolean;
  anyLoading: boolean;
  anyError: boolean;
  overallProgress: number;
} {
  const [states, setStates] = useState<LoadingState[]>(
    Array(count)
      .fill(null)
      .map(() => ({
        isLoading: false,
        error: null,
        progress: null,
        elapsedTime: 0,
        hasTimedOut: false,
        estimatedRemaining: null,
      }))
  );

  const actions = states.map((_, index) => {
    const updateState = (updater: (prev: LoadingState) => LoadingState) => {
      setStates((prev) => {
        const newStates = [...prev];
        newStates[index] = updater(newStates[index]);
        return newStates;
      });
    };

    return {
      start: (initialProgress?: number) => {
        updateState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
          progress: options.showProgress ? initialProgress || 0 : null,
          elapsedTime: 0,
          hasTimedOut: false,
        }));
      },
      updateProgress: (progress: number) => {
        updateState((prev) => ({
          ...prev,
          progress: Math.min(100, Math.max(0, progress)),
        }));
      },
      complete: () => {
        updateState((prev) => ({
          ...prev,
          isLoading: false,
          progress: options.showProgress ? 100 : null,
          hasTimedOut: false,
        }));
        options.onComplete?.();
      },
      setError: (error: string) => {
        updateState((prev) => ({
          ...prev,
          isLoading: false,
          error,
          hasTimedOut: false,
        }));
        options.onError?.(error);
      },
      reset: () => {
        updateState(() => ({
          isLoading: false,
          error: null,
          progress: null,
          elapsedTime: 0,
          hasTimedOut: false,
          estimatedRemaining: null,
        }));
      },
      retry: () => {
        updateState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
          progress: options.showProgress ? 0 : null,
          elapsedTime: 0,
          hasTimedOut: false,
        }));
      },
    };
  });

  const allComplete = states.every((s) => !s.isLoading && !s.error);
  const anyLoading = states.some((s) => s.isLoading);
  const anyError = states.some((s) => s.error !== null);

  const overallProgress =
    states.reduce((total, state) => {
      return total + (state.progress || 0);
    }, 0) / count;

  return {
    states,
    actions,
    allComplete,
    anyLoading,
    anyError,
    overallProgress,
  };
}

/**
 * Utility function to format loading time for display
 */
export function formatLoadingTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Utility function to get loading severity based on elapsed time
 */
export function getLoadingSeverity(elapsedMs: number): 'normal' | 'warning' | 'critical' {
  if (elapsedMs < 5000) return 'normal';
  if (elapsedMs < 15000) return 'warning';
  return 'critical';
}
