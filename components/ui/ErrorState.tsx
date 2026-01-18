import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
  title?: string;
  showIcon?: boolean;
}

/**
 * ErrorState - Reusable error display component with optional retry
 *
 * Provides consistent error UX across the application with smooth animations
 * and clear call-to-action for recoverable errors.
 *
 * @param message - Error message to display (default: "Something went wrong")
 * @param onRetry - Optional callback for retry button
 * @param className - Additional Tailwind classes
 * @param title - Optional error title (default: "Error")
 * @param showIcon - Whether to show the error icon (default: true)
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong',
  onRetry,
  className = '',
  title = 'Error',
  showIcon = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
    >
      {showIcon && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
        >
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        </motion.div>
      )}

      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>

      <p className="text-[var(--color-text-muted)] mb-6 max-w-md">{message}</p>

      {onRetry && (
        <motion.button
          onClick={onRetry}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white rounded-xl font-medium hover:bg-[var(--color-accent-hover)] transition-colors shadow-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </motion.button>
      )}
    </motion.div>
  );
};

/**
 * ErrorBoundaryFallback - Error fallback component for React Error Boundaries
 *
 * Use this as the fallback UI for ErrorBoundary components.
 */
export const ErrorBoundaryFallback: React.FC<{
  error: Error;
  resetErrorBoundary: () => void;
}> = ({ error, resetErrorBoundary }) => {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
      <ErrorState
        title="Application Error"
        message={error.message || 'An unexpected error occurred. Please try refreshing the page.'}
        onRetry={resetErrorBoundary}
      />
    </div>
  );
};

/**
 * EmptyState - Friendly empty state component (not an error, but related pattern)
 */
export const EmptyState: React.FC<{
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({
  title = 'No data yet',
  message = 'Content will appear here once available',
  icon,
  action,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center p-12 text-center ${className}`}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="text-[var(--color-text-muted)] mb-4"
        >
          {icon}
        </motion.div>
      )}

      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>

      <p className="text-[var(--color-text-muted)] mb-6 max-w-md">{message}</p>

      {action && action}
    </motion.div>
  );
};

export default ErrorState;
