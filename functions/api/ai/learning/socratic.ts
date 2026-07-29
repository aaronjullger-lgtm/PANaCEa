/**
 * POST /api/intelligence/socratic-remediation
 *
 * Socratic Remediation: Returns ONE guiding question (NOT the answer) based on
 * the student's wrong answer. Used for "Tutor Me" in Review Mode.
 *
 * Sprint 5 migration notes (AI Gateway):
 *   - Primary/fallback cascade (aiGenerateText → callAIMultiProvider) replaced
 *     by a single `gateway.tutor()` call. Same-provider tier-bump fallback is
 *     the default for 'tutoring', so resilience is preserved without the
 *     duplicate control flow here.
 *   - Gateway handles MISSING_API_KEY internally → dropped validateFunctionEnv.
 *   - Rate limiting moved from ad-hoc `withRateLimit` call to the `aiEndpoint`
 *     wrapper (default 25 req/min per user, same bucket as other AI calls).
 *   - Gateway telemetry (tokens, latency, model, provider) is emitted by the
*     gateway itself; LangSmith tracing fires per-request via LangChain.
 *   - FALLBACK_QUESTION is still surfaced when the gateway throws, so a failed
 *     Socratic turn never blocks a Review Mode session.
 */

import { z } from 'zod';
import {
  aiEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import { buildSystemPrompt } from '../../_shared/socraticZpd';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';

const BodySchema = z.object({
  body: z.object({
    questionId: z.string().min(1).max(160).optional(),
    conditionId: z.string().min(1).max(160).optional(),
    vignette: z.string().max(5000).optional().default(''),
    question: z.string().min(1),
    correctAnswer: z.string().min(1),
    userWrongAnswer: z.string().min(1),
    options: z.array(z.string()).optional(),
    history: z.array(z.object({ role: z.enum(['user', 'tutor']), text: z.string() })).optional(),
    /** Tier 3: FSRS learner state for ZPD calibration */
    fsrsState: z.object({
      retrievability: z.number().min(0).max(1),
      difficulty: z.number().min(1).max(10),
      stability: z.number().min(0),
      reviewCount: z.number().int().min(0),
      lapseCount: z.number().int().min(0),
    }).optional(),
    /** Tier 3: Current turn number for progressive hint escalation */
    turnNumber: z.number().int().min(0).optional(),
  }),
});

const FALLBACK_QUESTION =
  'What detail in the vignette suggests your answer might not fit this patient?';

type SocraticBody = z.infer<typeof BodySchema>;
type FsrsState = SocraticBody['body']['fsrsState'];
type SocraticEndpointContext = AuthenticatedContext & ValidatedContext<SocraticBody>;

const MS_PER_DAY = 86_400_000;
const FSRS_FACTOR_DEFAULT = 0.1597;
const FSRS_DECAY_DEFAULT = -2.27;

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstFinite(...values: unknown[]): number | null {
  for (const value of values) {
    const finite = finiteNumber(value);
    if (finite !== null) return finite;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateCurrentRetrievability(
  stability: unknown,
  lastReview: unknown,
  now = new Date(),
): number | null {
  const stableDays = finiteNumber(stability);
  if (!stableDays || stableDays <= 0 || !lastReview) return null;

  const reviewedAt = new Date(lastReview as string | Date);
  if (!Number.isFinite(reviewedAt.getTime())) return null;

  // Edge-local read-only mirror of lib/fsrs-retrievability.ts. This endpoint
  // uses the value only to calibrate tutor prompt depth; scheduling writes still
  // flow exclusively through drillReviewService.
  const elapsedDays = Math.max(0, (now.getTime() - reviewedAt.getTime()) / MS_PER_DAY);
  const retrievability = Math.pow(
    1 + (FSRS_FACTOR_DEFAULT * elapsedDays) / stableDays,
    FSRS_DECAY_DEFAULT,
  );

  if (!Number.isFinite(retrievability)) return null;
  return clamp(retrievability, 0, 1);
}

function buildReviewWhere(questionId?: string, conditionId?: string) {
  const clauses: Array<Record<string, string>> = [];
  if (questionId) clauses.push({ questionId });
  if (conditionId) clauses.push({ conditionId });
  return clauses.length > 0 ? clauses : null;
}

function summarizeFsrsState(input: {
  card?: Record<string, unknown> | null;
  progress?: Record<string, unknown> | null;
  reviews: Array<Record<string, unknown>>;
}): FsrsState | undefined {
  const { card, progress, reviews } = input;
  const latestReview = reviews[0];
  const reviewLapses = reviews.filter((review) => {
    const grade = finiteNumber(review.grade);
    return review.wasCorrect === false || (grade !== null && grade <= 1.5);
  }).length;

  const stability = firstFinite(card?.stability, progress?.fsrsStability, latestReview?.stability);
  const difficulty = firstFinite(card?.difficulty, progress?.fsrsDifficulty, latestReview?.difficulty);
  const reviewCount = Math.max(
    0,
    Math.round(firstFinite(card?.reps, progress?.fsrsReps, reviews.length) ?? 0),
  );
  const lapseCount = Math.max(
    0,
    Math.round(firstFinite(card?.lapses, reviewLapses) ?? reviewLapses),
  );

  if (stability === null && difficulty === null && reviewCount === 0) return undefined;

  const retrievability =
    calculateCurrentRetrievability(card?.stability, card?.last_review) ??
    calculateCurrentRetrievability(progress?.fsrsStability, progress?.lastReviewAt) ??
    firstFinite(latestReview?.retrievability) ??
    0.5;

  return {
    retrievability: clamp(retrievability, 0, 1),
    difficulty: clamp(difficulty ?? 5, 1, 10),
    stability: Math.max(0, stability ?? 0),
    reviewCount,
    lapseCount,
  };
}

async function resolveLearnerState(
  context: SocraticEndpointContext,
  questionId?: string,
  conditionId?: string,
  provided?: FsrsState,
): Promise<FsrsState | undefined> {
  if (provided || (!questionId && !conditionId)) return provided;

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: context.auth.userId },
      select: { id: true },
    });
    if (!user?.id) return undefined;

    const reviewWhere = buildReviewWhere(questionId, conditionId);
    const [cards, progressRows, reviews] = await Promise.all([
      questionId
        ? prisma.card.findMany({
            where: { userId: user.id, questionId },
            orderBy: { updatedAt: 'desc' },
            take: 3,
            select: {
              progressContext: true,
              stability: true,
              difficulty: true,
              reps: true,
              lapses: true,
              last_review: true,
            },
          })
        : Promise.resolve([]),
      conditionId
        ? prisma.userProgress.findMany({
            where: { userId: user.id, conditionId },
            orderBy: { updatedAt: 'desc' },
            take: 3,
            select: {
              progressContext: true,
              fsrsStability: true,
              fsrsDifficulty: true,
              fsrsReps: true,
              lastReviewAt: true,
            },
          })
        : Promise.resolve([]),
      reviewWhere
        ? prisma.reviewLog.findMany({
            where: {
              userId: user.id,
              review_type: 'real',
              OR: reviewWhere,
            },
            orderBy: { reviewedAt: 'desc' },
            take: 20,
            select: {
              grade: true,
              wasCorrect: true,
              stability: true,
              difficulty: true,
              retrievability: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const preferredCard =
      cards.find((card: Record<string, unknown>) => card.progressContext === 'TARGETED') ??
      cards[0] ??
      null;
    const preferredProgress =
      progressRows.find((row: Record<string, unknown>) => row.progressContext === 'TARGETED') ??
      progressRows[0] ??
      null;

    return summarizeFsrsState({
      card: preferredCard,
      progress: preferredProgress,
      reviews,
    });
  } catch (error) {
    console.warn('[socratic-remediation] learner history lookup failed', error);
    return undefined;
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
  const { validated, auth } = context;
  const {
    questionId,
    conditionId,
    vignette,
    question,
    correctAnswer,
    userWrongAnswer,
    options,
    history,
    fsrsState,
    turnNumber,
  } = validated.body;
  const learnerState = await resolveLearnerState(context, questionId, conditionId, fsrsState);

  // Build ZPD-calibrated system prompt (Tier 3) or fall back to the simple prompt.
  const systemPrompt = buildSystemPrompt(
    learnerState,
    turnNumber ?? (history?.length ?? 0),
    question.slice(0, 100),
  );

  const historyBlock =
    history && history.length > 0
      ? `\nPrior conversation:\n${history
          .map((h) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`)
          .join('\n')}\n\n`
      : '';

  const vignetteContext = vignette.trim() || question;
  const userPrompt = `Vignette:
${vignetteContext.slice(0, 3000)}

Question: ${question}
Correct answer: "${correctAnswer}"
Student's wrong answer: "${userWrongAnswer}"
${options?.length ? `All options: ${options.join(' | ')}` : ''}
${historyBlock}Generate ONE short guiding question. Do not give the answer.`;

  const maxOutputTokens = (turnNumber ?? 0) >= 3 ? 512 : 256;

  try {
    const result = await gateway.tutor(toGatewayContext(context), {
      endpoint: '/api/intelligence/socratic-remediation',
      systemPrompt,
      userPrompt,
      temperature: 0.5,
      maxOutputTokens,
    });

    if (result.blocked) {
      return { data: { guidingQuestion: FALLBACK_QUESTION } };
    }

    return {
      data: {
        guidingQuestion: result.text.trim() || FALLBACK_QUESTION,
      },
    };
  } catch (err) {
    if (err instanceof GatewayError) {
      console.error('[socratic-remediation] gateway failure', {
        code: err.code,
        requestId: err.requestId,
        traceId: err.traceId,
      });
      if (err.code === 'RATE_LIMITED') {
        return { status: 429, error: 'Rate limit exceeded' };
      }
    } else {
      console.error('[socratic-remediation] unexpected failure:', err);
    }
    // Keep review mode flowing: fall back to a generic guiding question rather
    // than surfacing a 5xx. The student still gets a Socratic nudge.
    return { data: { guidingQuestion: FALLBACK_QUESTION } };
  }
});
