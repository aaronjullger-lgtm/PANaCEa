import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest, QuestionFeedbackSchema } from '../_shared/schemas';
import type { CloudflareEnv, CloudflareContext } from '../_shared/types';

export const onRequestPost = async (context: CloudflareContext<CloudflareEnv>) => {
  const { env, request } = context;
  const auth = await authenticateRequest(request, env);
  if (!auth?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate request body with Zod schema
  const validation = await validateRequest(request, QuestionFeedbackSchema);
  if (!validation.success) {
    return (validation as { success: false; response: Response }).response;
  }

  const { questionId, flagType, description, questionText, topic, system } = validation.data;

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const feedback = await prisma.feedback.create({
      data: {
        userId: auth.user.id,
        questionId,
        type: flagType,
        description,
        status: 'new',
        priority: flagType === 'incorrect_fact' ? 'high' : 'medium',
        context: {
          questionText,
          topic,
          system,
        },
      },
    });

    return new Response(JSON.stringify({ success: true, feedbackId: feedback.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: 'Feedback submission failed', details: errorMessage }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
};
