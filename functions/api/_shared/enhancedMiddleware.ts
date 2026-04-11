/**
 * Enhanced Middleware for PANaCEa API
 *
 * Features enhanced security, rate limiting, and monitoring capabilities
 * Integrates with the new security systems created in Phase 7
 */

import { z } from 'zod';
import { logger, createEndpointLogger } from './secureLogger';
import { validateFunctionEnv, MissingEnvError } from './env-validation';
import { IDSchema } from './schemas';
import {
  createEnhancedRateLimiter,
  withEnhancedRateLimit,
  EnhancedRateLimitType,
  ENHANCED_RATE_LIMITS,
} from '@/services/security/enhancedRateLimiter';
import {
  getSecurityMonitor,
  recordRateLimitEvent,
  withSecurityMonitoring,
  SecurityEventType,
} from '@/services/security/securityMonitor';
import {
  getPermissionSystem,
  Permission,
  UserRole,
  ResourceType,
  PermissionContext,
} from '@/lib/auth/permissionSystem';
import { AppError, ErrorCategory, ErrorCode } from '@/lib/errors/appError';

// Re-export types from original middleware for compatibility
export type {
  CloudflareContext,
  AuthenticatedContext,
  ValidatedContext,
  Handler,
  HandlerResponse,
  Middleware,
} from './middleware';

// Import original middleware functions we'll enhance
import {
  withEnvCheck as originalWithEnvCheck,
  withCors as originalWithCors,
  withAuth as originalWithAuth,
  withAdminRole as originalWithAdminRole,
  withRefineryRole as originalWithRefineryRole,
  withValidation as originalWithValidation,
  withErrorHandling as originalWithErrorHandling,
  withLogging as originalWithLogging,
} from './middleware';

// ============================================================================
// ENHANCED RATE LIMITING MIDDLEWARE
// ============================================================================

/**
 * Enhanced rate limiting middleware with cost tracking and burst protection
 */
export function withEnhancedRateLimitMiddleware(options: {
  limitType: EnhancedRateLimitType;
  estimatedTokens?: number; // For AI endpoints
  requireAuthentication?: boolean;
}): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    const { env, request, auth } = context;

    // Get identifier for rate limiting
    const identifier = auth?.userId || request.headers.get('cf-connecting-ip') || 'unknown';

    // Get IP address for geographic rate limiting
    const ipAddress = request.headers.get('cf-connecting-ip') || undefined;

    // Get user agent for device fingerprinting
    const userAgent = request.headers.get('user-agent') || undefined;

    // Check rate limit using enhanced system
    const { response: rateLimitResponse, headers } = await withEnhancedRateLimit(
      env,
      identifier,
      options.limitType,
      {
        estimatedTokens: options.estimatedTokens,
        userId: auth?.userId,
        ipAddress,
        endpointPath: new URL(request.url).pathname,
      }
    );

    if (rateLimitResponse) {
      // Record rate limit event for monitoring
      const monitor = getSecurityMonitor();
      await monitor.recordEvent(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        {
          limitType: options.limitType,
          identifier,
          estimatedTokens: options.estimatedTokens,
          endpoint: new URL(request.url).pathname,
        },
        {
          userId: auth?.userId,
          ipAddress,
          userAgent,
          endpoint: new URL(request.url).pathname,
          method: request.method,
          severity: 'high',
        }
      );

      return rateLimitResponse;
    }

    // Add rate limit headers to response
    const originalResponse = await next();

    if (originalResponse && typeof originalResponse === 'object' && 'status' in originalResponse) {
      // This is a HandlerResponse (object with status/body)
      return {
        ...originalResponse,
        headers: {
          ...(originalResponse.headers || {}),
          ...headers,
        },
      };
    } else if (originalResponse instanceof Response) {
      // This is a Response object
      const newHeaders = new Headers(originalResponse.headers);
      Object.entries(headers).forEach(([key, value]) => {
        if (value) newHeaders.set(key, value);
      });

      return new Response(originalResponse.body, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: newHeaders,
      });
    }

    return originalResponse;
  };
}

// ============================================================================
// PERMISSION-BASED ACCESS CONTROL MIDDLEWARE
// ============================================================================

/**
 * Middleware for permission-based access control
 */
export function withPermission(
  permission: Permission,
  options: {
    resourceType?: ResourceType;
    resourceIdParam?: string; // URL parameter name containing resource ID
    requireOwnership?: boolean;
    customCheck?: (context: PermissionContext) => Promise<boolean>;
  } = {}
): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    const { auth, params } = context;

    if (!auth?.userId) {
      throw new AppError(
        'Authentication required',
        ErrorCategory.AUTHENTICATION,
        ErrorCode.AUTH_TOKEN_MISSING
      );
    }

    // Build permission context
    const permissionContext: PermissionContext = {
      userId: auth.userId,
      role: (auth.userRole as UserRole) || UserRole.STUDENT,
      additionalPermissions: auth.additionalPermissions as Permission[],
      resourceType: options.resourceType,
      resourceId: options.resourceIdParam ? params?.[options.resourceIdParam] : undefined,
      resourceOwnerId: auth.userId, // Default to user themselves
      metadata: {
        requestPath: new URL(context.request.url).pathname,
        requestMethod: context.request.method,
      },
    };

    // Check permission
    const permissionSystem = getPermissionSystem();
    const result = await permissionSystem.checkPermission(permissionContext, permission, {
      requireOwnership: options.requireOwnership,
      customCheck: options.customCheck,
    });

    if (!result.allowed) {
      throw new AppError(
        result.reason || 'Permission denied',
        ErrorCategory.AUTHENTICATION,
        ErrorCode.PERMISSION_DENIED,
        {
          userId: auth.userId,
          permission,
          resourceType: options.resourceType,
          resourceId: permissionContext.resourceId,
        }
      );
    }

    return next();
  };
}

// ============================================================================
// SECURITY MONITORING MIDDLEWARE
// ============================================================================

/**
 * Enhanced security monitoring middleware
 * Records all requests and responses for security analysis
 */
export function withEnhancedSecurityMonitoring(
  options: {
    logRequestBody?: boolean;
    logResponseBody?: boolean;
    sensitiveFields?: string[]; // Fields to redact from logs
  } = {}
): Middleware<AuthenticatedContext> {
  return async (context, next) => {
    const { request, auth, env } = context;
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;
    const ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Get request body for logging (if enabled)
    let requestBody: any = null;
    if (options.logRequestBody && request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const clone = request.clone();
        requestBody = await clone.text();

        // Try to parse as JSON
        try {
          requestBody = JSON.parse(requestBody);

          // Redact sensitive fields
          if (options.sensitiveFields && requestBody && typeof requestBody === 'object') {
            requestBody = this.redactSensitiveFields(requestBody, options.sensitiveFields);
          }
        } catch {
          // Not JSON, keep as text
        }
      } catch (error) {
        // Failed to read body, continue without it
      }
    }

    try {
      const response = await next();
      const responseTime = Date.now() - startTime;

      // Get response body for logging (if enabled)
      let responseBody: any = null;
      let statusCode = 200;

      if (options.logResponseBody && response && response instanceof Response) {
        statusCode = response.status;

        try {
          const clone = response.clone();
          responseBody = await clone.text();

          // Try to parse as JSON
          try {
            responseBody = JSON.parse(responseBody);

            // Redact sensitive fields
            if (options.sensitiveFields && responseBody && typeof responseBody === 'object') {
              responseBody = this.redactSensitiveFields(responseBody, options.sensitiveFields);
            }
          } catch {
            // Not JSON, keep as text
          }
        } catch (error) {
          // Failed to read body, continue without it
        }
      } else if (response && typeof response === 'object' && 'status' in response) {
        statusCode = response.status;
      }

      // Record successful request
      const monitor = getSecurityMonitor();
      await monitor.recordEvent(
        SecurityEventType.AUTH_SUCCESS,
        {
          requestId,
          endpoint,
          method,
          requestBody: options.logRequestBody ? requestBody : undefined,
          responseBody: options.logResponseBody ? responseBody : undefined,
          responseTime,
          statusCode,
        },
        {
          userId: auth?.userId,
          userEmail: auth?.userEmail,
          userRole: auth?.userRole,
          ipAddress,
          userAgent,
          endpoint,
          method,
          statusCode,
          responseTime,
        }
      );

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Determine error details
      let errorMessage = 'Unknown error';
      let statusCode = 500;

      if (error instanceof AppError) {
        errorMessage = error.message;
        statusCode = error.statusCode || 500;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Record failed request
      const monitor = getSecurityMonitor();
      await monitor.recordEvent(
        SecurityEventType.AUTH_FAILURE,
        {
          requestId,
          endpoint,
          method,
          requestBody: options.logRequestBody ? requestBody : undefined,
          error: errorMessage,
          responseTime,
          statusCode,
        },
        {
          userId: auth?.userId,
          userEmail: auth?.userEmail,
          userRole: auth?.userRole,
          ipAddress,
          userAgent,
          endpoint,
          method,
          statusCode,
          responseTime,
          errorMessage,
          severity: statusCode >= 500 ? 'high' : 'medium',
        }
      );

      throw error;
    }
  };
}

// ============================================================================
// ENHANCED ENDPOINT HELPERS
// ============================================================================

/**
 * Enhanced admin endpoint with security monitoring and rate limiting
 */
export function enhancedAdminEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>,
  options: {
    rateLimitType?: EnhancedRateLimitType;
    requiredPermissions?: Permission[];
    logRequestBody?: boolean;
  } = {}
) {
  const rateLimitType = options.rateLimitType || 'admin';

  return withMiddleware(
    withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
    originalWithAuth(),
    originalWithAdminRole(),
    withEnhancedRateLimitMiddleware({ limitType: rateLimitType }),
    withEnhancedSecurityMonitoring({
      logRequestBody: options.logRequestBody,
      sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization'],
    }),
    originalWithValidation(schema),
    async (context) => {
      // Check additional permissions if specified
      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        const permissionSystem = getPermissionSystem();
        const permissionContext: PermissionContext = {
          userId: context.auth.userId,
          role: (context.auth.userRole as UserRole) || UserRole.ADMIN,
          additionalPermissions: context.auth.additionalPermissions as Permission[],
        };

        const result = await permissionSystem.checkPermissions(
          permissionContext,
          options.requiredPermissions
        );

        if (!result.allowed) {
          throw new AppError(
            result.reason || 'Insufficient permissions',
            ErrorCategory.AUTHENTICATION,
            ErrorCode.PERMISSION_DENIED,
            {
              userId: context.auth.userId,
              requiredPermissions: options.requiredPermissions,
            }
          );
        }
      }

      return handler(context);
    }
  );
}

/**
 * Enhanced AI endpoint with cost-based rate limiting
 */
export function enhancedAIEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>,
  options: {
    estimatedTokens?: number;
    requiredPermissions?: Permission[];
  } = {}
) {
  return withMiddleware(
    withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY', 'GEMINI_API_KEY']),
    originalWithAuth(),
    withEnhancedRateLimitMiddleware({
      limitType: 'gemini',
      estimatedTokens: options.estimatedTokens,
    }),
    withEnhancedSecurityMonitoring({
      logRequestBody: true,
      sensitiveFields: ['password', 'token', 'secret'],
    }),
    originalWithValidation(schema),
    async (context) => {
      // Check AI-specific permissions
      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        const permissionSystem = getPermissionSystem();
        const permissionContext: PermissionContext = {
          userId: context.auth.userId,
          role: (context.auth.userRole as UserRole) || UserRole.STUDENT,
          additionalPermissions: context.auth.additionalPermissions as Permission[],
        };

        const result = await permissionSystem.checkPermissions(
          permissionContext,
          options.requiredPermissions
        );

        if (!result.allowed) {
          throw new AppError(
            result.reason || 'Insufficient permissions for AI operations',
            ErrorCategory.AUTHENTICATION,
            ErrorCode.PERMISSION_DENIED,
            {
              userId: context.auth.userId,
              requiredPermissions: options.requiredPermissions,
            }
          );
        }
      }

      return handler(context);
    }
  );
}

/**
 * Enhanced public endpoint with security monitoring
 */
export function enhancedPublicEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>,
  options: {
    rateLimitType?: EnhancedRateLimitType;
    requireAuth?: boolean;
  } = {}
) {
  const rateLimitType = options.rateLimitType || 'standard';
  const middlewares: Middleware[] = [
    originalWithCors(),
    withEnhancedRateLimitMiddleware({ limitType: rateLimitType }),
    withEnhancedSecurityMonitoring({
      logRequestBody: false,
      sensitiveFields: ['password', 'token', 'secret'],
    }),
  ];

  if (options.requireAuth) {
    middlewares.push(originalWithAuth());
  }

  middlewares.push(originalWithValidation(schema));

  return withMiddleware(...middlewares)(handler);
}

/**
 * Enhanced authenticated endpoint for general API access
 */
export function enhancedAuthenticatedEndpoint<T>(
  schema: z.ZodSchema<T>,
  handler: Handler<AuthenticatedContext & ValidatedContext<T>>,
  options: {
    rateLimitType?: EnhancedRateLimitType;
    requiredPermissions?: Permission[];
  } = {}
) {
  const rateLimitType = options.rateLimitType || 'standard';

  return withMiddleware(
    withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
    originalWithAuth(),
    withEnhancedRateLimitMiddleware({ limitType: rateLimitType }),
    withEnhancedSecurityMonitoring({
      logRequestBody: false,
      sensitiveFields: ['password', 'token', 'secret'],
    }),
    originalWithValidation(schema),
    async (context) => {
      // Check permissions if specified
      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        const permissionSystem = getPermissionSystem();
        const permissionContext: PermissionContext = {
          userId: context.auth.userId,
          role: (context.auth.userRole as UserRole) || UserRole.STUDENT,
          additionalPermissions: context.auth.additionalPermissions as Permission[],
        };

        const result = await permissionSystem.checkPermissions(
          permissionContext,
          options.requiredPermissions
        );

        if (!result.allowed) {
          throw new AppError(
            result.reason || 'Insufficient permissions',
            ErrorCategory.AUTHENTICATION,
            ErrorCode.PERMISSION_DENIED,
            {
              userId: context.auth.userId,
              requiredPermissions: options.requiredPermissions,
            }
          );
        }
      }

      return handler(context);
    }
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Redact sensitive fields from an object
 */
function redactSensitiveFields(obj: any, sensitiveFields: string[]): any {
  if (!obj || typeof obj !== 'object') return obj;

  const result = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in result) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = redactSensitiveFields(result[key], sensitiveFields);
    }
  }

  return result;
}

/**
 * Get rate limit configuration for an endpoint
 */
export function getEndpointRateLimitConfig(endpoint: string): {
  limitType: EnhancedRateLimitType;
  estimatedTokens?: number;
} {
  // Map endpoints to rate limit types
  const endpointConfigs: Record<
    string,
    { limitType: EnhancedRateLimitType; estimatedTokens?: number }
  > = {
    // AI endpoints
    '/api/gemini': { limitType: 'gemini', estimatedTokens: 1000 },
    '/api/ai/chat/stream': { limitType: 'gemini', estimatedTokens: 1000 },
    '/api/ai/vision/analyze': { limitType: 'gemini', estimatedTokens: 500 },
    '/api/ai/vision/analyze-3d': { limitType: 'gemini', estimatedTokens: 2000 },
    '/api/tutor/chat': { limitType: 'gemini', estimatedTokens: 500 },

    // Question endpoints
    '/api/questions': { limitType: 'questions' },
    '/api/questions/pool': { limitType: 'questions' },
    '/api/questions/batch': { limitType: 'questions' },

    // Sync endpoints
    '/api/sync': { limitType: 'sync' },

    // Auth endpoints
    '/api/auth': { limitType: 'auth' },

    // Admin endpoints
    '/api/admin': { limitType: 'admin' },
    '/api/admin/media': { limitType: 'admin' },

    // Default for other endpoints
    default: { limitType: 'standard' },
  };

  // Find matching config
  for (const [path, config] of Object.entries(endpointConfigs)) {
    if (endpoint.startsWith(path)) {
      return config;
    }
  }

  return endpointConfigs.default;
}

// Re-export original middleware functions for compatibility
export {
  originalWithEnvCheck as withEnvCheck,
  originalWithCors as withCors,
  originalWithAuth as withAuth,
  originalWithAdminRole as withAdminRole,
  originalWithRefineryRole as withRefineryRole,
  originalWithValidation as withValidation,
  originalWithErrorHandling as withErrorHandling,
  originalWithLogging as withLogging,
};

// Re-export the main middleware composer
import { withMiddleware } from './middleware';
export { withMiddleware };
