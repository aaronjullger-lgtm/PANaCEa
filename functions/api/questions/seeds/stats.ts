import { adminEndpoint } from '../../_shared/middleware';
import { z } from 'zod';

// Empty schema for GET endpoint (no body)
const EmptySchema = z.object({});

export const onRequestGet = adminEndpoint(EmptySchema, async ({ env }) => {
  const { createEdgePrismaClient, safePrismaDisconnect } = await import('../../_shared/prisma-edge');
  const { getSeedStats } = await import('../../_shared/question-seeds');

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const stats = await getSeedStats(prisma);
    return { status: 200, data: { success: true, stats } };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});