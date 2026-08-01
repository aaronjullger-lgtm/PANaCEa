import React from 'react';
import type { DashboardContext } from '../model/DashboardContext';
import type { DashboardWidgetDefinition } from '../model/widgetTypes';
import { scoreWidget } from '../engine/scoreWidget';
import { visualTokenForSignal, type VisualToken } from '../model/visualTokens';
import { GoalContextWidget } from './context/GoalContextWidget';
import { TodayCommandWidget, BaselineCommandWidget, MaintenanceCommandWidget } from './command/TodayCommandWidget';
import { InsightStackWidget } from './evidence/InsightStackWidget';
import { ReviewCoverageWidget } from './protection/ReviewCoverageWidget';
import { ReadinessPulseWidget } from './forecast/ReadinessPulseWidget';
import { ExamHorizonWidget } from './forecast/ExamHorizonWidget';
import { LoadGuardrailWidget } from './recovery/LoadGuardrailWidget';
import { CatchUpPlanWidget } from './recovery/CatchUpPlanWidget';
import { MaintenanceRhythmWidget } from './recovery/MaintenanceRhythmWidget';
import { MasteryUrgencyMatrixWidget } from './triage/MasteryUrgencyMatrixWidget';
import { BlueprintHeatmapWidget } from './triage/BlueprintHeatmapWidget';
import { PlanProtocolStripWidget } from './context/PlanProtocolStripWidget';
import { TrustTimelineWidget } from './trust/TrustTimelineWidget';
import { TargetedConditionsWidget } from './evidence/TargetedConditionsWidget';
import type {
  BlueprintHeatmapData,
  CatchUpPlanData,
  ExamHorizonData,
  GoalContextData,
  InsightStackData,
  LoadGuardrailData,
  MaintenanceRhythmData,
  MasteryUrgencyMatrixData,
  PlanProtocolStripData,
  ReadinessPulseData,
  ReviewCoverageData,
  TodayCommandData,
  TargetedConditionsData,
  TrustTimelineData,
} from './widgetData';

function density(ctx: DashboardContext): VisualToken['density'] {
  return ctx.mode === 'low_data' || ctx.mode === 'overloaded' || ctx.mode === 'panre' || ctx.mode === 'ahead' ? 'quiet' : 'standard';
}

function commandVisual(ctx: DashboardContext): VisualToken {
  if (ctx.mode === 'low_data') return visualTokenForSignal('low_data', 'quiet');
  if (ctx.mode === 'panre' || ctx.mode === 'ahead') return visualTokenForSignal('maintenance', 'quiet');
  if (ctx.today.title.toLowerCase().includes('pulmonary')) return visualTokenForSignal('pulmonary_repair', density(ctx));
  return { ...visualTokenForSignal('confusion_pair', density(ctx)), elevation: 'command' };
}

export const dashboardWidgetRegistry: DashboardWidgetDefinition[] = [
  {
    id: 'goal_context',
    class: 'context',
    allowedSlots: ['goal_context'],
    eligible: () => true,
    score: (ctx) =>
      scoreWidget({
        urgency: ctx.goal.status === 'behind' ? 0.75 : 0.35,
        goalImpact: 0.8,
        actionability: 0.5,
        evidenceQuality: 0.9,
        novelty: 0.4,
        userStateFit: 1,
        anxietyCost: 0.05,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): GoalContextData => ({
      goal: ctx.goal,
      recommendedMinutes: ctx.today.durationMinutes,
      loading: ctx.dataState.loading,
      partialFailure: ctx.dataState.partialFailure,
    }),
    visual: (data, ctx) => {
      if (ctx.mode === 'low_data') return { ...visualTokenForSignal('low_data', 'quiet'), motion: 'none' };
      if (ctx.mode === 'behind') return { ...visualTokenForSignal('readiness_forecast', density(ctx)), tone: 'watch', motion: 'none' };
      return { ...visualTokenForSignal(ctx.mode === 'panre' ? 'maintenance' : 'readiness_forecast', density(ctx)), motion: 'none' };
    },
    component: GoalContextWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: (ctx) => `${ctx.goal.label} and ${ctx.goal.statusLabel.toLowerCase()} status set the dashboard mode.`,
  },
  {
    id: 'today_command',
    class: 'command',
    allowedSlots: ['primary_command'],
    eligible: (ctx) => ctx.mode !== 'low_data' && ctx.mode !== 'panre',
    score: (ctx) =>
      scoreWidget({
        urgency: ctx.mode === 'behind' ? 0.9 : 0.65,
        goalImpact: 1,
        actionability: 1,
        evidenceQuality: ctx.userState.lowData ? 0.4 : 0.82,
        novelty: 0.6,
        userStateFit: 1,
        anxietyCost: ctx.mode === 'behind' ? 0.16 : 0.04,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): TodayCommandData => ({
      ...ctx.today,
      onStart: ctx.actions.onStartToday,
      onStartShort: ctx.actions.onStartShort,
      onOpenFullPlan: ctx.actions.onOpenFullPlan,
      onOpenWhy: ctx.actions.onOpenProgress,
    }),
    visual: (_data, ctx) => commandVisual(ctx),
    component: TodayCommandWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: (ctx) => ctx.today.reasonChips.join(', '),
  },
  {
    id: 'baseline_command',
    class: 'baseline',
    allowedSlots: ['primary_command'],
    eligible: (ctx) => ctx.mode === 'low_data',
    score: () =>
      scoreWidget({
        urgency: 0.5,
        goalImpact: 0.72,
        actionability: 1,
        evidenceQuality: 0.9,
        novelty: 0.9,
        userStateFit: 1,
        anxietyCost: 0.02,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): TodayCommandData => ({
      ...ctx.today,
      onStart: ctx.actions.onStartToday,
      onStartShort: ctx.actions.onStartShort,
      onOpenFullPlan: ctx.actions.onOpenFullPlan,
      onOpenWhy: ctx.actions.onOpenProgress,
    }),
    visual: () => visualTokenForSignal('low_data', 'quiet'),
    component: BaselineCommandWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: (ctx) => `Only ${ctx.raw.performanceData.length} recent questions are available, so the dashboard stays in baseline mode.`,
  },
  {
    id: 'maintenance_command',
    class: 'command',
    allowedSlots: ['primary_command'],
    eligible: (ctx) => ctx.mode === 'panre',
    score: () =>
      scoreWidget({
        urgency: 0.25,
        goalImpact: 0.68,
        actionability: 1,
        evidenceQuality: 0.82,
        novelty: 0.55,
        userStateFit: 1,
        anxietyCost: 0.01,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): TodayCommandData => ({
      ...ctx.today,
      onStart: ctx.actions.onStartToday,
      onStartShort: ctx.actions.onStartShort,
      onOpenFullPlan: ctx.actions.onOpenFullPlan,
      onOpenWhy: ctx.actions.onOpenProgress,
    }),
    visual: () => visualTokenForSignal('maintenance', 'quiet'),
    component: MaintenanceCommandWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'PANRE mode uses long-horizon maintenance cadence instead of PANCE-style urgency.',
  },
  {
    id: 'insight_stack',
    class: 'evidence',
    allowedSlots: ['primary_evidence'],
    eligible: () => true,
    score: (ctx) =>
      scoreWidget({
        urgency: ctx.insights[0]?.urgency ?? 0.25,
        goalImpact: ctx.insights[0]?.goalImpact ?? 0.4,
        actionability: ctx.insights.length ? 0.75 : 0.25,
        evidenceQuality: ctx.insights[0]?.evidenceQuality ?? 0.5,
        novelty: 0.65,
        userStateFit: 1,
        anxietyCost: ctx.insights.some((insight) => insight.actionState === 'needs_action') ? 0.12 : 0.03,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
    }),
    build: (ctx): InsightStackData => ({
      cards: ctx.insights.slice(0, ctx.mode === 'low_data' || ctx.mode === 'overloaded' ? 2 : 3),
      emptyMessage: 'Nothing unusual today. Just do the plan.',
    }),
    visual: (_data, ctx) => ({ ...visualTokenForSignal(ctx.mode === 'low_data' ? 'low_data' : 'readiness_forecast', density(ctx)), motif: 'none', motion: 'none' }),
    component: InsightStackWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: (ctx) => `${ctx.insights.length} insight candidate${ctx.insights.length === 1 ? '' : 's'} survived eligibility, scoring, and suppression.`,
  },
  {
    id: 'targeted_conditions',
    class: 'evidence',
    allowedSlots: ['below_fold_secondary', 'secondary_left', 'secondary_right'],
    eligible: (ctx) => {
      const conditions = ctx.raw.todayPlan?.targetedConditions;
      return Boolean(conditions && conditions.length > 0);
    },
    score: (ctx) => {
      const count = ctx.raw.todayPlan?.targetedConditions?.length ?? 0;
      return scoreWidget({
        urgency: 0.3,
        goalImpact: 0.55,
        actionability: count > 0 ? 0.6 : 0.2,
        evidenceQuality: 0.72,
        novelty: 0.5,
        userStateFit: 0.65,
        anxietyCost: 0.02,
        redundancyPenalty: 0.1,
        alreadyHandledPenalty: 0,
      });
    },
    build: (ctx): TargetedConditionsData => ({
      conditions: (ctx.raw.todayPlan?.targetedConditions ?? []).map((name: string) => ({
        name,
        href: `/library/condition/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}`,
      })),
    }),
    visual: () => visualTokenForSignal('readiness_forecast', 'quiet'),
    component: TargetedConditionsWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'Targeted conditions link to the clinical library for deeper review.',
  },
  {
    id: 'review_coverage',
    class: 'protection',
    allowedSlots: ['secondary_left', 'secondary_right', 'below_fold_secondary'],
    eligible: (ctx) => ctx.mode !== 'low_data' && (ctx.reviewCoverage.danger + ctx.reviewCoverage.overdue > 0 || ctx.mode === 'overloaded' || ctx.mode === 'pance'),
    score: (ctx) =>
      scoreWidget({
        urgency: ctx.reviewCoverage.overdue > 0 ? 0.72 : ctx.reviewCoverage.danger > 0 ? 0.52 : 0.25,
        goalImpact: 0.62,
        actionability: ctx.reviewCoverage.danger + ctx.reviewCoverage.overdue > 0 ? 0.72 : 0.35,
        evidenceQuality: 0.9,
        novelty: 0.5,
        userStateFit: ctx.mode === 'overloaded' ? 0.9 : 0.72,
        anxietyCost: ctx.reviewCoverage.coveredDanger + ctx.reviewCoverage.coveredOverdue > 0 ? 0.03 : 0.18,
        redundancyPenalty: 0.05,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): ReviewCoverageData => ({ ...ctx.reviewCoverage, onOpenReview: ctx.actions.onOpenReview }),
    visual: () => visualTokenForSignal('retention_protection'),
    component: ReviewCoverageWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: (ctx) =>
      ctx.reviewCoverage.coverageSource === 'plan_tasks'
        ? `${ctx.reviewCoverage.coveredDanger + ctx.reviewCoverage.coveredOverdue} higher-risk reviews are covered by today’s plan.`
        : ctx.reviewCoverage.coverageSource === 'unknown'
          ? 'Review load is shown without claiming coverage because due-review condition/card identity is unavailable.'
          : 'Review load is shown without claiming coverage because no matching review task is scheduled in today’s plan.',
  },
  {
    id: 'readiness_pulse',
    class: 'forecast',
    allowedSlots: ['secondary_left', 'secondary_right'],
    eligible: (ctx) => ctx.readiness.available && ctx.mode !== 'low_data' && ctx.mode !== 'overloaded',
    score: (ctx) =>
      scoreWidget({
        urgency: ctx.readiness.status === 'behind' ? 0.62 : 0.28,
        goalImpact: 0.56,
        actionability: 0.42,
        evidenceQuality: ctx.readiness.confidence === 'high' ? 0.86 : 0.66,
        novelty: 0.45,
        userStateFit: ctx.mode === 'panre' ? 0.5 : 0.72,
        anxietyCost: 0.06,
        redundancyPenalty: 0.12,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): ReadinessPulseData => ({ ...ctx.readiness, onOpenProgress: ctx.actions.onOpenProgress }),
    visual: () => visualTokenForSignal('readiness_forecast'),
    component: ReadinessPulseWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: (ctx) => `Forecast is shown as a ${ctx.readiness.confidence}-confidence band, not a precise score.`,
  },
  {
    id: 'exam_horizon',
    class: 'forecast',
    allowedSlots: ['secondary_left', 'secondary_right'],
    eligible: (ctx) => ctx.goal.daysToTarget != null && ctx.goal.daysToTarget <= 30 && ctx.mode !== 'low_data' && ctx.mode !== 'panre',
    score: (ctx) =>
      scoreWidget({
        urgency: ctx.goal.daysToTarget == null ? 0 : Math.max(0.2, (30 - ctx.goal.daysToTarget) / 30),
        goalImpact: 0.66,
        actionability: 0.72,
        evidenceQuality: 0.88,
        novelty: 0.6,
        userStateFit: ctx.mode === 'eor' || ctx.mode === 'didactic' ? 0.95 : 0.7,
        anxietyCost: ctx.goal.daysToTarget != null && ctx.goal.daysToTarget <= 7 ? 0.18 : 0.08,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): ExamHorizonData => ({
      label: ctx.goal.label,
      daysToTarget: ctx.goal.daysToTarget ?? 0,
      statusLabel: ctx.goal.statusLabel,
    }),
    visual: (_data, ctx) =>
      ctx.goal.daysToTarget != null && ctx.goal.daysToTarget <= 3 && ctx.mode === 'behind'
        ? { ...visualTokenForSignal('readiness_forecast'), tone: 'critical', motion: 'none' }
        : { ...visualTokenForSignal('readiness_forecast'), motion: 'none' },
    component: ExamHorizonWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: (ctx) => `${ctx.goal.label} has ${ctx.goal.targetLabel.toLowerCase()} remaining.`,
  },
  {
    id: 'load_guardrail',
    class: 'recovery',
    allowedSlots: ['secondary_left', 'secondary_right'],
    eligible: (ctx) => ctx.userState.overloaded || ctx.mode === 'eor',
    score: (ctx) =>
      scoreWidget({
        urgency: ctx.userState.overloaded ? 0.7 : 0.38,
        goalImpact: 0.5,
        actionability: 0.88,
        evidenceQuality: 0.72,
        novelty: 0.62,
        userStateFit: ctx.userState.overloaded ? 1 : 0.58,
        anxietyCost: 0.01,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): LoadGuardrailData => ({
      title: ctx.userState.overloaded ? 'Minimum useful plan' : 'Clinical-load guardrail',
      detail: ctx.userState.overloaded
        ? 'The dashboard is quieter and today’s plan is shorter to protect accuracy.'
        : 'If the rotation day runs long, use the shorter session rather than opening broader analytics.',
      loadIndex: ctx.userState.loadIndex,
    }),
    visual: () => visualTokenForSignal('load_guardrail', 'quiet'),
    component: LoadGuardrailWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'Load signals are translated into a shorter plan without narrating private behavior.',
  },
  {
    id: 'catch_up_plan',
    class: 'recovery',
    allowedSlots: ['secondary_left', 'secondary_right'],
    eligible: (ctx) => ctx.mode === 'behind',
    score: () =>
      scoreWidget({
        urgency: 0.8,
        goalImpact: 0.78,
        actionability: 0.9,
        evidenceQuality: 0.72,
        novelty: 0.65,
        userStateFit: 1,
        anxietyCost: 0.1,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (): CatchUpPlanData => ({
      title: 'Smallest useful recovery path',
      detail: 'Add one short focused block rather than trying to make up everything today.',
      minutesPerDay: 20,
      days: 10,
    }),
    visual: () => visualTokenForSignal('load_guardrail'),
    component: CatchUpPlanWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'Behind mode frames recovery as a small repeatable action instead of failure.',
  },
  {
    id: 'maintenance_rhythm',
    class: 'recovery',
    allowedSlots: ['secondary_left', 'secondary_right'],
    eligible: (ctx) => ctx.mode === 'panre' || ctx.mode === 'ahead',
    score: () =>
      scoreWidget({
        urgency: 0.2,
        goalImpact: 0.58,
        actionability: 0.7,
        evidenceQuality: 0.74,
        novelty: 0.55,
        userStateFit: 1,
        anxietyCost: 0,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): MaintenanceRhythmData => ({
      title: ctx.mode === 'panre' ? 'Knowledge freshness rhythm' : 'Ahead-of-schedule maintenance',
      detail: ctx.mode === 'panre'
        ? 'The plan stays calm and cadence-based unless a true deadline approaches.'
        : 'Keep strong areas fresh while stretching into adjacent topics.',
      cadenceLabel: ctx.mode === 'panre' ? '2 short blocks / week' : '1 maintenance block today',
    }),
    visual: () => visualTokenForSignal('maintenance', 'quiet'),
    component: MaintenanceRhythmWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'Maintenance mode suppresses high-stakes urgency and keeps long-horizon pacing visible.',
  },
  {
    id: 'mastery_urgency_matrix',
    class: 'triage',
    allowedSlots: ['below_fold_primary'],
    eligible: (ctx) => ctx.mode !== 'low_data' && ctx.matrix.length > 0,
    score: () =>
      scoreWidget({
        urgency: 0.42,
        goalImpact: 0.72,
        actionability: 0.62,
        evidenceQuality: 0.72,
        novelty: 0.5,
        userStateFit: 0.7,
        anxietyCost: 0.08,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): MasteryUrgencyMatrixData => ({ items: ctx.matrix }),
    visual: () => visualTokenForSignal('readiness_forecast'),
    component: MasteryUrgencyMatrixWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'Below-fold triage uses urgency, mastery, trend, and exam weighting.',
  },
  {
    id: 'plan_protocol_strip',
    class: 'context',
    allowedSlots: ['below_fold_secondary'],
    eligible: (ctx) => ctx.mode !== 'low_data',
    score: () =>
      scoreWidget({
        urgency: 0.25,
        goalImpact: 0.55,
        actionability: 0.52,
        evidenceQuality: 0.76,
        novelty: 0.45,
        userStateFit: 0.65,
        anxietyCost: 0.02,
        redundancyPenalty: 0.1,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): PlanProtocolStripData => ({ steps: ctx.planProtocol }),
    visual: () => visualTokenForSignal('maintenance'),
    component: PlanProtocolStripWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'The protocol strip explains the session sequence below the fold.',
  },
  {
    id: 'blueprint_heatmap',
    class: 'triage',
    allowedSlots: ['below_fold_secondary', 'progress_tab_only'],
    eligible: (ctx) => ctx.mode !== 'low_data' && ctx.blueprintHeatmap.length > 0,
    score: () =>
      scoreWidget({
        urgency: 0.2,
        goalImpact: 0.5,
        actionability: 0.35,
        evidenceQuality: 0.68,
        novelty: 0.35,
        userStateFit: 0.52,
        anxietyCost: 0.08,
        redundancyPenalty: 0.25,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): BlueprintHeatmapData => ({ cells: ctx.blueprintHeatmap }),
    visual: () => visualTokenForSignal('readiness_forecast', 'quiet'),
    component: BlueprintHeatmapWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    cadence: { maxShowsPerWeek: 4 },
    attribution: () => 'System overview is below fold so it does not become the main dashboard.',
  },
  {
    id: 'trust_timeline',
    class: 'trust',
    allowedSlots: ['below_fold_secondary'],
    eligible: (ctx) => ctx.trustTimeline.length > 0,
    score: () =>
      scoreWidget({
        urgency: 0.18,
        goalImpact: 0.5,
        actionability: 0.25,
        evidenceQuality: 0.8,
        novelty: 0.45,
        userStateFit: 0.75,
        anxietyCost: 0,
        redundancyPenalty: 0,
        alreadyHandledPenalty: 0,
      }),
    build: (ctx): TrustTimelineData => ({ events: ctx.trustTimeline }),
    visual: () => visualTokenForSignal('clinical_trust'),
    component: TrustTimelineWidget as React.ComponentType<{ data: unknown; visual: VisualToken }>,
    attribution: () => 'Trust timeline explains plan changes without adding above-fold clutter.',
  },
];
