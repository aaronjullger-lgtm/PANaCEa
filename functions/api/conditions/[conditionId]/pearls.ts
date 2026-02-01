/**
 * API Endpoint: /api/conditions/:conditionId/pearls
 *
 * Fetch clinical pearls for a specific condition from MedicalContent
 * Supports both UUID and slug formats for conditionId
 */

import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

const ConditionPearlsSchema = z.object({
  conditionId: z.string().min(1, 'Condition ID is required'),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ConditionPearlsSchema,
  async ({ env, validated }) => {
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Use validated.conditionId from params schema validation
      // Decode in case it was URL encoded
      const conditionId = decodeURIComponent(validated.conditionId);

      console.log('[pearls] Fetching pearls for conditionId:', conditionId);

      // Try to find by ID first, then by slug/identifier
      let medicalContent = await prisma.medicalContent.findUnique({
        where: { id: conditionId },
        select: { content: true },
      });

      // If not found by ID, try by slug/conditionId field
      if (!medicalContent) {
        medicalContent = await prisma.medicalContent.findFirst({
          where: {
            OR: [
              { conditionId: conditionId },
              { conditionId: conditionId.toLowerCase() },
              { conditionId: conditionId.replaceAll('-', ' ') },
            ],
          },
          select: { content: true },
        });
      }

      if (!medicalContent) {
        console.log('[pearls] No medical content found for:', conditionId);
        return { data: { pearls: [] } };
      }

      // Extract pearls from content JSONB field (handle null content)
      const content = medicalContent.content as Record<string, unknown> | null;
      const pearls =
        content && Array.isArray(content.clinicalPearls)
          ? (content.clinicalPearls as string[])
          : content && Array.isArray(content.pearls)
            ? (content.pearls as string[])
            : [];

      console.log('[pearls] Found', pearls.length, 'pearls');
      return { data: { pearls } };
    } catch (error) {
      console.error('[pearls] Error fetching pearls:', error);
      return { status: 500, error: 'Failed to fetch clinical pearls' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
