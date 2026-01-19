import { adminEndpoint } from '../../_shared/middleware';
import { z } from 'zod';

// Schema for creating a question seed
const QuestionSeedSchema = z.object({
  conditionId: z.string().min(1).max(100),
  questionType: z.string().min(1).max(50),
  corePathology: z.string().min(1).max(500),
  variables: z.record(z.string(), z.any()),
  template: z.string().min(1).max(2000),
  correctAnswer: z.string().min(1).max(500),
  explanation: z.string().min(1).max(2000),
  distractors: z.array(z.string().min(1).max(500)),
  difficulty: z.string().min(1).max(50),
  system: z.string().max(100).optional(),
});

export const onRequestPost = adminEndpoint(QuestionSeedSchema, async ({ env, validated }) => {
  const { createEdgePrismaClient, safePrismaDisconnect } = await import('../../_shared/prisma-edge');
  const { createQuestionSeed } = await import('../../_shared/question-seeds');

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const seed = await createQuestionSeed(prisma, validated);
    return { status: 200, data: { success: true, seed } };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});