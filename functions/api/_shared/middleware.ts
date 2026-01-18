/**
 * API Middleware Pattern for PANaCEa Cloudflare Pages Functions
 *
 * Purpose: Composable middleware for auth, validation, CORS, and error handling
 * Sprint: Security Hardening Sprint 3
 *
 * Usage:
 *   export const onRequestPost = withMiddleware(
 *     withAuth(),
 *     withValidation(questionGenerationSchema),
 *     withCors(),
 *     async (context, validated) => {
 *       // Your handler logic with validated data
 *       return { success: true, data: result };
 *     }
 *   );
 */

import { z } from 'zod';
import { authenticateRequest } from './auth';
import { getCorsHeaders, handleCorsPreflightSecure, getCorsHeadersPermissive } from './cors';
import { logger } from './secureLogger';
import { enforcePayloadSize, validateSchema } from './zodSchemas';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Cloudflare Pages Function context
 */
export interface CloudflareContext {
  request: Request;
  env: any;
  params: any;
  waitUntil?: (promise: Promise<any>) => void;
  passThroughOnException?: () => void;
}

/**
 * Authenticated context includes user info
 */
export interface AuthenticatedContext extends CloudflareContext {
  auth: {
    userId: string;
    sessionId?: string;
    metadata?: any;
  };
}

/**
 * Validated context includes validated data
 */
export interface ValidatedContext<T = any> extends CloudflareContext {
  validated: T;
}

/**
 * Handler response format
 */
export type HandlerResponse = Response | { status?: number; data?: any; error?: string };

/**
 * Middleware function type
 */
export type Middleware<TContext = CloudflareContext> = (
  context: TContext,
  next: () => Promise<HandlerResponse>
) => Promise<HandlerResponse>;

/**
 * Final handler function type
 */
export type Handler<TContext = CloudflareContext> = (context: TContext) => Promise<HandlerResponse>;

// ============================================================================
// MIDDLEWARE COMPOSER
// ============================================================================

/**
 * Compose multiple middleware functions with a final handler
 */
export function withMiddleware<TContext extends CloudflareContext>(
  ...middlewareAndHandler: [...Middleware<any>[], Handler<any>]
): (context: CloudflareContext) => Promise<Response> {
  return async (context: CloudflareContext): Promise<Response> => {
    const handler = middlewareAndHandler[middlewareAndHandler.length - 1] as Handler<any>;
    const middleware = middlewareAndHandler.slice(0, -1) as Middleware<any>[];

    // Build middleware chain
    let index = 0;
    const dispatch = async (ctx: any): Promise<HandlerResponse> => {
      if (index === middleware.length) {
        return handler(ctx);
      }

      const currentMiddleware = middleware[index];
      index++;

      return currentMiddleware(ctx, () => dispatch(ctx));
    };

    try {
      const result = await dispatch(context);
      return toResponse(result, context.request);
    } catch (error) {
      logger.error('Middleware chain error', error);
      return toResponse({ status: 500, error: 'Internal server error' }, context.request);
    }
  };
}

/**
 * Convert handler response to standard Response object
 */
function toResponse(result: HandlerResponse, request: Request): Response {
  if (result instanceof Response) {
    return result;
  }

  const status = result.status || 200;
  const body = result.error
    ? JSON.stringify({ error: result.error })
    : JSON.stringify(result.data || result);

  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

  // Add CORS headers
  const corsHeaders = getCorsHeaders(request);
  if (corsHeaders) {
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}

// ============================================================================
// CORS MIDDLEWARE
// ============================================================================

/**
 * CORS middleware - handles OPTIONS and adds CORS headers
 */
export function withCors(options: { allowedOrigins?: string[] } = {}): Middleware {
  return async (context, next) => {
    // Handle preflight
    if (context.request.method === 'OPTIONS') {
      return handleCorsPreflightSecure(context.request, context.env);
    }

    // Continue to next middleware
    const response = await next();

    // Add CORS headers if not already present
    if (response instanceof Response) {
      const corsHeaders = getCorsHeaders(context.request);
      if (corsHeaders) {
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          if (!headers.has(key)) {
            headers.set(key, value);
          }
        });

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    return response;
  };
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware - requires valid auth before proceeding
 */
export function withAuth(options: { optional?: boolean } = {}): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    const auth = await authenticateRequest(context.request, context.env);

    if (!auth && !options.optional) {
      logger.warn('Unauthenticated request blocked', {
        path: new URL(context.request.url).pathname,
      });
      return { status: 401, error: 'Authentication required' };
    }

    // Add auth to context
    const authContext = { ...context, auth } as AuthenticatedContext;
    return next.call(null, authContext);
  };
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validation middleware - validates request body against Zod schema
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  options: {
    maxPayloadSize?: number;
    source?: 'body' | 'query' | 'params';
  } = {}
): Middleware<ValidatedContext<T>> {
  return async (context, next) => {
    try {
      // Extract data based on source
      let data: any;
      if (options.source === 'query') {
        const url = new URL(context.request.url);
        data = Object.fromEntries(url.searchParams.entries());
      } else if (options.source === 'params') {
        data = context.params;
      } else {
        // Default: body
        const text = await context.request.text();
        if (text) {
          data = JSON.parse(text);
          if (options.maxPayloadSize) {
            enforcePayloadSize(data);
          }
        } else {
          data = {};
        }
      }

      // Validate
      const result = validateSchema(schema, data, 'API');
      if (!result.success) {
        // Type assertion: when success is false, errors property exists
        const failedResult = result as { success: false; errors: string[] };
        logger.warn('Validation failed', {
          path: new URL(context.request.url).pathname,
          errors: failedResult.errors,
        });
        return {
          status: 400,
          error: `Validation failed: ${failedResult.errors.join('; ')}`,
        };
      }

      // At this point, TypeScript knows result.success is true, so result.data exists
      const validatedContext = { ...context, validated: result.data } as ValidatedContext<T>;
      return next.call(null, validatedContext);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { status: 400, error: 'Invalid JSON in request body' };
      }
      if (error.message?.includes('Payload size exceeds')) {
        return { status: 413, error: error.message };
      }
      throw error;
    }
  };
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Error handling middleware - catches and formats errors
 */
export function withErrorHandling(options: { includeStack?: boolean } = {}): Middleware {
  return async (context, next) => {
    try {
      return await next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Handler error', error, {
        path: new URL(context.request.url).pathname,
      });

      return {
        status: 500,
        error:
          options.includeStack && errorStack
            ? `${errorMessage}\n${errorStack}`
            : 'Internal server error',
      };
    }
  };
}

// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================

/**
 * Rate limiting middleware - enforces request rate limits
 * Note: Requires Cloudflare KV for distributed rate limiting
 */
export function withRateLimit(options: {
  requestsPerMinute: number;
  keyPrefix?: string;
}): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    const identifier =
      context.auth?.userId || context.request.headers.get('cf-connecting-ip') || 'unknown';
    const key = `${options.keyPrefix || 'rate_limit'}:${identifier}`;

    // Check rate limit (implementation depends on KV)
    // For now, this is a placeholder
    const isRateLimited = false; // TODO: Implement KV-based rate limiting

    if (isRateLimited) {
      logger.warn('Rate limit exceeded', { identifier, key });
      return {
        status: 429,
        error: 'Too many requests. Please try again later.',
      };
    }

    return next();
  };
}

// ============================================================================
// LOGGING MIDDLEWARE
// ============================================================================

/**
 * Request logging middleware
 */
export function withLogging(options: { logBody?: boolean } = {}): Middleware {
  return async (context, next) => {
    const start = Date.now();
    const url = new URL(context.request.url);

    logger.info('Request started', {
      method: context.request.method,
      path: url.pathname,
      query: url.search,
    });

    const response = await next();
    const duration = Date.now() - start;

    const status: number = response instanceof Response ? response.status : response.status || 200;

    logger.info('Request completed', {
      method: context.request.method,
      path: url.pathname,
      status,
      duration,
    });

    return response;
  };
}

// ============================================================================
// COMMON MIDDLEWARE STACKS
// ============================================================================

/**
 * Standard authenticated endpoint stack
 */
export function authenticatedEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>
) {
  return withMiddleware(
    withCors(),
    withErrorHandling(),
    withAuth(),
    withValidation(schema),
    withLogging(),
    handler
  );
}

/**
 * Public endpoint stack (no auth required)
 */
export function publicEndpoint<T>(schema: z.ZodSchema<T>, handler: Handler<ValidatedContext<T>>) {
  return withMiddleware(
    withCors(),
    withErrorHandling(),
    withValidation(schema),
    withLogging(),
    handler
  );
}

/**
 * Admin endpoint stack (auth + admin check)
 */
export function adminEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>
) {
  return withMiddleware(
    withCors(),
    withErrorHandling(),
    withAuth(),
    // TODO: Add admin role check middleware
    withValidation(schema),
    withLogging(),
    handler
  );
}
