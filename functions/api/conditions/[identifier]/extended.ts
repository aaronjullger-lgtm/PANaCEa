/**
 * API Endpoint: /api/conditions/:identifier/extended
 *
 * Complex condition lookup (UUID � name � slug fallback) with core content
 * NOTE: Uses deprecated Condition table - should migrate to MedicalContent
 */

import { authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { z } from 'zod';

const ExtendedConditionSchema = z.object({
  params: z.object({
    identifier: z.string().min(1, 'Identifier is required'),
  }),
});

export const onRequestGet = authenticatedEndpoint(
  ExtendedConditionSchema,
  async ({ env, validated }) => {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { identifier } = validated.params;
      let condition = null;

      // 1. Try direct ID match (UUID)
      condition = await prisma.condition.findUnique({
        where: { id: identifier },
        include: {
          AnatomyStructure: true,
          SpecialTest: true,
          MediaAsset: true,
        },
      });

      // 2. If not found, try name match (exact, case-insensitive)
      if (!condition) {
        const decodedIdentifier = decodeURIComponent(identifier);
        const conditions = await prisma.condition.findMany({
          where: {
            name: {
              equals: decodedIdentifier.replace(/-/g, ' '), // de-slugify attempt
              mode: 'insensitive',
            },
          },
          include: {
            AnatomyStructure: true,
            SpecialTest: true,
            MediaAsset: true,
          },
        });

        if (conditions.length > 0) {
          condition = conditions[0];
        }
      }

      // 3. If still not found, try searching with raw identifier
      if (!condition) {
        const decodedIdentifier = decodeURIComponent(identifier);
        const conditions = await prisma.condition.findMany({
          where: {
            name: {
              equals: decodedIdentifier,
              mode: 'insensitive',
            },
          },
          include: {
            AnatomyStructure: true,
            SpecialTest: true,
            MediaAsset: true,
          },
        });
        if (conditions.length > 0) {
          condition = conditions[0];
        }
      }

      if (!condition) {
        return {
          error: 'Condition not found',
          status: 404,
        };
      }

      // Fetch core content (MedicalContent) to speed up initial load
      const coreContent = await prisma.medicalContent.findFirst({
        where: {
          OR: [
            { condition: { equals: condition.name, mode: 'insensitive' } },
            { conditionId: condition.name },
          ],
          status: 'published',
        },
      });

      return {
        data: {
          ...condition,
          coreContent: coreContent
          ? {
              ...coreContent,
              etiology: coreContent.etiology,
              pathophysiology: coreContent.pathophysiology,
              // Format etiologyPathophysiology for backward compatibility
              etiologyPathophysiology:
                [
                  coreContent.etiology ? `**Etiology**\n\n${coreContent.etiology}` : null,
                  coreContent.pathophysiology
                    ? `**Pathophysiology**\n\n${coreContent.pathophysiology}`
                    : null,
                ]
                  .filter(Boolean)
                  .join('\n\n') || undefined,
            }
          : null,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
