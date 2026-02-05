/**
 * POST /api/exam/generate
 * Exam Simulator Pro: generate a 300-question block strictly following NCCPA blueprint weights.
 * Distributes by system, difficulty (20% Hard, 60% Medium, 20% Easy), mixed cognitive level.
 * Excludes UserQuestionSeen when possible.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';

const GenerateBodySchema = z.object({
  body: z
    .object({
      totalQuestions: z.number().int().min(1).max(300).optional().default(300),
      blueprintVersion: z.string().optional(),
    })
    .optional()
    .default({}),
});

const DIFFICULTY_SPLIT = { hard: 0.2, medium: 0.6, easy: 0.2 } as const;
const COGNITIVE_LEVELS = ['LEVEL_1_RECALL', 'LEVEL_2_CONCEPT', 'LEVEL_3_VIGNETTE'] as const;

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  GenerateBodySchema,
  async (context) => {
    const { env, validated, auth } = context;
    const log = createEndpointLogger('/api/exam/generate', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;

    try {
      const { totalQuestions, blueprintVersion } = validated.body ?? {};
      const total = totalQuestions ?? 300;

      const user = await resolveUserByClerkId(prisma, auth.userId);
      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      const blueprint = await prisma.nCCPABlueprintConfig.findFirst({
        where: blueprintVersion ? { version: blueprintVersion } : { isActive: true },
        orderBy: { effectiveDate: 'desc' },
        select: { id: true, version: true, weights: true },
      });
      if (!blueprint) {
        return { status: 404, error: 'No active NCCPA blueprint config found' };
      }

      const weights = blueprint.weights as Record<string, number>;
      if (!weights || typeof weights !== 'object') {
        return { status: 500, error: 'Blueprint weights invalid' };
      }

      const seenIds = await prisma.userQuestionSeen
        .findMany({
          where: { userId: user.id, questionType: 'question' },
          select: { questionId: true },
        })
        .then((rows) => new Set(rows.map((r) => r.questionId)));

      const systemCounts: Record<string, number> = {};
      let remaining = total;
      const systems = Object.keys(weights).filter((s) => weights[s] > 0);
      for (const system of systems) {
        const frac = weights[system] as number;
        const count = Math.round(total * frac);
        systemCounts[system] = Math.min(count, remaining);
        remaining -= systemCounts[system];
      }
      if (remaining > 0 && systems.length > 0) {
        systemCounts[systems[0]] = (systemCounts[systems[0]] ?? 0) + remaining;
      }

      const selectedIds: string[] = [];
      const excludeIds = () =>
        selectedIds.length > 0 || seenIds.size > 0
          ? { id: { notIn: Array.from(new Set([...seenIds, ...selectedIds])) } }
          : {};

      for (const [system, count] of Object.entries(systemCounts)) {
        if (count <= 0) continue;
        const needHard = Math.max(0, Math.round(count * DIFFICULTY_SPLIT.hard));
        const needMedium = Math.max(0, Math.round(count * DIFFICULTY_SPLIT.medium));
        const needEasy = Math.max(0, count - needHard - needMedium);
        let added = 0;

        for (const [diff, need] of [
          ['hard', needHard],
          ['medium', needMedium],
          ['easy', needEasy],
        ] as const) {
          if (need <= 0) continue;
          const pool = await prisma.question.findMany({
            where: {
              system: { equals: system, mode: 'insensitive' },
              difficulty: { equals: diff, mode: 'insensitive' },
              ...excludeIds(),
            },
            select: { id: true },
            take: need * 3,
          });
          const shuffled = [...pool].sort(() => Math.random() - 0.5);
          for (let i = 0; i < need && i < shuffled.length; i++) {
            selectedIds.push(shuffled[i].id);
          }
          added += Math.min(need, shuffled.length);
        }
        const stillNeed = count - added;
        if (stillNeed > 0) {
          const anyDiff = await prisma.question.findMany({
            where: {
              system: { equals: system, mode: 'insensitive' },
              ...excludeIds(),
            },
            select: { id: true },
            take: stillNeed * 3,
          });
          const shuffled = [...anyDiff].sort(() => Math.random() - 0.5);
          for (let i = 0; i < stillNeed && i < shuffled.length; i++) {
            selectedIds.push(shuffled[i].id);
          }
        }
      }

      if (selectedIds.length < total) {
        const fallback = await prisma.question.findMany({
          where: { id: { notIn: selectedIds } },
          select: { id: true },
          take: (total - selectedIds.length) * 2,
        });
        const shuffled = [...fallback].sort(() => Math.random() - 0.5);
        for (let i = 0; selectedIds.length < total && i < shuffled.length; i++) {
          selectedIds.push(shuffled[i].id);
        }
      }

      const finalIds = selectedIds.slice(0, total);
      const questions = await prisma.question.findMany({
        where: { id: { in: finalIds } },
        select: {
          id: true,
          vignette: true,
          question: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          system: true,
          difficulty: true,
          cognitiveLevel: true,
        },
      });
      const byId = new Map(questions.map((q) => [q.id, q]));
      const ordered = finalIds.map((id) => byId.get(id)).filter(Boolean);

      log.info('Exam generated', {
        totalQuestions: ordered.length,
        blueprintVersion: blueprint.version,
        systems: Object.keys(systemCounts).length,
      });

      return {
        data: {
          success: true,
          blueprintVersion: blueprint.version,
          totalQuestions: ordered.length,
          questions: ordered,
          distribution: systemCounts,
        },
      };
    } catch (e) {
      log.error('Exam generate error', e);
      return { status: 500, error: 'Failed to generate exam' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
