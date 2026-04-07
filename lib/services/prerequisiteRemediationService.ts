/**
 * Error-Driven Prerequisite Remediation Service (Tier 2, Feature 2)
 *
 * When a student fails a card (FSRS lapse), this service:
 *   1. Identifies concepts tagged on the failed card
 *   2. Traverses prerequisite graph downward (via GraphEdge HIERARCHICAL edges)
 *   3. Checks mastery state for each prerequisite
 *   4. Ranks weak prerequisites by depth (deepest gaps first — fix foundations)
 *   5. Selects remediation cards for weak prerequisites
 *
 * Architecture:
 *   Pure computation layer for scoring/ranking. The Edge API endpoint
 *   handles database queries and calls these functions.
 *
 * Key constraints (from tier2.md):
 *   - Remediation budget: max 3 prerequisite cards injected per failure
 *   - Depth-first: deepest prerequisite gaps are fixed first
 *   - Only inject cards that exist and are at appropriate difficulty
 *   - Tag remediation cards with reason for analytics
 *
 * Research basis:
 *   - Corbett & Anderson (1995): Bayesian Knowledge Tracing
 *   - Piech et al. (2015, Stanford): Deep Knowledge Tracing
 *   - Skycak (2023, Math Academy): FIRe — Fractional Implicit Repetition
 *
 * @see lib/services/fireImplicitCreditService.ts — Complementary: FIRe propagates credit UP on success
 * @see services/domain/conceptDependencyService.ts — Prerequisite type definitions
 * @see functions/api/graph/expand.ts — Graph BFS expansion
 * @module lib/services/prerequisiteRemediationService
 */

// ─── Types ────────────────────────────────────────────────────────

/** A prerequisite concept identified as weak */
export interface WeakPrerequisite {
  /** GraphNode or Condition ID */
  conceptId: string;
  /** Human-readable concept name */
  conceptName: string;
  /** Organ system / domain */
  system: string;
  /** Depth in prerequisite chain (1 = direct prerequisite, 2 = prerequisite's prerequisite, etc.) */
  depth: number;
  /** Current mastery estimate (0-1 scale) */
  mastery: number;
  /** Why this prerequisite is considered weak */
  weaknessType: WeaknessType;
  /** Priority score for remediation ordering */
  remediationPriority: number;
}

/** Types of prerequisite weakness */
export type WeaknessType =
  | 'never_seen'        // Student has never reviewed this concept
  | 'low_accuracy'      // Accuracy below mastery threshold
  | 'high_lapse_rate'   // Frequent lapses on this concept
  | 'stale_review'      // Last review was too long ago, likely decayed
  | 'shallow_encoding'; // High accuracy but low stability (fragile knowledge)

/** A card selected for remediation injection */
export interface RemediationCard {
  /** Question/card ID to inject into the session */
  cardId: string;
  /** The weak prerequisite this card addresses */
  prerequisiteConceptId: string;
  /** The concept name */
  prerequisiteConceptName: string;
  /** Depth of the prerequisite (for ordering — deeper = earlier) */
  prerequisiteDepth: number;
  /** Why this card was selected */
  remediationReason: string;
  /** Hierarchy level of the remediation card (1=patho, 2=dx, 3=mgmt) */
  hierarchyLevel: number;
}

/** Result of the remediation analysis */
export interface RemediationResult {
  /** The failed card that triggered remediation */
  failedCardId: string;
  /** Condition family of the failed card */
  conditionFamily: string;
  /** All weak prerequisites identified (before budget cap) */
  weakPrerequisites: WeakPrerequisite[];
  /** Cards selected for injection (capped by budget) */
  remediationCards: RemediationCard[];
  /** Number of prerequisites checked */
  prerequisitesChecked: number;
  /** Whether remediation was skipped (e.g., no prerequisites found) */
  skipped: boolean;
  /** Reason for skipping, if applicable */
  skipReason?: string;
}

/** Configuration for the remediation service */
export interface RemediationConfig {
  /** Maximum cards to inject per failure event */
  maxRemediationCards: number;
  /** Maximum depth to traverse in prerequisite graph */
  maxPrerequisiteDepth: number;
  /** Mastery threshold below which a prerequisite is considered weak */
  masteryThreshold: number;
  /** Days since last review to consider a concept "stale" */
  staleDays: number;
  /** Minimum accuracy for a concept to be considered mastered */
  minAccuracyForMastery: number;
  /** Prefer lower hierarchy levels for remediation (patho > dx > mgmt) */
  preferFoundationalCards: boolean;
}

// ─── Constants ────────────────────────────────────────────────────

/** Default remediation configuration (per tier2.md spec) */
export const DEFAULT_REMEDIATION_CONFIG: RemediationConfig = {
  maxRemediationCards: 3,        // tier2.md: "maximum 3 prerequisite cards injected per failure"
  maxPrerequisiteDepth: 5,       // tier2.md: "max depth ~5"
  masteryThreshold: 0.70,        // tier2.md: "masteryLevel < 0.7"
  staleDays: 30,                 // 30 days without review → likely decayed
  minAccuracyForMastery: 0.70,   // 70% accuracy threshold
  preferFoundationalCards: true,  // Fix foundations first
};

/** Weakness type priority (higher = more urgent to remediate) */
const WEAKNESS_PRIORITY: Record<WeaknessType, number> = {
  never_seen: 100,          // Never encountered = biggest gap
  low_accuracy: 80,         // Seen but consistently wrong
  shallow_encoding: 60,     // Knows it but fragile
  high_lapse_rate: 70,      // Keeps forgetting
  stale_review: 50,         // Probably decayed
};

// ─── Core Algorithm ───────────────────────────────────────────────

/**
 * Raw prerequisite data from the database.
 * The Edge API endpoint constructs these from GraphEdge + MasteryProgress queries.
 */
export interface PrerequisiteData {
  conceptId: string;
  conceptName: string;
  system: string;
  depth: number;
  /** Student's accuracy on this concept (null = never seen) */
  accuracy: number | null;
  /** Number of attempts on this concept */
  attempts: number;
  /** Number of lapses on this concept */
  lapses: number;
  /** Days since last review (null = never reviewed) */
  daysSinceLastReview: number | null;
  /** FSRS stability for this concept (null = no FSRS state) */
  stability: number | null;
}

/**
 * Raw card data for remediation selection.
 */
export interface CandidateRemediationCard {
  cardId: string;
  conditionFamily: string;
  conditionId: string;
  hierarchyLevel: number;
  difficulty: number;
  system: string;
}

/**
 * Identify weak prerequisites from a list of prerequisite data.
 *
 * Applies the weakness classification:
 *   - never_seen: no attempts
 *   - low_accuracy: accuracy < threshold
 *   - high_lapse_rate: lapses / attempts > 0.3
 *   - stale_review: last review > staleDays ago
 *   - shallow_encoding: accuracy OK but stability < 5 days
 *
 * @param prerequisites - Raw prerequisite data from DB
 * @param config - Remediation configuration
 * @returns Sorted array of weak prerequisites (highest priority first)
 */
export function identifyWeakPrerequisites(
  prerequisites: ReadonlyArray<PrerequisiteData>,
  config: Partial<RemediationConfig> = {}
): WeakPrerequisite[] {
  const cfg = { ...DEFAULT_REMEDIATION_CONFIG, ...config };
  const weak: WeakPrerequisite[] = [];

  for (const prereq of prerequisites) {
    const weakness = classifyWeakness(prereq, cfg);
    if (!weakness) continue;

    weak.push({
      conceptId: prereq.conceptId,
      conceptName: prereq.conceptName,
      system: prereq.system,
      depth: prereq.depth,
      mastery: prereq.accuracy ?? 0,
      weaknessType: weakness,
      remediationPriority: computeRemediationPriority(prereq, weakness, cfg),
    });
  }

  // Sort by priority descending, then by depth descending (deeper = fix first)
  weak.sort((a, b) => {
    if (b.remediationPriority !== a.remediationPriority) {
      return b.remediationPriority - a.remediationPriority;
    }
    return b.depth - a.depth;
  });

  return weak;
}

/**
 * Select remediation cards for the identified weak prerequisites.
 *
 * For each weak prerequisite (in priority order), finds the best available
 * card to remediate the gap. Prefers foundational (level 1) cards when
 * configured, as fixing pathophysiology understanding is most impactful.
 *
 * @param weakPrerequisites - Sorted weak prerequisites
 * @param availableCards - Cards available for each concept
 * @param config - Remediation configuration
 * @returns Selected remediation cards (capped by budget)
 */
export function selectRemediationCards(
  weakPrerequisites: ReadonlyArray<WeakPrerequisite>,
  availableCards: ReadonlyArray<CandidateRemediationCard>,
  config: Partial<RemediationConfig> = {}
): RemediationCard[] {
  const cfg = { ...DEFAULT_REMEDIATION_CONFIG, ...config };
  const selected: RemediationCard[] = [];
  const usedCardIds = new Set<string>();
  const usedConceptIds = new Set<string>();

  // Index cards by conditionFamily for lookup
  const cardsByCondition = new Map<string, CandidateRemediationCard[]>();
  for (const card of availableCards) {
    const key = card.conditionFamily || card.conditionId;
    const existing = cardsByCondition.get(key) ?? [];
    existing.push(card);
    cardsByCondition.set(key, existing);
  }

  for (const prereq of weakPrerequisites) {
    if (selected.length >= cfg.maxRemediationCards) break;
    if (usedConceptIds.has(prereq.conceptId)) continue;

    // Find cards for this concept (try conceptId first, then conceptName as fallback)
    const candidates = cardsByCondition.get(prereq.conceptId)
      ?? cardsByCondition.get(prereq.conceptName)
      ?? [];
    if (candidates.length === 0) continue;

    // Sort candidates: prefer lower hierarchy level (more foundational)
    const sorted = [...candidates].sort((a, b) => {
      if (cfg.preferFoundationalCards) {
        if (a.hierarchyLevel !== b.hierarchyLevel) {
          return a.hierarchyLevel - b.hierarchyLevel;
        }
      }
      return a.difficulty - b.difficulty; // Then prefer easier cards
    });

    // Pick the best unused card
    const pick = sorted.find(c => !usedCardIds.has(c.cardId));
    if (!pick) continue;

    selected.push({
      cardId: pick.cardId,
      prerequisiteConceptId: prereq.conceptId,
      prerequisiteConceptName: prereq.conceptName,
      prerequisiteDepth: prereq.depth,
      remediationReason: buildRemediationReason(prereq),
      hierarchyLevel: pick.hierarchyLevel,
    });

    usedCardIds.add(pick.cardId);
    usedConceptIds.add(prereq.conceptId);
  }

  return selected;
}

/**
 * Build the complete remediation result for a failed card.
 *
 * This is the main entry point — combines prerequisite identification
 * and card selection into a single result.
 */
export function buildRemediationResult(
  failedCardId: string,
  conditionFamily: string,
  prerequisites: ReadonlyArray<PrerequisiteData>,
  availableCards: ReadonlyArray<CandidateRemediationCard>,
  config: Partial<RemediationConfig> = {}
): RemediationResult {
  if (prerequisites.length === 0) {
    return {
      failedCardId,
      conditionFamily,
      weakPrerequisites: [],
      remediationCards: [],
      prerequisitesChecked: 0,
      skipped: true,
      skipReason: 'No prerequisites found in knowledge graph',
    };
  }

  const weakPrerequisites = identifyWeakPrerequisites(prerequisites, config);

  if (weakPrerequisites.length === 0) {
    return {
      failedCardId,
      conditionFamily,
      weakPrerequisites: [],
      remediationCards: [],
      prerequisitesChecked: prerequisites.length,
      skipped: true,
      skipReason: 'All prerequisites meet mastery threshold',
    };
  }

  const remediationCards = selectRemediationCards(weakPrerequisites, availableCards, config);

  return {
    failedCardId,
    conditionFamily,
    weakPrerequisites,
    remediationCards,
    prerequisitesChecked: prerequisites.length,
    skipped: remediationCards.length === 0,
    skipReason: remediationCards.length === 0 ? 'No available cards for weak prerequisites' : undefined,
  };
}

// ─── Classification Helpers ───────────────────────────────────────

/**
 * Classify the type of weakness for a prerequisite.
 * Returns null if the prerequisite meets mastery threshold.
 */
function classifyWeakness(
  prereq: PrerequisiteData,
  config: RemediationConfig
): WeaknessType | null {
  // Never seen = biggest gap
  if (prereq.attempts === 0 || prereq.accuracy === null) {
    return 'never_seen';
  }

  // Low accuracy = consistently wrong
  if (prereq.accuracy < config.minAccuracyForMastery) {
    return 'low_accuracy';
  }

  // High lapse rate = keeps forgetting (even if recent accuracy is OK)
  if (prereq.attempts >= 3 && prereq.lapses / prereq.attempts > 0.3) {
    return 'high_lapse_rate';
  }

  // Stale review = probably decayed
  if (prereq.daysSinceLastReview !== null && prereq.daysSinceLastReview > config.staleDays) {
    return 'stale_review';
  }

  // Shallow encoding = accuracy OK but stability low (fragile knowledge)
  if (prereq.stability !== null && prereq.stability < 5 && prereq.accuracy >= config.minAccuracyForMastery) {
    return 'shallow_encoding';
  }

  // Meets mastery threshold — no weakness
  return null;
}

/**
 * Compute a composite remediation priority score.
 *
 * Components:
 *   - Base weight from weakness type
 *   - Depth bonus (deeper prerequisites are more foundational)
 *   - Inverse mastery bonus (lower mastery = higher priority)
 */
function computeRemediationPriority(
  prereq: PrerequisiteData,
  weakness: WeaknessType,
  config: RemediationConfig
): number {
  let score = WEAKNESS_PRIORITY[weakness];

  // Depth bonus: deeper prerequisites are more foundational (5 pts per level)
  score += prereq.depth * 5;

  // Inverse mastery bonus: lower mastery = higher priority (up to 20 pts)
  const mastery = prereq.accuracy ?? 0;
  score += Math.round((1 - mastery) * 20);

  // Lapse severity bonus
  if (prereq.attempts > 0 && prereq.lapses > 0) {
    const lapseRate = prereq.lapses / prereq.attempts;
    score += Math.round(lapseRate * 15);
  }

  return score;
}

/**
 * Build a human-readable reason for why this card was selected for remediation.
 */
function buildRemediationReason(prereq: WeakPrerequisite): string {
  const depthLabel = prereq.depth === 1 ? 'direct prerequisite' : `prerequisite (depth ${prereq.depth})`;

  switch (prereq.weaknessType) {
    case 'never_seen':
      return `${prereq.conceptName} is a ${depthLabel} you haven't studied yet`;
    case 'low_accuracy':
      return `${prereq.conceptName} is a ${depthLabel} with ${Math.round(prereq.mastery * 100)}% accuracy — below mastery`;
    case 'high_lapse_rate':
      return `${prereq.conceptName} is a ${depthLabel} you frequently forget`;
    case 'stale_review':
      return `${prereq.conceptName} is a ${depthLabel} you haven't reviewed recently`;
    case 'shallow_encoding':
      return `${prereq.conceptName} is a ${depthLabel} with fragile retention — needs reinforcement`;
  }
}

// ─── Recursive CTE Builder ───────────────────────────────────────

/**
 * Build the recursive CTE SQL for traversing prerequisite edges.
 *
 * This is used by the Edge API endpoint to fetch prerequisites
 * from the GraphEdge table using PostgreSQL recursive CTEs
 * (since Prisma doesn't support recursive queries — GitHub #3725).
 *
 * @param maxDepth - Maximum traversal depth
 * @returns SQL string for use with prisma.$queryRaw
 */
export function buildPrerequisiteCTE(maxDepth: number = 5): string {
  return `
    WITH RECURSIVE prereqs AS (
      SELECT
        ge."targetId" AS "conceptId",
        gn."label" AS "conceptName",
        gn."systemCodes",
        1 AS depth
      FROM "GraphEdge" ge
      JOIN "GraphNode" gn ON gn."id" = ge."targetId"
      WHERE ge."sourceId" = $1
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
      WHERE p.depth < ${maxDepth}
    )
    SELECT DISTINCT ON ("conceptId")
      "conceptId",
      "conceptName",
      "systemCodes",
      depth
    FROM prereqs
    ORDER BY "conceptId", depth ASC
  `;
}
