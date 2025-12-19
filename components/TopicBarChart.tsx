
import React from 'react';
import type { TopicStats } from '../types';

interface TopicBarChartProps {
  topicScores: TopicStats[];
}

const TopicBarChart: React.FC<TopicBarChartProps> = ({ topicScores }) => {
  const getBarColor = (score: number): string => {
    if (score < 75) return 'bg-gradient-to-r from-amber-500 to-orange-500';
    if (score < 85) return 'bg-gradient-to-r from-blue-400 to-blue-600';
    return 'bg-gradient-to-r from-emerald-400 to-teal-500';
  };

  return (
    <div className="space-y-3">
      {topicScores.map(({ topic, score, correct, total }) => (
        <div key={topic} className="w-full">
          <div className="flex justify-between items-center mb-1 text-sm">
            <span className="font-semibold text-slate-700">{topic}</span>
            <span className="font-medium text-slate-500">{score.toFixed(0)}% ({correct}/{total})</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5">
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
