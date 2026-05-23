import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BrainCircuit,
  Clock3,
  Dumbbell,
  FileQuestion,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/loading';
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
import { useDashboardAnalytics } from '@/hooks/useDashboardAnalytics';
import { ROUTES } from '@/config/routes';
import { buildMainSessionLaunchPath } from '@/lib/study/mainSessionLaunch';
import { workspaceAccent } from '@/lib/tokens';
import type { SessionSettings } from '@/types';
import type { DashboardUpcomingReviewSummary } from '@/lib/dashboard/realStudyAnalytics';

const reviewLaunchSettings: SessionSettings = {
  mode: 'review',
  focus: 'review',
  topic: 'Due review queue',
  count: 8,
  questionCount: 8,
};

function formatDueLabel(review: DashboardUpcomingReviewSummary): string {
  if (review.overdueDays > 0) {
    return `${review.overdueDays}d overdue`;
  }

  const due = new Date(review.dueAt);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const dueDay = due.toDateString();
  const timeLabel = due.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (dueDay === today.toDateString()) return `Today, ${timeLabel}`;
  if (dueDay === tomorrow.toDateString()) return `Tomorrow, ${timeLabel}`;

  return due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatPercent(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

export const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useDashboardAnalytics();

  const reviewQueue = clinicalConsoleDemoData.reviewQueue;
  const reviewLaunchPath = useMemo(
    () => buildMainSessionLaunchPath(reviewLaunchSettings, { source: 'review-workspace' }),
    [],
  );

  const isGuest = !isSignedIn;
  const hasLiveData =
    isSignedIn &&
    !isAnalyticsLoading &&
    !analyticsError &&
    analytics?.fsrs != null &&
    (analytics.fsrs.reviewCount > 0 || analytics.fsrs.upcomingReviews.length > 0);

  // ── Loading state (signed in, still fetching) ──
  if (isSignedIn && isAnalyticsLoading) {
    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Review Workspace',
              badgeTone: 'steel',
              title: 'Review queue and memory triage',
              subtitle:
                'Pulling your live FSRS review queue, overdue counts, and scheduled cards.',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceSurface accent={workspaceAccent.steel}>
            <div
              className="flex min-h-[18rem] flex-col items-center justify-center gap-4 text-center"
              role="status"
              aria-live="polite"
            >
              <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Loading your review queue…
              </p>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  // ── Error state (signed in, fetch failed) ──
  if (isSignedIn && analyticsError && !analytics) {
    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Review Workspace',
              badgeTone: 'steel',
              title: 'Review queue is temporarily unavailable.',
              subtitle:
                'Your session is active but the analytics service did not respond. Guest-safe demo data is shown below.',
              status: 'Data unavailable',
              actionPosition: 'under-title',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
              primaryAction: {
                label: 'Retry review data',
                onClick: () => refetchAnalytics(),
                icon: RefreshCw,
              },
              secondaryActions: [
                {
                  label: 'Open Progress',
                  onClick: () => navigate(ROUTES.PROGRESS),
                  icon: TrendingUp,
                  variant: 'outline',
                },
              ],
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.06}>
          <WorkspaceSurface accent={workspaceAccent.rose} role="alert">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {analyticsError}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  The demo queue below reflects representative workload. Retry or open Progress for
                  the full analytics workspace.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => refetchAnalytics()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
        {/* Fall through to demo section below */}
      </WorkspacePage>
    );
  }

  // ── Live data branch ──
  if (hasLiveData && analytics) {
    const fsrs = analytics.fsrs;
    const upcomingSlice = fsrs.upcomingReviews.slice(0, 6);

    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Review Workspace',
              badgeTone: 'steel',
              title: 'Review queue and memory triage',
              subtitle:
                'Due flashcards, missed concepts, and weak topics from your live FSRS schedule, ranked for the next study session.',
              status:
                fsrs.overdueCount > 0
                  ? `${fsrs.overdueCount} overdue · ${fsrs.dueTodayCount} due today`
                  : `${fsrs.dueTodayCount} due today`,
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
                  <span>Live schedule</span>
                  <span aria-hidden="true">/</span>
                  <span>Next action</span>
                </div>
                <div className="space-y-3">
                  <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-3xl">
                    {fsrs.overdueCount > 0
                      ? 'Clear the memory backlog before adding more new material.'
                      : 'Your review queue is current — stay ahead of the forgetting curve.'}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                    {fsrs.overdueCount > 0
                      ? `${fsrs.overdueCount} overdue review${fsrs.overdueCount === 1 ? '' : 's'} and ${fsrs.dueTodayCount} due today from your live FSRS schedule.`
                      : `${fsrs.dueTodayCount} review${fsrs.dueTodayCount === 1 ? '' : 's'} due today with ${analytics.overview.dueToday} total active in the queue.`}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_74%,transparent)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                      Readiness
                    </p>
                    <p className="mt-2 text-lg font-semibold leading-7 text-[var(--color-text-primary)]">
                      {fsrs.retentionPercent != null
                        ? `${fsrs.retentionPercent}% retention`
                        : 'Calibrating'}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                    <BrainCircuit
                      className="h-5 w-5 text-[var(--color-accent)]"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--color-bg-primary)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700"
                    style={{
                      width: `${Math.min(100, ((fsrs.correctCount || 0) / Math.max(1, fsrs.reviewCount)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </WorkspaceHeroStrip>
        </WorkspaceReveal>

        <WorkspaceReveal delay={0.08}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WorkspaceMetricCard
              label="Due today"
              value={analytics.overview.dueToday}
              detail={
                fsrs.overdueCount > 0
                  ? `${fsrs.overdueCount} overdue — clear these first.`
                  : `${analytics.overview.totalActiveReviews} active scheduled reviews`
              }
              icon={Clock3}
              accent={workspaceAccent.gold}
            />
            <WorkspaceMetricCard
              label="Retention"
              value={formatPercent(fsrs.retentionPercent)}
              detail={`${fsrs.correctCount}/${fsrs.reviewCount} correct in reporting window`}
              icon={TrendingUp}
              accent={workspaceAccent.sage}
            />
            <WorkspaceMetricCard
              label="Stability"
              value={fsrs.averageStability != null ? fsrs.averageStability.toFixed(1) : '—'}
              detail="Average days before memory decay"
              icon={FileQuestion}
              accent={workspaceAccent.steel}
            />
            <WorkspaceMetricCard
              label="Difficulty"
              value={
                fsrs.averageDifficulty != null ? fsrs.averageDifficulty.toFixed(1) : '—'
              }
              detail="Current FSRS difficulty across the queue"
              icon={Target}
              accent={workspaceAccent.rose}
            />
          </div>
        </WorkspaceReveal>

        <WorkspaceSplit>
          <WorkspaceReveal delay={0.12}>
            <WorkspaceSection
              title="Upcoming reviews"
              subtitle="Ordered by due urgency so the most overdue cards come first."
            >
              <WorkspaceSurface accent={workspaceAccent.steel}>
                {upcomingSlice.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingSlice.map((review) => (
                      <div
                        key={`${review.source}-${review.id}`}
                        className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--color-text-primary)]">
                            {review.targetLabel}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                            {review.sourceLabel}
                            {review.progressContext ? ` · ${review.progressContext}` : ''}
                          </p>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
                          {formatDueLabel(review)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <WorkspaceEmptyState
                    icon={Clock3}
                    title="No upcoming reviews in this horizon"
                    description="New due cards appear here after completing study sessions and drill reviews."
                  />
                )}
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
                    <li
                      key={guardrail}
                      className="flex gap-3 text-sm leading-6 text-[var(--color-text-secondary)]"
                    >
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

            {analytics.warnings.length > 0 ? (
              <WorkspaceSurface
                accent={workspaceAccent.amber}
                className="mt-6"
                role="alert"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Some secondary signals are unavailable: {analytics.warnings[0]}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => refetchAnalytics()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </WorkspaceSurface>
            ) : null}
          </WorkspaceReveal>
        </WorkspaceSplit>
      </WorkspacePage>
    );
  }

  // ── No-data-yet state (signed in, loaded, but no reviews) ──
  if (isSignedIn && !hasLiveData && !isAnalyticsLoading && !analyticsError) {
    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Review Workspace',
              badgeTone: 'steel',
              title: 'No review data yet — complete a study session first.',
              subtitle:
                'Your FSRS review queue builds automatically when you answer questions in study or drill sessions. Guest-safe demo data is shown below as a preview.',
              status: 'Queue empty',
              actionPosition: 'under-title',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
              primaryAction: {
                label: 'Start a session',
                onClick: () => navigate(ROUTES.STUDY),
              },
              secondaryActions: [
                {
                  label: 'Open Practice',
                  onClick: () => navigate(ROUTES.PRACTICE),
                  icon: Dumbbell,
                  variant: 'outline',
                },
              ],
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.06}>
          <WorkspaceEmptyState
            icon={Archive}
            title="Your review queue is empty"
            description="Once you complete study sessions with real question attempts, due cards and spaced-repetition follow-ups will populate this workspace."
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => navigate(ROUTES.PRACTICE)}
              >
                Start practicing
              </Button>
            }
            accent={workspaceAccent.sage}
          />
        </WorkspaceReveal>
        {/* Demo preview below the empty state so the page is never blank */}
        <WorkspaceReveal delay={0.1}>
          <WorkspaceSection
            title="Demo review mix (representative preview)"
            subtitle="What the live queue looks like once you have real study history."
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
      </WorkspacePage>
    );
  }

  // ── Guest / demo fallback ──
  return (
    <WorkspacePage density="wide" mode="analytics">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Review Workspace',
            badgeTone: 'steel',
            title: 'Review queue and memory triage',
            subtitle:
              'A focused FSRS launch surface for due flashcards, missed concepts, and weak topics. Sign in to see your live queue.',
            status: 'Guest-safe preview',
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
                  The live queue fills after authenticated review events. Guest mode keeps this page
                  readable with representative workload data so the navigation surface can be
                  verified without signing in.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_74%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    Demo preview
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
            title="Sign in to see your live review queue"
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
