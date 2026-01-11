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
    const auth = await authenticateRequest(context.request);
    if (!auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Group by system and count entries (sorted by count desc)
    const systemGroups = await prisma.medicalContent.groupBy({
      by: ['system'],
      _count: {
        _all: true,
      },
      where: {
        status: 'published',
      },
      orderBy: {
        _count: {
          _all: 'desc',
        },
      },
    });

    const systems = systemGroups.map((group) => ({
      id: group.system,
      label: group.system,
      count: group._count._all,
    }));

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
