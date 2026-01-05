import { PrismaClient } from '@prisma/client';
import type { Context } from 'hono';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface CurationRequest {
  action: 'approve' | 'delete' | 'update';
  questionId: string;
  question?: any; // Full question object for updates
}

// This function promotes a question from PreGeneratedQuestion to the main Question table
async function approveQuestion(prisma: PrismaClient, questionId: string) {
  const preGenQuestion = await prisma.preGeneratedQuestion.findUnique({
    where: { id: questionId },
  });

  if (!preGenQuestion) {
    throw new Error('Question to approve not found.');
  }

  // Use a transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // Create the new question in the main table
    const newQuestion = await tx.question.create({
      data: {
        question: preGenQuestion.question,
        options: preGenQuestion.options,
        correctAnswerIndex: preGenQuestion.correctAnswerIndex,
        rationale: preGenQuestion.rationale,
        pearls: preGenQuestion.pearls,
        topic: preGenQuestion.topic,
        system: preGenQuestion.system,
        condition: preGenQuestion.condition,
        source: `CURATED_${preGenQuestion.source || 'UNKNOWN'}`,
        imageUrl: preGenQuestion.imageUrl,
        medicalContentId: preGenQuestion.medicalContentId,
      },
    });

    // Delete the question from the pre-generated pool
    await tx.preGeneratedQuestion.delete({
      where: { id: questionId },
    });

    return newQuestion;
  });
}

// This function deletes a question from the PreGeneratedQuestion pool
async function deleteQuestion(prisma: PrismaClient, questionId: string) {
  return prisma.preGeneratedQuestion.delete({
    where: { id: questionId },
  });
}

// This function updates a question in the PreGeneratedQuestion pool
async function updateQuestion(prisma: PrismaClient, questionId: string, questionData: any) {
    // Basic validation
    if (!questionData || typeof questionData.question !== 'string' || !Array.isArray(questionData.options)) {
        throw new Error('Invalid question data provided for update.');
    }

    return prisma.preGeneratedQuestion.update({
        where: { id: questionId },
        data: {
            question: questionData.question,
            options: questionData.options,
            correctAnswerIndex: questionData.correctAnswerIndex,
            rationale: questionData.rationale,
            pearls: questionData.pearls,
            topic: questionData.topic,
            system: questionData.system,
            condition: questionData.condition,
        },
    });
}


export const onRequestPost = async (context: Context) => {
  const { env } = context;
  const auth = await authenticateRequest(context.req, env);
  if (!auth.user || auth.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { action, questionId, question }: CurationRequest = await context.req.json();

    if (!action || !questionId) {
      return new Response(JSON.stringify({ error: 'Missing action or questionId' }), { status: 400 });
    }

    let result;
    switch (action) {
      case 'approve':
        result = await approveQuestion(prisma, questionId);
        break;
      case 'delete':
        result = await deleteQuestion(prisma, questionId);
        break;
      case 'update':
        result = await updateQuestion(prisma, questionId, question);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error during question curation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: 'Curation failed', details: errorMessage }), { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
};
