/**
 * Content Systems API - GET /api/content/systems
 * 
 * Returns distinct organ systems with content counts.
 * Used to populate filter dropdowns in the library browser.
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate user
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Edge-safe approach: findMany + JS reduce (avoids groupBy/_count order issues)
    const allSystems = await prisma.medicalContent.findMany({
      select: { system: true },
    });

    const systemCounts = new Map<string, number>();
    for (const { system } of allSystems) {
      if (system) {
        systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
      }
    }

    const systems = Array.from(systemCounts.entries())
      .map(([system, count]) => ({
        id: system,
        label: system,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return new Response(JSON.stringify(systems), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[systems] Failed to fetch systems:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch systems',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
