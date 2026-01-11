/**
 * API Endpoint: /api/conditions/:conditionId/pearls
 * 
 * Fetch clinical pearls for a specific condition from MedicalContent
 */

import { authenticateRequest } from '../../_shared/auth';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import type { CloudflareContext } from '../../_shared/types';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

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

    // Get conditionId from URL path
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/');
    const conditionId = pathParts[pathParts.indexOf('conditions') + 1];

    if (!conditionId || conditionId === 'pearls') {
      return new Response(JSON.stringify({ error: 'Missing conditionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch medical content for this condition (using id field, not conditionId)
    const medicalContent = await prisma.medicalContent.findUnique({
      where: { id: conditionId },
      select: { content: true },
    });

    if (!medicalContent) {
      return new Response(JSON.stringify({ pearls: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract pearls from content JSONB field
    const content = medicalContent.content as Record<string, unknown>;
    const pearls = Array.isArray(content.clinicalPearls) 
      ? content.clinicalPearls as string[]
      : [];

    return new Response(JSON.stringify({ pearls }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching pearls:', error);
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
