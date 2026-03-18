import { Request } from '@cloudflare/workers-types';
import { requireAuth } from '../_shared/auth';
import { errorHandler } from '../_shared/error-handler';
import { prisma } from '../_shared/prisma-edge';
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
 *
 * Returns:
 * - submissionId: string - ID of the submission
 * - status: "submitted" - Initial submission status
 * - validationResults: Object with:
 *   - isDuplicate: boolean
 *   - duplicateOf?: string - ID of duplicate question if found
 *   - coversGap: boolean
 *   - estimatedDifficulty: string
 *   - estimatedHealthScore: number
 * - message: string - Next steps for reviewer queue
 */
export async function onRequestPost(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);

    // Get or create author profile
    let author = await prisma.contentAuthor.findUnique({
      where: { userId: user.id },
    });

    if (!author) {
      author = await prisma.contentAuthor.create({
        data: {
          userId: user.id,
          role: 'CONTRIBUTOR',
        },
      });
    }

    // Only CONTRIBUTOR role and above can submit
    const roleHierarchy = { CONTRIBUTOR: 0, REVIEWER: 1, EDITOR: 2, ADMIN: 3 };
    if (!roleHierarchy[author.role] !== undefined) {
      return new Response(
        JSON.stringify({ error: 'Invalid author role' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json() as {
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
      system: string;
      conditionId: string;
      vignette?: string;
      difficulty?: string;
    };

    // Validate required fields
    if (!body.question || !body.options || body.correctAnswer === undefined || !body.explanation || !body.system || !body.conditionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: question, options, correctAnswer, explanation, system, conditionId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate options array
    if (!Array.isArray(body.options) || body.options.length < 4 || body.options.length > 5) {
      return new Response(
        JSON.stringify({ error: 'Options must be an array of 4-5 items' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate correct answer index
    if (body.correctAnswer < 0 || body.correctAnswer >= body.options.length) {
      return new Response(
        JSON.stringify({ error: `correctAnswer must be between 0 and ${body.options.length - 1}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify condition exists
    const condition = await prisma.condition.findUnique({
      where: { id: body.conditionId },
      select: { id: true, system: true },
    });

    if (!condition) {
      return new Response(
        JSON.stringify({ error: 'Condition not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (condition.system !== body.system) {
      return new Response(
        JSON.stringify({ error: 'System does not match the condition\'s system' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Run validation checks
    const validation = await validateNewQuestion({
      question: body.question,
      options: body.options,
      correctAnswer: body.correctAnswer,
      explanation: body.explanation,
      system: body.system,
      conditionId: body.conditionId,
      vignette: body.vignette,
      difficulty: body.difficulty,
    });

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

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return errorHandler(error);
  }
}
