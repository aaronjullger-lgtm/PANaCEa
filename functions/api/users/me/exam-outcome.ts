import { Request } from '@cloudflare/workers-types';
import { requireAuth } from '../../_shared/auth';
import { errorHandler } from '../../_shared/error-handler';
import { recordExamOutcome } from '../../_shared/outcomeOptimizationService';

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
 *
 * Returns:
 * - Outcome record created
 * - Comparison to user's predicted readiness
 * - Performance breakdown by system
 */
export async function onRequestPost(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);

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
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate required fields
    if (!body.examType || !body.examDate || typeof body.score !== 'number' || typeof body.passed !== 'boolean') {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['examType', 'examDate', 'score', 'passed'],
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse exam date
    const examDate = new Date(body.examDate);
    if (isNaN(examDate.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Invalid exam date' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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

    return new Response(
      JSON.stringify({
        success: true,
        outcomId: outcome.id,
        examType: body.examType,
        score: body.score,
        passed: body.passed,
        message: 'Exam outcome recorded. System predictiveness will be updated in the next analysis run.',
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
