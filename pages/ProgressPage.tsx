import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarClock,
  Clock3,
  History,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/loading';
import {
  WorkspaceEmptyState,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { HighContrastDataToggle } from '@/components/ui/HighContrastDataToggle';
import PerformanceTrendChart from '@/components/analytics/PerformanceTrendChart';
import ConditionPerformancePanel from '@/components/analytics/ConditionPerformancePanel';
import { BlueprintGapHeatmap } from '@/components/dashboard/BlueprintGapHeatmap';
import { ConfusionPairCard } from '@/components/dashboard/ConfusionPairCard';
import { ReviewCalendar } from '@/components/dashboard/ReviewCalendar';
import { ROUTES } from '@/config/routes';
import { useDashboardAnalytics } from '@/hooks/useDashboardAnalytics';
import type { PerformanceRecord } from '@/types';

const StudyHeatmap = React.lazy(() => import('@/components/charts/StudyHeatmap'));

interface ProgressPageProps {
  performanceData?: PerformanceRecord[];
  dueCount?: number;
}

function DashboardSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`workspace-subsurface rounded-[1.25rem] p-5 ${height}`}>
      <SkeletonLoader className="h-full w-full" />
    </div>
  );
}

function formatDelta(delta: number | null): string {
  if (delta == null) return 'Not enough prior data';
  if (delta === 0) return 'No change vs prior week';
  return `${delta > 0 ? '+' : ''}${delta} pts vs prior week`;
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatGap(gapPercent: number | null): string {
  if (gapPercent == null) return 'Coverage neutral';
  if (gapPercent >= 0) return `${gapPercent.toFixed(1)}% above blueprint`;
  return `${Math.abs(gapPercent).toFixed(1)}% below blueprint`;
}

export const ProgressPage: React.FC<ProgressPageProps> = ({
  performanceData: _performanceData,
  dueCount: _dueCount,
}) => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useDashboardAnalytics();

  if (isLoading && !data) {
    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <DashboardSkeleton height="h-40" />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.04}>
          <DashboardSkeleton />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.08}>
          <DashboardSkeleton height="h-96" />
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  if (error && !data) {
    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <WorkspaceSurface accent="#9a7f9a">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 text-[var(--color-data-fail)]" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Analytics are unavailable right now.
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
                </div>
              </div>
              <div>
                <Button type="button" onClick={() => refetch()}>
                  Retry analytics
                </Button>
              </div>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  const analytics = data;
  if (!analytics) return null;

  if (!analytics.hasMeaningfulData) {
    return (
      <WorkspacePage density="wide" mode="analytics">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Analytics Workspace',
              badgeTone: 'steel',
              title: 'Your study analytics will become useful once there is real history to analyze.',
              subtitle:
                'This page only shows summaries when they are backed by actual sessions, attempts, and review history.',
              actionPosition: 'under-title',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.06}>
          <WorkspaceEmptyState
            icon={BarChart3}
            title="No study history yet"
            description="Complete a real study session and this page will start showing volume, trends, weaknesses, review load, and session history."
            action={
              <Button type="button" onClick={() => navigate(ROUTES.STUDY)}>
                Start studying
              </Button>
            }
          />
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  const hasWeakSystems = analytics.weakSystems.length > 0;
  const hasSessions = analytics.recentSessions.length > 0;
  const hasConditionData = analytics.conditionStats.length > 0;
  const showBlueprint = analytics.blueprintGaps && analytics.blueprintGaps.totalAttempts > 0;
  const showConfusions = analytics.confusionPairs.length > 0;

  return (
    <WorkspacePage density="wide" mode="analytics">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Analytics Workspace',
            badgeTone: 'steel',
            title: 'Useful study signals, grounded in your actual work.',
            subtitle:
              'This page stays focused on what you have done, where performance is drifting, and what needs attention next.',
            status:
              analytics.overview.overdueReviews > 0
                ? `${analytics.overview.overdueReviews} overdue review${analytics.overview.overdueReviews === 1 ? '' : 's'}`
                : analytics.overview.dueToday > 0
                  ? `${analytics.overview.dueToday} due today`
                  : 'No review backlog right now',
            actionPosition: 'under-title',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
            primaryAction: {
              label: 'Start review',
              onClick: () => navigate('/study/main-session'),
            },
            secondaryActions: [
              {
                label: 'Gap Analysis',
                onClick: () => navigate('/gap-analysis'),
              },
            ],
          }}
        />
      </WorkspaceReveal>

      {analytics.warnings.length > 0 && (
        <WorkspaceReveal delay={0.03}>
          <WorkspaceSurface accent="#b39b6c">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--color-data-provisional)]" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Some secondary analytics did not load.
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {analytics.warnings[0]}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      )}

      <WorkspaceReveal delay={0.05}>
        <WorkspaceSurface accent="#728ba6" role="hero">
          <WorkspaceSplit className="items-start">
            <div className="space-y-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">
                Read this first
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                {analytics.overview.overdueReviews > 0
                  ? 'Your review backlog is now the main performance risk.'
                  : analytics.overview.accuracyDelta != null && analytics.overview.accuracyDelta < 0
                    ? 'Recent accuracy is slipping enough to act on, not just notice.'
                    : 'Your recent work has enough history to show where the next gains are.'}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                {analytics.overview.overdueReviews > 0
                  ? `You have ${analytics.overview.overdueReviews} overdue reviews and ${analytics.overview.dueToday} more due today. Clear that queue before interpreting newer performance signals.`
                  : analytics.overview.accuracyLast7Days != null
                    ? `The last 7 days include ${analytics.overview.attemptsLast7Days} recorded responses at ${analytics.overview.accuracyLast7Days}% accuracy. ${formatDelta(analytics.overview.accuracyDelta)}.`
                    : `You have ${analytics.overview.attemptsLast7Days} recorded responses in the last 7 days and ${analytics.overview.activeDays} active study days overall.`}
              </p>
            </div>

            <WorkspaceSurface accent="#9a7f9a" role="reference" className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Ground rules
                </p>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  These summaries are derived from recorded attempts, sessions, review state, and missed-pattern history. Decorative or placeholder analytics have been removed from this page.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <HighContrastDataToggle compact className="shrink-0" />
                <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </WorkspaceSurface>
          </WorkspaceSplit>
        </WorkspaceSurface>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Study volume"
            value={analytics.overview.attemptsLast7Days}
            detail={`Recorded responses in the last 7 days across ${analytics.overview.activeDays} study day${analytics.overview.activeDays === 1 ? '' : 's'}.`}
            accent="#728ba6"
            icon={BookOpen}
            variant={analytics.overview.attemptsLast7Days > 0 ? 'progress' : 'guidance'}
          />
          <WorkspaceMetricCard
            label="Recent accuracy"
            value={
              analytics.overview.accuracyLast7Days != null
                ? `${analytics.overview.accuracyLast7Days}%`
                : 'Calibrating'
            }
            detail={formatDelta(analytics.overview.accuracyDelta)}
            accent="#7a8f6e"
            icon={TrendingUp}
            variant={analytics.overview.accuracyLast7Days != null ? 'progress' : 'guidance'}
          />
          <WorkspaceMetricCard
            label="Review load"
            value={analytics.overview.dueToday}
            detail={
              analytics.overview.overdueReviews > 0
                ? `${analytics.overview.overdueReviews} overdue right now`
                : `${analytics.overview.totalActiveReviews} active scheduled reviews`
            }
            accent="#c4b78a"
            icon={CalendarClock}
            variant={analytics.overview.dueToday > 0 ? 'progress' : 'guidance'}
          />
          <WorkspaceMetricCard
            label="Study time"
            value={formatMinutes(analytics.overview.studyMinutesLast7Days)}
            detail={
              analytics.overview.avgSessionQuestions != null
                ? `About ${analytics.overview.avgSessionQuestions} questions per recent session`
                : 'Waiting for more completed sessions'
            }
            accent="#9a7f9a"
            icon={Clock3}
            variant={analytics.overview.studyMinutesLast7Days > 0 ? 'progress' : 'guidance'}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Recent performance"
          subtitle="Volume and accuracy are shown together so rising activity does not hide declining performance."
        >
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <WorkspaceSurface accent="#728ba6">
              <PerformanceTrendChart dailyData={analytics.trend} period="14d" />
            </WorkspaceSurface>
            <WorkspaceSurface accent="#9a7f9a">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Study activity heatmap
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    Daily question volume from recorded sessions, without synthetic filler data.
                  </p>
                </div>
                <Suspense fallback={<DashboardSkeleton height="h-[220px]" />}>
                  <StudyHeatmap data={analytics.heatmap} height={220} />
                </Suspense>
              </div>
            </WorkspaceSurface>
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="Weak systems and coverage gaps"
          subtitle="Accuracy problems and under-studied systems are ranked together so you do not overreact to tiny sample sizes."
        >
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <WorkspaceSurface accent="#c4b78a">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Priority systems
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                      Sorted by combined accuracy risk, recent trend, and blueprint undercoverage.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate('/gap-analysis')}>
                    Open Gap Analysis
                  </Button>
                </div>

                {hasWeakSystems ? (
                  <div className="space-y-3">
                    {analytics.weakSystems.map((system) => (
                      <div
                        key={system.system}
                        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {system.system}
                            </p>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                              {system.attempts} attempts, {system.accuracy}% accuracy, {formatGap(system.gapPercent)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              system.label === 'needs-accuracy-work'
                                ? 'bg-[var(--color-data-fail)]/12 text-[var(--color-data-fail)]'
                                : system.label === 'understudied'
                                  ? 'bg-[var(--color-data-provisional)]/12 text-[var(--color-data-provisional)]'
                                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                            }`}
                          >
                            {system.label === 'needs-accuracy-work'
                              ? 'Accuracy risk'
                              : system.label === 'understudied'
                                ? 'Coverage gap'
                                : 'Watch'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <WorkspaceEmptyState
                    icon={Target}
                    title="No high-confidence weak systems yet"
                    description="Once more responses accumulate, this section will rank systems that genuinely need more work."
                  />
                )}
              </div>
            </WorkspaceSurface>

            <WorkspaceSurface accent="#728ba6">
              {showBlueprint ? (
                <BlueprintGapHeatmap data={analytics.blueprintGaps!} />
              ) : (
                <WorkspaceEmptyState
                  icon={Target}
                  title="Blueprint coverage is still calibrating"
                  description="Answer more questions across different systems before using blueprint distribution as a signal."
                />
              )}
            </WorkspaceSurface>
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSection
          title="Review horizon and recent sessions"
          subtitle="Review burden and recent session history sit together so you can connect workload with actual execution."
        >
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <WorkspaceSurface accent="#7a8f6e">
              {analytics.reviewForecast ? (
                <ReviewCalendar
                  overdue={analytics.reviewForecast.overdue}
                  today={analytics.reviewForecast.today}
                  forecast={analytics.reviewForecast.forecast}
                  totalActive={analytics.reviewForecast.totalActive}
                />
              ) : (
                <WorkspaceEmptyState
                  icon={CalendarClock}
                  title="Review forecast unavailable"
                  description="Your review queue will appear here once scheduled review data is available."
                />
              )}
            </WorkspaceSurface>

            <WorkspaceSurface accent="#9a7f9a">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Session history
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                      Completed sessions only. This is the shortest path to seeing whether recent work was broad, shallow, or productive.
                    </p>
                  </div>
                  <History className="mt-1 h-4 w-4 text-[var(--color-text-muted)]" />
                </div>

                {hasSessions ? (
                  <div className="space-y-3">
                    {analytics.recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {session.modeLabel}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {session.dateLabel} at {session.timeLabel} · {session.durationMinutes} min · {session.totalQuestions} questions
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                            {session.completionLabel}
                          </span>
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {session.accuracy != null ? `${session.accuracy}%` : 'No score'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <WorkspaceEmptyState
                    icon={History}
                    title="No recent sessions"
                    description="Complete a session and it will appear here with real question count, duration, and accuracy."
                  />
                )}
              </div>
            </WorkspaceSurface>
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.24}>
        <WorkspaceSection
          title="Missed patterns"
          subtitle="Confusion patterns and weak conditions are only useful when they point to concrete follow-up work."
        >
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <WorkspaceSurface accent="#c4b78a">
              {showConfusions ? (
                <ConfusionPairCard
                  pairs={analytics.confusionPairs}
                  maxPairs={5}
                  onDrillPair={(correctId, selectedId) =>
                    navigate(`/study/drill/contrastive?conditionA=${correctId}&conditionB=${selectedId}`)
                  }
                />
              ) : (
                <WorkspaceEmptyState
                  icon={Brain}
                  title="No confusion pairs yet"
                  description="Once repeated mix-ups show up in your real attempt history, they will appear here."
                />
              )}
            </WorkspaceSurface>

            <WorkspaceSurface accent="#728ba6">
              {hasConditionData ? (
                <ConditionPerformancePanel
                  conditionStats={analytics.conditionStats}
                  weakConditions={analytics.weakConditions}
                />
              ) : (
                <WorkspaceEmptyState
                  icon={BookOpen}
                  title="Condition-level data is still sparse"
                  description="Keep studying and this section will start separating isolated misses from recurring weak spots."
                />
              )}
            </WorkspaceSurface>
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default ProgressPage;
