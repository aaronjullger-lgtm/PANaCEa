/**
 * GET /api/health
 * Diagnostic endpoint - tests database connectivity and auth setup.
 * No authentication required so you can test from a browser.
 * Prisma is imported dynamically only when DATABASE_URL is set to avoid load-time errors in Workers.
 */

import { getCorsHeaders, getCorsConfig } from './_shared/cors';

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestGet = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  const cors = getCorsHeaders(context?.request, corsConfig) ?? {};
  const jsonHeaders = { ...cors, 'Content-Type': 'application/json' };

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
    // Masked keys for verification (first 8 chars)
    diagnostics.envMasked = {
      DATABASE_URL: env.DATABASE_URL ? env.DATABASE_URL.substring(0, 8) + '...' : null,
      CLERK_SECRET_KEY: env.CLERK_SECRET_KEY ? env.CLERK_SECRET_KEY.substring(0, 8) + '...' : null,
      GEMINI_API_KEY: env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 8) + '...' : null,
    };

    // 2. DATABASE_URL type
    const dbUrl = env.DATABASE_URL as string | undefined;
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
    let prisma: { user: { count: () => Promise<number> }; [key: string]: unknown } | null = null;
    if (!dbUrl) {
      diagnostics.prismaClientCreated = false;
      diagnostics.dbConnected = false;
      diagnostics.dbError = 'DATABASE_URL is missing';
    } else {
      let disconnect: ((p: unknown) => Promise<void>) | null = null;
      try {
        const prismaEdge = await import('./_shared/prisma-edge');
        disconnect = prismaEdge.safePrismaDisconnect;
        prisma = prismaEdge.createEdgePrismaClient(dbUrl) as typeof prisma;
        diagnostics.prismaClientCreated = true;
        const userCount = await prisma.user.count();
        diagnostics.dbConnected = true;
        diagnostics.userCount = userCount;
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
    return new Response(
      JSON.stringify({ status: allGood ? 'healthy' : 'unhealthy', diagnostics }, null, 2),
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
