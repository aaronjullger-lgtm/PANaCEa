/**
 * GET /api/health
 * Diagnostic endpoint - tests database connectivity and auth setup.
 * No authentication required so you can test from a browser.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from './_shared/prisma-edge';
import { getCorsHeaders } from './_shared/cors';

export const onRequestOptions = async (context: any) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env),
  });
};

export const onRequestGet = async (context: any) => {
  const { env } = context;
  const cors = getCorsHeaders(context.request, env);
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

  // 2. DATABASE_URL type
  const dbUrl = env.DATABASE_URL as string | undefined;
  if (dbUrl) {
    const isAccelerate = dbUrl.startsWith('prisma://') || dbUrl.startsWith('prisma+postgres://');
    const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
    diagnostics.dbUrlType = isAccelerate ? 'accelerate' : isPostgres ? 'direct-postgres' : 'unknown';
    if (isPostgres) {
      diagnostics.warning = 'Direct PostgreSQL URLs do not work on Cloudflare Workers (no TCP). Use Prisma Accelerate.';
    }
  } else {
    diagnostics.dbUrlType = 'missing';
  }

  // 3. Test database connection (skip if DATABASE_URL missing — createEdgePrismaClient would throw)
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;
  if (!dbUrl) {
    diagnostics.prismaClientCreated = false;
    diagnostics.dbConnected = false;
    diagnostics.dbError = 'DATABASE_URL is missing';
  } else {
    try {
      prisma = createEdgePrismaClient(dbUrl);
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
      if (prisma) await safePrismaDisconnect(prisma);
    }
  }

  // 4. Clerk key format
  const clerkKey = env.CLERK_SECRET_KEY as string | undefined;
  if (clerkKey) {
    diagnostics.clerkKeyType = clerkKey.startsWith('sk_test_') ? 'test' : clerkKey.startsWith('sk_live_') ? 'live' : 'unknown-format';
  }

  const allGood = diagnostics.dbConnected === true;

  return new Response(
    JSON.stringify({ status: allGood ? 'healthy' : 'unhealthy', diagnostics }, null, 2),
    {
      status: allGood ? 200 : 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    }
  );
};
