import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const BuzzwordsRandomSchema = z.object({
  query: z.object({
    count: z.string().regex(/^\d+$/, 'Count must be a positive integer').default('10'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(BuzzwordsRandomSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/buzzwords/random');
  const { count } = validated.query;

  // Validate count range
  const countValue = Math.min(Math.max(parseInt(count, 10), 1), 50); // Limit to 1-50

  if (!env.DATABASE_URL) {
    logger.error('Database not configured');
    throw new Error('Database not configured');
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Use raw query for random selection
    // Note: RANDOM() is PostgreSQL specific. If using MySQL/SQLite, syntax differs.
    const buzzwords = await prisma.$queryRaw`
      SELECT * FROM "Buzzword"
      ORDER BY RANDOM()
      LIMIT ${countValue}
    `;

    logger.info(`Fetched ${buzzwords.length} random buzzwords`, { count: countValue });
    return { data: buzzwords };
  } catch (error: any) {
    logger.error('Error fetching random buzzwords', {
      error: error.message,
      count: countValue,
    });
    throw new Error('Failed to fetch random buzzwords');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
