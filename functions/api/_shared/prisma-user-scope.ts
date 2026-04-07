/**
 * Prisma Client Extension: User-Scoped Queries
 *
 * Provides an opt-in extension that automatically filters queries by userId,
 * adding an ORM-level data isolation layer on top of the database-level RLS
 * policies. This is defense-in-depth — even if RLS fails or a new table
 * doesn't have RLS yet, the Prisma layer will still enforce data isolation.
 *
 * Usage:
 *   import { createScopedPrismaClient } from '../_shared/prisma-user-scope';
 *
 *   // In an authenticated endpoint:
 *   const scopedPrisma = createScopedPrismaClient(env.DATABASE_URL, auth.userId);
 *
 *   // All queries on scoped models automatically filter by userId:
 *   const progress = await scopedPrisma.userProgress.findMany(); // auto-filtered
 *   const questions = await scopedPrisma.question.findMany();    // NOT filtered (no userId)
 *
 * Why opt-in (not global):
 * - Cron jobs and admin endpoints need unscoped access
 * - Question generation queries data across all users
 * - Analytics aggregation needs global views
 *
 * @module functions/api/_shared/prisma-user-scope
 * @see https://www.prisma.io/docs/orm/prisma-client/client-extensions
 */

import { createEdgePrismaClient, type EdgePrismaClient } from './prisma-edge';
import { Prisma } from '@prisma/client/edge';

// ─── Models That Have a userId Column ───────────────────────────────────────
// This list is derived from the Prisma schema. If a model has a `userId` field,
// it should be listed here for automatic scoping. Update when adding new models.

const USER_SCOPED_MODELS = new Set([
  // ── Core SRS & Progress ──────────────────────────────────────────
  'userProgress',
  'questionAttempt',
  'reviewLog',
  'savedQuestion',
  'sRSItem',
  'personalizedFSRSParams',
  'masteryProgress',
  'userQuestionHistory',
  'userQuestionSeen',

  // ── Sessions & Streaks ───────────────────────────────────────────
  'studySession',
  'dailyStreak',
  'streakFreezeUse',
  'sessionAnalytics',
  'drillSessionRecord',

  // ── Drill & Encounter Attempts ───────────────────────────────────
  'contrastiveDrillAttempt',
  'grandRoundsAttempt',
  'grandRoundsHistory',
  'encounterResult',
  'patientEncounterSession',
  'targetedDailyAttempt',
  'explanationReaction',

  // ── User Profile & Preferences ───────────────────────────────────
  'userPreferences',
  'userSRSConfig',
  'userLearningProfile',
  'userCircadianProfile',
  'userStudyPhenotype',
  'pushSubscription',
  'userAchievement',
  'performanceRecord',

  // ── Analytics & Metrics ──────────────────────────────────────────
  'userStatistics',
  'userStatisticsSnapshot',
  'userBehaviorMetrics',
  'userRolling360Stats',
  'rolling360Buffer',
  'dailyUserAnalytics',
  'peerStatistic',
  'studentAbility',

  // ── Learning Intelligence ────────────────────────────────────────
  'userConditionAccuracy',
  'userConfusionPattern',
  'confusionPair',
  'conceptGap',
  'weaknessPattern',
  'userTopicProgress',
  'knowledgeCache',
  'studyRecommendation',
  'baselineAssessment',
  'examOutcome',

  // ── Content & Study Tools ────────────────────────────────────────
  'questionFlag',
  'reflection',
  'userPearl',
  'card',
  'podcast',
  'visualizerGeneration',
  'userWordleState',
  'userDiagnosticPuzzleState',
  'userGoal',
  'dailyStudyPlan',

  // ── Collaboration & Sync ─────────────────────────────────────────
  'studyGroupMember',
  'cohortMember',
  'syncQueue',
  'studentReservoirItem',

  // ── Content Authoring ────────────────────────────────────────────
  'contentAuthor',
  'questionSubmission',
  'mappingAuditLog',

  // ── Telemetry (high-frequency — consider excluding from audit) ──
  'behaviorLog',
  'aITokenUsage',
] as const);

/**
 * Check if a Prisma model name should be user-scoped.
 */
function isUserScopedModel(model: string): boolean {
  return USER_SCOPED_MODELS.has(model as any);
}

/**
 * Create a Prisma Client Extension that automatically injects userId
 * filters into queries on user-scoped models.
 *
 * This uses Prisma's `$allOperations` hook to intercept queries before
 * they reach the database and add `where: { userId }` conditions.
 *
 * Supported operations: findMany, findFirst, findUnique, count, aggregate,
 * update, updateMany, delete, deleteMany.
 *
 * Skipped operations: create, createMany, upsert (these require explicit
 * userId in the data payload — enforced by TypeScript types).
 */
function withUserScope(userId: string) {
  return Prisma.defineExtension({
    name: 'user-scope',
    query: {
      $allOperations({ model, operation, args, query }) {
        // Only scope models that have a userId column
        if (!model || !isUserScopedModel(model)) {
          return query(args);
        }

        // Only scope read and destructive operations — not create/upsert
        // (those require userId in the data payload, enforced by TS types)
        const scopedOperations = new Set([
          'findMany',
          'findFirst',
          'findUnique',
          'findFirstOrThrow',
          'findUniqueOrThrow',
          'count',
          'aggregate',
          'groupBy',
          'update',
          'updateMany',
          'delete',
          'deleteMany',
        ]);

        if (!scopedOperations.has(operation)) {
          return query(args);
        }

        // Inject userId into the where clause
        const where = (args as any).where ?? {};
        (args as any).where = { ...where, userId };

        return query(args);
      },
    },
  });
}

/**
 * Create a user-scoped Prisma client for authenticated endpoints.
 *
 * All queries on user-scoped models (UserProgress, ReviewLog, etc.)
 * will automatically include `where: { userId }` filtering.
 *
 * @param databaseUrl - DATABASE_URL from environment
 * @param userId - The authenticated user's ID (from Clerk)
 * @returns Extended Prisma client with automatic user scoping
 */
export function createScopedPrismaClient(
  databaseUrl: string,
  userId: string
): EdgePrismaClient {
  if (!userId) {
    throw new Error('[prisma-user-scope] userId is required for scoped client');
  }

  const baseClient = createEdgePrismaClient(databaseUrl);

  // Stack the user-scope extension on top of the Accelerate extension
  return (baseClient as any).$extends(withUserScope(userId)) as EdgePrismaClient;
}

/**
 * List of user-scoped model names (exported for testing/documentation).
 */
export { USER_SCOPED_MODELS };
