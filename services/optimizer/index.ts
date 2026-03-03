/**
 * Dynamic Study Path Optimizer (Phase 6.1)
 * Core Analysis Engine exports.
 */

export * from './performanceGapAnalyzer';
export * from './retentionAwareScheduler';
export * from './blueprintBalancedSelector';

// Re‑export FSRS optimizer for completeness
export { optimizeFSRS } from './fsrsOptimizer';