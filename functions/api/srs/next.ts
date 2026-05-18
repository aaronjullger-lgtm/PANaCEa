/**
 * SRS Next Item API
 * GET /api/srs/next
 *
 * Returns the next due spaced repetition item for the authenticated user
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserId } from '../_shared/user-resolver';
import { getTaskTypeFromContent } from '../../../lib/taskTypes';
import { resolveCorrectAnswerIndex } from '../../../lib/answerLetterMap';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../../../lib/services/questionServingSafety';

const SRSNextQuerySchema = z
  .object({
    mode: z.enum(['MAIN', 'CRAM', 'RAPID_RECALL']).optional(),
    progressContext: z.preprocess(
      (value) => (typeof value === 'string' ? value.toUpperCase() : value),
      z.enum(['READINESS', 'TARGETED']).optional()
    ),
    context: z.preprocess(
      (value) => (typeof value === 'string' ? value.toUpperCase() : value),
      z.enum(['READINESS', 'TARGETED']).optional()
    ),
  })
  .transform(({ mode, progressContext, context }) => ({
    mode,
    progressContext: progressContext ?? context,
  }));

type NormalizedSrsQuestion = {
  id: string;
  canonicalQuestionId: string | null;
  sourceQuestionId: string;
  questionSource: 'pre_generated' | 'question';
  questionIdentityId?: string | null;
  question: string;
  vignette?: string;
  options: string[];
  correctAnswer?: string;
  correctAnswerIndex: number;
  explanation?: string;
  conditionId?: string | null;
  medicalContentId?: string | null;
  system?: string | null;
  difficulty?: string | null;
  source: 'pre_generated' | 'question';
  rawQuestionId: string;
};

type QuestionIdentityOverrides = {
  canonicalQuestionId?: string | null;
  sourceQuestionId?: string | null;
  questionIdentityId?: string | null;
};

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((option) => String(option ?? '').trim()).filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    return Object.keys(raw as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => String((raw as Record<string, unknown>)[key] ?? '').trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSrsQuestion(
  record: any,
  source: 'pre_generated' | 'question',
  identity: QuestionIdentityOverrides = {}
): NormalizedSrsQuestion | null {
  const data =
    source === 'pre_generated' && record?.questionData && typeof record.questionData === 'object'
      ? (record.questionData as Record<string, unknown>)
      : (record as Record<string, unknown>);
  const options = normalizeOptions(data.options ?? data.answers ?? data.choices);
  const questionText = String(data.question ?? data.stem ?? data.vignette ?? '').trim();

  if (!record?.id || !questionText || options.length === 0) return null;

  const directIndex =
    typeof data.correctAnswerIndex === 'number'
      ? data.correctAnswerIndex
      : typeof data.correctIndex === 'number'
        ? data.correctIndex
        : null;
  const resolvedIndex =
    directIndex !== null && directIndex >= 0 && directIndex < options.length
      ? directIndex
      : typeof data.correctAnswer === 'string'
        ? resolveCorrectAnswerIndex(data.correctAnswer, options)
        : null;

  if (resolvedIndex === null) return null;

  return {
    id: String(record.id),
    canonicalQuestionId:
      identity.canonicalQuestionId ?? (source === 'question' ? String(record.id) : null),
    sourceQuestionId: identity.sourceQuestionId ?? String(record.id),
    questionSource: source,
    questionIdentityId: identity.questionIdentityId ?? null,
    question: questionText,
    vignette: typeof data.vignette === 'string' ? data.vignette : undefined,
    options,
    correctAnswer:
      typeof data.correctAnswer === 'string' ? data.correctAnswer : options[resolvedIndex],
    correctAnswerIndex: resolvedIndex,
    explanation:
      typeof data.explanation === 'string'
        ? data.explanation
        : typeof data.rationale === 'string'
          ? data.rationale
          : undefined,
    conditionId: record.conditionId ?? null,
    medicalContentId: record.medicalContentId ?? null,
    system: record.system ?? null,
    difficulty: record.difficulty ?? null,
    source,
    rawQuestionId: String(record.id),
  };
}

function isProductionSafeQuestionRecord(record: any): boolean {
  return record?.lifecycleStatus === 'ACTIVE' && record?.qaStatus === 'APPROVED';
}

export const onRequestGet = authenticatedEndpoint(
  SRSNextQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/srs/next');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    const mode = (validated as { mode?: string })?.mode ?? 'MAIN';
    const progressContext = (validated as { progressContext?: string })?.progressContext;
    const progressContextFilter = progressContext ? { progressContext } : {};

    // FSRS gatekeeper: OSCE and drill scheduling use their own endpoints; do not use SRS/next for them.
    if (mode === 'OSCE' || mode === 'osce' || mode === 'DRILL' || mode === 'drill') {
      return {
        data: {
          error:
            'OSCE and drill scheduling use their own endpoints. Use /api/osce/cases/random for OSCE.',
        },
        status: 400,
      };
    }

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const userId = await resolveOrCreateUserId(prisma, auth.userId);
      const now = new Date();

      const dueCards = await prisma.card.findMany({
        where: {
          userId,
          due: { lte: now },
          ...progressContextFilter,
        },
        orderBy: [{ due: 'asc' }, { difficulty: 'desc' }],
        take: 5,
        select: {
          id: true,
          questionId: true,
          questionIdentityId: true,
          progressContext: true,
          due: true,
          stability: true,
          difficulty: true,
          state: true,
          Question: {
            select: {
              id: true,
              vignette: true,
              question: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              conditionId: true,
              medicalContentId: true,
              system: true,
              difficulty: true,
              lifecycleStatus: true,
              qaStatus: true,
              taskType: true,
            },
          },
        },
      });

      for (const card of dueCards) {
        if (!isProductionSafeQuestionRecord(card.Question)) {
          logger.warn('Skipping due Card linked to non-production-safe Question', {
            userId: userId.substring(0, 10),
            cardId: card.id,
            questionId: card.questionId,
          });
          continue;
        }

        const normalizedQuestion = normalizeSrsQuestion(card.Question, 'question', {
          canonicalQuestionId: card.questionId,
          sourceQuestionId: card.questionId,
          questionIdentityId: card.questionIdentityId ?? null,
        });
        if (!normalizedQuestion) {
          logger.warn('Skipping due Card with unparseable Question', {
            userId: userId.substring(0, 10),
            cardId: card.id,
            questionId: card.questionId,
          });
          continue;
        }

        logger.info('SRS next item (Card) retrieved', {
          userId: userId.substring(0, 10),
          cardId: card.id,
          progressContext: card.progressContext,
        });

        return {
          data: {
            srsItemId: null,
            cardId: card.id,
            questionIdentityId: card.questionIdentityId ?? null,
            topicProgressId: null,
            question: normalizedQuestion,
            isVariant: false,
            progressContext: card.progressContext,
            taskType: card.Question.taskType ?? getTaskTypeFromContent(normalizedQuestion.question),
          },
        };
      }

      // Priority 1: Check for "Second Chance" variants that are due
      const dueTopics = await prisma.userTopicProgress.findMany({
        where: {
          userId,
          nextReviewDate: {
            lte: now,
          },
          state: {
            in: [1, 3], // Learning or Relearning states get priority
          },
          ...progressContextFilter,
        },
        orderBy: {
          nextReviewDate: 'asc',
        },
        take: 5,
      });

      if (dueTopics.length > 0) {
        const topic = dueTopics[0];
        if (!topic) {
          logger.info('No due topic', { userId: userId.substring(0, 10) });
          return { data: { message: 'No items due' } };
        }

        // Query PreGeneratedQuestion siblings for this condition (unified variant pool).
        // taskType filtering is best-effort: prefer matching taskType, but fall back to any sibling.
        const taskTypeFilter = topic.taskType ?? undefined;
        const allSiblings = await prisma.preGeneratedQuestion.findMany({
          where: withProductionPregeneratedSafety({ conditionId: topic.conditionId }),
          take: 20,
          orderBy: { generatedAt: 'desc' },
        });
        // Prefer taskType match; fall back to any sibling
        const taskTypeSiblings = taskTypeFilter
          ? allSiblings.filter(
              (q) => (q.questionData as Record<string, unknown>)?.taskType === taskTypeFilter
            )
          : [];
        const availableVariants = taskTypeSiblings.length > 0 ? taskTypeSiblings : allSiblings;

        if (availableVariants.length > 0) {
          const variant = availableVariants[Math.floor(Math.random() * availableVariants.length)]!;
          const normalizedQuestion = normalizeSrsQuestion(variant, 'pre_generated');

          if (!normalizedQuestion) {
            logger.warn('Skipping SRS variant with unparseable question data', {
              userId: userId.substring(0, 10),
              questionId: variant.id,
            });
          } else {
            logger.info('SRS next item (variant) retrieved', {
              userId: userId.substring(0, 10),
              topicProgressId: topic.id.substring(0, 10),
              taskType: topic.taskType ?? 'diagnosis',
            });

            // Fire-and-forget: increment timesServed for the served PreGeneratedQuestion.
            prisma.preGeneratedQuestion
              .updateMany({
                where: { id: variant.id },
                data: { timesServed: { increment: 1 } },
              })
              .catch((e) => logger.warn('Failed to increment timesServed', e));

            return {
              data: {
                srsItemId: null,
                topicProgressId: topic.id,
                question: normalizedQuestion,
                isVariant: true,
                progressContext: topic.progressContext,
                taskType: topic.taskType ?? 'diagnosis',
              },
            };
          }
        }
      }

      // Fallback: check UserProgress for any condition due for review
      // (Replaces legacy SRSItem query — SRSItem is deprecated)
      const dueProgress = await prisma.userProgress.findMany({
        where: {
          userId,
          nextReviewAt: { lte: now },
          ...progressContextFilter,
        },
        orderBy: { nextReviewAt: 'asc' },
        take: 5,
        select: {
          conditionId: true,
          progressContext: true,
          fsrsCard: true,
        },
      });

      if (dueProgress.length === 0) {
        logger.info('No items due (UserProgress fallback)', { userId: userId.substring(0, 10) });
        return { data: { message: 'No items due' } };
      }

      // ─── Batch queries to avoid N+1 ──────────────────────────────────────────
      // Fetch all PreGeneratedQuestions and legacy Questions for due conditions
      // in two batch queries instead of up to 3 queries per loop iteration.
      const dueConditionIds = dueProgress.map((p) => p.conditionId);

      const [preGenBatch, legacyBatch] = await Promise.all([
        prisma.preGeneratedQuestion.findMany({
          where: withProductionPregeneratedSafety({ conditionId: { in: dueConditionIds } }),
          orderBy: { generatedAt: 'desc' },
        }),
        prisma.question.findMany({
          where: withProductionQuestionSafety({ conditionId: { in: dueConditionIds } }),
          take: dueConditionIds.length, // one per condition is enough
        }),
      ]);

      // Index by conditionId for O(1) lookup
      const preGenByCondition = new Map<string, typeof preGenBatch>();
      for (const q of preGenBatch) {
        const arr = preGenByCondition.get(q.conditionId) ?? [];
        arr.push(q);
        preGenByCondition.set(q.conditionId, arr);
      }
      const legacyByCondition = new Map<string, (typeof legacyBatch)[0]>();
      for (const q of legacyBatch) {
        if (!legacyByCondition.has(q.conditionId)) {
          legacyByCondition.set(q.conditionId, q);
        }
      }

      // Try to find a question for the first due condition
      for (const progress of dueProgress) {
        const card = progress.fsrsCard as { state?: number } | null;
        const fsrsState = card?.state ?? 0;
        const conditionPreGen = preGenByCondition.get(progress.conditionId) ?? [];

        let questionContent: any = null;
        let questionSource: 'pre_generated' | 'question' | null = null;
        let isVariant = false;

        // Prefer variant (newest) if in learning/relearning state
        if ((fsrsState === 1 || fsrsState === 3) && conditionPreGen.length > 0) {
          questionContent = conditionPreGen[0]; // already sorted by generatedAt desc
          questionSource = 'pre_generated';
          isVariant = true;
        }

        if (!questionContent) {
          if (conditionPreGen.length > 0) {
            questionContent = conditionPreGen[0];
            questionSource = 'pre_generated';
          } else {
            questionContent = legacyByCondition.get(progress.conditionId) ?? null;
            questionSource = questionContent ? 'question' : null;
          }
        }

        if (questionContent && questionSource) {
          const normalizedQuestion = normalizeSrsQuestion(questionContent, questionSource);
          if (!normalizedQuestion) continue;

          logger.info('SRS next item retrieved (UserProgress fallback)', {
            userId: userId.substring(0, 10),
            conditionId: progress.conditionId.substring(0, 10),
            isVariant,
          });

          // Fire-and-forget: increment timesServed when a PreGeneratedQuestion is served.
          // This enables the flag-rate kill switch in contentHealthService.
          if (questionSource === 'pre_generated' && questionContent.id) {
            prisma.preGeneratedQuestion
              .updateMany({
                where: { id: questionContent.id },
                data: { timesServed: { increment: 1 } },
              })
              .catch((err: unknown) =>
                logger.warn('srs/next timesServed increment failed (non-fatal)', {
                  error: err instanceof Error ? err.message : String(err),
                })
              );
          }

          return {
            data: {
              srsItemId: null,
              topicProgressId: null,
              question: normalizedQuestion,
              isVariant,
              progressContext: progress.progressContext,
              taskType:
                (questionContent as { taskType?: string }).taskType ??
                getTaskTypeFromContent(normalizedQuestion.question),
            },
          };
        }
      }

      logger.info('No questions found for due conditions', { userId: userId.substring(0, 10) });
      return { data: { message: 'No items due' } };
    } catch (error) {
      logger.error('SRS next error', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId.substring(0, 10),
      });
      throw new Error('Failed to retrieve next SRS item');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
