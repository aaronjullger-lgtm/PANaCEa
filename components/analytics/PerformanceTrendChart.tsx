import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

interface DailyPerformance {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

interface PerformanceTrendChartProps {
  dailyData: DailyPerformance[];
  period?: '7d' | '14d' | '30d';
}

const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'declining':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    default:
      return <Minus className="w-4 h-4 text-slate-400" />;
  }
};

export const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({
  dailyData,
  period = '14d',
}) => {
  const chartData = useMemo(() => {
    // Fill in missing days with zeros
    const days = period === '7d' ? 7 : period === '14d' ? 14 : 30;
    const filled: DailyPerformance[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const isoDate = date.toISOString().split('T');
      const dateStr = isoDate[0] ?? date.toDateString();

      const existing = dailyData.find((d) => d.date === dateStr);
      filled.push(
        existing ?? {
          date: dateStr,
          attempts: 0,
          correct: 0,
          accuracy: 0,
        }
      );
    }

    return filled;
  }, [dailyData, period]);

  const stats = useMemo(() => {
    const withAttempts = chartData.filter((d) => d.attempts > 0);
    if (withAttempts.length === 0) return null;

    const totalAttempts = withAttempts.reduce((sum, d) => sum + d.attempts, 0);
    const totalCorrect = withAttempts.reduce((sum, d) => sum + d.correct, 0);
    const avgAccuracy = Math.round((totalCorrect / totalAttempts) * 100);
    const avgAttemptsPerDay = Math.round(totalAttempts / withAttempts.length);

    // Calculate trend (compare first half to second half)
    const midpoint = Math.floor(withAttempts.length / 2);
    if (withAttempts.length >= 4) {
      const firstHalf = withAttempts.slice(0, midpoint);
      const secondHalf = withAttempts.slice(midpoint);

      const firstAvg = firstHalf.reduce((sum, d) => sum + d.accuracy, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.accuracy, 0) / secondHalf.length;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (secondAvg > firstAvg + 5) trend = 'improving';
      else if (secondAvg < firstAvg - 5) trend = 'declining';

      return {
        totalAttempts,
        avgAccuracy,
        avgAttemptsPerDay,
        activeDays: withAttempts.length,
        trend,
      };
    }

    return {
      totalAttempts,
      avgAccuracy,
      avgAttemptsPerDay,
      activeDays: withAttempts.length,
      trend: 'stable' as const,
    };
  }, [chartData]);

  const maxAttempts = Math.max(...chartData.map((d) => d.attempts), 1);

  if (!stats) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 text-center">
        <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">No study activity in this period.</p>
        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
          Start practicing to see your trends!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Questions</p>
          <p className="text-xl font-bold text-blue-800 dark:text-blue-300">
            {stats.totalAttempts}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">Avg Accuracy</p>
          <p className="text-xl font-bold text-green-800 dark:text-green-300">
            {stats.avgAccuracy}%
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Active Days</p>
          <p className="text-xl font-bold text-purple-800 dark:text-purple-300">
            {stats.activeDays}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Trend</p>
          <div className="flex items-center gap-2 mt-1">
            {getTrendIcon(stats.trend)}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
              {stats.trend}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Daily Activity
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Last {period === '7d' ? '7' : period === '14d' ? '14' : '30'} days
          </span>
        </div>

        {/* Bar Chart */}
        <div className="flex items-end gap-1 h-32">
          {chartData.map((day, i) => {
            const height = day.attempts > 0 ? (day.attempts / maxAttempts) * 100 : 0;
            const accuracyColor =
              day.accuracy >= 70
                ? 'bg-green-500'
                : day.accuracy >= 50
                  ? 'bg-yellow-500'
                  : day.accuracy > 0
                    ? 'bg-red-500'
                    : 'bg-slate-200 dark:bg-slate-700';

            return (
              <motion.div
                key={day.date}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: i * 0.02, duration: 0.3 }}
                className={`flex-1 rounded-t ${accuracyColor} min-h-[4px] relative group cursor-pointer`}
                title={`${day.date}: ${day.attempts} questions, ${day.accuracy}% accuracy`}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    <div className="font-medium">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div>{day.attempts} questions</div>
                    {day.accuracy > 0 && <div>{day.accuracy}% accuracy</div>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 text-[10px] text-slate-400">
          {(() => {
            const firstDay = chartData[0];
            return firstDay ? (
              <span>
                {new Date(firstDay.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            ) : (
              <span />
            );
          })()}
          <span>Today</span>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-slate-600 dark:text-slate-400">≥70%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span className="text-slate-600 dark:text-slate-400">50-69%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-slate-600 dark:text-slate-400">&lt;50%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceTrendChart;