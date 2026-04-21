/**
 * Admin Calibration Report
 * GET /api/admin/calibration-report
 *
 * Reads CalibrationLog rows and reports scheduler calibration against realized
 * outcomes: Brier score, log-loss, Expected Calibration Error (ECE), reliability
 * diagram bins, overall accuracy, and mean predicted retrievability.
 *
 * All math lives in lib/scheduling/shadowValidator.ts (pure, deterministic, edge-safe).
 * This endpoint is strictly a consumer — it never mutates scheduler state. The goal
 * is to measure whether FSRS's predicted recall probability matches reality, without
 * changing any UI or scheduling behavior.
 *
 * Query params:
 *   - days: lookback window in days (default 30, max 365)
 *   - userId: optional filter — dbUserId (NOT Clerk ID) for per-student reports
 *   - sessionType: optional filter — 'MAIN' | 'DRILL' | etc. (falls through to Prisma enum)
 *   - binCount: reliability-diagram bins (default 10, min 2, max 50)
 *   - excludeRapidGuess: default true — rapid-guess reviews are excluded from scoring
 *
 * Admin-only endpoint, mirrors the pattern in cache-metrics.ts and platform-stats.ts.
 *
 * @see lib/scheduling/shadowValidator.ts — math
 * @see lib/scheduling/calibrationLogger.ts — emission site
 * @see prisma/schema.prisma → model CalibrationLog
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  computeCalibrationReport,
  type CalibrationSample,
} from '../../../lib/scheduling/shadowValidator';

const CalibrationReportSchema = z.object({
  query: z
    .object({
      days: z.string().optional(),
      userId: z.string().optional(),
      sessionType: z.string().optional(),
      binCount: z.string().optional(),
      excludeRapidGuess: z.string().optional(),
    })
    .optional(),
});

/** Minimal row shape we need from CalibrationLog — keeps this endpoint resilient
 *  to schema drift. The Prisma delegate may not be in the generated client until
 *  `prisma generate && npm run db:push` runs; we cast defensively.
 */
interface CalibrationLogRow {
  predictedRetrievability: number;
  actualOutcome: boolean;
  rapidGuess: boolean | null;
  sessionType: string | null;
  createdAt: Date;
  userId: string;
  telemetryQuality: string | null;
  ghostGraderRule: string | null;
  hypercorrectionEligible: boolean | null;
  isMastered: boolean | null;
  wilsonLower: number | null;
}

interface CalibrationLogDelegate {
  findMany: (args: {
    where: Record<string, unknown>;
    select: Record<string, true>;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }) => Promise<CalibrationLogRow[]>;
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
}

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 365;
const DEFAULT_BIN_COUNT = 10;
const MIN_BIN_COUNT = 2;
const MAX_BIN_COUNT = 50;
// Hard cap on rows scored in a single request — protects the edge worker from
// OOM and keeps p99 latency predictable. If a user exceeds this, we surface
// totalAvailable so the caller knows the window is truncated.
const ROW_HARD_CAP = 50_000;

export const onRequestGet = adminAuthenticatedEndpoint(
  CalibrationReportSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/calibration-report');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // adminAuthenticatedEndpoint has already gated admin access.
      const adminUserId = (auth.metadata as { dbUserId?: string } | undefined)?.dbUserId
        ?? auth.userId;

      // ---- Parse + clamp query params --------------------------------------
      const rawDays = validated.query?.days;
      const parsedDays = rawDays ? parseInt(rawDays, 10) : DEFAULT_LOOKBACK_DAYS;
      const days = Number.isFinite(parsedDays) && parsedDays > 0
        ? Math.min(parsedDays, MAX_LOOKBACK_DAYS)
        : DEFAULT_LOOKBACK_DAYS;

      const rawBinCount = validated.query?.binCount;
      const parsedBins = rawBinCount ? parseInt(rawBinCount, 10) : DEFAULT_BIN_COUNT;
      const binCount = Number.isFinite(parsedBins)
        ? Math.min(Math.max(parsedBins, MIN_BIN_COUNT), MAX_BIN_COUNT)
        : DEFAULT_BIN_COUNT;

      const userIdFilter = validated.query?.userId?.trim() || undefined;
      const sessionTypeFilter = validated.query?.sessionType?.trim() || undefined;
      const excludeRapidGuess = validated.query?.excludeRapidGuess !== 'false';

      const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // ---- Delegate fallback (pre-`prisma generate`) -----------------------
      const delegate = (prisma as unknown as { calibrationLog?: CalibrationLogDelegate })
        .calibrationLog;

      if (!delegate || typeof delegate.findMany !== 'function') {
        logger.warn('CalibrationLog delegate missing', {
          userId: adminUserId,
          hint: 'Run `prisma generate && npm run db:push`',
        });
        return {
          data: {
            success: false,
            error: 'CalibrationLog model not available',
            message:
              'The Prisma client does not expose CalibrationLog yet. Run `npx prisma generate && npm run db:push` to sync the schema.',
          },
          status: 503,
        };
      }

      // ---- Build Prisma where clause ---------------------------------------
      const where: Record<string, unknown> = {
        createdAt: { gte: windowStart },
      };
      if (userIdFilter) where.userId = userIdFilter;
      if (sessionTypeFilter) where.sessionType = sessionTypeFilter;
      if (excludeRapidGuess) where.rapidGuess = false;

      const totalAvailable = await delegate.count({ where });

      const rows = await delegate.findMany({
        where,
        select: {
          predictedRetrievability: true,
          actualOutcome: true,
          rapidGuess: true,
          sessionType: true,
          createdAt: true,
          userId: true,
          telemetryQuality: true,
          ghostGraderRule: true,
          hypercorrectionEligible: true,
          isMastered: true,
          wilsonLower: true,
        },
        orderBy: { createdAt: 'desc' },
        take: ROW_HARD_CAP,
      });

      // ---- Score ------------------------------------------------------------
      const samples: CalibrationSample[] = rows.map((r) => ({
        predictedRetrievability: r.predictedRetrievability,
        actualOutcome: r.actualOutcome,
      }));

      const report = computeCalibrationReport(samples, binCount);

      // ---- Segment breakdown (cheap, same in-memory scan) ------------------
      // Useful for spotting calibration drift specific to Ghost Grader overrides,
      // hypercorrection-eligible reviews, or partial-telemetry sessions.
      const segmentBreakdown = {
        byTelemetryQuality: summarize(rows, (r) => r.telemetryQuality ?? 'unknown'),
        byGhostGraderRule: summarize(rows, (r) => r.ghostGraderRule ?? 'none'),
        bySessionType: summarize(rows, (r) => r.sessionType ?? 'unknown'),
        hypercorrectionEligible: {
          count: rows.filter((r) => r.hypercorrectionEligible).length,
          recallRate: rateOfRecall(rows.filter((r) => r.hypercorrectionEligible)),
        },
        mastered: {
          count: rows.filter((r) => r.isMastered).length,
          recallRate: rateOfRecall(rows.filter((r) => r.isMastered)),
        },
      };

      logger.info('Calibration report computed', {
        userId: adminUserId,
        n: report.n,
        brier: report.brier,
        ece: report.ece,
        days,
        truncated: totalAvailable > ROW_HARD_CAP,
      });

      return {
        data: {
          success: true,
          report,
          window: {
            days,
            start: windowStart.toISOString(),
            end: new Date().toISOString(),
          },
          filters: {
            userId: userIdFilter ?? null,
            sessionType: sessionTypeFilter ?? null,
            excludeRapidGuess,
            binCount,
          },
          meta: {
            totalAvailable,
            rowsScored: rows.length,
            truncated: totalAvailable > ROW_HARD_CAP,
            rowCap: ROW_HARD_CAP,
          },
          segmentBreakdown,
        },
      };
    } catch (error) {
      logger.error('Error computing calibration report', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
      });
      throw new Error('Failed to compute calibration report');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// ----------------------------------------------------------------------------
// Local helpers — kept here rather than in shadowValidator because they depend
// on the DB row shape, not the pure scoring math.
// ----------------------------------------------------------------------------

function summarize(
  rows: CalibrationLogRow[],
  key: (r: CalibrationLogRow) => string
): Record<string, { count: number; recallRate: number; meanPredicted: number }> {
  const buckets = new Map<string, { count: number; correct: number; predSum: number }>();
  for (const r of rows) {
    const k = key(r);
    const b = buckets.get(k) ?? { count: 0, correct: 0, predSum: 0 };
    b.count += 1;
    if (r.actualOutcome) b.correct += 1;
    b.predSum += r.predictedRetrievability;
    buckets.set(k, b);
  }
  const out: Record<string, { count: number; recallRate: number; meanPredicted: number }> = {};
  for (const [k, b] of buckets) {
    out[k] = {
      count: b.count,
      recallRate: b.count > 0 ? b.correct / b.count : 0,
      meanPredicted: b.count > 0 ? b.predSum / b.count : 0,
    };
  }
  return out;
}

function rateOfRecall(rows: CalibrationLogRow[]): number {
  if (rows.length === 0) return 0;
  let c = 0;
  for (const r of rows) if (r.actualOutcome) c++;
  return c / rows.length;
}
