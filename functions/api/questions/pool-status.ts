/**
 * API Endpoint: /api/questions/pool-status
 * 
 * Get the status of the pre-generated question pool
 * Shows availability by system and overall health
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

const POOL_LOW_THRESHOLD = 20;
const SYSTEMS = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get counts by system
    const systemCounts: Record<string, { available: number; used: number; total: number }> = {};
    
    for (const system of SYSTEMS) {
      const [available, used] = await Promise.all([
        prisma.preGeneratedQuestion.count({
          where: { system, usedAt: null },
        }),
        prisma.preGeneratedQuestion.count({
          where: { system, usedAt: { not: null } },
        }),
      ]);
      
      systemCounts[system] = {
        available,
        used,
        total: available + used,
      };
    }

    // Get overall counts
    const [totalAvailable, totalUsed] = await Promise.all([
      prisma.preGeneratedQuestion.count({ where: { usedAt: null } }),
      prisma.preGeneratedQuestion.count({ where: { usedAt: { not: null } } }),
    ]);

    // Get main Question table count
    const mainQuestionCount = await prisma.question.count();

    // Identify systems that need questions
    const lowSystems = SYSTEMS.filter(s => systemCounts[s].available < POOL_LOW_THRESHOLD);

    return new Response(JSON.stringify({
      pool: {
        available: totalAvailable,
        used: totalUsed,
        total: totalAvailable + totalUsed,
      },
      mainTable: {
        total: mainQuestionCount,
      },
      bySystem: systemCounts,
      health: {
        threshold: POOL_LOW_THRESHOLD,
        lowSystems,
        overallHealthy: totalAvailable >= POOL_LOW_THRESHOLD,
        needsGeneration: lowSystems.length > 0 || totalAvailable < POOL_LOW_THRESHOLD,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching pool status:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};
