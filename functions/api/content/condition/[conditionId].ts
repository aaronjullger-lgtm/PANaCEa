/**
 * Condition Content API
 * GET /api/content/condition/{conditionId}
 * 
 * Public endpoint for fetching medical condition content by ID
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ConditionContentSchema = z.object({
  params: z.object({
    conditionId: z.string().min(1).max(200),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(ConditionContentSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/content/condition/[conditionId]');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const { conditionId } = validated.params;

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const content = await prisma.medicalContent.findFirst({
      where: {
        conditionId,
        status: 'published',
      },
    });

    if (!content) {
      logger.info('Condition not found', {
        conditionId: conditionId.substring(0, 100),
      });
      
      return {
        data: {
          error: 'Condition not found',
          conditionId,
        },
        status: 404,
      };
    }

    logger.info('Condition content fetched', {
      conditionId: conditionId.substring(0, 100),
      condition: content.condition?.substring(0, 50),
      system: content.system,
    });

    return {
      data: {
        conditionId: content.conditionId,
        condition: content.condition,
        system: content.system,
        subcategory: content.subcategory,
        overview: content.overview,
        etiology: content.etiology,
        pathophysiology: content.pathophysiology,
        epidemiology: content.epidemiology,
        symptoms: content.symptoms,
        physicalExam: content.physicalExam,
        diagnostics: content.diagnostics,
        treatment: content.treatment,
        prognosis: content.prognosis,
        differentialDiagnosis: content.differentialDiagnosis,
        riskFactors: content.riskFactors,
        complications: content.complications,
      },
    };
  } catch (error) {
    logger.error('Condition content error', {
      error: error instanceof Error ? error.message : String(error),
      conditionId: validated.params.conditionId.substring(0, 100),
    });
    throw new Error('Failed to fetch condition content');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
