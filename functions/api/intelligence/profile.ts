/**
 * Metacognition Engine - Intelligence Profile API
 *
 * GET /api/intelligence/profile
 *
 * Aggregates OsceResult (grades) and QuestionAttempt (quiz results) to compute:
 * - Concept Gaps (failures by system and task)
 * - Weak Spot Profile (Gemini-ready tutor context)
 * - SRS scheduling helpers (Leitner-style)
 *
 * Exported functions for use by Tutor, Knowledge Cache, and Dashboard.
 */

import { z } from 'zod';
import { resolveSystem } from '../_shared/inferSystem';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserId } from '../_shared/user-resolver';
import { SYSTEM_ALIASES } from '../../../lib/constants/blueprint';
import { getFromCache, setInCache, isKVAvailable } from '../_shared/cache';

// ============================================================================
// Types
// ============================================================================

export interface ConceptGapItem {
  system: string;
  task: string;
  failureCount: number;
  totalCount: number;
  failureRate: number;
  items: string[];
  isRedFlag?: boolean;
}

export interface ConceptGapsResult {
  bySystem: Record<string, { failures: number; total: number; items: string[] }>;
  byTask: Record<string, { failures: number; total: number; items: string[] }>;
  bySystemAndTask: Record<string, ConceptGapItem[]>;
  gaps: ConceptGapItem[];
}

const CHECKLIST_ITEM = z.object({
  item: z.string(),
  status: z.enum(['PASS', 'FAIL']),
  feedback: z.string().optional(),
});

// ============================================================================
// Concept Gap Algorithm
// ============================================================================

/**
 * Normalize system name to canonical blueprint system.
 */
function normalizeSystem(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return 'General';
  const trimmed = raw.trim();
  if (!trimmed) return 'General';
  return SYSTEM_ALIASES[trimmed] ?? trimmed;
}

/**
 * Map questionType to PANCE Blueprint task.
 */
function mapTask(questionType: string | null | undefined): string {
  if (!questionType) return 'Clinical Intervention';
  const t = questionType.toLowerCase();
  if (t.includes('diagnos')) return 'Differential Diagnosis';
  if (t.includes('treatment') || t.includes('management') || t.includes('pharm'))
    return 'Clinical Intervention';
  if (t.includes('mechanism') || t.includes('pathophys')) return 'Clinical Intervention';
  if (t.includes('history') || t.includes('hpi')) return 'History Taking';
  if (t.includes('physical') || t.includes('exam')) return 'Physical Exam';
  return 'Clinical Intervention';
}

/**
 * Calculate concept gaps from OsceResult (FAIL checklist items) and QuestionAttempt (incorrect).
 * Groups by system and task based on PANCE Blueprint tags.
 */
export async function calculateConceptGaps(
  prisma: EdgePrismaClient,
  userId: string
): Promise<ConceptGapsResult> {
  const bySystem: Record<string, { failures: number; total: number; items: string[] }> = {};
  const byTask: Record<string, { failures: number; total: number; items: string[] }> = {};
  const bySystemAndTask: Record<string, ConceptGapItem[]> = {};
  const allGaps: ConceptGapItem[] = [];

  // 1. OsceResult: sessions with FAIL checklist items and redFlagsMissed
  const osceSessions = await prisma.patientEncounterSession.findMany({
    where: { userId },
    include: {
      OsceResult: { select: { checklist: true, redFlagsMissed: true, score: true, clinicalReasoningScore: true } },
      PatientEncounterCase: { select: { chiefComplaint: true, correctDiagnosis: true, targetSystem: true } },
    },
    orderBy: { startTime: 'desc' },
    take: 100, // Bound to prevent memory exhaustion for users with many sessions
  });

  for (const session of osceSessions) {
    const result = session.OsceResult;
    if (!result) continue;

    const system = resolveSystem(
      session.PatientEncounterCase.targetSystem,
      session.PatientEncounterCase.chiefComplaint,
      session.PatientEncounterCase.correctDiagnosis
    );
    const normSystem = normalizeSystem(system);

    const checklist = Array.isArray(result.checklist) ? result.checklist : [];
    const failItems = checklist.filter((c: unknown) => {
      const parsed = CHECKLIST_ITEM.safeParse(c);
      return parsed.success && parsed.data.status === 'FAIL';
    });
    const redFlagsMissed = Array.isArray(result.redFlagsMissed) ? result.redFlagsMissed : [];

    for (const item of failItems) {
      const parsed = CHECKLIST_ITEM.parse(item);
      const itemText = parsed.item;
      const isRedFlag = redFlagsMissed.some(
        (rf) => rf && typeof rf === 'string' && itemText.toLowerCase().includes(rf.toLowerCase())
      );

      if (!bySystem[normSystem]) {
        bySystem[normSystem] = { failures: 0, total: 0, items: [] };
      }
      bySystem[normSystem].failures++;
      bySystem[normSystem].total++;
      if (!bySystem[normSystem].items.includes(itemText)) {
        bySystem[normSystem].items.push(itemText);
      }

      const task = 'Differential Diagnosis'; // OSCE failures map to DD
      const stKey = `${normSystem}|${task}`;
      if (!bySystemAndTask[stKey]) {
        bySystemAndTask[stKey] = [];
      }
      const existing = bySystemAndTask[stKey].find((g) => g.items.includes(itemText));
      if (!existing) {
        const gap: ConceptGapItem = {
          system: normSystem,
          task,
          failureCount: 1,
          totalCount: 1,
          failureRate: 1,
          items: [itemText],
          isRedFlag,
        };
        bySystemAndTask[stKey].push(gap);
        allGaps.push(gap);
      } else {
        existing.failureCount++;
        existing.totalCount++;
        existing.failureRate = existing.failureCount / existing.totalCount;
      }

      if (!byTask[task]) {
        byTask[task] = { failures: 0, total: 0, items: [] };
      }
      byTask[task].failures++;
      byTask[task].total++;
      if (!byTask[task].items.includes(itemText)) {
        byTask[task].items.push(itemText);
      }
    }
  }

  // 2. QuestionAttempt: incorrect answers grouped by system and task
  // Readiness concept gaps: only MAIN/DRILL sessions (TARGETED/CRAM/RAPID_RECALL excluded)
  const wrongAttempts = await prisma.questionAttempt.findMany({
    where: { userId, wasCorrect: false, isMainSession: true },
    select: { questionId: true, system: true, questionType: true, conditionId: true },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  const questionIds = [...new Set(wrongAttempts.map((a) => a.questionId).filter(Boolean))];
  const [questions, preGenerated] =
    questionIds.length > 0
      ? await Promise.all([
          prisma.question.findMany({
            where: { id: { in: questionIds } },
            select: { id: true, system: true, category: true, topic: true },
          }),
          prisma.preGeneratedQuestion.findMany({
            where: { id: { in: questionIds } },
            select: { id: true, system: true, conditionId: true },
          }),
        ])
      : [[], []];

  const questionMap = new Map<
    string,
    { system?: string | null; category?: string | null; topic?: string | null }
  >();
  for (const q of questions) {
    questionMap.set(q.id, { system: q.system, category: q.category, topic: q.topic });
  }
  for (const pg of preGenerated) {
    if (!questionMap.has(pg.id)) {
      questionMap.set(pg.id, {
        system: pg.system,
        category: null,
        topic: pg.conditionId ?? null,
      });
    }
  }

  for (const attempt of wrongAttempts) {
    const q = attempt.questionId ? questionMap.get(attempt.questionId) : undefined;
    const system = normalizeSystem(attempt.system ?? q?.system ?? null);
    const task = mapTask(attempt.questionType ?? q?.category ?? q?.topic ?? null);

    if (!bySystem[system]) {
      bySystem[system] = { failures: 0, total: 0, items: [] };
    }
    bySystem[system].failures++;
    bySystem[system].total++;
    const topicLabel = q?.topic || q?.category || attempt.conditionId || task;
    if (topicLabel && !bySystem[system].items.includes(topicLabel)) {
      bySystem[system].items.push(topicLabel);
    }

    if (!byTask[task]) {
      byTask[task] = { failures: 0, total: 0, items: [] };
    }
    byTask[task].failures++;
    byTask[task].total++;
    if (topicLabel && !byTask[task].items.includes(topicLabel)) {
      byTask[task].items.push(topicLabel);
    }

    const stKey = `${system}|${task}`;
    const itemKey = topicLabel || `${system}-${task}`;
    const existingGap = bySystemAndTask[stKey]?.find((g) =>
      topicLabel ? g.items.includes(topicLabel) : g.items.includes(itemKey)
    );
    if (existingGap) {
      existingGap.failureCount++;
      existingGap.totalCount++;
      existingGap.failureRate = existingGap.failureCount / existingGap.totalCount;
    } else {
      const gap: ConceptGapItem = {
        system,
        task,
        failureCount: 1,
        totalCount: 1,
        failureRate: 1,
        items: topicLabel ? [topicLabel] : [itemKey],
      };
      if (!bySystemAndTask[stKey]) bySystemAndTask[stKey] = [];
      bySystemAndTask[stKey].push(gap);
      allGaps.push(gap);
    }
  }

  return { bySystem, byTask, bySystemAndTask, gaps: allGaps };
}

// ============================================================================
// Weak Spot Profile (Tutor Context)
// ============================================================================

/**
 * Generate natural language tutor context for Gemini System Instruction.
 * Converts concept gaps into: "Student Weaknesses: Consistently misses 'Red Flag' questions in Cardiology..."
 */
export async function generateTutorContext(
  prisma: EdgePrismaClient,
  userId: string
): Promise<string> {
  const gaps = await calculateConceptGaps(prisma, userId);

  const lines: string[] = ['Student Weaknesses:'];

  if (gaps.gaps.length === 0) {
    return 'Student Weaknesses: None identified. Proceed with standard Socratic dialogue.';
  }

  const bySystemSorted = Object.entries(gaps.bySystem).sort(
    (a, b) => b[1].failures / Math.max(1, b[1].total) - a[1].failures / Math.max(1, a[1].total)
  );

  for (const [system, data] of bySystemSorted.slice(0, 5)) {
    const rate = (data.failures / Math.max(1, data.total)) * 100;
    const redFlagGaps = gaps.gaps.filter((g) => g.system === system && g.isRedFlag);
    if (redFlagGaps.length > 0) {
      lines.push(
        `Consistently misses 'Red Flag' questions in ${system} (${Math.round(rate)}% failure rate).`
      );
    } else {
      lines.push(`Struggles with ${system} (${Math.round(rate)}% failure rate).`);
    }
  }

  const topTasks = gaps.gaps
    .filter((g) => g.items.length > 0)
    .slice(0, 5)
    .map((g) => g.items[0] || g.task);
  if (topTasks.length > 0) {
    lines.push(`Specific weak areas: ${topTasks.slice(0, 5).join(', ')}.`);
  }

  lines.push('Prioritize these topics in Socratic dialogue.');

  return lines.join(' ');
}

// ============================================================================
// Spaced Repetition Scheduler (Leitner / SuperMemo-2 style)
// ============================================================================

/**
 * Schedule a concept review. Fail → +1 day, Pass → +3 days.
 * Uses StudyRecommendation as the "StudyQueue" for review items.
 * Deduplicates: at most one pending review per concept per day.
 */
export async function scheduleConceptReview(
  prisma: EdgePrismaClient,
  userId: string,
  conceptKey: string,
  passed: boolean
): Promise<{ id: string }> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const existing = await prisma.studyRecommendation.findFirst({
    where: {
      userId,
      type: 'review',
      topic: conceptKey,
      status: 'pending',
      createdAt: { gte: todayStart },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id };

  const days = passed ? 3 : 1;
  const scheduledFor = new Date(now);
  scheduledFor.setDate(scheduledFor.getDate() + days);
  scheduledFor.setHours(0, 0, 0, 0);

  const rec = await prisma.studyRecommendation.create({
    data: {
      userId,
      type: 'review',
      topic: conceptKey,
      reason: passed
        ? `Passed concept - review in ${days} days (Leitner)`
        : `Failed concept - review tomorrow (Leitner)`,
      priority: passed ? 'medium' : 'high',
      status: 'pending',
      data: {
        scheduledFor: scheduledFor.toISOString(),
        source: 'metacognition_srs',
        passed,
        intervalDays: days,
      } as object,
    },
  });

  return { id: rec.id };
}

// ============================================================================
// GET /api/intelligence/profile
// ============================================================================

const ProfileSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ProfileSchema, async (context) => {
  const { env, auth } = context;
  const log = createEndpointLogger('/api/intelligence/profile', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    // ── KV cache: 5-minute TTL (concept gaps change slowly) ──
    const cacheKey = `intel_profile:${auth.userId}`;
    if (isKVAvailable(env.CACHE)) {
      const cached = await getFromCache(env.CACHE, cacheKey);
      if (cached) {
        log.info('Intelligence profile cache hit');
        return { data: cached, headers: { 'X-Cache': 'HIT' } };
      }
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return { status: 404, error: 'User not found' };
    }

    const [gaps, tutorContext] = await Promise.all([
      calculateConceptGaps(prisma, userId),
      generateTutorContext(prisma, userId),
    ]);

    const payload = {
      conceptGaps: {
        bySystem: gaps.bySystem,
        byTask: gaps.byTask,
        gaps: gaps.gaps.slice(0, 50),
      },
      tutorContext,
    };

    // Cache the result
    if (isKVAvailable(env.CACHE)) {
      await setInCache(env.CACHE, cacheKey, payload, 300); // 5 min TTL
    }

    log.info('Intelligence profile generated', { gapCount: gaps.gaps.length });

    return {
      data: payload,
      headers: { 'X-Cache': 'MISS' },
    };
  } catch (error) {
    log.error('Intelligence profile error', { error });
    return {
      status: 500,
      error: 'Internal server error',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
