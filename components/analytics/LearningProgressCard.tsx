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
  backgroundColor = '#e2e8f0',
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
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
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
          className="text-3xl font-bold text-slate-800 dark:text-slate-100"
          initial={animated ? { opacity: 0, scale: 0.5 } : undefined}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {label || `${Math.round(percentage)}%`}
        </motion.span>
        {sublabel && (
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};

const TrendIndicator: React.FC<{ trend: TrendAnalysis }> = ({ trend }) => {
  const getIcon = () => {
    switch (trend.direction) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-emerald-500" />;
      case 'declining':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      default:
        return <Minus className="w-5 h-5 text-slate-400" />;
    }
  };

  const getColor = () => {
    switch (trend.direction) {
      case 'improving':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'declining':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
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

const ConfidenceDisplay: React.FC<{ ci: ConfidenceInterval; accuracy: number }> = ({ ci, accuracy }) => {
  const rangeWidth = ci.upper - ci.lower;
  const markerPosition = ((accuracy - ci.lower) / rangeWidth) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
        <span>{ci.lower.toFixed(1)}%</span>
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          95% Confidence
        </span>
        <span>{ci.upper.toFixed(1)}%</span>
      </div>
      <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        {/* Gradient fill */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 opacity-30"
        />
        {/* Marker for current accuracy */}
        <motion.div
          initial={{ left: '0%' }}
          animate={{ left: `${Math.min(100, Math.max(0, markerPosition))}%` }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="absolute top-0 bottom-0 w-1 bg-white dark:bg-slate-200 rounded-full shadow-md"
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
    if (prediction.predictedScore >= 450) return 'from-emerald-500 to-cyan-500';
    if (prediction.predictedScore >= 400) return 'from-blue-500 to-purple-500';
    if (prediction.predictedScore >= 350) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
      className="mt-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-slate-200 dark:border-slate-600"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className={`w-5 h-5 bg-gradient-to-r ${getStatusColor()} text-white rounded p-0.5`} />
          <span className="font-medium text-slate-700 dark:text-slate-200">
            PANCE Score Prediction
          </span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
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
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {prediction.passLikelihood}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Passing score: ~350
          </div>
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
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        <Sparkles className="w-4 h-4 text-amber-500" />
        Statistical Insights
      </div>
      <ul className="space-y-1.5">
        {insights.map((insight, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.4 + i * 0.1 }}
            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
          >
            <ChevronRight className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
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
      Math.round(accuracy * totalQuestions / 100),
      totalQuestions
    );
    
    const trend = accuracyHistory.length >= 2 
      ? analyzeTrend(accuracyHistory)
      : null;
    
    const prediction = showPrediction 
      ? predictPANCEScore(accuracy, totalQuestions)
      : null;
    
    const insights = showInsights
      ? generateLearningInsights(accuracyHistory, accuracy, totalQuestions)
      : [];
    
    return { ci, trend, prediction, insights };
  }, [accuracy, totalQuestions, accuracyHistory, showPrediction, showInsights]);

  // Get grade color
  const getGradeInfo = () => {
    if (accuracy >= 90) return { grade: 'A', color: 'text-emerald-500' };
    if (accuracy >= 80) return { grade: 'B', color: 'text-blue-500' };
    if (accuracy >= 70) return { grade: 'C', color: 'text-amber-500' };
    if (accuracy >= 60) return { grade: 'D', color: 'text-orange-500' };
    return { grade: 'F', color: 'text-red-500' };
  };

  const gradeInfo = getGradeInfo();

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}
      >
        <div className="flex items-center gap-4">
          <CircularProgress value={accuracy} size={80} strokeWidth={8} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${gradeInfo.color}`}>
                {gradeInfo.grade}
              </span>
              {stats.trend && <TrendIndicator trend={stats.trend} />}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
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
      className={`p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Based on {totalQuestions} questions
            </p>
          </div>
        </div>
        {stats.trend && <TrendIndicator trend={stats.trend} />}
      </div>

      {/* Main progress */}
      <div className="flex flex-col items-center mb-6">
        <CircularProgress 
          value={accuracy} 
          label={`${Math.round(accuracy)}%`}
          sublabel="Accuracy"
        />
        
        {/* Grade badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: 'spring' }}
          className="mt-4 flex items-center gap-2"
        >
          <span className="text-sm text-slate-500 dark:text-slate-400">Grade:</span>
          <span className={`text-2xl font-bold ${gradeInfo.color}`}>
            {gradeInfo.grade}
          </span>
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
          className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-400 text-sm"
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
