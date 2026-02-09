/**
 * Condition Summary API (Fast)
 * GET /api/content/condition/:conditionId/summary
 *
 * Minimal payload for Header + Cheat Sheet tab. Target < 2KB.
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';

const ParamsSchema = z.object({
  conditionId: z.string().min(1).max(200),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, validated } = context;
    const { conditionId } = validated;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const content = await prisma.medicalContent.findFirst({
        where: { conditionId, status: 'published' },
        select: {
          id: true,
          condition: true,
          conditionId: true,
          system: true,
          pance_yield: true,
          buzzwords: true,
          synonyms: true,
          classic_triad: true,
          clinical_pearls: true,
          mnemonic: true,
          ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent: {
            select: {
              MedicalContent_ConfusionPair_selectedConditionIdToMedicalContent: {
                select: { id: true, conditionId: true, condition: true },
              },
            },
          },
        },
      });

      if (!content) {
        return {
          data: { error: 'Condition not found', conditionId },
          status: 404,
        };
      }

      const confusedWith = [
        ...new Map(
          content.ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent
            .map((p) => p.MedicalContent_ConfusionPair_selectedConditionIdToMedicalContent)
            .filter(Boolean)
            .map((mc) => [mc!.id, { id: mc!.id, conditionId: mc!.conditionId, condition: mc!.condition }])
        ).values(),
      ];

      const { ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent: _, ...rest } = content;
      const data = {
        ...rest,
        confusedWith,
      };

      return {
        data,
        headers: { 'Cache-Control': 'public, max-age=300' },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
