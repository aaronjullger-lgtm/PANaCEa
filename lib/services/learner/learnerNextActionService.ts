/**
 * Unified deterministic next-best-action ranking.
 *
 * The model may explain the result but MUST NOT invent or reorder actions
 * without calling explicit revision tools.
 */

import type { PrismaClient } from '@prisma/client';
import { getSystemsForRotation } from '@/config/rotation-systems';
import { getLearnerContext } from './learnerContextService';
import { getDueLearningItems } from './learnerDueItemsService';
import { getOrCreateDailyStudyPlan, sanitizeStudyPlanTasks } from '../studyPlanService';
import type { NextBestAction, NextBestActionRequest, NextActionType } from './types';

interface RankedCandidate {
  id: string;
  type: NextActionType;
  title: string;
  score: number;
  estimatedMinutes: number;
  whyNow: string;
  launchRoute: string;
  launchParams: Record<string, string>;
  sources: NextBestAction['sources'];
}

function stableId(parts: string[]): string {
  return parts.join(':');
}

export async function getNextBestAction(
  prisma: PrismaClient,
  request: NextBestActionRequest
): Promise<NextBestAction> {
  const now = request.now ?? new Date();
  const userId = request.userId;
  const availableMinutes = request.availableMinutes ?? 45;

  const [context, dueItems, dailyPlan] = await Promise.all([
    getLearnerContext(prisma, userId, now),
    getDueLearningItems(prisma, userId, now),
    getOrCreateDailyStudyPlan(prisma as any, userId, now),
  ]);

  const candidates: RankedCandidate[] = [];
  const rotation = context.profile.currentRotation;
  const rotationSystems = context.rotation.systemsInScope;

  // 1. Overdue FSRS — highest priority
  const overdueFsrs = dueItems.filter((d) => d.kind === 'fsrs_review' && d.overdueHours > 0);
  if (overdueFsrs.length > 0) {
    const top = overdueFsrs[0]!;
    candidates.push({
      id: stableId(['nba', 'fsrs_overdue', top.conditionId ?? top.id]),
      type: 'fsrs_review_session',
      title: `Targeted review: ${overdueFsrs.length} overdue topic${overdueFsrs.length === 1 ? '' : 's'}`,
      score: 100 + Math.min(overdueFsrs.length, 20) + top.priorityScore,
      estimatedMinutes: Math.min(availableMinutes, Math.max(15, overdueFsrs.length * 3)),
      whyNow: `${overdueFsrs.length} FSRS review${overdueFsrs.length === 1 ? '' : 's'} ${overdueFsrs.length === 1 ? 'is' : 'are'} overdue. Spaced repetition decays fastest on overdue cards.`,
      launchRoute: '/study',
      launchParams: {
        mode: 'targeted',
        lane: 'targeted',
        count: String(Math.min(20, overdueFsrs.length * 2)),
      },
      sources: [
        { type: 'fsrs', detail: `${overdueFsrs.length} overdue UserProgress rows` },
      ],
    });
  }

  // 2. Study plan tasks due / pending high priority
  const planTasks = sanitizeStudyPlanTasks(dailyPlan.recommendedSessions);
  const pendingHigh = planTasks.filter(
    (t) =>
      ['pending', 'active', 'in_progress'].includes(t.status) &&
      (t.priority === 'high' || t.kind === 'targeted' || t.kind === 'review')
  );
  if (pendingHigh.length > 0) {
    const task = pendingHigh[0]!;
    candidates.push({
      id: stableId(['nba', 'plan', task.id]),
      type: 'plan_task',
      title: task.title,
      score: 90 + (task.priority === 'high' ? 10 : 0),
      estimatedMinutes: task.estimatedMinutes,
      whyNow: task.reason || 'This task is on today\'s study plan.',
      launchRoute: task.route,
      launchParams: task.launchParams,
      sources: [{ type: 'study_plan', detail: `DailyStudyPlan task ${task.id}` }],
    });
  }

  // 3. Allocator says targeted-heavy
  if (context.allocation && context.allocation.recommendedSplit === 'targeted_heavy') {
    candidates.push({
      id: stableId(['nba', 'allocator_targeted']),
      type: 'targeted_drill',
      title: 'Targeted retention session',
      score: 80 + context.allocation.retentionPriority * 0.2,
      estimatedMinutes: Math.min(availableMinutes, context.allocation.recommendedTargetedCount * 2),
      whyNow: context.allocation.reasonSummary,
      launchRoute: '/study',
      launchParams: {
        mode: 'targeted',
        lane: 'targeted',
        count: String(context.allocation.recommendedTargetedCount),
      },
      sources: [
        {
          type: 'allocator',
          detail: `retentionPriority=${context.allocation.retentionPriority}`,
        },
      ],
    });
  }

  // 4. Rotation-aligned weak area (when on rotation)
  if (rotation && rotationSystems.length > 0) {
    const weakProgress = await prisma.userProgress.findMany({
      where: {
        userId,
        system: { in: rotationSystems },
        accuracy: { lt: 0.7 },
      },
      select: { system: true, accuracy: true, conditionId: true },
      orderBy: { accuracy: 'asc' },
      take: 3,
    });
    if (weakProgress.length > 0) {
      const sys = weakProgress[0]!.system ?? rotationSystems[0]!;
      candidates.push({
        id: stableId(['nba', 'rotation_weak', sys]),
        type: 'main_readiness_session',
        title: `${rotation}: strengthen ${sys}`,
        score: 70 + (context.rotation.daysRemaining != null && context.rotation.daysRemaining < 14 ? 15 : 0),
        estimatedMinutes: Math.min(availableMinutes, 30),
        whyNow: `During ${rotation}, ${sys} accuracy is below 70% in your recent attempts.`,
        launchRoute: '/study',
        launchParams: { mode: 'main', lane: 'eor', system: sys },
        sources: [
          { type: 'rotation', detail: `${rotation} systems ${rotationSystems.join(',')}` },
        ],
      });
    }
  }

  // 5. MAIN readiness when allocator says main-heavy
  if (context.allocation && context.allocation.recommendedSplit === 'main_heavy') {
    const sys = context.allocation.mainSystems[0] ?? 'CV';
    candidates.push({
      id: stableId(['nba', 'allocator_main', sys]),
      type: 'main_readiness_session',
      title: `Readiness: ${sys} blueprint gap`,
      score: 60 + context.allocation.readinessPriority * 0.2,
      estimatedMinutes: Math.min(availableMinutes, context.allocation.recommendedMainCount * 2),
      whyNow: context.allocation.reasonSummary,
      launchRoute: '/study',
      launchParams: { mode: 'main', lane: 'main', system: sys },
      sources: [
        { type: 'blueprint', detail: `readinessPriority=${context.allocation.readinessPriority}` },
      ],
    });
  }

  // 6. Rest / low urgency fallback
  if (candidates.length === 0) {
    candidates.push({
      id: stableId(['nba', 'rest']),
      type: 'rest_day',
      title: 'Light review or rest',
      score: 10,
      estimatedMinutes: 15,
      whyNow: 'No urgent overdue reviews or plan tasks. A short session maintains momentum without overload.',
      launchRoute: '/study',
      launchParams: { mode: 'main', lane: 'main', count: '10' },
      sources: [{ type: 'allocator', detail: 'no urgent signals' }],
    });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });

  const primary = candidates[0]!;
  const alternates = candidates.slice(1, 4).map((c) => ({
    id: c.id,
    type: c.type,
    title: c.title,
    score: c.score,
  }));

  return {
    id: primary.id,
    type: primary.type,
    title: primary.title,
    whyNow: primary.whyNow,
    score: primary.score,
    estimatedMinutes: primary.estimatedMinutes,
    launchRoute: primary.launchRoute,
    launchParams: primary.launchParams,
    sources: primary.sources,
    alternates,
    generatedAt: now.toISOString(),
  };
}

/** Pure ranking for tests — no DB */
export function rankCandidatesForTest(candidates: RankedCandidate[]): RankedCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });
}

export type { RankedCandidate };
