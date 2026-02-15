/**
 * GET /api/admin/staging/list
 * List Staging Lake: fetch StagingQuestion items (default: status = 'pending').
 * Query: ?status=pending|graded|rejected|all&limit=50
 */

import { z } from 'zod';
import {
  withMiddleware,
  withCors,
  withAuth,
  withAdminRole,
  withErrorHandling,
  withEnvCheck,
} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const QuerySchema = z.object({
  status: z
    .enum(['pending', 'graded', 'rejected', 'approved', 'all'])
    .optional()
    .default('pending'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const onRequestOptions = withCors();

export const onRequestGet = withMiddleware(
  withCors(),
  withErrorHandling(),
  withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
  withAuth(),
  withAdminRole(),
  async (context: any) => {
    const { env, request, auth } = context;
    const log = createEndpointLogger('/api/admin/staging/list', auth?.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      status: url.searchParams.get('status') ?? 'pending',
      limit: url.searchParams.get('limit') ?? 50,
    });
    const status = parsed.success ? parsed.data.status : 'pending';
    const limit = parsed.success ? parsed.data.limit : 50;

    try {
      const where = status === 'all' ? {} : { status };

      const items = await prisma.stagingQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          system: true,
          difficulty: true,
          status: true,
          vignette: true,
          question: true,
          explanation: true,
          aiGrade: true,
          adminReview: true,
          createdAt: true,
        },
      });

      log.info('Staging list', { status, count: items.length });
      return { data: { items, count: items.length } };
    } catch (e) {
      log.error('Staging list error', e);
      return { status: 500, error: 'Failed to list staging questions' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
