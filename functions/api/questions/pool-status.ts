/**
 * API Endpoint: /api/questions/pool-status
 * 
 * Get the status of the pre-generated question pool
 * Shows availability by system and overall health
 * 
 * MULTI-TENANT ARCHITECTURE:
 * Questions are permanent assets in the pool - they're never "consumed" globally.
 * Each user has their own history via UserQuestionSeen.
 * This endpoint shows:
 * - Total questions in pool (permanent library)
 * - Per-user: how many they've seen vs. fresh questions available
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { CloudflareContext } from '../_shared/types';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

const POOL_LOW_THRESHOLD = 20;
const SYSTEMS = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];

export const onRequestGet = async (context: CloudflareContext<Env>) => {
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

    // Get user ID for personal stats
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    // Get counts by system (total in pool - multi-tenant: all questions are available)
    const systemCounts: Record<string, { total: number; userSeen: number; userFresh: number }> = {};
    
    for (const system of SYSTEMS) {
      const total = await prisma.preGeneratedQuestion.count({
        where: { system },
      });
      
      // Get user-specific counts if authenticated
      let userSeen = 0;
      if (user) {
        const seenQuestions = await prisma.userQuestionSeen.findMany({
          where: { userId: user.id },
          select: { questionId: true },
        });
        const seenIds = seenQuestions.map(h => h.questionId);
        
        if (seenIds.length > 0) {
          userSeen = await prisma.preGeneratedQuestion.count({
            where: { 
              system,
              id: { in: seenIds },
            },
          });
        }
      }
      
      systemCounts[system] = {
        total,
        userSeen,
        userFresh: total - userSeen,
      };
    }

    // Get overall pool count
    const totalInPool = await prisma.preGeneratedQuestion.count();

    // Get user's seen count across all systems
    let totalUserSeen = 0;
    if (user) {
      const allSeenHistory = await prisma.userQuestionSeen.findMany({
        where: { userId: user.id },
        select: { questionId: true },
      });
      const allSeenIds = allSeenHistory.map(h => h.questionId);
      
      if (allSeenIds.length > 0) {
        totalUserSeen = await prisma.preGeneratedQuestion.count({
          where: { id: { in: allSeenIds } },
        });
      }
    }

    // Get main Question table count
    const mainQuestionCount = await prisma.question.count();

    // Identify systems that need more questions in the pool
    const lowSystems = SYSTEMS.filter(s => systemCounts[s].total < POOL_LOW_THRESHOLD);

    return new Response(JSON.stringify({
      pool: {
        total: totalInPool,
        // Multi-tenant: all questions remain available
        available: totalInPool,
      },
      user: user ? {
        seen: totalUserSeen,
        fresh: totalInPool - totalUserSeen,
        percentExplored: totalInPool > 0 
          ? Math.round((totalUserSeen / totalInPool) * 100) 
          : 0,
      } : null,
      mainTable: {
        total: mainQuestionCount,
      },
      bySystem: systemCounts,
      health: {
        threshold: POOL_LOW_THRESHOLD,
        lowSystems,
        overallHealthy: totalInPool >= POOL_LOW_THRESHOLD,
        needsGeneration: lowSystems.length > 0 || totalInPool < POOL_LOW_THRESHOLD,
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
