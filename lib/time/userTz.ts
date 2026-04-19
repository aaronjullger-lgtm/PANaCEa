/**
 * User-timezone helpers — the single source of truth for "what day is it
 * *for this user*" math across analytics endpoints and dashboard widgets.
 *
 * Why this exists:
 *   Prior code used `Date.UTC(...)` and `.toISOString().slice(0,10)` to bucket
 *   days. For a PT user studying at 22:00 local, a card due at 2026-04-19T02:00Z
 *   is "tomorrow" in UTC but "today" on their calendar. That made the review
 *   forecast say 0 today / N tomorrow, and the study heatmap mis-dot sessions
 *   across midnight. Forecast trust dies on the first lie.
 *
 * Design:
 *   - Accept an IANA timezone string (e.g. "America/Los_Angeles"). Default to
 *     UTC. Validate via `Intl.DateTimeFormat` so a typo becomes UTC, not a
 *     thrown exception that hides the bug.
 *   - `formatLocalDay` returns the user's local YYYY-MM-DD for an instant.
 *   - `startOfLocalDay` returns the UTC instant marking the *start* of the
 *     local day, suitable for Prisma range filters.
 *   - `addDaysInTz` lets callers walk a 7-day window by local calendar days
 *     without tripping over DST boundaries.
 *
 * Pure functions, no I/O. Safe to import from Edge runtime and browser.
 */

/** Fallback used when no tz is supplied or validation fails. */
export const DEFAULT_TZ = 'UTC';

/**
 * Check whether a value is a legal IANA timezone the runtime can format.
 * Uses a try/catch against `Intl.DateTimeFormat` because there is no sync API
 * that exposes the full tz list consistently across Node, Bun, Chromium, and
 * Cloudflare Workers.
 */
export function isValidIanaTz(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a possibly-bogus tz string to a usable IANA tz. Falls back to
 * {@link DEFAULT_TZ} rather than throwing, so one bad query-param never 500s
 * an analytics call.
 */
export function normalizeTz(tz: string | null | undefined): string {
  return isValidIanaTz(tz) ? tz : DEFAULT_TZ;
}

/**
 * Best-effort browser timezone detection. Useful for client-side hooks;
 * returns {@link DEFAULT_TZ} in environments without `Intl`.
 */
export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidIanaTz(tz) ? tz : DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/**
 * Returns the YYYY-MM-DD string representing `instant` on the user's calendar.
 *
 * Uses the `en-CA` locale because it formats dates as `YYYY-MM-DD` by default,
 * sidestepping the en-US `MM/DD/YYYY` quirk and avoiding manual zero-padding.
 */
export function formatLocalDay(instant: Date, tz: string = DEFAULT_TZ): string {
  const safe = normalizeTz(tz);
  // en-CA → YYYY-MM-DD. Intl pads fields automatically.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safe,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Returns the user's local *year* as a number for the given instant.
 * Needed by heatmaps that only render the current calendar year.
 */
export function getLocalYear(instant: Date, tz: string = DEFAULT_TZ): number {
  const safe = normalizeTz(tz);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safe,
    year: 'numeric',
  }).formatToParts(instant);
  const year = parts.find((p) => p.type === 'year')?.value;
  return year ? Number(year) : instant.getUTCFullYear();
}

/**
 * Returns a `Date` representing the UTC instant at which the local day
 * containing `ref` *begins* in the given tz. This is the right anchor to
 * feed Prisma `gte:` / `lt:` filters on `nextReviewAt`.
 *
 * Implementation note: compute the local Y/M/D first via Intl, then walk back
 * up to 25 hours (DST span guard) to find the largest UTC instant whose local
 * date equals the target date and whose local H:M:S is 00:00:00. This avoids
 * the common `Date.UTC(y, m, d) - offset` trick that breaks on "fall-back"
 * DST transitions where an hour occurs twice.
 */
export function startOfLocalDay(
  tz: string = DEFAULT_TZ,
  ref: Date = new Date()
): Date {
  const safe = normalizeTz(tz);
  const dayKey = formatLocalDay(ref, safe); // e.g. "2026-04-18"

  // Parse YYYY-MM-DD. These are already the *local* fields.
  const [yearStr, monthStr, dayStr] = dayKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // First guess: treat local fields as if they were UTC. This is the right
  // answer in UTC, off by an offset elsewhere. Then snap forward/backward.
  let guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Compute the local day for `guess`; if it precedes the target day, walk
  // forward in 30-minute steps. If it follows, walk backward. Bounded loop
  // because tz offsets live in [-14h, +14h].
  const targetTime = `${yearStr}-${monthStr}-${dayStr}`;

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: safe,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const describe = (d: Date): { day: string; hour: number; minute: number } => {
    const parts = fmt.formatToParts(d);
    const g = (t: string): string =>
      parts.find((p) => p.type === t)?.value ?? '';
    const day = `${g('year')}-${g('month')}-${g('day')}`;
    // en-CA uses 24-hour; "24" occasionally appears for midnight — normalize.
    const rawHour = Number(g('hour'));
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number(g('minute'));
    return { day, hour, minute };
  };

  // Bound: ~60 iterations at 30min each = ±30h, enough for every IANA offset
  // including DST jumps.
  //
  // Direction rules:
  //   info.day < target                    → local is before target, step FORWARD
  //   info.day > target                    → local is after target,  step BACK
  //   info.day == target && hour/minute>0  → past midnight of target, step BACK
  //   info.day == target && hour==0, min==0 → exactly at local midnight, done
  const STEP_MS = 30 * 60 * 1000;
  for (let i = 0; i < 60; i++) {
    const info = describe(guess);
    if (info.day === targetTime && info.hour === 0 && info.minute === 0) {
      return guess;
    }
    if (info.day < targetTime) {
      // Local day is before the target — step forward.
      guess = new Date(guess.getTime() + STEP_MS);
    } else {
      // Either local day > target, or local day == target but past 00:00.
      // Both cases: step back toward local midnight.
      guess = new Date(guess.getTime() - STEP_MS);
    }
  }

  // Give up gracefully: return the first guess. Bucketing will still be
  // self-consistent because other callers run the same function.
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Given a local day key (YYYY-MM-DD) and an IANA tz, return the UTC instant
 * at which that local day begins. Convenience wrapper around
 * {@link startOfLocalDay} when you already have a day string.
 */
export function startOfLocalDayFromKey(
  dayKey: string,
  tz: string = DEFAULT_TZ
): Date {
  const [yearStr, monthStr, dayStr] = dayKey.split('-');
  // Use an instant safely inside the target local day (noon) so DST edge
  // cases don't push us into the wrong day before we renormalize.
  const noonUtc = new Date(
    Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 12, 0, 0, 0)
  );
  return startOfLocalDay(tz, noonUtc);
}

/**
 * Advance a local-day key by `days` calendar days in the given tz.
 * DST-safe: anchors at local noon, shifts by 86400 s * days, then reformats.
 */
export function addDaysInTz(
  dayKey: string,
  days: number,
  tz: string = DEFAULT_TZ
): string {
  const safe = normalizeTz(tz);
  const base = startOfLocalDayFromKey(dayKey, safe);
  // 12h offset keeps us inside the target day even if DST shifts 1h in/out.
  const anchor = new Date(base.getTime() + 12 * 60 * 60 * 1000);
  const shifted = new Date(anchor.getTime() + days * 86400_000);
  return formatLocalDay(shifted, safe);
}
