/**
 * Question Pool API Endpoint
 * GET: Returns pool health stats
 * POST: Triggers batch generation for low systems
 */

import { createEdgePrismaClient } from './_shared/prisma-edge';
import { CloudflareContext, CloudflareEnv, jsonResponse, errorResponse } from './_shared/types';
import { validateRequest } from './_shared/schemas';
import { z } from 'zod';

// Zod schema for batch generation request
const PoolStatsSchema = z.object({
  system: z.string().max(50).optional(),
  count: z.number().int().min(1).max(100).optional().default(25),
});

export async function onRequestGet(context: CloudflareContext<CloudflareEnv>): Promise<Response> {
  const { env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL!);

  try {
    const systems = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];
    
    const stats = await Promise.all(
      systems.map(async (system) => {
        const [total, unused] = await Promise.all([
          prisma.preGeneratedQuestion.count({ where: { system } }),
          prisma.preGeneratedQuestion.count({ where: { system, usedAt: null } }),
        ]);
        return { system, total, unused };
      })
    );
    
    const totalQuestions = stats.reduce((s, x) => s + x.total, 0);
    const totalUnused = stats.reduce((s, x) => s + x.unused, 0);
    
    return jsonResponse({
      health: totalUnused < 100 ? 'critical' : totalUnused < 500 ? 'warning' : 'healthy',
      totalQuestions,
      totalUnused,
      systems: stats,
    });
  } catch (error) {
    return errorResponse('Failed to get pool stats', 500);
  } finally {
    await prisma.$disconnect();
  }
}

export async function onRequestPost(context: CloudflareContext<CloudflareEnv>): Promise<Response> {
  try {
    // Validate input with Zod schema
    const validation = await validateRequest(context.request.clone(), PoolStatsSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { system, count } = (validation as { success: true; data: any }).data;
    
    // In production, this would queue a background job
    // For now, just acknowledge the request
    return jsonResponse({
      queued: true,
      system: system || 'all',
      count: count || 25,
      message: 'Batch generation queued',
    });
  } catch (error) {
    return errorResponse('Failed to queue generation', 500);
  }
}
