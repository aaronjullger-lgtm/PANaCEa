/**
 * POST /api/cron/populate-prerequisites
 *
 * Populates the knowledge graph with SEMANTIC prerequisite edges derived
 * from existing clinical relationship data (anatomy links, drug links,
 * condition hierarchies, complication chains, cross-system dependencies).
 *
 * These edges power the prerequisite remediation pipeline
 * (prerequisiteRemediationService) and future FIRe review compression.
 *
 * Designed to run weekly via Cloudflare Cron Triggers or manual invocation.
 * Idempotent — uses upsert on (sourceId, targetId, edgeType) unique constraint.
 *
 * @see lib/services/prerequisiteGraphService.ts — Pure edge generation logic
 * @see lib/services/prerequisiteRemediationService.ts — Consumes these edges
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type { CloudflareEnv } from '../_shared/types';
import {
  collectAllPrerequisiteEdges,
  type ConditionNode,
  type AnatomyLink,
  type DrugLink,
  type ComplicationLink,
  type ParentChildLink,
} from '../../../lib/services/prerequisiteGraphService';

const BodySchema = z
  .object({
    /** If true, delete existing prerequisiteGraphService edges before repopulating */
    rebuild: z.boolean().optional().default(false),
    /** Batch size for upsert operations */
    batchSize: z.number().int().min(50).max(5000).optional().default(500),
  })
  .optional()
  .default({});

type Env = CloudflareEnv & { CACHE?: KVNamespace };

export const onRequestOptions = withCors();

export const onRequestPost = adminAuthenticatedEndpoint(BodySchema, async (context) => {
  const { env, validated } = context as {
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // 0. Optionally clear existing prerequisite edges
    if (validated.rebuild) {
      const deleted = await prisma.graphEdge.deleteMany({
        where: {
          edgeType: 'SEMANTIC',
          metadata: { path: ['generatedBy'], equals: 'prerequisiteGraphService' },
        },
      });
      errors.push(`Rebuild mode: deleted ${deleted.count} existing prerequisite edges`);
    }

    // 1. Fetch all condition nodes from the graph
    const conditionNodes = await prisma.graphNode.findMany({
      where: { nodeType: 'CONDITION' },
      select: { id: true, sourceId: true, label: true, systemCodes: true, metadata: true },
    });

    const conditions: ConditionNode[] = conditionNodes.map((n) => ({
      id: n.id,
      sourceId: n.sourceId,
      label: n.label,
      systemCodes: n.systemCodes,
      metadata: n.metadata as Record<string, unknown> | null,
    }));

    // 2. Fetch system nodes and build lookup map
    const systemNodes = await prisma.graphNode.findMany({
      where: { nodeType: 'SYSTEM' },
      select: { id: true, label: true },
    });
    const systemNodeIds = new Map<string, string>(
      systemNodes.map((n) => [n.label, n.id])
    );

    // 3. Fetch anatomy-condition links via AnatomyConditionLink join table
    const rawAnatomyLinks = await prisma.$queryRaw<
      Array<{
        conditionNodeId: string;
        anatomyNodeId: string;
        conditionLabel: string;
        anatomyLabel: string;
      }>
    >`
      SELECT
        gc.id AS "conditionNodeId",
        ga.id AS "anatomyNodeId",
        gc.label AS "conditionLabel",
        ga.label AS "anatomyLabel"
      FROM "AnatomyConditionLink" acl
      JOIN "GraphNode" gc ON gc."sourceType" = 'MedicalContent' AND gc."sourceId" = acl."conditionId"
      JOIN "GraphNode" ga ON ga."sourceType" = 'AnatomyStructure' AND ga."sourceId" = acl."anatomyId"
    `;
    const anatomyLinks: AnatomyLink[] = rawAnatomyLinks;

    // 4. Fetch drug-condition links via DrugConditionLink join table
    const rawDrugLinks = await prisma.$queryRaw<
      Array<{
        drugNodeId: string;
        conditionNodeId: string;
        drugLabel: string;
        conditionLabel: string;
      }>
    >`
      SELECT
        gd.id AS "drugNodeId",
        gc.id AS "conditionNodeId",
        gd.label AS "drugLabel",
        gc.label AS "conditionLabel"
      FROM "DrugConditionLink" dcl
      JOIN "GraphNode" gd ON gd."sourceType" = 'Drug' AND gd."sourceId" = dcl."drugId"
      JOIN "GraphNode" gc ON gc."sourceType" = 'MedicalContent' AND gc."sourceId" = dcl."conditionId"
    `;
    const drugLinks: DrugLink[] = rawDrugLinks;

    // 5. Fetch complication edges (existing COMPLICATES edges in the graph)
    const complicationEdges = await prisma.graphEdge.findMany({
      where: { edgeType: 'COMPLICATES' },
      select: {
        sourceId: true,
        targetId: true,
        source: { select: { label: true } },
        target: { select: { label: true } },
      },
    });
    const complicationLinks: ComplicationLink[] = complicationEdges.map((e) => ({
      sourceNodeId: e.sourceId,
      targetNodeId: e.targetId,
      sourceLabel: e.source.label,
      targetLabel: e.target.label,
    }));

    // 6. Fetch parent-child relationships from MedicalContent hierarchy
    const rawParentChild = await prisma.$queryRaw<
      Array<{
        parentNodeId: string;
        childNodeId: string;
        parentLabel: string;
        childLabel: string;
      }>
    >`
      SELECT
        gp.id AS "parentNodeId",
        gc.id AS "childNodeId",
        gp.label AS "parentLabel",
        gc.label AS "childLabel"
      FROM "MedicalContent" mc
      JOIN "GraphNode" gc ON gc."sourceType" = 'MedicalContent' AND gc."sourceId" = mc."conditionId"
      JOIN "MedicalContent" mp ON mp."conditionId" = mc."parentId"
      JOIN "GraphNode" gp ON gp."sourceType" = 'MedicalContent' AND gp."sourceId" = mp."conditionId"
      WHERE mc."parentId" IS NOT NULL
    `;
    const parentChildLinks: ParentChildLink[] = rawParentChild;

    // 7. Generate all prerequisite edges
    const { edges, byRule } = collectAllPrerequisiteEdges({
      conditions,
      systemNodeIds,
      anatomyLinks,
      drugLinks,
      complicationLinks,
      parentChildLinks,
    });

    // 8. Batch upsert edges
    let upsertedCount = 0;
    const batchSize = validated.batchSize;

    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize);
      try {
        await prisma.$transaction(
          batch.map((edge) =>
            prisma.graphEdge.upsert({
              where: {
                sourceId_targetId_edgeType: {
                  sourceId: edge.sourceId,
                  targetId: edge.targetId,
                  edgeType: edge.edgeType,
                },
              },
              update: {
                weight: edge.weight,
                description: edge.description,
                evidenceCount: edge.evidenceCount,
                metadata: edge.metadata,
                updatedAt: new Date(),
              },
              create: {
                id: edge.id,
                sourceId: edge.sourceId,
                targetId: edge.targetId,
                edgeType: edge.edgeType,
                weight: edge.weight,
                description: edge.description,
                evidenceCount: edge.evidenceCount,
                metadata: edge.metadata,
              },
            })
          )
        );
        upsertedCount += batch.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Batch ${i / batchSize + 1} partial failure: ${msg}`);
        // Continue with remaining batches
      }
    }

    const durationMs = Date.now() - startTime;

    // 9. Cache result summary in KV
    if (env.CACHE) {
      const summary = { edgesUpserted: upsertedCount, byRule, durationMs, timestamp: new Date().toISOString() };
      await env.CACHE.put(
        'prerequisite-graph:last-run',
        JSON.stringify(summary),
        { expirationTtl: 60 * 60 * 24 * 7 } // 7 days
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        edgesUpserted: upsertedCount,
        edgesGenerated: edges.length,
        byRule,
        sourceData: {
          conditions: conditions.length,
          systemNodes: systemNodes.length,
          anatomyLinks: anatomyLinks.length,
          drugLinks: drugLinks.length,
          complicationLinks: complicationLinks.length,
          parentChildLinks: parentChildLinks.length,
        },
        durationMs,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Prerequisite population failed: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
