/**
 * POST /api/cron/content-quality-loop
 *
 * Content quality feedback loop — identifies poorly performing questions
 * via psychometric analysis, flags them for review, and attempts AI-driven
 * regeneration using the self-refine pipeline.
 *
 * Pipeline:
 *   1. Fetch questions with ≥30 attempts in the last 30 days
 *   2. Run item analysis (discrimination, point-biserial, distractors)
 *   3. Flag items failing quality thresholds
 *   4. Build self-refine critique/rewrite prompts via Gemini
 *   5. Store flags in ContentQualityFlag table (status: reviewed if regenerated)
 *
 * Authentication: Bearer token (CRON_SECRET), not user auth.
 *
 * @see lib/services/contentQualityLoop.ts — Core orchestration
 * @see lib/services/itemAnalysisService.ts — Psychometric computation
 * @see lib/services/selfRefineService.ts — Prompt construction
 */

import { withCors } from '../_shared/middleware';
import { Prisma } from '@prisma/client/edge';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type { CloudflareEnv } from '../_shared/types';
import {
  runContentQualityLoop,
  DEFAULT_CONTENT_QUALITY_CONFIG,
  type ContentQualityLoopDeps,
  type QuestionWithAttempts,
  type FlagStatus,
  type ContentQualityFlagRecord,
} from '../../../lib/services/contentQualityLoop';
import type { ItemAnalysis } from '../../../lib/services/itemAnalysisService';

export const onRequestOptions = withCors();

type CronEnv = CloudflareEnv & {
  CRON_SECRET?: string;
};

type CronPagesFunction<E> = (context: {
  request: Request;
  env: E;
}) => Response | Promise<Response>;

type ContentQualityLoopPrisma = ReturnType<typeof createEdgePrismaClient> & {
  contentQualityFlag: {
    create(args: unknown): Promise<PrismaContentQualityFlag>;
    findFirst(args: unknown): Promise<PrismaContentQualityFlag | null>;
    findMany(args: unknown): Promise<PrismaContentQualityFlag[]>;
    findUnique(args: unknown): Promise<PrismaContentQualityFlag | null>;
    update(args: unknown): Promise<PrismaContentQualityFlag>;
  };
};

interface PrismaContentQualityFlag {
  id: string;
  questionId: string;
  flagType: string;
  metrics: Prisma.JsonValue;
  status: string;
  regeneratedContent: Prisma.JsonValue | null;
  critiqueFeedback: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

interface QuestionAttemptRecord {
  questionId: string;
  conditionId: string | null;
  userId: string;
  wasCorrect: boolean;
  selectedAnswer: string | null;
  timeSpentMs: number | null;
  createdAt: Date;
}

interface QuestionRecord {
  id: string;
  question: string;
  options: unknown;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  source: string;
  system: string;
}

function groupAttemptsByQuestionId(attempts: QuestionAttemptRecord[]): Map<string, QuestionAttemptRecord[]> {
  const grouped = new Map<string, QuestionAttemptRecord[]>();
  for (const attempt of attempts) {
    const bucket = grouped.get(attempt.questionId) ?? [];
    bucket.push(attempt);
    grouped.set(attempt.questionId, bucket);
  }
  return grouped;
}

async function loadQuestionsWithAttempts(
  prisma: ContentQualityLoopPrisma,
  lookbackDate: Date,
  minAttempts: number,
  batchSize: number
): Promise<QuestionWithAttempts[]> {
  const attemptCounts = await prisma.questionAttempt.groupBy({
    by: ['questionId'],
    where: {
      createdAt: { gte: lookbackDate },
    },
    _count: {
      questionId: true,
    },
  });

  const questionIds = attemptCounts
    .filter((row) => row._count.questionId >= minAttempts)
    .sort((a, b) => b._count.questionId - a._count.questionId)
    .slice(0, batchSize)
    .map((row) => row.questionId);

  if (questionIds.length === 0) {
    return [];
  }

  const [questions, attempts] = await Promise.all([
    prisma.question.findMany({
      where: {
        id: { in: questionIds },
        lifecycleStatus: 'ACTIVE',
      },
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        difficulty: true,
        source: true,
        system: true,
      },
    }) as Promise<QuestionRecord[]>,
    prisma.questionAttempt.findMany({
      where: {
        questionId: { in: questionIds },
        createdAt: { gte: lookbackDate },
      },
      select: {
        questionId: true,
        conditionId: true,
        userId: true,
        wasCorrect: true,
        selectedAnswer: true,
        timeSpentMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<QuestionAttemptRecord[]>,
  ]);

  const attemptsByQuestionId = groupAttemptsByQuestionId(attempts);

  return questions.map((question) => ({
    ...question,
    attempts: (attemptsByQuestionId.get(question.id) ?? []).slice(0, 500).map((attempt) => ({
      userId: attempt.userId,
      wasCorrect: attempt.wasCorrect,
      selectedAnswer: attempt.selectedAnswer,
      timeSpentMs: attempt.timeSpentMs,
    })),
  }));
}

async function loadQuestionWithAttempts(
  prisma: ContentQualityLoopPrisma,
  questionId: string,
  lookbackDate: Date
): Promise<QuestionWithAttempts | null> {
  const [question, attempts] = await Promise.all([
    prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        difficulty: true,
        source: true,
        system: true,
      },
    }) as Promise<QuestionRecord | null>,
    prisma.questionAttempt.findMany({
      where: {
        questionId,
        createdAt: { gte: lookbackDate },
      },
      select: {
        questionId: true,
        conditionId: true,
        userId: true,
        wasCorrect: true,
        selectedAnswer: true,
        timeSpentMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<QuestionAttemptRecord[]>,
  ]);

  if (!question) return null;

  return {
    ...question,
    attempts: attempts.slice(0, 500).map((attempt) => ({
      userId: attempt.userId,
      wasCorrect: attempt.wasCorrect,
      selectedAnswer: attempt.selectedAnswer,
      timeSpentMs: attempt.timeSpentMs,
    })),
  };
}

export const onRequestPost: CronPagesFunction<CronEnv> = async (context) => {
  const authHeader = context.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const cronEnv = context.env as CronEnv;
  if (!token || token !== cronEnv.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL) as ContentQualityLoopPrisma;
  const startTime = Date.now();

  try {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - DEFAULT_CONTENT_QUALITY_CONFIG.lookbackDays);

    // Build deps for the content quality loop
    const deps: ContentQualityLoopDeps = {
      async fetchQuestionsWithAttempts(config) {
        return loadQuestionsWithAttempts(prisma, lookbackDate, config.minAttempts, config.batchSize);
      },

      async createFlag(data) {
        const flag = await prisma.contentQualityFlag.create({
          data: {
            questionId: data.questionId,
            flagType: data.flagType,
            metrics: data.metrics as unknown as Prisma.InputJsonValue,
            status: data.status,
            regeneratedContent: data.regeneratedContent
              ? (data.regeneratedContent as unknown as Prisma.InputJsonValue)
              : null,
            critiqueFeedback: data.critiqueFeedback ?? null,
          },
        });
        return mapToFlagRecord(flag);
      },

      async findActiveFlag(questionId, flagType) {
        const flag = await prisma.contentQualityFlag.findFirst({
          where: {
            questionId,
            flagType,
            status: { in: ['FLAGGED', 'REGENERATING', 'REVIEWED'] },
          },
        });
        return flag ? mapToFlagRecord(flag) : null;
      },

      async updateFlag(id, data) {
        const flag = await prisma.contentQualityFlag.update({
          where: { id },
          data: {
            status: data.status,
            regeneratedContent: data.regeneratedContent
              ? (data.regeneratedContent as unknown as Prisma.InputJsonValue)
              : undefined,
            critiqueFeedback: data.critiqueFeedback ?? undefined,
            resolvedAt: data.status === 'RESOLVED' ? new Date() : undefined,
          },
        });
        return mapToFlagRecord(flag);
      },

      async callGemini(prompt) {
        const { routeTask } = await import('../../../lib/langchain/router');
        const { fromCloudflareEnv } = await import('../../../lib/langchain/envAdapter');
        const aiEnv = fromCloudflareEnv(context.env as unknown as Record<string, string>);

        const result = await routeTask('content-generation', aiEnv, {
          systemPrompt: 'You are a medical education expert specializing in question quality improvement.',
          userPrompt: prompt,
        }, {
          temperature: 0.3,
          runName: 'panacea:content-quality-loop',
        });

        return result.output;
      },

      log: {
        info: (msg, ctx) => console.log(`[contentQualityLoop] ${msg}`, ctx ?? ''),
        warn: (msg, ctx) => console.warn(`[contentQualityLoop] ${msg}`, ctx ?? ''),
        error: (msg, err, ctx) => console.error(`[contentQualityLoop] ${msg}`, err, ctx ?? ''),
      },
    };

    const result = await runContentQualityLoop(deps, {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: true,
    });

    // Post-loop: attempt regeneration for previously flagged items without regenerated content
    let requeueAttempted = 0;
    let requeueSucceeded = 0;
    let requeueFailed = 0;

    const staleFlags = await prisma.contentQualityFlag.findMany({
      where: {
        status: 'FLAGGED',
        regeneratedContent: null,
      },
      select: {
        id: true,
        questionId: true,
        flagType: true,
      },
      take: 20,
    });

    for (const staleFlag of staleFlags) {
      if (!deps.callGemini || requeueAttempted >= 10) break;
      requeueAttempted++;

      try {
        // Fetch the question with attempts for this flag
        const question = await loadQuestionWithAttempts(prisma, staleFlag.questionId, lookbackDate);

        if (!question || question.attempts.length < DEFAULT_CONTENT_QUALITY_CONFIG.minAttempts) continue;

        // Build a minimal analysis from existing metrics for regeneration
        const existingFlag = await prisma.contentQualityFlag.findUnique({
          where: { id: staleFlag.id },
          select: { metrics: true },
        });
        const metrics = (existingFlag?.metrics ?? {}) as unknown as Record<string, unknown>;

        // Mark as regenerating
        await prisma.contentQualityFlag.update({
          where: { id: staleFlag.id },
          data: { status: 'REGENERATING' },
        });

        // Attempt regeneration
        const { attemptRegeneration, toGeneratedQuestion } = await import(
          '../../../lib/services/contentQualityLoop'
        );
        const questionWithAttempts = question as unknown as import('../../../lib/services/contentQualityLoop').QuestionWithAttempts;
        const analysis = metrics as unknown as ItemAnalysis;

        const regenResult = await attemptRegeneration(
          questionWithAttempts,
          analysis,
          deps.callGemini,
          deps.log
        );

        if (regenResult.regeneratedContent) {
          const regenerated = regenResult.regeneratedContent as unknown as Record<string, unknown>;
          await prisma.contentQualityFlag.update({
            where: { id: staleFlag.id },
            data: {
              status: 'REVIEWED',
              regeneratedContent: regenerated as unknown as Prisma.InputJsonValue,
              critiqueFeedback: regenResult.critiqueResult?.feedbackForRewrite ?? null,
            },
          });
          requeueSucceeded++;
          result.regenerated++;
        } else {
          // Put back to flagged with a note
          await prisma.contentQualityFlag.update({
            where: { id: staleFlag.id },
            data: { status: 'FLAGGED' },
          });
          requeueFailed++;
        }
      } catch (err) {
        requeueFailed++;
        console.warn('[contentQualityLoop] Requeue regeneration failed', {
          flagId: staleFlag.id,
          questionId: staleFlag.questionId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Reset status on failure
        await prisma.contentQualityFlag.update({
          where: { id: staleFlag.id },
          data: { status: 'FLAGGED' },
        }).catch(() => {});
      }
    }

    const summary = {
      ...result,
      requeueAttempted,
      requeueSucceeded,
      requeueFailed,
      timestamp: new Date().toISOString(),
    };

    console.log('[contentQualityLoop] Summary', summary);

    return Response.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('[contentQualityLoop] Cron failed:', error);
    return Response.json(
      {
        error: 'Content quality loop failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────

interface PrismaContentQualityFlag {
  id: string;
  questionId: string;
  flagType: string;
  metrics: Prisma.JsonValue;
  status: string;
  regeneratedContent: Prisma.JsonValue | null;
  critiqueFeedback: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

function mapToFlagRecord(flag: PrismaContentQualityFlag): ContentQualityFlagRecord {
  return {
    id: flag.id,
    questionId: flag.questionId,
    flagType: flag.flagType,
    metrics: flag.metrics as Record<string, unknown>,
    status: flag.status as FlagStatus,
    regeneratedContent: flag.regeneratedContent as Record<string, unknown> | null,
    critiqueFeedback: flag.critiqueFeedback,
    createdAt: flag.createdAt,
    updatedAt: flag.updatedAt,
    resolvedAt: flag.resolvedAt,
    resolvedBy: flag.resolvedBy,
  };
}
