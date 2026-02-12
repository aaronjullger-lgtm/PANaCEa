/**
 * Comprehensive Loading System
 * Standardized loading components for all async operations in the application
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Clock, Zap, Brain } from 'lucide-react';
import { formatLoadingTime, getLoadingSeverity } from '@/hooks/useLoadingState';
import { StandardButton, PrimaryButton, SecondaryButton } from './StandardButton';

export interface LoadingSystemProps {
  /** Whether loading is active */
  isLoading: boolean;
  /** Error message if loading failed */
  error?: string | null;
  /** Progress percentage (0-100) */
  progress?: number | null;
  /** Time elapsed in milliseconds */
  elapsedTime?: number;
  /** Whether loading has timed out */
  hasTimedOut?: boolean;
  /** Estimated time remaining in milliseconds */
  estimatedRemaining?: number | null;
  /** Loading message to display */
  message?: string;
  /** Type of loading operation */
  type?: 'default' | 'question' | 'data' | 'ai' | 'auth' | 'media' | 'upload';
  /** Size of the loading indicator */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show fullscreen overlay */
  fullscreen?: boolean;
  /** Whether to show progress bar */
  showProgress?: boolean;
  /** Whether to show time estimates */
  showTime?: boolean;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Callback for cancel action */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Children to show when not loading */
  children?: React.ReactNode;
}

/**
 * Main LoadingSystem component
 * Provides consistent loading experience across all async operations
 */
export const LoadingSystem: React.FC<LoadingSystemProps> = ({
  isLoading,
  error = null,
  progress = null,
  elapsedTime = 0,
  hasTimedOut = false,
  estimatedRemaining = null,
  message = 'Loading...',
  type = 'default',
  size = 'md',
  fullscreen = false,
  showProgress = false,
  showTime = false,
  onRetry,
  onCancel,
  className = '',
  children,
}) => {
  // If not loading and no error, show children
  if (!isLoading && !error && !hasTimedOut) {
    return <>{children}</>;
  }

  const severity = getLoadingSeverity(elapsedTime);
  const formattedElapsed = formatLoadingTime(elapsedTime);
  const formattedRemaining = estimatedRemaining ? formatLoadingTime(estimatedRemaining) : null;

  // Size configurations
  const sizeConfig = {
    xs: { icon: 16, text: 'text-xs', spinner: 'w-4 h-4' },
    sm: { icon: 20, text: 'text-sm', spinner: 'w-5 h-5' },
    md: { icon: 24, text: 'text-base', spinner: 'w-6 h-6' },
    lg: { icon: 32, text: 'text-lg', spinner: 'w-8 h-8' },
    xl: { icon: 48, text: 'text-xl', spinner: 'w-12 h-12' },
  };

  const { icon: iconSize, text: textSize, spinner: spinnerClass } = sizeConfig[size];

  // Type configurations
  const typeConfig = {
    default: { icon: Loader2, color: 'text-[var(--color-accent)]' },
    question: { icon: Brain, color: 'text-[var(--color-primary)]' },
    data: { icon: Zap, color: 'text-[var(--color-data)]' },
    ai: { icon: Brain, color: 'text-[var(--color-ai)]' },
    auth: { icon: CheckCircle, color: 'text-[var(--color-success)]' },
    media: { icon: Zap, color: 'text-[var(--color-media)]' },
    upload: { icon: Upload, color: 'text-[var(--color-warning)]' },
  };

  const { icon: IconComponent, color: iconColor } = typeConfig[type];

  // Severity colors
  const severityColors = {
    normal: 'text-[var(--color-text-secondary)]',
    warning: 'text-[var(--color-warning)]',
    critical: 'text-[var(--color-danger)]',
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex flex-col items-center justify-center ${className}`}
    >
      {/* Loading State */}
      {isLoading && !hasTimedOut && (
        <div className="text-center space-y-4">
          {/* Spinner */}
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className={`${spinnerClass} ${iconColor} mx-auto`}
            >
              <IconComponent size={iconSize} className="w-full h-full" />
            </motion.div>
            
            {/* Progress ring for progress-based loading */}
            {progress !== null && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {Math.round(progress)}%
                </div>
              </div>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <p className={`font-medium ${textSize} text-[var(--color-text-primary)]`}>
              {message}
            </p>

            {/* Progress bar */}
            {showProgress && progress !== null && (
              <div className="w-48 h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-[var(--color-accent)]"
                />
              </div>
            )}

            {/* Time information */}
            {showTime && (
              <div className={`text-xs ${severityColors[severity]}`}>
                <div className="flex items-center justify-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formattedElapsed}
                  </span>
                  {formattedRemaining && (
                    <span className="flex items-center gap-1">
                      <Zap size={12} />
                      ~{formattedRemaining} remaining
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cancel button */}
          {onCancel && (
            <div className="pt-2">
              <SecondaryButton
                size="xs"
                onClick={onCancel}
                className="text-xs"
              >
                Cancel
              </SecondaryButton>
            </div>
          )}
        </div>
      )}

      {/* Timeout State */}
      {hasTimedOut && (
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className={`w-12 h-12 ${severityColors.critical} mx-auto`} />
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-[var(--color-text-primary)]">
              Taking longer than expected
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              This operation is taking longer than usual. You can wait or try again.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            {onRetry && (
              <PrimaryButton size="sm" onClick={onRetry}>
                Try Again
              </PrimaryButton>
            )}
            {onCancel && (
              <SecondaryButton size="sm" onClick={onCancel}>
                Cancel
              </SecondaryButton>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-12 h-12 text-[var(--color-danger)] mx-auto" />
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-[var(--color-text-primary)]">
              Something went wrong
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {error}
            </p>
          </div>
          {onRetry && (
            <PrimaryButton size="sm" onClick={onRetry}>
              Try Again
            </PrimaryButton>
          )}
        </div>
      )}
    </motion.div>
  );

  // Wrap in fullscreen overlay if needed
  if (fullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl p-8 max-w-md w-full">
            {content}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return content;
};

/**
 * Inline loading indicator for small async operations
 */
export const InlineLoader: React.FC<{
  size?: 'xs' | 'sm' | 'md';
  message?: string;
  className?: string;
}> = ({ size = 'sm', message, className = '' }) => {
  const sizeConfig = {
    xs: { icon: 12, text: 'text-xs', gap: 'gap-1' },
    sm: { icon: 16, text: 'text-sm', gap: 'gap-2' },
    md: { icon: 20, text: 'text-base', gap: 'gap-2' },
  };

  const { icon: iconSize, text: textSize, gap: gapClass } = sizeConfig[size];

  return (
    <div className={`inline-flex items-center ${gapClass} ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="text-[var(--color-accent)]"
      >
        <Loader2 size={iconSize} />
      </motion.div>
      {message && (
        <span className={`${textSize} text-[var(--color-text-secondary)]`}>
          {message}
        </span>
      )}
    </div>
  );
};

/**
 * Button with integrated loading state
 */
export const LoadingButton: React.FC<{
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning' | 'accent';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({
  isLoading,
  loadingText = 'Loading...',
  children,
  onClick,
  disabled,
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const ButtonComponent = {
    primary: PrimaryButton,
    secondary: SecondaryButton,
    outline: StandardButton,
    ghost: StandardButton,
    danger: StandardButton,
    success: StandardButton,
    warning: StandardButton,
    accent: StandardButton,
  }[variant];

  return (
    <ButtonComponent
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`relative ${className}`}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-4 h-4"
          >
            <Loader2 size={16} />
          </motion.div>
          {loadingText}
        </span>
      ) : (
        children
      )}
    </ButtonComponent>
  );
};

/**
 * Skeleton placeholder for content loading
 */
export const ContentSkeleton: React.FC<{
  type?: 'text' | 'card' | 'list' | 'table' | 'image';
  lines?: number;
  className?: string;
}> = ({ type = 'text', lines = 3, className = '' }) => {
  if (type === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-[var(--color-bg-secondary)] rounded animate-pulse"
            style={{ width: i === lines - 1 ? '70%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] ${className}`}>
        <div className="h-6 bg-[var(--color-bg-tertiary)] rounded w-3/4 mb-3 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-full" />
          <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-5/6" />
          <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg">
            <div className="w-8 h-8 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-1/2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

// Re-export Upload icon for type config
const Upload = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);