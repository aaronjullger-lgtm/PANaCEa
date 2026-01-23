/**
 * useFSRSOptimizer - React hook for client-side FSRS parameter optimization
 *
 * PHASE 4: NEURO-SYMBOLIC INTEGRITY - Milestone 3
 *
 * This hook provides:
 * 1. Automatic optimization trigger after 500 reviews
 * 2. On-demand optimization with progress feedback
 * 3. Storage of optimized parameters in UserProgress.fsrsParams
 * 4. Per-system performance modifiers
 *
 * @module hooks/useFSRSOptimizer
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  runFullOptimization,
  canOptimize,
  summarizeOptimization,
  type PersonalizedFSRSParams,
  type OptimizationReview,
  MIN_REVIEWS_FOR_OPTIMIZATION,
} from '../lib/fsrs-optimizer';
import type { ReviewSnapshot } from '../lib/fsrs';

// ============================================================================
// Constants
// ============================================================================

/** Minimum reviews before auto-optimization is triggered (per plan: 500) */
export const AUTO_OPTIMIZATION_THRESHOLD = 500;

/** LocalStorage key for optimization state */
const OPTIMIZATION_STATE_KEY = 'panceai_fsrs_optimization';

/** LocalStorage key for last optimization timestamp */
const LAST_OPTIMIZATION_KEY = 'panceai_fsrs_last_optimized';

/** Minimum hours between auto-optimizations */
const MIN_HOURS_BETWEEN_OPTIMIZATIONS = 24;

// ============================================================================
// Types
// ============================================================================

export interface OptimizationState {
  /** Whether optimization is currently running */
  isOptimizing: boolean;

  /** Progress percentage (0-100) */
  progress: number;

  /** Current status message */
  statusMessage: string;

  /** Last optimization result */
  lastResult: PersonalizedFSRSParams | null;

  /** Error message if optimization failed */
  error: string | null;

  /** Whether user has enough reviews for optimization */
  canOptimize: boolean;

  /** Reviews needed before optimization is available */
  reviewsNeeded: number;

  /** Whether auto-optimization threshold is met */
  autoOptimizationReady: boolean;
}

export interface UseFSRSOptimizerOptions {
  /** User ID for optimization */
  userId: string;

  /** Callback when optimization completes */
  onOptimizationComplete?: (params: PersonalizedFSRSParams) => void;

  /** Callback to save optimized parameters to database */
  onSaveParams?: (params: PersonalizedFSRSParams) => Promise<void>;

  /** Enable automatic optimization when threshold is met */
  enableAutoOptimization?: boolean;
}

export interface UseFSRSOptimizerReturn {
  /** Current optimization state */
  state: OptimizationState;

  /** Trigger manual optimization */
  optimize: (
    reviewHistory: ReviewSnapshot[],
    systemCodes?: Record<number, string>
  ) => Promise<PersonalizedFSRSParams | null>;

  /** Check if optimization should run (threshold met + not recently optimized) */
  shouldAutoOptimize: (reviewCount: number) => boolean;

  /** Get human-readable optimization summary */
  getSummary: () => string | null;

  /** Reset optimization state */
  reset: () => void;

  /** Dismiss any errors */
  dismissError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFSRSOptimizer(options: UseFSRSOptimizerOptions): UseFSRSOptimizerReturn {
  const { userId, onOptimizationComplete, onSaveParams, enableAutoOptimization = true } = options;

  // State
  const [state, setState] = useState<OptimizationState>(() => {
    // Try to restore last result from localStorage
    let lastResult: PersonalizedFSRSParams | null = null;
    try {
      const saved = localStorage.getItem(OPTIMIZATION_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.userId === userId) {
          lastResult = parsed.result;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    return {
      isOptimizing: false,
      progress: 0,
      statusMessage: '',
      lastResult,
      error: null,
      canOptimize: false,
      reviewsNeeded: MIN_REVIEWS_FOR_OPTIMIZATION,
      autoOptimizationReady: false,
    };
  });

  // Ref to track if optimization is in progress
  const optimizingRef = useRef(false);

  /**
   * Check if auto-optimization should trigger
   */
  const shouldAutoOptimize = useCallback(
    (reviewCount: number): boolean => {
      if (!enableAutoOptimization) return false;
      if (reviewCount < AUTO_OPTIMIZATION_THRESHOLD) return false;

      // Check if we've optimized recently
      try {
        const lastOptimized = localStorage.getItem(LAST_OPTIMIZATION_KEY);
        if (lastOptimized) {
          const hoursSinceOptimization =
            (Date.now() - parseInt(lastOptimized, 10)) / (1000 * 60 * 60);
          if (hoursSinceOptimization < MIN_HOURS_BETWEEN_OPTIMIZATIONS) {
            return false;
          }
        }
      } catch {
        // Proceed if localStorage fails
      }

      return true;
    },
    [enableAutoOptimization]
  );

  /**
   * Run FSRS parameter optimization
   */
  const optimize = useCallback(
    async (
      reviewHistory: ReviewSnapshot[],
      systemCodes?: Record<number, string>
    ): Promise<PersonalizedFSRSParams | null> => {
      // Prevent concurrent optimizations
      if (optimizingRef.current) {
        console.warn('[useFSRSOptimizer] Optimization already in progress');
        return null;
      }

      // Check minimum requirements
      const eligibility = canOptimize(reviewHistory.length);
      if (!eligibility.canOptimize) {
        setState((prev) => ({
          ...prev,
          canOptimize: false,
          reviewsNeeded: eligibility.reviewsNeeded,
          error: eligibility.message,
        }));
        return null;
      }

      optimizingRef.current = true;

      setState((prev) => ({
        ...prev,
        isOptimizing: true,
        progress: 0,
        statusMessage: 'Preparing review data...',
        error: null,
      }));

      try {
        // Step 1: Data preparation (10%)
        setState((prev) => ({
          ...prev,
          progress: 10,
          statusMessage: `Processing ${reviewHistory.length} reviews...`,
        }));

        // Small delay to allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Step 2: Run optimization (10-80%)
        setState((prev) => ({
          ...prev,
          progress: 20,
          statusMessage: 'Running L-BFGS optimization...',
        }));

        const result = await runFullOptimization(userId, reviewHistory, systemCodes);

        // Step 3: Validate results (80-90%)
        setState((prev) => ({
          ...prev,
          progress: 80,
          statusMessage: 'Validating optimized parameters...',
        }));

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Step 4: Save results (90-100%)
        setState((prev) => ({
          ...prev,
          progress: 90,
          statusMessage: 'Saving personalized parameters...',
        }));

        // Save to localStorage
        try {
          localStorage.setItem(
            OPTIMIZATION_STATE_KEY,
            JSON.stringify({
              userId,
              result,
              timestamp: Date.now(),
            })
          );
          localStorage.setItem(LAST_OPTIMIZATION_KEY, Date.now().toString());
        } catch {
          console.warn('[useFSRSOptimizer] Failed to save to localStorage');
        }

        // Call save callback if provided
        if (onSaveParams) {
          await onSaveParams(result);
        }

        // Step 5: Complete
        setState((prev) => ({
          ...prev,
          isOptimizing: false,
          progress: 100,
          statusMessage: 'Optimization complete!',
          lastResult: result,
          canOptimize: true,
          reviewsNeeded: 0,
          autoOptimizationReady: false,
        }));

        // Call completion callback
        if (onOptimizationComplete) {
          onOptimizationComplete(result);
        }

        console.log(
          '[useFSRSOptimizer] Optimization complete:',
          `${result.improvementOverDefault.toFixed(1)}% improvement`
        );

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error during optimization';

        setState((prev) => ({
          ...prev,
          isOptimizing: false,
          progress: 0,
          statusMessage: '',
          error: errorMessage,
        }));

        console.error('[useFSRSOptimizer] Optimization failed:', error);
        return null;
      } finally {
        optimizingRef.current = false;
      }
    },
    [userId, onOptimizationComplete, onSaveParams]
  );

  /**
   * Get human-readable summary of last optimization
   */
  const getSummary = useCallback((): string | null => {
    if (!state.lastResult) return null;
    return summarizeOptimization(state.lastResult);
  }, [state.lastResult]);

  /**
   * Reset optimization state
   */
  const reset = useCallback(() => {
    setState({
      isOptimizing: false,
      progress: 0,
      statusMessage: '',
      lastResult: null,
      error: null,
      canOptimize: false,
      reviewsNeeded: MIN_REVIEWS_FOR_OPTIMIZATION,
      autoOptimizationReady: false,
    });

    try {
      localStorage.removeItem(OPTIMIZATION_STATE_KEY);
      localStorage.removeItem(LAST_OPTIMIZATION_KEY);
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Dismiss error
   */
  const dismissError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Update eligibility state when review count changes
   */
  const updateEligibility = useCallback((reviewCount: number) => {
    const eligibility = canOptimize(reviewCount);
    const autoReady = reviewCount >= AUTO_OPTIMIZATION_THRESHOLD;

    setState((prev) => ({
      ...prev,
      canOptimize: eligibility.canOptimize,
      reviewsNeeded: eligibility.reviewsNeeded,
      autoOptimizationReady: autoReady,
    }));
  }, []);

  return {
    state,
    optimize,
    shouldAutoOptimize,
    getSummary,
    reset,
    dismissError,
  };
}

// ============================================================================
// Utility Hook: useAutoOptimization
// ============================================================================

/**
 * Hook that automatically triggers optimization when threshold is met
 */
export function useAutoOptimization(
  optimizer: UseFSRSOptimizerReturn,
  reviewHistory: ReviewSnapshot[] | null,
  systemCodes?: Record<number, string>
): void {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!reviewHistory || hasTriggeredRef.current) return;

    const reviewCount = reviewHistory.length;

    if (optimizer.shouldAutoOptimize(reviewCount)) {
      console.log(`[useAutoOptimization] Triggering auto-optimization (${reviewCount} reviews)`);
      hasTriggeredRef.current = true;
      optimizer.optimize(reviewHistory, systemCodes);
    }
  }, [reviewHistory, systemCodes, optimizer]);
}

// ============================================================================
// Export
// ============================================================================

export default useFSRSOptimizer;
