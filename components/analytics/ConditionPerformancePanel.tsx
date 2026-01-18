import React, { useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Target,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ConditionStat {
  conditionId: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface ConditionPerformancePanelProps {
  conditionStats: ConditionStat[];
  weakConditions: ConditionStat[];
  onSelectCondition?: (conditionId: string) => void;
}

const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 80) return 'text-green-600 dark:text-green-400';
  if (accuracy >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const getAccuracyBg = (accuracy: number) => {
  if (accuracy >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (accuracy >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};

// Format condition ID into display name
const formatConditionName = (conditionId: string): string => {
  return conditionId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const ConditionPerformancePanel: React.FC<ConditionPerformancePanelProps> = ({
  conditionStats,
  weakConditions,
  onSelectCondition,
}) => {
  // Sort conditions by accuracy for display
  const sortedByAccuracy = useMemo(
    () => [...conditionStats].sort((a, b) => a.accuracy - b.accuracy),
    [conditionStats]
  );

  const lowestAccuracy = sortedByAccuracy.slice(0, 5);
  const highestAccuracy = sortedByAccuracy.slice(-5).reverse();

  if (conditionStats.length === 0) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 text-center">
        <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400">No condition-specific data yet.</p>
        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
          Complete more practice questions to see condition breakdowns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weak Conditions Alert */}
      {weakConditions.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800 dark:text-red-300">Focus Areas Identified</h4>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                These conditions need extra attention (accuracy below 60%):
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {weakConditions.slice(0, 5).map((c) => (
                  <button
                    key={c.conditionId}
                    onClick={() => onSelectCondition?.(c.conditionId)}
                    className="px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors flex items-center gap-1"
                  >
                    {formatConditionName(c.conditionId)}
                    <span className="opacity-75">({c.accuracy}%)</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lowest Accuracy */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-slate-200 dark:border-slate-700">
            <h4 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Needs Improvement
            </h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {lowestAccuracy.map((c, i) => (
              <motion.button
                key={c.conditionId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectCondition?.(c.conditionId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                    {formatConditionName(c.conditionId)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.correct}/{c.total} correct
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded ${getAccuracyBg(c.accuracy)} ${getAccuracyColor(c.accuracy)}`}
                  >
                    {c.accuracy}%
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Highest Accuracy */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-slate-200 dark:border-slate-700">
            <h4 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Strong Performance
            </h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {highestAccuracy.map((c, i) => (
              <motion.button
                key={c.conditionId}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectCondition?.(c.conditionId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                    {formatConditionName(c.conditionId)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {c.correct}/{c.total} correct
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded ${getAccuracyBg(c.accuracy)} ${getAccuracyColor(c.accuracy)}`}
                  >
                    {c.accuracy}%
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* All Conditions Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" />
            All Conditions ({conditionStats.length})
          </h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {conditionStats.map((c) => (
            <button
              key={c.conditionId}
              onClick={() => onSelectCondition?.(c.conditionId)}
              className={`p-2 rounded-lg text-xs font-medium transition-colors ${getAccuracyBg(c.accuracy)} ${getAccuracyColor(c.accuracy)} hover:opacity-80`}
              title={`${formatConditionName(c.conditionId)}: ${c.accuracy}% (${c.total} attempts)`}
            >
              <div className="truncate">{formatConditionName(c.conditionId)}</div>
              <div className="text-[10px] opacity-75">{c.accuracy}%</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConditionPerformancePanel;
