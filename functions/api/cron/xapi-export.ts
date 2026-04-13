/**
 * Cron: xAPI Export
 *
 * Exports recent learning activity as xAPI 1.0.3 statements.
 * Converts QuestionAttempts and ReviewLogs from the last 24 hours.
 *
 * GET /api/cron/xapi-export?hours=24&format=json
 *
 * Auth: Requires CRON_SECRET bearer token.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { withCors } from '../_shared/middleware';
import { createXapiStatement, type PanaceaEvent, type XapiStatement } from '../../../lib/services/xapiEmitter';

export const onRequestOptions = withCors();

export const onRequestGet: PagesFunction<any> = async (context) => {
  const { env, request } = context;

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    // Parse query params
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours') ?? '24', 10);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    console.log(`[cron:xapi-export] Exporting activity since ${since.toISOString()} (${hours}h)`);

    // Fetch recent question attempts
    const attempts = await prisma.questionAttempt.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    // Fetch recent review logs (real reviews only)
    const reviews = await prisma.reviewLog.findMany({
      where: {
        createdAt: { gte: since },
        review_type: 'real',
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    // Convert to xAPI statements
    const statements: XapiStatement[] = [];

    // Question attempts → answered
    for (const a of attempts) {
      const event: PanaceaEvent = {
        type: 'question_answered',
        userId: a.userId,
        timestamp: a.createdAt.toISOString(),
        questionId: a.questionId,
        isCorrect: a.wasCorrect,
        questionFormat: a.questionType ?? undefined,
        durationMs: a.timeSpentMs ?? undefined,
        systemTag: a.system ?? undefined,
        confidence: a.implicitConfidence ?? undefined,
      };
      statements.push(createXapiStatement(event));
    }

    // Review logs → completed (drill/card reviews)
    for (const r of reviews) {
      const event: PanaceaEvent = {
        type: 'review_completed',
        userId: r.userId,
        timestamp: r.reviewedAt.toISOString(),
        cardId: r.id,
        sessionId: r.sessionId ?? undefined,
        isCorrect: r.wasCorrect,
        retention: r.retrievability ?? undefined,
        stability: r.stability,
        difficulty: r.difficulty,
        intervalDays: r.elapsedDays ?? undefined,
        durationMs: r.responseTimeMs ?? undefined,
        systemTag: r.system ?? undefined,
      };
      statements.push(createXapiStatement(event));
    }

    // Sort by timestamp
    statements.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const durationMs = Date.now() - startTime;
    console.log(`[cron:xapi-export] Exported ${statements.length} statements (${attempts.length} attempts, ${reviews.length} reviews) in ${durationMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        count: statements.length,
        sources: { attempts: attempts.length, reviews: reviews.length },
        since: since.toISOString(),
        hours,
        duration_ms: durationMs,
        statements,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Experience-API-Version': '1.0.3',
        },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[cron:xapi-export] Error:', errorMessage);

    return new Response(
      JSON.stringify({ error: 'xAPI export failed', message: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};
