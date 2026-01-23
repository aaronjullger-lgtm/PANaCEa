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

  // Load optimization status on mount
  React.useEffect(() => {
    if (userId) {
      getOptimizationStatus(userId)
        .then((status) => {
          if (status.isOptimized && status.lastOptimized) {
            setLastOptimized(new Date(status.lastOptimized));
          }
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
            <Brain className="w-5 h-5 text-purple-500" />
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
                 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 
                 text-white font-medium rounded-lg transition-all
                 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
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
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400 mb-2">Optimization Complete!</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[var(--color-text-secondary)]">Efficiency Gain</div>
                  <div className="text-lg font-bold text-green-400">
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
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400 mb-1">Optimization Failed</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      {!isOptimizing && !result && !error && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-400">
            ℹ️ Requires at least 50 reviews across 20+ unique questions. Optimization takes 10-30
            seconds and runs client-side using WebAssembly.
          </p>
        </div>
      )}
    </div>
  );
};

export default FSRSOptimizer;
