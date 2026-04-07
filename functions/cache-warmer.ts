// functions/cache-warmer.ts
// Scheduled worker to pre-warm KV cache with frequently accessed content
// Run this as a CloudFlare Cron Trigger (e.g., every 30 minutes)

import { createEdgePrismaClient } from './api/_shared/prisma-edge';
import {
  setInCache,
  getConditionCacheKey,
  getQuestionPoolCacheKey,
  CACHE_CONFIG,
  isKVAvailable,
} from './api/_shared/cache';
import type { KVNamespace, ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';

interface Env {
  DATABASE_URL: string;
  CACHE?: KVNamespace;
  REQUIRE_APPROVED_QUESTIONS?: string;
}

/**
 * Cache warming strategy:
 * 1. Top 50 most-viewed conditions
 * 2. Question pools for each system
 * 3. High-yield conditions
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      console.log('[Cache Warmer] Starting cache warming at', new Date().toISOString());

      // Check if KV is available
      if (!isKVAvailable(env.CACHE)) {
        console.error('[Cache Warmer] KV namespace not available');
        return;
      }

      // 1. Warm top 50 most-viewed conditions
      const topConditions = await prisma.medicalContent.findMany({
        where: {
          status: 'published',
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 50,
      });

      console.log(`[Cache Warmer] Warming ${topConditions.length} top conditions`);

      for (const condition of topConditions) {
        if (condition.conditionId) {
          const cacheKey = getConditionCacheKey(condition.conditionId);
          await setInCache(env.CACHE, cacheKey, condition, CACHE_CONFIG.TTL.CONDITION_DETAIL);
        }
      }

      // 2. Warm high-yield conditions
      const highYieldConditions = await prisma.medicalContent.findMany({
        where: {
          status: 'published',
          pance_yield: {
            gte: 90,
          },
        },
        take: 30,
      });

      console.log(`[Cache Warmer] Warming ${highYieldConditions.length} high-yield conditions`);

      for (const condition of highYieldConditions) {
        if (condition.conditionId) {
          const cacheKey = getConditionCacheKey(condition.conditionId);
          await setInCache(env.CACHE, cacheKey, condition, CACHE_CONFIG.TTL.CONDITION_DETAIL);
        }
      }

      // 3. Warm question pools for each system
      const systems = [
        'CV',
        'PULM',
        'GI',
        'NEURO',
        'MSK',
        'DERM',
        'HEME',
        'ENDO',
        'HEENT',
        'RENAL',
        'REPRO',
        'PSYCH',
        'ID',
        'GU',
      ];

      console.log(`[Cache Warmer] Warming question pools for ${systems.length} systems`);

      for (const system of systems) {
        const cacheKey = getQuestionPoolCacheKey({ system });

        // Phase 2: Feature-flagged approval gate for cached questions
        const validationFilter = env.REQUIRE_APPROVED_QUESTIONS === 'true'
          ? 'approved'
          : { not: 'rejected' };
        const questions = await prisma.preGeneratedQuestion.findMany({
          where: { system, validationStatus: validationFilter as any },
          take: 50, // Cache 50 questions per system
          orderBy: { generatedAt: 'asc' },
        });

        await setInCache(env.CACHE, cacheKey, questions, CACHE_CONFIG.TTL.QUESTION_POOL);
      }

      console.log('[Cache Warmer] Cache warming completed successfully');
    } catch (error) {
      console.error('[Cache Warmer] Error during cache warming:', error);
    } finally {
      await prisma.$disconnect();
    }
  },
};
