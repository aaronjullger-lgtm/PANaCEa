/**
 * Behavioral Confidence Calibration
 *
 * Automatically tracks how well behavioral signals (time, answer changes,
 * elimination usage) correlate with actual performance.
 *
 * NO manual input required - confidence is inferred from behavior.
 * Key for PANCE success: understanding your testing patterns.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  Minus as MinusIcon,
  ChevronDown,
  ChevronUp,
  Brain,
  Zap,
  HelpCircle,
} from 'lucide-react';
import {
  InferredConfidence,
  BehavioralConfidenceRecord,
  calculateBehavioralCalibration,
  getBehavioralRecords,
} from '@/services/session';

interface BehavioralCalibrationProps {
  isExpanded?: boolean;
  onToggle?: () => void;
  /** Optional: force refresh trigger */
  refreshKey?: number;
}

// Confidence display badge (read-only, shows current behavior)
export const ConfidenceBadge: React.FC<{
  confidence: InferredConfidence;
  score: number;
  size?: 'sm' | 'md';
}> = ({ confidence, score, size = 'sm' }) => {
  const config = {
    high: {
      label: 'Confident',
      icon: Zap,
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    medium: {
      label: 'Uncertain',
      icon: HelpCircle,
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
    },
    low: {
      label: 'Hesitant',
      icon: Clock,
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-200 dark:border-slate-700',
    },
  }[confidence];

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses} ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className={iconSize} />
      <span className="font-medium">{config.label}</span>
    </motion.div>
  );
};

// Behavioral calibration panel
export const BehavioralCalibration: React.FC<BehavioralCalibrationProps> = ({
  isExpanded = false,
  onToggle,
  refreshKey = 0,
}) => {
  const stats = useMemo(() => {
    const calibration = calculateBehavioralCalibration();
    const records = getBehavioralRecords();
    return { ...calibration, total: records.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (stats.total < 5) {
    return (
      <div className="text-xs text-slate-500 italic">
        Answer {5 - stats.total} more questions to see behavioral patterns
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Behavioral Patterns
            </span>
          </div>
          {stats.calibrationScore !== null && (
            <div
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                stats.calibrationScore >= 65
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : stats.calibrationScore >= 40
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {stats.calibrationScore}%
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              {/* High Confidence (fast, no changes) */}
              <BehaviorRow
                label="Quick & Confident"
                icon={Zap}
                accuracy={stats.high.accuracy}
                count={stats.high.total}
                expected={{ min: 75, max: 100 }}
                color="emerald"
                description="Answered quickly without changing"
              />

              {/* Medium Confidence (some deliberation) */}
              <BehaviorRow
                label="Deliberate"
                icon={Clock}
                accuracy={stats.medium.accuracy}
                count={stats.medium.total}
                expected={{ min: 50, max: 75 }}
                color="amber"
                description="Took time or made small changes"
              />

              {/* Low Confidence (struggled) */}
              <BehaviorRow
                label="Struggled"
                icon={RefreshCw}
                accuracy={stats.low.accuracy}
                count={stats.low.total}
                expected={{ min: 25, max: 50 }}
                color="slate"
                description="Multiple changes or very slow"
              />

              {/* AI Insights */}
              {stats.insights.length > 0 && (
                <div className="pt-2 space-y-1">
                  {stats.insights.map((insight, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
                    >
                      <span className="text-blue-500 mt-0.5">💡</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer explanation */}
              <div className="pt-2 text-xs text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700">
                Based on your response time, answer changes, and elimination usage
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Individual behavior row
const BehaviorRow: React.FC<{
  label: string;
  icon: React.ElementType;
  accuracy: number | null;
  count: number;
  expected: { min: number; max: number };
  color: 'emerald' | 'amber' | 'slate';
  description: string;
}> = ({ label, icon: Icon, accuracy, count, expected, color, description }) => {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-400',
  };

  const iconColors = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    slate: 'text-slate-500 dark:text-slate-400',
  };

  const status = (() => {
    if (accuracy === null || count < 3) return null;
    if (accuracy >= expected.min && accuracy <= expected.max) return 'calibrated';
    if (accuracy > expected.max) return 'better';
    return 'worse';
  })();

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColors[color]}`} />
          <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
          <span className="text-xs text-slate-400">({count})</span>
        </div>
        <div className="flex items-center gap-2">
          {accuracy !== null ? (
            <span
              className={`text-sm font-medium ${
                status === 'calibrated'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : status === 'better'
                    ? 'text-blue-600 dark:text-blue-400'
                    : status === 'worse'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {accuracy}% correct
            </span>
          ) : (
            <span className="text-xs text-slate-400">Need more data</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {accuracy !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${accuracy}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full ${colorClasses[color]} rounded-full`}
            />
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400">{description}</div>
    </div>
  );
};

// Hook for behavioral tracking state (simplified - no manual input needed)
export function useBehavioralTracking() {
  const getRecords = () => getBehavioralRecords();
  const getCalibration = () => calculateBehavioralCalibration();

  return {
    getRecords,
    getCalibration,
  };
}

export default BehavioralCalibration;
