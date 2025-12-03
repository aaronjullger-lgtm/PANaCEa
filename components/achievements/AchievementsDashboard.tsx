/**
 * Achievements Dashboard Component
 * Trophy Shelf UI displaying all achievements with filtering and stats
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Star, TrendingUp, Calendar } from 'lucide-react';
import { AchievementMedal } from './AchievementMedal';
import { StreakFlame } from './StreakFlame';
import { UnlockAnimation } from './UnlockAnimation';
import {
  ACHIEVEMENTS,
  sortAchievements,
  type AchievementRarity,
} from '../../config/achievements';

interface UserAchievement {
  achievementId: string;
  isUnlocked: boolean;
  progress: number;
  unlockedAt?: Date;
}

interface AchievementsDashboardProps {
  userAchievements: UserAchievement[];
  currentStreak: number;
  flameLevel: number;
  isActiveToday: boolean;
  onClose?: () => void;
}

export function AchievementsDashboard({
  userAchievements,
  currentStreak,
  flameLevel,
  isActiveToday,
  onClose,
}: AchievementsDashboardProps) {
  const [filterRarity, setFilterRarity] = useState<AchievementRarity | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [showUnlockAnimation, setShowUnlockAnimation] = useState<string | null>(null);

  // Calculate statistics
  const unlockedCount = userAchievements.filter((a) => a.isUnlocked).length;
  const totalCount = ACHIEVEMENTS.length;
  const completionPercent = Math.round((unlockedCount / totalCount) * 100);

  // Count by rarity
  const unlockedByRarity = userAchievements
    .filter((ua) => ua.isUnlocked)
    .reduce((acc, ua) => {
      const achievement = ACHIEVEMENTS.find((a) => a.id === ua.achievementId);
      if (achievement) {
        acc[achievement.rarity] = (acc[achievement.rarity] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

  // Filter achievements
  const filteredAchievements = sortAchievements(ACHIEVEMENTS).filter((achievement) => {
    const userAchievement = userAchievements.find((ua) => ua.achievementId === achievement.id);
    const isUnlocked = userAchievement?.isUnlocked || false;

    if (filterRarity !== 'all' && achievement.rarity !== filterRarity) return false;
    if (filterStatus === 'unlocked' && !isUnlocked) return false;
    if (filterStatus === 'locked' && isUnlocked) return false;

    return true;
  });

  return (
    <>
      <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-[var(--color-accent)]" />
                  Achievements
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Track your learning milestones and unlock rewards
                </p>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Overall Progress */}
              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-[var(--color-accent)]" />
                  <div className="text-xs text-[var(--color-text-muted)]">Progress</div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {completionPercent}%
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  {unlockedCount} of {totalCount}
                </div>
              </div>

              {/* Streak */}
              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <div className="text-xs text-[var(--color-text-muted)]">Current Streak</div>
                </div>
                <div className="flex items-center gap-2">
                  <StreakFlame
                    streak={currentStreak}
                    flameLevel={flameLevel}
                    isActiveToday={isActiveToday}
                    size="small"
                  />
                </div>
              </div>

              {/* Rare Achievements */}
              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-purple-500" />
                  <div className="text-xs text-[var(--color-text-muted)]">Rare+</div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {(unlockedByRarity.rare || 0) +
                    (unlockedByRarity.epic || 0) +
                    (unlockedByRarity.legendary || 0)}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  Rare or better
                </div>
              </div>

              {/* Recent */}
              <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <div className="text-xs text-[var(--color-text-muted)]">Recent</div>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {userAchievements
                    .filter((a) => {
                      if (!a.unlockedAt) return false;
                      const daysSince = (Date.now() - a.unlockedAt.getTime()) / (1000 * 60 * 60 * 24);
                      return daysSince <= 7;
                    })
                    .length}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  This week
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] p-4">
            <div className="flex flex-wrap gap-3">
              {/* Status Filter */}
              <div className="flex gap-2">
                {(['all', 'unlocked', 'locked'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === status
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

              <div className="w-px bg-[var(--color-border)]" />

              {/* Rarity Filter */}
              <div className="flex gap-2 flex-wrap">
                {(['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'] as const).map((rarity) => (
                  <button
                    key={rarity}
                    onClick={() => setFilterRarity(rarity)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterRarity === rarity
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Achievements Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {filteredAchievements.map((achievement) => {
                const userAchievement = userAchievements.find(
                  (ua) => ua.achievementId === achievement.id
                );
                return (
                  <div key={achievement.id} className="flex justify-center">
                    <AchievementMedal
                      achievementId={achievement.id}
                      isUnlocked={userAchievement?.isUnlocked || false}
                      progress={userAchievement?.progress || 0}
                      size="large"
                      showTooltip={true}
                    />
                  </div>
                );
              })}
            </div>

            {filteredAchievements.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4 opacity-50" />
                <p className="text-[var(--color-text-muted)]">
                  No achievements match your filters
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Unlock Animation */}
      {showUnlockAnimation && (
        <UnlockAnimation
          achievementId={showUnlockAnimation}
          onComplete={() => setShowUnlockAnimation(null)}
        />
      )}
    </>
  );
}
