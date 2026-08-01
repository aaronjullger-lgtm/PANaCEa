import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const logger = createEndpointLogger('/api/admin/content-gaps');

export const onRequestGet = adminAuthenticatedEndpoint(
  z.object({
    query: z.object({
      system: z.string().optional(),
      gapType: z.string().optional(),
      resolved: z.enum(['true', 'false']).optional(),
      limit: z.coerce.number().min(1).max(200).default(50),
      offset: z.coerce.number().min(0).default(0),
    }),
  }),
  async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const url = new URL(context.request.url);
      const system = url.searchParams.get('system') || undefined;
      const gapType = url.searchParams.get('gapType') || undefined;
      const resolved = url.searchParams.get('resolved');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const where: Record<string, unknown> = {};
      if (system) where.system = system;
      if (gapType) where.gapType = gapType;
      if (resolved === 'true') where.resolvedAt = { not: null };
      if (resolved === 'false') where.resolvedAt = null;

      const [gaps, total, bySystem, byGapType] = await Promise.all([
        prisma.contentGap.findMany({
          where,
          orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
          take: limit,
          skip: offset,
        }),
        prisma.contentGap.count({ where }),
        prisma.contentGap.groupBy({
          by: ['system'],
          _count: true,
          _avg: { severity: true },
          where: where.resolvedAt === undefined ? { resolvedAt: null } : undefined,
          orderBy: { _count: { system: 'desc' } },
          take: 10,
        }),
        prisma.contentGap.groupBy({
          by: ['gapType'],
          _count: true,
          where: where.resolvedAt === undefined ? { resolvedAt: null } : undefined,
          orderBy: { _count: { gapType: 'desc' } },
        }),
      ]);

      logger.info('Content gaps queried', { total, limit, offset });

      return {
        data: {
          gaps,
          aggregation: {
            bySystem: bySystem.map((s) => ({
              system: s.system,
              count: s._count,
              avgSeverity: s._avg.severity ?? 0,
            })),
            byGapType: byGapType.map((g) => ({
              gapType: g.gapType,
              count: g._count,
            })),
          },
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + gaps.length < total,
          },
        },
      };
    } catch (error) {
      logger.error('Error fetching content gaps', error);
      return { status: 500, error: 'Failed to fetch content gaps' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
