/**
 * Question Pool Replenishment Cron Endpoint
 * Monitors question pool levels and flags systems needing more questions
 * 
 * Called by: Cloudflare Scheduled Handler at 3 AM UTC
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest } from '../_shared/schemas';
import { z } from 'zod';

// Zod schema for cron request (empty - triggered by scheduler)
const CronRequestSchema = z.object({
  system: z.string().optional(), // Optional: check specific system only
}).optional().default({});

const MIN_POOL_SIZE = 50;  // Minimum questions per system
const TARGET_POOL_SIZE = 100;  // Target questions per system

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
  'emergency_medicine'
];

export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  // Verify cron secret
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate request body (optional for cron jobs)
  const validation = await validateRequest(request, CronRequestSchema);
  if (validation.success === false) {
    return validation.response;
  }
  
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  
  try {
    const poolStats: Record<string, { 
      count: number; 
      status: 'healthy' | 'low' | 'critical';
      needed: number;
    }> = {};
    
    const systemsNeedingReplenishment: string[] = [];
    
    // Check each system
    for (const system of ORGAN_SYSTEMS) {
      const count = await prisma.question.count({
        where: { 
          system,
          status: 'active'
        }
      });
      
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
    
    // Get total pool stats
    const totalActive = await prisma.question.count({
      where: { status: 'active' }
    });
    
    const totalPending = await prisma.question.count({
      where: { status: 'pending' }
    });
    
    // Check for questions with high skip/flag rates
    const problematicQuestions = await prisma.$queryRaw<Array<{ id: string; flagCount: number }>>`
      SELECT q.id, COUNT(f.id) as "flagCount"
      FROM "Question" q
      LEFT JOIN "QuestionFlag" f ON q.id = f."questionId"
      WHERE q.status = 'active'
      GROUP BY q.id
      HAVING COUNT(f.id) >= 3
      LIMIT 10
    `;
    
    // Log results
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
          problematicQuestionsCount: problematicQuestions.length
        }
      }
    });
    
    // If critical systems exist, could trigger generation here
    // For now, just report the status
    const criticalCount = Object.values(poolStats).filter(s => s.status === 'critical').length;
    const lowCount = Object.values(poolStats).filter(s => s.status === 'low').length;
    
    return new Response(JSON.stringify({ 
      success: true,
      summary: {
        totalActive,
        totalPending,
        criticalSystems: criticalCount,
        lowSystems: lowCount,
        healthySystems: ORGAN_SYSTEMS.length - criticalCount - lowCount
      },
      systemsNeedingReplenishment,
      poolStats,
      problematicQuestions: problematicQuestions.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Cron] Pool replenishment check failed:', error);
    return new Response(JSON.stringify({ 
      error: 'Check failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    await prisma.$disconnect();
  }
}
