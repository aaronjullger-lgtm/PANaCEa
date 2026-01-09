/**
 * API: GET /api/anatomy/:id
 * 
 * Fetch a single anatomy 3D model by ID.
 * Includes related conditions and clinical pearls.
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

interface CloudflareEnv {
  DATABASE_URL: string;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

export async function onRequestGet(context: { request: Request; env: CloudflareEnv; params: { id: string } }): Promise<Response> {
  const { env, params } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const modelId = params.id;

    if (!modelId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Model ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Fetch the model
    const model = await prisma.$queryRaw`
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
    ` as any[];

    if (!model || model.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Model not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Fetch related conditions via junction table
    const relatedConditions = await prisma.$queryRaw`
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
    ` as any[];

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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          model: {
            ...modelData,
            citation,
          },
          relatedConditions,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    console.error('Error fetching anatomy model:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch anatomy model',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
