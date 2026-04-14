import React, { Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Brain,
  CalendarClock,
  Layers,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from 'lucide-react';
import { HighContrastDataToggle } from '@/components/ui/HighContrastDataToggle';
import { Button } from '@/components/ui/button';
import { SkeletonLoader } from '@/components/loading';
import {
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import {
  AnalyticsDashboard,
  AdvancedLearningProfileDashboard,
  DatabaseAnalyticsDashboard,
  LearningProfileDashboard,
  UserFriendlyStatsDisplay,
} from '@/config/lazyComponents';
import { SmartSchedulerGantt, type ScheduleBlock } from '@/components/analytics/SmartSchedulerGantt';
import { ROUTES } from '@/config/routes';
import { calculateDayStreak } from '@/lib/dashboardUtils';
import type { PerformanceRecord } from '@/types';

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

export const ProgressPage: React.FC<ProgressPageProps> = ({
  performanceData = [],
  dueCount = 0,
}) => {
  const navigate = useNavigate();
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

  const schedulerBlocks: ScheduleBlock[] = useMemo(() => {
    if (dueCount <= 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    return [
      {
        id: 'today-due',
        label: 'Review due',
        date: today,
        count: dueCount,
      },
    ];
  }, [dueCount]);

  const accuracy = useMemo(() => {
    if (performanceData.length === 0) return null;
    const recent = performanceData.slice(-100);
    const correct = recent.filter((record) => record.isCorrect).length;
    return Math.round((correct / recent.length) * 100);
  }, [performanceData]);

  const streak = useMemo(
    () => calculateDayStreak(performanceData).current,
    [performanceData]
  );

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Analytics Workspace',
            badgeTone: 'steel',
            title: 'Progress with narrative, not noise.',
            subtitle:
              'See what is actually improving, what is decaying, and which next actions will move readiness faster than another generic question block.',
            status:
              dueCount > 0
                ? `${dueCount} review${dueCount === 1 ? '' : 's'} waiting`
                : 'Review queue under control',
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
            primaryAction: {
              label: 'Open Gap Analysis',
              onClick: () => navigate('/gap-analysis'),
            },
            secondaryActions: [
              {
                label: 'Clinical Profile',
                onClick: () => navigate('/clinical-profile'),
              },
            ],
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Recent accuracy"
            value={accuracy !== null ? `${accuracy}%` : '—'}
            detail="Calculated from your most recent 100 recorded responses."
            icon={TrendingUp}
          />
          <WorkspaceMetricCard
            label="Due review"
            value={dueCount}
            detail="Questions that should be surfaced now for retention."
            accent="#c4b78a"
            icon={CalendarClock}
          />
          <WorkspaceMetricCard
            label="Recorded answers"
            value={performanceData.length}
            detail="Responses currently available for analytics and profile modeling."
            accent="#9a7f9a"
            icon={BarChart3}
          />
          <WorkspaceMetricCard
            label="Study streak"
            value={streak}
            detail="Consecutive study days based on your recorded activity."
            accent="#7a8f6e"
            icon={Sparkles}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceSurface accent="#728ba6">
          <WorkspaceSplit className="items-start">
            <div className="space-y-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Guided summary
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Start with the headline signals, then drill down only where the story changes.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                This page prioritizes clear trends and readiness cues first. Deep charting and
                profile analysis still live below, but the first screen now tells you where to act
                next instead of asking you to interpret every widget at once.
              </p>
            </div>

            <div className="space-y-3">
              <div className="workspace-subsurface rounded-[1.25rem] p-4">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  Reading mode
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Toggle advanced profile views only when you need detail. The default view stays
                  optimized for day-to-day study decisions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <HighContrastDataToggle compact className="shrink-0" />
                <Button
                  type="button"
                  size="sm"
                  variant={showAdvancedAnalytics ? 'primary' : 'secondary'}
                  onClick={() => setShowAdvancedAnalytics((value) => !value)}
                >
                  {showAdvancedAnalytics ? 'Advanced view on' : 'Switch to advanced'}
                </Button>
              </div>
            </div>
          </WorkspaceSplit>
        </WorkspaceSurface>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Your learning analytics"
          subtitle="Research-backed summary metrics translated into plain-language study signals."
        >
          <WorkspaceSurface accent="#c4b78a">
            <Suspense fallback={<DashboardSkeleton />}>
              <UserFriendlyStatsDisplay
                onPracticeSystem={(system) => {
                  try {
                    sessionStorage.setItem('panceai_pending_system_drill', system);
                  } catch {
                    /* ignore storage errors */
                  }
                  navigate(ROUTES.STUDY);
                }}
              />
            </Suspense>
          </WorkspaceSurface>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="Review horizon"
          subtitle="See how much of your current review burden is already waiting in the next two weeks."
        >
          <WorkspaceSurface accent="#7a8f6e">
            <SmartSchedulerGantt blocks={schedulerBlocks} daysToShow={14} />
          </WorkspaceSurface>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSection
          title="Learning profile"
          subtitle="Keep the guided profile in front by default; switch into advanced mode only when you need a fuller diagnostic read."
          action={
            <Button
              type="button"
              size="sm"
              variant={showAdvancedAnalytics ? 'primary' : 'outline'}
              onClick={() => setShowAdvancedAnalytics((value) => !value)}
            >
              {showAdvancedAnalytics ? 'Showing advanced' : 'Show advanced'}
            </Button>
          }
        >
          <WorkspaceSurface accent="#9a7f9a">
            <Suspense fallback={<DashboardSkeleton />}>
              {showAdvancedAnalytics ? (
                <AdvancedLearningProfileDashboard />
              ) : (
                <LearningProfileDashboard />
              )}
            </Suspense>
          </WorkspaceSurface>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.24}>
        <WorkspaceSection
          title="Deep analytics"
          subtitle="Detailed aggregates and session-level performance remain available for when you need them."
        >
          <div className="space-y-6">
            <WorkspaceSurface accent="#728ba6">
              <Suspense fallback={<DashboardSkeleton />}>
                <DatabaseAnalyticsDashboard />
              </Suspense>
            </WorkspaceSurface>

            {performanceData.length > 0 ? (
              <WorkspaceSurface accent="#b39b6c">
                <div className="mb-4 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-[var(--color-accent)]" />
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Session performance
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Recent response-level behavior across your study sessions.
                    </p>
                  </div>
                </div>
                <Suspense fallback={<DashboardSkeleton />}>
                  <AnalyticsDashboard performanceData={performanceData} />
                </Suspense>
              </WorkspaceSurface>
            ) : null}
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.28}>
        <WorkspaceSection
          title="Drill-down views"
          subtitle="Leave this summary page only when you need a focused view of competence by system or a targeted remediation plan."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <button type="button" onClick={() => navigate('/clinical-profile')} className="text-left">
              <WorkspaceSurface accent="#728ba6" className="h-full transition-transform duration-300 hover:translate-y-[-2px]">
                <div className="space-y-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] bg-[var(--color-accent-secondary)]/12">
                    <Layers className="h-5 w-5 text-[var(--color-accent-secondary)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Competency heatmap
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                      Visual mastery map across systems so you can see what is truly stable.
                    </p>
                  </div>
                </div>
              </WorkspaceSurface>
            </button>

            <button type="button" onClick={() => navigate('/gap-analysis')} className="text-left">
              <WorkspaceSurface accent="#c4b78a" className="h-full transition-transform duration-300 hover:translate-y-[-2px]">
                <div className="space-y-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] bg-[var(--color-accent)]/12">
                    <Target className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Gap analysis
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                      Identify the highest-yield concepts to remediate next instead of spreading
                      attention thinly.
                    </p>
                  </div>
                </div>
              </WorkspaceSurface>
            </button>

            <button type="button" onClick={() => navigate('/clinical-profile')} className="text-left">
              <WorkspaceSurface accent="#7a8f6e" className="h-full transition-transform duration-300 hover:translate-y-[-2px]">
                <div className="space-y-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] bg-[var(--color-data-pass)]/12">
                    <User className="h-5 w-5 text-[var(--color-data-pass)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Clinical profile
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                      Review broader reasoning tendencies, timing patterns, and bias signals.
                    </p>
                  </div>
                </div>
              </WorkspaceSurface>
            </button>
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default ProgressPage;
