import { adminEndpoint, withCors} from '../../_shared/middleware';
import { z } from 'zod';

// Schema for staging question data
const StagingQuestionSchema = z.object({
  questionData: z.record(z.string(), z.unknown()),
});

export const onRequestOptions = withCors();

export const onRequestPost = adminEndpoint(StagingQuestionSchema, async ({ env, validated }) => {
  const { createEdgePrismaClient, safePrismaDisconnect } =
    await import('../../_shared/prisma-edge');
  const { saveToStaging } = await import('../../_shared/staging-questions');

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const question = await saveToStaging(prisma, validated.questionData);
    return { status: 200, data: { success: true, stagingQuestion: question } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Invalid staging question payload:')) {
      return { status: 400, error: message };
    }
    throw error;
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
