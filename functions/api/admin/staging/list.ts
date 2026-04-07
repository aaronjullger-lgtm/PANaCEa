/**
 * GET /api/admin/staging/list
 * List Staging Lake: fetch StagingQuestion items (default: status = 'pending').
 * Query: ?status=pending|graded|rejected|all&limit=50
 *
 * Security: adminEndpoint() middleware with rate limiting, auth, Zod validation, and logging.
 * Audit: Logs access via auditLog('admin_staging_list').
 */

import { z } from 'zod';
import { adminEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { auditLog } from '../../_shared/auditLog';

const QuerySchema = z.object({
  status: z
    .enum(['pending', 'graded', 'rejected', 'approved', 'all'])
    .optional()
    .default('pending'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const onRequestGet = adminEndpoint(
  QuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { status, limit } = validated;
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

      auditLog('admin_staging_list', {
        userId: auth.userId,
        status,
        count: items.length,
      });

      return { data: { items, count: items.length } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      auditLog('admin_staging_list', {
        userId: auth.userId,
        error: message,
      });
      return { status: 500, error: 'Failed to list staging questions' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
