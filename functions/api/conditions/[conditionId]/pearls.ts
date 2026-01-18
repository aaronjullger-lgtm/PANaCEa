/**
 * API Endpoint: /api/conditions/:conditionId/pearls
 *
 * Fetch clinical pearls for a specific condition from MedicalContent
 */

import { authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

const ConditionPearlsSchema = z.object({
  params: z.object({
    conditionId: z.string().uuid('Invalid condition ID format'),
  }),
});

export const onRequestGet = authenticatedEndpoint(
  ConditionPearlsSchema,
  async ({ env, validated }) => {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { conditionId } = validated.params;

      // Fetch medical content for this condition (using id field)
      const medicalContent = await prisma.medicalContent.findUnique({
        where: { id: conditionId },
        select: { content: true },
      });

      if (!medicalContent) {
        return { pearls: [] };
      }

      // Extract pearls from content JSONB field
      const content = medicalContent.content as Record<string, unknown>;
      const pearls = Array.isArray(content.clinicalPearls)
        ? (content.clinicalPearls as string[])
        : [];

      return { pearls };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);