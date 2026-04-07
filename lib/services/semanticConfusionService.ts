/**
 * Semantic Confusion Detection Service — Tier 3 (LECTOR-inspired)
 *
 * Extends confusionPairRecurrenceService with two complementary detection
 * approaches per tier3.md research:
 *
 *   1. Embedding-based detection: Cosine similarity between card contents
 *      using text embeddings. Cards with similarity > threshold are flagged
 *      as potential confusion pairs BEFORE user data accumulates.
 *
 *   2. Co-failure mining: When a student fails Card A and subsequently fails
 *      Card B within the same session or short time window, the co-failure
 *      is logged. Association rule mining (support, confidence, lift) surfaces
 *      statistically significant confusion pairs from accumulated review data.
 *
 * LECTOR architecture (arXiv:2508.03275):
 *   - Semantic similarity matrix S[i,j] for pairwise concept relationships
 *   - Forgetting curve modulated by semantic interference factor
 *   - LECTOR achieved 90.2% vs FSRS 89.6% in simulations
 *
 * The real value is in identifying and surfacing confusion pairs for
 * interleaved scheduling and contrastive drills.
 *
 * Research basis:
 *   - LECTOR (arXiv:2508.03275): LLM-Enhanced Concept-based Test-Oriented Repetition
 *   - ISMP: LASA errors = up to 25% of all medication errors
 *   - Interleaving (2023 systematic review): Forces discriminative contrast
 *   - Interleaved cards should be separated by 2-5 intervening items
 *
 * @module lib/services/semanticConfusionService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConfusionSource = 'embedding' | 'co_failure' | 'both';
export type ConfusionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SemanticConfusionPair {
  /** First concept identifier */
  conceptA: string;
  /** Second concept identifier */
  conceptB: string;
  /** Cosine similarity score (embedding-based) [0, 1] */
  similarityScore: number;
  /** Number of co-failures (empirical) */
  coFailureCount: number;
  /** Detection source */
  source: ConfusionSource;
  /** Severity classification */
  severity: ConfusionSeverity;
  /** Whether interleaved scheduling is recommended */
  interleavingRecommended: boolean;
  /** Whether a contrastive drill should be queued */
  contrastiveDrillRecommended: boolean;
  /** Semantic interference factor for FSRS stability modification */
  interferenceModifier: number;
}

/** Co-failure event for mining */
export interface CoFailureEvent {
  /** Card that was answered incorrectly */
  failedCardId: string;
  /** Concept/condition associated with the failed card */
  conceptId: string;
  /** Session ID (for temporal grouping) */
  sessionId: string;
  /** Timestamp of the failure */
  timestamp: number;
}

/** Association rule metrics for a concept pair */
export interface AssociationMetrics {
  /** P(A fails AND B fails) */
  support: number;
  /** P(B fails | A fails) */
  confidence: number;
  /** confidence / P(B fails) — values > 1 indicate association */
  lift: number;
  /** Number of co-failure observations */
  count: number;
}

/** Interleaving schedule recommendation */
export interface InterleavingSchedule {
  /** Cards to interleave (confusion pair + intervening items) */
  cardSequence: string[];
  /** Number of intervening items between confused pair */
  separationCount: number;
  /** Reason for this interleaving */
  reason: string;
}

/** Known LASA (Look-Alike Sound-Alike) pairs for bootstrapping */
export interface LasaPair {
  termA: string;
  termB: string;
  category: 'medication' | 'condition' | 'anatomy' | 'lab_value';
  severity: 'low' | 'medium' | 'high';
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Cosine similarity threshold for flagging potential confusion pairs */
export const SIMILARITY_THRESHOLD = 0.85;

/** Minimum co-failures to consider a pair empirically significant */
export const MIN_CO_FAILURES = 3;

/** Time window for co-failure detection (same session or within N minutes) */
export const CO_FAILURE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/** Interleaving: optimal separation distance per research */
export const INTERLEAVING_SEPARATION = { min: 2, max: 5 } as const;

/** Severity thresholds based on combined similarity + co-failure evidence */
export const SEVERITY_THRESHOLDS = {
  medium: 0.40,
  high: 0.60,
  critical: 0.80,
} as const;

/** LECTOR semantic interference modifier range */
export const INTERFERENCE_MODIFIER_RANGE = {
  /** Minimum stability reduction for mild interference */
  min: 0.95,
  /** Maximum stability reduction for severe interference */
  max: 0.75,
} as const;

/** Known LASA pairs for bootstrapping (commonly confused medical terms) */
export const KNOWN_LASA_PAIRS: LasaPair[] = [
  // Medications
  { termA: 'hydrALAzine', termB: 'hydrOXYzine', category: 'medication', severity: 'high' },
  { termA: 'DOBUTamine', termB: 'DOPamine', category: 'medication', severity: 'high' },
  { termA: 'morphine', termB: 'HYDROmorphone', category: 'medication', severity: 'high' },
  { termA: 'metFORMIN', termB: 'metroNIDAZOLE', category: 'medication', severity: 'medium' },
  { termA: 'predniSONE', termB: 'prednisoLONE', category: 'medication', severity: 'medium' },
  { termA: 'clomiPHENE', termB: 'clomiPRAMINE', category: 'medication', severity: 'medium' },
  { termA: 'vinBLAStine', termB: 'vinCRIStine', category: 'medication', severity: 'high' },
  { termA: 'cefalexin', termB: 'cefazolin', category: 'medication', severity: 'low' },

  // Conditions
  { termA: "Cushing's syndrome", termB: "Cushing's disease", category: 'condition', severity: 'high' },
  { termA: "Crohn's disease", termB: 'ulcerative colitis', category: 'condition', severity: 'high' },
  { termA: 'systolic heart failure', termB: 'diastolic heart failure', category: 'condition', severity: 'high' },
  { termA: "Graves' disease", termB: "Hashimoto's thyroiditis", category: 'condition', severity: 'medium' },
  { termA: 'nephrotic syndrome', termB: 'nephritic syndrome', category: 'condition', severity: 'high' },
  { termA: 'Type 1 diabetes', termB: 'Type 2 diabetes', category: 'condition', severity: 'medium' },
  { termA: 'osteoarthritis', termB: 'rheumatoid arthritis', category: 'condition', severity: 'medium' },
  { termA: 'multiple sclerosis', termB: 'ALS', category: 'condition', severity: 'medium' },

  // Lab values
  { termA: 'BUN', termB: 'creatinine', category: 'lab_value', severity: 'low' },
  { termA: 'sensitivity', termB: 'specificity', category: 'lab_value', severity: 'medium' },
  { termA: 'metabolic acidosis', termB: 'respiratory acidosis', category: 'lab_value', severity: 'high' },
];

// ─── Similarity Scoring ──────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two embedding vectors.
 *
 * @param vecA - First embedding vector
 * @param vecB - Second embedding vector
 * @returns Cosine similarity [0, 1] (assuming normalized vectors)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i]! * vecB[i]!;
    normA += vecA[i]! * vecA[i]!;
    normB += vecB[i]! * vecB[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Check if two concepts are potentially confused based on embedding similarity.
 *
 * @param similarity - Cosine similarity score
 * @returns Whether the pair exceeds the confusion threshold
 */
export function isEmbeddingConfusionPair(similarity: number): boolean {
  return similarity >= SIMILARITY_THRESHOLD;
}

// ─── Co-Failure Mining ───────────────────────────────────────────────────────

/**
 * Mine co-failure pairs from a sequence of failure events.
 *
 * Identifies concept pairs that fail together within the co-failure window.
 * Uses association rule mining metrics (support, confidence, lift).
 *
 * @param events - Ordered array of co-failure events
 * @param totalSessions - Total number of sessions (for support calculation)
 * @returns Map of concept pair keys to association metrics
 */
export function mineCoFailures(
  events: CoFailureEvent[],
  totalSessions: number
): Map<string, AssociationMetrics> {
  const pairCounts = new Map<string, number>();
  const conceptFailCounts = new Map<string, number>();
  const sessionConcepts = new Map<string, Set<string>>();

  // Group failures by session and track concept frequencies
  for (const event of events) {
    if (!sessionConcepts.has(event.sessionId)) {
      sessionConcepts.set(event.sessionId, new Set());
    }
    sessionConcepts.get(event.sessionId)!.add(event.conceptId);

    conceptFailCounts.set(
      event.conceptId,
      (conceptFailCounts.get(event.conceptId) ?? 0) + 1
    );
  }

  // Count co-failures within sessions
  for (const concepts of Array.from(sessionConcepts.values())) {
    const conceptArray = Array.from(concepts) as string[];
    for (let i = 0; i < conceptArray.length; i++) {
      for (let j = i + 1; j < conceptArray.length; j++) {
        const key = normalizeConceptPair(conceptArray[i]!, conceptArray[j]!);
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  // Compute association metrics
  const results = new Map<string, AssociationMetrics>();

  for (const [pairKey, count] of Array.from(pairCounts)) {
    if (count < MIN_CO_FAILURES) continue;

    const [conceptA, conceptB] = pairKey.split('|||');
    const failsA = conceptFailCounts.get(conceptA!) ?? 0;
    const failsB = conceptFailCounts.get(conceptB!) ?? 0;

    const support = count / Math.max(1, totalSessions);
    const confidence = failsA > 0 ? count / failsA : 0;
    const pB = failsB / Math.max(1, totalSessions);
    const lift = pB > 0 ? confidence / pB : 0;

    results.set(pairKey, { support, confidence, lift, count });
  }

  return results;
}

/**
 * Normalize a concept pair key for bidirectional lookup.
 */
export function normalizeConceptPair(conceptA: string, conceptB: string): string {
  return [conceptA, conceptB].sort().join('|||');
}

// ─── Confusion Assessment ────────────────────────────────────────────────────

/**
 * Assess a confusion pair combining embedding similarity and co-failure evidence.
 *
 * @param similarityScore - Cosine similarity (0 if no embeddings available)
 * @param coFailureCount - Number of observed co-failures
 * @param associationMetrics - Optional mining metrics (lift, confidence)
 * @returns Complete confusion pair assessment
 */
export function assessConfusionPair(
  conceptA: string,
  conceptB: string,
  similarityScore: number,
  coFailureCount: number,
  associationMetrics?: AssociationMetrics
): SemanticConfusionPair {
  // Determine source
  const hasEmbedding = similarityScore >= SIMILARITY_THRESHOLD;
  const hasCoFailure = coFailureCount >= MIN_CO_FAILURES;
  const source: ConfusionSource = hasEmbedding && hasCoFailure ? 'both' :
    hasEmbedding ? 'embedding' : 'co_failure';

  // Combined severity score [0, 1]
  const embeddingContribution = similarityScore >= SIMILARITY_THRESHOLD
    ? (similarityScore - SIMILARITY_THRESHOLD) / (1 - SIMILARITY_THRESHOLD)
    : 0;
  const coFailureContribution = Math.min(1, coFailureCount / 10);
  const liftContribution = associationMetrics?.lift
    ? Math.min(1, (associationMetrics.lift - 1) / 5)
    : 0;

  const combinedScore = Math.min(1,
    embeddingContribution * 0.3 +
    coFailureContribution * 0.4 +
    liftContribution * 0.3
  );

  const severity = classifyConfusionSeverity(combinedScore);

  // LECTOR interference modifier: reduces stability for confused pairs
  const interferenceModifier = computeInterferenceModifier(combinedScore);

  return {
    conceptA,
    conceptB,
    similarityScore,
    coFailureCount,
    source,
    severity,
    interleavingRecommended: severity !== 'low',
    contrastiveDrillRecommended: severity === 'high' || severity === 'critical',
    interferenceModifier,
  };
}

/**
 * Classify confusion severity from combined evidence score.
 */
export function classifyConfusionSeverity(score: number): ConfusionSeverity {
  if (score >= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (score >= SEVERITY_THRESHOLDS.high) return 'high';
  if (score >= SEVERITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Compute the LECTOR-inspired semantic interference modifier.
 *
 * Applied to FSRS stability calculations: S' = S * interferenceModifier
 * when two confused concepts are reviewed in proximity.
 *
 * Higher confusion scores → lower modifier → more conservative stability.
 *
 * @param combinedScore - Combined confusion evidence score [0, 1]
 * @returns Multiplicative modifier [0.75, 1.0] for stability
 */
export function computeInterferenceModifier(combinedScore: number): number {
  if (combinedScore <= 0) return 1.0;
  if (combinedScore >= 1) return INTERFERENCE_MODIFIER_RANGE.min;

  // Linear interpolation: score 0 → modifier 1.0, score 1 → modifier min
  const range = 1.0 - INTERFERENCE_MODIFIER_RANGE.min;
  const modifier = 1.0 - combinedScore * range;
  return Math.max(INTERFERENCE_MODIFIER_RANGE.min, modifier);
}

// ─── Interleaving Scheduler ──────────────────────────────────────────────────

/**
 * Generate an interleaving schedule for a confusion pair.
 *
 * Per research (2023 systematic review): interleaving similar concepts
 * forces discriminative contrast. Confused cards should be separated
 * by 2-5 intervening items.
 *
 * @param confusedPair - The two confused card IDs
 * @param availableCards - Pool of other cards to interleave
 * @param severity - How severe the confusion is (affects separation)
 * @returns Ordered card sequence with interleaving
 */
export function generateInterleavingSchedule(
  confusedPair: [string, string],
  availableCards: string[],
  severity: ConfusionSeverity = 'medium'
): InterleavingSchedule {
  // More severe confusion → closer interleaving (forces harder discrimination)
  const separationCount = severity === 'critical' ? INTERLEAVING_SEPARATION.min :
    severity === 'high' ? 3 :
    severity === 'medium' ? INTERLEAVING_SEPARATION.max - 1 :
    INTERLEAVING_SEPARATION.max;

  // Select intervening cards (avoid any that are part of the confused pair)
  const interveningPool = availableCards.filter(
    id => id !== confusedPair[0] && id !== confusedPair[1]
  );

  const intervening = interveningPool.slice(0, separationCount);

  const cardSequence = [confusedPair[0], ...intervening, confusedPair[1]];

  return {
    cardSequence,
    separationCount: intervening.length,
    reason: `Interleaved confusion pair (${severity} severity) with ${intervening.length} intervening items to force discriminative contrast`,
  };
}

// ─── LASA Bootstrapping ─────────────────────────────────────────────────────

/**
 * Check if a concept matches any known LASA pairs.
 *
 * Used to bootstrap the confusion graph before user data accumulates.
 *
 * @param concept - Concept name to check
 * @returns Array of known LASA pairs involving this concept
 */
export function findKnownLasaPairs(concept: string): LasaPair[] {
  const lower = concept.toLowerCase();
  return KNOWN_LASA_PAIRS.filter(
    pair => pair.termA.toLowerCase().includes(lower) ||
            pair.termB.toLowerCase().includes(lower) ||
            lower.includes(pair.termA.toLowerCase()) ||
            lower.includes(pair.termB.toLowerCase())
  );
}
