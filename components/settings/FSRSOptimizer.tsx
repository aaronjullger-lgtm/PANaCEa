/**
 * FSRS Optimizer UI Component (Phase 5: Self-Optimizing Engine)
 *
 * Provides user interface for running client-side FSRS parameter optimization.
 * Shows before/after parameter comparison and efficiency gains.
 */

import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Brain, Play, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import {
  optimizeFSRSParameters,
  saveOptimizedParameters,
  getOptimizationStatus,
  type OptimizationResult,
  type OptimizationProgress,
} from '../../services/optimizer/fsrsOptimizer';

export const FSRSOptimizer: React.FC = () => {
  const { userId } = useAuth();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOptimized, setLastOptimized] = useState<Date | null>(null);
  const [canOptimize, setCanOptimize] = useState(true);
  const [reviewsNeeded, setReviewsNeeded] = useState(0);

  // Load optimization status on mount
  React.useEffect(() => {
    if (userId) {
      getOptimizationStatus(userId)
        .then((status) => {
          if (status.isOptimized && status.lastOptimized) {
            setLastOptimized(new Date(status.lastOptimized));
          }
          setCanOptimize(status.canOptimize ?? true);
          setReviewsNeeded(status.reviewsNeeded ?? 0);
        })
        .catch((err) => console.error('Failed to load optimization status:', err));
    }
  }, [userId]);

  const handleOptimize = async () => {
    if (!userId) return;

    try {
      setIsOptimizing(true);
      setError(null);
      setResult(null);

      // Run optimization with progress tracking
      const optimizationResult = await optimizeFSRSParameters(userId, setProgress);

      // Save to database
      await saveOptimizedParameters(userId, optimizationResult.parameters);

      setResult(optimizationResult);
      setLastOptimized(new Date());
      setProgress(null);
    } catch (err) {
      console.error('Optimization failed:', err);
      setError(err instanceof Error ? err.message : 'Optimization failed');
      setProgress(null);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              FSRS Algorithm Optimizer
            </h3>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Personalizes your spacing algorithm based on your memory patterns. Default parameters
            are 20-30% less efficient than optimized ones.
          </p>
        </div>

        {lastOptimized && (
          <div className="text-right text-xs text-[var(--color-text-secondary)]">
            <div>Last Optimized</div>
            <div className="font-mono text-[var(--color-text-primary)]">
              {lastOptimized.toLocaleDateString()}
            </div>
          </div>
        )}
      </div>

      {/* Optimize Button */}
      <button
        onClick={handleOptimize}
        disabled={isOptimizing}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 
                 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed
                 text-[var(--color-btn-primary-text)] font-medium rounded-lg transition-all
                 hover:scale-[1.02] active:scale-[0.98]"
      >
        {isOptimizing ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            <span>Optimizing...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span>{lastOptimized ? 'Re-Optimize Algorithm' : 'Optimize Algorithm'}</span>
          </>
        )}
      </button>

      {/* Progress Indicator */}
      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">{progress.message}</span>
            <span className="font-mono text-[var(--color-text-primary)]">{progress.progress}%</span>
          </div>
          <div className="w-full h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="p-4 bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[var(--color-data-pass)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-data-pass)] mb-2">
                Optimization Complete!
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[var(--color-text-secondary)]">Efficiency Gain</div>
                  <div className="text-lg font-bold text-[var(--color-data-pass)]">
                    +{result.metrics.improvementVsDefault.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[var(--color-text-secondary)]">Records Used</div>
                  <div className="text-lg font-bold text-[var(--color-text-primary)]">
                    {result.metrics.recordCount}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[var(--color-text-secondary)]">RMSE</div>
                  <div className="font-mono text-[var(--color-text-primary)]">
                    {(result.metrics.rmse ?? 0).toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--color-data-fail)] mb-1">
                Optimization Failed
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      {!isOptimizing && !result && !error && (
        <div className="p-3 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-lg">
          <p className="text-xs text-[var(--color-accent)]">
            {canOptimize
              ? 'Requires 500+ valid reviews for personalization. Optimization takes 10-30 seconds.'
              : `Need ${reviewsNeeded} more reviews for personalization.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default FSRSOptimizer;
