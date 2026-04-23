/**
 * POST /api/baseline/submit
 * Submit baseline assessment answers; server computes system breakdown and upserts BaselineAssessment.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';

const SubmitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().int().min(0),
    })
  ),
});

export const onRequestPost = authenticatedEndpoint(SubmitSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/baseline/submit');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return { status: 404, error: 'User not found' };
    }

    const questionIds = validated.answers.map((a) => a.questionId);
    const questions = await prisma.preGeneratedQuestion.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, system: true, questionData: true },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    const systemStats: Record<string, { correct: number; total: number }> = {};

    for (const { questionId, selectedIndex } of validated.answers) {
      const q = questionMap.get(questionId);
      if (!q) continue;
      const data = q.questionData as Record<string, unknown>;
      const correctIndex =
        (data?.correctAnswerIndex as number) ?? (data?.correctIndex as number) ?? -1;
      const isCorrect = selectedIndex === correctIndex;
      if (isCorrect) correctCount++;
      const system = (q.system as string) ?? 'Unknown';
      if (!systemStats[system]) systemStats[system] = { correct: 0, total: 0 };
      systemStats[system].total++;
      if (isCorrect) systemStats[system].correct++;
    }

    const total = validated.answers.length;
    const accuracy = total > 0 ? (correctCount / total) * 100 : 0;
    const systemBreakdown: Record<string, { correct: number; total: number; accuracy: number }> =
      {};
    for (const [sys, s] of Object.entries(systemStats)) {
      systemBreakdown[sys] = {
        correct: s.correct,
        total: s.total,
        accuracy: s.total > 0 ? (s.correct / s.total) * 100 : 0,
      };
    }

    const sorted = Object.entries(systemBreakdown)
      .filter(([, v]) => v.total > 0)
      .sort(([, a], [, b]) => a.accuracy - b.accuracy);
    const weakestSystems = sorted.slice(0, 3).map(([sys]) => sys);
    const strongestSystems = sorted
      .slice(-3)
      .reverse()
      .map(([sys]) => sys);

    const id = crypto.randomUUID();
    await prisma.baselineAssessment.upsert({
      where: { userId },
      create: {
        id,
        userId,
        totalQuestions: total,
        correctAnswers: correctCount,
        accuracy,
        systemBreakdown,
        weakestSystems,
        strongestSystems,
      },
      update: {
        totalQuestions: total,
        correctAnswers: correctCount,
        accuracy,
        systemBreakdown,
        weakestSystems,
        strongestSystems,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { hasCompletedBaseline: true },
    });

    logger.info('Baseline submitted', { userId, total, correctCount, accuracy });
    return {
      data: {
        totalQuestions: total,
        correctAnswers: correctCount,
        accuracy,
        systemBreakdown,
        weakestSystems,
        strongestSystems,
      },
    };
  } catch (error) {
    logger.error('Baseline submit failed', error);
    return { status: 500, error: 'Failed to submit baseline assessment' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
