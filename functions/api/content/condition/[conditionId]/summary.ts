/**
 * Condition Summary API (Fast)
 * GET /api/content/condition/:conditionId/summary
 *
 * Minimal payload for Header + Cheat Sheet tab. Target < 2KB.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { ConditionSummarySchema } from '@/lib/schemas/medicalContent';

const ParamsSchema = z.object({
  conditionId: z.string().min(1).max(200),
});

export const onRequestGet = authenticatedEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, validated } = context;
    const { conditionId } = validated;

    if (!env.DATABASE_URL) {
      return {
        data: { error: 'Service unavailable', message: 'Database is not configured.' },
        status: 503,
      };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Try exact conditionId match first (fast path for UUID)
      let content = await prisma.medicalContent.findFirst({
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
          updatedAt: true,
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
        // Fallback: try matching by condition name (slug / display name) when UUID fails
        // This handles cases where the client passes a slugified name instead of a UUID
        const slug = conditionId.replace(/-/g, ' ').toLowerCase();
        content = await prisma.medicalContent.findFirst({
          where: {
            status: 'published',
            OR: [
              { condition: { equals: conditionId, mode: 'insensitive' } },
              { condition: { equals: slug, mode: 'insensitive' } },
            ],
          },
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
            updatedAt: true,
            ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent: {
              select: {
                MedicalContent_ConfusionPair_selectedConditionIdToMedicalContent: {
                  select: { id: true, conditionId: true, condition: true },
                },
              },
            },
          },
        });
      }

      if (!content) {
        return {
          data: { error: 'Condition not found', conditionId },
          status: 404,
        };
      }

      const confusedWith = [
        ...new Map(
          content.ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent.map(
            (p) => p.MedicalContent_ConfusionPair_selectedConditionIdToMedicalContent
          )
            .filter(Boolean)
            .map((mc) => [
              mc!.id,
              { id: mc!.id, conditionId: mc!.conditionId, condition: mc!.condition },
            ])
        ).values(),
      ];

      const { ConfusionPair_ConfusionPair_correctConditionIdToMedicalContent: _, ...rest } =
        content;
      const data = {
        ...rest,
        confusedWith,
      };
      const parsed = ConditionSummarySchema.safeParse(data);
      if (!parsed.success) {
        console.warn('[condition/summary] response shape validation failed', parsed.error.issues);
      }
      return {
        data: parsed.success ? parsed.data : data,
        headers: { 'Cache-Control': 'public, max-age=300' },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[condition/summary]', errMsg);
      return {
        data: { error: 'Failed to load condition', message: 'Please try again later.', conditionId },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
