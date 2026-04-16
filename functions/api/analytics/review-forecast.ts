/**
 * Review Forecast API
 * GET /api/analytics/review-forecast
 *
 * Returns a 7-day review load forecast from UserProgress.nextReviewAt.
 * Also returns count of overdue cards (nextReviewAt < now).
 * Optionally breaks down by system for daily detail views.
 *
 * @see components/dashboard/ReviewCalendar.tsx
 * @see hooks/useReviewForecast.ts
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { z } from 'zod';

const querySchema = z.object({}).optional().default({});

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  count: number;
  /** Top systems with counts, for drill-down detail */
  systems?: { system: string; count: number }[];
}

export interface ReviewForecastResponse {
  overdue: number;
  today: number;
  forecast: ForecastDay[];
  totalActive: number;
}

export const onRequestGet = authenticatedEndpoint(
  querySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const userId = await resolveUserId(prisma, context.auth.userId);
      if (!userId) {
        return Response.json(
          { data: { overdue: 0, today: 0, forecast: [], totalActive: 0 } satisfies ReviewForecastResponse },
          { status: 404 },
        );
      }
      const now = new Date();

      // Get the start of today (UTC)
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );

      // End of 7-day window
      const endDate = new Date(todayStart);
      endDate.setUTCDate(endDate.getUTCDate() + 7);

      // Count overdue cards (nextReviewAt < start of today)
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

      // Aggregate by day
      const dayMap = new Map<string, { count: number; systems: Map<string, number> }>();

      // Initialize all 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(todayStart);
        d.setUTCDate(d.getUTCDate() + i);
        const key = d.toISOString().split('T')[0]!;
        dayMap.set(key, { count: 0, systems: new Map() });
      }

      for (const card of upcomingCards) {
        if (!card.nextReviewAt) continue;
        const dateKey = card.nextReviewAt.toISOString().split('T')[0]!;
        const entry = dayMap.get(dateKey);
        if (!entry) continue;

        entry.count++;

        const system = card.system || 'Unknown';
        entry.systems.set(system, (entry.systems.get(system) || 0) + 1);
      }

      // Build forecast array
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

      const todayKey = todayStart.toISOString().split('T')[0]!;
      const todayCount = dayMap.get(todayKey)?.count ?? 0;

      return Response.json({
        data: {
          overdue: overdueCount,
          today: todayCount,
          forecast,
          totalActive,
        } satisfies ReviewForecastResponse,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
