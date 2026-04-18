/**
 * Content Freshness SLA
 *
 * Clinical content decays — guidelines shift, first-line drugs change, new
 * meta-analyses supersede older reviews. PANaCEa's safety mandate requires
 * that staleness be *measurable and visible* so PA students know when a page
 * may lag behind current practice.
 *
 * Thresholds:
 *   - FRESH      (≤ 90 days since last review): no badge, content is current
 *   - AGING      (91–180 days): informational badge — plan a re-review soon
 *   - STALE      (> 180 days): warning badge — verify against a current source
 *   - UNKNOWN    (no timestamp): warning badge — never marked reviewed
 *
 * Rationale for 90-day floor: matches the existing cadence assumed by
 * `scripts/data-integrity-monitor.ts` and is short enough to catch guideline
 * updates (e.g., annual society updates, quarterly drug label changes) while
 * long enough that well-curated content does not get flagged every sprint.
 *
 * These constants drive both the `<LastReviewedBadge>` component and future
 * health-check scripts, so there is a single source of truth for staleness.
 */

export const FRESHNESS_SLA_DAYS = 90;
export const AGING_SLA_DAYS = 180;

export type FreshnessState = 'fresh' | 'aging' | 'stale' | 'unknown';

export interface FreshnessAssessment {
  state: FreshnessState;
  /** Whole days since the timestamp; null when no timestamp was supplied. */
  ageInDays: number | null;
  /** The absolute timestamp used; null when unknown. */
  referenceDate: Date | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Classify a content item's freshness relative to "now" (or an injected clock
 * for deterministic tests).
 *
 * Accepts `Date | string | null | undefined` — UI components commonly have
 * ISO strings from API responses, while server code has `Date` objects.
 */
export function getFreshnessState(
  lastReviewedAt: Date | string | null | undefined,
  now: Date = new Date()
): FreshnessAssessment {
  if (lastReviewedAt == null || lastReviewedAt === '') {
    return { state: 'unknown', ageInDays: null, referenceDate: null };
  }

  const ref = lastReviewedAt instanceof Date ? lastReviewedAt : new Date(lastReviewedAt);
  const refTime = ref.getTime();

  if (Number.isNaN(refTime)) {
    return { state: 'unknown', ageInDays: null, referenceDate: null };
  }

  const ageMs = now.getTime() - refTime;
  // Negative ages (future timestamps, clock skew) are treated as fresh rather
  // than throwing — staleness is a lower-bound safety signal, not data-integrity
  // validation. A future timestamp cannot be stale.
  const ageInDays = Math.max(0, Math.floor(ageMs / MS_PER_DAY));

  let state: FreshnessState;
  if (ageInDays <= FRESHNESS_SLA_DAYS) state = 'fresh';
  else if (ageInDays <= AGING_SLA_DAYS) state = 'aging';
  else state = 'stale';

  return { state, ageInDays, referenceDate: ref };
}

/**
 * Format an age-in-days as a short human string: "2d", "3w", "5mo", "2y".
 * Used by the badge to keep the label compact in dense reference views.
 */
export function formatAge(ageInDays: number | null): string {
  if (ageInDays == null) return 'never';
  if (ageInDays < 1) return 'today';
  if (ageInDays < 7) return `${ageInDays}d`;
  if (ageInDays < 30) return `${Math.floor(ageInDays / 7)}w`;
  if (ageInDays < 365) return `${Math.floor(ageInDays / 30)}mo`;
  return `${Math.floor(ageInDays / 365)}y`;
}
