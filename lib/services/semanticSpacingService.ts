/**
 * Semantic Spacing Service (Tier 2, Feature 1 — KARL-Inspired)
 *
 * Implements the greedy similarity-spacing algorithm from KAR³L
 * (Shu et al., arXiv:2402.12291, Feb 2024). Given a pool of due cards
 * with embeddings, reorders them to maximize spacing between semantically
 * similar items — reducing interference while preserving FSRS scheduling.
 *
 * Architecture:
 *   FSRS determines WHICH cards are due → Semantic spacing determines ORDER
 *   This is a pure post-filter: it does NOT modify FSRS intervals.
 *
 * Key algorithm:
 *   Greedy Maximum-Minimum Similarity Spacing — at each step, select the
 *   card that maximizes the minimum cosine distance from the last N cards.
 *   This ensures semantically similar cards (e.g., "cardiac output" vs
 *   "cardiac index") are spread apart in the session.
 *
 * Cognitive basis:
 *   - Cepeda et al. (2006): Spacing outperforms massing in 259/271 cases
 *   - Rohrer & Taylor (2007): Interleaving → ~2× retention at 1 week
 *   - KARL: Content-aware scheduling via BERT embeddings + DKT
 *
 * @see lib/services/semanticConfusionService.ts — Confusion pair detection
 * @see lib/services/irtEloService.ts — IRT/Elo ordering (composable)
 * @module lib/services/semanticSpacingService
 */

import { cosineSimilarity } from './semanticConfusionService';

// ─── Types ────────────────────────────────────────────────────────

/** A card with its embedding for similarity-based ordering */
export interface EmbeddedCard {
  /** Card/question ID */
  cardId: string;
  /** Embedding vector (typically 768-dim from Gemini text-embedding-004) */
  embedding: number[];
  /** Optional domain for grouping */
  domain?: string;
  /** Optional IRT/Elo priority score (higher = present sooner) */
  priorityScore?: number;
}

/** Result of the spacing algorithm with metadata */
export interface SpacedCard {
  /** Card/question ID */
  cardId: string;
  /** Position in the spaced order (0-indexed) */
  position: number;
  /** Minimum similarity to any of the preceding N cards when placed */
  minSimilarityToPreceding: number;
  /** Domain (passthrough) */
  domain?: string;
}

/** Configuration for the spacing algorithm */
export interface SpacingConfig {
  /** Number of preceding cards to check for similarity (lookback window) */
  lookbackWindow: number;
  /** Weight for IRT/Elo priority vs spacing objective [0, 1] */
  priorityWeight: number;
  /** Whether to enforce domain interleaving */
  interleaveDomains: boolean;
}

// ─── Constants ────────────────────────────────────────────────────

/** Default lookback window — how many recent cards to check for similarity */
export const DEFAULT_LOOKBACK = 5;

/** Default priority weight (0 = pure spacing, 1 = pure priority) */
export const DEFAULT_PRIORITY_WEIGHT = 0.3;

/** Similarity threshold for "dangerously close" warning */
export const HIGH_SIMILARITY_THRESHOLD = 0.85;

// ─── Similarity Matrix Construction ──────────────────────────────

/**
 * Build a pairwise cosine similarity matrix for a set of cards.
 *
 * Returns a Map keyed by "cardA|||cardB" (sorted IDs) → similarity.
 * Complexity: O(n² × d) where n = cards, d = embedding dimensions.
 * For n=200, d=768 → ~30M operations, runs in <50ms.
 *
 * @param cards - Cards with embeddings
 * @returns Map of pair keys to similarity scores
 */
export function buildSimilarityMatrix(
  cards: ReadonlyArray<EmbeddedCard>
): Map<string, number> {
  const matrix = new Map<string, number>();

  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const sim = cosineSimilarity(cards[i]!.embedding, cards[j]!.embedding);
      const key = normalizePairKey(cards[i]!.cardId, cards[j]!.cardId);
      matrix.set(key, sim);
    }
  }

  return matrix;
}

/**
 * Look up similarity between two cards from the precomputed matrix.
 */
export function lookupSimilarity(
  matrix: Map<string, number>,
  cardA: string,
  cardB: string
): number {
  if (cardA === cardB) return 1.0;
  const key = normalizePairKey(cardA, cardB);
  return matrix.get(key) ?? 0;
}

/**
 * Normalize a pair key for bidirectional lookup.
 */
export function normalizePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|||${idB}` : `${idB}|||${idA}`;
}

// ─── Greedy Maximum-Minimum Spacing Algorithm ────────────────────

/**
 * Reorder cards using greedy maximum-minimum similarity spacing.
 *
 * At each step, from the remaining unplaced cards, select the one that
 * maximizes the minimum cosine DISTANCE (1 - similarity) to any card
 * in the lookback window of recently placed cards.
 *
 * When IRT/Elo priority scores are available, the objective becomes a
 * weighted combination: score = (1 - w) × minDistance + w × normalizedPriority
 *
 * Algorithm complexity: O(n² × lookback) per call — acceptable for
 * session sizes up to ~200 cards.
 *
 * @param cards - Cards with embeddings to reorder
 * @param config - Spacing configuration
 * @returns Ordered array of SpacedCard results
 */
export function greedySimilaritySpacing(
  cards: ReadonlyArray<EmbeddedCard>,
  config: Partial<SpacingConfig> = {}
): SpacedCard[] {
  if (cards.length === 0) return [];
  if (cards.length === 1) {
    return [{
      cardId: cards[0]!.cardId,
      position: 0,
      minSimilarityToPreceding: 0,
      domain: cards[0]!.domain,
    }];
  }

  const {
    lookbackWindow = DEFAULT_LOOKBACK,
    priorityWeight = DEFAULT_PRIORITY_WEIGHT,
    interleaveDomains = true,
  } = config;

  // Build similarity matrix upfront
  const matrix = buildSimilarityMatrix(cards);

  // Normalize priority scores to [0, 1] for weighted combination
  const priorities = normalizePriorities(cards);

  const result: SpacedCard[] = [];
  const remaining = new Set(cards.map(c => c.cardId));
  const cardMap = new Map(cards.map(c => [c.cardId, c]));

  // Step 1: Start with the highest-priority card (or first card)
  const firstId = selectFirstCard(cards, priorities);
  remaining.delete(firstId);
  result.push({
    cardId: firstId,
    position: 0,
    minSimilarityToPreceding: 0,
    domain: cardMap.get(firstId)?.domain,
  });

  // Step 2: Greedily select remaining cards
  while (remaining.size > 0) {
    const recentIds = result
      .slice(-lookbackWindow)
      .map(r => r.cardId);
    const lastDomain = result[result.length - 1]?.domain;

    let bestId = '';
    let bestScore = -Infinity;
    let bestMinSim = 1;

    for (const candidateId of remaining) {
      // Compute minimum cosine distance to recent cards
      let maxSimilarity = 0;
      for (const recentId of recentIds) {
        const sim = lookupSimilarity(matrix, candidateId, recentId);
        if (sim > maxSimilarity) maxSimilarity = sim;
      }
      const minDistance = 1 - maxSimilarity;

      // Domain interleaving bonus: prefer different domain than last card
      let domainBonus = 0;
      if (interleaveDomains && lastDomain) {
        const candidateDomain = cardMap.get(candidateId)?.domain;
        if (candidateDomain && candidateDomain !== lastDomain) {
          domainBonus = 0.1; // Small bonus for domain switching
        }
      }

      // Weighted objective: spacing + priority + domain interleaving
      const priority = priorities.get(candidateId) ?? 0;
      const score = (1 - priorityWeight) * (minDistance + domainBonus) +
                    priorityWeight * priority;

      if (score > bestScore) {
        bestScore = score;
        bestId = candidateId;
        bestMinSim = maxSimilarity;
      }
    }

    if (bestId) {
      remaining.delete(bestId);
      result.push({
        cardId: bestId,
        position: result.length,
        minSimilarityToPreceding: bestMinSim,
        domain: cardMap.get(bestId)?.domain,
      });
    } else {
      break; // Safety: shouldn't happen
    }
  }

  return result;
}

// ─── Domain Interleaving ─────────────────────────────────────────

/**
 * Compute a simple domain diversity score for an ordering.
 *
 * Measures how well domains are interleaved (vs blocked).
 * Score of 1.0 = every consecutive pair is a different domain.
 * Score of 0.0 = all same domain.
 *
 * @param order - Ordered card IDs
 * @param domainMap - Map of card ID → domain
 * @returns Diversity score [0, 1]
 */
export function domainDiversityScore(
  order: ReadonlyArray<string>,
  domainMap: Map<string, string>
): number {
  if (order.length <= 1) return 1.0;

  let switches = 0;
  for (let i = 1; i < order.length; i++) {
    const prevDomain = domainMap.get(order[i - 1]!);
    const currDomain = domainMap.get(order[i]!);
    if (prevDomain && currDomain && prevDomain !== currDomain) {
      switches++;
    }
  }

  return switches / (order.length - 1);
}

// ─── Confusion Pair Spacing Analysis ─────────────────────────────

/**
 * Identify pairs of cards in the ordering that are dangerously close
 * (high similarity, low separation).
 *
 * Returns warnings for cards that are both highly similar AND placed
 * near each other in the final order. Useful for UI warnings or
 * post-hoc quality checks.
 *
 * @param order - Final card ordering
 * @param matrix - Precomputed similarity matrix
 * @param maxSeparation - Maximum position gap to check (default 3)
 * @returns Array of warning entries
 */
export function findCloseHighSimilarityPairs(
  order: ReadonlyArray<SpacedCard>,
  matrix: Map<string, number>,
  maxSeparation: number = 3
): Array<{
  cardA: string;
  cardB: string;
  similarity: number;
  separation: number;
}> {
  const warnings: Array<{
    cardA: string;
    cardB: string;
    similarity: number;
    separation: number;
  }> = [];

  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j <= Math.min(i + maxSeparation, order.length - 1); j++) {
      const sim = lookupSimilarity(matrix, order[i]!.cardId, order[j]!.cardId);
      if (sim >= HIGH_SIMILARITY_THRESHOLD) {
        warnings.push({
          cardA: order[i]!.cardId,
          cardB: order[j]!.cardId,
          similarity: sim,
          separation: j - i,
        });
      }
    }
  }

  return warnings;
}

// ─── Composition with IRT/Elo ────────────────────────────────────

/**
 * Compose IRT/Elo ordering with semantic spacing.
 *
 * Takes an IRT/Elo-ordered session and re-spaces it to separate
 * semantically similar items while preserving the IRT priority signal.
 *
 * This is the recommended integration point: IRT/Elo determines the
 * base priority, then semantic spacing refines the presentation order.
 *
 * @param irtOrderedIds - Card IDs in IRT/Elo priority order
 * @param embeddings - Map of card ID → embedding vector
 * @param config - Spacing configuration (priorityWeight controls IRT influence)
 * @returns Re-spaced ordering
 */
export function composeWithIrtOrdering(
  irtOrderedIds: ReadonlyArray<string>,
  embeddings: Map<string, number[]>,
  config: Partial<SpacingConfig> = {}
): SpacedCard[] {
  // Build EmbeddedCard array with IRT position as priority
  const cards: EmbeddedCard[] = [];

  for (let i = 0; i < irtOrderedIds.length; i++) {
    const id = irtOrderedIds[i]!;
    const embedding = embeddings.get(id);
    if (!embedding) continue; // Skip cards without embeddings

    cards.push({
      cardId: id,
      embedding,
      // Priority = inverse of IRT position (first in IRT = highest priority)
      priorityScore: 1 - (i / Math.max(1, irtOrderedIds.length - 1)),
    });
  }

  // Re-space using greedy algorithm with IRT priority weight
  return greedySimilaritySpacing(cards, {
    priorityWeight: 0.4, // Moderate IRT influence
    ...config,
  });
}

// ─── Utility Functions ───────────────────────────────────────────

/**
 * Normalize priority scores to [0, 1] range.
 */
function normalizePriorities(
  cards: ReadonlyArray<EmbeddedCard>
): Map<string, number> {
  const priorities = new Map<string, number>();
  const scores = cards
    .map(c => c.priorityScore ?? 0)
    .filter(s => s > 0);

  if (scores.length === 0) {
    for (const card of cards) priorities.set(card.cardId, 0);
    return priorities;
  }

  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore;

  for (const card of cards) {
    const raw = card.priorityScore ?? 0;
    const normalized = range > 0 ? (raw - minScore) / range : 0.5;
    priorities.set(card.cardId, normalized);
  }

  return priorities;
}

/**
 * Select the best starting card (highest priority or most unique).
 */
function selectFirstCard(
  cards: ReadonlyArray<EmbeddedCard>,
  priorities: Map<string, number>
): string {
  // Start with the highest-priority card
  let bestId = cards[0]!.cardId;
  let bestPriority = priorities.get(bestId) ?? 0;

  for (const card of cards) {
    const p = priorities.get(card.cardId) ?? 0;
    if (p > bestPriority) {
      bestPriority = p;
      bestId = card.cardId;
    }
  }

  return bestId;
}
