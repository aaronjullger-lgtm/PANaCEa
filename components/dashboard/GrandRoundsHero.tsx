'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  Zap,
  TrendingUp,
  X,
  ChevronDown,
} from 'lucide-react';

interface GrandRoundsHeroProps {
  /** User's completion status for today's challenge */
  userStatus: 'not_started' | 'in_progress' | 'completed';
  /** User's score if completed */
  userScore?: number;
  /** Global mean score for today's challenge */
  globalMeanScore?: number;
  /** User's percentile ranking */
  userPercentile?: number;
  /** Total participants today */
  participantCount: number;
  /** Today's challenge topic */
  challengeTopic: string;
  /** Challenge difficulty */
  difficulty: 'intermediate' | 'advanced' | 'expert';
  /** Number of questions in challenge */
  questionCount: number;
  /** Estimated time in minutes */
  estimatedTimeMinutes: number;
  /** Callback when user clicks to start/continue */
  onStart: () => void;
  /** Callback when user dismisses (minimizes) the hero */
  onDismiss?: () => void;
  /** Whether the hero is minimized */
  isMinimized?: boolean;
  /** Callback to expand the hero */
  onExpand?: () => void;
}

/**
 * Grand Rounds Hero Banner
 * 
 * A prominent, full-width hero section at the top of the dashboard that highlights
 * today's daily challenge. Auto-adjusts based on user's completion status.
 */
export const GrandRoundsHero: React.FC<GrandRoundsHeroProps> = ({
  userStatus,
  userScore,
  globalMeanScore,
  userPercentile,
  participantCount,
  challengeTopic,
  difficulty,
  questionCount,
  estimatedTimeMinutes,
  onStart,
  onDismiss,
  isMinimized = false,
  onExpand,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getDifficultyBadge = () => {
    const colors = {
      intermediate: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      advanced: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      expert: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[difficulty]} capitalize`}>
        {difficulty}
      </span>
    );
  };

  const getStatusContent = () => {
    if (userStatus === 'completed') {
      return {
        headline: 'Challenge Complete!',
        subtext: `You scored ${userScore}% on "${challengeTopic}"`,
        ctaText: 'View Results',
        showStats: true,
      };
    }
    if (userStatus === 'in_progress') {
      return {
        headline: 'Continue Your Challenge',
        subtext: `Resume "${challengeTopic}" — your progress is saved`,
        ctaText: 'Continue',
        showStats: false,
      };
    }
    return {
      headline: "Today's Grand Rounds",
      subtext: challengeTopic,
      ctaText: 'Start Challenge',
      showStats: false,
    };
  };

  const content = getStatusContent();

  // Minimized state - show a compact banner
  if (isMinimized) {
    return (
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onExpand}
        className="w-full bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-700/30 rounded-xl p-3 mb-4 flex items-center justify-between hover:border-amber-600/50 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-amber-200">Grand Rounds:</span>
            <span className="text-sm text-amber-300/70 ml-2">{challengeTopic}</span>
          </div>
          {userStatus === 'completed' && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full border border-emerald-500/30">
              ✓ Completed
            </span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-amber-400 group-hover:translate-y-0.5 transition-transform" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full mb-6"
    >
      {/* Main Hero Card */}
      <div className={`
        relative overflow-hidden rounded-2xl border
        ${userStatus === 'completed' 
          ? 'bg-gradient-to-br from-emerald-900/40 via-emerald-800/30 to-teal-900/40 border-emerald-700/40'
          : 'bg-gradient-to-br from-amber-900/40 via-orange-800/30 to-red-900/40 border-amber-700/40'
        }
      `}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-amber-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-orange-500/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Dismiss button */}
        {onDismiss && userStatus === 'completed' && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all z-10"
            title="Minimize"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="relative z-[1] p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left: Content */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-3 rounded-xl ${userStatus === 'completed' ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                  <Trophy className={`w-6 h-6 ${userStatus === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`} />
                </div>
                {getDifficultyBadge()}
                {userStatus === 'completed' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full border border-emerald-500/30">
                    <CheckCircle className="w-3 h-3" />
                    Completed
                  </span>
                )}
              </div>

              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {content.headline}
              </h2>
              <p className="text-lg text-white/70 mb-4">
                {content.subtext}
              </p>

              {/* Quick stats row */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/60 mb-6">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{participantCount.toLocaleString()} participants today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{estimatedTimeMinutes} min • {questionCount} questions</span>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={onStart}
                className={`
                  inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all
                  ${userStatus === 'completed'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-900/30'
                  }
                `}
              >
                {content.ctaText}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Stats Panel (only shown when completed) */}
            {content.showStats && userScore !== undefined && globalMeanScore !== undefined && (
              <div className="lg:w-80 bg-black/20 rounded-xl p-5 border border-white/10">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
                  Your Performance
                </h3>
                
                <div className="space-y-4">
                  {/* Score comparison */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-white">{userScore}%</div>
                      <div className="text-xs text-white/50">Your Score</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold text-white/70">{globalMeanScore}%</div>
                      <div className="text-xs text-white/50">Global Mean</div>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${userScore}%` }}
                    />
                    <div
                      className="absolute top-0 h-full w-0.5 bg-white/50"
                      style={{ left: `${globalMeanScore}%` }}
                    />
                  </div>

                  {/* Percentile */}
                  {userPercentile !== undefined && (
                    <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                      <TrendingUp className={`w-5 h-5 ${userPercentile >= 50 ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <div>
                        <div className="text-sm font-medium text-white">
                          Top {100 - userPercentile}% of participants
                        </div>
                        <div className="text-xs text-white/50">
                          Ranked #{Math.ceil(participantCount * (1 - userPercentile / 100))} of {participantCount}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default GrandRoundsHero;
