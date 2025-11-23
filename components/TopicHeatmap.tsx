
import React from 'react';
import type { TopicStats } from '../types';
import { PANCE_TOPIC_ABBREVIATIONS, ABBREVIATION_TO_TOPIC_MAP } from '../constants';

interface TopicHeatmapProps {
  topicScores: TopicStats[];
  onTopicClick: (stats: TopicStats) => void;
}

const TopicHeatmap: React.FC<TopicHeatmapProps> = ({ topicScores, onTopicClick }) => {
  const topicStatsMap = new Map<string, TopicStats>(topicScores.map(item => [item.topic, item]));

  const getTileColor = (topicAbbr: string): string => {
    const score = topicStatsMap.get(topicAbbr)?.score;
    if (score === undefined) {
      return 'bg-[#ECECEC] text-slate-500';
    }
    if (score < 75) {
      return 'bg-red-100 text-red-800';
    }
    if (score < 85) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {PANCE_TOPIC_ABBREVIATIONS.map(abbr => {
        const stats = topicStatsMap.get(abbr);
        const hasData = !!stats;

        return (
          <button
            key={abbr}
            onClick={() => { if (stats) onTopicClick(stats); }}
            disabled={!hasData}
            className={`p-3 rounded-xl text-center font-semibold text-xs h-20 flex items-center justify-center transition-all duration-200 shadow-sm
              ${getTileColor(abbr)}
              ${hasData ? 'hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3D1B0E]' : ''}
              disabled:cursor-not-allowed disabled:opacity-70`}
            title={hasData ? `${ABBREVIATION_TO_TOPIC_MAP[abbr]}: ${stats.score.toFixed(0)}%` : `${ABBREVIATION_TO_TOPIC_MAP[abbr]}: No data`}
          >
            {abbr}
          </button>
        );
      })}
    </div>
  );
};

export default TopicHeatmap;