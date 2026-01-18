/**
 * Cohort Leaderboard Component
 * Sprint 8: Social & Gamification - Weekly rankings within study groups
 *
 * Shows user rankings with animated transitions, highlighting improvements
 * and celebrating top performers.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Flame,
  Target,
  Users,
  ChevronUp,
  ChevronDown,
  Star,
} from 'lucide-react';
import type { LeaderboardEntry } from '../../services/studyGroupService';

// =============================================================================
// TYPES
// =============================================================================

export interface CohortLeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  groupName?: string;
  timeFrame?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  onTimeFrameChange?: (timeFrame: string) => void;
  onUserClick?: (userId: string) => void;
  showPodium?: boolean;
  compact?: boolean;
  isLoading?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RANK_COLORS = {
  1: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    border: 'border-yellow-400',
    text: 'text-yellow-700 dark:text-yellow-400',
    icon: Crown,
  },
  2: {
    bg: 'bg-slate-100 dark:bg-slate-700/30',
    border: 'border-slate-400',
    text: 'text-slate-600 dark:text-slate-300',
    icon: Medal,
  },
  3: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-400',
    text: 'text-amber-700 dark:text-amber-400',
    icon: Award,
  },
};

const TIME_FRAMES = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all-time', label: 'All Time' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function CohortLeaderboard({
  entries,
  currentUserId,
  groupName,
  timeFrame = 'weekly',
  onTimeFrameChange,
  onUserClick,
  showPodium = true,
  compact = false,
  isLoading = false,
}: CohortLeaderboardProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Get current user's position
  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    const entry = entries.find((e) => e.userId === currentUserId);
    return entry?.rank || null;
  }, [entries, currentUserId]);

  // Split entries for podium display
  const { podium, remaining } = useMemo(() => {
    if (!showPodium || entries.length < 3) {
      return { podium: [], remaining: entries };
    }
    return {
      podium: entries.slice(0, 3),
      remaining: entries.slice(3),
    };
  }, [entries, showPodium]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="flex justify-center gap-4 items-end">
          {[80, 100, 60].map((h, i) => (
            <div
              key={i}
              className="w-20 rounded-t-xl bg-slate-200 dark:bg-slate-700 animate-pulse"
              style={{ height: h }}
            />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
          No Activity Yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Be the first to study and claim the top spot!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {groupName ? `${groupName} Leaderboard` : 'Leaderboard'}
          </h3>
          {currentUserRank && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You're #{currentUserRank} of {entries.length}
            </p>
          )}
        </div>

        {/* Time frame selector */}
        {onTimeFrameChange && (
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeFrameChange(tf.value)}
                className={`
                  px-3 py-1 text-xs font-medium rounded-md transition-colors
                  ${
                    timeFrame === tf.value
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Podium Display */}
      {showPodium && podium.length === 3 && !compact && (
        <div className="flex justify-center items-end gap-4 py-4">
          {/* 2nd Place */}
          <PodiumSpot
            entry={podium[1]}
            position={2}
            currentUserId={currentUserId}
            onClick={() => onUserClick?.(podium[1].userId)}
          />

          {/* 1st Place */}
          <PodiumSpot
            entry={podium[0]}
            position={1}
            currentUserId={currentUserId}
            onClick={() => onUserClick?.(podium[0].userId)}
          />

          {/* 3rd Place */}
          <PodiumSpot
            entry={podium[2]}
            position={3}
            currentUserId={currentUserId}
            onClick={() => onUserClick?.(podium[2].userId)}
          />
        </div>
      )}

      {/* Remaining rankings */}
      <div className="space-y-2">
        {(showPodium && !compact ? remaining : entries).map((entry, index) => {
          const isCurrentUser = entry.userId === currentUserId;
          const isExpanded = expandedUserId === entry.userId;
          const rankConfig = RANK_COLORS[entry.rank as keyof typeof RANK_COLORS];

          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                relative rounded-xl border-2 transition-all cursor-pointer
                ${
                  isCurrentUser
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-600'
                    : rankConfig
                      ? `${rankConfig.bg} ${rankConfig.border}`
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }
                ${isExpanded ? 'ring-2 ring-indigo-500' : ''}
              `}
              onClick={() => {
                setExpandedUserId(isExpanded ? null : entry.userId);
                onUserClick?.(entry.userId);
              }}
            >
              <div className={`flex items-center gap-4 ${compact ? 'p-3' : 'p-4'}`}>
                {/* Rank */}
                <div
                  className={`
                  flex items-center justify-center font-bold
                  ${compact ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-lg'}
                  rounded-full
                  ${
                    rankConfig
                      ? `${rankConfig.bg} ${rankConfig.text}`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }
                `}
                >
                  {entry.rank <= 3 && rankConfig ? (
                    <rankConfig.icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                  ) : (
                    entry.rank
                  )}
                </div>

                {/* Avatar & Name */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.displayName}
                        className={`rounded-full ${compact ? 'h-6 w-6' : 'h-8 w-8'}`}
                      />
                    ) : (
                      <div
                        className={`
                        rounded-full bg-slate-200 dark:bg-slate-600
                        flex items-center justify-center
                        ${compact ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm'}
                      `}
                      >
                        {entry.displayName[0].toUpperCase()}
                      </div>
                    )}
                    <div className="truncate">
                      <span
                        className={`font-medium text-slate-900 dark:text-white ${compact ? 'text-sm' : ''}`}
                      >
                        {entry.displayName}
                      </span>
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                          (You)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                  {/* Trend */}
                  <div
                    className={`flex items-center gap-1 ${
                      entry.trend === 'up'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : entry.trend === 'down'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {entry.trend === 'up' && <ChevronUp className="h-4 w-4" />}
                    {entry.trend === 'down' && <ChevronDown className="h-4 w-4" />}
                    {entry.trend === 'stable' && <Minus className="h-4 w-4" />}
                  </div>

                  {/* Streak */}
                  {entry.streak > 0 && !compact && (
                    <div className="flex items-center gap-1 text-orange-500">
                      <Flame className="h-4 w-4" />
                      <span className="text-sm font-medium">{entry.streak}</span>
                    </div>
                  )}

                  {/* Score */}
                  <div className="text-right">
                    <p
                      className={`font-bold text-slate-900 dark:text-white ${compact ? 'text-sm' : 'text-lg'}`}
                    >
                      {entry.score.toLocaleString()}
                    </p>
                    {!compact && <p className="text-xs text-slate-500">pts</p>}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && !compact && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {entry.questionsAnswered}
                          </p>
                          <p className="text-xs text-slate-500">Questions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {Math.round(entry.accuracy)}%
                          </p>
                          <p className="text-xs text-slate-500">Accuracy</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-orange-500">{entry.streak}</p>
                          <p className="text-xs text-slate-500">Day Streak</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// PODIUM COMPONENT
// =============================================================================

interface PodiumSpotProps {
  entry: LeaderboardEntry;
  position: 1 | 2 | 3;
  currentUserId?: string;
  onClick?: () => void;
}

function PodiumSpot({ entry, position, currentUserId, onClick }: PodiumSpotProps) {
  const heights = { 1: 100, 2: 80, 3: 60 };
  const config = RANK_COLORS[position];
  const isCurrentUser = entry.userId === currentUserId;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: (4 - position) * 0.1 }}
      onClick={onClick}
      className={`
        flex flex-col items-center cursor-pointer
        ${position === 1 ? 'order-2' : position === 2 ? 'order-1' : 'order-3'}
      `}
    >
      {/* Avatar with crown for #1 */}
      <div className="relative mb-2">
        {position === 1 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="absolute -top-4 left-1/2 -translate-x-1/2"
          >
            <Crown className="h-6 w-6 text-yellow-500 fill-yellow-400" />
          </motion.div>
        )}

        {entry.avatarUrl ? (
          <img
            src={entry.avatarUrl}
            alt={entry.displayName}
            className={`
              rounded-full border-4 ${config.border}
              ${position === 1 ? 'h-16 w-16' : 'h-12 w-12'}
              ${isCurrentUser ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
            `}
          />
        ) : (
          <div
            className={`
            rounded-full flex items-center justify-center font-bold
            ${config.bg} ${config.text} border-4 ${config.border}
            ${position === 1 ? 'h-16 w-16 text-xl' : 'h-12 w-12 text-lg'}
            ${isCurrentUser ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
          `}
          >
            {entry.displayName[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <p
        className={`
        font-medium text-slate-900 dark:text-white truncate max-w-[80px]
        ${position === 1 ? 'text-sm' : 'text-xs'}
      `}
      >
        {entry.displayName}
      </p>

      {/* Score */}
      <p className={`text-xs ${config.text} font-bold`}>{entry.score.toLocaleString()}</p>

      {/* Podium */}
      <div
        className={`
          w-20 rounded-t-xl mt-2 flex items-center justify-center
          ${config.bg} border-2 ${config.border}
        `}
        style={{ height: heights[position] }}
      >
        <span className={`text-4xl font-black ${config.text}`}>{position}</span>
      </div>
    </motion.div>
  );
}

export default CohortLeaderboard;
