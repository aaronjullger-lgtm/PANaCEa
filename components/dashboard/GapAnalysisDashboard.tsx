import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
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
import { ROUTES } from '@/config/routes';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import ChartContainer from '@/components/shared/ChartContainer';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CHART_COLORS = {
  weakness: '#f59e0b',
  average: '#3b82f6',
  strength: '#10b981',
  muted: '#6b7280',
  chartMuted: '#9ca3af',
} as const;

interface SystemData {
  name: string;
  accuracy: number;
  cohortAverage: number;
  cohortP90: number;
  cohortDelta: number;
  topPerformerGap: number;
  yieldScore: number;
  status: 'strength' | 'average' | 'weakness' | 'critical';
  isInsufficientData: boolean;
}

interface PerformanceDeltasResponse {
  success: boolean;
  data: {
    userTotalAttempts: number;
    overallPercentile: number;
    systems: SystemData[];
  };
}

const StarShape = (props: any) => {
  const { cx, cy, fill } = props;
  const size = 8;
  const points = [];
  for (let index = 0; index < 5; index++) {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    points.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
    const innerAngle = angle + Math.PI / 5;
    points.push([
      cx + size * 0.4 * Math.cos(innerAngle),
      cy + size * 0.4 * Math.sin(innerAngle),
    ]);
  }
  return (
    <polygon
      points={points.map((point) => point.join(',')).join(' ')}
      fill="none"
      stroke={fill}
      strokeWidth={2}
    />
  );
};

const TickShape = (props: any) => {
  const { cx, cy, fill } = props;
  return <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke={fill} strokeWidth={2} />;
};

function getRangeColor(status: SystemData['status']) {
  switch (status) {
    case 'critical':
    case 'weakness':
      return CHART_COLORS.weakness;
    case 'average':
      return CHART_COLORS.average;
    case 'strength':
      return CHART_COLORS.strength;
    default:
      return CHART_COLORS.muted;
  }
}

function systemAccent(status: SystemData['status']) {
  switch (status) {
    case 'critical':
    case 'weakness':
      return '#b39b6c';
    case 'strength':
      return '#7a8f6e';
    case 'average':
      return '#728ba6';
    default:
      return '#9a7f9a';
  }
}

function systemLabel(status: SystemData['status']) {
  switch (status) {
    case 'critical':
      return 'Critical';
    case 'weakness':
      return 'Gap';
    case 'strength':
      return 'Strength';
    default:
      return 'Monitor';
  }
}

function HighYieldFocus({
  systems,
  onStudyClick,
}: {
  systems: SystemData[];
  onStudyClick: (systemName: string) => void;
}) {
  return (
    <WorkspaceSurface accent="#b39b6c" className="h-full">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            High-yield focus
          </p>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            These are the widest gaps to the top performers, adjusted to keep the biggest opportunities visible first.
          </p>
        </div>

        <div className="space-y-3">
          {systems.map((system, index) => (
            <div
              key={system.name}
              className="rounded-[1.15rem] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-accent)]">
                      #{index + 1}
                    </span>
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {system.name}
                    </h3>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    +{Math.round(system.topPerformerGap)}% to reach the top 10%
                  </p>
                </div>
                <span
                  className="rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]"
                  style={{
                    borderColor: `color-mix(in srgb, ${systemAccent(system.status)} 40%, white)`,
                    background: `color-mix(in srgb, ${systemAccent(system.status)} 14%, transparent)`,
                    color: systemAccent(system.status),
                  }}
                >
                  {systemLabel(system.status)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                <span>Your score: {system.accuracy}%</span>
                <span>Top 10%: {system.cohortP90}%</span>
              </div>

              <Button
                type="button"
                size="sm"
                className="mt-4 w-full"
                onClick={() => onStudyClick(system.name)}
                iconRight={ArrowRight}
              >
                Study this system
              </Button>
            </div>
          ))}
        </div>
      </div>
    </WorkspaceSurface>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as SystemData;
  return (
    <div className="rounded-[1rem] border border-white/8 bg-[var(--color-bg-primary)]/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <h4 className="mb-2 font-semibold text-[var(--color-text-primary)]">{data.name}</h4>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Your accuracy</span>
          <span className="font-semibold text-[var(--color-accent)] tabular-nums">{data.accuracy}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Cohort average</span>
          <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
            {data.cohortAverage}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Top 10%</span>
          <span className="font-semibold text-[var(--color-data-provisional)] tabular-nums">
            {data.cohortP90}%
          </span>
        </div>
        <div className="mt-2 border-t border-white/8 pt-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--color-text-secondary)]">Gap to close</span>
            <span className="font-semibold text-[var(--color-data-provisional)] tabular-nums">
              +{Math.round(data.topPerformerGap)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface GapAnalysisDashboardProps {
  onStudySystem?: (systemName: string) => void;
}

export const GapAnalysisDashboard: React.FC<GapAnalysisDashboardProps> = ({ onStudySystem }) => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const [data, setData] = useState<PerformanceDeltasResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) {
          setError('Please sign in to view your analytics.');
          setIsLoading(false);
          return;
        }

        const response = await fetch(getApiEndpoint(API_ENDPOINTS.ANALYTICS_PERFORMANCE_DELTAS), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('No performance data found. Complete some questions to see your analytics.');
          } else if (response.status === 500) {
            setError('Server error loading your data. Please try again in a moment.');
          } else {
            setError(`Failed to load data (${response.status}). Please try refreshing.`);
          }
          setIsLoading(false);
          return;
        }

        const result: PerformanceDeltasResponse = await response.json();
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response format');
        }

        if (result.success && result.data) {
          setData(result.data);
        } else if (!result.success && result.data) {
          setData(result.data);
          setError('Some data may be unavailable. Showing cached results.');
        } else {
          throw new Error('Invalid response structure');
        }
      } catch (err) {
        console.error('Error fetching performance deltas:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Unable to load analytics: ${message}. Please try again.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [getToken, retryCount]);

  const handleStudyClick = (systemName: string) => {
    if (onStudySystem) {
      onStudySystem(systemName);
      return;
    }
    navigate(ROUTES.STUDY);
  };

  const systemsSorted = useMemo(
    () =>
      [...(data?.systems ?? [])].sort((left, right) => {
        if (right.topPerformerGap !== left.topPerformerGap) {
          return right.topPerformerGap - left.topPerformerGap;
        }
        return right.yieldScore - left.yieldScore;
      }),
    [data?.systems]
  );

  const topSystems = useMemo(
    () => systemsSorted.filter((system) => !system.isInsufficientData).slice(0, 3),
    [systemsSorted]
  );

  const criticalCount = systemsSorted.filter(
    (system) => system.status === 'critical' || system.status === 'weakness'
  ).length;
  const strengthCount = systemsSorted.filter((system) => system.status === 'strength').length;

  if (isLoading) {
    return (
      <WorkspacePage density="wide">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Gap Analysis',
              badgeTone: 'steel',
              title: 'Mapping your biggest performance gaps.',
              subtitle:
                'The analytics workspace is comparing your system-level performance against cohort anchors and top-performer thresholds.',
              backLabel: 'Back to Progress',
              onBack: () => navigate(ROUTES.PROGRESS),
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceSurface accent="#728ba6">
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-b-transparent" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Loading your gap analysis...
              </p>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  if (error && !data) {
    return (
      <WorkspacePage density="wide">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Gap Analysis',
              badgeTone: 'steel',
              title: 'Gap analysis is unavailable right now.',
              subtitle:
                'We could not safely load the analytics needed to compare your current performance against cohort benchmarks.',
              backLabel: 'Back to Progress',
              onBack: () => navigate(ROUTES.PROGRESS),
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceEmptyState
            icon={AlertCircle}
            title="Unable to load analysis"
            description={error}
            action={
              <div className="flex gap-3">
                <Button type="button" size="sm" onClick={() => setRetryCount((value) => value + 1)}>
                  Retry
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => navigate(ROUTES.PROGRESS)}>
                  Back to Progress
                </Button>
              </div>
            }
          />
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  if (!data) return null;

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Gap Analysis',
            badgeTone: 'steel',
            title: 'See where the real performance distance still lives.',
            subtitle:
              'This view compares your system performance against the cohort and top-decile anchors so you can study where the climb is still worth it.',
            status: `${data.userTotalAttempts} recorded attempts`,
            backLabel: 'Back to Progress',
            onBack: () => navigate(ROUTES.PROGRESS),
            primaryAction: topSystems[0]
              ? {
                  label: `Study ${topSystems[0].name}`,
                  onClick: () => handleStudyClick(topSystems[0].name),
                }
              : undefined,
            secondaryActions: [
              {
                label: 'Refresh analysis',
                onClick: () => setRetryCount((value) => value + 1),
              },
            ],
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Overall percentile"
            value={`${data.overallPercentile}%`}
            detail="Your approximate standing relative to the current cohort comparison set."
            icon={Trophy}
          />
          <WorkspaceMetricCard
            label="Systems analyzed"
            value={systemsSorted.length}
            detail="Distinct systems with enough question history to compare."
            accent="#728ba6"
            icon={Target}
          />
          <WorkspaceMetricCard
            label="High-priority gaps"
            value={criticalCount}
            detail="Systems marked critical or weak based on top-performer distance."
            accent="#b39b6c"
            icon={AlertCircle}
          />
          <WorkspaceMetricCard
            label="Current strengths"
            value={strengthCount}
            detail="Systems already tracking above the cohort with stronger performance."
            accent="#7a8f6e"
            icon={TrendingUp}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                How to read this
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Focus on the distance to top performance, not just whether a system feels weak.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                The chart shows your current score, the cohort average, and the top-decile benchmark.
                The most valuable study targets are the systems with wide remaining gaps and enough
                volume to matter.
              </p>
            </div>

            <div className="space-y-3 rounded-[1.25rem] border border-white/8 bg-white/5 p-5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Priority rule of thumb
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Study the systems with both a large top-performer gap and meaningful question
                volume first. Low-volume noise is less urgent than a consistent miss pattern.
              </p>
              {error ? (
                <div className="rounded-[1rem] border border-[var(--color-data-provisional)]/30 bg-[var(--color-data-provisional)]/10 px-3 py-2 text-sm text-[var(--color-data-provisional)]">
                  {error}
                </div>
              ) : null}
            </div>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Performance vs top decile"
          subtitle="Sorted by improvement opportunity so the biggest remaining lifts stay near the top."
        >
          <WorkspaceSplit className="items-start">
            <WorkspaceSurface accent="#728ba6" className="xl:col-span-1">
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Performance vs. top 10%
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Compare your current accuracy, cohort average, and top-decile target system by
                    system.
                  </p>
                </div>

                <ChartContainer minHeight={500} className="min-h-[200px] w-full">
                  <ResponsiveContainer width="100%" height={500} minHeight={200} minWidth={0}>
                    <ComposedChart
                      data={systemsSorted}
                      layout="vertical"
                      margin={{ top: 20, right: 30, bottom: 32, left: 100 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--chart-grid-stroke)"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        stroke="var(--color-border)"
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                        label={{
                          value: 'Accuracy (%)',
                          position: 'bottom',
                          fill: 'var(--color-text-muted)',
                          fontSize: 12,
                        }}
                      />

                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="var(--color-border)"
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                        width={90}
                      />

                      <Tooltip content={<CustomTooltip />} />

                      {systemsSorted.map((entry) => (
                        <ReferenceLine
                          key={`line-${entry.name}`}
                          segment={[
                            { x: entry.accuracy, y: entry.name },
                            { x: entry.cohortP90, y: entry.name },
                          ]}
                          stroke={getRangeColor(entry.status)}
                          strokeWidth={3}
                          ifOverflow="extendDomain"
                        />
                      ))}

                      <Scatter
                        dataKey="cohortAverage"
                        shape={<TickShape />}
                        fill={CHART_COLORS.chartMuted}
                      />

                      <Scatter dataKey="accuracy" fill={CHART_COLORS.average}>
                        {systemsSorted.map((entry) => (
                          <Cell key={`cell-user-${entry.name}`} fill={CHART_COLORS.average} />
                        ))}
                      </Scatter>

                      <Scatter
                        dataKey="cohortP90"
                        shape={<StarShape />}
                        fill={CHART_COLORS.weakness}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>

                <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[var(--color-accent)]" />
                    <span>Your score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-4 bg-[var(--color-bg-secondary)]" />
                    <span>Cohort average</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarShape cx={6} cy={6} fill={CHART_COLORS.weakness} />
                    <span className="ml-2">Top 10%</span>
                  </div>
                </div>
              </div>
            </WorkspaceSurface>

            <HighYieldFocus systems={topSystems} onStudyClick={handleStudyClick} />
          </WorkspaceSplit>
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default GapAnalysisDashboard;
