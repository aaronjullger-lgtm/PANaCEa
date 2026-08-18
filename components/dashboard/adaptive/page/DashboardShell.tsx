import React, { Suspense, useCallback, useState } from 'react';
import { MedicalGridBackground } from '@/components/studypanacea';
import type { DashboardViewModel } from '../model/DashboardViewModel';
import type { AITutorDrawerContext } from '../widgets/command-center/AITutorDrawer';
import { ReadinessVitalsWidget } from '../widgets/command-center/ReadinessVitalsWidget';
import { TodayStudyPrescriptionWidget } from '../widgets/command-center/TodayStudyPrescriptionWidget';
import { WhyThisDrawer } from '../widgets/trust/WhyThisDrawer';
import { DashboardSlot } from './DashboardSlot';
import { LearnerAgentPanel } from '@/components/learnerAgent/LearnerAgentPanel';
import { isLearnerAgentEnabled } from '@/hooks/useLearnerAgent';
import {
  AdaptiveSignalStack,
  DashboardCommandBrief,
  DashboardTopBar,
  DeferredDashboardWidget,
  MobileDashboardNav,
  RightInsightRail,
  formatLabel,
} from './DashboardShellSections';
import type {
  ClinicalLabCase,
  QuestionReviewRow,
} from './commandCenterMockData';

const LazyAITutorDrawer = React.lazy(() =>
  import('../widgets/command-center/AITutorDrawer').then((module) => ({
    default: module.AITutorDrawer,
  }))
);
const LazyOrganSystemHeatmapWidget = React.lazy(() =>
  import('../widgets/command-center/OrganSystemHeatmapWidget').then((module) => ({
    default: module.OrganSystemHeatmapWidget,
  }))
);
const LazyPanceReadinessTimelineWidget = React.lazy(() =>
  import('../widgets/command-center/PanceReadinessTimelineWidget').then((module) => ({
    default: module.PanceReadinessTimelineWidget,
  }))
);
const LazyClinicalImageLabWidget = React.lazy(() =>
  import('../widgets/command-center/ClinicalImageLabWidget').then((module) => ({
    default: module.ClinicalImageLabWidget,
  }))
);
const LazyQuestionReviewTableWidget = React.lazy(() =>
  import('../widgets/command-center/QuestionReviewTableWidget').then((module) => ({
    default: module.QuestionReviewTableWidget,
  }))
);

export function DashboardShell({ viewModel }: { viewModel: DashboardViewModel }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorContext, setTutorContext] = useState<AITutorDrawerContext | null>(null);
  const openWhy = useCallback(() => setWhyOpen(true), []);
  const closeWhy = useCallback(() => setWhyOpen(false), []);
  const slots = viewModel.slots;
  const context = viewModel.context;
  const partialMessage = context.dataState.partialFailure
    ? context.dataState.warnings[0] ?? "Some analytics are temporarily unavailable; today's plan still works."
    : null;
  const topSystem = formatLabel(context.matrix[0]?.label ?? context.raw.growthAreas[0]);

  const openTutor = useCallback((nextContext?: AITutorDrawerContext) => {
    setTutorContext(
      nextContext ?? {
        source: 'dashboard',
        topic: context.today.title,
        system: topSystem,
        summary: `Dashboard readiness context: ${context.readiness.summary || context.goal.statusLabel}.`,
        chips: context.today.reasonChips.slice(0, 3),
      },
    );
    setTutorOpen(true);
  }, [
    context.goal.statusLabel,
    context.readiness.summary,
    context.today.reasonChips,
    context.today.title,
    topSystem,
  ]);

  const openStudyPrescriptionTutor = useCallback(() => {
    openTutor({
      source: 'study_prescription',
      topic: context.today.title,
      system: topSystem,
      summary: `${context.today.subtitle} ${context.today.expectedLiftLabel}`,
      chips: [
        `${context.today.durationMinutes} min`,
        `${context.today.questionCount} questions`,
        `${context.today.reviewCount} reviews`,
      ],
      isMock: context.raw.todayPlan == null,
    });
  }, [
    context.raw.todayPlan,
    context.today.durationMinutes,
    context.today.expectedLiftLabel,
    context.today.questionCount,
    context.today.reviewCount,
    context.today.subtitle,
    context.today.title,
    openTutor,
    topSystem,
  ]);

  const openQuestionTutor = useCallback((row: QuestionReviewRow) => {
    openTutor({
      source: 'question_review',
      topic: row.topic,
      system: row.system,
      result: row.result === 'needs_review' ? 'Needs review' : formatLabel(row.result),
      summary: row.reason,
      chips: [row.difficulty, row.confidenceLabel, row.nextAction],
      isMock: row.source === 'mock',
    });
  }, [openTutor]);

  const openClinicalImageTutor = useCallback((caseItem: ClinicalLabCase) => {
    openTutor({
      source: 'clinical_image',
      topic: `${caseItem.type} reasoning drill`,
      system: caseItem.system,
      result: caseItem.status === 'needs_review' ? 'Needs review' : formatLabel(caseItem.status),
      summary: caseItem.learningObjective,
      chips: [caseItem.difficulty, caseItem.markerLabel, caseItem.accuracyTrend],
      isMock: caseItem.source === 'mock',
    });
  }, [openTutor]);

  return (
    <div className="theme-diagnostic-atlas relative isolate -mx-4 -my-4 min-h-[calc(100vh-var(--header-height,4rem))] overflow-hidden px-3 pb-12 pt-4 text-atlas-white sm:-mx-6 sm:px-5 lg:-mx-8 lg:px-6">
      <MedicalGridBackground />
      <div className="sr-only" aria-live="polite">
        Dashboard ready. Primary action is {context.today.primaryCtaLabel}.
      </div>

      <div className="mx-auto max-w-[96rem] space-y-4">
        <MobileDashboardNav onOpenSettings={context.actions.onOpenSettings} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-6" aria-label="StudyPanacea command center">
            <DashboardTopBar context={context} onOpenTutor={() => openTutor()} />

            {partialMessage ? (
              <section
                className="rounded-2xl border border-[color-mix(in_srgb,var(--atlas-warning-amber)_40%,transparent)] bg-[color-mix(in_srgb,var(--atlas-warning-amber)_10%,transparent)] px-4 py-3 text-sm text-atlas-warning"
                role="status"
              >
                <div className="flex items-center justify-between gap-3">
                  <p>{partialMessage}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex-shrink-0 rounded-lg bg-[color-mix(in_srgb,var(--atlas-warning-amber)_20%,transparent)] px-3 py-1.5 text-xs font-medium text-atlas-warning hover:bg-[color-mix(in_srgb,var(--atlas-warning-amber)_30%,transparent)] transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </section>
            ) : null}

            <DashboardSlot widgets={slots.goal_context} />
            {isLearnerAgentEnabled() ? <LearnerAgentPanel /> : null}
            <DashboardCommandBrief context={context} />
            <div className="grid gap-6 2xl:grid-cols-[minmax(24rem,0.92fr)_minmax(0,1.08fr)] 2xl:items-start">
              <TodayStudyPrescriptionWidget
                context={context}
                loading={context.dataState.loading}
                onOpenTutor={openStudyPrescriptionTutor}
                onOpenWhy={openWhy}
              />
              <ReadinessVitalsWidget context={context} loading={context.dataState.loading} />
            </div>
            <DeferredDashboardWidget
              titleId="organ-heatmap-title"
              title="Organ System Heatmap"
              description="Major PANCE systems ranked by mastery, urgency, and blueprint weight."
              minHeightClass="min-h-[28rem]"
            >
              <LazyOrganSystemHeatmapWidget
                context={context}
                loading={context.dataState.loading}
              />
            </DeferredDashboardWidget>
            <DeferredDashboardWidget
              titleId="readiness-timeline-title"
              title="PANCE Readiness Timeline"
              description="Readiness, accuracy, and retention are shown as directional signals."
              minHeightClass="min-h-[30rem]"
            >
              <LazyPanceReadinessTimelineWidget
                context={context}
                loading={context.dataState.loading}
              />
            </DeferredDashboardWidget>
            <DeferredDashboardWidget
              titleId="clinical-image-lab-title"
              title="Clinical Image Lab"
              description="Synthetic image-training cases for structured visual reasoning."
              minHeightClass="min-h-[32rem]"
            >
              <LazyClinicalImageLabWidget
                loading={context.dataState.loading}
                onOpenTutor={openClinicalImageTutor}
              />
            </DeferredDashboardWidget>
            <DeferredDashboardWidget
              titleId="question-review-title"
              title="Question Review Table"
              description="Missed, flagged, and review-ready items ranked by learning value."
              minHeightClass="min-h-[32rem]"
            >
              <LazyQuestionReviewTableWidget
                context={context}
                loading={context.dataState.loading}
                onOpenTutor={openQuestionTutor}
              />
            </DeferredDashboardWidget>
            <AdaptiveSignalStack slots={slots} />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={openWhy}
                className="atlas-focus-ring rounded-lg px-3 py-2 text-sm font-medium text-atlas-muted hover:bg-atlas-glass hover:text-atlas-white"
              >
                Why these widgets?
              </button>
            </div>
          </section>

          <RightInsightRail
            slots={slots}
            context={context}
            onOpenTutor={() => openTutor({
              source: 'insight_rail',
              topic: 'current weak-area pattern',
              system: topSystem,
              summary: context.insights[0]?.explanation ?? context.readiness.summary,
              chips: context.insights.slice(0, 2).map((insight) => insight.title),
            })}
          />
        </div>
      </div>

      <WhyThisDrawer open={whyOpen} onClose={closeWhy} widgets={viewModel.selectedWidgets} />
      {tutorOpen ? (
        <Suspense fallback={null}>
          <LazyAITutorDrawer
            open={tutorOpen}
            onOpenChange={setTutorOpen}
            context={context}
            tutorContext={tutorContext}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
