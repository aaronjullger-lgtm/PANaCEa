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
            status: { in: ['flagged', 'regenerating', 'reviewed'] },
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
            resolvedAt: data.status === 'resolved' ? new Date() : undefined,
          },
        });
        return mapToFlagRecord(flag);
      },

      async callGemini(prompt) {
        const apiKey = context.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

        const model = 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Gemini API error ${response.status}: ${body}`);
        }

        const json = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response from Gemini');
        return text;
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

    return Response.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
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
