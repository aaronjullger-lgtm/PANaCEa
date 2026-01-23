/**
 * API: GET /api/anatomy/:id
 *
 * Fetch a single anatomy 3D model by ID.
 * Includes related conditions and clinical pearls.
 *
 * PUBLIC endpoint - anatomy models are educational curriculum content
 */

import { publicEndpoint } from '../_shared/middleware';
import { withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const AnatomyByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Model ID is required'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(AnatomyByIdSchema, async ({ env, validated }) => {
  const log = createEndpointLogger('/api/anatomy/[id]');
  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const modelId = validated.params.id;

    log.info('Fetching anatomy model', { modelId });

    // Fetch the model
    const model = (await prisma.$queryRaw`
      SELECT 
        id,
        name,
        "displayName",
        description,
        system,
        "fileUrl",
        "thumbnailUrl",
        format,
        "fileSize",
        "isCompressed",
        structures,
        "highlightableRegions",
        "clinicalPearls",
        "clinicalRelevance",
        "cameraPosition",
        "cameraTarget",
        "defaultZoom",
        "sourceId",
        "sourceName",
        "sourceUrl",
        license,
        author,
        institution,
        "isHighYield",
        "panceYield",
        "boardYieldFacts",
        status,
        "createdAt",
        "updatedAt"
      FROM "Anatomy3DModel"
      WHERE id = ${modelId}
      LIMIT 1
    `) as any[];

    if (!model || model.length === 0) {
      log.warn('Anatomy model not found', { modelId });
      return { status: 404, error: 'Model not found' };
    }

    // Fetch related conditions via junction table
    const relatedConditions = (await prisma.$queryRaw`
      SELECT 
        c.id,
        c.name,
        c."displayName",
        c.system,
        link."clinicalContext",
        link."viewingHint",
        link."highlightRegions"
      FROM "Anatomy3DModelConditionLink" link
      JOIN "Condition" c ON c.id = link."conditionId"
      WHERE link."modelId" = ${modelId}
      ORDER BY c.name ASC
    `) as any[];

    // Generate citation data
    const modelData = model[0];
    const citation = {
      source: modelData.sourceName || 'NIH 3D Print Exchange',
      modelId: modelData.sourceId,
      title: modelData.displayName || modelData.name,
      author: modelData.author,
      institution: modelData.institution || 'National Institutes of Health',
      license: modelData.license || 'Public Domain',
      url: modelData.sourceUrl || 'https://3d.nih.gov',
      dateAccessed: new Date().toISOString().split('T')[0],
    };

    log.info('Anatomy model fetched successfully', {
      modelId,
      relatedConditionsCount: relatedConditions.length,
    });

    return {
      success: true,
      data: {
        model: {
          ...modelData,
          citation,
        },
        relatedConditions,
      },
    };
  } catch (error) {
    log.error('Error fetching anatomy model', error);
    return {
      status: 500,
      error: 'Failed to fetch anatomy model',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
