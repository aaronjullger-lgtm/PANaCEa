/**
 * Secure Logging Utility
 *
 * Prevents accidental exposure of sensitive data in logs by:
 * - Redacting API keys, tokens, and secrets
 * - Masking sensitive user data
 * - Providing structured logging with context
 *
 * SECURITY: All console.log/error statements in production code should
 * use this utility to prevent secret leakage.
 */

export interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  duration?: number;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';

/**
 * Patterns to identify and redact sensitive data
 */
const SENSITIVE_PATTERNS = [
  // API keys
  { pattern: /sk_live_[a-zA-Z0-9_-]+/g, replacement: 'sk_live_***REDACTED***' },
  { pattern: /sk_test_[a-zA-Z0-9_-]+/g, replacement: 'sk_test_***REDACTED***' },
  { pattern: /pk_live_[a-zA-Z0-9_-]+/g, replacement: 'pk_live_***REDACTED***' },
  { pattern: /pk_test_[a-zA-Z0-9_-]+/g, replacement: 'pk_test_***REDACTED***' },

  // Generic API keys
  { pattern: /AIza[0-9A-Za-z_-]{35}/g, replacement: 'AIza***REDACTED***' },
  { pattern: /[0-9a-f]{64}/g, replacement: '***REDACTED_HEX_64***' },

  // JWT tokens (basic pattern)
  {
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    replacement: 'eyJ***REDACTED_JWT***',
  },

  // Bearer tokens in auth headers
  { pattern: /Bearer\s+[a-zA-Z0-9_-]+/g, replacement: 'Bearer ***REDACTED***' },

  // Email addresses (partially mask)
  {
    pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    replacement: (match: string, local: string, domain: string): string => {
      const maskedLocal = local.length > 2 ? local.substring(0, 2) + '***' : '***';
      return `${maskedLocal}@${domain}`;
    },
  },

  // Credit card numbers (if any)
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '****-****-****-****' },

  // IP addresses (partially mask)
  {
    pattern: /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
    replacement: (_match: string, a: string, b: string, _c: string, _d: string): string => {
      return `${a}.${b}.***.***`;
    },
  },

  // Connection strings (database URLs)
  { pattern: /postgresql:\/\/([^:]+):([^@]+)@/g, replacement: 'postgresql://***:***@' },
  { pattern: /mysql:\/\/([^:]+):([^@]+)@/g, replacement: 'mysql://***:***@' },

  // Private keys
  {
    pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
    replacement: '-----BEGIN PRIVATE KEY----- ***REDACTED*** -----END PRIVATE KEY-----',
  },
];

/**
 * Environment variable keys that should never be logged
 */
const SENSITIVE_ENV_KEYS = [
  'CLERK_SECRET_KEY',
  'GEMINI_API_KEY',
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'STRIPE_SECRET_KEY',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'PRIVATE_KEY',
  'API_SECRET',
  'WEBHOOK_SECRET',
];

/**
 * Redact sensitive information from a string
 */
export function redactSensitiveData(input: string): string {
  let output = input;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (typeof replacement === 'function') {
      output = output.replace(pattern, replacement as any);
    } else {
      output = output.replace(pattern, replacement);
    }
  }

  return output;
}

/**
 * Redact sensitive information from an object
 */
export function redactObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return redactSensitiveData(obj);
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  // Handle objects
  const redacted: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Redact sensitive environment variables
    if (SENSITIVE_ENV_KEYS.some((k) => lowerKey.includes(k.toLowerCase()))) {
      redacted[key] = '***REDACTED***';
      continue;
    }

    // Redact common sensitive field names
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('private_key') ||
      lowerKey.includes('privatekey')
    ) {
      redacted[key] = '***REDACTED***';
      continue;
    }

    // Recursively redact nested objects
    redacted[key] = redactObject(value, depth + 1);
  }

  return redacted;
}

/**
 * Safely stringify an error with stack trace redaction
 */
export function safeStringifyError(error: unknown): string {
  if (error instanceof Error) {
    const safeError = {
      name: error.name,
      message: redactSensitiveData(error.message),
      stack: error.stack ? redactSensitiveData(error.stack) : undefined,
    };
    return JSON.stringify(safeError, null, 2);
  }

  if (typeof error === 'string') {
    return redactSensitiveData(error);
  }

  try {
    return JSON.stringify(redactObject(error));
  } catch {
    return '[UNSTRINGIFIABLE_ERROR]';
  }
}

/**
 * Create a structured log entry
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): string {
  const timestamp = new Date().toISOString();
  const redactedContext = context ? redactObject(context) : {};

  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message: redactSensitiveData(message),
    context: redactedContext,
    error: error ? safeStringifyError(error) : undefined,
  };

  return JSON.stringify(logEntry);
}

/**
 * Secure logger class
 */
export class SecureLogger {
  private context: LogContext;

  constructor(context?: LogContext) {
    this.context = context || {};
  }

  /**
   * Add context that will be included in all subsequent logs
   */
  addContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Log debug information (only in development)
   */
  debug(message: string, additionalContext?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const logEntry = createLogEntry('debug', message, {
        ...this.context,
        ...additionalContext,
      });
      console.debug(logEntry);
    }
  }

  /**
   * Log informational messages
   */
  info(message: string, additionalContext?: LogContext): void {
    const logEntry = createLogEntry('info', message, {
      ...this.context,
      ...additionalContext,
    });
    console.log(logEntry);
  }

  /**
   * Log warnings
   */
  warn(message: string, additionalContext?: LogContext): void {
    const logEntry = createLogEntry('warn', message, {
      ...this.context,
      ...additionalContext,
    });
    console.warn(logEntry);
  }

  /**
   * Log errors with full context and redacted stack traces
   */
  error(message: string, error?: unknown, additionalContext?: LogContext): void {
    const logEntry = createLogEntry(
      'error',
      message,
      {
        ...this.context,
        ...additionalContext,
      },
      error
    );
    console.error(logEntry);
  }

  /**
   * Log security-related events (authentication failures, access violations)
   */
  security(message: string, additionalContext?: LogContext): void {
    const logEntry = createLogEntry('security', message, {
      ...this.context,
      ...additionalContext,
    });
    console.warn(`[SECURITY] ${logEntry}`);
  }
}

/**
 * Create a logger with initial context
 */
export function createLogger(context?: LogContext): SecureLogger {
  return new SecureLogger(context);
}

/**
 * Global logger instance (use sparingly, prefer creating contextual loggers)
 */
export const logger = new SecureLogger();

/**
 * Helper: Create a logger for an API endpoint
 */
export function createEndpointLogger(
  endpoint: string,
  userId?: string,
  requestId?: string
): SecureLogger {
  return new SecureLogger({
    endpoint,
    userId,
    requestId,
  });
}
