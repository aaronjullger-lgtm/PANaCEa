import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const BuzzwordsAllSchema = z.object({
  query: z.object({}).optional(), // No query params expected
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(BuzzwordsAllSchema, async (context) => {
  const { env } = context;
  const logger = createEndpointLogger('/api/buzzwords/all');

  if (!env.DATABASE_URL) {
    logger.error('Database not configured');
    throw new Error('Database not configured');
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Fetch all buzzwords
    const buzzwords = await prisma.buzzword.findMany({
      orderBy: { condition: 'asc' },
    });

    logger.info(`Fetched ${buzzwords.length} buzzwords`);
    return {
      data: buzzwords,
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    };
  } catch (error) {
    logger.error('Error fetching buzzwords', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch buzzwords');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
