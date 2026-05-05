import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserId } from '../_shared/user-resolver';
import {
  getStudyHistoryAnalytics,
  type StudyHistoryRange,
} from '../../../lib/services/studyHistoryService';

const StudyHistorySchema = z.object({
  query: z
    .object({
      range: z.enum(['7d', '30d', '90d', 'all']).optional(),
      limit: z.coerce.number().int().min(1).max(2000).optional(),
      horizonDays: z.coerce.number().int().min(1).max(30).optional(),
      includeRapidGuesses: z
        .union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])
        .optional(),
    })
    .optional(),
});

export const onRequestGet = authenticatedEndpoint(
  StudyHistorySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/user/study-history');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const userId = await resolveOrCreateUserId(prisma, auth.userId);
      const query = validated.query ?? {};
      const data = await getStudyHistoryAnalytics(prisma, userId, {
        range: (query.range ?? '30d') as StudyHistoryRange,
        limit: query.limit,
        horizonDays: query.horizonDays,
        includeRapidGuesses: query.includeRapidGuesses,
      });

      logger.info('Fetched study history analytics', {
        userId: userId.substring(0, 10),
        range: query.range ?? '30d',
        reviewCount: data.reviewCount,
        upcomingReviews: data.upcomingReviews.length,
      });

      return { data };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
