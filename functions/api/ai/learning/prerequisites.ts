/**
 * POST /api/intelligence/prerequisite-remediation
 *
 * Error-driven prerequisite remediation endpoint (Tier 2, Feature 2).
 *
 * When a student fails a card during a session, the client calls this endpoint
 * to get up to 3 remediation cards targeting weak prerequisite concepts.
 *
 * Flow:
 *   1. Look up the failed card's conditionFamily and conceptId
 *   2. Traverse prerequisite graph via recursive CTE (max depth 5)
 *   3. Check mastery state for each prerequisite (MasteryProgress + QuestionAttempt)
 *   4. Rank weak prerequisites by depth and severity
 *   5. Select remediation cards from the question bank
 *   6. Return ordered list for injection into the session queue
 *
 * Request body:
 *   { failedCardId: string }
 *
 * Response:
 *   { remediationCards: [...], weakPrerequisites: [...], skipped: boolean }
 *
 * @see lib/services/prerequisiteRemediationService.ts — Pure computation
 * @see lib/services/fireImplicitCreditService.ts — Complementary (credit on success)
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors, type AuthenticatedContext, type ValidatedContext } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

// ─── Schema ──────────────────────────────────────────────────────

const RemediationSchema = z.object({
  body: z.object({
    failedCardId: z.string().min(1),
    maxCards: z.number().min(1).max(5).optional(),
  }),
});

type RemediationBody = z.infer<typeof RemediationSchema>;

// ─── Inlined constants (Edge can't import from lib/) ─────────────

const MAX_DEPTH = 5;
const MAX_REMEDIATION_CARDS = 3;
const MASTERY_THRESHOLD = 0.70;
const STALE_DAYS = 30;

type WeaknessType = 'never_seen' | 'low_accuracy' | 'high_lapse_rate' | 'stale_review' | 'shallow_encoding';

const WEAKNESS_PRIORITY: Record<WeaknessType, number> = {
  never_seen: 100,
  low_accuracy: 80,
  high_lapse_rate: 70,
  shallow_encoding: 60,
  stale_review: 50,
};

// ─── CORS ────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

// ─── Handler ─────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  RemediationSchema,
  async (context: AuthenticatedContext & ValidatedContext<RemediationBody>) => {
    const userId = context.auth.userId;
    const { failedCardId, maxCards } = context.validated.body;
    const budget = maxCards ?? MAX_REMEDIATION_CARDS;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      // Step 1: Get the failed card's condition family and graph node reference
      const failedCard = await prisma.preGeneratedQuestion.findUnique({
        where: { id: failedCardId },
        select: {
          conditionFamily: true,
          conditionId: true,
          hierarchyLevel: true,
          system: true,
        },
      });

      if (!failedCard?.conditionFamily && !failedCard?.conditionId) {
        return {
          data: {
            remediationCards: [],
            weakPrerequisites: [],
            prerequisitesChecked: 0,
            skipped: true,
            skipReason: 'Failed card has no condition mapping — cannot traverse prerequisites',
          },
        };
      }

      const conceptKey = failedCard.conditionFamily || failedCard.conditionId || '';

      // Step 2: Find the GraphNode for this concept
      const sourceNode = await prisma.graphNode.findFirst({
        where: {
          OR: [
            { sourceId: conceptKey },
            { label: conceptKey },
          ],
        },
        select: { id: true },
      });

      if (!sourceNode) {
        return {
          data: {
            remediationCards: [],
            weakPrerequisites: [],
            prerequisitesChecked: 0,
            skipped: true,
            skipReason: 'No graph node found for this concept — knowledge graph may need population',
          },
        };
      }

      // Step 3: Traverse prerequisite graph via recursive CTE
      const prerequisites: Array<{
        conceptId: string;
        conceptName: string;
        systemCodes: string[];
        depth: number;
      }> = await prisma.$queryRaw`
        WITH RECURSIVE prereqs AS (
          SELECT
            ge."targetId" AS "conceptId",
            gn."label" AS "conceptName",
            gn."systemCodes",
            1 AS depth
          FROM "GraphEdge" ge
          JOIN "GraphNode" gn ON gn."id" = ge."targetId"
          WHERE ge."sourceId" = ${sourceNode.id}
            AND ge."edgeType" IN ('HIERARCHICAL', 'SEMANTIC')
          UNION ALL
          SELECT
            ge."targetId" AS "conceptId",
            gn."label" AS "conceptName",
            gn."systemCodes",
            p.depth + 1
          FROM "GraphEdge" ge
          JOIN "GraphNode" gn ON gn."id" = ge."targetId"
          JOIN prereqs p ON ge."sourceId" = p."conceptId"
          WHERE p.depth < ${MAX_DEPTH}
        )
        SELECT DISTINCT ON ("conceptId")
          "conceptId",
          "conceptName",
          "systemCodes",
          depth
        FROM prereqs
        ORDER BY "conceptId", depth ASC
      `;

      if (prerequisites.length === 0) {
        return {
          data: {
            remediationCards: [],
            weakPrerequisites: [],
            prerequisitesChecked: 0,
            skipped: true,
            skipReason: 'No prerequisites found in knowledge graph for this concept',
          },
        };
      }

      // Step 4: Get mastery data for each prerequisite concept
      const masteryRows = await prisma.masteryProgress.findMany({
        where: {
          userId,
          conditionName: { in: prerequisites.map(p => p.conceptName) },
        },
        select: {
          conditionName: true,
          accuracy: true,
          attempts: true,
          lastAttempt: true,
        },
      });

      // Build mastery lookup
      const masteryByName = new Map(masteryRows.map(m => [m.conditionName, m]));
      const now = new Date();

      // Step 5: Identify weak prerequisites
      const weakPrereqs: Array<{
        conceptId: string;
        conceptName: string;
        system: string;
        depth: number;
        weakness: WeaknessType;
        priority: number;
        mastery: number;
      }> = [];

      for (const prereq of prerequisites) {
        const mastery = masteryByName.get(prereq.conceptName);
        const accuracy = mastery?.accuracy ?? null;
        const attempts = mastery?.attempts ?? 0;
        const daysSinceReview = mastery?.lastAttempt
          ? (now.getTime() - mastery.lastAttempt.getTime()) / (1000 * 60 * 60 * 24)
          : null;

        // Classify weakness
        let weakness: WeaknessType | null = null;
        if (attempts === 0 || accuracy === null) {
          weakness = 'never_seen';
        } else if (accuracy < MASTERY_THRESHOLD) {
          weakness = 'low_accuracy';
        } else if (daysSinceReview !== null && daysSinceReview > STALE_DAYS) {
          weakness = 'stale_review';
        }

        if (!weakness) continue;

        // Compute priority
        let priority = WEAKNESS_PRIORITY[weakness];
        priority += prereq.depth * 5;
        priority += Math.round((1 - (accuracy ?? 0)) * 20);

        weakPrereqs.push({
          conceptId: prereq.conceptId,
          conceptName: prereq.conceptName,
          system: (prereq.systemCodes?.[0]) ?? failedCard.system ?? 'unknown',
          depth: prereq.depth,
          weakness,
          priority,
          mastery: accuracy ?? 0,
        });
      }

      // Sort by priority descending
      weakPrereqs.sort((a, b) => b.priority - a.priority);

      if (weakPrereqs.length === 0) {
        return {
          data: {
            remediationCards: [],
            weakPrerequisites: [],
            prerequisitesChecked: prerequisites.length,
            skipped: true,
            skipReason: 'All prerequisites meet mastery threshold',
          },
        };
      }

      // Step 6: Select remediation cards for weak prerequisites
      const topWeakConcepts = weakPrereqs.slice(0, budget * 2); // Overfetch for fallback
      const conceptNames = topWeakConcepts.map(w => w.conceptName);

      const candidateCards = await prisma.preGeneratedQuestion.findMany({
        where: {
          conditionFamily: { in: conceptNames },
          status: 'active',
        },
        select: {
          id: true,
          conditionFamily: true,
          conditionId: true,
          hierarchyLevel: true,
          system: true,
        },
        take: budget * 5,
        orderBy: { hierarchyLevel: 'asc' }, // Prefer foundational (level 1)
      });

      // Match cards to weak prerequisites
      const remediationCards: Array<{
        cardId: string;
        prerequisiteConceptId: string;
        prerequisiteConceptName: string;
        prerequisiteDepth: number;
        remediationReason: string;
        hierarchyLevel: number;
      }> = [];

      const usedCards = new Set<string>();
      const usedConcepts = new Set<string>();

      for (const prereq of topWeakConcepts) {
        if (remediationCards.length >= budget) break;
        if (usedConcepts.has(prereq.conceptId)) continue;

        const card = candidateCards.find(
          c => c.conditionFamily === prereq.conceptName && !usedCards.has(c.id)
        );
        if (!card) continue;

        const depthLabel = prereq.depth === 1 ? 'direct prerequisite' : `prerequisite (depth ${prereq.depth})`;
        let reason: string;
        switch (prereq.weakness) {
          case 'never_seen':
            reason = `${prereq.conceptName} is a ${depthLabel} you haven't studied yet`;
            break;
          case 'low_accuracy':
            reason = `${prereq.conceptName} is a ${depthLabel} with ${Math.round(prereq.mastery * 100)}% accuracy`;
            break;
          case 'stale_review':
            reason = `${prereq.conceptName} is a ${depthLabel} you haven't reviewed recently`;
            break;
          default:
            reason = `${prereq.conceptName} is a ${depthLabel} needing reinforcement`;
        }

        remediationCards.push({
          cardId: card.id,
          prerequisiteConceptId: prereq.conceptId,
          prerequisiteConceptName: prereq.conceptName,
          prerequisiteDepth: prereq.depth,
          remediationReason: reason,
          hierarchyLevel: card.hierarchyLevel ?? 1,
        });

        usedCards.add(card.id);
        usedConcepts.add(prereq.conceptId);
      }

      return {
        data: {
          remediationCards,
          weakPrerequisites: weakPrereqs.slice(0, 10), // Cap response size
          prerequisitesChecked: prerequisites.length,
          skipped: remediationCards.length === 0,
          skipReason: remediationCards.length === 0 ? 'No available cards for weak prerequisites' : undefined,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Prerequisite remediation failed';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 60 }
);
