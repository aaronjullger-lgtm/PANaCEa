/**
 * API: GET /api/analytics/metacognitive
 *
 * Returns behavioral pattern data for the Metacognitive Mirror Dashboard:
 *
 * 1. Response Time Trend — Rolling average RT over recent sessions
 * 2. Answer-Switch Analysis — Beneficial vs harmful switches
 * 3. Circadian Performance — Accuracy by hour-of-day
 * 4. First-Instinct Accuracy — Accuracy when sticking vs switching
 * 5. Confidence Calibration Curve — Binned confidence vs actual accuracy
 * 6. Speed-Accuracy Tradeoff — RT quartiles mapped to accuracy
 *
 * All metrics derived from existing QuestionAttempt + ReviewLog tables.
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { normalizeTz, formatLocalDay } from '../../../lib/time/userTz';
import { z } from 'zod';

const DEFAULT_DAYS = 30;
const MAX_ATTEMPTS = 3000;

// ── Types ─────────────────────────────────────────────────────────────────

interface ResponseTimeBucket {
  /** Session date (YYYY-MM-DD) */
  date: string;
  /** Average response time in ms */
  avgMs: number;
  /** Number of questions that day */
  count: number;
}

interface AnswerSwitchInsight {
  /** Total questions where student changed answer */
  totalSwitches: number;
  /** Switches that turned a wrong first pick into correct */
  beneficialSwitches: number;
  /** Switches that turned a correct first pick into wrong */
  harmfulSwitches: number;
  /** Net benefit ratio: (beneficial - harmful) / total */
  netBenefitRatio: number;
  /** Student's overall switch rate (switched / total questions) */
  switchRate: number;
  /** Total questions analyzed */
  totalQuestions: number;
}

interface CircadianBucket {
  /** Hour of day (0-23) */
  hour: number;
  /** Accuracy in this hour */
  accuracy: number;
  /** Average response time in ms */
  avgMs: number;
  /** Number of questions in this hour */
  count: number;
}

interface SpeedAccuracyBucket {
  /** RT quartile label */
  label: string;
  /** Lower bound (ms) */
  lowerMs: number;
  /** Upper bound (ms) */
  upperMs: number;
  /** Accuracy in this RT range */
  accuracy: number;
  /** Count of questions */
  count: number;
}

interface ConfidenceBucket {
  /** Confidence range label (e.g., "0.0-0.2") */
  range: string;
  /** Average predicted confidence */
  avgConfidence: number;
  /** Actual accuracy in this range */
  actualAccuracy: number;
  /** Number of questions */
  count: number;
}

interface MetacognitiveResponse {
  responseTimeTrend: ResponseTimeBucket[];
  answerSwitchInsight: AnswerSwitchInsight;
  circadianPerformance: CircadianBucket[];
  firstInstinct: {
    stickAccuracy: number;
    switchAccuracy: number;
    stickCount: number;
    switchCount: number;
  };
  speedAccuracy: SpeedAccuracyBucket[];
  confidenceCurve: ConfidenceBucket[];
  meta: {
    totalAttempts: number;
    periodDays: number;
    computedAt: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getConfidence(row: {
  implicitConfidence: number | null;
  telemetryJson: unknown;
}): number | null {
  if (row.implicitConfidence != null && !Number.isNaN(row.implicitConfidence)) {
    return row.implicitConfidence;
  }
  const json = row.telemetryJson as { server_computed?: { implicit_confidence?: number } } | null;
  const val = json?.server_computed?.implicit_confidence;
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

/**
 * Extract the local hour (0-23) of a Date in an IANA timezone.
 * Cloudflare Workers run in UTC; `.getHours()` would always return UTC hours,
 * making circadian data useless for non-UTC students.
 */
function getLocalHour(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const raw = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  // h23 range is 0-23 but some engines return 24 for midnight; normalise.
  return raw % 24;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

// ── Handler ────────────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  z.object({
    days: z.coerce.number().min(1).max(365).optional().default(DEFAULT_DAYS),
  }).optional().default({ days: DEFAULT_DAYS }),

  async (context) => {
    if (!context.env.DATABASE_URL) {
      return { status: 503, data: { error: 'Database not configured' } };
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const days = context.validated?.days ?? DEFAULT_DAYS;

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { status: 404, data: { error: 'User not found' } };
      }

      // Resolve user's local timezone for circadian bucketing.
      // Priority: ?tz= query param → UserPreferences.consolidationTimezone → UTC.
      // Workers run in UTC; using getHours() would misreport study hours for
      // students in non-UTC zones.
      const urlTz = new URL(context.request.url).searchParams.get('tz');
      let tz = normalizeTz(urlTz);
      if (tz === 'UTC') {
        const prefs = await prisma.userPreferences.findUnique({
          where: { userId: user.id },
          select: { consolidationTimezone: true },
        });
        tz = normalizeTz(prefs?.consolidationTimezone);
      }

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Fetch recent attempts with all behavioral fields
      const attempts = await prisma.questionAttempt.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: since },
        },
        select: {
          wasCorrect: true,
          timeSpentMs: true,
          answerChangedCount: true,
          implicitConfidence: true,
          telemetryJson: true,
          createdAt: true,
          selectedAnswer: true,
        },
        orderBy: { createdAt: 'asc' },
        take: MAX_ATTEMPTS,
      });

      if (attempts.length === 0) {
        return {
          data: {
            responseTimeTrend: [],
            answerSwitchInsight: {
              totalSwitches: 0, beneficialSwitches: 0, harmfulSwitches: 0,
              netBenefitRatio: 0, switchRate: 0, totalQuestions: 0,
            },
            circadianPerformance: [],
            firstInstinct: { stickAccuracy: 0, switchAccuracy: 0, stickCount: 0, switchCount: 0 },
            speedAccuracy: [],
            confidenceCurve: [],
            meta: { totalAttempts: 0, periodDays: days, computedAt: new Date().toISOString() },
          },
        };
      }

      // ── 1. Response Time Trend (daily rolling average) ──

      const byDate = new Map<string, { totalMs: number; count: number }>();
      for (const a of attempts) {
        if (!a.timeSpentMs || a.timeSpentMs <= 0) continue;
        const date = formatLocalDay(a.createdAt, tz);
        const bucket = byDate.get(date) ?? { totalMs: 0, count: 0 };
        bucket.totalMs += a.timeSpentMs;
        bucket.count += 1;
        byDate.set(date, bucket);
      }
      const responseTimeTrend: ResponseTimeBucket[] = Array.from(byDate.entries())
        .map(([date, b]) => ({ date, avgMs: Math.round(b.totalMs / b.count), count: b.count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // ── 2. Answer-Switch Analysis ──

      let totalSwitches = 0;
      let beneficialSwitches = 0;
      let harmfulSwitches = 0;
      let stickCorrect = 0;
      let stickTotal = 0;
      let switchCorrect = 0;
      let switchTotal = 0;

      for (const a of attempts) {
        const switched = (a.answerChangedCount ?? 0) > 0;
        if (switched) {
          totalSwitches++;
          switchTotal++;
          if (a.wasCorrect) {
            beneficialSwitches++;
            switchCorrect++;
          } else {
            harmfulSwitches++;
          }
        } else {
          stickTotal++;
          if (a.wasCorrect) stickCorrect++;
        }
      }

      const answerSwitchInsight: AnswerSwitchInsight = {
        totalSwitches,
        beneficialSwitches,
        harmfulSwitches,
        netBenefitRatio: totalSwitches > 0
          ? (beneficialSwitches - harmfulSwitches) / totalSwitches
          : 0,
        switchRate: attempts.length > 0 ? totalSwitches / attempts.length : 0,
        totalQuestions: attempts.length,
      };

      // ── 3. Circadian Performance (by hour) ──

      const byHour = new Map<number, { correct: number; total: number; totalMs: number }>();
      for (const a of attempts) {
        const hour = getLocalHour(a.createdAt, tz);
        const bucket = byHour.get(hour) ?? { correct: 0, total: 0, totalMs: 0 };
        bucket.total++;
        if (a.wasCorrect) bucket.correct++;
        if (a.timeSpentMs && a.timeSpentMs > 0) bucket.totalMs += a.timeSpentMs;
        byHour.set(hour, bucket);
      }
      const circadianPerformance: CircadianBucket[] = Array.from(byHour.entries())
        .map(([hour, b]) => ({
          hour,
          accuracy: b.total > 0 ? b.correct / b.total : 0,
          avgMs: b.total > 0 ? Math.round(b.totalMs / b.total) : 0,
          count: b.total,
        }))
        .sort((a, b) => a.hour - b.hour);

      // ── 4. First Instinct ──

      const firstInstinct = {
        stickAccuracy: stickTotal > 0 ? stickCorrect / stickTotal : 0,
        switchAccuracy: switchTotal > 0 ? switchCorrect / switchTotal : 0,
        stickCount: stickTotal,
        switchCount: switchTotal,
      };

      // ── 5. Speed-Accuracy Tradeoff (RT quartiles) ──

      const validRTs = attempts
        .filter(a => a.timeSpentMs && a.timeSpentMs > 0 && a.timeSpentMs < 600_000)
        .map(a => ({ rt: a.timeSpentMs!, correct: a.wasCorrect }))
        .sort((a, b) => a.rt - b.rt);

      const speedAccuracy: SpeedAccuracyBucket[] = [];
      if (validRTs.length >= 20) {
        const rtValues = validRTs.map(v => v.rt);
        const q25 = quantile(rtValues, 0.25);
        const q50 = quantile(rtValues, 0.50);
        const q75 = quantile(rtValues, 0.75);

        const quartiles = [
          { label: 'Fast (Q1)', lower: 0, upper: q25 },
          { label: 'Medium-Fast (Q2)', lower: q25, upper: q50 },
          { label: 'Medium-Slow (Q3)', lower: q50, upper: q75 },
          { label: 'Slow (Q4)', lower: q75, upper: Infinity },
        ];

        for (const q of quartiles) {
          const inRange = validRTs.filter(v =>
            v.rt >= q.lower && (q.upper === Infinity ? true : v.rt < q.upper)
          );
          speedAccuracy.push({
            label: q.label,
            lowerMs: Math.round(q.lower),
            upperMs: q.upper === Infinity ? Math.round(rtValues[rtValues.length - 1]!) : Math.round(q.upper),
            accuracy: inRange.length > 0
              ? inRange.filter(v => v.correct).length / inRange.length
              : 0,
            count: inRange.length,
          });
        }
      }

      // ── 6. Confidence Calibration Curve ──

      const CONF_BINS = 5;
      const confBuckets = Array.from({ length: CONF_BINS }, (_, i) => ({
        lower: i / CONF_BINS,
        upper: (i + 1) / CONF_BINS,
        totalConf: 0,
        correct: 0,
        total: 0,
      }));

      for (const a of attempts) {
        const conf = getConfidence(a);
        if (conf === null) continue;
        const binIdx = Math.min(Math.floor(conf * CONF_BINS), CONF_BINS - 1);
        const bin = confBuckets[binIdx]!;
        bin.total++;
        bin.totalConf += conf;
        if (a.wasCorrect) bin.correct++;
      }

      const confidenceCurve: ConfidenceBucket[] = confBuckets
        .filter(b => b.total > 0)
        .map(b => ({
          range: `${(b.lower * 100).toFixed(0)}-${(b.upper * 100).toFixed(0)}%`,
          avgConfidence: b.totalConf / b.total,
          actualAccuracy: b.correct / b.total,
          count: b.total,
        }));

      // ── Response ──

      const result: MetacognitiveResponse = {
        responseTimeTrend,
        answerSwitchInsight,
        circadianPerformance,
        firstInstinct,
        speedAccuracy,
        confidenceCurve,
        meta: {
          totalAttempts: attempts.length,
          periodDays: days,
          computedAt: new Date().toISOString(),
        },
      };

      return { data: result };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
