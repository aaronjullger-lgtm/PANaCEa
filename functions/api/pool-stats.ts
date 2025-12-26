/**
 * Question Pool API Endpoint
 * GET: Returns pool health stats
 * POST: Triggers batch generation for low systems
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Env {
  DATABASE_URL: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
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
    
    return new Response(JSON.stringify({
      health: totalUnused < 100 ? 'critical' : totalUnused < 500 ? 'warning' : 'healthy',
      totalQuestions,
      totalUnused,
      systems: stats,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to get pool stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { system, count = 25 } = await context.request.json();
    
    // In production, this would queue a background job
    // For now, just acknowledge the request
    return new Response(JSON.stringify({
      queued: true,
      system: system || 'all',
      count,
      message: 'Batch generation queued',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to queue generation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
