/**
 * Dynamic Study Path Optimizer (Phase 6.2)
 * Core Analysis Engine exports.
 */

export * from './performanceGapAnalyzer';
export * from './retentionAwareScheduler';
export * from './blueprintBalancedSelector';
export * from './pathGenerator';
export * from './confidenceScorer';

// Re‑export FSRS optimizer for completeness
export { optimizeFSRS } from './fsrsOptimizer';