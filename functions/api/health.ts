/**
 * GET /api/health
 * Diagnostic endpoint - tests database connectivity and auth setup.
 * No authentication required so you can test from a browser.
 * Prisma is imported dynamically only when DATABASE_URL is set to avoid load-time errors in Workers.
 * Rate limited: anonymous 20/15min per plan.
 */

import { getCorsHeaders, getCorsConfig } from './_shared/cors';
import { withRateLimit, getRateLimitIdentifier } from './_shared/rateLimiter';
import { sanitizeEnvValue } from './_shared/env-validation';

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestGet = async (context: any) => {
  const request = context?.request as Request;
  const env = context?.env ?? {};
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  const cors = getCorsHeaders(request, corsConfig) ?? {};
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' };

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'anonymous'
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const env = context?.env ?? {};
    const diagnostics: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      runtime: 'cloudflare-pages',
    };

    // 1. Check environment variables
    diagnostics.env = {
      DATABASE_URL: !!env.DATABASE_URL,
      CLERK_SECRET_KEY: !!env.CLERK_SECRET_KEY,
      GEMINI_API_KEY: !!env.GEMINI_API_KEY,
    };
    // Partial key material removed — boolean presence checks above are sufficient.
    // Exposing even 8 characters of secret keys reduces brute-force search space.

    // 2. DATABASE_URL type
    const rawDbUrl = env.DATABASE_URL as string | undefined;
    // Defensive: strip wrapping quotes that Cloudflare dashboard may inject
    const dbUrl = rawDbUrl ? sanitizeEnvValue(rawDbUrl) || undefined : undefined;
    if (dbUrl) {
      const isAccelerate = dbUrl.startsWith('prisma://') || dbUrl.startsWith('prisma+postgres://');
      const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
      diagnostics.dbUrlType = isAccelerate
        ? 'accelerate'
        : isPostgres
          ? 'direct-postgres'
          : 'unknown';
      if (isPostgres) {
        diagnostics.warning =
          'Direct PostgreSQL URLs do not work on Cloudflare Workers (no TCP). Use Prisma Accelerate.';
      }
    } else {
      diagnostics.dbUrlType = 'missing';
    }

    // 3. Test database connection (skip if DATABASE_URL missing; dynamic import to avoid load-time throw in Workers)
    let prisma: unknown = null;
    let disconnect: ((p: unknown) => Promise<void>) | null = null;
    if (!dbUrl) {
      diagnostics.prismaClientCreated = false;
      diagnostics.dbConnected = false;
      diagnostics.dbError = 'DATABASE_URL is missing';
    } else {
      try {
        const prismaEdge = await import('./_shared/prisma-edge');
        disconnect = prismaEdge.safePrismaDisconnect;
        prisma = prismaEdge.createEdgePrismaClient(dbUrl);
        const client = prisma as { user: { count: () => Promise<number> }; medicalContent: { findMany: (args: { select: { system: true }; where: { status: string } }) => Promise<{ system: string | null }[]> } };
        diagnostics.prismaClientCreated = true;
        const userCount = await client.user.count();
        diagnostics.dbConnected = true;
        diagnostics.userCount = userCount;

        // Content check: distinct systems count (Condition Library availability)
        try {
          const systems = await client.medicalContent.findMany({
            select: { system: true },
            where: { status: 'published' },
          });
          const systemSet = new Set(systems.map((r) => r.system).filter(Boolean));
          diagnostics.contentSystemsCount = systemSet.size;
          diagnostics.contentConditionCount = systems.length;
        } catch (contentErr) {
          diagnostics.contentError = contentErr instanceof Error ? contentErr.message : String(contentErr);
        }
      } catch (err) {
        diagnostics.prismaClientCreated = !!prisma;
        diagnostics.dbConnected = false;
        diagnostics.dbError = err instanceof Error ? err.message : String(err);
        diagnostics.dbErrorName = err instanceof Error ? err.name : 'Unknown';
      } finally {
        if (prisma && disconnect) await disconnect(prisma);
      }
    }

    // 4. Clerk key format
    const clerkKey = env.CLERK_SECRET_KEY as string | undefined;
    if (clerkKey) {
      diagnostics.clerkKeyType = clerkKey.startsWith('sk_test_')
        ? 'test'
        : clerkKey.startsWith('sk_live_')
          ? 'live'
          : 'unknown-format';
    }

    const allGood = diagnostics.dbConnected === true;
    const checks = {
      functionDeployed: {
        status: 'pass' as const,
        message: 'Cloudflare Pages Functions',
      },
      environment: diagnostics.env,
      database: diagnostics.dbConnected ? { status: 'pass' as const } : { status: 'fail' as const, message: diagnostics.dbError },
      auth: clerkKey
        ? { status: 'pass' as const, message: `Clerk configured (${diagnostics.clerkKeyType || 'unknown'})` }
        : { status: 'warn' as const, message: 'CLERK_SECRET_KEY not set' },
      cache: env.RATE_LIMIT_KV
        ? { status: 'pass' as const, message: 'RATE_LIMIT_KV bound' }
        : { status: 'warn' as const, message: 'RATE_LIMIT_KV not bound (in-memory rate limit only)' },
      content:
        typeof diagnostics.contentSystemsCount === 'number'
          ? { status: diagnostics.contentSystemsCount > 0 ? ('pass' as const) : ('warn' as const), systemsCount: diagnostics.contentSystemsCount }
          : { status: 'skip' as const, message: diagnostics.contentError || 'Not checked' },
    };
    return new Response(
      JSON.stringify(
        {
          timestamp: diagnostics.timestamp,
          endpoint: '/api/health',
          status: allGood ? 'healthy' : 'unhealthy',
          checks,
          diagnostics,
        },
        null,
        2
      ),
      { status: allGood ? 200 : 503, headers: jsonHeaders }
    );
  } catch (topErr) {
    const message = topErr instanceof Error ? topErr.message : String(topErr);
    const name = topErr instanceof Error ? topErr.name : 'Unknown';
    return new Response(
      JSON.stringify(
        {
          status: 'unhealthy',
          diagnostics: {
            timestamp: new Date().toISOString(),
            runtime: 'cloudflare-pages',
            error: message,
            errorName: name,
          },
        },
        null,
        2
      ),
      { status: 503, headers: jsonHeaders }
    );
  }
};
