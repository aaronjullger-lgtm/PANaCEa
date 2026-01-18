/**
 * Library Components Barrel Export
 *
 * Phase 3+ components for the Medical Content Library overhaul
 * Comprehensive component suite for condition reference and study
 *
 * Now includes intelligent DDx features with database integration
 */

// Main Library Component
export { ClinicalReferenceLibrary } from './ClinicalReferenceLibrary';

// Navigation Components
export { LibrarySidebar } from './LibrarySidebar';
export { LibraryBreadcrumb } from './LibraryBreadcrumb';
export { MobileMenuToggle } from './MobileMenuToggle';

// Panel Components
export { RecentConditionsPanel } from './RecentConditionsPanel';
export { BookmarksPanel } from './BookmarksPanel';

// Card Components
export { EnhancedConditionCard } from './EnhancedConditionCard';
export { CompressedConditionCard } from './CompressedConditionCard';

// List Components
export { VirtualizedConditionList } from './VirtualizedConditionList';

// Badges & Indicators
export { MasteryBadge, MasteryIndicator } from './MasteryBadge';
export { SystemProgressBar, MiniProgressIndicator } from './SystemProgressBar';

// Interactive Elements
export { QuickQuizButton } from './QuickQuizButton';

// DDx & Comparison Components
export { DDxCompareModal } from './DDxCompareModal';
export { ConfusionPairAlert } from './ConfusionPairAlert';
export { DDxMatrixView } from './DDxMatrixView';

// Help & Modals
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

// Detail Views
export { ConditionMaster } from './ConditionMaster';
export { ConditionDetailPanel } from './ConditionDetailPanel';

// Hooks
export {
  useLibraryPreferences,
  useDebouncedSearch,
  useRecentConditions,
  useConditionBookmarks,
} from './hooks';

// Re-export types for convenience
export type { MasteryLevel } from './MasteryBadge';
