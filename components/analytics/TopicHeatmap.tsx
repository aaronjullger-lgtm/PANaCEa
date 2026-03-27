import React from 'react';
import { motion } from 'framer-motion';
import type { TopicStats } from '@/types';
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
        bg: 'bg-[var(--color-bg-secondary)]/70',
        border: 'border-[var(--color-border)]',
        text: 'text-[var(--color-text-muted)]',
      };
    }
    if (score < 75) {
      // Weakness - data-fail tinting (darker = lower score)
      return {
        bg: 'bg-[var(--color-data-fail)]/10',
        border: 'border-[var(--color-data-fail)]/30',
        text: 'text-[var(--color-data-fail)]',
      };
    }
    if (score < 85) {
      // Moderate - data-provisional tinting
      return {
        bg: 'bg-[var(--color-data-provisional)]/10',
        border: 'border-[var(--color-data-provisional)]/30',
        text: 'text-[var(--color-data-provisional)]',
      };
    }
    // Strong - data-pass tinting (lighter = higher score)
    return {
      bg: 'bg-[var(--color-data-pass)]/10',
      border: 'border-[var(--color-data-pass)]/30',
      text: 'text-[var(--color-data-pass)]',
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
            initial={{ y: 10 }}
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
            title={
              hasData
                ? `${fullName}: ${stats.score.toFixed(0)}%`
                : `${fullName}: Complete 5+ questions per system to unlock mastery tracking`
            }
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
