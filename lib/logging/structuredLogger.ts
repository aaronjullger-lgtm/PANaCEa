/**
 * Structured Logging System for PANaCEa
 * 
 * Replaces console.log statements with structured, filterable logging
 * Supports different log levels and production monitoring integration
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  apiKey?: string;
}

class StructuredLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 100;

  constructor(config: LoggerConfig) {
    this.config = config;
    
    // Flush buffer periodically in production
    if (config.enableRemote && typeof window !== 'undefined') {
      setInterval(() => this.flushBuffer(), 30000); // Flush every 30 seconds
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4,
    };
    
    return levels[level] >= levels[this.config.level];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    // Console output for development
    if (this.config.enableConsole) {
      const consoleMethod = entry.level === 'error' || entry.level === 'critical' 
        ? console.error 
        : entry.level === 'warn' 
        ? console.warn 
        : console.log;

      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
      const contextStr = entry.context ? ` [${entry.context}]` : '';
      
      consoleMethod(`${prefix}${contextStr} ${entry.message}`, entry.metadata || '');
      
      if (entry.error) {
        consoleMethod('Error details:', entry.error);
      }
    }

    // Buffer for remote logging
    if (this.config.enableRemote) {
      this.logBuffer.push(entry);
      
      if (this.logBuffer.length >= this.maxBufferSize) {
        await this.flushBuffer();
      }
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.config.remoteEndpoint) {
      return;
    }

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ logs: entries }),
      });
    } catch (error) {
      // If remote logging fails, fall back to console
      console.error('Failed to send logs to remote endpoint:', error);
      // Put entries back in buffer for retry
      this.logBuffer.unshift(...entries);
    }
  }

  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.createLogEntry('debug', message, context, metadata);
    this.writeLog(entry);
  }

  info(message: string, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    const entry = this.createLogEntry('info', message, context, metadata);
    this.writeLog(entry);
  }

  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.createLogEntry('warn', message, context, metadata);
    this.writeLog(entry);
  }

  error(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;
    const entry = this.createLogEntry('error', message, context, metadata, error);
    this.writeLog(entry);
  }

  critical(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('critical')) return;
    const entry = this.createLogEntry('critical', message, context, metadata, error);
    this.writeLog(entry);
    
    // Immediately flush critical errors
    if (this.config.enableRemote) {
      this.flushBuffer();
    }
  }

  // Performance monitoring helpers
  startTimer(label: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.info(`Timer: ${label}`, 'PERFORMANCE', { duration: `${duration.toFixed(2)}ms` });
    };
  }

  // Authentication logging helpers
  authSuccess(userId: string, method: string): void {
    this.info('Authentication successful', 'AUTH', { userId, method });
  }

  authFailure(reason: string, metadata?: Record<string, any>): void {
    this.warn('Authentication failed', 'AUTH', { reason, ...metadata });
  }

  // API request logging helpers
  apiRequest(method: string, path: string, userId?: string, requestId?: string): void {
    this.info(`${method} ${path}`, 'API', { userId, requestId });
  }

  apiResponse(method: string, path: string, statusCode: number, duration: number): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    if (level === 'error') {
      this.error(`${method} ${path} - ${statusCode}`, undefined, 'API', { statusCode, duration: `${duration}ms` });
    } else {
      this[level](`${method} ${path} - ${statusCode}`, 'API', { statusCode, duration: `${duration}ms` });
    }
  }

  // Database operation logging
  dbQuery(operation: string, table: string, duration?: number): void {
    this.debug(`DB ${operation} on ${table}`, 'DATABASE', { operation, table, duration });
  }

  dbError(operation: string, table: string, error: Error): void {
    this.error(`DB ${operation} failed on ${table}`, error, 'DATABASE', { operation, table });
  }
}

// Create logger instances for different environments
const createLogger = (): StructuredLogger => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  const config: LoggerConfig = {
    level: isDevelopment ? 'debug' : 'info',
    enableConsole: isDevelopment || process.env.ENABLE_CONSOLE_LOGS === 'true',
    enableRemote: isProduction && !!process.env.LOG_ENDPOINT,
    remoteEndpoint: process.env.LOG_ENDPOINT,
    apiKey: process.env.LOG_API_KEY,
  };

  return new StructuredLogger(config);
};

// Export singleton logger instance
export const logger = createLogger();

// Export logger for specific contexts
export const authLogger = {
  success: (userId: string, method: string) => logger.authSuccess(userId, method),
  failure: (reason: string, metadata?: Record<string, any>) => logger.authFailure(reason, metadata),
};

export const apiLogger = {
  request: (method: string, path: string, userId?: string, requestId?: string) => 
    logger.apiRequest(method, path, userId, requestId),
  response: (method: string, path: string, statusCode: number, duration: number) => 
    logger.apiResponse(method, path, statusCode, duration),
};

export const dbLogger = {
  query: (operation: string, table: string, duration?: number) => 
    logger.dbQuery(operation, table, duration),
  error: (operation: string, table: string, error: Error) => 
    logger.dbError(operation, table, error),
};

// Middleware helper for Express.js
export const createRequestLogger = () => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Log incoming request
    apiLogger.request(req.method, req.path, req.auth?.userId, requestId);
    
    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      apiLogger.response(req.method, req.path, res.statusCode, duration);
    });
    
    next();
  };
};

// Health check endpoint data
export const getLoggerHealth = () => {
  return {
    status: 'healthy',
    config: {
      level: logger['config'].level,
      enableConsole: logger['config'].enableConsole,
      enableRemote: logger['config'].enableRemote,
    },
    bufferSize: logger['logBuffer'].length,
  };
};