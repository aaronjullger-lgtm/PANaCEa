/**
 * Learning Progress Card
 *
 * A visually engaging component that displays comprehensive learning progress
 * with animated gauges, trend indicators, and statistical insights.
 *
 * Features:
 * - Animated circular progress indicator
 * - Confidence interval display
 * - Trend direction with velocity
 * - PANCE score prediction
 * - Memory strength visualization
 *
 * @module components/analytics/LearningProgressCard
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  Award,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  calculateConfidenceInterval,
  analyzeTrend,
  predictPANCEScore,
  generateLearningInsights,
  type TrendAnalysis,
  type ConfidenceInterval,
} from '../../lib/utils/statisticalAnalysis';

interface LearningProgressCardProps {
  // Required data
  accuracy: number; // 0-100
  totalQuestions: number;

  // Optional historical data for trends
  accuracyHistory?: { timestamp: Date; value: number }[];

  // Optional customization
  title?: string;
  showPrediction?: boolean;
  showInsights?: boolean;
  compact?: boolean;
  className?: string;
}

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  label?: string;
  sublabel?: string;
  animated?: boolean;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 160,
  strokeWidth = 12,
  color = 'url(#progressGradient)',
  backgroundColor = 'var(--color-border)',
  label,
  sublabel,
  animated = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const normalizedValue = Math.min(Math.max(value, 0), max);
  const percentage = (normalizedValue / max) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="50%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-success)" />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          className="dark:opacity-30"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={animated ? { strokeDashoffset: circumference } : undefined}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold text-[var(--color-text-primary)]"
          initial={animated ? { opacity: 0, scale: 0.5 } : undefined}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {label || `${Math.round(percentage)}%`}
        </motion.span>
        {sublabel && (
          <span className="text-xs text-[var(--color-text-muted)] mt-1">{sublabel}</span>
        )}
      </div>
    </div>
  );
};

const TrendIndicator: React.FC<{ trend: TrendAnalysis }> = ({ trend }) => {
  const getIcon = () => {
    switch (trend.direction) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-[var(--color-success)]" />;
      case 'declining':
        return <TrendingDown className="w-5 h-5 text-[var(--color-error)]" />;
      default:
        return <Minus className="w-5 h-5 text-[var(--color-text-muted)]" />;
    }
  };

  const getColor = () => {
    switch (trend.direction) {
      case 'improving':
        return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
      case 'declining':
        return 'bg-[var(--color-error)]/10 text-[var(--color-error)]';
      default:
        return 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]';
    }
  };

  const getMessage = () => {
    if (trend.direction === 'improving') {
      return `+${Math.abs(trend.velocityPerDay).toFixed(1)}%/day`;
    } else if (trend.direction === 'declining') {
      return `${trend.velocityPerDay.toFixed(1)}%/day`;
    }
    return 'Stable';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getColor()}`}
    >
      {getIcon()}
      <span>{getMessage()}</span>
    </motion.div>
  );
};

const ConfidenceDisplay: React.FC<{ ci: ConfidenceInterval; accuracy: number }> = ({
  ci,
  accuracy,
}) => {
  const rangeWidth = ci.upper - ci.lower;
  const markerPosition = ((accuracy - ci.lower) / rangeWidth) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
        <span>{ci.lower.toFixed(1)}%</span>
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          95% Confidence
        </span>
        <span>{ci.upper.toFixed(1)}%</span>
      </div>
      <div className="relative h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
        {/* Gradient fill */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-accent)]/40 via-[var(--color-success)]/40 to-[var(--color-accent)]/40 opacity-30" />
        {/* Marker for current accuracy */}
        <motion.div
          initial={{ left: '0%' }}
          animate={{ left: `${Math.min(100, Math.max(0, markerPosition))}%` }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="absolute top-0 bottom-0 w-1 bg-[var(--color-text-inverse)] rounded-full shadow-md"
          style={{ transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
};

const PANCEPredictionBadge: React.FC<{
  prediction: ReturnType<typeof predictPANCEScore>;
}> = ({ prediction }) => {
  const getStatusColor = () => {
    if (prediction.predictedScore >= 450)
      return 'from-[var(--color-success)] to-[var(--color-accent)]';
    if (prediction.predictedScore >= 400)
      return 'from-[var(--color-accent)] to-[var(--color-accent)]/70';
    if (prediction.predictedScore >= 350)
      return 'from-[var(--color-warning)] to-[var(--color-warning)]/70';
    return 'from-[var(--color-error)] to-[var(--color-error)]/70';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
      className="mt-4 p-4 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded-xl border border-[var(--color-border)]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award
            className={`w-5 h-5 bg-gradient-to-r ${getStatusColor()} text-[var(--color-text-inverse)] rounded p-0.5`}
          />
          <span className="font-medium text-[var(--color-text-primary)]">
            PANCE Score Prediction
          </span>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          {prediction.range.min} - {prediction.range.max}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.2, type: 'spring' }}
          className={`text-4xl font-bold bg-gradient-to-r ${getStatusColor()} bg-clip-text text-transparent`}
        >
          {prediction.predictedScore}
        </motion.div>
        <div className="flex-1">
          <div className="text-sm font-medium text-[var(--color-text-primary)]">
            {prediction.passLikelihood}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">Passing score: ~350</div>
        </div>
      </div>
    </motion.div>
  );
};

const InsightsList: React.FC<{ insights: string[] }> = ({ insights }) => {
  if (insights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.3 }}
      className="mt-4 space-y-2"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
        <Sparkles className="w-4 h-4 text-[var(--color-warning)]" />
        Statistical Insights
      </div>
      <ul className="space-y-1.5">
        {insights.map((insight, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.4 + i * 0.1 }}
            className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]"
          >
            <ChevronRight className="w-4 h-4 mt-0.5 text-[var(--color-accent)] flex-shrink-0" />
            <span>{insight}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
};

export const LearningProgressCard: React.FC<LearningProgressCardProps> = ({
  accuracy,
  totalQuestions,
  accuracyHistory = [],
  title = 'Learning Progress',
  showPrediction = true,
  showInsights = true,
  compact = false,
  className = '',
}) => {
  // Calculate statistics
  const stats = useMemo(() => {
    const ci = calculateConfidenceInterval(
      Math.round((accuracy * totalQuestions) / 100),
      totalQuestions
    );

    const trend = accuracyHistory.length >= 2 ? analyzeTrend(accuracyHistory) : null;

    const prediction = showPrediction ? predictPANCEScore(accuracy, totalQuestions) : null;

    const insights = showInsights
      ? generateLearningInsights(accuracyHistory, accuracy, totalQuestions)
      : [];

    return { ci, trend, prediction, insights };
  }, [accuracy, totalQuestions, accuracyHistory, showPrediction, showInsights]);

  // Get grade color
  const getGradeInfo = () => {
    if (accuracy >= 90) return { grade: 'A', color: 'text-[var(--color-success)]' };
    if (accuracy >= 80) return { grade: 'B', color: 'text-[var(--color-accent)]' };
    if (accuracy >= 70) return { grade: 'C', color: 'text-[var(--color-warning)]' };
    if (accuracy >= 60) return { grade: 'D', color: 'text-[var(--color-warning)]' };
    return { grade: 'F', color: 'text-[var(--color-error)]' };
  };

  const gradeInfo = getGradeInfo();

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 bg-[var(--color-bg-primary)] rounded-xl shadow-sm border border-[var(--color-border)] ${className}`}
      >
        <div className="flex items-center gap-4">
          <CircularProgress value={accuracy} size={80} strokeWidth={8} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</span>
              {stats.trend && <TrendIndicator trend={stats.trend} />}
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {totalQuestions} questions answered
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 bg-[var(--color-bg-primary)] rounded-2xl shadow-lg border border-[var(--color-border)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-accent)] rounded-lg">
            <Brain className="w-5 h-5 text-[var(--color-text-inverse)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">{title}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Based on {totalQuestions} questions
            </p>
          </div>
        </div>
        {stats.trend && <TrendIndicator trend={stats.trend} />}
      </div>

      {/* Main progress */}
      <div className="flex flex-col items-center mb-6">
        <CircularProgress value={accuracy} label={`${Math.round(accuracy)}%`} sublabel="Accuracy" />

        {/* Grade badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: 'spring' }}
          className="mt-4 flex items-center gap-2"
        >
          <span className="text-sm text-[var(--color-text-muted)]">Grade:</span>
          <span className={`text-2xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</span>
        </motion.div>
      </div>

      {/* Confidence interval */}
      {totalQuestions >= 5 && (
        <div className="mb-4">
          <ConfidenceDisplay ci={stats.ci} accuracy={accuracy} />
        </div>
      )}

      {/* Warning for low sample size */}
      {totalQuestions < 10 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 p-3 bg-[var(--color-warning)]/10 rounded-lg text-[var(--color-warning)] text-sm"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Answer more questions for stable statistics</span>
        </motion.div>
      )}

      {/* PANCE prediction */}
      {stats.prediction && totalQuestions >= 20 && (
        <PANCEPredictionBadge prediction={stats.prediction} />
      )}

      {/* Insights */}
      {showInsights && <InsightsList insights={stats.insights} />}
    </motion.div>
  );
};

export default LearningProgressCard;
