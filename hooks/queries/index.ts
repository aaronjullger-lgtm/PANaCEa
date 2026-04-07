/**
 * TanStack Query hooks barrel export.
 *
 * Re-exports all domain-specific query/mutation hooks for convenient importing:
 *   import { useUserProfile, useDrillSubmitReview } from '@/hooks/queries';
 */

export { useUserProfile, useUserStats, useUserFSRSParams, useUpdatePreferences } from './useUserQueries';
export { useSrsDueItems, useSrsSubmitReview } from './useSrsQueries';
export { useDrillSubmitReview } from './useDrillQueries';
export { useContentSearch, useSemanticSearch } from './useContentQueries';
export { useGenerateSession } from './useSessionQueries';
export { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from './useGoalQueries';
export {
  useGrandRoundsToday,
  useGrandRoundsLeaderboard,
  useGrandRoundsReview,
  useTargetedDailyToday,
  useSubmitGrandRounds,
  useSubmitTargetedDaily,
} from './useGrandRoundsQueries';
