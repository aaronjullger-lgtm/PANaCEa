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

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  const authHeader = context.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token || token !== context.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  const startTime = Date.now();

  try {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - DEFAULT_CONTENT_QUALITY_CONFIG.lookbackDays);

    // Build deps for the content quality loop
    const deps: ContentQualityLoopDeps = {
      async fetchQuestionsWithAttempts(config) {
        return prisma.question.findMany({
          where: {
            lifecycleStatus: 'ACTIVE',
            attempts: {
              some: {
                createdAt: { gte: lookbackDate },
              },
            },
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
            attempts: {
              where: {
                createdAt: { gte: lookbackDate },
              },
              select: {
                userId: true,
                wasCorrect: true,
                selectedAnswer: true,
                timeSpentMs: true,
              },
              take: 500,
            },
          },
          take: config.batchSize,
        }) as Promise<QuestionWithAttempts[]>;
      },

      async createFlag(data) {
        const flag = await prisma.contentQualityFlag.create({
          data: {
            questionId: data.questionId,
            flagType: data.flagType,
            metrics: data.metrics as Record<string, unknown>,
            status: data.status,
            regeneratedContent: data.regeneratedContent ?? null,
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
            regeneratedContent: data.regeneratedContent ?? undefined,
            critiqueFeedback: data.critiqueFeedback ?? undefined,
            resolvedAt: data.status === 'RESOLVED' ? new Date() : undefined,
          },
        });
        return mapToFlagRecord(flag);
      },

      async callGemini(prompt) {
        const { routeTask } = await import('../../../lib/langchain/router');
        const { fromCloudflareEnv } = await import('../../../lib/langchain/envAdapter');
        const aiEnv = fromCloudflareEnv(context.env as Record<string, string>);

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
        status: 'flagged',
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
        const question = await prisma.question.findUnique({
          where: { id: staleFlag.questionId },
          select: {
            id: true,
            question: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            difficulty: true,
            source: true,
            system: true,
            attempts: {
              where: { createdAt: { gte: lookbackDate } },
              select: {
                userId: true,
                wasCorrect: true,
                selectedAnswer: true,
                timeSpentMs: true,
              },
              take: 500,
            },
          },
        });

        if (!question || question.attempts.length < DEFAULT_CONTENT_QUALITY_CONFIG.minAttempts) continue;

        // Build a minimal analysis from existing metrics for regeneration
        const existingFlag = await prisma.contentQualityFlag.findUnique({
          where: { id: staleFlag.id },
          select: { metrics: true },
        });
        const metrics = (existingFlag?.metrics ?? {}) as Record<string, unknown>;

        // Mark as regenerating
        await prisma.contentQualityFlag.update({
          where: { id: staleFlag.id },
          data: { status: 'regenerating' },
        });

        // Attempt regeneration
        const { attemptRegeneration, toGeneratedQuestion } = await import(
          '../../../lib/services/contentQualityLoop'
        );
        const questionWithAttempts = question as unknown as import('../../../lib/services/contentQualityLoop').QuestionWithAttempts;
        const analysis = metrics as import('../../../lib/services/itemAnalysisService').ItemAnalysis;

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
              status: 'reviewed',
              regeneratedContent: regenerated,
              critiqueFeedback: regenResult.critiqueResult?.feedbackForRewrite ?? null,
            },
          });
          requeueSucceeded++;
          result.regenerated++;
        } else {
          // Put back to flagged with a note
          await prisma.contentQualityFlag.update({
            where: { id: staleFlag.id },
            data: { status: 'flagged' },
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
          data: { status: 'flagged' },
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
  metrics: unknown;
  status: string;
  regeneratedContent: unknown;
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
