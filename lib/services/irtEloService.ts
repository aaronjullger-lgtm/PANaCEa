/**
 * IRT/Elo Service (Tier 2, Feature 6)
 *
 * Implements an Elo rating system for adaptive within-session card ordering.
 * Each student-item interaction is treated as a "match": the student's ability
 * and item's difficulty are updated based on the outcome.
 *
 * Architecture separation from FSRS:
 * - **FSRS** handles inter-session scheduling (when to review next)
 * - **IRT/Elo** handles intra-session ordering (which card to show next from due pool)
 *
 * FSRS difficulty (D, scale 1-10) measures "how hard to increase memory stability."
 * Elo difficulty (logit scale) measures "how hard to answer correctly right now."
 * These are related but distinct constructs.
 *
 * Research basis:
 * - Pelánek (2016): Elo ratings in education (Computers & Education, 98, 169-179)
 * - Settles & Meeder (2016): Half-Life Regression (ACL)
 * - Duolingo Birdbrain: Generalized Elo at scale
 * - IRT 3PL: P = c + (1-c) / (1 + e^(-a(θ-b)))
 *
 * @see lib/fsrs.ts — FSRS v6 scheduling (inter-session)
 * @see lib/services/drillReviewService.ts — Integration point
 */

// ─── Types ────────────────────────────────────────────────────────

/** Per-item difficulty estimate */
export interface ItemDifficulty {
  /** Item/card ID */
  itemId: string;
  /** Elo-estimated difficulty on logit scale (0 = average) */
  eloDifficulty: number;
  /** IRT 2PL discrimination parameter (how sharply it differentiates ability) */
  discrimination: number;
  /** Glicko-style uncertainty (decreases with more observations) */
  uncertainty: number;
  /** Total observations for this item */
  responseCount: number;
  /** Last update timestamp */
  lastUpdated: string;
}

/** Per-student, per-domain ability estimate */
export interface StudentAbility {
  /** User ID */
  userId: string;
  /** PANCE organ system domain */
  domain: string;
  /** Elo-estimated ability on logit scale (0 = average) */
  eloAbility: number;
  /** Glicko-style uncertainty */
  uncertainty: number;
  /** Total observations */
  responseCount: number;
}

/** Result of an Elo update after a student-item interaction */
export interface EloUpdateResult {
  /** Updated student ability */
  newAbility: number;
  /** Updated item difficulty */
  newDifficulty: number;
  /** Updated student uncertainty */
  newStudentUncertainty: number;
  /** Updated item uncertainty */
  newItemUncertainty: number;
  /** Expected probability before this interaction */
  expectedP: number;
  /** Information gained from this interaction */
  information: number;
}

/** A card in the session ordering queue with IRT metadata */
export interface OrderedCard {
  /** Card/item ID */
  itemId: string;
  /** Elo difficulty */
  eloDifficulty: number;
  /** IRT discrimination */
  discrimination: number;
  /** Expected P(correct) for this student */
  expectedP: number;
  /** Fisher information at current ability */
  information: number;
  /** PANCE domain */
  domain?: string;
}

// ─── Constants ────────────────────────────────────────────────────

/**
 * Base K factor for Elo updates.
 * Pelánek (2016) recommends K ≈ 0.4 for educational contexts.
 */
export const BASE_K_FACTOR = 0.4;

/** Minimum K factor (well-established estimates) */
export const MIN_K_FACTOR = 0.05;

/** Default initial Elo difficulty for new items */
export const DEFAULT_DIFFICULTY = 0;

/** Default initial Elo ability for new students */
export const DEFAULT_ABILITY = 0;

/** Default initial uncertainty (Glicko-style) */
export const DEFAULT_UNCERTAINTY = 2.0;

/** Minimum uncertainty (prevents over-certainty) */
export const MIN_UNCERTAINTY = 0.3;

/** Default IRT discrimination (1.0 = Rasch model equivalent) */
export const DEFAULT_DISCRIMINATION = 1.0;

/**
 * Guessing parameter for MCQ (4-option: c ≈ 0.25).
 * Used in 3PL IRT for lower asymptote.
 */
export const GUESSING_PARAM = 0.25;

/** Fraction of session items to inject as random-difficulty calibration probes */
export const CALIBRATION_PROBE_FRACTION = 0.12;

/** Fatigue accuracy threshold — shift to easier items when accuracy drops below */
export const FATIGUE_ACCURACY_THRESHOLD = 0.6;

/** Rolling window size for session fatigue detection */
export const FATIGUE_WINDOW = 10;

// ─── IRT Model Functions (Pure, exported for testing) ─────────────

/**
 * 3PL Item Response Function.
 * P(correct | θ, a, b, c) = c + (1 - c) / (1 + e^(-a(θ - b)))
 *
 * @param ability θ — student ability (logit scale)
 * @param difficulty b — item difficulty (logit scale)
 * @param discrimination a — item discrimination (default 1.0 = Rasch)
 * @param guessing c — lower asymptote (default 0.25 for 4-option MCQ)
 */
export function itemResponseFunction(
  ability: number,
  difficulty: number,
  discrimination: number = DEFAULT_DISCRIMINATION,
  guessing: number = GUESSING_PARAM
): number {
  const exp = Math.exp(-discrimination * (ability - difficulty));
  return guessing + (1 - guessing) / (1 + exp);
}

/**
 * 1PL Item Response (Rasch model). Equivalent to Elo expected score.
 * P(correct) = 1 / (1 + e^(-(θ - b)))
 */
export function raschProbability(
  ability: number,
  difficulty: number
): number {
  return 1 / (1 + Math.exp(-(ability - difficulty)));
}

/**
 * Fisher Information function for 2PL IRT.
 * I(θ) = a² × P(θ) × (1 - P(θ))
 *
 * Information peaks when θ ≈ b (item matched to student ability).
 * Higher discrimination → sharper information peak.
 */
export function fisherInformation(
  ability: number,
  difficulty: number,
  discrimination: number = DEFAULT_DISCRIMINATION
): number {
  const p = raschProbability(ability, difficulty);
  return discrimination * discrimination * p * (1 - p);
}

/**
 * Compute adaptive K factor using Glicko-style uncertainty weighting.
 * Higher uncertainty → larger K (more responsive to new data).
 * Well-established estimates → smaller K (more stable).
 *
 * K_effective = BASE_K × (uncertainty / DEFAULT_UNCERTAINTY)
 * Clamped to [MIN_K_FACTOR, BASE_K_FACTOR]
 */
export function adaptiveKFactor(uncertainty: number): number {
  const ratio = uncertainty / DEFAULT_UNCERTAINTY;
  return Math.max(MIN_K_FACTOR, Math.min(BASE_K_FACTOR, BASE_K_FACTOR * ratio));
}

// ─── Elo Update ───────────────────────────────────────────────────

/**
 * Perform an Elo update after a student-item interaction.
 *
 * Updates both student ability and item difficulty:
 *   θ_student ← θ_student + K_student × (outcome - P_expected)
 *   θ_item   ← θ_item   - K_item   × (outcome - P_expected)
 *
 * Uses Glicko-style uncertainty weighting for adaptive K factors.
 *
 * @param ability Current student ability (logit)
 * @param difficulty Current item difficulty (logit)
 * @param isCorrect Whether the student answered correctly
 * @param studentUncertainty Student's uncertainty
 * @param itemUncertainty Item's uncertainty
 * @param discrimination Item's discrimination parameter
 */
export function eloUpdate(
  ability: number,
  difficulty: number,
  isCorrect: boolean,
  studentUncertainty: number = DEFAULT_UNCERTAINTY,
  itemUncertainty: number = DEFAULT_UNCERTAINTY,
  discrimination: number = DEFAULT_DISCRIMINATION
): EloUpdateResult {
  const expectedP = raschProbability(ability, difficulty);
  const outcome = isCorrect ? 1 : 0;
  const surprise = outcome - expectedP;

  // Adaptive K factors based on uncertainty
  const kStudent = adaptiveKFactor(studentUncertainty);
  const kItem = adaptiveKFactor(itemUncertainty);

  // Update ability (student gets stronger or weaker)
  const newAbility = ability + kStudent * surprise;

  // Update difficulty (item gets easier or harder) — opposite direction
  const newDifficulty = difficulty - kItem * surprise;

  // Reduce uncertainty after observation (Bayesian shrinkage toward MIN)
  const uncertaintyDecay = 0.98;
  const newStudentUncertainty = Math.max(
    MIN_UNCERTAINTY,
    studentUncertainty * uncertaintyDecay
  );
  const newItemUncertainty = Math.max(
    MIN_UNCERTAINTY,
    itemUncertainty * uncertaintyDecay
  );

  // Information from this interaction
  const information = fisherInformation(ability, difficulty, discrimination);

  return {
    newAbility,
    newDifficulty,
    newStudentUncertainty,
    newItemUncertainty,
    expectedP,
    information,
  };
}

// ─── Session Ordering Algorithm ───────────────────────────────────

/**
 * Order a pool of due cards for optimal within-session presentation.
 *
 * Strategy:
 * 1. Start with a medium-difficulty card (near θ) as warm-up
 * 2. Apply maximum information selection (card whose b best matches θ)
 * 3. Interleave occasional easier cards for confidence building
 * 4. Inject calibration probes (random difficulty) for parameter stability
 * 5. Track session fatigue: shift to easier items if accuracy drops
 *
 * @param cards Pool of due cards with difficulty metadata
 * @param ability Current student ability for this domain
 * @param sessionHistory Recent correct/incorrect outcomes for fatigue detection
 */
export function orderSessionCards(
  cards: ReadonlyArray<{
    itemId: string;
    eloDifficulty: number;
    discrimination?: number;
    domain?: string;
  }>,
  ability: number,
  sessionHistory: ReadonlyArray<boolean> = []
): OrderedCard[] {
  if (cards.length === 0) return [];

  // Check for fatigue
  const isFatigued = detectSessionFatigue(sessionHistory);

  // Compute expected P and information for each card
  const scored = cards.map((card) => {
    const disc = card.discrimination ?? DEFAULT_DISCRIMINATION;
    const expectedP = itemResponseFunction(ability, card.eloDifficulty, disc);
    const info = fisherInformation(ability, card.eloDifficulty, disc);

    return {
      itemId: card.itemId,
      eloDifficulty: card.eloDifficulty,
      discrimination: disc,
      expectedP,
      information: info,
      domain: card.domain,
    };
  });

  // Sort by information (descending) for max-info selection
  const byInfo = [...scored].sort((a, b) => b.information - a.information);

  // Sort by difficulty distance from ability (ascending) for warm-up
  const byDiffDistance = [...scored].sort(
    (a, b) => Math.abs(a.eloDifficulty - ability) - Math.abs(b.eloDifficulty - ability)
  );

  // Sort by easiness (ascending difficulty) for fatigue adjustment
  const byEasy = [...scored].sort((a, b) => a.eloDifficulty - b.eloDifficulty);

  const ordered: OrderedCard[] = [];
  const used = new Set<string>();

  // Helper: pick first unused from a list
  const pickUnused = (list: OrderedCard[]): OrderedCard | null => {
    for (const card of list) {
      if (!used.has(card.itemId)) {
        used.add(card.itemId);
        return card;
      }
    }
    return null;
  };

  // Step 1: Warm-up card (medium difficulty, near ability)
  const warmup = pickUnused(byDiffDistance);
  if (warmup) ordered.push(warmup);

  // Step 2: Fill remaining slots
  const remaining = scored.length - ordered.length;

  for (let i = 0; i < remaining; i++) {
    const slotIndex = i + 1; // 1-indexed (0 was warm-up)

    // Every Nth card is a calibration probe (random from remaining)
    if (slotIndex % Math.floor(1 / CALIBRATION_PROBE_FRACTION) === 0) {
      const available = scored.filter((c) => !used.has(c.itemId));
      if (available.length > 0) {
        const randomIdx = Math.floor(Math.random() * available.length);
        const probe = available[randomIdx];
        used.add(probe.itemId);
        ordered.push(probe);
        continue;
      }
    }

    // If fatigued, shift toward easier items
    if (isFatigued) {
      const easy = pickUnused(byEasy);
      if (easy) {
        ordered.push(easy);
        continue;
      }
    }

    // Every 5th card: interleave an easier card for confidence
    if (slotIndex % 5 === 0) {
      const easy = pickUnused(byEasy);
      if (easy) {
        ordered.push(easy);
        continue;
      }
    }

    // Default: maximum information selection
    const maxInfo = pickUnused(byInfo);
    if (maxInfo) ordered.push(maxInfo);
  }

  return ordered;
}

/**
 * Detect session fatigue from recent answer history.
 * Returns true if rolling accuracy drops below threshold.
 */
export function detectSessionFatigue(
  history: ReadonlyArray<boolean>,
  window: number = FATIGUE_WINDOW,
  threshold: number = FATIGUE_ACCURACY_THRESHOLD
): boolean {
  if (history.length < window) return false;
  const recent = history.slice(-window);
  const accuracy = recent.filter(Boolean).length / recent.length;
  return accuracy < threshold;
}

/**
 * Compute initial Elo difficulty from FSRS difficulty.
 * Maps FSRS D (1-10 scale) to Elo logit scale (-3 to +3).
 *
 * This provides a population-level prior for new items,
 * so the Elo system doesn't start from zero.
 */
export function fsrsDifficultyToElo(fsrsDifficulty: number): number {
  // FSRS D: 1=easy, 10=hard. Map to logit: -3=easy, +3=hard
  // Linear mapping: elo = (D - 5.5) * (6/9) ≈ (D - 5.5) * 0.667
  return (fsrsDifficulty - 5.5) * 0.667;
}

/**
 * Compute initial FSRS difficulty prior from Elo difficulty.
 * Inverse of fsrsDifficultyToElo.
 * Useful for setting initial FSRS D when Elo has converged first.
 */
export function eloToFsrsDifficulty(eloDifficulty: number): number {
  // Inverse: D = elo / 0.667 + 5.5
  const d = eloDifficulty / 0.667 + 5.5;
  return Math.max(1, Math.min(10, d));
}
