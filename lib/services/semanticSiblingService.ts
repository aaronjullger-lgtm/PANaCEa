/**
 * Semantic Sibling Service (KAR3L Implementation)
 *
 * Enables knowledge transfer across semantically related conditions.
 * When a user correctly recalls "Atrial Fibrillation", the system
 * implicitly boosts retrievability for "Atrial Flutter" without
 * requiring separate review.
 *
 * Uses Cloudflare Workers AI for BERT embeddings when available,
 * falls back to pre-computed similarity matrix.
 *
 * Research: Knowledge-Aware Retrieval-based Learning (KAR3L)
 */

import { Rating } from '../fsrs';

/**
 * Semantic relationship between conditions
 */
export interface SemanticSibling {
  /** Condition ID */
  conditionId: string;
  /** Condition name (for display) */
  conditionName: string;
  /** Similarity score (0-1, higher = more similar) */
  similarityScore: number;
  /** Relationship type */
  relationshipType:
    | 'same_subcategory'
    | 'differential'
    | 'complication'
    | 'treatment_similar'
    | 'presentation_similar';
}

/**
 * Sibling boost record for tracking propagation
 */
export interface SiblingBoostRecord {
  /** Target condition that received boost */
  targetConditionId: string;
  /** Source condition from which boost originated */
  sourceConditionId: string;
  /** Boost factor applied to retrievability */
  boostFactor: number;
  /** Rating that triggered the boost */
  sourceRating: Rating;
  /** Timestamp of boost */
  timestamp: string;
}

/**
 * Pre-computed semantic relationships (fallback when Workers AI unavailable)
 *
 * These are derived from:
 * - Same subcategory (0.7 similarity)
 * - DDx relationships (0.6 similarity)
 * - Treatment overlap (0.5 similarity)
 * - Presentation overlap (0.4 similarity)
 */
const PRECOMPUTED_SIBLINGS: Record<string, SemanticSibling[]> = {
  // Cardiac Arrhythmias
  'atrial-fibrillation': [
    {
      conditionId: 'atrial-flutter',
      conditionName: 'Atrial Flutter',
      similarityScore: 0.85,
      relationshipType: 'differential',
    },
    {
      conditionId: 'svt',
      conditionName: 'Supraventricular Tachycardia',
      similarityScore: 0.7,
      relationshipType: 'same_subcategory',
    },
    {
      conditionId: 'wpw-syndrome',
      conditionName: 'WPW Syndrome',
      similarityScore: 0.6,
      relationshipType: 'same_subcategory',
    },
  ],
  'atrial-flutter': [
    {
      conditionId: 'atrial-fibrillation',
      conditionName: 'Atrial Fibrillation',
      similarityScore: 0.85,
      relationshipType: 'differential',
    },
    {
      conditionId: 'svt',
      conditionName: 'Supraventricular Tachycardia',
      similarityScore: 0.65,
      relationshipType: 'same_subcategory',
    },
  ],

  // IBD
  'crohns-disease': [
    {
      conditionId: 'ulcerative-colitis',
      conditionName: 'Ulcerative Colitis',
      similarityScore: 0.8,
      relationshipType: 'differential',
    },
    {
      conditionId: 'ibs',
      conditionName: 'Irritable Bowel Syndrome',
      similarityScore: 0.5,
      relationshipType: 'differential',
    },
  ],
  'ulcerative-colitis': [
    {
      conditionId: 'crohns-disease',
      conditionName: "Crohn's Disease",
      similarityScore: 0.8,
      relationshipType: 'differential',
    },
    {
      conditionId: 'infectious-colitis',
      conditionName: 'Infectious Colitis',
      similarityScore: 0.6,
      relationshipType: 'differential',
    },
  ],

  // Thyroid
  hyperthyroidism: [
    {
      conditionId: 'hypothyroidism',
      conditionName: 'Hypothyroidism',
      similarityScore: 0.75,
      relationshipType: 'differential',
    },
    {
      conditionId: 'graves-disease',
      conditionName: "Graves' Disease",
      similarityScore: 0.85,
      relationshipType: 'same_subcategory',
    },
    {
      conditionId: 'thyroid-storm',
      conditionName: 'Thyroid Storm',
      similarityScore: 0.7,
      relationshipType: 'complication',
    },
  ],
  hypothyroidism: [
    {
      conditionId: 'hyperthyroidism',
      conditionName: 'Hyperthyroidism',
      similarityScore: 0.75,
      relationshipType: 'differential',
    },
    {
      conditionId: 'hashimotos',
      conditionName: "Hashimoto's Thyroiditis",
      similarityScore: 0.8,
      relationshipType: 'same_subcategory',
    },
    {
      conditionId: 'myxedema-coma',
      conditionName: 'Myxedema Coma',
      similarityScore: 0.65,
      relationshipType: 'complication',
    },
  ],

  // Diabetes
  'type-1-diabetes': [
    {
      conditionId: 'type-2-diabetes',
      conditionName: 'Type 2 Diabetes',
      similarityScore: 0.7,
      relationshipType: 'differential',
    },
    {
      conditionId: 'dka',
      conditionName: 'Diabetic Ketoacidosis',
      similarityScore: 0.75,
      relationshipType: 'complication',
    },
  ],
  'type-2-diabetes': [
    {
      conditionId: 'type-1-diabetes',
      conditionName: 'Type 1 Diabetes',
      similarityScore: 0.7,
      relationshipType: 'differential',
    },
    {
      conditionId: 'hhs',
      conditionName: 'Hyperosmolar Hyperglycemic State',
      similarityScore: 0.7,
      relationshipType: 'complication',
    },
    {
      conditionId: 'metabolic-syndrome',
      conditionName: 'Metabolic Syndrome',
      similarityScore: 0.6,
      relationshipType: 'same_subcategory',
    },
  ],

  // ACS
  stemi: [
    {
      conditionId: 'nstemi',
      conditionName: 'NSTEMI',
      similarityScore: 0.85,
      relationshipType: 'differential',
    },
    {
      conditionId: 'unstable-angina',
      conditionName: 'Unstable Angina',
      similarityScore: 0.75,
      relationshipType: 'same_subcategory',
    },
    {
      conditionId: 'stable-angina',
      conditionName: 'Stable Angina',
      similarityScore: 0.6,
      relationshipType: 'same_subcategory',
    },
  ],
  nstemi: [
    {
      conditionId: 'stemi',
      conditionName: 'STEMI',
      similarityScore: 0.85,
      relationshipType: 'differential',
    },
    {
      conditionId: 'unstable-angina',
      conditionName: 'Unstable Angina',
      similarityScore: 0.8,
      relationshipType: 'same_subcategory',
    },
  ],

  // Headaches
  migraine: [
    {
      conditionId: 'tension-headache',
      conditionName: 'Tension Headache',
      similarityScore: 0.7,
      relationshipType: 'differential',
    },
    {
      conditionId: 'cluster-headache',
      conditionName: 'Cluster Headache',
      similarityScore: 0.65,
      relationshipType: 'same_subcategory',
    },
  ],
  'tension-headache': [
    {
      conditionId: 'migraine',
      conditionName: 'Migraine',
      similarityScore: 0.7,
      relationshipType: 'differential',
    },
    {
      conditionId: 'medication-overuse-headache',
      conditionName: 'Medication Overuse Headache',
      similarityScore: 0.55,
      relationshipType: 'same_subcategory',
    },
  ],

  // Arthritis
  'rheumatoid-arthritis': [
    {
      conditionId: 'osteoarthritis',
      conditionName: 'Osteoarthritis',
      similarityScore: 0.7,
      relationshipType: 'differential',
    },
    {
      conditionId: 'psoriatic-arthritis',
      conditionName: 'Psoriatic Arthritis',
      similarityScore: 0.75,
      relationshipType: 'same_subcategory',
    },
    {
      conditionId: 'sle',
      conditionName: 'Systemic Lupus Erythematosus',
      similarityScore: 0.6,
      relationshipType: 'differential',
    },
  ],
  osteoarthritis: [
    {
      conditionId: 'rheumatoid-arthritis',
      conditionName: 'Rheumatoid Arthritis',
      similarityScore: 0.7,
      relationshipType: 'differential',
    },
    {
      conditionId: 'gout',
      conditionName: 'Gout',
      similarityScore: 0.55,
      relationshipType: 'differential',
    },
  ],

  // AKI
  'prerenal-aki': [
    {
      conditionId: 'intrinsic-aki',
      conditionName: 'Intrinsic AKI',
      similarityScore: 0.8,
      relationshipType: 'differential',
    },
    {
      conditionId: 'postrenal-aki',
      conditionName: 'Postrenal AKI',
      similarityScore: 0.75,
      relationshipType: 'same_subcategory',
    },
  ],
  'intrinsic-aki': [
    {
      conditionId: 'prerenal-aki',
      conditionName: 'Prerenal AKI',
      similarityScore: 0.8,
      relationshipType: 'differential',
    },
    {
      conditionId: 'atn',
      conditionName: 'Acute Tubular Necrosis',
      similarityScore: 0.85,
      relationshipType: 'same_subcategory',
    },
  ],

  // Respiratory
  pneumonia: [
    {
      conditionId: 'bronchitis',
      conditionName: 'Bronchitis',
      similarityScore: 0.65,
      relationshipType: 'differential',
    },
    {
      conditionId: 'copd-exacerbation',
      conditionName: 'COPD Exacerbation',
      similarityScore: 0.6,
      relationshipType: 'differential',
    },
    {
      conditionId: 'lung-abscess',
      conditionName: 'Lung Abscess',
      similarityScore: 0.55,
      relationshipType: 'complication',
    },
  ],
  bronchitis: [
    {
      conditionId: 'pneumonia',
      conditionName: 'Pneumonia',
      similarityScore: 0.65,
      relationshipType: 'differential',
    },
    {
      conditionId: 'asthma-exacerbation',
      conditionName: 'Asthma Exacerbation',
      similarityScore: 0.6,
      relationshipType: 'differential',
    },
  ],
};

/**
 * Configuration for semantic sibling service
 */
export interface SemanticSiblingConfig {
  /** Use Cloudflare Workers AI for embeddings */
  useWorkersAI: boolean;
  /** Maximum number of siblings to return */
  maxSiblings: number;
  /** Minimum similarity threshold */
  minSimilarity: number;
  /** Boost decay factor (how much boost decreases over time) */
  boostDecayFactor: number;
}

const DEFAULT_CONFIG: SemanticSiblingConfig = {
  useWorkersAI: false, // Start with precomputed, enable later
  maxSiblings: 5,
  minSimilarity: 0.5,
  boostDecayFactor: 0.1, // 10% decay per day
};

/**
 * Find semantic siblings for a condition
 */
export function findSemanticSiblings(
  conditionId: string,
  config: Partial<SemanticSiblingConfig> = {}
): SemanticSibling[] {
  const { maxSiblings, minSimilarity } = { ...DEFAULT_CONFIG, ...config };

  // Normalize condition ID for lookup
  const normalizedId = conditionId.toLowerCase().replace(/\s+/g, '-');

  // Get precomputed siblings
  const siblings = PRECOMPUTED_SIBLINGS[normalizedId] || [];

  // Filter by minimum similarity and limit
  return siblings
    .filter((s) => s.similarityScore >= minSimilarity)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, maxSiblings);
}

/**
 * Calculate boost factor for sibling based on source rating
 *
 * Boost is proportional to:
 * - Similarity score (higher = more boost)
 * - Source rating (Good/Easy = positive, Again = negative)
 */
export function calculateSiblingBoost(sibling: SemanticSibling, sourceRating: Rating): number {
  // Base boost from similarity
  const baseBoost = sibling.similarityScore;

  // Rating multiplier (binary system: Again/Good only; Hard/Easy deprecated)
  let ratingMultiplier: number;
  switch (sourceRating) {
    case Rating.Good:
    case Rating.Easy:  // Easy deprecated → treat as Good
      ratingMultiplier = 0.1; // +10% max boost
      break;
    case Rating.Again:
    case Rating.Hard:  // Hard deprecated → treat as Again
      ratingMultiplier = -0.05; // -5% (forgot, slight penalty)
      break;
    default:
      ratingMultiplier = 0;
  }

  // Final boost = similarity × rating multiplier
  return baseBoost * ratingMultiplier;
}

/**
 * Apply boost to a condition's retrievability
 *
 * @param currentR - Current retrievability (0-1)
 * @param boostFactor - Boost to apply
 * @returns Adjusted retrievability
 */
export function applyRetrievabilityBoost(currentR: number, boostFactor: number): number {
  // Ensure retrievability stays in valid range
  const boostedR = currentR + boostFactor;
  return Math.max(0, Math.min(1, boostedR));
}

/**
 * Propagate recall to semantic siblings
 *
 * When a user reviews a condition, this function identifies related
 * conditions and returns boost records to apply.
 */
export async function propagateRecallToSiblings(
  sourceConditionId: string,
  sourceRating: Rating,
  config: Partial<SemanticSiblingConfig> = {}
): Promise<SiblingBoostRecord[]> {
  const siblings = findSemanticSiblings(sourceConditionId, config);

  if (siblings.length === 0) {
    return [];
  }

  const boostRecords: SiblingBoostRecord[] = [];
  const timestamp = new Date().toISOString();

  for (const sibling of siblings) {
    const boostFactor = calculateSiblingBoost(sibling, sourceRating);

    // Only create records for meaningful boosts
    if (Math.abs(boostFactor) > 0.01) {
      boostRecords.push({
        targetConditionId: sibling.conditionId,
        sourceConditionId,
        boostFactor,
        sourceRating,
        timestamp,
      });
    }
  }

  return boostRecords;
}

/**
 * Calculate decay for boost over time
 */
export function calculateBoostDecay(
  boostFactor: number,
  daysSinceBoost: number,
  decayRate: number = DEFAULT_CONFIG.boostDecayFactor
): number {
  // Exponential decay
  return boostFactor * Math.exp(-decayRate * daysSinceBoost);
}

/**
 * Get aggregate boost for a condition from all sources
 */
export function aggregateBoosts(
  boostRecords: SiblingBoostRecord[],
  targetConditionId: string
): number {
  const relevantBoosts = boostRecords.filter((r) => r.targetConditionId === targetConditionId);

  if (relevantBoosts.length === 0) return 0;

  const now = new Date();
  let totalBoost = 0;

  for (const record of relevantBoosts) {
    const boostDate = new Date(record.timestamp);
    const daysSince = (now.getTime() - boostDate.getTime()) / (1000 * 60 * 60 * 24);
    const decayedBoost = calculateBoostDecay(record.boostFactor, daysSince);
    totalBoost += decayedBoost;
  }

  // Cap total boost at ±20%
  return Math.max(-0.2, Math.min(0.2, totalBoost));
}

/**
 * Serialize boost records for storage
 */
export function serializeBoostRecords(records: SiblingBoostRecord[]): string {
  return JSON.stringify(records);
}

/**
 * Deserialize boost records from storage
 */
export function deserializeBoostRecords(json: string): SiblingBoostRecord[] {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.debug('[semanticSiblingService] failed to deserialize boost records', err);
    return [];
  }
}

/**
 * Get human-readable explanation of sibling relationship
 */
export function explainRelationship(sibling: SemanticSibling): string {
  switch (sibling.relationshipType) {
    case 'differential':
      return `Often confused with ${sibling.conditionName}`;
    case 'same_subcategory':
      return `Same category as ${sibling.conditionName}`;
    case 'complication':
      return `Can lead to ${sibling.conditionName}`;
    case 'treatment_similar':
      return `Similar treatment to ${sibling.conditionName}`;
    case 'presentation_similar':
      return `Similar presentation to ${sibling.conditionName}`;
    default:
      return `Related to ${sibling.conditionName}`;
  }
}

export default {
  findSemanticSiblings,
  calculateSiblingBoost,
  applyRetrievabilityBoost,
  propagateRecallToSiblings,
  calculateBoostDecay,
  aggregateBoosts,
  explainRelationship,
  PRECOMPUTED_SIBLINGS,
};
