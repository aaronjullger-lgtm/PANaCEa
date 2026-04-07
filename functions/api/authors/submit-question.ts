import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateNewQuestion } from '../_shared/aiQuestionService';

/**
 * POST /api/authors/submit-question
 * Submit a new question for review and publication
 *
 * Request body:
 * - question: string - The question text
 * - options: string[] - Multiple choice options (4-5 options)
 * - correctAnswer: number - Index of correct option (0-based)
 * - explanation: string - Explanation for the correct answer
 * - system: string - Medical system (e.g., "Cardiovascular")
 * - conditionId: string - Related condition ID
 * - vignette?: string - Clinical case vignette (optional)
 * - difficulty?: "easy" | "medium" | "hard" - Expected difficulty
 */

const SubmitQuestionSchema = z.object({
  body: z.object({
    question: z.string().min(1),
    options: z.array(z.string()).min(4).max(5),
    correctAnswer: z.number().int().min(0),
    explanation: z.string().min(1),
    system: z.string().min(1),
    conditionId: z.string().min(1),
    vignette: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  SubmitQuestionSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const userId = auth.userId;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const body = (validated as any).body;

    try {
      // Get or create author profile
      let author = await prisma.contentAuthor.findUnique({
        where: { userId },
      });

      if (!author) {
        author = await prisma.contentAuthor.create({
          data: {
            userId,
            role: 'CONTRIBUTOR',
          },
        });
      }

      // Only CONTRIBUTOR role and above can submit
      const roleHierarchy = { CONTRIBUTOR: 0, REVIEWER: 1, EDITOR: 2, ADMIN: 3 };
      if (roleHierarchy[author.role as keyof typeof roleHierarchy] === undefined) {
        return { status: 400, data: { error: 'Invalid author role' } };
      }

      // Validate correct answer index against options length
      if (body.correctAnswer >= body.options.length) {
        return {
          status: 400,
          data: { error: `correctAnswer must be between 0 and ${body.options.length - 1}` },
        };
      }

      // Verify condition exists
      const condition = await prisma.condition.findUnique({
        where: { id: body.conditionId },
        select: { id: true, system: true },
      });

      if (!condition) {
        return { status: 404, data: { error: 'Condition not found' } };
      }

      if (condition.system !== body.system) {
        return {
          status: 400,
          data: { error: "System does not match the condition's system" },
        };
      }

      // Run validation checks — pass Edge-safe prisma client
      const validation = await validateNewQuestion({
        question: body.question,
        options: body.options,
        correctAnswer: body.correctAnswer,
        explanation: body.explanation,
        system: body.system,
        conditionId: body.conditionId,
        vignette: body.vignette,
        difficulty: body.difficulty,
      }, prisma);

      // Create the submission record
      const submission = await prisma.questionSubmission.create({
        data: {
          contentAuthorId: author.id,
          question: body.question,
          options: body.options,
          correctAnswer: body.correctAnswer,
          explanation: body.explanation,
          system: body.system,
          conditionId: body.conditionId,
          vignette: body.vignette || null,
          status: 'submitted',
          passedDuplicateCheck: !validation.isDuplicate,
          matchesBlueprintGap: validation.coversGap,
          estimatedDifficulty: validation.estimatedDifficulty,
          estimatedHealthScore: validation.estimatedHealthScore,
          reviewComments: null,
        },
      });

      // Update author's submission count
      await prisma.contentAuthor.update({
        where: { id: author.id },
        data: {
          questionsCreated: { increment: 1 },
        },
      });

      return {
        status: 201,
        data: {
          submissionId: submission.id,
          status: submission.status,
          validationResults: {
            isDuplicate: validation.isDuplicate,
            duplicateOf: validation.duplicateOf,
            coversGap: validation.coversGap,
            estimatedDifficulty: validation.estimatedDifficulty,
            estimatedHealthScore: validation.estimatedHealthScore,
          },
          message: validation.isDuplicate
            ? 'Submission created but flagged as potential duplicate. A reviewer will investigate.'
            : validation.coversGap
              ? 'Submission created and covers an identified blueprint gap. Expedited review recommended.'
              : 'Submission created and queued for reviewer approval.',
        },
      };
    } catch (error) {
      return {
        status: 500,
        data: { error: 'Failed to submit question' },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
