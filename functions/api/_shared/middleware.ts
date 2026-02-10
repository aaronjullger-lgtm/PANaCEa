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
import { getCorsHeaders, handleCorsPreflightSecure } from './cors';
import { validateFunctionEnv, MissingEnvError, type EnvRequirement } from './env-validation';
import { logger } from './secureLogger';
import { enforcePayloadSize, validateSchema } from './zodSchemas';
import { createEdgePrismaClient, safePrismaDisconnect } from './prisma-edge';

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
 * Note: next() accepts an optional enriched context to pass to the next middleware
 */
export type Middleware<TContext = CloudflareContext> = (
  context: TContext,
  next: (ctx?: any) => Promise<HandlerResponse>
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

    const requestId = crypto.randomUUID();

    // Build middleware chain
    let index = 0;
    const dispatch = async (ctx: any): Promise<HandlerResponse> => {
      if (index === middleware.length) {
        return handler(ctx);
      }

      const currentMiddleware = middleware[index];
      index++;

      if (!currentMiddleware) {
        return handler(ctx);
      }

      return currentMiddleware(ctx, (newCtx?: any) => dispatch(newCtx ?? ctx));
    };

    try {
      const result = await dispatch(context);
      return toResponse(result, context.request, requestId);
    } catch (error) {
      logger.error('Middleware chain error', error);
      return toResponse(
        { status: 500, error: 'Internal server error' },
        context.request,
        requestId
      );
    }
  };
}

/**
 * Convert handler response to standard Response object
 */
function toResponse(result: HandlerResponse, request: Request, requestId?: string): Response {
  if (result instanceof Response) {
    if (requestId) {
      const headers = new Headers(result.headers);
      headers.set('X-Request-ID', requestId);
      return new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers,
      });
    }
    return result;
  }

  const status = result.status || 200;
  const body = result.error
    ? JSON.stringify({ error: result.error })
    : JSON.stringify(result.data || result);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (requestId) headers.set('X-Request-ID', requestId);

  const response = new Response(body, {
    status,
    headers,
  });

  // Add CORS headers
  const corsHeaders = getCorsHeaders(request);
  if (corsHeaders) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      (response.headers as Headers).set(key, value);
    });
  }

  return response;
}

// ============================================================================
// ENV VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validate required environment variables before running the handler.
 * Fails fast with 500 if DATABASE_URL, CLERK_SECRET_KEY, etc. are missing.
 *
 * Accepts either a preset key (e.g. 'DATABASE', 'FULL_STACK') or an explicit
 * list of env var names for advanced cases.
 */
export function withEnvCheck(
  required: EnvRequirement | readonly string[] | string[]
): Middleware {
  return async (context, next) => {
    try {
      validateFunctionEnv(context.env as Record<string, unknown>, required);
      return await next();
    } catch (error) {
      if (error instanceof MissingEnvError) {
        return error.toResponse();
      }
      throw error;
    }
  };
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

    // Add auth to context and pass it to the next middleware
    const authContext = { ...context, auth } as AuthenticatedContext;
    return next(authContext);
  };
}

/**
 * Admin role check middleware - requires authenticated user to have admin role
 * Must be used after withAuth() middleware
 */
export function withAdminRole(): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    // Ensure we have auth context from withAuth()
    if (!context.auth || !context.auth.userId) {
      logger.error('withAdminRole called without auth context');
      return { status: 401, error: 'Authentication required' };
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Fetch user from database to check role
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { role: true },
      });

      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
        logger.warn('Non-admin user attempted to access admin endpoint', {
          userId: context.auth.userId,
          path: new URL(context.request.url).pathname,
        });
        return { status: 403, error: 'Admin access required' };
      }

      // User is admin, continue to next middleware
      return next();
    } catch (error) {
      logger.error('Error checking admin role', {
        error: error instanceof Error ? error.message : String(error),
        userId: context.auth.userId,
      });
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  };
}

/**
 * Refinery role check - requires approver or admin (for Refinery inbox/action/media)
 */
export function withRefineryRole(): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    if (!context.auth?.userId) {
      return { status: 401, error: 'Authentication required' };
    }
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { role: true },
      });
      const role = (user?.role ?? '').toUpperCase();
      const allowed = role === 'APPROVER' || role === 'ADMIN' || role === 'SUPERADMIN';
      if (!user || !allowed) {
        logger.warn('Non-approver attempted refinery access', {
          userId: context.auth.userId,
          path: new URL(context.request.url).pathname,
        });
        return { status: 403, error: 'Approver or admin access required' };
      }
      return next();
    } catch (error) {
      logger.error('Error checking refinery role', {
        error: error instanceof Error ? error.message : String(error),
        userId: context.auth.userId,
      });
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
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
      return next(validatedContext);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { status: 400, error: 'Invalid JSON in request body' };
      }
      if (error instanceof Error && error.message?.includes('Payload size exceeds')) {
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
 * Uses Cloudflare KV for distributed rate limiting in production
 */
export function withRateLimit(options: {
  requestsPerMinute: number;
  keyPrefix?: string;
  endpointType?: 'api' | 'auth' | 'admin';
}): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    // Determine identifier (user ID if authenticated, otherwise IP)
    const identifier =
      context.auth?.userId || context.request.headers.get('cf-connecting-ip') || 'unknown';
    const key = `${options.keyPrefix || 'rate_limit'}:${identifier}`;

    // Determine rate limit based on endpoint type
    const limitConfig = {
      api: { requests: options.requestsPerMinute, window: 60 },
      auth: { requests: 20, window: 60 }, // More restrictive for auth
      admin: { requests: 30, window: 60 }, // Slightly higher for admin
    };

    const config = limitConfig[options.endpointType || 'api'];

    // Check rate limit using Cloudflare KV
    const isRateLimited = await checkRateLimit(context.env, key, config.requests, config.window);

    if (isRateLimited) {
      logger.warn('Rate limit exceeded', {
        identifier,
        key,
        endpointType: options.endpointType,
      });

      return {
        status: 429,
        error: getRateLimitErrorMessage(options.endpointType),
      };
    }

    return next();
  };
}

/**
 * Check rate limit using Cloudflare KV
 */
async function checkRateLimit(
  env: any,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    // Cloudflare KV namespace (should be bound in wrangler.toml)
    const kv = env.RATE_LIMIT_KV;

    if (!kv) {
      // Fallback: Allow requests if KV not available (development)
      return false;
    }

    // Get current count from KV
    const currentCount = (await kv.get(key, { type: 'json' })) || 0;

    if (currentCount >= maxRequests) {
      return true; // Rate limit exceeded
    }

    // Increment count with expiration
    await kv.put(key, currentCount + 1, { expirationTtl: windowSeconds });

    return false;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting fails
    return false;
  }
}

/**
 * Get appropriate error message based on endpoint type
 */
function getRateLimitErrorMessage(endpointType?: string): string {
  switch (endpointType) {
    case 'auth':
      return 'Too many authentication attempts. Please wait before trying again.';
    case 'admin':
      return 'Admin endpoint rate limit exceeded. Please try again later.';
    default:
      return 'Too many requests. Please try again later.';
  }
}

/**
 * Admin endpoint stack with rate limiting
 * Includes env validation for DATABASE + AUTH
 */
export function adminEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>
) {
  return withMiddleware(
    withCors(),
    withErrorHandling(),
    withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
    withAuth(),
    withAdminRole(), // Admin role check added
    withRateLimit({ requestsPerMinute: 30, endpointType: 'admin' }),
    withValidation(schema),
    withLogging(),
    handler
  );
}

/**
 * Refinery endpoint stack (approver or admin)
 * For Refinery inbox, action, media-signed-url.
 */
export function refineryEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>,
  options?: { source?: 'body' | 'query' | 'params' }
) {
  return withMiddleware(
    withCors(),
    withErrorHandling(),
    withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
    withAuth(),
    withRefineryRole(),
    withRateLimit({ requestsPerMinute: 60, endpointType: 'admin', keyPrefix: 'refinery' }),
    withValidation(schema, options),
    withLogging(),
    handler
  );
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
 * Includes env validation, rate limiting (300 req/min), and auth
 */
export function authenticatedEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>,
  options?: { source?: 'body' | 'query' | 'params'; requestsPerMinute?: number }
) {
  const rateLimit = options?.requestsPerMinute ?? 300;
  return withMiddleware(
    withCors(),
    withErrorHandling(),
    withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
    withAuth(),
    withRateLimit({ requestsPerMinute: rateLimit, endpointType: 'api' }),
    withValidation(schema, options),
    withLogging(),
    handler
  );
}

/**
 * Public endpoint stack (no auth required)
 * Includes env validation and rate limiting (600 req/min by IP)
 */
export function publicEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<ValidatedContext<T>>,
  options?: { source?: 'body' | 'query' | 'params'; envRequired?: EnvRequirement }
) {
  const envCheck = options?.envRequired
    ? withEnvCheck(options.envRequired)
    : withEnvCheck('DATABASE');
  return withMiddleware(
    withCors(),
    withErrorHandling(),
    envCheck,
    withRateLimit({ requestsPerMinute: 600, endpointType: 'api', keyPrefix: 'public' }),
    withValidation(schema, options),
    withLogging(),
    handler
  );
}
