import { adminEndpoint } from '../../_shared/middleware';
import { z } from 'zod';

// Zod schema for process request
const ProcessRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
});

export const onRequestPost = adminEndpoint(ProcessRequestSchema, async ({ env, validated }) => {
  const { createEdgePrismaClient, safePrismaDisconnect } =
    await import('../../_shared/prisma-edge');
  const { processStagingQueue } = await import('../../_shared/staging-questions');

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const results = await processStagingQueue(prisma, env, validated.limit);
    return { status: 200, data: { success: true, results } };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
