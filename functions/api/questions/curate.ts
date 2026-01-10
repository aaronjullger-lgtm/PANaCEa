/**
 * Question Curation API
 * 
 * Admin endpoint for approving, rejecting, and updating pre-generated questions.
 * Requires admin role to access.
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest, IDSchema } from '../_shared/schemas';
import { z } from 'zod';

interface PagesContext {
  request: Request;
  env: Env;
}

// Zod schema for question curation
const CurationRequestSchema = z.object({
  action: z.enum(['approve', 'delete', 'update']),
  questionId: IDSchema,
  question: z.object({
    question: z.string().min(1).max(5000),
    options: z.array(z.string().max(500)).length(4),
    correctAnswerIndex: z.number().int().min(0).max(3),
    rationale: z.string().max(5000),
    system: z.string().max(100).optional(),
    difficulty: z.string().max(20).optional(),
  }).optional(),
});

type CurationRequest = z.infer<typeof CurationRequestSchema>;

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * POST: Curate a question (approve, delete, update)
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

    // Validate input with Zod schema
    const validation = await validateRequest(context.request.clone(), CurationRequestSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { questionId, action, question: updatedQuestion } = (validation as { success: true; data: CurationRequest }).data;

    // Fetch the pre-generated question
    const preGenQuestion = await prisma.preGeneratedQuestion.findUnique({
      where: { id: questionId },
    });

    if (!preGenQuestion) {
      return createErrorResponse('Question not found', 404);
    }

    switch (action) {
      case 'approve': {
        // Move question from pre-generated pool to main Question table
        const questionData = preGenQuestion.questionData as Record<string, unknown>;
        
        await prisma.question.create({
          data: {
            id: crypto.randomUUID(),
            vignette: (questionData.question || questionData.vignette || '') as string,
            options: (questionData.options || []) as string[],
            correctAnswerIndex: (questionData.correctAnswerIndex ?? 0) as number,
            rationale: (questionData.explanation || questionData.rationale || '') as string,
            system: preGenQuestion.system || 'General',
            condition: (questionData.condition || null) as string | null,
            conditionId: preGenQuestion.conditionId,
            difficulty: preGenQuestion.difficulty,
            medicalContentId: preGenQuestion.medicalContentId,
            source: 'curated',
            createdAt: new Date(),
          },
        });

        // Delete from pre-generated pool
        await prisma.preGeneratedQuestion.delete({
          where: { id: questionId },
        });

        return createSuccessResponse({
          success: true,
          message: 'Question approved and moved to main pool',
        });
      }

      case 'delete': {
        await prisma.preGeneratedQuestion.delete({
          where: { id: questionId },
        });

        return createSuccessResponse({
          success: true,
          message: 'Question deleted',
        });
      }

      case 'update': {
        if (!updatedQuestion) {
          return createErrorResponse('Missing question data for update', 400);
        }

        const existingData = preGenQuestion.questionData as Record<string, unknown>;
        
        await prisma.preGeneratedQuestion.update({
          where: { id: questionId },
          data: {
            questionData: {
              ...existingData,
              question: updatedQuestion.question,
              vignette: updatedQuestion.question,
              options: updatedQuestion.options,
              correctAnswerIndex: updatedQuestion.correctAnswerIndex,
              rationale: updatedQuestion.rationale,
              explanation: updatedQuestion.rationale,
            },
            system: updatedQuestion.system || preGenQuestion.system,
            difficulty: updatedQuestion.difficulty || preGenQuestion.difficulty,
          },
        });

        return createSuccessResponse({
          success: true,
          message: 'Question updated',
        });
      }

      default:
        return createErrorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[CurateAPI] Error:', error);
    return createErrorResponse('Failed to curate question', 500);
  } finally {
    await prisma.$disconnect();
  }
}
