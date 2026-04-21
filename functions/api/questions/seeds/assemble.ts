import { adminEndpoint, withCors} from '../../_shared/middleware';
import { z } from 'zod';

// Zod schema for assemble request
const AssembleRequestSchema = z.object({
  filter: z
    .object({
      system: z.string().optional(),
      difficulty: z.string().optional(),
      type: z.string().optional(),
    })
    .optional()
    .default({}),
  count: z.number().int().min(1).max(100).optional().default(10),
});

export const onRequestOptions = withCors();

export const onRequestPost = adminEndpoint(AssembleRequestSchema, async ({ env, validated }) => {
  const { createEdgePrismaClient, safePrismaDisconnect } =
    await import('../../_shared/prisma-edge');
  const { assembleQuestionsFromSeeds } = await import('../../_shared/question-seeds');

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const questions = await assembleQuestionsFromSeeds(
      prisma,
      validated.filter || {},
      validated.count || 10
    );
    return { status: 200, data: { success: true, questions } };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
