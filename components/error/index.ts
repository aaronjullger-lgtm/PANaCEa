/**
 * Error Components Index
 *
 * All error boundary functionality is consolidated in ErrorBoundary.tsx.
 */

// Canonical error boundary and all utilities
export {
  ErrorBoundary,
  withErrorBoundary,
  WithGeminiErrorBoundary,
  withGeminiErrorBoundary,
  useErrorHandler,
  useGeminiRetry,
  parseGeminiError,
  AI_DEPENDENT_VIEWS,
  isAIDependentView,
} from './ErrorBoundary';
export type {
  ErrorBoundaryVariant,
  ErrorBoundaryFallbackProps,
  ErrorBoundaryProps,
  GeminiErrorInfo,
  AIDependentView,
} from './ErrorBoundary';

// Config/maintenance error page
export { MaintenancePage } from './MaintenancePage';
