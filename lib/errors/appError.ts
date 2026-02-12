/**
 * Unified Error Handling System for PANaCEa
 * 
 * Provides consistent error categorization, user-friendly messages,
 * and recovery actions across the application.
 */

// ============================================================================
// ERROR CATEGORIES
// ============================================================================

export enum ErrorCategory {
  /** Network connectivity issues, timeouts, CORS, etc. */
  NETWORK = 'network',
  
  /** Authentication, authorization, token issues */
  AUTHENTICATION = 'authentication',
  
  /** Input validation, form errors, schema violations */
  VALIDATION = 'validation',
  
  /** AI service failures (Gemini, OpenAI, etc.) */
  AI_SERVICE = 'ai_service',
  
  /** Database connection, query failures, migrations */
  DATABASE = 'database',
  
  /** Client-side errors (browser compatibility, JS errors) */
  CLIENT = 'client',
  
  /** Session-specific errors (timeouts, state corruption) */
  SESSION = 'session',
  
  /** Content-related errors (missing media, invalid format) */
  CONTENT = 'content',
  
  /** Rate limiting, quota exceeded, throttling */
  RATE_LIMIT = 'rate_limit',
  
  /** Unknown or unclassified errors */
  UNKNOWN = 'unknown'
}

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ErrorCode {
  // Network errors
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CORS = 'NETWORK_CORS',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',
  
  // Authentication errors
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  
  // Validation errors
  VALIDATION_REQUIRED = 'VALIDATION_REQUIRED',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_OUT_OF_RANGE',
  VALIDATION_UNIQUE_CONSTRAINT = 'VALIDATION_UNIQUE_CONSTRAINT',
  
  // AI service errors
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  AI_SERVICE_RATE_LIMIT = 'AI_SERVICE_RATE_LIMIT',
  AI_SERVICE_CONTENT_FILTER = 'AI_SERVICE_CONTENT_FILTER',
  AI_SERVICE_INVALID_RESPONSE = 'AI_SERVICE_INVALID_RESPONSE',
  
  // Database errors
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_CONSTRAINT = 'DATABASE_CONSTRAINT',
  DATABASE_MIGRATION = 'DATABASE_MIGRATION',
  
  // Client errors
  CLIENT_BROWSER_UNSUPPORTED = 'CLIENT_BROWSER_UNSUPPORTED',
  CLIENT_STORAGE_FULL = 'CLIENT_STORAGE_FULL',
  CLIENT_MEMORY_EXHAUSTED = 'CLIENT_MEMORY_EXHAUSTED',
  CLIENT_SCRIPT_ERROR = 'CLIENT_SCRIPT_ERROR',
  
  // Session errors
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  SESSION_CORRUPTED = 'SESSION_CORRUPTED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  
  // Content errors
  CONTENT_NOT_FOUND = 'CONTENT_NOT_FOUND',
  CONTENT_INVALID_FORMAT = 'CONTENT_INVALID_FORMAT',
  CONTENT_MEDIA_UNAVAILABLE = 'CONTENT_MEDIA_UNAVAILABLE',
  CONTENT_VERSION_MISMATCH = 'CONTENT_VERSION_MISMATCH',
  
  // Rate limit errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_QUOTA_EXCEEDED = 'RATE_LIMIT_QUOTA_EXCEEDED',
  RATE_LIMIT_THROTTLED = 'RATE_LIMIT_THROTTLED',
  
  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// ============================================================================
// RECOVERY ACTIONS
// ============================================================================

export enum RecoveryAction {
  /** Retry the failed operation */
  RETRY = 'retry',
  
  /** Refresh the page or component */
  REFRESH = 'refresh',
  
  /** Clear cache and try again */
  CLEAR_CACHE = 'clear_cache',
  
  /** Re-authenticate the user */
  REAUTHENTICATE = 'reauthenticate',
  
  /** Switch to offline mode */
  GO_OFFLINE = 'go_offline',
  
  /** Contact support */
  CONTACT_SUPPORT = 'contact_support',
  
  /** Navigate to a different page */
  NAVIGATE_AWAY = 'navigate_away',
  
  /** Wait and try again later */
  WAIT_AND_RETRY = 'wait_and_retry',
  
  /** Use alternative functionality */
  USE_ALTERNATIVE = 'use_alternative',
  
  /** Report the issue */
  REPORT_ISSUE = 'report_issue'
}

// ============================================================================
// APP ERROR INTERFACE
// ============================================================================

export interface AppError {
  /** Error category for grouping and filtering */
  category: ErrorCategory;
  
  /** Specific error code for programmatic handling */
  code: ErrorCode;
  
  /** Technical error message for debugging */
  message: string;
  
  /** User-friendly error message for display */
  userMessage: string;
  
  /** Suggested recovery actions */
  recoveryActions: RecoveryAction[];
  
  /** Whether the error can be retried */
  isRetryable: boolean;
  
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Current retry count */
  retryCount?: number;
  
  /** Timestamp when error occurred */
  timestamp: Date;
  
  /** Original error object (if any) */
  originalError?: unknown;
  
  /** Additional context data */
  context?: Record<string, unknown>;
  
  /** Whether error has been reported to monitoring */
  reported?: boolean;
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

export class AppErrorFactory {
  /**
   * Create a standardized AppError from any error
   */
  static create(
    error: unknown,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context?: Record<string, unknown>
  ): AppError {
    const message = error instanceof Error ? error.message : String(error);
    
    // Get user-friendly message based on category and code
    const userMessage = this.getUserFriendlyMessage(category, code, message);
    
    // Determine recovery actions
    const recoveryActions = this.getRecoveryActions(category, code);
    
    // Determine if retryable
    const isRetryable = this.isRetryable(category, code);
    
    return {
      category,
      code,
      message,
      userMessage,
      recoveryActions,
      isRetryable,
      maxRetries: isRetryable ? 3 : 0,
      timestamp: new Date(),
      originalError: error,
      context,
      reported: false
    };
  }
  
  /**
   * Get user-friendly message for error
   */
  private static getUserFriendlyMessage(
    category: ErrorCategory,
    code: ErrorCode,
    technicalMessage: string
  ): string {
    // Map error codes to user-friendly messages
    const messageMap: Record<ErrorCode, string> = {
      // Network errors
      [ErrorCode.NETWORK_OFFLINE]: 'You appear to be offline. Please check your internet connection.',
      [ErrorCode.NETWORK_TIMEOUT]: 'The request took too long. Please try again.',
      [ErrorCode.NETWORK_CORS]: 'Unable to connect to the server. Please refresh the page.',
      [ErrorCode.NETWORK_SERVER_ERROR]: 'The server encountered an error. Please try again later.',
      
      // Authentication errors
      [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
      [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid authentication. Please sign in again.',
      [ErrorCode.AUTH_USER_NOT_FOUND]: 'User account not found. Please contact support.',
      [ErrorCode.AUTH_PERMISSION_DENIED]: 'You don\'t have permission to access this resource.',
      [ErrorCode.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
      
      // Validation errors
      [ErrorCode.VALIDATION_REQUIRED]: 'Please fill in all required fields.',
      [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format. Please check your input.',
      [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value is out of range. Please enter a valid value.',
      [ErrorCode.VALIDATION_UNIQUE_CONSTRAINT]: 'This value already exists. Please use a different value.',
      
      // AI service errors
      [ErrorCode.AI_SERVICE_UNAVAILABLE]: 'The AI service is temporarily unavailable. Please try again later.',
      [ErrorCode.AI_SERVICE_RATE_LIMIT]: 'AI service rate limit exceeded. Please wait a moment.',
      [ErrorCode.AI_SERVICE_CONTENT_FILTER]: 'Content could not be generated due to safety filters.',
      [ErrorCode.AI_SERVICE_INVALID_RESPONSE]: 'Received an invalid response from the AI service.',
      
      // Database errors
      [ErrorCode.DATABASE_CONNECTION]: 'Unable to connect to the database. Please try again.',
      [ErrorCode.DATABASE_QUERY_FAILED]: 'Database query failed. Please try again.',
      [ErrorCode.DATABASE_CONSTRAINT]: 'Database constraint violation.',
      [ErrorCode.DATABASE_MIGRATION]: 'Database migration error. Please contact support.',
      
      // Client errors
      [ErrorCode.CLIENT_BROWSER_UNSUPPORTED]: 'Your browser is not supported. Please use a modern browser.',
      [ErrorCode.CLIENT_STORAGE_FULL]: 'Browser storage is full. Please clear some space.',
      [ErrorCode.CLIENT_MEMORY_EXHAUSTED]: 'Browser memory exhausted. Please close other tabs.',
      [ErrorCode.CLIENT_SCRIPT_ERROR]: 'A script error occurred. Please refresh the page.',
      
      // Session errors
      [ErrorCode.SESSION_TIMEOUT]: 'Session timed out. Please start a new session.',
      [ErrorCode.SESSION_CORRUPTED]: 'Session data corrupted. Please start a new session.',
      [ErrorCode.SESSION_NOT_FOUND]: 'Session not found. Please start a new session.',
      [ErrorCode.SESSION_LIMIT_EXCEEDED]: 'Session limit exceeded. Please try again later.',
      
      // Content errors
      [ErrorCode.CONTENT_NOT_FOUND]: 'Requested content not found.',
      [ErrorCode.CONTENT_INVALID_FORMAT]: 'Content format is invalid.',
      [ErrorCode.CONTENT_MEDIA_UNAVAILABLE]: 'Media content is temporarily unavailable.',
      [ErrorCode.CONTENT_VERSION_MISMATCH]: 'Content version mismatch. Please refresh.',
      
      // Rate limit errors
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please slow down your requests.',
      [ErrorCode.RATE_LIMIT_QUOTA_EXCEEDED]: 'Daily quota exceeded. Please try again tomorrow.',
      [ErrorCode.RATE_LIMIT_THROTTLED]: 'Request throttled. Please wait a moment.',
      
      // Unknown errors
      [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
    };
    
    return messageMap[code] || `An error occurred: ${technicalMessage}`;
  }
  
  /**
   * Get appropriate recovery actions for error
   */
  private static getRecoveryActions(
    category: ErrorCategory,
    code: ErrorCode
  ): RecoveryAction[] {
    const actionMap: Record<ErrorCategory, RecoveryAction[]> = {
      [ErrorCategory.NETWORK]: [RecoveryAction.RETRY, RecoveryAction.GO_OFFLINE, RecoveryAction.REFRESH],
      [ErrorCategory.AUTHENTICATION]: [RecoveryAction.REAUTHENTICATE, RecoveryAction.REFRESH],
      [ErrorCategory.VALIDATION]: [RecoveryAction.RETRY, RecoveryAction.USE_ALTERNATIVE],
      [ErrorCategory.AI_SERVICE]: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.USE_ALTERNATIVE, RecoveryAction.REPORT_ISSUE],
      [ErrorCategory.DATABASE]: [RecoveryAction.RETRY, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.CLIENT]: [RecoveryAction.REFRESH, RecoveryAction.CLEAR_CACHE, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.SESSION]: [RecoveryAction.RETRY, RecoveryAction.NAVIGATE_AWAY],
      [ErrorCategory.CONTENT]: [RecoveryAction.REFRESH, RecoveryAction.USE_ALTERNATIVE],
      [ErrorCategory.RATE_LIMIT]: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.NAVIGATE_AWAY],
      [ErrorCategory.UNKNOWN]: [RecoveryAction.RETRY, RecoveryAction.REFRESH, RecoveryAction.REPORT_ISSUE]
    };
    
    return actionMap[category] || [RecoveryAction.RETRY, RecoveryAction.REFRESH];
  }
  
  /**
   * Determine if error is retryable
   */
  private static isRetryable(category: ErrorCategory, code: ErrorCode): boolean {
    const nonRetryableCodes = [
      ErrorCode.AUTH_PERMISSION_DENIED,
      ErrorCode.CLIENT_BROWSER_UNSUPPORTED,
      ErrorCode.CONTENT_NOT_FOUND,
      ErrorCode.RATE_LIMIT_QUOTA_EXCEEDED
    ];
    
    return !nonRetryableCodes.includes(code);
  }
  
  /**
   * Create network error
   */
  static network(error: unknown, context?: Record<string, unknown>): AppError {
    let code = ErrorCode.NETWORK_SERVER_ERROR;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        code = ErrorCode.NETWORK_TIMEOUT;
      } else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
        code = ErrorCode.NETWORK_CORS;
      } else if (error.message.includes('offline') || error.message.includes('network')) {
        code = ErrorCode.NETWORK_OFFLINE;
      }
    }
    
    return this.create(error, ErrorCategory.NETWORK, code, context);
  }
  
  /**
   * Create authentication error
   */
  static authentication(error: unknown, context?: Record<string, unknown>): AppError {
    let code = ErrorCode.AUTH_TOKEN_INVALID;
    
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        code = ErrorCode.AUTH_TOKEN_EXPIRED;
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        code = ErrorCode.AUTH_PERMISSION_DENIED;
      } else if (error.message.includes('not found')) {
        code = ErrorCode.AUTH_USER_NOT_FOUND;
      }
    }
    
    return this.create(error, ErrorCategory.AUTHENTICATION, code, context);
  }
  
  /**
   * Create AI service error
   */
  static aiService(error: unknown, context?: Record<string, unknown>): AppError {
    let code = ErrorCode.AI_SERVICE_UNAVAILABLE;
    
    if (error instanceof Error) {
      if (error.message.includes('rate') || error.message.includes('limit')) {
        code = ErrorCode.AI_SERVICE_RATE_LIMIT;
      } else if (error.message.includes('filter') || error.message.includes('safety')) {
        code = ErrorCode.AI_SERVICE_CONTENT_FILTER;
      } else if (error.message.includes('invalid') || error.message.includes('response')) {
        code = ErrorCode.AI_SERVICE_INVALID_RESPONSE;
      }
    }
    
    return this.create(error, ErrorCategory.AI_SERVICE, code, context);
  }
  
  /**
   * Create session error
   */
  static session(error: unknown, context?: Record<string, unknown>): AppError {
    let code = ErrorCode.SESSION_CORRUPTED;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        code = ErrorCode.SESSION_TIMEOUT;
      } else if (error.message.includes('not found')) {
        code = ErrorCode.SESSION_NOT_FOUND;
      } else if (error.message.includes('limit')) {
        code = ErrorCode.SESSION_LIMIT_EXCEEDED;
      }
    }
    
    return this.create(error, ErrorCategory.SESSION, code, context);
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'category' in error &&
    'code' in error &&
    'userMessage' in error
  );
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  // Try to categorize based on error message
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('http')) {
      return AppErrorFactory.network(error);
    }
    
    if (message.includes('auth') || message.includes('token') || message.includes('session')) {
      return AppErrorFactory.authentication(error);
    }
    
    if (message.includes('ai') || message.includes('gemini') || message.includes('openai')) {
      return AppErrorFactory.aiService(error);
    }
    
    if (message.includes('session') || message.includes('quiz') || message.includes('study')) {
      return AppErrorFactory.session(error);
    }
  }
  
  return AppErrorFactory.create(error);
}

/**
 * Get primary recovery action for error
 */
export function getPrimaryRecoveryAction(error: AppError): RecoveryAction {
  return error.recoveryActions[0] || RecoveryAction.RETRY;
}

/**
 * Check if error should be reported to monitoring
 */
export function shouldReportError(error: AppError): boolean {
  const nonReportableCategories = [
    ErrorCategory.VALIDATION,
    ErrorCategory.RATE_LIMIT
  ];
  
  const nonReportableCodes = [
    ErrorCode.NETWORK_OFFLINE,
    ErrorCode.AUTH_TOKEN_EXPIRED,
    ErrorCode.RATE_LIMIT_EXCEEDED
  ];
  
  return !(
    nonReportableCategories.includes(error.category) ||
    nonReportableCodes.includes(error.code)
  );
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: AppError): Record<string, unknown> {
  return {
    category: error.category,
    code: error.code,
    message: error.message,
    userMessage: error.userMessage,
    retryable: error.isRetryable,
    retryCount: error.retryCount || 0,
    timestamp: error.timestamp.toISOString(),
    context: error.context
  };
}