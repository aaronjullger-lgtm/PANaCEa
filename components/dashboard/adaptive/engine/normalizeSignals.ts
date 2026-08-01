import type { TodayPlanData } from '@/hooks/useTodayPlan';
import type { DashboardAnalyticsModel } from '@/lib/dashboard/realStudyAnalytics';
import type { PerformanceRecord, SessionSettings, UserProfile } from '@/types';
import { NCCPA_BLUEPRINT_WEIGHTS } from '@/lib/nccpa-question-weighting';
import { classifyDashboardMode, getGoalStatusLabel } from './classifyUserState';
import { scoreWidget } from './scoreWidget';
import type {
  BlueprintCell,
  DashboardActions,
  DashboardContext,
  DashboardGoal,
  DashboardUserState,
  MatrixItem,
  PlanProtocolStep,
  ReadinessPulse,
  ReviewCoverage,
  TrustEvent,
} from '../model/DashboardContext';
import type { DashboardInsightCandidate } from '../model/widgetTypes';

type NormalizeInput = {
  performanceData: PerformanceRecord[];
  growthAreas: string[];
  dueCount: number;
  examLabel: string;
  profile: Partial<UserProfile> | null;
  todayPlan: TodayPlanData | null;
  todayPlanLoading?: boolean;
  todayPlanError?: string | null;
  dashboardAnalytics?: DashboardAnalyticsModel | null;
  dashboardAnalyticsLoading?: boolean;
  dashboardAnalyticsError?: string | null;
  availableMinutes?: number | null;
  hasActiveSession?: boolean;
  now?: Date;
  actions?: DashboardActions;
};

const DAY_MS = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatTopic(raw: string | null | undefined): string {
  if (!raw) return 'mixed clinical pattern';
  return raw
    .replace(/__/g, ' / ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDaysUntil(dateValue: string | null | undefined, now: Date): number | null {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / DAY_MS);
}

function isStale(iso: string | undefined, now: Date): boolean {
  if (!iso) return false;
  const generated = new Date(iso);
  if (Number.isNaN(generated.getTime())) return false;
  return now.getTime() - generated.getTime() > 30 * 60_000;
}

function getBaseMode(profile: Partial<UserProfile> | null): DashboardGoal['baseMode'] {
  if (profile?.isCertifiedPA || profile?.yearInProgram === 'Graduated' || profile?.yearInProgram === 'Post-Graduate') {
    return 'panre';
  }
  if (profile?.eorTestDate && profile.currentRotation) return 'eor';
  if (profile?.yearInProgram?.startsWith('Didactic')) return 'didactic';
  return 'pance';
}

function getTargetTopic(plan: TodayPlanData | null, growthAreas: string[]): string {
  return formatTopic(plan?.targetedConditions?.[0] ?? plan?.mainSystems?.[0] ?? growthAreas[0] ?? 'mixed clinical pattern');
}

function deriveLoadIndex(input: NormalizeInput): number {
  if (input.availableMinutes != null && input.availableMinutes <= 15) return 0.82;
  const recent = input.dashboardAnalytics?.recentSessions.slice(0, 3) ?? [];
  if (recent.length >= 3) {
    const shortOrLow = recent.filter((session) => session.durationMinutes <= 12 || (session.accuracy != null && session.accuracy < 55)).length;
    if (shortOrLow >= 2) return 0.78;
  }
  const rapid = input.performanceData.slice(-30).filter((record) => (record.timeSpentMs ?? 99999) < 4_000).length;
  if (rapid >= 10) return 0.72;
  return 0.25;
}

function buildGoal(input: NormalizeInput, userState: Omit<DashboardUserState, 'lowData' | 'overloaded' | 'behind' | 'ahead' | 'panre' | 'noReviewDebt'>): DashboardGoal {
  const now = input.now ?? new Date();
  const baseMode = getBaseMode(input.profile);
  const daysToTarget = getDaysUntil(input.profile?.eorTestDate ?? input.profile?.examDate, now);
  const readinessPriority = input.todayPlan?.readinessPriority ?? null;
  const label =
    baseMode === 'eor'
      ? `${input.profile?.currentRotation ?? 'Rotation'} EOR`
      : baseMode === 'didactic'
        ? input.examLabel || 'Didactic exam'
        : baseMode === 'panre'
          ? 'PA-C maintenance'
          : input.examLabel || 'PANCE readiness';

  let status: DashboardGoal['status'] = 'on_pace';
  if (userState.dataMaturity < 0.3) status = 'calibrating';
  else if (baseMode === 'panre') status = 'comfortable';
  else if (readinessPriority != null && readinessPriority < 45 && daysToTarget != null && daysToTarget <= 30) status = 'behind';
  else if (readinessPriority != null && readinessPriority < 58) status = 'catch_up';

  return {
    label,
    mode: baseMode,
    baseMode,
    daysToTarget,
    status,
    statusLabel: getGoalStatusLabel(status),
    targetLabel:
      daysToTarget == null
        ? 'No deadline set'
        : daysToTarget === 0
          ? 'Today'
          : `${daysToTarget} days`,
    syncedLabel: input.todayPlanError ? 'Plan fallback' : input.todayPlan ? 'Synced' : 'Local signal',
  };
}

function buildReviewCoverage(input: NormalizeInput, _planQuestions: number): ReviewCoverage {
  const forecast = input.dashboardAnalytics?.reviewForecast;
  const overdue = forecast?.overdue ?? input.dashboardAnalytics?.overview.overdueReviews ?? 0;
  const today = forecast?.today ?? input.dueCount ?? 0;
  const reviewTasks = input.todayPlan?.tasks
    ?.filter((task) => {
      const label = `${task.kind} ${task.mode} ${task.title} ${task.reason}`.toLowerCase();
      return (
        task.status !== 'skipped' &&
        task.status !== 'rescheduled' &&
        (task.kind === 'targeted' || label.includes('review') || label.includes('due') || label.includes('retention'))
      );
    })
    .filter((task) => {
      const conditionIds = Array.isArray(task.conditionIds) ? task.conditionIds : [];
      const reviewCardIds = Array.isArray(task.reviewCardIds) ? task.reviewCardIds : [];
      return conditionIds.length > 0 || reviewCardIds.length > 0;
    });
  const plannedConditionIds = new Set(
    (reviewTasks ?? []).flatMap((task) =>
      Array.isArray(task.conditionIds) ? task.conditionIds.filter(Boolean) : []
    )
  );
  const plannedReviewCardIds = new Set(
    (reviewTasks ?? []).flatMap((task) =>
      Array.isArray(task.reviewCardIds) ? task.reviewCardIds.filter(Boolean) : []
    )
  );
  const dueConditionIds = forecast?.dueConditionIds ?? [];
  const overdueConditionIds = forecast?.overdueConditionIds ?? [];
  const dueReviewCardIds = forecast?.dueReviewCardIds ?? [];
  const overdueReviewCardIds = forecast?.overdueReviewCardIds ?? [];
  const hasDueIdentityEvidence =
    dueConditionIds.length > 0 ||
    overdueConditionIds.length > 0 ||
    dueReviewCardIds.length > 0 ||
    overdueReviewCardIds.length > 0;
  const countMatches = (items: string[], planned: Set<string>) =>
    items.reduce((count, id) => count + (planned.has(id) ? 1 : 0), 0);
  const hasPlanTaskEvidence = Boolean(reviewTasks && reviewTasks.length > 0);
  const hasPlanTasks = Array.isArray(input.todayPlan?.tasks);
  const matchedOverdue =
    countMatches(overdueConditionIds, plannedConditionIds) +
    countMatches(overdueReviewCardIds, plannedReviewCardIds);
  const matchedDue =
    countMatches(dueConditionIds, plannedConditionIds) +
    countMatches(dueReviewCardIds, plannedReviewCardIds);
  const coveredOverdue = hasDueIdentityEvidence ? Math.min(overdue, matchedOverdue) : 0;
  const coveredDanger = hasDueIdentityEvidence ? Math.min(today, matchedDue) : 0;
  const scheduledCapacity = coveredOverdue + coveredDanger;
  const coverageSource: ReviewCoverage['coverageSource'] =
    hasPlanTaskEvidence && hasDueIdentityEvidence
      ? scheduledCapacity > 0
        ? 'plan_tasks'
        : 'none'
      : hasPlanTaskEvidence
        ? 'unknown'
        : hasPlanTasks
          ? 'none'
          : 'unknown';

  const days = (forecast?.forecast ?? []).slice(0, 7).map((day, index) => {
    const count = Math.max(0, day.count);
    return {
      label: index === 0 ? 'Today' : new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' }),
      stable: Math.max(0, 12 - count),
      danger: Math.min(count, 12),
      overdue: index === 0 ? overdue : 0,
      scheduled: index === 0 && coverageSource === 'plan_tasks' ? scheduledCapacity : 0,
    };
  });

  while (days.length < 7) {
    days.push({ label: days.length === 0 ? 'Today' : `D+${days.length}`, stable: 8, danger: 0, overdue: 0, scheduled: 0 });
  }

  return {
    stable: Math.max(0, 40 - today),
    danger: today,
    overdue,
    coveredDanger,
    coveredOverdue,
    plannedReviewCount: scheduledCapacity,
    coverageSource,
    days,
    summary:
      today + overdue <= 0
        ? 'No review debt is competing with today’s plan.'
        : coverageSource === 'plan_tasks'
          ? "Today's plan protects the riskiest reviews first."
          : coverageSource === 'none'
            ? 'Review load is visible, but today’s plan has no review task scheduled.'
            : 'Review load is visible; coverage needs condition or card identity before PANaCEa claims protection.',
  };
}

function buildReadiness(input: NormalizeInput, goal: DashboardGoal): ReadinessPulse {
  const hasData = (input.dashboardAnalytics?.overview.totalAttempts ?? input.performanceData.length) >= 20;
  if (!hasData) {
    return {
      available: false,
      status: 'calibrating',
      statusLabel: 'Calibrating',
      points: [],
      confidenceLow: [],
      confidenceHigh: [],
      target: null,
      confidence: 'low',
      summary: 'Readiness forecast unlocks after PANaCEa has enough baseline signal.',
    };
  }

  const trend = input.dashboardAnalytics?.trend ?? [];
  const recentPoints = trend.length > 0 ? trend.map((point) => point.accuracy).slice(-10) : [58, 59, 61, 62, 64, 65, 66];
  const current = recentPoints.at(-1) ?? input.todayPlan?.readinessPriority ?? 62;
  const slope = goal.status === 'behind' ? 1.2 : goal.status === 'catch_up' ? 0.7 : 0.45;
  const points = Array.from({ length: 14 }, (_, index) => clamp(Math.round(current + index * slope), 0, 100));
  const confidenceWidth = input.dashboardAnalytics?.overview.totalAttempts && input.dashboardAnalytics.overview.totalAttempts > 100 ? 5 : 9;
  const confidenceLow = points.map((point) => clamp(point - confidenceWidth, 0, 100));
  const confidenceHigh = points.map((point) => clamp(point + confidenceWidth, 0, 100));
  const status = goal.status === 'behind' ? 'behind' : goal.status === 'catch_up' ? 'catch_up' : 'on_pace';

  return {
    available: true,
    status,
    statusLabel: status === 'behind' ? 'Behind, with a recovery path' : status === 'catch_up' ? 'Catch-up pace' : 'On pace',
    points,
    confidenceLow,
    confidenceHigh,
    target: 75,
    confidence: confidenceWidth <= 5 ? 'high' : 'medium',
    summary:
      status === 'behind'
        ? 'Catch-up path is active if today’s session is completed.'
        : 'On pace if today’s session is completed.',
  };
}

function buildMatrix(input: NormalizeInput, targetTopic: string): MatrixItem[] {
  const weakSystems = input.dashboardAnalytics?.weakSystems ?? [];
  const blueprintSystems = input.dashboardAnalytics?.blueprintGaps?.systems ?? [];
  const fromWeakSystems = weakSystems.map((system) => ({
    id: system.system,
    label: formatTopic(system.system),
    urgency: clamp((system.score ?? 0) / 100, 0.18, 0.95),
    mastery: clamp(system.accuracy / 100, 0.05, 0.95),
    weight: clamp(Math.abs(system.gapPercent ?? 8) / 20 + 0.35, 0.28, 1),
    trend: system.trend === 'declining' ? 'down' : system.trend === 'improving' ? 'up' : 'flat',
    isTodayTarget: targetTopic.toLowerCase().includes(system.system.toLowerCase()),
    attribution: `${formatTopic(system.system)} is weighted by recent accuracy, gap, and trend.`,
  })) satisfies MatrixItem[];

  const fromBlueprint = blueprintSystems.slice(0, 7).map((system) => ({
    id: system.system,
    label: formatTopic(system.system),
    urgency: clamp(Math.abs(system.gapPercent) / 20 + 0.2, 0.18, 0.92),
    mastery: clamp(system.accuracy / 100, 0.08, 0.95),
    weight: clamp(system.targetPercent / 18, 0.25, 1),
    trend: 'flat' as const,
    isTodayTarget: targetTopic.toLowerCase().includes(system.system.toLowerCase()),
    attribution: `${formatTopic(system.system)} is weighted by blueprint coverage and recent mastery.`,
  }));

  const fallback = Object.entries(NCCPA_BLUEPRINT_WEIGHTS)
    .slice(0, 6)
    .map(([system, weight], index) => ({
      id: system,
      label: formatTopic(system),
      urgency: clamp(0.25 + index * 0.08, 0.2, 0.75),
      mastery: clamp(0.62 - index * 0.04, 0.28, 0.8),
      weight: clamp(Number(weight) / 18, 0.25, 1),
      trend: 'flat' as const,
      isTodayTarget: targetTopic.toLowerCase().includes(system.toLowerCase()),
      attribution: `${formatTopic(system)} uses NCCPA blueprint weight until more personal data is available.`,
    }));

  return (fromWeakSystems.length ? fromWeakSystems : fromBlueprint.length ? fromBlueprint : fallback)
    .sort((left, right) => right.urgency * (1 - right.mastery) * right.weight - left.urgency * (1 - left.mastery) * left.weight)
    .slice(0, 7);
}

function buildBlueprintHeatmap(matrix: MatrixItem[]): BlueprintCell[] {
  return matrix.slice(0, 7).map((item) => ({
    id: `${item.id}-core`,
    system: item.label,
    subsection: item.isTodayTarget ? 'Today target' : item.trend === 'down' ? 'Monitor' : 'Core',
    mastery: item.mastery,
    urgency: item.urgency,
    isTodayTarget: item.isTodayTarget,
  }));
}

function buildPlanProtocol(todayTitle: string, commandMinutes: number, reviewCount: number): PlanProtocolStep[] {
  return [
    { id: 'warmup', label: 'Warm-up review', minutes: 6, kind: 'warmup', attribution: 'Starts with a low-friction recall pass.' },
    {
      id: 'focus',
      label: todayTitle,
      minutes: clamp(commandMinutes - 14, 12, 42),
      kind: 'focus',
      attribution: 'Largest block goes to the highest-yield repair target.',
    },
    {
      id: 'review',
      label: reviewCount > 0 ? 'Review protection' : 'Transfer check',
      minutes: reviewCount > 0 ? 10 : 8,
      kind: reviewCount > 0 ? 'review' : 'transfer',
      attribution: reviewCount > 0 ? 'Riskiest reviews are protected before they decay.' : 'Transfers the pattern to nearby clinical decisions.',
    },
    { id: 'wrapup', label: 'Wrap-up', minutes: 4, kind: 'wrapup', attribution: 'Finishes with a short reset and next signal capture.' },
  ];
}

function buildTrustTimeline(input: NormalizeInput, targetTopic: string, reviewCoverage: ReviewCoverage): TrustEvent[] {
  const events: TrustEvent[] = [
    {
      id: 'today-target',
      when: 'Today',
      title: `${targetTopic} moved into the plan.`,
      detail: input.todayPlan?.reasonSummary || 'Recent misses and goal timing made this the best next repair target.',
      href: `/library/condition/${encodeURIComponent(targetTopic.toLowerCase().replace(/\s+/g, '-'))}`,
    },
  ];

  if (reviewCoverage.danger + reviewCoverage.overdue > 0) {
    events.push({
      id: 'review-protection',
      when: 'Yesterday',
      title: 'Reviews were protected.',
      detail: `${reviewCoverage.coveredDanger + reviewCoverage.coveredOverdue} higher-risk reviews are scheduled before new work expands.`,
    });
  }

  if (input.availableMinutes != null && input.availableMinutes <= 15) {
    events.push({
      id: 'short-plan',
      when: 'Today',
      title: 'The session was shortened.',
      detail: 'PANaCEa compressed the plan into the smallest useful block for the time available.',
    });
  } else {
    events.push({
      id: 'steady-plan',
      when: '3 days ago',
      title: 'The plan stayed focused.',
      detail: 'Stable work blocks keep the next recommendation easier to trust and act on.',
    });
  }

  return events.slice(0, 3);
}

function buildInsights(input: NormalizeInput, goal: DashboardGoal, userState: DashboardUserState, reviewCoverage: ReviewCoverage, readiness: ReadinessPulse, targetTopic: string): DashboardInsightCandidate[] {
  const candidates: DashboardInsightCandidate[] = [];
  const maturity = userState.dataMaturity;

  if (userState.lowData) {
    candidates.push({
      id: 'low_data_calibration',
      class: 'baseline',
      signalId: 'low_data',
      title: 'Baseline still calibrating',
      explanation: 'Finish this short block to unlock safer personalization.',
      attribution: `${input.performanceData.length} recent questions are available; PANaCEa waits before forecasting.`,
      actionState: 'needs_action',
      microVisual: { kind: 'calibration-ring', value: Math.round(maturity * 100), label: 'baseline' },
      urgency: 0.25,
      goalImpact: 0.55,
      actionability: 1,
      evidenceQuality: 0.8,
      novelty: 0.9,
      userStateFit: 1,
      anxietyCost: 0.05,
      redundancyPenalty: 0,
      alreadyHandledPenalty: 0,
    });
  }

  const protectedCount = reviewCoverage.coveredDanger + reviewCoverage.coveredOverdue;
  if (reviewCoverage.danger + reviewCoverage.overdue > 0) {
    const handled = reviewCoverage.coverageSource === 'plan_tasks' && protectedCount > 0;
    candidates.push({
      id: 'review_coverage_insight',
      class: 'protection',
      signalId: 'retention_protection',
      title: handled ? 'Reviews are protected' : 'Review coverage needs attention',
      explanation: handled
        ? "Today's plan covers the riskiest reviews first."
        : 'A short review pass should come before adding new work.',
      attribution: handled
        ? `${protectedCount} of ${reviewCoverage.danger + reviewCoverage.overdue} higher-risk reviews are in today’s plan.`
        : 'Today’s plan did not include a review task, so this stays actionable.',
      actionState: handled ? 'protected' : 'needs_action',
      microVisual: { kind: 'segmented-bar', covered: protectedCount, remaining: Math.max(0, reviewCoverage.danger + reviewCoverage.overdue - protectedCount), total: reviewCoverage.danger + reviewCoverage.overdue },
      urgency: reviewCoverage.overdue > 0 ? 0.78 : 0.58,
      goalImpact: 0.68,
      actionability: handled ? 0.45 : 0.9,
      evidenceQuality: 0.88,
      novelty: 0.65,
      userStateFit: userState.overloaded ? 0.5 : 0.75,
      anxietyCost: handled ? 0.04 : 0.28,
      redundancyPenalty: handled ? 0.25 : 0.05,
      alreadyHandledPenalty: handled ? 0.05 : 0,
      deepLink: handled ? undefined : { href: '/study', label: 'Start review pass' },
    });
  }

  const pair = input.dashboardAnalytics?.confusionPairs?.[0];
  const pairLeft = formatTopic(pair?.correctConditionName ?? pair?.correctConditionId ?? input.todayPlan?.targetedConditions?.[0]);
  const pairRight = formatTopic(pair?.selectedConditionName ?? pair?.selectedConditionId ?? (pairLeft.toLowerCase().includes('pneumonia') ? 'PE' : 'Pneumonia'));
  const hasPair = Boolean(pair) || input.todayPlan?.targetedConditions?.some((condition) => condition.toLowerCase().includes(' vs '));
    if (hasPair && maturity >= 0.25) {
    const handled = targetTopic.toLowerCase().includes(pairLeft.toLowerCase()) || (input.todayPlan?.targetedConditions?.some((condition) => condition.toLowerCase().includes(' vs ')) ?? false);
    candidates.push({
      id: 'confusion_pair',
      class: 'evidence',
      signalId: 'confusion_pair',
      title: handled ? 'Confusion pair is in plan' : 'Confusion pair surfaced',
      explanation: handled ? 'The comparison is already built into today\'s repair block.' : 'A split comparison drill would reduce repeated misses.',
      attribution: pair ? `${pair.frequency} recent misses connected ${pairLeft} with ${pairRight}.` : `${targetTopic} is the active targeted comparison.`,
      actionState: handled ? 'in_plan' : 'needs_action',
      microVisual: { kind: 'split-contrast', left: pairLeft, right: pairRight, handled },
      urgency: 0.62,
      goalImpact: 0.76,
      actionability: handled ? 0.5 : 0.92,
      evidenceQuality: pair ? 0.78 : 0.48,
      novelty: 0.75,
      userStateFit: userState.overloaded ? 0.45 : 0.78,
      anxietyCost: handled ? 0.05 : 0.16,
      redundancyPenalty: handled ? 0.2 : 0,
      alreadyHandledPenalty: handled ? 0.06 : 0,
      deepLink: { href: `/library?search=${encodeURIComponent(pairLeft)} vs ${encodeURIComponent(pairRight)}`, label: `Compare ${pairLeft} vs ${pairRight}` },
    });
  }

  const weak = input.dashboardAnalytics?.weakSystems?.[0];
  if (weak && maturity >= 0.35) {
    candidates.push({
      id: 'blueprint_drag',
      class: 'evidence',
      signalId: weak.system.toLowerCase().includes('pulm') ? 'pulmonary_repair' : 'cardio_transfer',
      title: `${formatTopic(weak.system)} is pulling the plan`,
      explanation: 'PANaCEa is using one focused block instead of showing a broad weakness list.',
      attribution: `${weak.attempts} attempts, ${weak.accuracy}% recent accuracy, ${weak.label.replace(/-/g, ' ')}.`,
      actionState: targetTopic.toLowerCase().includes(weak.system.toLowerCase()) ? 'in_plan' : 'monitor',
      microVisual: { kind: 'weighted-meter', label: formatTopic(weak.system), value: Math.round(weak.accuracy), target: 75 },
      urgency: weak.trend === 'declining' ? 0.68 : 0.48,
      goalImpact: 0.72,
      actionability: 0.62,
      evidenceQuality: 0.74,
      novelty: 0.58,
      userStateFit: 0.62,
      anxietyCost: 0.16,
      redundancyPenalty: 0.12,
      alreadyHandledPenalty: targetTopic.toLowerCase().includes(weak.system.toLowerCase()) ? 0.08 : 0,
      deepLink: { href: `/library?search=${encodeURIComponent(weak.system)}`, label: `Review ${formatTopic(weak.system)} content` },
    });
  }

  if (goal.daysToTarget != null && goal.daysToTarget <= 14 && goal.daysToTarget >= 0 && !userState.lowData) {
    candidates.push({
      id: 'exam_horizon',
      class: 'forecast',
      signalId: 'exam_horizon',
      title: 'Exam horizon is close',
      explanation: 'The plan is narrowing to the highest-yield work for this deadline.',
      attribution: `${goal.label} is ${goal.targetLabel.toLowerCase()} away; lower-yield analytics stay below the fold.`,
      actionState: goal.status === 'behind' ? 'needs_action' : 'monitor',
      microVisual: { kind: 'countdown-rail', current: Math.max(0, 14 - goal.daysToTarget), total: 14, label: goal.targetLabel },
      urgency: 0.9,
      goalImpact: 0.82,
      actionability: 0.82,
      evidenceQuality: 0.86,
      novelty: 0.7,
      userStateFit: 0.9,
      anxietyCost: goal.status === 'behind' ? 0.24 : 0.12,
      redundancyPenalty: 0,
      alreadyHandledPenalty: 0,
      deepLink: { href: '/study', label: 'Start focused session' },
    });
  }

  if (userState.overloaded) {
    candidates.push({
      id: 'load_guardrail',
      class: 'recovery',
      signalId: 'load_guardrail',
      title: 'Shorter plan is active',
      explanation: 'PANaCEa compressed today into the smallest useful session.',
      attribution: input.availableMinutes != null ? `${input.availableMinutes} minutes are available for this session.` : 'Recent session load favors a shorter block.',
      actionState: 'protected',
      microVisual: { kind: 'load-meter', value: 2, max: 5 },
      urgency: 0.62,
      goalImpact: 0.55,
      actionability: 0.92,
      evidenceQuality: 0.72,
      novelty: 0.7,
      userStateFit: 1,
      anxietyCost: 0.02,
      redundancyPenalty: 0,
      alreadyHandledPenalty: 0,
      deepLink: { href: '/study', label: 'Start shorter session' },
    });
  }

  if (readiness.available && !userState.lowData) {
    candidates.push({
      id: 'readiness_pace',
      class: 'forecast',
      signalId: 'readiness_forecast',
      title: readiness.statusLabel,
      explanation: readiness.summary,
      attribution: `Forecast uses recent sessions with ${readiness.confidence} confidence, shown as a band rather than a precise score.`,
      actionState: readiness.status === 'behind' ? 'monitor' : 'reassurance',
      microVisual: { kind: 'shield', label: readiness.statusLabel, value: readiness.points.at(-1) ?? 0 },
      urgency: readiness.status === 'behind' ? 0.62 : 0.25,
      goalImpact: 0.5,
      actionability: 0.35,
      evidenceQuality: readiness.confidence === 'high' ? 0.9 : 0.68,
      novelty: 0.45,
      userStateFit: 0.55,
      anxietyCost: 0.08,
      redundancyPenalty: 0.15,
      alreadyHandledPenalty: 0,
      deepLink: { href: '/progress', label: 'View readiness details' },
    });
  }

  return candidates
    .map((candidate) => ({ candidate, score: scoreWidget(candidate) }))
    .filter(({ candidate, score }) => candidate.class === 'baseline' || score.evidenceQuality >= 0.3)
    .sort((left, right) => right.score.final - left.score.final)
    .slice(0, 3)
    .map(({ candidate }) => candidate);
}

export function normalizeDashboardSignals(input: NormalizeInput): DashboardContext {
  const now = input.now ?? new Date();
  const totalAttempts = input.dashboardAnalytics?.overview.totalAttempts ?? input.performanceData.length;
  const dataMaturity = clamp(totalAttempts / 50, 0, 1);
  const loadIndex = deriveLoadIndex(input);
  const baseUserState = { dataMaturity, loadIndex };
  const goalDraft = buildGoal(input, baseUserState);
  const noReviewDebt = (input.dashboardAnalytics?.overview.dueToday ?? input.dueCount) === 0 && (input.dashboardAnalytics?.overview.overdueReviews ?? 0) === 0;
  const userState: DashboardUserState = {
    dataMaturity,
    loadIndex,
    lowData: dataMaturity < 0.3,
    overloaded: loadIndex >= 0.75,
    behind: goalDraft.status === 'behind',
    ahead: dataMaturity >= 0.6 && (input.todayPlan?.readinessPriority ?? 0) >= 82 && noReviewDebt,
    panre: goalDraft.baseMode === 'panre',
    noReviewDebt,
  };

  const mode = classifyDashboardMode(goalDraft, userState);
  const goal: DashboardGoal = { ...goalDraft, mode };
  const targetTopic = getTargetTopic(input.todayPlan, input.growthAreas);
  const questionCount =
    userState.lowData ? 10 : userState.overloaded ? 8 : input.todayPlan?.recommendedTargetedCount || input.todayPlan?.recommendedMainCount || 14;
  const reviewCoverage = buildReviewCoverage(input, questionCount);
  const commandMinutes = userState.lowData
    ? 18
    : userState.overloaded
      ? 15
      : mode === 'panre'
        ? 25
        : clamp(Math.round(questionCount * 1.6 + Math.min(20, reviewCoverage.coveredDanger + reviewCoverage.coveredOverdue) * 0.45), 24, 55);
  const expectedLiftRange: [number, number] | null = userState.lowData ? null : mode === 'panre' ? [1, 3] : userState.behind ? [6, 10] : [4, 8];
  const readiness = buildReadiness(input, goal);
  const matrix = buildMatrix(input, targetTopic);

  const todayTitle =
    mode === 'low_data'
      ? 'Baseline calibration block'
      : mode === 'panre'
        ? 'Maintenance rhythm block'
        : userState.behind
          ? `${targetTopic} catch-up path`
          : `${targetTopic} repair`;

  const today = {
    title: todayTitle,
    subtitle:
      mode === 'low_data'
        ? 'Enough signal to plan safely, without fake personalization.'
        : mode === 'panre'
          ? 'Calm long-horizon maintenance, not test-day urgency.'
          : "Today's highest-yield work is already sequenced.",
    durationMinutes: commandMinutes,
    questionCount,
    reviewCount: reviewCoverage.coveredDanger + reviewCoverage.coveredOverdue,
    expectedLiftRange,
    expectedLiftLabel: expectedLiftRange ? `Expected lift: +${expectedLiftRange[0]} to +${expectedLiftRange[1]} readiness` : 'Expected lift: calibrating',
    reasonChips: [
      reviewCoverage.coverageSource === 'plan_tasks' && reviewCoverage.coveredDanger + reviewCoverage.coveredOverdue > 0
        ? `${reviewCoverage.coveredDanger + reviewCoverage.coveredOverdue} reviews protected`
        : reviewCoverage.danger + reviewCoverage.overdue > 0
          ? 'Review queue visible'
          : 'No review debt',
      userState.overloaded ? 'Short plan active' : mode === 'panre' ? 'Maintenance cadence' : 'Goal-weighted',
      input.todayPlan?.mainSystems?.[0] ? formatTopic(input.todayPlan.mainSystems[0]) : goal.statusLabel,
    ].slice(0, 3),
    primaryCtaLabel: mode === 'low_data' ? 'Start baseline block' : mode === 'panre' ? 'Start maintenance session' : "Start today’s session",
    secondaryLinks: [
      { label: '20-min version', action: 'short' as const },
      { label: 'Full plan', action: 'full_plan' as const },
      { label: 'Why this?', action: 'why' as const },
    ],
    handledSignalIds: [
      reviewCoverage.coverageSource === 'plan_tasks' && reviewCoverage.coveredDanger + reviewCoverage.coveredOverdue > 0 ? 'retention_protection' : '',
      input.todayPlan?.targetedConditions?.length ? 'confusion_pair' : '',
      targetTopic.toLowerCase().includes('pulm') ? 'pulmonary_repair' : '',
    ].filter(Boolean),
    stale: isStale(input.todayPlan?.generatedAt, now),
  };

  const insights = buildInsights(input, goal, userState, reviewCoverage, readiness, targetTopic);
  const planProtocol = buildPlanProtocol(today.title, commandMinutes, today.reviewCount);
  const trustTimeline = buildTrustTimeline(input, targetTopic, reviewCoverage);

  return {
    mode,
    goal,
    userState,
    dataState: {
      loading: Boolean(input.todayPlanLoading || input.dashboardAnalyticsLoading),
      partialFailure: Boolean(input.todayPlanError || input.dashboardAnalyticsError || input.dashboardAnalytics?.warnings.length),
      empty: totalAttempts === 0 && !input.todayPlan,
      staleRecommendation: today.stale,
      warnings: [
        ...(input.todayPlanError ? [input.todayPlanError] : []),
        ...(input.dashboardAnalyticsError ? [input.dashboardAnalyticsError] : []),
        ...(input.dashboardAnalytics?.warnings ?? []),
      ],
    },
    today,
    reviewCoverage,
    readiness,
    insights,
    matrix,
    blueprintHeatmap: buildBlueprintHeatmap(matrix),
    planProtocol,
    trustTimeline,
    raw: {
      performanceData: input.performanceData,
      growthAreas: input.growthAreas,
      dueCount: input.dueCount,
      examLabel: input.examLabel,
      profile: input.profile,
      todayPlan: input.todayPlan,
      todayPlanError: input.todayPlanError ?? null,
      dashboardAnalytics: input.dashboardAnalytics ?? null,
    },
    actions: input.actions ?? {},
  };
}
