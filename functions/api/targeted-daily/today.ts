/**
 * API: Get today's Targeted Daily Question (Didactic)
 * GET /api/targeted-daily/today?systems=CV,PULM,GI
 *
 * Server-authoritative:
 * - One per day per user (UTC date)
 * - Stores selected questionId on first fetch
 * - Never returns correct answers
 *
 * Returns:
 * - { status: 'completed', stats: { correctCount, totalQuestions, timeSpentMs } }
 * - { status: 'active', question: { id, vignette?, question, options, system, difficulty, tags? } }
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, CACHE_STRATEGY } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const AllowedSystemSchema = z.enum([
  'CV',
  'DERM',
  'ENDO',
  'HEENT',
  'GI',
  'GU',
  'HEME',
  'ID',
  'MSK',
  'NEURO',
  'PSYCH',
  'PULM',
  'RENAL',
  'REPRO',
]);

const TodaySchema = z.object({
  systems: z.string().min(1),
});

function getUtcDateStart(d: Date): Date {
  const t = new Date(d);
  t.setUTCHours(0, 0, 0, 0);
  return t;
}

function fnv1a32(input: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    const cp = input.codePointAt(i) ?? 0;
    hash ^= cp;
    // Skip surrogate pair second code unit when codePointAt consumes it
    if (cp > 0xffff) i++;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeOptions(data: any): string[] {
  const optionsData = data?.options || data?.answers || data?.choices;
  if (Array.isArray(optionsData)) return optionsData.filter(Boolean);
  if (optionsData && typeof optionsData === 'object') {
    const obj = optionsData as Record<string, string>;
    return Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => obj[k])
      .filter(Boolean);
  }
  return [];
}

async function fetchQuestionForId(prisma: any, questionId: string) {
  // Prefer PreGeneratedQuestion
  const pre = await prisma.preGeneratedQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      system: true,
      difficulty: true,
      questionData: true,
      // tags live in questionData
    },
    ...CACHE_STRATEGY.QUESTIONS,
  });
  if (pre) return { source: 'pre', record: pre };

  const main = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      vignette: true,
      question: true,
      options: true,
      system: true,
      difficulty: true,
      tags: true,
    },
    ...CACHE_STRATEGY.QUESTIONS,
  });
  if (main) return { source: 'main', record: main };

  return null;
}

export const onRequestGet = authenticatedEndpoint(
  TodaySchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/targeted-daily/today', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const systems = validated.systems
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const parsedSystems = systems
        .map((s) => AllowedSystemSchema.safeParse(s))
        .filter((r) => r.success)
        .map((r) => (r as any).data as z.infer<typeof AllowedSystemSchema>);

      const uniqSystems = Array.from(new Set(parsedSystems)).sort((a, b) => a.localeCompare(b));
      if (uniqSystems.length === 0) {
        return { status: 400, error: 'Invalid systems. Provide comma-separated system codes.' };
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (!user) return { status: 404, error: 'User not found. Please refresh and try again.' };

      const today = getUtcDateStart(new Date());

      const existing = await prisma.targetedDailyAttempt.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        select: {
          id: true,
          questionId: true,
          systems: true,
          completedAt: true,
          isCorrect: true,
          timeSpentMs: true,
        },
        ...CACHE_STRATEGY.USER_DATA,
      });

      if (existing?.completedAt) {
        return {
          data: {
            status: 'completed',
            stats: {
              correctCount: existing.isCorrect ? 1 : 0,
              totalQuestions: 1,
              timeSpentMs: existing.timeSpentMs ?? 0,
            },
          },
        };
      }

      // If there is an existing (uncompleted) row, reuse its questionId regardless of current systems param
      if (existing?.questionId) {
        const found = await fetchQuestionForId(prisma, existing.questionId);
        if (!found) {
          // Stale row (question deleted) — restart
          await prisma.targetedDailyAttempt.delete({
            where: { userId_date: { userId: user.id, date: today } },
          });
        } else if (found.source === 'pre') {
          const qd = found.record.questionData as any;
          const options = normalizeOptions(qd);
          return {
            data: {
              status: 'active',
              question: {
                id: found.record.id,
                vignette: qd?.vignette ?? undefined,
                question: qd?.question ?? '',
                options,
                system: found.record.system ?? 'General',
                difficulty: found.record.difficulty ?? 'PANCE-level',
                tags: qd?.tags ?? undefined,
              },
            },
          };
        } else {
          return {
            data: {
              status: 'active',
              question: found.record,
            },
          };
        }
      }

      // Pick a question deterministically from the pre-generated pool (avoid ORDER BY random())
      const pool = await prisma.preGeneratedQuestion.findMany({
        where: {
          system: { in: uniqSystems },
          difficulty: { in: ['PANCE-level', 'intermediate', 'advanced', 'medium', 'hard'] },
        },
        select: {
          id: true,
          system: true,
          difficulty: true,
          questionData: true,
        },
        take: 200,
        orderBy: { generatedAt: 'asc' },
        ...CACHE_STRATEGY.QUESTIONS,
      });

      if (!pool.length) {
        return { status: 500, error: 'No questions available for selected systems.' };
      }

      const seed = `${auth.userId}:${today.getTime()}:${uniqSystems.join(',')}`;
      const idx = fnv1a32(seed) % pool.length;
      const chosen = pool[idx] ?? null;
      if (!chosen) return { status: 500, error: 'Unable to select question.' };
      const qd = chosen.questionData as any;
      const options = normalizeOptions(qd);
      if (!options.length || !qd?.question) {
        return { status: 500, error: 'Selected question is missing required fields.' };
      }

      await prisma.targetedDailyAttempt.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          date: today,
          systems: uniqSystems,
          questionId: chosen.id,
        },
      });

      log.info('Created targeted daily question', {
        userId: user.id,
        systems: uniqSystems,
        questionId: chosen.id,
      });

      return {
        data: {
          status: 'active',
          question: {
            id: chosen.id,
            vignette: qd?.vignette ?? undefined,
            question: qd?.question ?? '',
            options,
            system: chosen.system ?? 'General',
            difficulty: chosen.difficulty ?? 'PANCE-level',
            tags: qd?.tags ?? undefined,
          },
        },
      };
    } catch (error: any) {
      log.error('Targeted daily today error', { error: error?.message ?? String(error) });
      return { status: 500, error: 'Failed to fetch targeted daily question' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 120 }
);

