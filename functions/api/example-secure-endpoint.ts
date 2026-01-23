/**
 * Example Secure Endpoint
 *
 * This file demonstrates the proper usage of the middleware pattern
 * for securing Cloudflare Pages Function endpoints.
 *
 * Use this as a template for converting unsafe endpoints to secure ones.
 */

import { z } from 'zod';
import { authenticatedEndpoint, publicEndpoint } from './_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from './_shared/prisma-edge';

// ============================================================================
// EXAMPLE 1: Authenticated Endpoint with Validation
// ============================================================================

/**
 * Schema for the request body
 */
const exampleRequestSchema = z.object({
  userId: z.string().min(1, 'User ID required'),
  limit: z.number().int().min(1).max(100).default(10),
  includeDetails: z.boolean().default(false),
});

/**
 * Secure authenticated endpoint
 * - Automatically enforces authentication
 * - Validates input with Zod
 * - Adds CORS headers
 * - Logs requests/responses
 * - Catches and formats errors
 */
export const onRequestPost = authenticatedEndpoint(exampleRequestSchema, async (context) => {
  // context.auth.userId is guaranteed to exist (TypeScript enforces this)
  // context.validated contains type-safe, validated data

  const { limit, includeDetails } = context.validated;
  const userId = context.auth.userId;

  // Your business logic here
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const results = await prisma.userProgress.findMany({
      where: { userId },
      take: limit,
      select: {
        id: true,
        stability: true,
        difficulty: true,
        lastReviewed: includeDetails,
        reviewHistory: includeDetails,
      },
    });

    return {
      data: {
        success: true,
        count: results.length,
        results,
      },
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// ============================================================================
// EXAMPLE 2: Public Endpoint (No Authentication Required)
// ============================================================================

const publicQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

/**
 * Public endpoint - no authentication required
 * Still validates input and applies CORS/logging
 */
export const onRequestGet = publicEndpoint(publicQuerySchema, async (context) => {
  const { page, pageSize } = context.validated;

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const skip = (page - 1) * pageSize;

    const [total, items] = await Promise.all([
      prisma.medicalContent.count({ where: { status: 'published' } }),
      prisma.medicalContent.findMany({
        where: { status: 'published' },
        select: {
          id: true,
          canonicalName: true,
          displayName: true,
          organSystem: true,
        },
        skip,
        take: pageSize,
        orderBy: { displayName: 'asc' },
      }),
    ]);

    return {
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// ============================================================================
// EXAMPLE 3: Manual Middleware Composition (Advanced)
// ============================================================================

import {
  withMiddleware,
  withAuth,
  withValidation,
  withCors,
  withLogging,
} from './_shared/middleware';

const advancedSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  resourceId: z.string().uuid(),
});

/**
 * Advanced example: manually compose middleware
 * Use this when you need custom middleware order or additional middleware
 */
export const onRequestPut = withMiddleware(
  withCors(), // First: Handle CORS
  withAuth(), // Second: Authenticate
  withValidation(advancedSchema), // Third: Validate
  withLogging(), // Fourth: Log
  async (context) => {
    // Your handler with full type safety
    const { action, resourceId } = context.validated;
    const userId = context.auth.userId;

    // Business logic...

    return {
      data: {
        success: true,
        action,
        resourceId,
        performedBy: userId,
      },
    };
  }
);

// ============================================================================
// MIGRATION GUIDE: Converting Unsafe to Secure
// ============================================================================

/**
 * BEFORE (Unsafe):
 *
 * export async function onRequestPost(context: any) {
 *   try {
 *     const body = await context.request.json();
 *     const userId = context.env.USER_ID; // No auth check!
 *     const result = await doSomething(body.data); // No validation!
 *
 *     return new Response(JSON.stringify(result), {
 *       headers: { 'Access-Control-Allow-Origin': '*' }, // Insecure CORS!
 *     });
 *   } catch (error) {
 *     console.error(error); // Leaks secrets!
 *     return new Response('Error', { status: 500 });
 *   }
 * }
 *
 * PROBLEMS:
 * 1. No authentication
 * 2. No input validation
 * 3. Wildcard CORS (exposes data to any origin)
 * 4. Error logging may leak secrets
 * 5. Manual error handling (inconsistent)
 * 6. No request logging
 */

/**
 * AFTER (Secure):
 *
 * const requestSchema = z.object({
 *   data: z.string().min(1),
 * });
 *
 * export const onRequestPost = authenticatedEndpoint(
 *   requestSchema,
 *   async (context) => {
 *     // ✅ Auth enforced automatically
 *     // ✅ Input validated with schema
 *     // ✅ Secure CORS applied
 *     // ✅ Errors caught & secrets redacted
 *     // ✅ Request/response logged
 *
 *     const result = await doSomething(context.validated.data);
 *     return { data: result };
 *   }
 * );
 *
 * IMPROVEMENTS:
 * 1. ✅ Authentication enforced (401 if missing)
 * 2. ✅ Input validation with helpful error messages
 * 3. ✅ Secure CORS with origin allowlist
 * 4. ✅ Secret-safe error logging
 * 5. ✅ Consistent error format
 * 6. ✅ Automatic request/response logging
 * 7. ✅ Full TypeScript type safety
 */
