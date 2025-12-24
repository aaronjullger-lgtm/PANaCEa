/**
 * SRSFeedbackBadge
 * 
 * Visual feedback component showing SRS scheduling results after answering a question.
 * Displays next review interval, applied modifiers, and FSRS v5 quality indicators.
 * Quality scoring accounts for question complexity (word count, media, labs).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Zap, TrendingUp, Award, Target, Brain } from 'lucide-react';
import type { SRSScheduleResult } from '../../lib/services/srsService';

interface SRSFeedbackBadgeProps {
  result: SRSScheduleResult;
  isCorrect: boolean;
}

export function SRSFeedbackBadge({ result, isCorrect }: SRSFeedbackBadgeProps) {
  const getIntervalText = (interval: number): string => {
    if (interval === 1) return 'tomorrow';
    if (interval < 7) return `in ${interval} days`;
    if (interval < 30) return `in ${Math.round(interval / 7)} weeks`;
    if (interval < 365) return `in ${Math.round(interval / 30)} months`;
    return `in ${Math.round(interval / 365)} years`;
  };

  const getQualityLabel = (quality: number): { text: string; color: string; icon: React.ReactNode } => {
    switch (quality) {
      case 5:
        return { text: 'Mastery', color: 'emerald', icon: <Award className="w-3.5 h-3.5" /> };
      case 4:
        return { text: 'Good Pace', color: 'blue', icon: <Target className="w-3.5 h-3.5" /> };
      case 3:
        return { text: 'Thoughtful', color: 'indigo', icon: <Brain className="w-3.5 h-3.5" /> };
      case 2:
        return { text: 'Needs Review', color: 'amber', icon: <TrendingUp className="w-3.5 h-3.5" /> };
      case 1:
      default:
        return { text: 'Rushed', color: 'red', icon: <Zap className="w-3.5 h-3.5" /> };
    }
  };

  const hasModifiers = result.modifiersApplied && result.modifiersApplied.length > 0;
  const hasStreakBonus = result.modifiersApplied?.includes('streak_bonus');
  const hasGoldMastery = result.modifiersApplied?.includes('gold_mastery');
  const hasFSRS = result.modifiersApplied?.includes('fsrs_v5');
  const hasRedZone = result.modifiersApplied?.includes('red_zone');
  const hasSlowResponse = result.modifiersApplied?.includes('slow_response');
  const hasAnchoringBias = result.modifiersApplied?.includes('anchoring_bias');

  const qualityInfo = getQualityLabel(result.qualityAdjusted);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-wrap items-center gap-2"
    >
      {/* Main review schedule badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
        isCorrect 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      }`}>
        <Calendar className={`w-4 h-4 ${isCorrect ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`} />
        <span className={`text-sm font-medium ${
          isCorrect 
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-amber-700 dark:text-amber-300'
        }`}>
          Review {getIntervalText(result.interval)}
        </span>
      </div>

      {/* Quality indicator - shows complexity-aware performance */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-${qualityInfo.color}-50 dark:bg-${qualityInfo.color}-900/20 border border-${qualityInfo.color}-200 dark:border-${qualityInfo.color}-800`}
      >
        <span className={`text-${qualityInfo.color}-600 dark:text-${qualityInfo.color}-400`}>
          {qualityInfo.icon}
        </span>
        <span className={`text-xs font-semibold text-${qualityInfo.color}-700 dark:text-${qualityInfo.color}-300`}>
          {qualityInfo.text}
        </span>
      </motion.div>

      {/* Streak bonus indicator */}
      {hasStreakBonus && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
        >
          <Zap className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">
            Streak
          </span>
        </motion.div>
      )}

      {/* Gold mastery indicator */}
      {hasGoldMastery && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
        >
          <Award className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
          <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
            Gold
          </span>
        </motion.div>
      )}

      {/* Red zone warning */}
      {hasRedZone && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        >
          <span className="text-xs font-medium text-red-700 dark:text-red-300">
            Focus Area
          </span>
        </motion.div>
      )}

      {/* FSRS adaptive indicator */}
      {hasFSRS && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
        >
          <TrendingUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
            FSRS v5
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default SRSFeedbackBadge;
