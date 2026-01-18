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
  TableSkeleton,
} from './SkeletonLoader';

// Mode-specific loading states
export {
  GrandRoundsLoadingState,
  DdxTrainerLoadingState,
  CramModeLoadingState,
  GenericModeLoadingState,
} from './ModeLoadingStates';

// View transitions and progress indicators
export {
  ViewTransitionOverlay,
  RouteChangeProgressBar,
  DataLoadingIndicator,
  useViewTransition,
  ContentFadeTransition,
  SlideTransition,
} from './ViewTransitions';

// Legacy aliases for backwards compatibility with components/ui/SkeletonLoader.tsx
export { Skeleton as SkeletonLoader } from './SkeletonLoader';
