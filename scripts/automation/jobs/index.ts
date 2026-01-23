/**
 * Automation Jobs Index
 *
 * Central export for all automation jobs
 *
 * Usage:
 *   import { userStatistics, healthChecks, fsrsOptimization } from './jobs';
 *
 *   // Run hourly checks
 *   await healthChecks.runHourlyHealthChecks();
 *   await userStatistics.updateUserStreaks();
 *
 *   // Run daily checks
 *   await userStatistics.generateDailyRecommendations();
 *
 *   // Run weekly checks
 *   await userStatistics.generateWeeklyProgressReports();
 *   await fsrsOptimization.optimizeAllUsersFSRS();
 */

export * as userStatistics from './userStatistics';
export * as healthChecks from './healthChecks';
export * as fsrsOptimization from './fsrsOptimization';

// Re-export specific functions for convenience
export {
  // Hourly jobs
  updateUserStreaks,
  calculateDueCards,
  updateLeaderboardCache,

  // Daily jobs
  generateDailyRecommendations,
  calculateDAUMetrics,
  aggregateConfusionPatterns,

  // Weekly jobs
  generateWeeklyProgressReports,
  calculateWeeklyRetention,
  updatePANCEReadinessEstimates,
} from './userStatistics';

export {
  // Health checks
  checkDatabaseConnection,
  checkDatabasePerformance,
  checkGeminiAPI,
  checkClerkAuth,
  checkSupabaseStorage,
  checkErrorRates,
  checkFlaggedQuestions,
  checkContentAvailability,
  checkQuestionPool,
  runSmokeTest,
  checkSSLExpiry,

  // Aggregate functions
  runHourlyHealthChecks,
  runDailyHealthChecks,
  summarizeResults,
} from './healthChecks';

export type { HealthCheckResult } from './healthChecks';
