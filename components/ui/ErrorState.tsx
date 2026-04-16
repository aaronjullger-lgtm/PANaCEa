import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { createAppError, getUserFacingError } from '@/lib/utils/errorHandlingUtils';
import { EmptyState } from '@/components/ui/EmptyState';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
  title?: string;
  showIcon?: boolean;
  /** Optional secondary action (e.g. "Go Home", "Back to Command Center") */
  secondaryAction?: { label: string; onClick: () => void };
}

/**
 * ErrorState - Reusable error display component with optional retry
 *
 * @deprecated Prefer EmptyState from '@/components/ui/EmptyState' for new code.
 * Provides consistent error UX across the application with smooth animations
 * and clear call-to-action for recoverable errors.
 *
 * @param message - Error message to display (default: "Something went wrong")
 * @param onRetry - Optional callback for retry button
 * @param className - Additional Tailwind classes
 * @param title - Optional error title (default: "Error")
 * @param showIcon - Whether to show the error icon (default: true)
 * @param secondaryAction - Optional secondary button (e.g. Go Home)
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong',
  onRetry,
  className = '',
  title = 'Error',
  showIcon = true,
  secondaryAction,
}) => {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
      className={cn('flex flex-col items-center justify-center text-center', className)}
    >
      <EmptyState
        title={title}
        description={message}
        icon={AlertCircle}
        showIcon={showIcon}
        layout="surface"
        actionSize="lg"
        action={
          onRetry
            ? {
                label: 'Try Again',
                onClick: onRetry,
                icon: <RefreshCw className="w-4 h-4" />,
              }
            : undefined
        }
        secondaryAction={
          secondaryAction
            ? {
                label: secondaryAction.label,
                onClick: secondaryAction.onClick,
                variant: 'secondary',
                icon: <Home className="w-4 h-4" />,
              }
            : undefined
        }
      />
    </motion.div>
  );
};

/**
 * ErrorBoundaryFallback - Error fallback component for React Error Boundaries
 *
 * Use this as the fallback UI for ErrorBoundary components.
 * Uses getUserFacingError for friendly copy and optional "Go Home" secondary action.
 */
export const ErrorBoundaryFallback: React.FC<{
  error: Error;
  resetErrorBoundary: () => void;
  context?: 'default' | 'drill' | 'gemini';
}> = ({ error, resetErrorBoundary, context = 'default' }) => {
  const appError = createAppError(error);
  const { title, message, secondaryLabel } = getUserFacingError(appError.category, context);
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
      <ErrorState
        title={title}
        message={message}
        onRetry={resetErrorBoundary}
        secondaryAction={
          secondaryLabel
            ? {
                label: secondaryLabel,
                onClick: () => {
                  window.location.href = '/';
                },
              }
            : undefined
        }
      />
    </div>
  );
};

/**
 * EmptyState - Re-export from the main EmptyState component
 *
 * @deprecated Use the full-featured EmptyState from '@/components/ui/EmptyState' instead.
 * This export is kept for backward compatibility but delegates to the main implementation.
 */
export { EmptyState, EmptyStates } from '@/components/ui/EmptyState';

export default ErrorState;
