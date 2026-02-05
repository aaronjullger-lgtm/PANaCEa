/**
 * Unified Loading Components
 *
 * SKELETON USAGE:
 * - components/ui/SkeletonLoader.tsx is the PRIMARY primitive for general skeletons.
 *   Use SkeletonLoader, SkeletonText, SkeletonCard for dashboard/list/card loading.
 *   Uses semantic tokens (--color-bg-tertiary) per design system.
 * - components/loading/SkeletonLoader.tsx provides mode-specific composites:
 *   QuestionSkeleton, ChatSkeleton, etc. for drill/quiz flows.
 * - DrillLoadingState and ModeLoadingStates provide full-page skeletons for
 *   specific modes (Grand Rounds, Cram Mode, etc.).
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
  CommandCenterSkeleton,
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
