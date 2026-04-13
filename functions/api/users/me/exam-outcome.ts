import {
  withMiddleware,
  withCors,
  withErrorHandling,
  withEnvCheck,
  withAuth,
  withRateLimit,
  withLogging,
  type AuthenticatedContext,
} from '../../_shared/middleware';
import { recordExamOutcome } from '../../_shared/outcomeOptimizationService';
import { prisma } from '../../_shared/prisma-edge';

/**
 * POST /api/users/me/exam-outcome
 * Record an exam outcome and correlate with study data
 *
 * Request body:
 * {
 *   examType: "PANCE" | "PANRE" | "EOR" | "block-exam"
 *   examDate: ISO date string
 *   score: number (0-100 or percentile)
 *   passed: boolean
 *   percentile?: number
 *   timeLimit?: number (seconds)
 *   timeUsed?: number (seconds)
 * }
 */export const onRequestPost = withMiddleware(
  withCors(),
  withErrorHandling(),
  withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
  withAuth(),
  withRateLimit({ requestsPerMinute: 30, endpointType: 'api', keyPrefix: 'exam-outcome' }),
  withLogging(),
  async (context: AuthenticatedContext) => {
    const userId = context.auth.userId;

    // Look up internal user ID from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Parse request body
    let body: {
      examType: string;
      examDate: string;
      score: number;
      passed: boolean;
      percentile?: number;
      timeLimit?: number;
      timeUsed?: number;
    };
    try {
      body = await context.request.json();
    } catch {
      return { status: 400, error: 'Invalid JSON in request body' };
    }

    // Validate required fields
    if (!body.examType || !body.examDate || typeof body.score !== 'number' || typeof body.passed !== 'boolean') {
      return {
        status: 400,
        error: 'Missing required fields: examType, examDate, score, passed',
      };
    }

    // Parse exam date
    const examDate = new Date(body.examDate);
    if (isNaN(examDate.getTime())) {
      return { status: 400, error: 'Invalid exam date' };
    }

    // Record the outcome
    const outcome = await recordExamOutcome(user.id, {
      examType: body.examType,
      examDate,
      score: body.score,
      passed: body.passed,
      percentile: body.percentile,
      timeLimit: body.timeLimit,
      timeUsed: body.timeUsed,
    });
    return {
      status: 201,
      data: {
        success: true,
        outcomeId: outcome.id,
        examType: body.examType,
        score: body.score,
        passed: body.passed,
        message: 'Exam outcome recorded. System predictiveness will be updated in the next analysis run.',
      },
    };
  }
);