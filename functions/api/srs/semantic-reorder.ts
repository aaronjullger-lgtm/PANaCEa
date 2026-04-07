/**
 * POST /api/srs/semantic-reorder
 *
 * Given a pool of due card IDs, returns them reordered to maximize
 * spacing between semantically similar items (KARL algorithm).
 *
 * Uses precomputed question embeddings from the QuestionEmbedding table
 * and the greedy maximum-minimum spacing algorithm.
 *
 * Can compose with IRT/Elo ordering: pass irtOrderedIds to use IRT
 * priority as a weighted input alongside spacing.
 *
 * Request body:
 *   { cardIds: string[], domain?: string, irtOrderedIds?: string[] }
 *
 * Response:
 *   { orderedCardIds: string[], warnings: { cardA, cardB, similarity, separation }[] }
 *
 * @see lib/services/semanticSpacingService.ts — Pure computation
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext, type ValidatedContext } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

// ─── Inline pure functions (Edge can't import from lib/) ─────────

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i]! * vecB[i]!;
    normA += vecA[i]! * vecA[i]!;
    normB += vecB[i]! * vecB[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function normKey(a: string, b: string): string {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`;
}

const HIGH_SIM = 0.85;
const LOOKBACK = 5;

const SemanticReorderSchema = z.object({
  body: z.object({
    cardIds: z.array(z.string()).min(1).max(200),
    domain: z.string().optional(),
    /** If provided, IRT ordering is used as priority signal */
    irtOrderedIds: z.array(z.string()).optional(),
    /** Priority weight for IRT ordering [0, 1], default 0.3 */
    priorityWeight: z.number().min(0).max(1).optional(),
  }),
});

type SemanticReorderBody = z.infer<typeof SemanticReorderSchema>;

export const onRequestPost = authenticatedEndpoint(
  SemanticReorderSchema,
  async (context: AuthenticatedContext & ValidatedContext<SemanticReorderBody>) => {
    const { cardIds, irtOrderedIds, priorityWeight = 0.3 } = context.validated.body;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      // Fetch embeddings for requested cards (raw SQL for pgvector)
      const embeddings = await prisma.$queryRaw<
        Array<{ questionId: string; embedding: string }>
      >`
        SELECT "questionId", "embedding"::text
        FROM "QuestionEmbedding"
        WHERE "questionId" = ANY(${cardIds})
      `;

      // Parse embedding strings to number arrays
      const embeddingMap = new Map<string, number[]>();
      for (const row of embeddings) {
        // pgvector returns "[0.1,0.2,...]" format — already valid JSON
        const parsed = JSON.parse(row.embedding);
        embeddingMap.set(row.questionId, parsed);
      }

      // Cards with embeddings
      const cardsWithEmbeddings = cardIds.filter(id => embeddingMap.has(id));
      const cardsWithoutEmbeddings = cardIds.filter(id => !embeddingMap.has(id));

      if (cardsWithEmbeddings.length <= 1) {
        // Not enough embedded cards to reorder — return original order
        return {
          data: {
            orderedCardIds: cardIds,
            warnings: [],
            embeddedCount: cardsWithEmbeddings.length,
            totalCount: cardIds.length,
          },
        };
      }

      // Build priority map from IRT ordering
      const priorities = new Map<string, number>();
      if (irtOrderedIds && irtOrderedIds.length > 0) {
        for (let i = 0; i < irtOrderedIds.length; i++) {
          priorities.set(irtOrderedIds[i]!, 1 - (i / Math.max(1, irtOrderedIds.length - 1)));
        }
      }

      // Build similarity matrix
      const matrix = new Map<string, number>();
      for (let i = 0; i < cardsWithEmbeddings.length; i++) {
        for (let j = i + 1; j < cardsWithEmbeddings.length; j++) {
          const a = cardsWithEmbeddings[i]!;
          const b = cardsWithEmbeddings[j]!;
          const sim = cosineSimilarity(embeddingMap.get(a)!, embeddingMap.get(b)!);
          matrix.set(normKey(a, b), sim);
        }
      }

      // Greedy spacing algorithm
      const ordered: string[] = [];
      const remaining = new Set(cardsWithEmbeddings);

      // Start with highest-priority card
      let firstId = cardsWithEmbeddings[0]!;
      let bestPri = -Infinity;
      for (const id of cardsWithEmbeddings) {
        const p = priorities.get(id) ?? 0;
        if (p > bestPri) { bestPri = p; firstId = id; }
      }
      remaining.delete(firstId);
      ordered.push(firstId);

      while (remaining.size > 0) {
        const recent = ordered.slice(-LOOKBACK);
        let bestId = '';
        let bestScore = -Infinity;

        for (const cid of remaining) {
          let maxSim = 0;
          for (const rid of recent) {
            const key = normKey(cid, rid);
            const sim = matrix.get(key) ?? 0;
            if (sim > maxSim) maxSim = sim;
          }
          const dist = 1 - maxSim;
          const pri = priorities.get(cid) ?? 0;
          const score = (1 - priorityWeight) * dist + priorityWeight * pri;
          if (score > bestScore) { bestScore = score; bestId = cid; }
        }

        if (bestId) {
          remaining.delete(bestId);
          ordered.push(bestId);
        } else break;
      }

      // Append non-embedded cards at the end (preserve their original order)
      const finalOrder = [...ordered, ...cardsWithoutEmbeddings];

      // Find close high-similarity warnings
      const warnings: Array<{
        cardA: string;
        cardB: string;
        similarity: number;
        separation: number;
      }> = [];

      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j <= Math.min(i + 3, ordered.length - 1); j++) {
          const sim = matrix.get(normKey(ordered[i]!, ordered[j]!)) ?? 0;
          if (sim >= HIGH_SIM) {
            warnings.push({
              cardA: ordered[i]!,
              cardB: ordered[j]!,
              similarity: Math.round(sim * 1000) / 1000,
              separation: j - i,
            });
          }
        }
      }

      return {
        data: {
          orderedCardIds: finalOrder,
          warnings,
          embeddedCount: cardsWithEmbeddings.length,
          totalCount: cardIds.length,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Semantic reorder failed';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
