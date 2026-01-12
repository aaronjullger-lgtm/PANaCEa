/**
 * Automation Jobs Index
 * 
 * Central export for all automation jobs
 * 
 * Usage:
 *   import { userStatistics, healthChecks } from './jobs';
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
 */

export * as userStatistics from './userStatistics';
export * as healthChecks from './healthChecks';

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
