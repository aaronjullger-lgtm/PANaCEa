import { PrismaClient } from '@prisma/client';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { CloudflareEnv, CloudflareContext } from '../_shared/types';

interface FeedbackSubmission {
  questionId: string;
  flagType: 'incorrect_fact' | 'typo' | 'confusing_options' | 'image_unclear' | 'other';
  description: string;
  // Optional context fields
  questionText?: string;
  topic?: string;
  system?: string;
}

export const onRequestPost = async (context: CloudflareContext<CloudflareEnv>) => {
  const { env, request } = context;
  const auth = await authenticateRequest(request, env);
  if (!auth?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const {
      questionId,
      flagType,
      description,
      questionText,
      topic,
      system,
    }: FeedbackSubmission = await request.json();

    if (!questionId || !flagType || !description) {
      return new Response(JSON.stringify({ error: 'Missing required feedback fields' }), { status: 400 });
    }

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
    return new Response(JSON.stringify({ error: 'Feedback submission failed', details: errorMessage }), { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
};
