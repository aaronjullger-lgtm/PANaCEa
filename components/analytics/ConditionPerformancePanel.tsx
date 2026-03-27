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
  if (accuracy >= 80) return 'text-data-pass';
  if (accuracy >= 60) return 'text-data-provisional';
  return 'text-data-fail';
};

const getAccuracyBg = (accuracy: number) => {
  if (accuracy >= 80) return 'bg-data-pass/10';
  if (accuracy >= 60) return 'bg-data-provisional/10';
  return 'bg-data-fail/10';
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
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 text-center">
        <BookOpen className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
        <p className="text-[var(--color-text-secondary)]">No condition-specific data yet.</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Complete more practice questions to see condition breakdowns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weak Conditions Alert */}
      {weakConditions.length > 0 && (
        <div className="bg-data-fail/10 border border-data-fail/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-data-fail flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-data-fail">Focus Areas Identified</h4>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                These conditions need extra attention (accuracy below 60%):
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {weakConditions.slice(0, 5).map((c) => (
                  <button
                    key={c.conditionId}
                    onClick={() => onSelectCondition?.(c.conditionId)}
                    className="px-3 py-1.5 text-xs font-medium bg-data-fail/20 text-data-fail rounded-lg hover:bg-data-fail/30 transition-colors flex items-center gap-1"
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
        <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 bg-data-fail/10 border-b border-[var(--color-border)]">
            <h4 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-data-fail" />
              Needs Improvement
            </h4>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {lowestAccuracy.map((c, i) => (
              <motion.button
                key={c.conditionId}
                initial={{ x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectCondition?.(c.conditionId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {formatConditionName(c.conditionId)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {c.correct}/{c.total} correct
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded ${getAccuracyBg(c.accuracy)} ${getAccuracyColor(c.accuracy)}`}
                  >
                    {c.accuracy}%
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Highest Accuracy */}
        <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-4 py-3 bg-data-pass/10 border-b border-[var(--color-border)]">
            <h4 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-data-pass" />
              Strong Performance
            </h4>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {highestAccuracy.map((c, i) => (
              <motion.button
                key={c.conditionId}
                initial={{ x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectCondition?.(c.conditionId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {formatConditionName(c.conditionId)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {c.correct}/{c.total} correct
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded ${getAccuracyBg(c.accuracy)} ${getAccuracyColor(c.accuracy)}`}
                  >
                    {c.accuracy}%
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* All Conditions Summary */}
      <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--color-accent)]" />
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
