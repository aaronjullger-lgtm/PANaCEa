import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
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
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, Trophy, Target, ArrowRight } from 'lucide-react';
import { ErrorBoundary } from '../error/ErrorBoundary';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Custom Shapes for Recharts
// ============================================================================

const StarShape = (props: any) => {
  const { cx, cy, fill } = props;
  const size = 8;
  const points = [];
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    points.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
    const innerAngle = angle + Math.PI / 5;
    points.push([cx + size * 0.4 * Math.cos(innerAngle), cy + size * 0.4 * Math.sin(innerAngle)]);
  }
  return (
    <polygon
      points={points.map((p) => p.join(',')).join(' ')}
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

// ============================================================================
// High Yield Sidebar Component
// ============================================================================

interface HighYieldSidebarProps {
  topSystems: SystemData[];
  onStudyClick: (systemName: string) => void;
}

const HighYieldSidebar: React.FC<HighYieldSidebarProps> = ({ topSystems, onStudyClick }) => {
  return (
    <div className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-[var(--color-data-provisional)]" />
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">High Yield Focus</h3>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Top priorities based on gap size and question volume
      </p>

      <div className="space-y-4">
        {topSystems.map((system, index) => (
          <motion.div
            key={system.name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="p-4 bg-gradient-to-r from-[var(--color-data-provisional)]/10 to-[var(--color-data-provisional)]/5 rounded-xl border border-[var(--color-data-provisional)]/30"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[var(--color-data-provisional)]">
                    #{index + 1}
                  </span>
                  <h4 className="font-semibold text-[var(--color-text-primary)]">{system.name}</h4>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  +{Math.round(system.topPerformerGap)}% to reach Top 10%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                <span>Your: {system.accuracy}%</span>
                <span>Goal: {system.cohortP90}%</span>
              </div>
              <button
                onClick={() => onStudyClick(system.name)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-data-provisional)] hover:bg-[var(--color-data-provisional)]/90 text-[var(--color-text-inverse)] text-sm font-semibold rounded-lg transition-colors"
              >
                Study Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Custom Tooltip
// ============================================================================

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border border-[var(--color-border)] rounded-lg px-4 py-3 shadow-lg">
      <h4 className="font-bold text-[var(--color-text-primary)] mb-2">{data.name}</h4>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Your Accuracy:</span>
          <span className="font-semibold text-[var(--color-accent)]">{data.accuracy}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Cohort Average:</span>
          <span className="font-semibold text-[var(--color-text-primary)]">
            {data.cohortAverage}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Top 10%:</span>
          <span className="font-semibold text-[var(--color-data-provisional)]">
            {data.cohortP90}%
          </span>
        </div>
        <div className="border-t border-[var(--color-border)] pt-2 mt-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--color-text-secondary)]">Gap to Close:</span>
            <span className="font-bold text-[var(--color-data-provisional)]">
              +{Math.round(data.topPerformerGap)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Dashboard Component
// ============================================================================

export interface GapAnalysisDashboardProps {
  /** When provided, "Study Now" uses this instead of navigating to /quiz (which has no route). */
  onStudySystem?: (systemName: string) => void;
}

export const GapAnalysisDashboard: React.FC<GapAnalysisDashboardProps> = ({
  onStudySystem,
}) => {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<PerformanceDeltasResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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

      const response = await fetch(
        getApiEndpoint(API_ENDPOINTS.ANALYTICS_PERFORMANCE_DELTAS),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('No performance data found. Complete some questions to see your analytics!');
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
        // Server returned safe defaults (500 error with fallback data)
        setData(result.data);
        setError('Some data may be unavailable. Showing cached results.');
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err) {
      console.error('Error fetching performance deltas:', err);
      // Prevent unhandled promise rejection - always set error state
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Unable to load analytics: ${errorMessage}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [getToken, retryCount]);

  const handleStudyClick = (systemName: string) => {
    if (onStudySystem) {
      onStudySystem(systemName);
    } else {
      navigate('/');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-[var(--color-bg-tertiary)] rounded w-1/3 animate-pulse mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] animate-pulse" />
            <div className="h-96 bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Error state (no data to show)
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] flex items-center justify-center p-6">
        <div className="bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-data-fail)]/30 p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-[var(--color-data-fail)] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
              Unable to Load Analysis
            </h3>
            <p className="text-[var(--color-text-secondary)] mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setRetryCount(retryCount + 1)}
                className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-[var(--color-text-inverse)] font-semibold rounded-lg transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-primary)] font-semibold rounded-lg transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data to render chart (satisfies type narrowing)
  if (!data) {
    return null;
  }

  // Prepare chart data
  const chartData = data.systems.map((system) => ({
    ...system,
    // For the dumbbell line
    rangeStart: Math.min(system.accuracy, system.cohortP90),
    rangeEnd: Math.max(system.accuracy, system.cohortP90),
  }));

  // Get top 3 systems for sidebar
  const topSystems = data.systems.slice(0, 3);

  // Determine range color based on status
  const getRangeColor = (status: string) => {
    switch (status) {
      case 'critical':
      case 'weakness':
        return '#f59e0b'; // Amber
      case 'average':
        return '#3b82f6'; // Blue
      case 'strength':
        return '#10b981'; // Green
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-[var(--color-accent)]" />
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Gap Analysis</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Your performance vs. Top 10% across all systems • {data.userTotalAttempts} total
            attempts
          </p>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-[var(--color-data-provisional)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">Overall Percentile</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {data.overallPercentile}%
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-[var(--color-accent)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">Systems Analyzed</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {data.systems.length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-5 h-5 text-[var(--color-data-provisional)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">
                High Priority Areas
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {
                data.systems.filter((s) => s.status === 'critical' || s.status === 'weakness')
                  .length
              }
            </p>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="lg:col-span-2 bg-[var(--color-bg-primary)] rounded-2xl border border-[var(--color-border)] p-6"
          >
            <div className="mb-6">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                Performance vs. Top 10%
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Sorted by improvement opportunity (highest yield first)
              </p>
            </div>

            <ResponsiveContainer width="100%" height={500}>
              <ComposedChart
                data={chartData}
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

                {/* The Dumbbell Lines (Ranges) */}
                {chartData.map((entry) => (
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

                {/* Cohort Average Markers (Small Tick) */}
                <Scatter dataKey="cohortAverage" shape={<TickShape />} fill="#9ca3af" />

                {/* User Accuracy Markers (Large Circle) */}
                <Scatter dataKey="accuracy" fill="#3b82f6">
                  {chartData.map((entry) => (
                    <Cell key={`cell-user-${entry.name}`} fill="#3b82f6" />
                  ))}
                </Scatter>

                {/* Top 10% Markers (Star) */}
                <Scatter dataKey="cohortP90" shape={<StarShape />} fill="#f59e0b" />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[var(--color-accent)]" />
                <span>Your Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-[var(--color-text-muted)]" />
                <span>Average</span>
              </div>
              <div className="flex items-center gap-2">
                <StarShape cx={6} cy={6} fill="#f59e0b" />
                <span className="ml-2">Top 10%</span>
              </div>
            </div>
          </motion.div>

          {/* High Yield Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <HighYieldSidebar topSystems={topSystems} onStudyClick={handleStudyClick} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Wrap with ErrorBoundary to prevent full-page crashes
export default function GapAnalysisDashboardWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <GapAnalysisDashboard />
    </ErrorBoundary>
  );
}
