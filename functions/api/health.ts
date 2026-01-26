/**
 * Health Check Endpoint
 *
 * Diagnostic endpoint to verify:
 * 1. Functions are deployed correctly to Cloudflare Pages
 * 2. Environment variables are accessible
 * 3. Database connectivity via Prisma Accelerate
 *
 * This endpoint does NOT require authentication for diagnostic purposes.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from './_shared/prisma-edge';
import { getCorsHeaders, handleCorsPreflightSecure } from './_shared/cors';

interface Env {
  DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
}

interface CloudflareContext {
  request: Request;
  env: Env;
}

/**
 * GET /api/health
 * Returns system health status and diagnostics
 */
export async function onRequestGet(context: CloudflareContext): Promise<Response> {
  const startTime = Date.now();
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    endpoint: '/api/health',
    status: 'checking',
    checks: {},
  };

  try {
    // Check 1: Function deployment (if we get here, it's working)
    diagnostics.checks.functionDeployed = {
      status: 'pass',
      message: 'Cloudflare Pages Function is running',
    };

    // Check 2: Environment variables presence (not values for security)
    const envChecks = {
      DATABASE_URL: !!context.env.DATABASE_URL,
      CLERK_SECRET_KEY: !!context.env.CLERK_SECRET_KEY,
      DATABASE_URL_FORMAT: context.env.DATABASE_URL
        ? context.env.DATABASE_URL.startsWith('prisma://')
          ? 'prisma-accelerate'
          : context.env.DATABASE_URL.startsWith('postgresql://')
            ? 'direct-postgres'
            : 'unknown'
        : 'missing',
    };

    diagnostics.checks.environment = {
      status: envChecks.DATABASE_URL && envChecks.CLERK_SECRET_KEY ? 'pass' : 'fail',
      details: envChecks,
    };

    // Check 3: Database connectivity (only if DATABASE_URL exists)
    if (context.env.DATABASE_URL) {
      try {
        const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
        try {
          // Simple query to verify connection
          const result = await prisma.$queryRaw`SELECT 1 as health_check`;
          diagnostics.checks.database = {
            status: 'pass',
            message: 'Database connection successful',
            latencyMs: Date.now() - startTime,
          };
        } finally {
          await safePrismaDisconnect(prisma);
        }
      } catch (dbError) {
        diagnostics.checks.database = {
          status: 'fail',
          message: 'Database connection failed',
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          errorType: dbError instanceof Error ? dbError.name : 'Unknown',
        };
      }
    } else {
      diagnostics.checks.database = {
        status: 'fail',
        message: 'DATABASE_URL environment variable not set',
      };
    }

    // Overall status
    const allPassed = Object.values(diagnostics.checks).every(
      (check: any) => check.status === 'pass'
    );
    diagnostics.status = allPassed ? 'healthy' : 'degraded';
    diagnostics.totalLatencyMs = Date.now() - startTime;

    // Build response
    const responseBody = JSON.stringify(diagnostics, null, 2);
    const corsHeaders = getCorsHeaders(context.request) || {};

    return new Response(responseBody, {
      status: allPassed ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    // Catastrophic failure - still return JSON
    const errorResponse = {
      timestamp: new Date().toISOString(),
      endpoint: '/api/health',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    };

    const corsHeaders = getCorsHeaders(context.request) || {};

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function onRequestOptions(context: CloudflareContext): Promise<Response> {
  return handleCorsPreflightSecure(context.request, context.env);
}
