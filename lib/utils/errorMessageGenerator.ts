/**
 * Error Message Generator
 * 
 * Utility for generating user-friendly, actionable error messages from various error types.
 * Maps technical errors to human-readable messages with clear next steps.
 */

import { AppError, NetworkError, ValidationError, AuthenticationError } from '@/lib/errors/types';

export interface ActionableErrorMessage {
  /** User-friendly title */
  title: string;
  /** Detailed explanation in plain language */
  description: string;
  /** Suggested next steps (actionable items) */
  actions: Array<{
    label: string;
    action: () => void;
    priority: 'primary' | 'secondary';
  }>;
  /** Whether to show a retry button */
  showRetry: boolean;
  /** Whether to show a help/documentation link */
  showHelp: boolean;
  /** Help URL */
  helpUrl?: string;
  /** Error severity for UI styling */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Common error patterns and their user-friendly mappings
 */
const errorPatterns = [
  // Network errors
  {
    pattern: /network.*error|failed.*fetch|offline|connection.*lost/i,
    category: 'network' as const,
    title: 'Connection Issue',
    description: 'There was a problem connecting to our servers. This could be due to your internet connection, server maintenance, or a temporary outage.',
    actions: [
      {
        label: 'Check Internet Connection',
        action: () => {
          if (!navigator.onLine) {
            alert('You appear to be offline. Please check your internet connection.');
          } else {
            alert('Your internet connection appears to be working. The issue might be on our end.');
          }
        },
        priority: 'primary' as const,
      },
      {
        label: 'Reload Page',
        action: () => window.location.reload(),
        priority: 'secondary' as const,
      },
    ],
    showRetry: true,
    showHelp: true,
    helpUrl: 'https://docs.panacea.study/troubleshooting/network-issues',
    severity: 'error' as const,
  },
  {
    pattern: /timeout|timed.*out|request.*too.*long/i,
    category: 'timeout' as const,
    title: 'Request Timeout',
    description: 'The request took too long to complete. This could be due to high server load, network latency, or a complex operation.',
    actions: [
      {
        label: 'Try Again',
        action: () => window.location.reload(),
        priority: 'primary' as const,
      },
      {
        label: 'Use Simpler Content',
        action: () => {
          localStorage.setItem('use-simplified-mode', 'true');
          window.location.reload();
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: true,
    showHelp: true,
    severity: 'warning' as const,
  },
  
  // Authentication errors
  {
    pattern: /auth|login|session.*expired|invalid.*token|unauthorized/i,
    category: 'authentication' as const,
    title: 'Authentication Required',
    description: 'Your session has expired or there was an issue verifying your identity. You may need to sign in again.',
    actions: [
      {
        label: 'Sign In Again',
        action: () => {
          // Clear auth tokens and redirect
          localStorage.removeItem('clerk-db-jwt');
          sessionStorage.clear();
          window.location.href = '/';
        },
        priority: 'primary' as const,
      },
      {
        label: 'Continue as Guest',
        action: () => {
          import('@/services/auth/guestAuth').then(({ enableGuestMode }) => {
            enableGuestMode();
            window.location.reload();
          });
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: false,
    showHelp: true,
    helpUrl: 'https://docs.panacea.study/troubleshooting/authentication',
    severity: 'warning' as const,
  },
  
  // Validation errors
  {
    pattern: /validation|invalid.*input|required.*field|missing.*field/i,
    category: 'validation' as const,
    title: 'Validation Error',
    description: 'The information you provided contains errors or is incomplete. Please check your input and try again.',
    actions: [
      {
        label: 'Review Input',
        action: () => {
          // Focus on first invalid field
          const invalidField = document.querySelector('[aria-invalid="true"]');
          if (invalidField) {
            (invalidField as HTMLElement).focus();
            (invalidField as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        priority: 'primary' as const,
      },
    ],
    showRetry: false,
    showHelp: true,
    helpUrl: 'https://docs.panacea.study/troubleshooting/validation-errors',
    severity: 'warning' as const,
  },
  
  // Permission errors
  {
    pattern: /permission.*denied|forbidden|access.*denied|not.*authorized/i,
    category: 'permission' as const,
    title: 'Access Denied',
    description: "You don't have permission to access this resource or perform this action.",
    actions: [
      {
        label: 'Go to Dashboard',
        action: () => {
          window.location.href = '/';
        },
        priority: 'primary' as const,
      },
      {
        label: 'Contact Support',
        action: () => {
          window.open('mailto:support@panacea.study', '_blank');
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: false,
    showHelp: true,
    helpUrl: 'https://docs.panacea.study/troubleshooting/permissions',
    severity: 'warning' as const,
  },
  
  // Rate limiting
  {
    pattern: /rate.*limit|too.*many.*requests|429/i,
    category: 'rate_limit' as const,
    title: 'Too Many Requests',
    description: 'You have made too many requests in a short period. Please wait a moment before trying again.',
    actions: [
      {
        label: 'Wait 30 Seconds',
        action: () => {
          setTimeout(() => window.location.reload(), 30000);
        },
        priority: 'primary' as const,
      },
      {
        label: 'Continue Later',
        action: () => {
          window.history.back();
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: true,
    showHelp: true,
    helpUrl: 'https://docs.panacea.study/troubleshooting/rate-limiting',
    severity: 'warning' as const,
  },
  
  // Not found errors
  {
    pattern: /not.*found|404|resource.*not.*found/i,
    category: 'not_found' as const,
    title: 'Resource Not Found',
    description: 'The requested resource could not be found. It may have been moved, deleted, or the URL might be incorrect.',
    actions: [
      {
        label: 'Go to Home',
        action: () => {
          window.location.href = '/';
        },
        priority: 'primary' as const,
      },
      {
        label: 'Browse Available Content',
        action: () => {
          window.location.href = '/library';
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: false,
    showHelp: true,
    helpUrl: 'https://docs.panacea.study/troubleshooting/not-found',
    severity: 'info' as const,
  },
  
  // Server errors
  {
    pattern: /server.*error|500|internal.*error/i,
    category: 'server' as const,
    title: 'Server Error',
    description: 'An unexpected error occurred on our servers. Our engineering team has been notified and will investigate.',
    actions: [
      {
        label: 'Try Again Later',
        action: () => {
          window.history.back();
        },
        priority: 'primary' as const,
      },
      {
        label: 'Check Status Page',
        action: () => {
          window.open('https://status.panacea.study', '_blank');
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: true,
    showHelp: true,
    helpUrl: 'https://status.panacea.study',
    severity: 'error' as const,
  },
  
  // Maintenance mode
  {
    pattern: /maintenance|service.*unavailable|503/i,
    category: 'maintenance' as const,
    title: 'System Maintenance',
    description: 'The system is currently undergoing scheduled maintenance. We should be back online shortly.',
    actions: [
      {
        label: 'Check Status',
        action: () => {
          window.open('https://status.panacea.study', '_blank');
        },
        priority: 'primary' as const,
      },
      {
        label: 'Try Again in 5 Minutes',
        action: () => {
          setTimeout(() => window.location.reload(), 300000);
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: true,
    showHelp: true,
    helpUrl: 'https://status.panacea.study',
    severity: 'info' as const,
  },
  
  // Default fallback
  {
    pattern: /.*/,
    category: 'unknown' as const,
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Our team has been notified and will investigate.',
    actions: [
      {
        label: 'Try Again',
        action: () => window.location.reload(),
        priority: 'primary' as const,
      },
      {
        label: 'Contact Support',
        action: () => {
          window.open('mailto:support@panacea.study', '_blank');
        },
        priority: 'secondary' as const,
      },
    ],
    showRetry: true,
    showHelp: true,
    helpUrl: 'https://docs.panacea.study/troubleshooting',
    severity: 'error' as const,
  },
];

/**
 * Generate a user-friendly error message from any error object
 */
export function generateErrorMessage(
  error: Error | string | unknown,
  context?: {
    operation?: string;
    resource?: string;
    userId?: string;
    retryCallback?: () => void;
  }
): ActionableErrorMessage {
  const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);
  const errorString = errorMessage.toLowerCase();
  
  // Find matching pattern
  const matchedPattern = errorPatterns.find(pattern => 
    pattern.pattern.test(errorString) || 
    (error instanceof Error && pattern.pattern.test(error.name.toLowerCase()))
  ) || errorPatterns[errorPatterns.length - 1]; // Default fallback
  
  // Customize based on context
  let title = matchedPattern.title;
  let description = matchedPattern.description;
  const actions = [...matchedPattern.actions];
  
  if (context?.operation) {
    description = `${description} Operation: ${context.operation}.`;
  }
  
  if (context?.resource) {
    title = `${title}: ${context.resource}`;
  }
  
  // Add retry callback if provided
  if (context?.retryCallback && matchedPattern.showRetry) {
    actions.unshift({
      label: 'Try Again',
      action: context.retryCallback,
      priority: 'primary',
    });
  }
  
  return {
    title,
    description,
    actions,
    showRetry: matchedPattern.showRetry,
    showHelp: matchedPattern.showHelp,
    helpUrl: matchedPattern.helpUrl,
    severity: matchedPattern.severity,
  };
}

/**
 * Generate error message from HTTP status code
 */
export function generateErrorMessageFromStatusCode(
  statusCode: number,
  context?: {
    endpoint?: string;
    method?: string;
    retryCallback?: () => void;
  }
): ActionableErrorMessage {
  const statusMessages: Record<number, Partial<ActionableErrorMessage>> = {
    400: {
      title: 'Bad Request',
      description: 'The server could not understand your request. Please check your input and try again.',
      severity: 'warning',
    },
    401: {
      title: 'Unauthorized',
      description: 'You need to be signed in to access this resource.',
      severity: 'warning',
    },
    403: {
      title: 'Forbidden',
      description: "You don't have permission to access this resource.",
      severity: 'warning',
    },
    404: {
      title: 'Not Found',
      description: 'The requested resource could not be found.',
      severity: 'info',
    },
    408: {
      title: 'Request Timeout',
      description: 'The request took too long to complete.',
      severity: 'warning',
    },
    429: {
      title: 'Too Many Requests',
      description: 'You have made too many requests. Please wait a moment.',
      severity: 'warning',
    },
    500: {
      title: 'Internal Server Error',
      description: 'An unexpected error occurred on our servers.',
      severity: 'error',
    },
    502: {
      title: 'Bad Gateway',
      description: 'There was a problem connecting to an upstream service.',
      severity: 'error',
    },
    503: {
      title: 'Service Unavailable',
      description: 'The service is temporarily unavailable due to maintenance or high load.',
      severity: 'info',
    },
    504: {
      title: 'Gateway Timeout',
      description: 'A gateway or proxy server timed out.',
      severity: 'warning',
    },
  };
  
  const defaultMessage = statusMessages[statusCode] || statusMessages[500]!;
  const error = new Error(`HTTP ${statusCode}: ${defaultMessage.title}`);
  
  return generateErrorMessage(error, context);
}

/**
 * Hook for using enhanced error messages in React components
 */
export function useErrorMessaging() {
  const [currentError, setCurrentError] = React.useState<ActionableErrorMessage | null>(null);
  
  const showError = React.useCallback((
    error: Error | string | unknown,
    context?: {
      operation?: string;
      resource?: string;
      userId?: string;
      retryCallback?: () => void;
    }
  ) => {
    const errorMessage = generateErrorMessage(error, context);
    setCurrentError(errorMessage);
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('User-facing error:', errorMessage.title, error);
    }
    
    return errorMessage;
  }, []);
  
  const showErrorFromStatusCode = React.useCallback((
    statusCode: number,
    context?: {
      endpoint?: string;
      method?: string;
      retryCallback?: () => void;
    }
  ) => {
    const errorMessage = generateErrorMessageFromStatusCode(statusCode, context);
    setCurrentError(errorMessage);
    return errorMessage;
  }, []);
  
  const clearError = React.useCallback(() => {
    setCurrentError(null);
  }, []);
  
  return {
    currentError,
    showError,
    showErrorFromStatusCode,
    clearError,
  };
}

/**
 * Utility to wrap API calls with enhanced error handling
 */
export async function withEnhancedErrorHandling<T>(
  operation: () => Promise<T>,
  options?: {
    operationName?: string;
    resourceName?: string;
    onError?: (errorMessage: ActionableErrorMessage) => void;
    fallbackValue?: T;
  }
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = generateErrorMessage(error, {
      operation: options?.operationName,
      resource: options?.resourceName,
    });
    
    if (options?.onError) {
      options.onError(errorMessage);
    } else {
      // Default error handling - could integrate with toast system
      console.error('Operation failed:', errorMessage.title, error);
    }
    
    return options?.fallbackValue;
  }
}

/**
 * Create a standardized error response for API endpoints
 */
export function createErrorResponse(
  error: Error | string,
  statusCode: number = 500,
  context?: Record<string, unknown>
) {
  const errorMessage = generateErrorMessage(error, context);
  
  return {
    success: false,
    error: {
      code: statusCode,
      message: errorMessage.title,
      description: errorMessage.description,
      actions: errorMessage.actions.map(action => action.label),
      helpUrl: errorMessage.helpUrl,
      timestamp: new Date().toISOString(),
      ...context,
    },
  };
}