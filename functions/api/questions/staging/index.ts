import { adminEndpoint } from '../../_shared/middleware';
import { z } from 'zod';

// Schema for staging question data
const StagingQuestionSchema = z.object({
  questionData: z.record(z.string(), z.any()),
});

export const onRequestPost = adminEndpoint(StagingQuestionSchema, async ({ env, validated }) => {
  const { createEdgePrismaClient, safePrismaDisconnect } = await import('../../_shared/prisma-edge');
  const { saveToStaging } = await import('../../_shared/staging-questions');

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const question = await saveToStaging(prisma, validated.questionData);
    return { status: 200, data: { success: true, stagingQuestion: question } };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});