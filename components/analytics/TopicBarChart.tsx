import React from 'react';
import type { TopicStats } from '@/types';

interface TopicBarChartProps {
  topicScores: TopicStats[];
}

const TopicBarChart: React.FC<TopicBarChartProps> = ({ topicScores }) => {
  const getBarColor = (score: number): string => {
    if (score < 75)
      return 'bg-gradient-to-r from-[var(--color-data-fail)] to-[var(--color-data-fail)]';
    if (score < 85)
      return 'bg-gradient-to-r from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]';
    return 'bg-gradient-to-r from-[var(--color-data-pass)] to-[var(--color-data-pass)]';
  };

  return (
    <div className="space-y-3">
      {topicScores.map(({ topic, score, correct, total }) => (
        <div key={topic} className="w-full">
          <div className="flex justify-between items-center mb-1 text-sm">
            <span className="font-semibold text-[var(--color-text-primary)]">{topic}</span>
            <span className="font-medium text-[var(--color-text-muted)]">
              {score.toFixed(0)}% ({correct}/{total})
            </span>
          </div>
          <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${getBarColor(score)} transition-all duration-500 ease-out`}
              style={{ width: `${score}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TopicBarChart;
