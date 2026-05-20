import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BrainCircuit,
  Clock3,
  Dumbbell,
  FileQuestion,
  ListChecks,
  RotateCcw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WorkspaceEmptyState,
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { clinicalConsoleDemoData } from '@/components/clinical-console/studyDemoData';
import { ROUTES } from '@/config/routes';
import { buildMainSessionLaunchPath } from '@/lib/study/mainSessionLaunch';
import { workspaceAccent } from '@/lib/tokens';
import type { SessionSettings } from '@/types';

const reviewLaunchSettings: SessionSettings = {
  mode: 'review',
  focus: 'review',
  topic: 'Due review queue',
  count: 8,
  questionCount: 8,
};

export const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const reviewQueue = clinicalConsoleDemoData.reviewQueue;
  const reviewLaunchPath = useMemo(
    () => buildMainSessionLaunchPath(reviewLaunchSettings, { source: 'review-workspace' }),
    []
  );

  return (
    <WorkspacePage density="wide" mode="analytics">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Review Workspace',
            badgeTone: 'steel',
            title: 'Review queue and memory triage',
            subtitle:
              'A focused FSRS launch surface for due flashcards, missed concepts, and weak topics before the next question block.',
            status: `${reviewQueue.flashcardsDue} due in demo queue`,
            actionPosition: 'under-title',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
            primaryAction: {
              label: 'Start review queue',
              onClick: () => navigate(reviewLaunchPath),
              icon: ListChecks,
            },
            secondaryActions: [
              {
                label: 'Practice missed questions',
                onClick: () => navigate(ROUTES.PRACTICE),
                icon: Dumbbell,
                variant: 'outline',
              },
            ],
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <WorkspaceHeroStrip tone="analytics" className="overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <span>FSRS queue</span>
                <span aria-hidden="true">/</span>
                <span>Weak-area targeting</span>
                <span aria-hidden="true">/</span>
                <span>Next action</span>
              </div>
              <div className="space-y-3">
                <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-3xl">
                  Clear the memory backlog before adding more new material.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                  The live queue fills after authenticated review events. Guest QA keeps this page
                  readable with representative workload data so the navigation surface can be
                  verified without Clerk second-factor login.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_74%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    Next focus
                  </p>
                  <p className="mt-2 text-lg font-semibold leading-7 text-[var(--color-text-primary)]">
                    {reviewQueue.nextFocus}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                  <BrainCircuit className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
                <div className="h-full w-[68%] rounded-full bg-[var(--color-accent)]" />
              </div>
            </div>
          </div>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Flashcards due"
            value={reviewQueue.flashcardsDue}
            detail={reviewQueue.queueWindow}
            icon={Clock3}
            accent={workspaceAccent.gold}
          />
          <WorkspaceMetricCard
            label="Retention"
            value={reviewQueue.retention}
            detail="Memory stability across the current queue"
            icon={TrendingUp}
            accent={workspaceAccent.sage}
          />
          <WorkspaceMetricCard
            label="Question accuracy"
            value={reviewQueue.questionAccuracy}
            detail="Recent misses inform the review mix"
            icon={FileQuestion}
            accent={workspaceAccent.steel}
          />
          <WorkspaceMetricCard
            label="Weak topics"
            value={reviewQueue.weakTopicCount}
            detail="Ranked by recurrence and exam weight"
            icon={Target}
            accent={workspaceAccent.rose}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceSplit>
        <WorkspaceReveal delay={0.12}>
          <WorkspaceSection
            title="Today's review mix"
            subtitle="Ordered by likely yield and recent error recurrence."
          >
            <WorkspaceSurface accent={workspaceAccent.steel}>
              <div className="space-y-3">
                {reviewQueue.reviewMix.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text-primary)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {item.detail}
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
                      {item.count} items
                    </span>
                  </div>
                ))}
              </div>
            </WorkspaceSurface>
          </WorkspaceSection>
        </WorkspaceReveal>

        <WorkspaceReveal delay={0.16}>
          <WorkspaceSection
            title="Queue guardrails"
            subtitle="Rules for keeping review useful instead of busywork."
          >
            <WorkspaceSurface accent={workspaceAccent.plum} role="reference">
              <ul className="space-y-3">
                {reviewQueue.guardrails.map((guardrail) => (
                  <li key={guardrail} className="flex gap-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    <RotateCcw
                      className="mt-1 h-4 w-4 shrink-0 text-[var(--color-accent)]"
                      aria-hidden="true"
                    />
                    <span>{guardrail}</span>
                  </li>
                ))}
              </ul>
            </WorkspaceSurface>
          </WorkspaceSection>

          <WorkspaceEmptyState
            className="mt-6"
            icon={Archive}
            title="Live review data appears after sign-in"
            description="Authenticated FSRS events populate the real due queue, overdue counts, and card-level history. The guest view remains stable for visual QA."
            action={
              <Button type="button" variant="outline" onClick={() => navigate(ROUTES.PROGRESS)}>
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                Open progress analytics
              </Button>
            }
            accent={workspaceAccent.sage}
          />
        </WorkspaceReveal>
      </WorkspaceSplit>
    </WorkspacePage>
  );
};

export default ReviewPage;
