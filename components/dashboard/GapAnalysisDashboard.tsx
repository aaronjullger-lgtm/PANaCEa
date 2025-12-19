import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Scatter,
  Cell,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, Trophy, Target, ArrowRight } from 'lucide-react';

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
    points.push([cx + (size * 0.4) * Math.cos(innerAngle), cy + (size * 0.4) * Math.sin(innerAngle)]);
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">High Yield Focus</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Top priorities based on gap size and question volume
      </p>

      <div className="space-y-4">
        {topSystems.map((system, index) => (
          <motion.div
            key={system.name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-amber-600">#{index + 1}</span>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">{system.name}</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  +{Math.round(system.topPerformerGap)}% to reach Top 10%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span>Your: {system.accuracy}%</span>
                <span>Goal: {system.cohortP90}%</span>
              </div>
              <button
                onClick={() => onStudyClick(system.name)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
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
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 shadow-lg">
      <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">{data.name}</h4>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Your Accuracy:</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{data.accuracy}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Cohort Average:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{data.cohortAverage}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Top 10%:</span>
          <span className="font-semibold text-amber-600 dark:text-amber-500">{data.cohortP90}%</span>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-400">Gap to Close:</span>
            <span className="font-bold text-amber-600">+{Math.round(data.topPerformerGap)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Dashboard Component
// ============================================================================

export const GapAnalysisDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<PerformanceDeltasResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        const response = await fetch('/api/analytics/performance-deltas', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const result: PerformanceDeltasResponse = await response.json();
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching performance deltas:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [getToken]);

  const handleStudyClick = (systemName: string) => {
    navigate(`/quiz?system=${encodeURIComponent(systemName)}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse" />
            <div className="h-96 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Unable to Load Analysis</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error || 'No data available'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Gap Analysis</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Your performance vs. Top 10% across all systems • {data.userTotalAttempts} total attempts
          </p>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-zinc-600">Overall Percentile</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">{data.overallPercentile}%</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-zinc-600">Systems Analyzed</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">{data.systems.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-zinc-600">High Priority Areas</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {data.systems.filter((s) => s.status === 'critical' || s.status === 'weakness').length}
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
            className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6"
          >
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Performance vs. Top 10%</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sorted by improvement opportunity (highest yield first)
              </p>
            </div>

            <ResponsiveContainer width="100%" height={500}>
              <ComposedChart
                data={chartData}
                layout="vertical"
                margin={{ top: 20, right: 30, bottom: 20, left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" horizontal={false} />
                
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  label={{ value: 'Accuracy (%)', position: 'bottom', fill: '#64748b', fontSize: 12 }}
                />
                
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  width={90}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* The Dumbbell Lines (Ranges) */}
                {chartData.map((entry, index) => (
                  <ReferenceLine
                    key={`line-${index}`}
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
                <Scatter
                  dataKey="cohortAverage"
                  shape={<TickShape />}
                  fill="#9ca3af"
                />

                {/* User Accuracy Markers (Large Circle) */}
                <Scatter dataKey="accuracy" fill="#3b82f6">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-user-${index}`} fill="#3b82f6" />
                  ))}
                </Scatter>

                {/* Top 10% Markers (Star) */}
                <Scatter
                  dataKey="cohortP90"
                  shape={<StarShape />}
                  fill="#f59e0b"
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span>Your Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-zinc-400" />
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

export default GapAnalysisDashboard;
