/**
 * Unified Loading Components
 *
 * Canonical barrel for all loading/skeleton components.
 *
 * SKELETON USAGE:
 * - components/ui/SkeletonLoader.tsx is the PRIMARY primitive for general skeletons.
 *   Use SkeletonLoader, SkeletonText, SkeletonCard for dashboard/list/card loading.
 *   Uses semantic tokens (--color-bg-tertiary) per design system.
 * - components/loading/SkeletonLoader.tsx provides mode-specific composites:
 *   QuestionSkeleton, ChatSkeleton, etc. for drill/quiz flows.
 * - ModeLoadingStates provide full-page skeletons for
 *   specific modes (Grand Rounds, Cram Mode, etc.).
 *
 * @module components/loading
 */

// Fullscreen loader
export { default as Loader } from './Loader';

// Enhanced auth loader
export { default as EnhancedLoader } from './EnhancedLoader';

// Progress indicators
export { LoadingProgress, TopBarLoader } from './LoadingProgress';

// Core skeleton primitives (from loading/SkeletonLoader)
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

// Alias: consumers that imported SkeletonLoader from the barrel
export { Skeleton as SkeletonLoader } from './SkeletonLoader';
