/**
 * Root Cause Analysis Widget
 *
 * Displays a donut chart showing the breakdown of why users are getting questions wrong.
 * Uses the error taxonomy data (knowledge_gap, misread_question, guessing).
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, Eye, HelpCircle, PieChart, Award } from 'lucide-react';
import type { ErrorTag } from '../../types';

export interface ErrorTagCount {
  tag: ErrorTag;
  count: number;
}

interface RootCauseAnalysisProps {
  errorCounts: ErrorTagCount[];
  totalIncorrect: number;
}

const ERROR_TAG_CONFIG: Record<
  ErrorTag,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  knowledge_gap: {
    label: 'Knowledge Gap',
    color: 'var(--color-accent)',
    bgColor: 'bg-[var(--color-accent)]',
    icon: <Brain className="w-4 h-4" />,
  },
  misread_question: {
    label: 'Misread Question',
    color: 'var(--color-category-practice)',
    bgColor: 'bg-[var(--color-category-practice)]',
    icon: <Eye className="w-4 h-4" />,
  },
  guessing: {
    label: 'Guessing',
    color: 'var(--color-data-provisional)',
    bgColor: 'bg-data-provisional',
    icon: <HelpCircle className="w-4 h-4" />,
  },
};

// Simple SVG Donut Chart
const DonutChart: React.FC<{
  data: { tag: ErrorTag; count: number; percentage: number }[];
  size?: number;
}> = ({ data, size = 120 }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 20;

  // Calculate stroke-dasharray for each segment
  let cumulativePercentage = 0;

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-data-neutral"
        />
        <text x="50" y="55" textAnchor="middle" className="fill-data-neutral text-xs" fontSize="12">
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {data.map((item, index) => {
        const percentage = item.percentage;
        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
        cumulativePercentage += percentage;

        return (
          <motion.circle
            key={item.tag}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={ERROR_TAG_CONFIG[item.tag].color}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
            transform="rotate(-90 50 50)"
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1, pathLength: 1 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
          />
        );
      })}
    </svg>
  );
};

const RootCauseAnalysis: React.FC<RootCauseAnalysisProps> = ({ errorCounts, totalIncorrect }) => {
  const processedData = useMemo(() => {
    if (totalIncorrect === 0) return [];

    return errorCounts
      .filter((e) => e.count > 0)
      .map((e) => ({
        ...e,
        percentage: Math.round((e.count / totalIncorrect) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [errorCounts, totalIncorrect]);

  // Find the dominant error type for insight
  const dominantError = processedData.length > 0 ? processedData[0] : null;

  const getInsight = (): string => {
    if (!dominantError) return 'Start tagging your errors to see insights.';

    const percentage = dominantError.percentage;
    switch (dominantError.tag) {
      case 'knowledge_gap':
        return `${percentage}% of errors are knowledge gaps. Focus on reviewing weak topics.`;
      case 'misread_question':
        return `${percentage}% of errors are from misreading. Slow down and read carefully.`;
      case 'guessing':
        return `${percentage}% of errors are from guessing. Trust your preparation more.`;
      default:
        return 'Continue tagging errors to unlock insights.';
    }
  };

  const taggedCount = errorCounts.reduce((sum, e) => sum + e.count, 0);
  const untaggedCount = totalIncorrect - taggedCount;

  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="widget-premium-glass widget-noise-texture p-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-5 h-5 text-[var(--color-accent)]" />
        <span className="stat-label-sm">Root Cause Analysis</span>
      </div>

      {totalIncorrect === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-data-neutral">
            No incorrect answers to analyze yet.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut Chart */}
          <div className="flex-shrink-0">
            <DonutChart data={processedData} />
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {processedData.map((item) => (
              <div key={item.tag} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${ERROR_TAG_CONFIG[item.tag].bgColor}`} />
                  <span className="text-data-neutral text-xs">
                    {ERROR_TAG_CONFIG[item.tag].label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-light text-data-neutral">
                    {item.count}
                  </span>
                  <span className="text-xs text-data-neutral">({item.percentage}%)</span>
                </div>
              </div>
            ))}

            {untaggedCount > 0 && (
              <div className="flex items-center justify-between text-sm pt-1 border-t border-data-neutral">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-data-neutral" />
                  <span className="text-data-neutral text-xs">Untagged</span>
                </div>
                <span className="text-sm text-data-neutral">{untaggedCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insight */}
      {totalIncorrect > 0 && (
        <p className="text-[10px] text-data-neutral mt-4 pt-3 border-t border-data-neutral flex items-start gap-1">
          <Award className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{getInsight()}</span>
        </p>
      )}
    </motion.div>
  );
};

export default RootCauseAnalysis;
