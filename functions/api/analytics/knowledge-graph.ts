/**
 * GET /api/analytics/knowledge-graph
 *
 * Returns the user's prerequisite knowledge graph with mastery overlay.
 * Nodes are clinical concepts (conditions, systems, anatomy); edges are
 * prerequisite/semantic relationships. Each node is colored by the user's
 * mastery (accuracy + stability from UserProgress).
 *
 * Query params:
 *   - system (optional): filter to a specific NCCPA system
 *   - limit (optional): max nodes to return (default 50)
 *
 * @see lib/services/prerequisiteGraphService.ts
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type { CloudflareEnv } from '../_shared/types';

const QuerySchema = z.object({
  system: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

type Env = CloudflareEnv;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(QuerySchema, async (context) => {
  const { env, auth, validated } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof QuerySchema>;
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const userId = auth.userId;
  const { system, limit } = validated;

  try {
    // 1. Fetch graph nodes (optionally filtered by system)
    const nodeWhere: Record<string, unknown> = {};
    if (system) {
      nodeWhere.systemCodes = { has: system };
    }

    const nodes = await prisma.graphNode.findMany({
      where: nodeWhere,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        nodeType: true,
        label: true,
        description: true,
        sourceType: true,
        sourceId: true,
        systemCodes: true,
        metadata: true,
      },
    });

    if (nodes.length === 0) {
      return Response.json({
        nodes: [],
        edges: [],
        mastery: {},
        summary: { totalNodes: 0, totalEdges: 0, avgMastery: 0 },
      });
    }

    const nodeIds = nodes.map((n: { id: string }) => n.id);

    // 2. Fetch edges between these nodes
    const edges = await prisma.graphEdge.findMany({
      where: {
        OR: [
          { sourceId: { in: nodeIds } },
          { targetId: { in: nodeIds } },
        ],
      },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        edgeType: true,
        weight: true,
        description: true,
      },
    });

    // Filter edges to only those where BOTH endpoints are in our node set
    const nodeIdSet = new Set(nodeIds);
    const filteredEdges = edges.filter(
      (e: { sourceId: string; targetId: string }) =>
        nodeIdSet.has(e.sourceId) && nodeIdSet.has(e.targetId)
    );

    // 3. Fetch user mastery for condition-based nodes
    const conditionSourceIds = nodes
      .filter((n: { sourceType: string }) => n.sourceType === 'MedicalContent' || n.sourceType === 'MedicalTaxonomy')
      .map((n: { sourceId: string }) => n.sourceId);

    const progressRecords =
      conditionSourceIds.length > 0
        ? await prisma.userProgress.findMany({
            where: {
              userId,
              conditionId: { in: conditionSourceIds },
            },
            select: {
              conditionId: true,
              accuracy: true,
              totalAttempts: true,
              fsrsCard: true,
            },
          })
        : [];

    // Build mastery map: sourceId → { accuracy, stability, attempts, mastery }
    const masteryMap: Record<
      string,
      { accuracy: number; stability: number; attempts: number; mastery: number }
    > = {};

    for (const p of progressRecords) {
      const fsrs = p.fsrsCard as { stability?: number } | null;
      const stability = fsrs?.stability ?? 0;
      const accuracy = p.accuracy ?? 0;
      const attempts = p.totalAttempts ?? 0;

      // Mastery = weighted combo of accuracy and stability
      // Accuracy matters more early; stability matters more later
      const stabilityNorm = Math.min(1, stability / 30); // 30-day stability = 1.0
      const mastery =
        attempts >= 3
          ? 0.5 * accuracy + 0.5 * stabilityNorm
          : attempts > 0
            ? 0.3 * accuracy + 0.1 * stabilityNorm
            : 0;

      masteryMap[p.conditionId] = {
        accuracy: Math.round(accuracy * 100) / 100,
        stability: Math.round(stability * 10) / 10,
        attempts,
        mastery: Math.round(mastery * 100) / 100,
      };
    }

    // Map mastery back to node IDs
    const nodeMastery: Record<string, { accuracy: number; stability: number; attempts: number; mastery: number }> = {};
    for (const node of nodes) {
      const m = masteryMap[node.sourceId];
      if (m) {
        nodeMastery[node.id] = m;
      }
    }

    // 4. Summary stats
    const masteryValues = Object.values(nodeMastery).map((m) => m.mastery);
    const avgMastery =
      masteryValues.length > 0
        ? Math.round(
            (masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length) * 100
          ) / 100
        : 0;

    return Response.json({
      nodes: nodes.map((n: { id: string; nodeType: string; label: string; description: string | null; sourceType: string; sourceId: string; systemCodes: string[]; metadata: unknown }) => ({
        id: n.id,
        type: n.nodeType,
        label: n.label,
        description: n.description,
        sourceType: n.sourceType,
        sourceId: n.sourceId,
        systems: n.systemCodes,
        mastery: nodeMastery[n.id] ?? null,
      })),
      edges: filteredEdges.map((e: { id: string; sourceId: string; targetId: string; edgeType: string; weight: number | null; description: string | null }) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        type: e.edgeType,
        weight: e.weight ?? 1,
        description: e.description,
      })),
      summary: {
        totalNodes: nodes.length,
        totalEdges: filteredEdges.length,
        avgMastery,
        nodesWithMastery: Object.keys(nodeMastery).length,
      },
    });
  } catch (err) {
    console.error('[knowledge-graph] Error:', err);
    return Response.json(
      { error: 'Failed to fetch knowledge graph' },
      { status: 500 }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
