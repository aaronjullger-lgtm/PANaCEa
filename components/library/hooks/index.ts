/**
 * Library Hooks Barrel Export
 */

export { useLibraryPreferences } from './useLibraryPreferences';
export { useDebouncedSearch } from './useDebouncedSearch';
export { useRecentConditions } from './useRecentConditions';
export { useConditionBookmarks } from './useConditionBookmarks';
export { useDDxIntelligence } from './useDDxIntelligence';
export { useConditionDetail } from './useConditionDetail';
export { useSmartCondition } from './useSmartCondition';

// Re-export types
export type {
  SmartSuggestion,
  WorkupStep,
  WorkupData,
  RelatedCondition,
  DDxIntelligenceState,
} from './useDDxIntelligence';
export type {
  ConditionSummary,
  ConditionDetails,
  ConfusedWithItem,
  UseSmartConditionResult,
} from './useSmartCondition';
