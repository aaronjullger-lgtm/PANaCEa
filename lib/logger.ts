/**
 * Structured Logging Utility
 * 
 * Provides environment-aware logging with levels:
 * - error: Always logged (production & development)
 * - warn: Always logged (production & development)
 * - info: Development only by default
 * - debug: Only when DEBUG flags are enabled
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User action', { userId, action });
 *   logger.error('API failed', { endpoint, error });
 *   logger.debug('Cache hit', { key }); // Only with DEBUG=true
 */

// ============================================================================
// Configuration
// ============================================================================

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_BROWSER = typeof window !== 'undefined';

// Debug flags - check both process.env and window for browser contexts
function getDebugFlag(flag: string): boolean {
  // Check environment variable
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[flag] === 'true') return true;
  }
  
  // Check window for runtime flags (useful for debugging in production)
  if (IS_BROWSER && (window as unknown as Record<string, unknown>)[flag] === true) {
    return true;
  }
  
  // Check localStorage for persistent debug flags
  if (IS_BROWSER) {
    try {
      if (localStorage.getItem(flag) === 'true') return true;
    } catch {
      // localStorage may be unavailable
    }
  }
  
  return false;
}

// Debug flags
const DEBUG_FLAGS = {
  ALL: 'DEBUG',
  OFFLINE_SYNC: 'DEBUG_OFFLINE_SYNC',
  AUTH: 'DEBUG_AUTH',
  API: 'DEBUG_API',
  PERFORMANCE: 'DEBUG_PERFORMANCE',
  FSRS: 'DEBUG_FSRS',
  GEMINI: 'DEBUG_GEMINI',
} as const;

type DebugFlag = keyof typeof DEBUG_FLAGS;

// ============================================================================
// Types
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  stack?: string;
}

// ============================================================================
// Log Formatting
// ============================================================================

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#9ca3af', // gray
  info: '#3b82f6',  // blue
  warn: '#f59e0b',  // amber
  error: '#ef4444', // red
};

const LEVEL_EMOJI: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

function formatForConsole(entry: LogEntry): string[] {
  const prefix = `${LEVEL_EMOJI[entry.level]} [${entry.level.toUpperCase()}]`;
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
  
  const parts = [
    `%c${prefix}%c ${entry.message} %c(${timestamp})`,
    `color: ${LEVEL_COLORS[entry.level]}; font-weight: bold`,
    'color: inherit',
    'color: #6b7280; font-size: 0.85em',
  ];
  
  return parts;
}

function formatForServer(entry: LogEntry): string {
  return JSON.stringify({
    level: entry.level,
    message: entry.message,
    timestamp: entry.timestamp,
    ...entry.context,
  });
}

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  private namespace?: string;
  private debugFlag?: DebugFlag;

  constructor(namespace?: string, debugFlag?: DebugFlag) {
    this.namespace = namespace;
    this.debugFlag = debugFlag;
  }

  /**
   * Create a scoped logger for a specific module
   */
  scope(namespace: string, debugFlag?: DebugFlag): Logger {
    return new Logger(namespace, debugFlag || this.debugFlag);
  }

  /**
   * Check if debug logging is enabled
   */
  private isDebugEnabled(): boolean {
    // Always allow in development
    if (IS_DEVELOPMENT) return true;
    
    // Check specific debug flag
    if (this.debugFlag && getDebugFlag(DEBUG_FLAGS[this.debugFlag])) {
      return true;
    }
    
    // Check global debug flag
    if (getDebugFlag(DEBUG_FLAGS.ALL)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if info logging is enabled
   */
  private isInfoEnabled(): boolean {
    // Always in development, configurable in production
    return IS_DEVELOPMENT || getDebugFlag('LOG_INFO');
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Level filtering
    if (level === 'debug' && !this.isDebugEnabled()) return;
    if (level === 'info' && !this.isInfoEnabled()) return;

    // Build log entry
    const entry: LogEntry = {
      level,
      message: this.namespace ? `[${this.namespace}] ${message}` : message,
      timestamp: new Date().toISOString(),
      context,
    };

    // Add stack trace for errors
    if (level === 'error' && context?.error instanceof Error) {
      entry.stack = context.error.stack;
    }

    // Output
    if (IS_BROWSER) {
      this.logToBrowser(entry);
    } else {
      this.logToServer(entry);
    }
  }

  private logToBrowser(entry: LogEntry): void {
    const [format, ...styles] = formatForConsole(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(format, ...styles, entry.context || '');
        break;
      case 'info':
        console.info(format, ...styles, entry.context || '');
        break;
      case 'warn':
        console.warn(format, ...styles, entry.context || '');
        break;
      case 'error':
        console.error(format, ...styles, entry.context || '');
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
    }
  }

  private logToServer(entry: LogEntry): void {
    const output = formatForServer(entry);
    
    switch (entry.level) {
      case 'debug':
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  // Public logging methods
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  // Convenience method for timing operations
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} completed`, { durationMs: duration.toFixed(2) });
    };
  }

  // Group related logs
  group(label: string, fn: () => void): void {
    if (IS_BROWSER && console.group) {
      console.group(this.namespace ? `[${this.namespace}] ${label}` : label);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    } else {
      this.info(`=== ${label} ===`);
      fn();
      this.info(`=== /${label} ===`);
    }
  }
}

// ============================================================================
// Pre-configured Loggers
// ============================================================================

// Global logger
export const logger = new Logger();

// Module-specific loggers
export const authLogger = logger.scope('Auth', 'AUTH');
export const apiLogger = logger.scope('API', 'API');
export const syncLogger = logger.scope('OfflineSync', 'OFFLINE_SYNC');
export const fsrsLogger = logger.scope('FSRS', 'FSRS');
export const perfLogger = logger.scope('Performance', 'PERFORMANCE');
export const geminiLogger = logger.scope('Gemini', 'GEMINI');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Enable debug logging at runtime (useful for production debugging)
 */
export function enableDebug(flag: DebugFlag | 'ALL' = 'ALL'): void {
  if (IS_BROWSER) {
    const key = flag === 'ALL' ? DEBUG_FLAGS.ALL : DEBUG_FLAGS[flag];
    localStorage.setItem(key, 'true');
    (window as unknown as Record<string, unknown>)[key] = true;
    console.log(`Debug logging enabled for: ${flag}`);
  }
}

/**
 * Disable debug logging at runtime
 */
export function disableDebug(flag: DebugFlag | 'ALL' = 'ALL'): void {
  if (IS_BROWSER) {
    const key = flag === 'ALL' ? DEBUG_FLAGS.ALL : DEBUG_FLAGS[flag];
    localStorage.removeItem(key);
    delete (window as unknown as Record<string, unknown>)[key];
    console.log(`Debug logging disabled for: ${flag}`);
  }
}

/**
 * Check current debug status
 */
export function isDebugEnabled(flag: DebugFlag | 'ALL' = 'ALL'): boolean {
  const key = flag === 'ALL' ? DEBUG_FLAGS.ALL : DEBUG_FLAGS[flag];
  return getDebugFlag(key);
}

// Export Logger class for custom instances
export { Logger };
export type { LogLevel, LogContext, DebugFlag };
