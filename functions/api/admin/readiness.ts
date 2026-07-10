/**
 * GET /api/admin/readiness
 *
 * Authenticated operational readiness diagnostics. This replaces the previous
 * public `/api/health` diagnostic payload so internals are not exposed to the
 * open internet.
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { sanitizeEnvValue } from '../_shared/env-validation';

const ReadinessSchema = z.object({}).optional();

export const onRequestGet = adminAuthenticatedEndpoint(
  ReadinessSchema,
  async (context) => {
    const { env } = context;
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    const rawDbUrl = env.DATABASE_URL as string | undefined;
    const dbUrl = rawDbUrl ? sanitizeEnvValue(rawDbUrl) || undefined : undefined;
    const isAccelerate = dbUrl?.startsWith('prisma://') || dbUrl?.startsWith('prisma+postgres://');
    const isPostgres = dbUrl?.startsWith('postgresql://') || dbUrl?.startsWith('postgres://');

    const diagnostics: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      runtime: 'cloudflare-pages',
      env: {
        DATABASE_URL: Boolean(env.DATABASE_URL),
        CLERK_SECRET_KEY: Boolean(env.CLERK_SECRET_KEY),
        GEMINI_API_KEY: Boolean(env.GEMINI_API_KEY),
        RATE_LIMIT_KV: Boolean(env.RATE_LIMIT_KV),
      },
      dbUrlType: isAccelerate ? 'accelerate' : isPostgres ? 'direct-postgres' : dbUrl ? 'unknown' : 'missing',
    };

    try {
      if (!dbUrl) {
        return {
          status: 503,
          data: {
            status: 'unhealthy',
            diagnostics: {
              ...diagnostics,
              database: { status: 'fail', message: 'DATABASE_URL is missing' },
            },
          },
        };
      }

      prisma = createEdgePrismaClient(dbUrl);
      const [userCount, publishedContent] = await Promise.all([
        prisma.user.count(),
        prisma.medicalContent.findMany({
          select: { system: true },
          where: { status: 'published' },
        }),
      ]);
      const systemSet = new Set(publishedContent.map((row) => row.system).filter(Boolean));

      return {
        data: {
          status: 'healthy',
          diagnostics: {
            ...diagnostics,
            database: { status: 'pass' },
            userCount,
            contentSystemsCount: systemSet.size,
            contentConditionCount: publishedContent.length,
          },
        },
      };
    } catch (error) {
      return {
        status: 503,
        data: {
          status: 'unhealthy',
          diagnostics: {
            ...diagnostics,
            database: {
              status: 'fail',
              // leak-ok: admin-only health diagnostics intentionally surface the DB
              // error detail so an admin can diagnose an unhealthy database.
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.name : 'Unknown',
            },
          },
        },
      };
    } finally {
      if (prisma) await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
