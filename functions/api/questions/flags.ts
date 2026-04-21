/**
 * GET /api/questions/flags
 * Admin endpoint to view question flags for quality review
 */

import { z } from 'zod';
import { adminEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const FlagsSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
  }),
});

export const onRequestGet = adminEndpoint(FlagsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/flags');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const status = validated.query?.status;
    const priority = validated.query?.priority;

    const flags = await prisma.questionFlag.findMany({
      where: {
        ...(status && { status }),
        ...(priority && { priority }),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    logger.info('Admin fetched question flags', { userId: auth.userId, flagCount: flags.length });

    return { data: { success: true, flags } };
  } catch (error) {
    logger.error('Failed to get flags', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to get flags');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
