/**
 * Question Pool Replenishment Cron Endpoint
 * Monitors question pool levels and flags systems needing more questions
 *
 * Called by: Cloudflare Scheduled Handler at 3 AM UTC
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { z } from 'zod';
import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const BodySchema = z.object({
  system: z.string().optional(),
}).optional().default({});

const MIN_POOL_SIZE = 50;
const TARGET_POOL_SIZE = 100;

const ORGAN_SYSTEMS = [
  'cardiovascular',
  'pulmonary',
  'gastrointestinal',
  'musculoskeletal',
  'neurological',
  'psychiatry',
  'endocrine',
  'dermatology',
  'genitourinary',
  'hematology',
  'infectious_disease',
  'heent',
  'reproductive',
  'nephrology',
  'emergency_medicine',
];

export const onRequestPost = cronEndpoint({
  schema: BodySchema,
  handler: async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const poolStats: Record<string, { count: number; status: 'healthy' | 'low' | 'critical'; needed: number }> = {};
      const systemsNeedingReplenishment: string[] = [];

      for (const system of ORGAN_SYSTEMS) {
        const count = await prisma.question.count({ where: { system } });

        let status: 'healthy' | 'low' | 'critical' = 'healthy';
        let needed = 0;

        if (count < MIN_POOL_SIZE / 2) {
          status = 'critical';
          needed = TARGET_POOL_SIZE - count;
          systemsNeedingReplenishment.push(system);
        } else if (count < MIN_POOL_SIZE) {
          status = 'low';
          needed = TARGET_POOL_SIZE - count;
          systemsNeedingReplenishment.push(system);
        }

        poolStats[system] = { count, status, needed };
      }

      const [totalActive, totalPending] = await Promise.all([
        prisma.question.count(),
        prisma.preGeneratedQuestion.count({ where: { validationStatus: 'pending' } }),
      ]);

      const problematicQuestions = await prisma.$queryRaw<Array<{ id: string; flagCount: number }>>`
        SELECT q.id, COUNT(f.id) as "flagCount"
        FROM "Question" q
        LEFT JOIN "QuestionFlag" f ON q.id = f."questionId"
        GROUP BY q.id
        HAVING COUNT(f.id) >= 3
        LIMIT 10
      `;

      await prisma.auditLog.create({
        data: {
          action: 'POOL_REPLENISHMENT_CHECK',
          entityType: 'SYSTEM',
          details: {
            timestamp: new Date().toISOString(),
            totalActive,
            totalPending,
            systemsNeedingReplenishment,
            systemStats: poolStats,
            problematicQuestionsCount: problematicQuestions.length,
          },
        },
      });

      const criticalCount = Object.values(poolStats).filter((s) => s.status === 'critical').length;
      const lowCount = Object.values(poolStats).filter((s) => s.status === 'low').length;

      return ok({
        summary: {
          totalActive,
          totalPending,
          criticalSystems: criticalCount,
          lowSystems: lowCount,
          healthySystems: ORGAN_SYSTEMS.length - criticalCount - lowCount,
        },
        systemsNeedingReplenishment,
        poolStats,
        problematicQuestions: problematicQuestions.length,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
