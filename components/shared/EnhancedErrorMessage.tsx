/**
 * Enhanced Error Message Component
 * 
 * Provides standardized, actionable error messages with clear next steps.
 * Supports different error types, severity levels, and user-friendly explanations.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, CheckCircle, RefreshCw, ExternalLink, HelpCircle } from 'lucide-react';
import { StandardButton, PrimaryButton, SecondaryButton, OutlineButton } from './StandardButton';

export type ErrorSeverity = 'error' | 'warning' | 'info' | 'success';
export type ErrorCategory = 
  | 'network' 
  | 'authentication' 
  | 'validation' 
  | 'permission' 
  | 'data' 
  | 'system' 
  | 'timeout' 
  | 'not_found'
  | 'rate_limit'
  | 'maintenance';

export interface ActionStep {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  icon?: React.ReactNode;
}

export interface EnhancedErrorMessageProps {
  /** Error title/message */
  title: string;
  /** Detailed error description */
  description?: string;
  /** Error severity level */
  severity?: ErrorSeverity;
  /** Error category for contextual help */
  category?: ErrorCategory;
  /** Technical error details (shown in dev mode or when expanded) */
  technicalDetails?: string;
  /** Whether to show technical details by default */
  showTechnicalDetails?: boolean;
  /** Actionable steps for the user */
  actions?: ActionStep[];
  /** Whether the error can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Additional className for styling */
  className?: string;
  /** Whether to show a retry button (convenience prop) */
  showRetry?: boolean;
  /** Retry callback (used with showRetry) */
  onRetry?: () => void;
  /** Whether to show a help/documentation link */
  showHelpLink?: boolean;
  /** Help URL */
  helpUrl?: string;
}

const severityConfig = {
  error: {
    icon: AlertTriangle,
    bgColor: 'bg-[var(--color-data-fail)]/10',
    borderColor: 'border-[var(--color-data-fail)]/30',
    textColor: 'text-[var(--color-data-fail)]',
    iconColor: 'text-[var(--color-data-fail)]',
    titleColor: 'text-[var(--color-text-primary)]',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-[var(--color-data-provisional)]/10',
    borderColor: 'border-[var(--color-data-provisional)]/30',
    textColor: 'text-[var(--color-data-provisional)]',
    iconColor: 'text-[var(--color-data-provisional)]',
    titleColor: 'text-[var(--color-text-primary)]',
  },
  info: {
    icon: Info,
    bgColor: 'bg-[var(--color-accent)]/10',
    borderColor: 'border-[var(--color-accent)]/30',
    textColor: 'text-[var(--color-accent)]',
    iconColor: 'text-[var(--color-accent)]',
    titleColor: 'text-[var(--color-text-primary)]',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-[var(--color-data-success)]/10',
    borderColor: 'border-[var(--color-data-success)]/30',
    textColor: 'text-[var(--color-data-success)]',
    iconColor: 'text-[var(--color-data-success)]',
    titleColor: 'text-[var(--color-text-primary)]',
  },
};

const categoryMessages: Record<ErrorCategory, { title: string; defaultDescription: string }> = {
  network: {
    title: 'Connection Issue',
    defaultDescription: 'There was a problem connecting to the server. This could be due to network connectivity, server maintenance, or a temporary outage.',
  },
  authentication: {
    title: 'Authentication Error',
    defaultDescription: 'There was an issue verifying your identity. Your session may have expired or there might be a problem with your login credentials.',
  },
  validation: {
    title: 'Validation Error',
    defaultDescription: 'The information provided contains errors or is incomplete. Please check your input and try again.',
  },
  permission: {
    title: 'Permission Denied',
    defaultDescription: "You don't have permission to access this resource or perform this action.",
  },
  data: {
    title: 'Data Error',
    defaultDescription: 'There was a problem loading or processing the requested data.',
  },
  system: {
    title: 'System Error',
    defaultDescription: 'An unexpected system error occurred. Our team has been notified and will investigate.',
  },
  timeout: {
    title: 'Request Timeout',
    defaultDescription: 'The request took too long to complete. This could be due to high server load or network latency.',
  },
  not_found: {
    title: 'Resource Not Found',
    defaultDescription: 'The requested resource could not be found. It may have been moved, deleted, or the URL might be incorrect.',
  },
  rate_limit: {
    title: 'Rate Limit Exceeded',
    defaultDescription: 'You have made too many requests in a short period. Please wait a moment before trying again.',
  },
  maintenance: {
    title: 'System Maintenance',
    defaultDescription: 'The system is currently undergoing maintenance. Please try again later.',
  },
};

const getDefaultActions = (
  category: ErrorCategory, 
  onRetry?: () => void, 
  helpUrl?: string
): ActionStep[] => {
  const actions: ActionStep[] = [];

  switch (category) {
    case 'network':
      actions.push(
        {
          label: 'Check Connection',
          action: () => {
            // Simple network check
            if (navigator.onLine) {
              window.location.reload();
            } else {
              alert('You appear to be offline. Please check your internet connection.');
            }
          },
          variant: 'primary',
          icon: <RefreshCw className="w-4 h-4" />,
        },
        {
          label: 'Reload Page',
          action: () => window.location.reload(),
          variant: 'secondary',
        }
      );
      break;
    case 'authentication':
      actions.push(
        {
          label: 'Sign In Again',
          action: () => {
            // Clear auth and redirect to login
            localStorage.removeItem('clerk-db-jwt');
            window.location.href = '/';
          },
          variant: 'primary',
        },
        {
          label: 'Continue as Guest',
          action: () => {
            // Enable guest mode
            import('@/services/auth/guestAuth').then(({ enableGuestMode }) => {
              enableGuestMode();
              window.location.reload();
            });
          },
          variant: 'secondary',
        }
      );
      break;
    case 'validation':
      actions.push(
        {
          label: 'Review Input',
          action: () => {
            // Focus on first invalid field if possible
            const invalidField = document.querySelector('[aria-invalid="true"]');
            if (invalidField) {
              (invalidField as HTMLElement).focus();
            }
          },
          variant: 'primary',
        }
      );
      break;
    case 'timeout':
      actions.push(
        {
          label: 'Try Again',
          action: onRetry || (() => window.location.reload()),
          variant: 'primary',
          icon: <RefreshCw className="w-4 h-4" />,
        },
        {
          label: 'Use Simpler Content',
          action: () => {
            // Could implement a fallback to simpler content
            localStorage.setItem('use-simplified-mode', 'true');
            window.location.reload();
          },
          variant: 'secondary',
        }
      );
      break;
    case 'rate_limit':
      actions.push(
        {
          label: 'Wait & Retry',
          action: () => {
            setTimeout(() => window.location.reload(), 30000); // 30 seconds
          },
          variant: 'primary',
        }
      );
      break;
  }

  // Add retry action if provided
  if (onRetry && !actions.some(a => a.label.toLowerCase().includes('retry') || a.label.toLowerCase().includes('try again'))) {
    actions.unshift({
      label: 'Try Again',
      action: onRetry,
      variant: 'primary',
      icon: <RefreshCw className="w-4 h-4" />,
    });
  }

  // Add help link if provided
  if (helpUrl) {
    actions.push({
      label: 'View Help',
      action: () => { window.open(helpUrl, '_blank'); },
      variant: 'outline',
      icon: <ExternalLink className="w-4 h-4" />,
    });
  }

  return actions;
};

export const EnhancedErrorMessage: React.FC<EnhancedErrorMessageProps> = ({
  title,
  description,
  severity = 'error',
  category = 'system',
  technicalDetails,
  showTechnicalDetails = false,
  actions = [],
  dismissible = false,
  onDismiss,
  className = '',
  showRetry = false,
  onRetry,
  showHelpLink = false,
  helpUrl = 'https://docs.panacea.study/troubleshooting',
}) => {
  const [isExpanded, setIsExpanded] = React.useState(showTechnicalDetails);
  const [isDismissed, setIsDismissed] = React.useState(false);

  const config = severityConfig[severity];
  const Icon = config.icon;
  const categoryInfo = categoryMessages[category];

  // Merge default actions with provided actions
  const defaultActions = getDefaultActions(category, onRetry, showHelpLink ? helpUrl : undefined);
  const allActions = [...defaultActions, ...actions];

  // Add retry action if requested
  if (showRetry && onRetry && !allActions.some(a => a.label.toLowerCase().includes('retry'))) {
    allActions.unshift({
      label: 'Try Again',
      action: onRetry,
      variant: 'primary',
      icon: <RefreshCw className="w-4 h-4" />,
    });
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-5 ${className}`}
        role="alert"
        aria-live={severity === 'error' ? 'assertive' : 'polite'}
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 ${config.iconColor}`}>
            <Icon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`text-lg font-semibold ${config.titleColor} mb-1`}>
                  {title}
                </h3>
                <p className={`text-sm ${config.textColor} mb-3`}>
                  {description || categoryInfo.defaultDescription}
                </p>
              </div>

              {dismissible && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  aria-label="Dismiss error message"
                >
                  ×
                </button>
              )}
            </div>

            {/* Technical details (expandable) */}
            {technicalDetails && import.meta.env.DEV && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <HelpCircle className="w-3 h-3" />
                  {isExpanded ? 'Hide technical details' : 'Show technical details'}
                </button>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2"
                  >
                    <pre className="text-xs font-mono bg-[var(--color-bg-primary)]/50 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                      {technicalDetails}
                    </pre>
                  </motion.div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {allActions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {allActions.map((action, index) => {
                  const ButtonComponent = 
                    action.variant === 'primary' ? PrimaryButton :
                    action.variant === 'secondary' ? SecondaryButton :
                    action.variant === 'outline' ? OutlineButton :
                    StandardButton;

                  return (
                    <ButtonComponent
                      key={index}
                      size="sm"
                      onClick={action.action}
                      className="flex items-center gap-2"
                    >
                      {action.icon}
                      {action.label}
                    </ButtonComponent>
                  );
                })}
              </div>
            )}

            {/* Help link */}
            {showHelpLink && !allActions.some(a => a.label === 'View Help') && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]/50">
                <a
                  href={helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Need more help? Visit our troubleshooting guide
                </a>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Utility hook for creating enhanced error messages
 */
export function useEnhancedError() {
  const [error, setError] = React.useState<{
    title: string;
    description?: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    technicalDetails?: string;
  } | null>(null);

  const showError = React.useCallback((
    title: string,
    options?: {
      description?: string;
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      technicalDetails?: string;
    }
  ) => {
    setError({
      title,
      description: options?.description,
      severity: options?.severity || 'error',
      category: options?.category || 'system',
      technicalDetails: options?.technicalDetails,
    });
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    showError,
    clearError,
    ErrorMessage: error ? (
      <EnhancedErrorMessage
        title={error.title}
        description={error.description}
        severity={error.severity}
        category={error.category}
        technicalDetails={error.technicalDetails}
        dismissible
        onDismiss={clearError}
        showRetry
        onRetry={clearError}
      />
    ) : null,
  };
}

/**
 * Pre-configured error message components for common scenarios
 */
export const NetworkErrorMessage: React.FC<{
  title?: string;
  description?: string;
  onRetry?: () => void;
}> = ({ title, description, onRetry }) => (
  <EnhancedErrorMessage
    title={title || 'Connection Lost'}
    description={description || 'Unable to connect to the server. Please check your internet connection and try again.'}
    severity="error"
    category="network"
    showRetry={!!onRetry}
    onRetry={onRetry}
    showHelpLink
  />
);

export const AuthenticationErrorMessage: React.FC<{
  title?: string;
  description?: string;
}> = ({ title, description }) => (
  <EnhancedErrorMessage
    title={title || 'Authentication Required'}
    description={description || 'Your session has expired or you need to sign in to access this feature.'}
    severity="warning"
    category="authentication"
    showHelpLink
  />
);

export const ValidationErrorMessage: React.FC<{
  title?: string;
  description?: string;
  fieldName?: string;
}> = ({ title, description, fieldName }) => (
  <EnhancedErrorMessage
    title={title || 'Validation Error'}
    description={description || (fieldName ? `Please check the "${fieldName}" field.` : 'Please check your input and try again.')}
    severity="warning"
    category="validation"
  />
);

export const NotFoundErrorMessage: React.FC<{
  title?: string;
  description?: string;
  resourceType?: string;
}> = ({ title, description, resourceType }) => (
  <EnhancedErrorMessage
    title={title || 'Not Found'}
    description={description || (resourceType ? `The ${resourceType} you're looking for could not be found.` : 'The requested resource could not be found.')}
    severity="info"
    category="not_found"
    showHelpLink
  />
);

export const RateLimitErrorMessage: React.FC<{
  title?: string;
  description?: string;
  retryAfter?: number;
}> = ({ title, description, retryAfter }) => (
  <EnhancedErrorMessage
    title={title || 'Too Many Requests'}
    description={description || (retryAfter ? `Please wait ${retryAfter} seconds before trying again.` : 'You have made too many requests. Please wait a moment.')}
    severity="warning"
    category="rate_limit"
  />
);