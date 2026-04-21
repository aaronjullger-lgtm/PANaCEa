import { z } from 'zod';
import { authenticatedEndpoint, withCors} from '../../_shared/middleware';
import { recordExamOutcome } from '../../_shared/outcomeOptimizationService';
import { prisma } from '../../_shared/prisma-edge';

/**
 * POST /api/users/me/exam-outcome
 * Record an exam outcome and correlate with study data.
 *
 * Request body:
 * {
 *   examType: "PANCE" | "PANRE" | "EOR" | "block-exam"
 *   examDate: ISO date string
 *   score: number (0-100 percentile-like)
 *   passed: boolean
 *   percentile?: number (0-100)
 *   timeLimit?: number (seconds)
 *   timeUsed?: number (seconds)
 * }
 */

const ExamOutcomeSchema = z.object({
  body: z.object({
    examType: z.enum(['PANCE', 'PANRE', 'EOR', 'block-exam']),
    examDate: z
      .string()
      .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Invalid exam date'),
    score: z.number().min(0).max(100),
    passed: z.boolean(),
    percentile: z.number().min(0).max(100).optional(),
    // Seconds; cap at 24h so malformed input can't pollute analytics.
    timeLimit: z.number().int().min(0).max(24 * 60 * 60).optional(),
    timeUsed: z.number().int().min(0).max(24 * 60 * 60).optional(),
  }),
});

export type ExamOutcomeRequest = z.infer<typeof ExamOutcomeSchema>;

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  ExamOutcomeSchema,
  async (context) => {
    const userId = context.auth.userId;
    const {
      examType,
      examDate,
      score,
      passed,
      percentile,
      timeLimit,
      timeUsed,
    } = context.validated.body;

    // Look up internal user ID from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    const parsedExamDate = new Date(examDate);

    // Record the outcome
    const outcome = await recordExamOutcome(user.id, {
      examType,
      examDate: parsedExamDate,
      score,
      passed,
      percentile,
      timeLimit,
      timeUsed,
    });

    return {
      status: 201,
      data: {
        success: true,
        outcomeId: outcome.id,
        examType,
        score,
        passed,
        message:
          'Exam outcome recorded. System predictiveness will be updated in the next analysis run.',
      },
    };
  },
  { requestsPerMinute: 30 }
);
