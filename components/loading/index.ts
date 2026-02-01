/**
 * Unified Loading Components
 *
 * This is the CANONICAL location for all skeleton/loading state components.
 * All other skeleton implementations should re-export from here.
 *
 * @module components/loading
 */

// Core skeleton primitives
export {
  Skeleton,
  SkeletonCard,
  SkeletonText,
  SkeletonQuizQuestion,
  SkeletonDrillCard,
  SkeletonWidget,
  QuestionSkeleton,
  ChatSkeleton,
  StatCardSkeleton,
  QuickStatsBarSkeleton,
  UserStatsOverviewSkeleton,
  TableSkeleton,
} from './SkeletonLoader';

// Mode-specific loading states
export {
  GrandRoundsLoadingState,
  DdxTrainerLoadingState,
  CramModeLoadingState,
  GenericModeLoadingState,
} from './ModeLoadingStates';

// Legacy aliases for backwards compatibility with components/ui/SkeletonLoader.tsx
export { Skeleton as SkeletonLoader } from './SkeletonLoader';
