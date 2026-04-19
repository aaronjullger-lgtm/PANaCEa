/**
 * Rotation-week math — the canonical helper for "what week of rotation
 * is the student on?"
 *
 * Why this exists:
 *   The previous inlined formula in DashboardPage.tsx computed
 *   `Math.floor(diffMs / (7 * 86400000)) + 1`, which is off by one hour
 *   every DST transition. A student who started a rotation on
 *   2026-03-01 in Los Angeles would silently flip from "Week 4" to
 *   "Week 5" on 2026-03-29 (the spring-forward boundary swallows an
 *   hour, so diffMs crosses the 28*86400000 threshold an hour earlier
 *   than the calendar actually says it should).
 *
 *   This file returns the correct value by walking *calendar days* in
 *   the user's local tz, not milliseconds. Reuses primitives from
 *   `lib/time/userTz.ts`.
 *
 * Pure functions, no I/O. Safe to import from Edge runtime and browser.
 */

import { formatLocalDay, normalizeTz } from './userTz';

/**
 * Validate that a YYYY-MM-DD string actually refers to a real calendar
 * date (rejects `2026-13-99`, `2026-02-30`, etc.). The regex test alone
 * isn't enough because `Date.UTC(2026, 12, 99)` silently rolls over
 * instead of throwing.
 */
function isRealYmd(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Round-trip: formatting the UTC-noon instant back to YYYY-MM-DD must
  // match — catches e.g. 2026-02-30 → "2026-03-02".
  const ts = Date.UTC(year, month - 1, day, 12);
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const round = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return round === key;
}

/**
 * How many days apart two local-day keys are. Positive = `later` comes
 * after `earlier`. Uses UTC-noon anchors so the count is immune to DST
 * skew (12 ± 1h DST still sits firmly in the target day).
 */
function diffDays(earlier: string, later: string): number {
  const a = Date.UTC(
    Number(earlier.slice(0, 4)),
    Number(earlier.slice(5, 7)) - 1,
    Number(earlier.slice(8, 10)),
    12
  );
  const b = Date.UTC(
    Number(later.slice(0, 4)),
    Number(later.slice(5, 7)) - 1,
    Number(later.slice(8, 10)),
    12
  );
  return Math.round((b - a) / 86400_000);
}

/**
 * Compute the 1-based rotation week for a given start date and `now`.
 *
 * Rules:
 *   - Returns `undefined` when `rotationStartDate` is missing or unparseable.
 *   - The day `rotationStartDate` falls on is Week 1, day 1.
 *   - Days before the start date also return Week 1 (rotation hasn't
 *     begun yet; showing "Week 0" or a negative number is user-hostile).
 *   - Week boundaries are calendar-day based in the user's local tz:
 *     days 1–7 → Week 1, days 8–14 → Week 2, etc. Immune to DST.
 *
 * @param rotationStartDate ISO string, `Date`, or raw YYYY-MM-DD
 * @param tz IANA timezone (falls back to UTC)
 * @param now Optional reference instant (defaults to `Date.now()`); useful for tests
 */
export function computeRotationWeek(
  rotationStartDate: string | Date | null | undefined,
  tz: string = 'UTC',
  now: Date = new Date()
): number | undefined {
  if (!rotationStartDate) return undefined;

  const safeTz = normalizeTz(tz);

  // Normalize the start into a local-day key. Accept both ISO timestamps
  // and bare YYYY-MM-DD strings.
  let startKey: string;
  if (rotationStartDate instanceof Date) {
    if (Number.isNaN(rotationStartDate.getTime())) return undefined;
    startKey = formatLocalDay(rotationStartDate, safeTz);
  } else if (typeof rotationStartDate === 'string') {
    const trimmed = rotationStartDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      if (!isRealYmd(trimmed)) return undefined;
      startKey = trimmed;
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return undefined;
      startKey = formatLocalDay(parsed, safeTz);
    }
  } else {
    return undefined;
  }

  const todayKey = formatLocalDay(now, safeTz);
  const days = diffDays(startKey, todayKey);

  if (days < 0) return 1; // Rotation hasn't started yet.
  return Math.floor(days / 7) + 1;
}

/**
 * Compute the 1-based day-of-rotation (1..∞) for UIs that want finer
 * granularity than week. Same guardrails as {@link computeRotationWeek}.
 */
export function computeRotationDay(
  rotationStartDate: string | Date | null | undefined,
  tz: string = 'UTC',
  now: Date = new Date()
): number | undefined {
  if (!rotationStartDate) return undefined;
  const safeTz = normalizeTz(tz);

  let startKey: string;
  if (rotationStartDate instanceof Date) {
    if (Number.isNaN(rotationStartDate.getTime())) return undefined;
    startKey = formatLocalDay(rotationStartDate, safeTz);
  } else if (typeof rotationStartDate === 'string') {
    const trimmed = rotationStartDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      if (!isRealYmd(trimmed)) return undefined;
      startKey = trimmed;
    } else {
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return undefined;
      startKey = formatLocalDay(parsed, safeTz);
    }
  } else {
    return undefined;
  }

  const todayKey = formatLocalDay(now, safeTz);
  const days = diffDays(startKey, todayKey);
  if (days < 0) return 1;
  return days + 1;
}
