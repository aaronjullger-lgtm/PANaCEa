/**
 * DailyPrescription Component
 * 
 * A "Smart Action" card that provides a dynamic study recommendation based on:
 * - Lowest performing system
 * - Oldest topic not studied recently
 * 
 * One-click start that bypasses settings for maximum efficiency.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Target, Calendar, ChevronRight, Award } from 'lucide-react';
import type { PerformanceRecord, SystemCode } from '../../types';
import { ABBREVIATION_TO_TOPIC_MAP } from '../../constants';

interface DailyPrescriptionProps {
  performanceData: PerformanceRecord[];
  onStartFocusSession: (system: SystemCode, topic?: string) => void;
}

interface SystemAnalysis {
  system: SystemCode;
  label: string;
  accuracy: number;
  lastStudied: number | null;
  count: number;
}

const DailyPrescription: React.FC<DailyPrescriptionProps> = ({
  performanceData,
  onStartFocusSession,
}) => {
  const prescription = useMemo(() => {
    if (performanceData.length < 5) {
      return null; // Not enough data
    }

    // Analyze each system
    const systemMap = new Map<SystemCode, { correct: number; total: number; lastTimestamp: number }>();

    for (const record of performanceData) {
      if (!record.system || record.system === 'OTHER') continue;
      
      const existing = systemMap.get(record.system) || { correct: 0, total: 0, lastTimestamp: 0 };
      systemMap.set(record.system, {
        correct: existing.correct + (record.isCorrect ? 1 : 0),
        total: existing.total + 1,
        lastTimestamp: Math.max(existing.lastTimestamp, record.timestamp),
      });
    }

    // Convert to array with analysis
    const systems: SystemAnalysis[] = Array.from(systemMap.entries())
      .filter(([_, data]) => data.total >= 3) // Only systems with enough data
      .map(([system, data]) => ({
        system,
        label: ABBREVIATION_TO_TOPIC_MAP[system] || system,
        accuracy: Math.round((data.correct / data.total) * 100),
        lastStudied: data.lastTimestamp,
        count: data.total,
      }));

    if (systems.length === 0) return null;

    // Find lowest accuracy system
    const lowestAccuracy = [...systems].sort((a, b) => a.accuracy - b.accuracy)[0];
    
    // Find oldest studied system (hasn't been studied in a while)
    const oldestStudied = [...systems].sort((a, b) => (a.lastStudied || 0) - (b.lastStudied || 0))[0];
    
    // Combine: prioritize lowest accuracy, but mention oldest if different
    const focusSystem = lowestAccuracy;
    const oldestTopic = oldestStudied.system !== lowestAccuracy.system ? oldestStudied : null;

    // Calculate days since last studied
    const daysSinceOldest = oldestStudied.lastStudied
      ? Math.floor((Date.now() - oldestStudied.lastStudied) / (1000 * 60 * 60 * 24))
      : null;

    return {
      focusSystem,
      oldestTopic,
      daysSinceOldest,
    };
  }, [performanceData]);

  if (!prescription) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 shadow-xl border border-slate-200 dark:border-slate-700"
      >
        <div className="absolute inset-0 noise-texture opacity-[0.03]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Daily Prescription
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Build Your Profile
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Complete at least 5 questions across multiple systems to unlock personalized recommendations.
          </p>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed"
          >
            <Target className="w-4 h-4" />
            Start Any Session to Begin
          </button>
        </div>
      </motion.div>
    );
  }

  const { focusSystem, oldestTopic, daysSinceOldest } = prescription;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 p-6 shadow-xl cursor-pointer group border border-slate-200 dark:border-slate-700"
      onClick={() => onStartFocusSession(focusSystem.system)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Noise texture overlay */}
      <div className="absolute inset-0 noise-texture opacity-[0.03]" />
      
      {/* Gradient accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-transparent rounded-bl-full" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Daily Prescription
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
        </div>

        {/* Main Focus */}
        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
          Focus: <span className="text-amber-600 dark:text-amber-400">{focusSystem.label}</span>
        </h3>
        
        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Target className="w-4 h-4" />
            <span>
              <span className="font-light text-2xl text-slate-900 dark:text-white">{focusSystem.accuracy}%</span>
              <span className="text-xs ml-1">accuracy</span>
            </span>
          </div>
          {oldestTopic && daysSinceOldest && daysSinceOldest > 3 && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">
                <span className="text-slate-700 dark:text-slate-300">{oldestTopic.label}</span> ({daysSinceOldest}d ago)
              </span>
            </div>
          )}
        </div>

        {/* Insight */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex items-start gap-1">
          <Award className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{focusSystem.accuracy < 60 
            ? `Your ${focusSystem.label} accuracy needs work. Let's drill in.`
            : focusSystem.accuracy < 80
            ? `Good progress on ${focusSystem.label}! Push for 80%+.`
            : `Fine-tuning ${focusSystem.label}. Keep the momentum!`
          }</span>
        </p>

        {/* CTA */}
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm group-hover:gap-3 transition-all">
          <span>Start Focused Session</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};

export default DailyPrescription;
