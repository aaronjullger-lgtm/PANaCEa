// components/modes/osce/RapportMeter.tsx
// Real-time Rapport Meter Display Component

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Frown, Star, Unlock, Lock, User, Sparkles } from 'lucide-react';
import type {
  RapportMeter as RapportMeterType,
  EmotionalState,
  PatientPersonalityMatrix,
} from '@/types/osce-enhanced';

interface RapportMeterProps {
  meter: RapportMeterType;
  emotionalState?: EmotionalState;
  personality?: PatientPersonalityMatrix;
  showMilestones?: boolean;
  compact?: boolean;
  className?: string;
}

export const RapportMeter: React.FC<RapportMeterProps> = ({
  meter,
  emotionalState,
  personality,
  showMilestones = true,
  compact = false,
  className = '',
}) => {
  const getRapportColor = (score: number) => {
    if (score >= 80)
      return { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/30' };
    if (score >= 65) return { bg: 'bg-blue-500', text: 'text-blue-500', ring: 'ring-blue-500/30' };
    if (score >= 50)
      return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/30' };
    if (score >= 30)
      return { bg: 'bg-orange-500', text: 'text-orange-500', ring: 'ring-orange-500/30' };
    return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/30' };
  };

  const getRapportLabel = (score: number) => {
    if (score >= 85) return 'Excellent Trust';
    if (score >= 70) return 'Good Rapport';
    if (score >= 50) return 'Neutral';
    if (score >= 30) return 'Guarded';
    return 'Distrustful';
  };

  const getEmotionIcon = (emotion?: string) => {
    switch (emotion) {
      case 'anxious':
        return '😰';
      case 'frustrated':
        return '😤';
      case 'tearful':
        return '😢';
      case 'angry':
        return '😠';
      case 'relieved':
        return '😌';
      default:
        return '😐';
    }
  };

  const colors = getRapportColor(meter.score);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${colors.bg} animate-pulse`} />
        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${colors.bg}`}
            initial={{ width: 0 }}
            animate={{ width: `${meter.score}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className={`text-xs font-medium ${colors.text}`}>{meter.score}</span>
        {emotionalState && (
          <span className="text-sm">{getEmotionIcon(emotionalState.current)}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className={`w-5 h-5 ${colors.text}`} />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">Patient Rapport</h3>
        </div>
        {emotionalState && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <span className="text-lg">{getEmotionIcon(emotionalState.current)}</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">
              {emotionalState.current}
            </span>
          </div>
        )}
      </div>

      {/* Main Score */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`relative w-16 h-16 rounded-full ${colors.ring} ring-4`}>
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-slate-200 dark:text-slate-700"
            />
            <motion.path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              className={colors.text}
              initial={{ strokeDasharray: '0, 100' }}
              animate={{ strokeDasharray: `${meter.score}, 100` }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${colors.text}`}>{meter.score}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className={`text-lg font-semibold ${colors.text}`}>
            {getRapportLabel(meter.score)}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" /> {meter.empathyPoints} empathy
            </span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" /> {meter.trustPoints} trust
            </span>
            <span className="flex items-center gap-1">
              <Frown className="w-3 h-3" /> {meter.frustrationPoints} frustration
            </span>
          </div>
        </div>
      </div>

      {/* Milestones */}
      {showMilestones && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Milestones
          </div>
          {meter.milestones.map((milestone, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                milestone.achieved
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                  : meter.score >= milestone.threshold - 10
                    ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                    : 'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {milestone.achieved ? (
                <Unlock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : meter.score >= milestone.threshold - 10 ? (
                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 animate-pulse" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs font-medium truncate ${
                    milestone.achieved
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : meter.score >= milestone.threshold - 10
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {milestone.unlocks}
                </div>
              </div>
              <div
                className={`text-xs font-mono ${
                  milestone.achieved
                    ? 'text-emerald-500'
                    : meter.score >= milestone.threshold - 10
                      ? 'text-amber-500'
                      : 'text-slate-400'
                }`}
              >
                {milestone.threshold}+
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Personality Info (optional) */}
      {personality && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Patient Personality
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
              {personality.communicationStyle}
            </span>
            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              {personality.healthLiteracy} literacy
            </span>
            <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
              {personality.painBehavior} pain
            </span>
            {personality.hiddenAgenda !== 'none' && (
              <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                hidden agenda
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Floating notification for rapport changes
export const RapportChangeNotification: React.FC<{
  change: number;
  reason?: string;
}> = ({ change, reason }) => {
  const isPositive = change > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
          isPositive ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4" />
          <span className="font-semibold">
            {isPositive ? '+' : ''}
            {change} Rapport
          </span>
        </div>
        {reason && <div className="text-xs opacity-80 mt-0.5">{reason}</div>}
      </motion.div>
    </AnimatePresence>
  );
};

// Mini version for inline display
export const RapportIndicator: React.FC<{
  score: number;
  emotion?: string;
}> = ({ score, emotion }) => {
  const getColor = (s: number) =>
    s >= 70 ? 'emerald' : s >= 50 ? 'blue' : s >= 30 ? 'amber' : 'red';

  const color = getColor(score);

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-6 h-6 rounded-full bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}
      >
        <Heart className={`w-3 h-3 text-${color}-500`} />
      </div>
      <span className={`text-sm font-medium text-${color}-600 dark:text-${color}-400`}>
        {score}
      </span>
      {emotion && (
        <span className="text-sm ml-1">
          {emotion === 'anxious'
            ? '😰'
            : emotion === 'frustrated'
              ? '😤'
              : emotion === 'relieved'
                ? '😌'
                : emotion === 'angry'
                  ? '😠'
                  : '😐'}
        </span>
      )}
    </div>
  );
};

export default RapportMeter;
