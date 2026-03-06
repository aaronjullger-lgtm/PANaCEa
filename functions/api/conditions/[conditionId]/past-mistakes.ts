/**
 * GET /api/conditions/:conditionId/past-mistakes
 *
 * Returns the user's past wrong answers for this condition, with question stub,
 * user's selected answer, and correct rationale. Uses QuestionAttempt + PreGeneratedQuestion.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

const PastMistakesSchema = z.object({
  conditionId: z.string().min(1).max(200),
});

function getOptionText(
  options: Array<{ value?: string; text?: string; label?: string } | string> | undefined,
  letter: string
): string {
  if (!Array.isArray(options) || options.length === 0) return letter;
  const idx = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  if (idx < 0 || idx >= options.length) return letter;
  const opt = options[idx];
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object') {
    return (opt.text ?? opt.value ?? opt.label ?? letter) as string;
  }
  return letter;
}

function getRationale(data: Record<string, unknown>): string {
  const val =
    (data.rationale as string) ??
    (data.explanation as string) ??
    (typeof data.explanation === 'object' && data.explanation !== null
      ? (data.explanation as { text?: string }).text
      : null);
  return typeof val === 'string' ? val : '';
}

function getQuestionStub(data: Record<string, unknown>): string {
  const val =
    (data.question as string) ??
    (data.stem as string) ??
    (data.vignette as string) ??
    (data.text as string);
  if (typeof val === 'string') {
    return val.length > 200 ? val.slice(0, 200) + '...' : val;
  }
  return '';
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  PastMistakesSchema,
  async (context) => {
    const { env, auth, validated, request } = context;
    const logger = createEndpointLogger('/api/conditions/[conditionId]/past-mistakes');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const conditionId = decodeURIComponent(validated.conditionId).trim();
      const url = new URL(request.url);
      const limitParam = url.searchParams.get('limit');
      const limit = Math.min(Number.parseInt(limitParam || '10', 10) || 10, 20);

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { data: { error: 'User not found', items: [] }, status: 404 };
      }

      // Resolve conditionId (slug or name) to Condition.id(s) for QuestionAttempt.conditionId
      const conditionIds: string[] = [conditionId];

      const mc = await prisma.medicalContent.findFirst({
        where: {
          OR: [
            { conditionId: { equals: conditionId, mode: 'insensitive' } },
            { condition: { equals: conditionId, mode: 'insensitive' } },
          ],
          status: 'published',
        },
        select: { condition: true },
      });

      if (mc?.condition) {
        const cond = await prisma.condition.findFirst({
          where: {
            OR: [
              { name: { equals: mc.condition, mode: 'insensitive' } },
              { aliases: { has: conditionId } },
            ],
          },
          select: { id: true },
        });
        if (cond && !conditionIds.includes(cond.id)) conditionIds.push(cond.id);
      }

      const condById = await prisma.condition.findFirst({
        where: { id: conditionId },
        select: { id: true },
      });
      if (condById && !conditionIds.includes(condById.id)) conditionIds.push(condById.id);

      const attempts = await prisma.questionAttempt.findMany({
        where: {
          userId: user.id,
          conditionId: { in: conditionIds },
          wasCorrect: false,
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
        select: {
          id: true,
          questionId: true,
          selectedAnswer: true,
          createdAt: true,
        },
      });

      const questionIds = [...new Set(attempts.map((a) => a.questionId))];
      const questions = await prisma.preGeneratedQuestion.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, questionData: true },
      });

      const questionMap = new Map(questions.map((q) => [q.id, q.questionData as Record<string, unknown>]));
      const seenQuestionIds = new Set<string>();
      const items: Array<{
        questionId: string;
        questionStub: string;
        userAnswer: string;
        correctRationale: string;
        createdAt: string;
      }> = [];

      for (const a of attempts) {
        if (seenQuestionIds.has(a.questionId)) continue;
        seenQuestionIds.add(a.questionId);

        const qData = questionMap.get(a.questionId);
        if (!qData || typeof qData !== 'object') continue;

        const options = (qData.options ?? qData.choices ?? qData.answers) as
          | Array<{ value?: string; text?: string; label?: string } | string>
          | undefined;
        const selectedLetter = a.selectedAnswer ?? '?';
        const userAnswer = getOptionText(options, selectedLetter);
        const questionStub = getQuestionStub(qData);
        const correctRationale = getRationale(qData);

        if (!questionStub && !correctRationale) continue;

        items.push({
          questionId: a.questionId,
          questionStub: questionStub || 'Question',
          userAnswer,
          correctRationale: correctRationale || 'No rationale available',
          createdAt: a.createdAt.toISOString(),
        });

        if (items.length >= limit) break;
      }

      logger.info('Past mistakes returned', {
        conditionId,
        userId: user.id.substring(0, 8),
        count: items.length,
      });

      return {
        data: { items },
      };
    } catch (error) {
      logger.error('Past mistakes error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch past mistakes');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
