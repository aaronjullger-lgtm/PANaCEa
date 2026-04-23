/**
 * Review Forecast API
 * GET /api/analytics/review-forecast?tz=America/Los_Angeles
 *
 * Returns a 7-day review load forecast from UserProgress.nextReviewAt.
 * Also returns count of overdue cards (nextReviewAt < start of user's local today).
 * Optionally breaks down by system for daily detail views.
 *
 * Timezone semantics:
 *   Prior versions bucketed by UTC day. That silently lied to PT students
 *   studying at 22:00 local — a card due 2026-04-19T02:00Z shows as
 *   "tomorrow" by UTC but is actually "today" on the user's calendar. We
 *   now accept a `?tz=` IANA string, fall back to the
 *   UserPreferences.consolidationTimezone, and finally to UTC. Day buckets
 *   and the overdue threshold are all computed on the *user's* calendar.
 *
 * @see components/dashboard/ReviewCalendar.tsx
 * @see hooks/useReviewForecast.ts
 * @see lib/time/userTz.ts
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { z } from 'zod';
import {
  addDaysInTz,
  formatLocalDay,
  normalizeTz,
  startOfLocalDay,
  startOfLocalDayFromKey,
} from '../../../lib/time/userTz';

const querySchema = z.object({}).optional().default({});

export interface ForecastDay {
  date: string; // YYYY-MM-DD in user's local calendar
  count: number;
  /** Top systems with counts, for drill-down detail */
  systems?: { system: string; count: number }[];
}

export interface ReviewForecastResponse {
  overdue: number;
  today: number;
  forecast: ForecastDay[];
  totalActive: number;
  /** IANA timezone used to bucket days. Surfaces so the client can audit. */
  timezone: string;
}

export const onRequestGet = authenticatedEndpoint(
  querySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Resolve Clerk id (context.auth.userId) to internal User.id.
      // UserProgress.userId is the internal id — querying by Clerk id returns no rows.
      const userId = await resolveUserId(prisma, context.auth.userId);
      if (!userId) {
        return ok({
          overdue: 0,
          today: 0,
          forecast: [],
          totalActive: 0,
          timezone: 'UTC',
          meta: { status: 'user_not_synced' },
        }, { status: 404 });
      }

      // Timezone precedence: query param → UserPreferences → UTC.
      // Query param wins because the browser's resolved zone is the most
      // up-to-date signal (travel, laptop relocation); the stored pref is
      // the fallback for cron or server-side contexts where there is no
      // request origin.
      const urlTz = new URL(context.request.url).searchParams.get('tz');
      let tz = normalizeTz(urlTz);
      if (tz === 'UTC') {
        const prefs = await prisma.userPreferences.findUnique({
          where: { userId },
          select: { consolidationTimezone: true },
        });
        tz = normalizeTz(prefs?.consolidationTimezone);
      }

      const now = new Date();

      // Start of the user's local "today", expressed as a UTC instant.
      const todayStart = startOfLocalDay(tz, now);
      // End of the 7-day window = start of local day (today + 7).
      const endDate = startOfLocalDayFromKey(
        addDaysInTz(formatLocalDay(todayStart, tz), 7, tz),
        tz
      );

      // Count overdue cards (nextReviewAt < start of *local* today)
      const overdueCount = await prisma.userProgress.count({
        where: {
          userId,
          nextReviewAt: {
            lt: todayStart,
            not: null,
          },
        },
      });

      // Get all cards due within the 7-day window, including their system info
      const upcomingCards = await prisma.userProgress.findMany({
        where: {
          userId,
          nextReviewAt: {
            gte: todayStart,
            lt: endDate,
          },
        },
        select: {
          nextReviewAt: true,
          system: true,
        },
      });

      // Aggregate by user-local day. DST-safe: we derive each bucket key
      // from `addDaysInTz`, which walks calendar days (not 86400 s nudges).
      const dayMap = new Map<string, { count: number; systems: Map<string, number> }>();

      const todayKey = formatLocalDay(todayStart, tz);
      for (let i = 0; i < 7; i++) {
        const key = addDaysInTz(todayKey, i, tz);
        dayMap.set(key, { count: 0, systems: new Map() });
      }

      for (const card of upcomingCards) {
        if (!card.nextReviewAt) continue;
        const dateKey = formatLocalDay(card.nextReviewAt, tz);
        const entry = dayMap.get(dateKey);
        if (!entry) continue;

        entry.count++;

        const system = card.system || 'Unknown';
        entry.systems.set(system, (entry.systems.get(system) || 0) + 1);
      }

      // Build forecast array — preserve Map iteration order (which matches
      // insertion order, i.e. chronological).
      const forecast: ForecastDay[] = [];
      for (const [date, data] of dayMap) {
        const systems = Array.from(data.systems.entries())
          .map(([system, count]) => ({ system, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // Top 5 systems per day

        forecast.push({
          date,
          count: data.count,
          systems: systems.length > 0 ? systems : undefined,
        });
      }

      // Count total active cards
      const totalActive = await prisma.userProgress.count({
        where: {
          userId,
          nextReviewAt: { not: null },
        },
      });

      const todayCount = dayMap.get(todayKey)?.count ?? 0;

      return ok({
        overdue: overdueCount,
        today: todayCount,
        forecast,
        totalActive,
        timezone: tz,
      } satisfies ReviewForecastResponse);
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
