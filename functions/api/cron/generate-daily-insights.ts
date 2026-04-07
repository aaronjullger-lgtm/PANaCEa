/**
 * Cron: Daily Dashboard Insight Generation
 *
 * Phase 2.4 — Optimization Strategy Rank #6
 *
 * Runs daily (early morning). For each active user, computes study metrics
 * via SQL aggregation and generates a natural-language insight summary
 * using gemini-2.0-flash (cheapest model). The summary is cached so the
 * dashboard loads instantly without any per-request AI calls.
 *
 * Cost: ~$0.001 per user per day (one small model call).
 * At 100 users: ~$0.10/day = ~$3/month.
 *
 * Flow:
 *   1. Identify active users (studied in last 7 days)
 *   2. For each user, compute metrics (accuracy by system, trends, FSRS stats)
 *   3. Generate natural-language summary via gemini-2.0-flash
 *   4. Cache in UserDailyInsight table (or DailyStudyPlan metadata)
 *   5. Dashboard reads from cache (zero AI cost at serve time)
 *
 * Auth: Requires CRON_SECRET bearer token.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { withCors } from '../_shared/middleware';
import { trackTokenUsage } from '../_shared/tokenTracking';

export const onRequestOptions = withCors();

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const INSIGHT_MODEL = 'gemini-2.0-flash';

/** Maximum users to process per run (cost control) */
const MAX_USERS_PER_RUN = 200;

/** Only regenerate insights if underlying data changed meaningfully */
const MIN_NEW_ATTEMPTS_FOR_REGEN = 5;

// ── Types ──────────────────────────────────────────────────────────────────

interface UserMetrics {
  userId: string;
  totalAttempts7d: number;
  accuracy7d: number;
  totalAttempts30d: number;
  accuracy30d: number;
  strongestSystem: string | null;
  weakestSystem: string | null;
  currentStreak: number;
  fsrsBacklog: number;
  avgSessionLength: number;
  studyDaysLast7: number;
  accuracyTrend: 'improving' | 'declining' | 'stable';
}

interface InsightResult {
  userId: string;
  insights: string;
  metricsSnapshot: UserMetrics;
  generatedAt: Date;
}

// ── Metrics Computation ────────────────────────────────────────────────────

async function computeUserMetrics(prisma: any, userId: string): Promise<UserMetrics> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000);

  // 7-day and 30-day attempt stats
  const [stats7d, stats30d] = await Promise.all([
    prisma.questionAttempt.aggregate({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
      _avg: { isCorrect: true },
    }),
    prisma.questionAttempt.aggregate({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      _avg: { isCorrect: true },
    }),
  ]);

  // System-level accuracy (7 days)
  const systemStats = await prisma.questionAttempt.groupBy({
    by: ['system'],
    where: { userId, createdAt: { gte: sevenDaysAgo }, system: { not: null } },
    _count: { id: true },
    _avg: { isCorrect: true },
  });

  const sortedSystems = systemStats
    .filter((s: any) => s._count.id >= 3) // Need minimum attempts
    .sort((a: any, b: any) => (b._avg?.isCorrect ?? 0) - (a._avg?.isCorrect ?? 0));

  const strongestSystem = sortedSystems[0]?.system ?? null;
  const weakestSystem = sortedSystems[sortedSystems.length - 1]?.system ?? null;

  // FSRS backlog (items due for review)
  const fsrsBacklog = await prisma.userProgress.count({
    where: {
      userId,
      nextReviewDate: { lte: now },
      fsrsState: { not: 'NEW' },
    },
  });

  // Study days in last 7
  const studyDays = await prisma.questionAttempt.findMany({
    where: { userId, createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
    distinct: ['createdAt'],
  });
  const uniqueDays = new Set(
    studyDays.map((d: { createdAt: Date }) => d.createdAt.toISOString().slice(0, 10))
  );

  // Streak (consecutive days with activity)
  let currentStreak = 0;
  const today = now.toISOString().slice(0, 10);
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 3600_000).toISOString().slice(0, 10);
    const hasActivity = await prisma.questionAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(d + 'T00:00:00Z'),
          lt: new Date(d + 'T23:59:59Z'),
        },
      },
    });
    if (hasActivity > 0) {
      currentStreak++;
    } else if (i > 0) {
      // Allow today to be empty (day isn't over yet)
      break;
    }
  }

  // Accuracy trend: compare last 7d vs prior 7d
  const priorWeekStart = new Date(sevenDaysAgo.getTime() - 7 * 24 * 3600_000);
  const priorStats = await prisma.questionAttempt.aggregate({
    where: { userId, createdAt: { gte: priorWeekStart, lt: sevenDaysAgo } },
    _avg: { isCorrect: true },
  });

  const current7dAccuracy = stats7d._avg?.isCorrect ?? 0;
  const prior7dAccuracy = priorStats._avg?.isCorrect ?? 0;
  const accuracyDelta = current7dAccuracy - prior7dAccuracy;

  let accuracyTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (accuracyDelta > 0.05) accuracyTrend = 'improving';
  else if (accuracyDelta < -0.05) accuracyTrend = 'declining';

  return {
    userId,
    totalAttempts7d: stats7d._count?.id ?? 0,
    accuracy7d: Math.round((current7dAccuracy) * 1000) / 10,
    totalAttempts30d: stats30d._count?.id ?? 0,
    accuracy30d: Math.round((stats30d._avg?.isCorrect ?? 0) * 1000) / 10,
    strongestSystem,
    weakestSystem,
    currentStreak,
    fsrsBacklog,
    avgSessionLength: 0, // TODO: compute from session analytics
    studyDaysLast7: uniqueDays.size,
    accuracyTrend,
  };
}

// ── Insight Generation ─────────────────────────────────────────────────────

async function generateInsight(
  apiKey: string,
  metrics: UserMetrics,
  context: { env: any; waitUntil?: (p: Promise<any>) => void }
): Promise<string> {
  const prompt = `You are a supportive PA study coach. Based on these study metrics, write 3-5 short, actionable insights for a PA student's daily dashboard. Be encouraging but honest. Use "you" voice. Keep each insight to 1-2 sentences. No bullet points — use numbered insights.

Metrics:
- Questions attempted (7 days): ${metrics.totalAttempts7d}
- Accuracy (7 days): ${metrics.accuracy7d}%
- Accuracy (30 days): ${metrics.accuracy30d}%
- Accuracy trend: ${metrics.accuracyTrend}
- Strongest system: ${metrics.strongestSystem || 'not enough data'}
- Weakest system: ${metrics.weakestSystem || 'not enough data'}
- Current study streak: ${metrics.currentStreak} days
- Study days (last 7): ${metrics.studyDaysLast7}/7
- FSRS reviews overdue: ${metrics.fsrsBacklog}
${metrics.fsrsBacklog > 50 ? '- WARNING: Review backlog is very high' : ''}

Write the insights now. Keep total under 200 words.`;

  const url = `${GEMINI_BASE}/v1beta/models/${INSIGHT_MODEL}:generateContent?key=${apiKey}`;
  const startTime = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 512,
      },
    }),
  });

  const latencyMs = Date.now() - startTime;
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };

  trackTokenUsage(context, {
    endpoint: '/api/cron/generate-daily-insights',
    model: INSIGHT_MODEL,
    usage: data.usageMetadata,
    statusCode: response.status,
    latencyMs,
  });

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Keep studying — your consistency will pay off!';
}

// ── Main Handler ───────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<any> = async (context) => {
  const { env, request } = context;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    // Find active users (studied in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const activeUsers = await prisma.questionAttempt.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { userId: true },
      distinct: ['userId'],
      take: MAX_USERS_PER_RUN,
    });

    const results: InsightResult[] = [];
    let errors = 0;

    for (const { userId } of activeUsers) {
      try {
        const metrics = await computeUserMetrics(prisma, userId);

        // Skip if user hasn't done enough new work since last insight
        // (check existing insight to avoid wasteful regeneration)
        if (metrics.totalAttempts7d < MIN_NEW_ATTEMPTS_FOR_REGEN) continue;

        const insights = await generateInsight(apiKey, metrics, context);

        // Persist the insight (upsert into DailyStudyPlan or a dedicated table)
        await prisma.dailyStudyPlan.upsert({
          where: {
            userId_date: {
              userId,
              date: new Date(new Date().toISOString().slice(0, 10)),
            },
          },
          create: {
            id: crypto.randomUUID(),
            userId,
            date: new Date(new Date().toISOString().slice(0, 10)),
            planData: {
              insights,
              metricsSnapshot: metrics,
              generatedAt: new Date().toISOString(),
              model: INSIGHT_MODEL,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            planData: {
              insights,
              metricsSnapshot: metrics,
              generatedAt: new Date().toISOString(),
              model: INSIGHT_MODEL,
            },
            updatedAt: new Date(),
          },
        });

        results.push({
          userId,
          insights,
          metricsSnapshot: metrics,
          generatedAt: new Date(),
        });
      } catch (error) {
        errors++;
        console.error(`[daily-insights] Error for user ${userId}:`, error instanceof Error ? error.message : error);
      }
    }

    const durationMs = Date.now() - startTime;

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          action: 'DAILY_INSIGHT_GENERATION',
          performedBy: 'system:cron',
          metadata: {
            activeUsers: activeUsers.length,
            insightsGenerated: results.length,
            errors,
            durationMs,
          },
          createdAt: new Date(),
        },
      });
    } catch {
      // Audit failure non-fatal
    }

    return new Response(JSON.stringify({
      status: 'ok',
      activeUsers: activeUsers.length,
      insightsGenerated: results.length,
      skipped: activeUsers.length - results.length - errors,
      errors,
      durationMs,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[daily-insights] Error:', error);
    return new Response(JSON.stringify({
      error: 'Insight generation failed',
      message: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
};
