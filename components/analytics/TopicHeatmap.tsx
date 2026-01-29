import React from 'react';
import { motion } from 'framer-motion';
import type { TopicStats } from '../types';
import { PANCE_TOPIC_ABBREVIATIONS, ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';

interface TopicHeatmapProps {
  topicScores: TopicStats[];
  onTopicClick: (stats: TopicStats) => void;
}

const TopicHeatmap: React.FC<TopicHeatmapProps> = ({ topicScores, onTopicClick }) => {
  const topicStatsMap = new Map<string, TopicStats>(topicScores.map((item) => [item.topic, item]));

  const getTileStyle = (topicAbbr: string): { bg: string; border: string; text: string } => {
    const score = topicStatsMap.get(topicAbbr)?.score;
    if (score === undefined) {
      // No data - Glass style
      return {
        bg: 'bg-white/70 dark:bg-slate-800/50',
        border: 'border-slate-200 dark:border-slate-700',
        text: 'text-slate-500 dark:text-slate-400',
      };
    }
    if (score < 75) {
      // Weakness - subtle slate-600 tinting (darker = lower score)
      return {
        bg: 'bg-slate-100 dark:bg-slate-700/20',
        border: 'border-slate-300 dark:border-slate-600/50',
        text: 'text-slate-600 dark:text-slate-400',
      };
    }
    if (score < 85) {
      // Moderate - slate-500 tinting
      return {
        bg: 'bg-slate-50 dark:bg-slate-600/20',
        border: 'border-slate-200 dark:border-slate-500/50',
        text: 'text-slate-500 dark:text-slate-400',
      };
    }
    // Strong - slate-300 tinting (lighter = higher score)
    return {
      bg: 'bg-slate-50 dark:bg-slate-500/20',
      border: 'border-slate-200 dark:border-slate-400/50',
      text: 'text-slate-400 dark:text-slate-300',
    };
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {PANCE_TOPIC_ABBREVIATIONS.map((abbr, index) => {
        const stats = topicStatsMap.get(abbr);
        const hasData = !!stats;
        const style = getTileStyle(abbr);
        const fullName = ABBREVIATION_TO_TOPIC_MAP[abbr];

        return (
          <motion.button
            key={abbr}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => {
              if (stats) onTopicClick(stats);
            }}
            disabled={!hasData}
            whileHover={hasData ? { scale: 1.03, y: -1 } : {}}
            whileTap={hasData ? { scale: 0.98 } : {}}
            className={`
              p-2 rounded-lg text-center transition-all duration-200 backdrop-blur-xl shadow-sm border
              aspect-[3/2] flex flex-col items-center justify-center
              ${style.bg} ${style.border} ${style.text}
              ${hasData ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed opacity-60'}
            `}
            title={hasData ? `${fullName}: ${stats.score.toFixed(0)}%` : `${fullName}: No data`}
          >
            <span className="text-xs font-bold">{abbr}</span>
            {hasData && (
              <span className="text-[10px] font-medium opacity-80">{stats.score.toFixed(0)}%</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default TopicHeatmap;
