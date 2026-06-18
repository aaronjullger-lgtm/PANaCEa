/**
 * GET /api/drills/smart-review
 * Fetch canonical FSRS items due for review with question context.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
  withProgressLinkage,
} from '../../../lib/services/questionServingSafety';
import { resolveCorrectAnswerIndex } from '../../../lib/answerLetterMap';
import type { Prisma } from '@prisma/client';

const SmartReviewSchema = z.object({});

export const onRequestGet = authenticatedEndpoint(SmartReviewSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/drills/smart-review');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });

    const userId = user.id;
    const now = new Date();

    const [topicProgress, conditionProgress] = await Promise.all([
      prisma.userTopicProgress.findMany({
        where: { userId, nextReviewDate: { lte: now } },
        orderBy: [{ nextReviewDate: 'asc' }, { difficulty: 'desc' }],
        take: 20,
        select: {
          id: true,
          conditionId: true,
          taskType: true,
          nextReviewDate: true,
          difficulty: true,
          stability: true,
          reps: true,
        },
      }),
      prisma.userProgress.findMany({
        where: { userId, nextReviewAt: { lte: now } },
        orderBy: [{ nextReviewAt: 'asc' }, { fsrsDifficulty: 'desc' }],
        take: 20,
        select: {
          id: true,
          conditionId: true,
          nextReviewAt: true,
          fsrsDifficulty: true,
          fsrsStability: true,
          fsrsReps: true,
        },
      }),
    ]);

    const targets = [
      ...topicProgress
        .filter((item) => Boolean(item.conditionId))
        .filter((item) => item.nextReviewDate != null)
        .map((item) => ({
          id: item.id,
          source: 'user_topic_progress' as const,
          conditionId: item.conditionId,
          taskType: item.taskType,
          dueDate: item.nextReviewDate!,
          difficulty: item.difficulty,
          stability: item.stability,
          reps: item.reps,
        })),
      ...conditionProgress
        .filter((item) => Boolean(item.conditionId))
        .filter((item) => item.nextReviewAt != null)
        .map((item) => ({
          id: item.id,
          source: 'user_progress' as const,
          conditionId: item.conditionId,
          taskType: null,
          dueDate: item.nextReviewAt!,
          difficulty: item.fsrsDifficulty ?? 0,
          stability: item.fsrsStability ?? null,
          reps: item.fsrsReps ?? 0,
        })),
    ]
      .sort((a, b) => {
        const dueDelta = a.dueDate.getTime() - b.dueDate.getTime();
        return dueDelta !== 0 ? dueDelta : (b.difficulty ?? 0) - (a.difficulty ?? 0);
      })
      .slice(0, 20);

    const conditionIds = Array.from(
      new Set(
        targets
          .map((item) => item.conditionId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    const [preGeneratedQuestions, canonicalQuestions] = await Promise.all([
      conditionIds.length
        ? prisma.preGeneratedQuestion.findMany({
            where: withProgressLinkage(
              withProductionPregeneratedSafety({
                conditionId: { in: conditionIds },
              })
            ) as Prisma.PreGeneratedQuestionWhereInput,
            orderBy: { generatedAt: 'desc' },
            take: 100,
            select: {
              id: true,
              conditionId: true,
              system: true,
              difficulty: true,
              questionData: true,
            },
          })
        : [],
      conditionIds.length
        ? prisma.question.findMany({
            where: withProgressLinkage(
              withProductionQuestionSafety({
                conditionId: { in: conditionIds },
              })
            ) as Prisma.QuestionWhereInput,
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              conditionId: true,
              question: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              system: true,
              difficulty: true,
              taskType: true,
            },
          })
        : [],
    ]);

    type QuestionPayload = {
      id: string;
      stem: string;
      choices: Array<{ text: string; value: string } | string>;
      correctAnswer: string;
      explanation: string;
      system: string;
      difficulty: string;
    };

    const normalizeChoices = (value: unknown): Array<{ text: string; value: string } | string> =>
      Array.isArray(value) ? (value as Array<{ text: string; value: string } | string>) : [];

    const optionValue = (
      option: { text?: string; value?: string; label?: string } | string
    ): string => {
      if (typeof option === 'string') return option;
      return option.value ?? option.text ?? option.label ?? '';
    };

    const stringFrom = (...values: unknown[]): string => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value;
        if (typeof value === 'number') return String(value);
      }
      return '';
    };

    const questionDataValue = (data: unknown, key: string): unknown =>
      data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined;

    const taskTypeFromData = (data: unknown): string | null => {
      const taskType = questionDataValue(data, 'taskType');
      return typeof taskType === 'string' ? taskType : null;
    };

    const resolveCorrectAnswer = (
      data: unknown,
      choices: Array<{ text: string; value: string } | string>
    ): string => {
      const choiceTexts = choices.map(optionValue);
      const direct = stringFrom(
        questionDataValue(data, 'correctAnswer'),
        questionDataValue(data, 'answer'),
        questionDataValue(data, 'correct_option'),
        questionDataValue(data, 'correctChoice')
      );
      if (direct) {
        const resolvedIndex = resolveCorrectAnswerIndex(direct, choiceTexts);
        return resolvedIndex !== null ? (choiceTexts[resolvedIndex] ?? '') : '';
      }

      const rawIndex =
        questionDataValue(data, 'correctAnswerIndex') ??
        questionDataValue(data, 'correctIndex');
      const parsedIndex =
        typeof rawIndex === 'number'
          ? rawIndex
          : typeof rawIndex === 'string'
            ? Number.parseInt(rawIndex, 10)
            : Number.NaN;
      if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < choices.length) {
        return choiceTexts[parsedIndex] ?? '';
      }

      return '';
    };

    const preGeneratedByCondition = new Map<string, typeof preGeneratedQuestions>();
    for (const question of preGeneratedQuestions) {
      if (!question.conditionId) continue;
      const existing = preGeneratedByCondition.get(question.conditionId) ?? [];
      existing.push(question);
      preGeneratedByCondition.set(question.conditionId, existing);
    }

    const canonicalByCondition = new Map<string, typeof canonicalQuestions>();
    for (const question of canonicalQuestions) {
      if (!question.conditionId) continue;
      const existing = canonicalByCondition.get(question.conditionId) ?? [];
      existing.push(question);
      canonicalByCondition.set(question.conditionId, existing);
    }

    const chooseQuestion = (target: (typeof targets)[number]):
      | { id: string; question: QuestionPayload }
      | null => {
      const preGenerated = preGeneratedByCondition.get(target.conditionId) ?? [];
      const preferredPreGenerated =
        target.taskType != null
          ? preGenerated.find(
              (question) => taskTypeFromData(question.questionData) === target.taskType
            )
          : undefined;
      const selectedPreGenerated = preferredPreGenerated ?? preGenerated[0];

      if (selectedPreGenerated) {
        const data = selectedPreGenerated.questionData;
        const choices = normalizeChoices(
          questionDataValue(data, 'options') ?? questionDataValue(data, 'choices')
        );
        const payload = {
          id: selectedPreGenerated.id,
          stem: stringFrom(
            questionDataValue(data, 'question'),
            questionDataValue(data, 'stem'),
            questionDataValue(data, 'vignette')
          ),
          choices,
          correctAnswer: resolveCorrectAnswer(data, choices),
          explanation: stringFrom(
            questionDataValue(data, 'explanation'),
            questionDataValue(data, 'rationale')
          ),
          system: selectedPreGenerated.system ?? '',
          difficulty: selectedPreGenerated.difficulty ?? 'medium',
        };
        if (payload.stem && payload.choices.length > 0 && payload.correctAnswer) {
          return {
            id: selectedPreGenerated.id,
            question: payload,
          };
        }
      }

      const canonical = canonicalByCondition.get(target.conditionId) ?? [];
      const selectedCanonical =
        (target.taskType
          ? canonical.find((question) => question.taskType === target.taskType)
          : undefined) ?? canonical[0];

      if (!selectedCanonical) return null;
      const canonicalChoices = normalizeChoices(selectedCanonical.options);
      const canonicalChoiceTexts = canonicalChoices.map(optionValue);
      const canonicalAnswerIndex = resolveCorrectAnswerIndex(
        selectedCanonical.correctAnswer,
        canonicalChoiceTexts
      );
      if (canonicalChoices.length === 0 || canonicalAnswerIndex === null) return null;

      return {
        id: selectedCanonical.id,
        question: {
          id: selectedCanonical.id,
          stem: selectedCanonical.question,
          choices: canonicalChoices,
          correctAnswer: canonicalChoiceTexts[canonicalAnswerIndex] ?? '',
          explanation: selectedCanonical.explanation ?? '',
          system: selectedCanonical.system ?? '',
          difficulty: selectedCanonical.difficulty ?? 'medium',
        },
      };
    };

    type ReviewItemOut = {
      id: string;
      questionId: string;
      dueDate: Date;
      overdueDays: number;
      difficulty: number;
      interval: number;
      stability: number | null;
      srsReason: 'OVERDUE' | 'WEAK_SPOT' | 'NEW' | 'DUE';
      question: QuestionPayload;
    };

    const reviewItems = targets
      .map((target): ReviewItemOut | null => {
        const selected = chooseQuestion(target);
        if (!selected) return null;

        const overdueDays = Math.max(
          0,
          Math.floor((now.getTime() - target.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        let srsReason: ReviewItemOut['srsReason'] = 'DUE';
        if (overdueDays > 7) srsReason = 'OVERDUE';
        else if ((target.difficulty ?? 0) > 5) srsReason = 'WEAK_SPOT';
        else if ((target.reps ?? 0) < 2) srsReason = 'NEW';

        return {
          id: target.id,
          questionId: selected.id,
          dueDate: target.dueDate,
          overdueDays,
          difficulty: target.difficulty ?? 0,
          interval: target.stability ?? 0,
          stability: target.stability ?? null,
          srsReason,
          question: selected.question,
        };
      })
      .filter((x): x is ReviewItemOut => x !== null);

    const totalDue = reviewItems.length;
    const hardCount = reviewItems.filter(
      (i: ReviewItemOut) => i.srsReason === 'WEAK_SPOT'
    ).length;
    const overdueCount = reviewItems.filter(
      (i: ReviewItemOut) => i.srsReason === 'OVERDUE'
    ).length;
    const newCount = reviewItems.filter((i: ReviewItemOut) => i.srsReason === 'NEW').length;

    logger.info('Fetched smart review items', { userId: auth.userId, totalDue });

    // success: true lets the frontend distinguish a successful empty queue
    // ("you're all caught up — Brain Upgraded!") from a silent server failure.
    return {
      data: {
        success: true,
        items: reviewItems,
        stats: { totalDue, hardCount, overdueCount, newCount },
      },
    };
  } catch (error) {
    logger.error('smart-review error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch review items');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
