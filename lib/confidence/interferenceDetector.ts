/**
 * Retrieval Interference Detector
 *
 * Detects when a student reviews confusable cards in the same session,
 * which can inflate confidence via recency priming rather than genuine
 * retrieval from long-term memory.
 *
 * Research basis:
 * - Anderson & Neely (1996): Retrieval-induced forgetting — retrieving one
 *   item inhibits competing items from the same category
 * - Anderson et al. (1994): Fan effect — more associations to a concept
 *   increase interference during retrieval
 * - Roediger & McDermott (1995): DRM paradigm — semantic associates can
 *   create false confidence in related items
 *
 * Design:
 * - Checks if any confusion-pair sibling of the current card was reviewed
 *   in the same session within the last N cards
 * - Applies a confidence discount proportional to recency (closer = more discount)
 * - Same condition reviewed twice → maximum discount
 * - Discount range: [0.85, 1.0]
 *
 * Integration:
 * - Called in drillReviewService before the stability multiplier
 * - Requires session review history (conditionId + confusionPairIds per card)
 * - Falls back to 1.0 (no discount) if no interference detected
 */

// ── Types ──

export interface SessionReviewEntry {
  /** The conditionId of the reviewed card */
  conditionId: string;
  /** Known confusion-pair conditionIds for this card (from the confusion matrix) */
  confusionPairIds?: string[];
  /** 0-based position in the session */
  position: number;
}

export interface InterferenceResult {
  /** Confidence discount factor [0.85, 1.0] */
  discount: number;
  /** Whether interference was detected */
  detected: boolean;
  /** Details for logging */
  details: {
    /** Number of interfering cards found in session history */
    interferingCount: number;
    /** Closest interfering card's distance (in cards) */
    closestDistance: number | null;
    /** Type of interference detected */
    type: 'same_condition' | 'confusion_pair' | 'none';
  };
}

export interface InterferenceConfig {
  /** How many previous cards to check for interference (default: 10) */
  lookbackWindow: number;
  /** Maximum discount for same-condition reviewed recently (default: 0.85) */
  sameConditionMinDiscount: number;
  /** Maximum discount for confusion-pair reviewed recently (default: 0.90) */
  confusionPairMinDiscount: number;
  /** Distance at which interference effect decays to zero (default: 10) */
  decayDistance: number;
}

// ── Defaults ──

export const DEFAULT_INTERFERENCE_CONFIG: InterferenceConfig = {
  lookbackWindow: 10,
  sameConditionMinDiscount: 0.85,
  confusionPairMinDiscount: 0.90,
  decayDistance: 10,
};

// ── Core function ──

/**
 * Detect retrieval interference from session review history.
 *
 * @param currentConditionId - The conditionId of the card being reviewed
 * @param currentConfusionPairIds - Known confusion-pair conditionIds for the current card
 * @param sessionHistory - Previous reviews in this session (ordered by position)
 * @param config - Optional configuration overrides
 * @returns Discount factor and interference metadata
 */
export function detectInterference(
  currentConditionId: string,
  currentConfusionPairIds: string[],
  sessionHistory: SessionReviewEntry[],
  config: InterferenceConfig = DEFAULT_INTERFERENCE_CONFIG
): InterferenceResult {
  const noInterference: InterferenceResult = {
    discount: 1.0,
    detected: false,
    details: { interferingCount: 0, closestDistance: null, type: 'none' },
  };

  if (sessionHistory.length === 0 || !currentConditionId) {
    return noInterference;
  }

  // Only look at the most recent N cards
  const recentHistory = sessionHistory.slice(-config.lookbackWindow);
  const currentPosition = (sessionHistory[sessionHistory.length - 1]?.position ?? 0) + 1;

  let strongestDiscount = 1.0;
  let interferingCount = 0;
  let closestDistance: number | null = null;
  let interferenceType: 'same_condition' | 'confusion_pair' | 'none' = 'none';

  const confusionSet = new Set(currentConfusionPairIds);

  for (const entry of recentHistory) {
    const distance = currentPosition - entry.position;
    if (distance <= 0) continue; // Skip future or current position

    // Check for same-condition interference (strongest)
    if (entry.conditionId === currentConditionId) {
      const decayFactor = Math.min(1.0, distance / config.decayDistance);
      const discount = config.sameConditionMinDiscount +
        (1.0 - config.sameConditionMinDiscount) * decayFactor;
      if (discount < strongestDiscount) {
        strongestDiscount = discount;
        interferenceType = 'same_condition';
      }
      interferingCount++;
      if (closestDistance === null || distance < closestDistance) {
        closestDistance = distance;
      }
      continue;
    }

    // Check for confusion-pair interference
    if (confusionSet.has(entry.conditionId)) {
      const decayFactor = Math.min(1.0, distance / config.decayDistance);
      const discount = config.confusionPairMinDiscount +
        (1.0 - config.confusionPairMinDiscount) * decayFactor;
      if (discount < strongestDiscount) {
        strongestDiscount = discount;
        if (interferenceType !== 'same_condition') {
          interferenceType = 'confusion_pair';
        }
      }
      interferingCount++;
      if (closestDistance === null || distance < closestDistance) {
        closestDistance = distance;
      }
    }
  }

  if (interferingCount === 0) {
    return noInterference;
  }

  return {
    discount: Math.round(strongestDiscount * 1000) / 1000,
    detected: true,
    details: {
      interferingCount,
      closestDistance,
      type: interferenceType,
    },
  };
}
