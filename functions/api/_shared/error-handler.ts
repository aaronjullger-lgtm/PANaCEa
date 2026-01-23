/**
 * Error Handling Middleware for CloudFlare Functions
 *
 * Provides consistent error handling, logging, and monitoring
 * across all CloudFlare Pages Functions endpoints.
 */

import { PagesFunction, EventContext } from '@cloudflare/workers-types';

export interface ErrorContext {
  endpoint: string;
  method: string;
  userId?: string;
  requestId?: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
  timestamp: string;
}

/**
 * Standard error types for CloudFlare Functions
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends APIError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT', { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * Format error for client response
 */
export function formatErrorResponse(error: Error | APIError, context: ErrorContext): ErrorResponse {
  const isAPIError = error instanceof APIError;

  return {
    error: error.name,
    message: isAPIError ? error.message : 'Internal server error',
    statusCode: isAPIError ? error.statusCode : 500,
    requestId: context.requestId,
    timestamp: context.timestamp,
  };
}

/**
 * Log error with context (CloudFlare Workers compatible)
 */
export function logError(error: Error, context: ErrorContext, env?: any): void {
  const errorLog = {
    level: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
    timestamp: context.timestamp,
  };

  // Console log for CloudFlare logs
  console.error('[CloudFlare Function Error]', JSON.stringify(errorLog, null, 2));

  // Send to external monitoring (if configured)
  if (env?.SENTRY_DSN) {
    // Note: Full Sentry SDK not available in Workers runtime
    // Use fetch to send to Sentry ingest API or logging service
    sendToSentry(error, context, env).catch((err) => {
      console.error('[Sentry] Failed to send error:', err);
    });
  }
}

/**
 * Send error to Sentry (CloudFlare Workers compatible)
 */
async function sendToSentry(error: Error, context: ErrorContext, env: any): Promise<void> {
  if (!env.SENTRY_DSN) return;

  const sentryPayload = {
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: {
            frames: parseStackTrace(error.stack || ''),
          },
        },
      ],
    },
    tags: {
      environment: env.ENVIRONMENT || 'production',
      endpoint: context.endpoint,
      method: context.method,
    },
    user: context.userId ? { id: context.userId } : undefined,
    request: {
      url: context.endpoint,
      method: context.method,
    },
    extra: {
      requestId: context.requestId,
      timestamp: context.timestamp,
    },
    timestamp: new Date(context.timestamp).getTime() / 1000,
  };

  // Extract DSN components
  const dsnMatch = env.SENTRY_DSN.match(/https:\/\/([^@]+)@([^/]+)\/(.+)/);
  if (!dsnMatch) {
    console.error('[Sentry] Invalid DSN format');
    return;
  }

  const publicKey = dsnMatch[1] ?? '';
  const host = dsnMatch[2] ?? '';
  const projectId = dsnMatch[3] ?? '';
  const sentryUrl = `https://${host}/api/${projectId}/store/`;

  try {
    await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=cloudflare-worker/1.0`,
      },
      body: JSON.stringify(sentryPayload),
    });
  } catch (fetchError) {
    console.error('[Sentry] Fetch failed:', fetchError);
  }
}

/**
 * Parse stack trace into Sentry format
 */
function parseStackTrace(
  stack: string
): Array<{ filename: string; function: string; lineno?: number }> {
  return stack
    .split('\n')
    .slice(1) // Skip first line (error message)
    .map((line: string) => {
      const match = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)/);
      if (match) {
        const fn = match[1] ?? 'unknown';
        const file = match[2] ?? 'unknown';
        const lineNum = match[3] ?? '0';
        return {
          function: fn,
          filename: file,
          lineno: parseInt(lineNum, 10),
        };
      }
      return { filename: 'unknown', function: line.trim() };
    })
    .filter(
      (frame: { filename: string; function: string; lineno?: number }) =>
        frame.filename !== 'unknown'
    );
}

/**
 * Higher-order function to wrap CloudFlare Functions with error handling
 */
export function withErrorHandler(
  handler: PagesFunction,
  options?: {
    endpoint?: string;
    logErrors?: boolean;
  }
): PagesFunction {
  return async (context: EventContext<any, any, any>) => {
    const { request, env } = context;
    const endpoint = options?.endpoint || new URL(request.url).pathname;
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const errorContext: ErrorContext = {
      endpoint,
      method: request.method,
      requestId,
      timestamp,
    };

    try {
      // Extract userId from Clerk session if available
      const clerkUserId = request.headers.get('x-clerk-user-id');
      if (clerkUserId) {
        errorContext.userId = clerkUserId;
      }

      // Call the actual handler
      const response = await handler(context);

      // Add request ID to successful responses
      if (response instanceof Response) {
        const headers = new Headers(response.headers);
        headers.set('X-Request-ID', requestId);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Log error
      if (options?.logErrors !== false) {
        logError(err, errorContext, env);
      }

      // Format error response
      const errorResponse = formatErrorResponse(err, errorContext);

      // Add retry-after header for rate limit errors
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      };

      if (err instanceof RateLimitError && err.details?.retryAfter) {
        headers['Retry-After'] = String(err.details.retryAfter);
      }

      return new Response(JSON.stringify(errorResponse), {
        status: errorResponse.statusCode,
        headers,
      });
    }
  };
}

/**
 * Validate required environment variables
 */
export function validateEnv(env: any, required: string[]): { valid: boolean; missing: string[] } {
  const missing = required.filter((key) => !env[key]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Create standardized success response
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Create standardized error response
 */
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string,
  headers?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: code || 'ERROR',
      message,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}
