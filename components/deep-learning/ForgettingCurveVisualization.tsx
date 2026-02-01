/**
 * Forgetting Curve Visualization
 * Shows decay graphs for each topic with proficiency tracking
 * Phase 17: Requirement 65
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingDown,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  BarChart2,
} from 'lucide-react';
import type { PerformanceRecord, SystemCode } from '../../types';

interface ForgettingCurveProps {
  topic: string;
  performanceRecords: PerformanceRecord[];
}

interface ProficiencyData {
  date: string;
  proficiency: number;
  daysSince: number;
}

interface TopicProficiency {
  topic: string;
  currentProficiency: number;
  peakProficiency: number;
  lastReviewDate: string;
  daysSinceReview: number;
  decayRate: number;
  status: 'excellent' | 'good' | 'declining' | 'critical';
}

export const ForgettingCurveVisualization: React.FC<ForgettingCurveProps> = ({
  topic,
  performanceRecords,
}) => {
  const proficiencyData = useMemo(() => {
    return calculateProficiency(topic, performanceRecords);
  }, [topic, performanceRecords]);

  const curveData = useMemo(() => {
    return generateCurveData(proficiencyData);
  }, [proficiencyData]);

  if (performanceRecords.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <TrendingDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No performance data available for this topic yet.</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 dark:text-green-400';
      case 'good':
        return 'text-blue-600 dark:text-blue-400';
      case 'declining':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getRecommendation = (data: TopicProficiency) => {
    if (data.status === 'critical') {
      return `Urgent review needed! Your proficiency has dropped significantly.`;
    }
    if (data.status === 'declining') {
      return `Review now to boost proficiency back up before further decay.`;
    }
    if (data.status === 'good') {
      return `Schedule a review within the next few days to maintain proficiency.`;
    }
    return `Keep up the great work! Your proficiency is strong.`;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {proficiencyData.topic}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Last reviewed: {proficiencyData.lastReviewDate}
              <span className="text-sm ml-2">({proficiencyData.daysSinceReview} days ago)</span>
            </p>
          </div>
          <div className={`flex items-center gap-2 ${getStatusColor(proficiencyData.status)}`}>
            {getStatusIcon(proficiencyData.status)}
            <span className="font-semibold capitalize">{proficiencyData.status}</span>
          </div>
        </div>

        {/* Proficiency Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Peak Proficiency</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {proficiencyData.peakProficiency}%
            </div>
          </div>
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">
              Current Proficiency
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {proficiencyData.currentProficiency}%
            </div>
          </div>
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Decay Rate</div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {proficiencyData.decayRate}%/wk
            </div>
          </div>
        </div>
      </div>

      {/* Forgetting Curve Graph */}
      <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg border border-[var(--color-border)]">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Proficiency Over Time
        </h4>

        <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-[var(--color-text-muted)] pr-2">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          {/* Graph area */}
          <div className="ml-10 h-full relative">
            <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
              {/* Grid lines */}
              <line
                x1="0"
                y1="0"
                x2="500"
                y2="0"
                stroke="currentColor"
                strokeWidth="1"
                className="text-gray-200 dark:text-gray-700"
              />
              <line
                x1="0"
                y1="50"
                x2="500"
                y2="50"
                stroke="currentColor"
                strokeWidth="1"
                className="text-gray-200 dark:text-gray-700"
                strokeDasharray="4"
              />
              <line
                x1="0"
                y1="100"
                x2="500"
                y2="100"
                stroke="currentColor"
                strokeWidth="1"
                className="text-gray-200 dark:text-gray-700"
                strokeDasharray="4"
              />
              <line
                x1="0"
                y1="150"
                x2="500"
                y2="150"
                stroke="currentColor"
                strokeWidth="1"
                className="text-gray-200 dark:text-gray-700"
                strokeDasharray="4"
              />
              <line
                x1="0"
                y1="200"
                x2="500"
                y2="200"
                stroke="currentColor"
                strokeWidth="1"
                className="text-gray-200 dark:text-gray-700"
              />

              {/* Forgetting curve */}
              <motion.path
                d={generateCurvePath(curveData)}
                fill="none"
                stroke="url(#curveGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
              />

              {/* Area under curve */}
              <motion.path
                d={generateAreaPath(curveData)}
                fill="url(#areaGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ duration: 1, delay: 0.5 }}
              />

              {/* Data points */}
              {curveData.map((point, i) => (
                <motion.circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                />
              ))}

              {/* Gradients */}
              <defs>
                <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
              <span>Today</span>
              <span>7 days</span>
              <span>14 days</span>
              <span>21 days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white"
      >
        <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
          <BarChart2 className="w-5 h-5" /> Recommendation
        </h4>
        <p className="text-white/90 mb-4">{getRecommendation(proficiencyData)}</p>
        <button className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg font-semibold hover:bg-[var(--color-accent-hover)] transition-colors">
          Review {topic} Now
        </button>
      </motion.div>
    </div>
  );
};

/**
 * Calculate proficiency data for a topic
 */
function calculateProficiency(topic: string, records: PerformanceRecord[]): TopicProficiency {
  const topicRecords = records
    .filter((r) => r.topic === topic || r.system === topic)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (topicRecords.length === 0) {
    return {
      topic,
      currentProficiency: 0,
      peakProficiency: 0,
      lastReviewDate: 'Never',
      daysSinceReview: 999,
      decayRate: 0,
      status: 'critical',
    };
  }

  // Calculate rolling proficiency
  const windowSize = 10;
  let peakProficiency = 0;
  let currentProficiency = 0;

  for (let i = 0; i < topicRecords.length; i++) {
    const window = topicRecords.slice(Math.max(0, i - windowSize + 1), i + 1);
    const correct = window.filter((r) => r.isCorrect).length;
    const proficiency = (correct / window.length) * 100;

    if (proficiency > peakProficiency) {
      peakProficiency = proficiency;
    }
    if (i >= topicRecords.length - windowSize) {
      currentProficiency = proficiency;
    }
  }

  // Guard: array access returns T | undefined even after length check
  const lastRecord = topicRecords[topicRecords.length - 1];
  if (!lastRecord) {
    return {
      topic,
      currentProficiency: 0,
      peakProficiency: 0,
      lastReviewDate: 'Never',
      daysSinceReview: 999,
      decayRate: 0,
      status: 'critical',
    };
  }
  const lastReviewDate = new Date(lastRecord.timestamp).toLocaleDateString();
  const daysSinceReview = Math.floor((Date.now() - lastRecord.timestamp) / (1000 * 60 * 60 * 24));

  // Estimate decay rate (percentage points lost per week)
  // Multiply by 7 to convert from daily to weekly decay
  const decayRate =
    daysSinceReview > 0 ? ((peakProficiency - currentProficiency) / daysSinceReview) * 7 : 0;

  // Determine status
  let status: TopicProficiency['status'] = 'good';
  if (currentProficiency >= 85) status = 'excellent';
  else if (currentProficiency >= 70) status = 'good';
  else if (currentProficiency >= 50) status = 'declining';
  else status = 'critical';

  return {
    topic,
    currentProficiency: Math.round(currentProficiency),
    peakProficiency: Math.round(peakProficiency),
    lastReviewDate,
    daysSinceReview,
    decayRate: Math.round(Math.abs(decayRate)),
    status,
  };
}

// Forgetting curve constants
const CURVE_DECAY_SCALE = 100; // Scaling factor for exponential decay calculation

/**
 * Generate curve data points for visualization
 * Uses exponential decay: proficiency * e^(-decayRate * days / CURVE_DECAY_SCALE)
 */
function generateCurveData(
  proficiency: TopicProficiency
): Array<{ x: number; y: number; day: number }> {
  const points = [];
  const days = 21;
  const { currentProficiency, decayRate } = proficiency;

  for (let day = 0; day <= days; day++) {
    const x = (day / days) * 500;
    // Exponential decay formula with scaling factor
    const decay = currentProficiency * Math.exp((-decayRate * day) / CURVE_DECAY_SCALE);
    const y = 200 - (decay / 100) * 200;
    points.push({ x, y, day });
  }

  return points;
}

/**
 * Generate SVG path for the curve
 */
function generateCurvePath(data: Array<{ x: number; y: number }>): string {
  if (data.length === 0) return '';

  // Guard: array access returns T | undefined
  const firstPoint = data[0];
  if (!firstPoint) return '';

  let path = `M ${firstPoint.x} ${firstPoint.y}`;
  for (let i = 1; i < data.length; i++) {
    const point = data[i];
    if (point) {
      path += ` L ${point.x} ${point.y}`;
    }
  }
  return path;
}

/**
 * Generate SVG path for area under curve
 */
function generateAreaPath(data: Array<{ x: number; y: number }>): string {
  if (data.length === 0) return '';

  // Guard: array access returns T | undefined
  const firstPoint = data[0];
  const lastPoint = data[data.length - 1];
  if (!firstPoint || !lastPoint) return '';

  let path = `M ${firstPoint.x} 200`;
  path += ` L ${firstPoint.x} ${firstPoint.y}`;
  for (let i = 1; i < data.length; i++) {
    const point = data[i];
    if (point) {
      path += ` L ${point.x} ${point.y}`;
    }
  }
  path += ` L ${lastPoint.x} 200 Z`;
  return path;
}

export default ForgettingCurveVisualization;
