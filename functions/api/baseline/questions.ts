/**
 * GET /api/baseline/questions
 * Returns 20 questions for baseline assessment (mixed systems).
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';

const BASELINE_QUESTION_COUNT = 20;

export const onRequestGet = authenticatedEndpoint(
  z.object({}),
  async (context) => {
    const { env, auth } = context;
    const logger = createEndpointLogger('/api/baseline/questions');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const userId = await resolveUserId(prisma, auth.userId);
      if (!userId) {
        return { status: 404, error: 'User not found' };
      }

      const raw = await prisma.preGeneratedQuestion.findMany({
        where: {
          system: { not: null },
          validationStatus: 'approved',
        },
        take: BASELINE_QUESTION_COUNT * 2,
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          system: true,
          questionData: true,
        },
      });

      const questionDataJson = raw as Array<{
        id: string;
        system: string | null;
        questionData: unknown;
      }>;
      const withOptions = questionDataJson.filter((q) => {
        const d = q.questionData as Record<string, unknown>;
        return d && Array.isArray(d.options) && (d.options as unknown[]).length >= 2;
      });

      const bySystem = new Map<string, typeof withOptions>();
      for (const q of withOptions) {
        const sys = q.system ?? 'Unknown';
        if (!bySystem.has(sys)) bySystem.set(sys, []);
        bySystem.get(sys)!.push(q);
      }

      const systems = Array.from(bySystem.keys());
      const perSystem = Math.max(1, Math.floor(BASELINE_QUESTION_COUNT / systems.length));
      const selected: typeof withOptions = [];
      for (const sys of systems) {
        const pool = bySystem.get(sys)!;
        const take = Math.min(perSystem, pool.length);
        for (let i = 0; i < take && selected.length < BASELINE_QUESTION_COUNT; i++) {
          const q = pool[i];
          if (q) selected.push(q);
        }
      }
      while (selected.length < BASELINE_QUESTION_COUNT && withOptions.length > selected.length) {
        const next = withOptions.find((q) => !selected.includes(q));
        if (!next) break;
        selected.push(next);
      }

      const questions = selected.slice(0, BASELINE_QUESTION_COUNT).map((q) => {
        const d = (q.questionData as Record<string, unknown>) || {};
        const question = (d.question as string) || (d.vignette as string) || '';
        const options = (d.options as string[]) || (d.choices as string[]) || [];
        return {
          id: q.id,
          question: question,
          options: options.slice(0, 6),
          system: q.system ?? 'Unknown',
        };
      });

      logger.info('Baseline questions fetched', { userId, count: questions.length });
      return { data: { questions } };
    } catch (error) {
      logger.error('Baseline questions fetch failed', error);
      return { status: 500, error: 'Failed to fetch baseline questions' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
