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

  const getQualityLabel = (
    quality: number
  ): {
    text: string;
    badgeClass: string;
    iconClass: string;
    textClass: string;
    icon: React.ReactNode;
  } => {
    switch (quality) {
      case 5:
        return {
          text: 'Mastery',
          badgeClass: 'bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30',
          iconClass: 'text-[var(--color-data-pass)]',
          textClass: 'text-[var(--color-data-pass)]',
          icon: <Award className="w-3.5 h-3.5" />,
        };
      case 4:
        return {
          text: 'Good Pace',
          badgeClass: 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30',
          iconClass: 'text-[var(--color-accent)]',
          textClass: 'text-[var(--color-accent)]',
          icon: <Target className="w-3.5 h-3.5" />,
        };
      case 3:
        return {
          text: 'Thoughtful',
          badgeClass:
            'bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30',
          iconClass: 'text-[var(--color-data-provisional)]',
          textClass: 'text-[var(--color-data-provisional)]',
          icon: <Brain className="w-3.5 h-3.5" />,
        };
      case 2:
        return {
          text: 'Needs Review',
          badgeClass: 'bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30',
          iconClass: 'text-[var(--color-data-fail)]',
          textClass: 'text-[var(--color-data-fail)]',
          icon: <TrendingUp className="w-3.5 h-3.5" />,
        };
      case 1:
      default:
        return {
          text: 'Rushed',
          badgeClass: 'bg-[var(--color-data-fail)]/15 border border-[var(--color-data-fail)]/40',
          iconClass: 'text-[var(--color-data-fail)]',
          textClass: 'text-[var(--color-data-fail)]',
          icon: <Zap className="w-3.5 h-3.5" />,
        };
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
      initial={{ y: -10 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-wrap items-center gap-2"
    >
      {/* Main review schedule badge */}
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
          isCorrect
            ? 'bg-[var(--color-data-pass)]/10 border-[var(--color-data-pass)]/30'
            : 'bg-[var(--color-data-fail)]/10 border-[var(--color-data-fail)]/30'
        }`}
      >
        <Calendar
          className={`w-4 h-4 ${
            isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'
          }`}
        />
        <span
          className={`text-sm font-medium ${
            isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'
          }`}
        >
          Review {getIntervalText(result.interval)}
        </span>
      </div>

      {/* Quality indicator - shows complexity-aware performance */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${qualityInfo.badgeClass}`}
      >
        <span className={qualityInfo.iconClass}>{qualityInfo.icon}</span>
        <span className={`text-xs font-semibold ${qualityInfo.textClass}`}>{qualityInfo.text}</span>
      </motion.div>

      {/* Streak bonus indicator */}
      {hasStreakBonus && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30"
        >
          <Zap className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span className="text-xs font-semibold text-[var(--color-accent)]">Streak</span>
        </motion.div>
      )}

      {/* Gold mastery indicator */}
      {hasGoldMastery && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30"
        >
          <Award className="w-3.5 h-3.5 text-[var(--color-data-pass)]" />
          <span className="text-xs font-semibold text-[var(--color-data-pass)]">Gold</span>
        </motion.div>
      )}

      {/* Red zone warning */}
      {hasRedZone && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30"
        >
          <span className="text-xs font-medium text-[var(--color-data-fail)]">Focus Area</span>
        </motion.div>
      )}

      {/* FSRS adaptive indicator */}
      {hasFSRS && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30"
        >
          <TrendingUp className="w-3.5 h-3.5 text-[var(--color-data-provisional)]" />
          <span className="text-xs font-semibold text-[var(--color-data-provisional)]">
            FSRS v5
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default SRSFeedbackBadge;
