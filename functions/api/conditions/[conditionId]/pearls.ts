/**
 * API Endpoint: /api/conditions/:conditionId/pearls
 *
 * Fetch clinical pearls for a specific condition from MedicalContent
 * Supports both UUID and slug formats for conditionId
 */

import { authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

const ConditionPearlsSchema = z.object({
  conditionId: z.string().min(1, 'Condition ID is required'),
});

export const onRequestGet = authenticatedEndpoint(
  ConditionPearlsSchema,
  async ({ env, validated, params }) => {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Use params.conditionId from URL path (the schema validates the shape)
      const conditionId = params.conditionId as string;

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
              { conditionId: conditionId.replace(/-/g, ' ') },
            ],
          },
          select: { content: true },
        });
      }

      if (!medicalContent) {
        return { data: { pearls: [] } };
      }

      // Extract pearls from content JSONB field
      const content = medicalContent.content as Record<string, unknown>;
      const pearls = Array.isArray(content.clinicalPearls)
        ? (content.clinicalPearls as string[])
        : [];

      return { data: { pearls } };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
