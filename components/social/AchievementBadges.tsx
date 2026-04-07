/**
 * Achievement Badges Component
 * Sprint 8: Social & Gamification - Display earned and upcoming achievements
 *
 * Shows achievements in a visually appealing grid with progress indicators
 * for partially completed achievements.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Star,
  Flame,
  Target,
  Zap,
  Award,
  Medal,
  Crown,
  Heart,
  Brain,
  BookOpen,
  Clock,
  Calendar,
  TrendingUp,
  CheckCircle,
  Lock,
  X,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  icon: keyof typeof ACHIEVEMENT_ICONS;
  requirement: number;
  progress: number;
  unlockedAt?: Date;
  isSecret?: boolean;
  xpReward: number;
}

export type AchievementCategory =
  | 'streak'
  | 'accuracy'
  | 'volume'
  | 'mastery'
  | 'speed'
  | 'dedication'
  | 'social'
  | 'special';

export interface AchievementBadgesProps {
  achievements: Achievement[];
  showLocked?: boolean;
  onAchievementClick?: (achievement: Achievement) => void;
  compact?: boolean;
  maxVisible?: number;
  isLoading?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ACHIEVEMENT_ICONS = {
  trophy: Trophy,
  star: Star,
  flame: Flame,
  target: Target,
  zap: Zap,
  award: Award,
  medal: Medal,
  crown: Crown,
  heart: Heart,
  brain: Brain,
  book: BookOpen,
  clock: Clock,
  calendar: Calendar,
  trending: TrendingUp,
  check: CheckCircle,
};

const TIER_COLORS = {
  bronze: {
    bg: 'bg-[var(--color-bg-secondary)]',
    border: 'border-[var(--color-data-provisional)]',
    text: 'text-[var(--color-data-provisional)]',
    ring: 'ring-[var(--color-data-provisional)]',
    gradient: 'from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]',
  },
  silver: {
    bg: 'bg-[var(--color-bg-secondary)]',
    border: 'border-[var(--color-border)]',
    text: 'text-[var(--color-text-secondary)]',
    ring: 'ring-[var(--color-accent)]',
    gradient: 'from-[var(--color-text-muted)] to-[var(--color-text-secondary)]',
  },
  gold: {
    bg: 'bg-[var(--color-bg-secondary)]',
    border: 'border-[var(--color-data-provisional)]',
    text: 'text-[var(--color-data-provisional)]',
    ring: 'ring-[var(--color-data-provisional)]',
    gradient: 'from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]',
  },
  platinum: {
    bg: 'bg-[var(--color-bg-tertiary)]',
    border: 'border-[var(--color-border)]',
    text: 'text-[var(--color-text-primary)]',
    ring: 'ring-[var(--color-accent)]',
    gradient: 'from-[var(--color-text-secondary)] to-[var(--color-text-primary)]',
  },
  diamond: {
    bg: 'bg-[var(--color-bg-tertiary)]',
    border: 'border-[var(--color-border)]',
    text: 'text-[var(--color-accent)]',
    ring: 'ring-[var(--color-accent)]',
    gradient: 'from-[var(--color-accent)] to-[var(--color-accent)]',
  },
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  streak: 'Streaks',
  accuracy: 'Accuracy',
  volume: 'Volume',
  mastery: 'Mastery',
  speed: 'Speed',
  dedication: 'Dedication',
  social: 'Social',
  special: 'Special',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function AchievementBadges({
  achievements,
  showLocked = true,
  onAchievementClick,
  compact = false,
  maxVisible,
  isLoading = false,
}: AchievementBadgesProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [filter, setFilter] = useState<AchievementCategory | 'all' | 'unlocked'>('all');

  // Sort and filter achievements
  const filteredAchievements = useMemo(() => {
    let filtered = achievements;

    // Apply category/status filter
    if (filter === 'unlocked') {
      filtered = achievements.filter((a) => a.unlockedAt);
    } else if (filter !== 'all') {
      filtered = achievements.filter((a) => a.category === filter);
    }

    // Hide locked if requested
    if (!showLocked) {
      filtered = filtered.filter((a) => a.unlockedAt);
    }

    // Sort: unlocked first, then by tier, then by progress
    filtered.sort((a, b) => {
      if (a.unlockedAt && !b.unlockedAt) return -1;
      if (!a.unlockedAt && b.unlockedAt) return 1;

      const tierOrder = { diamond: 5, platinum: 4, gold: 3, silver: 2, bronze: 1 };
      if (tierOrder[a.tier] !== tierOrder[b.tier]) {
        return tierOrder[b.tier] - tierOrder[a.tier];
      }

      return b.progress / b.requirement - a.progress / a.requirement;
    });

    return maxVisible ? filtered.slice(0, maxVisible) : filtered;
  }, [achievements, filter, showLocked, maxVisible]);

  // Calculate stats
  const stats = useMemo(() => {
    const unlocked = achievements.filter((a) => a.unlockedAt);
    const totalXp = unlocked.reduce((sum, a) => sum + a.xpReward, 0);

    return {
      unlocked: unlocked.length,
      total: achievements.length,
      totalXp,
      percentage: Math.round((unlocked.length / achievements.length) * 100),
    };
  }, [achievements]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 bg-[var(--color-bg-secondary)] rounded animate-pulse" />
        <div className={`grid ${compact ? 'grid-cols-6' : 'grid-cols-4'} gap-3`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-[var(--color-bg-secondary)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Achievements</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              {stats.unlocked}/{stats.total} unlocked • {stats.totalXp.toLocaleString()} XP earned
            </p>
          </div>

          {/* Filter dropdown */}
          <select
            aria-label="Filter achievements"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          >
            <option value="all">All</option>
            <option value="unlocked">Unlocked</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Progress bar */}
      {!compact && (
        <div className="relative h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.percentage}%` }}
            transition={{ duration: 0.5 }}
            className="absolute h-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]"
          />
        </div>
      )}

      {/* Achievement grid */}
      <div className={`grid ${compact ? 'grid-cols-6 gap-2' : 'grid-cols-4 md:grid-cols-6 gap-3'}`}>
        {filteredAchievements.map((achievement, index) => {
          const isUnlocked = !!achievement.unlockedAt;
          const progress = Math.min(100, (achievement.progress / achievement.requirement) * 100);
          const tierColors = TIER_COLORS[achievement.tier] ?? TIER_COLORS.bronze;
          const IconComponent = ACHIEVEMENT_ICONS[achievement.icon] ?? Trophy;

          return (
            <motion.div
              key={achievement.id}
              initial={{ scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => {
                setSelectedAchievement(achievement);
                onAchievementClick?.(achievement);
              }}
              className={`
                relative aspect-square rounded-xl cursor-pointer
                transition-all hover:scale-105
                ${
                  isUnlocked
                    ? `${tierColors.bg} ${tierColors.border} border-2`
                    : 'bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border)]'
                }
              `}
            >
              {/* Progress ring for locked achievements */}
              {!isUnlocked && progress > 0 && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-[var(--color-text-muted)]/30"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={`${progress * 2.83} 283`}
                    className="text-[var(--color-accent)]"
                  />
                </svg>
              )}

              {/* Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                {isUnlocked ? (
                  <IconComponent
                    className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} ${tierColors.text}`}
                  />
                ) : (
                  <Lock
                    className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} text-[var(--color-text-muted)]`}
                  />
                )}
              </div>

              {/* Tier badge */}
              {isUnlocked && (
                <div
                  className={`
                  absolute -top-1 -right-1 w-4 h-4 rounded-full
                  bg-gradient-to-br ${tierColors.gradient}
                  flex items-center justify-center
                  text-[8px] font-bold text-white
                  shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]
                `}
                >
                  {(achievement.tier[0] ?? 'B').toUpperCase()}
                </div>
              )}

              {/* Secret achievement indicator */}
              {!isUnlocked && achievement.isSecret && (
                <div className="absolute top-1 left-1">
                  <span className="text-xs">🔮</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Show more link */}
      {maxVisible && achievements.length > maxVisible && (
        <div className="text-center">
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            View all {achievements.length} achievements →
          </button>
        </div>
      )}

      {/* Achievement detail modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={false}
            animate={{}}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--color-bg-primary)] rounded-2xl shadow-xl overflow-hidden"
            >
              {/* Header with gradient */}
              <div
                className={`
                relative h-32 bg-gradient-to-br ${TIER_COLORS[selectedAchievement.tier].gradient}
                flex items-center justify-center
              `}
              >
                <button
                  onClick={() => setSelectedAchievement(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-[var(--color-overlay)] hover:opacity-90"
                >
                  <X className="h-4 w-4 text-white" />
                </button>

                {(() => {
                  const iconKey = selectedAchievement.icon;
                  const iconLookup = ACHIEVEMENT_ICONS[iconKey];
                  const IconComponent = iconLookup !== undefined ? iconLookup : Trophy;
                  return (
                    <div
                      className={`
                      p-4 rounded-full bg-white/20 backdrop-blur-sm
                      ${selectedAchievement.unlockedAt ? '' : 'grayscale opacity-50'}
                    `}
                    >
                      <IconComponent className="h-12 w-12 text-white" />
                    </div>
                  );
                })()}
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xl font-bold text-[var(--color-text-primary)]">
                    {selectedAchievement.name}
                  </h4>
                  <span
                    className={`
                    px-2 py-0.5 text-xs font-medium rounded-full capitalize
                    ${TIER_COLORS[selectedAchievement.tier].bg}
                    ${TIER_COLORS[selectedAchievement.tier].text}
                  `}
                  >
                    {selectedAchievement.tier}
                  </span>
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  {selectedAchievement.description}
                </p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--color-text-muted)]">Progress</span>
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {selectedAchievement.progress.toLocaleString()}/
                      {selectedAchievement.requirement.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${TIER_COLORS[selectedAchievement.tier].gradient}`}
                      style={{
                        width: `${Math.min(100, (selectedAchievement.progress / selectedAchievement.requirement) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* XP Reward */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                  <span className="text-sm text-[var(--color-text-secondary)]">XP Reward</span>
                  <span className="text-lg font-bold text-[var(--color-accent)]">
                    +{selectedAchievement.xpReward.toLocaleString()} XP
                  </span>
                </div>

                {/* Unlocked date */}
                {selectedAchievement.unlockedAt && (
                  <p className="text-center text-xs text-[var(--color-text-muted)] mt-4">
                    Unlocked on {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AchievementBadges;
