
import React from 'react';
import { motion } from 'framer-motion';
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
      return 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)]';
    }
    if (score < 75) {
      return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
    }
    if (score < 85) {
      return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
    }
    return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {PANCE_TOPIC_ABBREVIATIONS.map((abbr, index) => {
        const stats = topicStatsMap.get(abbr);
        const hasData = !!stats;

        return (
          <motion.button
            key={abbr}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => { if (stats) onTopicClick(stats); }}
            disabled={!hasData}
            whileHover={hasData ? { scale: 1.05, y: -2 } : {}}
            whileTap={hasData ? { scale: 0.98 } : {}}
            className={`p-3 rounded-xl text-center font-semibold text-xs h-20 flex items-center justify-center transition-all duration-200 shadow-sm border
              ${getTileColor(abbr)}
              ${hasData ? 'hover:shadow-lg cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            title={hasData ? `${ABBREVIATION_TO_TOPIC_MAP[abbr]}: ${stats.score.toFixed(0)}%` : `${ABBREVIATION_TO_TOPIC_MAP[abbr]}: No data`}
          >
            {abbr}
          </motion.button>
        );
      })}
    </div>
  );
};

export default TopicHeatmap;