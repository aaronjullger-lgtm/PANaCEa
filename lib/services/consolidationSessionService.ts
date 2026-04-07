/**
 * Pre-Sleep Consolidation Session Card Selector (Tier 2, Feature 5)
 *
 * Selects and orders cards for a brief pre-bedtime review session designed
 * to leverage sleep-dependent memory consolidation (Mazza et al., 2016).
 *
 * Key research:
 *   - Mazza et al. (2016, Psychological Science): Evening study + sleep → 50%
 *     fewer practice trials, ~2× retention at 6 months vs. morning-only
 *   - Diekelmann & Born (2010, Nature Reviews Neuroscience): Active systems
 *     consolidation during slow-wave sleep requires ~90 min of sleep
 *   - Gais, Lucas & Born (2006): Learning close to sleep → significantly less
 *     forgetting (F₁,₁₁ = 9.8, P < 0.01)
 *
 * Session design constraints (from tier2.md):
 *   - Timing: 60-120 min before bedtime
 *   - Duration: 10-15 min (≤16 items per Mazza protocol)
 *   - Content: Active retrieval with feedback, NOT passive review
 *   - Difficulty: Cards near FSRS R threshold (0.85-0.95)
 *   - Priority: (1) Failed earlier today, (2) learned today, (3) approaching due
 *   - Avoid: New cards, highly difficult material (arousal interference)
 *
 * Architecture:
 *   Pure computation layer — no database or network dependencies.
 *   Edge API endpoint fetches cards and calls these functions.
 *
 * @see lib/circadian.ts — Circadian phase detection, wake/sleep time parsing
 * @see functions/api/srs/consolidation-session.ts — Edge API endpoint
 * @module lib/services/consolidationSessionService
 */

// ─── Types ────────────────────────────────────────────────────────

/** A card candidate for the consolidation session */
export interface ConsolidationCandidate {
  /** Card/question ID */
  cardId: string;
  /** Current FSRS retrievability (0-1) */
  retrievability: number;
  /** FSRS difficulty (1-10) */
  difficulty: number;
  /** FSRS stability (days) */
  stability: number;
  /** Was this card answered earlier today? */
  reviewedToday: boolean;
  /** Was the most recent review today incorrect? */
  failedToday: boolean;
  /** Was this card first introduced today (new learning)? */
  learnedToday: boolean;
  /** Next scheduled review date */
  nextReviewDate: Date;
  /** Organ system / domain */
  domain?: string;
}

/** Result of the consolidation card selection */
export interface ConsolidationCard {
  /** Card/question ID */
  cardId: string;
  /** Position in the session order (0-indexed) */
  position: number;
  /** Why this card was selected */
  selectionReason: ConsolidationReason;
  /** Priority score used for ordering */
  priorityScore: number;
  /** Domain (passthrough) */
  domain?: string;
}

/** Reason a card was selected for consolidation */
export type ConsolidationReason =
  | 'failed_today'      // Priority 1: Failed earlier today — strongest reactivation signal
  | 'learned_today'     // Priority 2: First sleep consolidation for new learning
  | 'approaching_due'   // Priority 3: Due date approaching, pre-emptive retrieval
  | 'threshold_review'; // Priority 4: Near R threshold, efficient retrieval practice

/** Configuration for consolidation session generation */
export interface ConsolidationConfig {
  /** Maximum number of cards in the session */
  maxCards: number;
  /** Maximum session duration in minutes */
  maxMinutes: number;
  /** Estimated seconds per card (for duration calculation) */
  secondsPerCard: number;
  /** Minimum retrievability for inclusion (avoid too-easy cards) */
  minRetrievability: number;
  /** Maximum retrievability for inclusion (avoid already-solid cards) */
  maxRetrievability: number;
  /** Maximum FSRS difficulty allowed (avoid stress-inducing cards) */
  maxDifficulty: number;
  /** Days ahead to look for "approaching due" cards */
  approachingDueDays: number;
}

// ─── Constants ────────────────────────────────────────────────────

/** Default consolidation session configuration */
export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  maxCards: 16,          // Mazza protocol used 16 items
  maxMinutes: 15,        // 10-15 min cap
  secondsPerCard: 45,    // ~45s per retrieval + feedback
  minRetrievability: 0.40, // Below 0.40 = too hard, causes arousal
  maxRetrievability: 0.95, // Above 0.95 = too easy, no retrieval effort
  maxDifficulty: 8.0,    // FSRS D scale 1-10; ≥8 is very hard → avoid
  approachingDueDays: 3, // Cards due within 3 days
};

/** Priority weights for each selection reason */
const PRIORITY_WEIGHTS: Record<ConsolidationReason, number> = {
  failed_today: 100,      // Highest: reactivate failed memories before sleep
  learned_today: 80,      // High: first consolidation opportunity
  approaching_due: 60,    // Medium: pre-emptive maintenance
  threshold_review: 40,   // Base: efficient retrieval practice
};

/** Minimum consolidation window before bedtime (minutes) */
export const MIN_BEDTIME_OFFSET_MINUTES = 60;

/** Maximum consolidation window before bedtime (minutes) */
export const MAX_BEDTIME_OFFSET_MINUTES = 120;

// ─── Core Selection Algorithm ─────────────────────────────────────

/**
 * Select and order cards for a pre-sleep consolidation session.
 *
 * Implements the tier2.md priority ordering:
 *   1. Cards failed earlier today (reactivation before sleep)
 *   2. Cards learned today (first sleep consolidation)
 *   3. Cards approaching their due date
 *   4. Cards near R threshold (efficient retrieval practice)
 *
 * Filters out:
 *   - Cards with R > maxRetrievability (too easy)
 *   - Cards with R < minRetrievability (too hard, stress risk)
 *   - Cards with FSRS D > maxDifficulty (arousal interference)
 *
 * Within each priority tier, orders by retrievability ascending
 * (harder retrieval = more consolidation benefit).
 *
 * @param candidates - Pool of available cards with FSRS state
 * @param config - Session configuration
 * @returns Selected and ordered cards for the session
 */
export function selectConsolidationCards(
  candidates: ReadonlyArray<ConsolidationCandidate>,
  config: Partial<ConsolidationConfig> = {}
): ConsolidationCard[] {
  const cfg = { ...DEFAULT_CONSOLIDATION_CONFIG, ...config };

  // Step 1: Filter candidates
  const eligible = candidates.filter(c => isEligible(c, cfg));

  if (eligible.length === 0) return [];

  // Step 2: Score and categorize each card
  const now = new Date();
  const scored = eligible.map(c => {
    const reason = classifyReason(c, cfg, now);
    return {
      card: c,
      reason,
      priority: computePriority(c, reason, now),
    };
  });

  // Step 3: Sort by priority descending, then by retrievability ascending
  // (within same priority tier, harder retrieval = more benefit)
  scored.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.card.retrievability - b.card.retrievability;
  });

  // Step 4: Cap by card count and session duration
  const maxByDuration = Math.floor((cfg.maxMinutes * 60) / cfg.secondsPerCard);
  const limit = Math.min(cfg.maxCards, maxByDuration);

  // Step 5: Interleave domains for variety (avoid blocking)
  const selected = domainInterleave(scored.slice(0, limit * 2), limit);

  // Step 6: Assign positions
  return selected.map((s, i) => ({
    cardId: s.card.cardId,
    position: i,
    selectionReason: s.reason,
    priorityScore: s.priority,
    domain: s.card.domain,
  }));
}

// ─── Eligibility Filter ───────────────────────────────────────────

/**
 * Check if a card is eligible for consolidation review.
 *
 * Excludes cards that are:
 *   - Too easy (R > maxRetrievability): no retrieval effort needed
 *   - Too hard (R < minRetrievability): risk of stress/arousal
 *   - Too difficult (D > maxDifficulty): cognitive arousal concern
 */
function isEligible(
  card: ConsolidationCandidate,
  config: ConsolidationConfig
): boolean {
  // Failed-today cards bypass the R floor — reactivation is the goal
  if (card.failedToday) {
    return card.difficulty <= config.maxDifficulty;
  }

  // Learned-today cards get a relaxed R ceiling (they may still be fresh)
  if (card.learnedToday) {
    return card.difficulty <= config.maxDifficulty &&
           card.retrievability >= config.minRetrievability;
  }

  // Standard R window for all other cards
  return card.retrievability >= config.minRetrievability &&
         card.retrievability <= config.maxRetrievability &&
         card.difficulty <= config.maxDifficulty;
}

// ─── Priority Classification ──────────────────────────────────────

/**
 * Classify why a card should be included in consolidation.
 */
function classifyReason(
  card: ConsolidationCandidate,
  config: ConsolidationConfig,
  now: Date = new Date()
): ConsolidationReason {
  if (card.failedToday) return 'failed_today';
  if (card.learnedToday) return 'learned_today';

  const daysUntilDue = (card.nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue <= config.approachingDueDays) return 'approaching_due';

  return 'threshold_review';
}

/**
 * Compute composite priority score for a card.
 *
 * Base weight from reason tier + bonus from retrievability position
 * within the optimal consolidation zone (0.85-0.95 R per Mazza).
 */
function computePriority(
  card: ConsolidationCandidate,
  reason: ConsolidationReason,
  now: Date
): number {
  let score = PRIORITY_WEIGHTS[reason];

  // Bonus for cards in the "sweet spot" R range (0.85-0.95)
  // where retrieval is effortful but achievable
  if (card.retrievability >= 0.85 && card.retrievability <= 0.95) {
    score += 10;
  }

  // Slight bonus for cards reviewed today (reactivation synergy)
  if (card.reviewedToday && reason !== 'failed_today') {
    score += 5;
  }

  // Urgency bonus: closer to due date = higher priority
  const daysUntilDue = (card.nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue <= 1) {
    score += 15; // Due tomorrow
  } else if (daysUntilDue <= 2) {
    score += 8;  // Due in 2 days
  }

  return score;
}

// ─── Domain Interleaving ──────────────────────────────────────────

/**
 * Interleave cards from different domains to prevent blocking.
 *
 * Takes a priority-sorted candidate list and spreads domains apart
 * while mostly preserving priority order. This reduces interference
 * between related concepts during the consolidation session.
 */
function domainInterleave(
  sorted: ReadonlyArray<{ card: ConsolidationCandidate; reason: ConsolidationReason; priority: number }>,
  limit: number
): Array<{ card: ConsolidationCandidate; reason: ConsolidationReason; priority: number }> {
  if (sorted.length <= 1) return sorted.slice(0, limit);

  const result: typeof sorted[number][] = [];
  const remaining = [...sorted];
  let lastDomain: string | undefined;

  while (result.length < limit && remaining.length > 0) {
    // Find the highest-priority card with a different domain than the last
    let bestIdx = -1;

    if (lastDomain) {
      bestIdx = remaining.findIndex(c => c.card.domain !== lastDomain);
    }

    // If no different-domain card found, just take the highest priority
    if (bestIdx === -1) bestIdx = 0;

    const picked = remaining.splice(bestIdx, 1)[0]!;
    result.push(picked);
    lastDomain = picked.card.domain;
  }

  return result;
}

// ─── Bedtime Window Detection ─────────────────────────────────────

/**
 * Determine if the current time falls within the consolidation window.
 *
 * The window is [bedtime - MAX_OFFSET, bedtime - MIN_OFFSET], i.e.
 * 60-120 minutes before bedtime. This avoids screen time too close
 * to sleep while maximizing the pre-sleep consolidation benefit.
 *
 * @param currentHour - Current local hour (0-23, fractional OK)
 * @param bedtimeHour - User's bedtime hour (0-23)
 * @param bedtimeMinute - User's bedtime minute (0-59)
 * @returns Whether the current time is in the consolidation window
 */
export function isInConsolidationWindow(
  currentHour: number,
  bedtimeHour: number,
  bedtimeMinute: number = 0
): boolean {
  const bedtimeDecimal = bedtimeHour + bedtimeMinute / 60;
  const windowStart = bedtimeDecimal - MAX_BEDTIME_OFFSET_MINUTES / 60;
  const windowEnd = bedtimeDecimal - MIN_BEDTIME_OFFSET_MINUTES / 60;

  // Handle midnight crossing
  let start = windowStart;
  let end = windowEnd;

  if (start < 0) start += 24;
  if (end < 0) end += 24;

  // If window crosses midnight
  if (start > end) {
    return currentHour >= start || currentHour <= end;
  }

  return currentHour >= start && currentHour <= end;
}

/**
 * Calculate the ideal notification time for a consolidation session.
 *
 * Returns the time (as { hour, minute }) at which to send the
 * "Time for your bedtime review!" push notification.
 * This is bedtime - MAX_BEDTIME_OFFSET_MINUTES (start of window).
 *
 * @param bedtimeHour - User's bedtime hour (0-23)
 * @param bedtimeMinute - User's bedtime minute (0-59)
 * @returns Notification time as { hour, minute }
 */
export function getConsolidationNotificationTime(
  bedtimeHour: number,
  bedtimeMinute: number = 0
): { hour: number; minute: number } {
  let totalMinutes = bedtimeHour * 60 + bedtimeMinute - MAX_BEDTIME_OFFSET_MINUTES;
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

// ─── Session Metrics ──────────────────────────────────────────────

/** Summary statistics for a consolidation session selection */
export interface ConsolidationSessionSummary {
  /** Total cards selected */
  totalCards: number;
  /** Estimated session duration in minutes */
  estimatedMinutes: number;
  /** Breakdown by selection reason */
  reasonBreakdown: Record<ConsolidationReason, number>;
  /** Average retrievability of selected cards */
  averageRetrievability: number;
  /** Number of unique domains represented */
  uniqueDomains: number;
  /** Whether the session meets minimum viable size (≥3 cards) */
  isViable: boolean;
}

/**
 * Compute summary statistics for a consolidation session.
 */
export function summarizeConsolidationSession(
  cards: ReadonlyArray<ConsolidationCard>,
  candidates: ReadonlyArray<ConsolidationCandidate>,
  config: Partial<ConsolidationConfig> = {}
): ConsolidationSessionSummary {
  const cfg = { ...DEFAULT_CONSOLIDATION_CONFIG, ...config };
  const candidateMap = new Map(candidates.map(c => [c.cardId, c]));

  const reasonBreakdown: Record<ConsolidationReason, number> = {
    failed_today: 0,
    learned_today: 0,
    approaching_due: 0,
    threshold_review: 0,
  };

  let totalR = 0;
  const domains = new Set<string>();

  for (const card of cards) {
    reasonBreakdown[card.selectionReason]++;
    const candidate = candidateMap.get(card.cardId);
    if (candidate) {
      totalR += candidate.retrievability;
      if (candidate.domain) domains.add(candidate.domain);
    }
  }

  return {
    totalCards: cards.length,
    estimatedMinutes: Math.ceil((cards.length * cfg.secondsPerCard) / 60),
    reasonBreakdown,
    averageRetrievability: cards.length > 0 ? totalR / cards.length : 0,
    uniqueDomains: domains.size,
    isViable: cards.length >= 3,
  };
}
