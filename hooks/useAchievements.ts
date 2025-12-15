/**
 * Achievements and Streaks React Hook
 * Manages achievement state, unlocks, and streak tracking in the UI
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface UserAchievement {
  achievementId: string;
  isUnlocked: boolean;
  progress: number;
  unlockedAt?: Date;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  flameLevel: number;
  lastActiveDate: Date | null;
  isActiveToday: boolean;
}

interface AchievementState {
  achievements: UserAchievement[];
  streak: StreakInfo;
  recentUnlocks: string[];
  isLoading: boolean;
}

/**
 * Hook for managing user achievements and streaks
 */
export function useAchievements() {
  const { user, isSignedIn } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<AchievementState>({
    achievements: [],
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      flameLevel: 0,
      lastActiveDate: null,
      isActiveToday: false,
    },
    recentUnlocks: [],
    isLoading: true,
  });

  /**
   * Load achievements from API
   */
  const loadAchievements = useCallback(async () => {
    if (!userId || !isSignedIn) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // In production, this would call your API
      // For now, load from localStorage for offline support
      const stored = localStorage.getItem(`panacea_achievements_${userId}`);
      if (stored) {
        const data = JSON.parse(stored);
        setState({
          achievements: data.achievements || [],
          streak: data.streak || state.streak,
          recentUnlocks: [],
          isLoading: false,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to load achievements:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [userId, isSignedIn]);

  /**
   * Save achievements to storage
   */
  const saveAchievements = useCallback(
    (achievements: UserAchievement[], streak: StreakInfo) => {
      if (!userId) return;
      
      try {
        localStorage.setItem(
          `panacea_achievements_${userId}`,
          JSON.stringify({ achievements, streak })
        );
      } catch (error) {
        console.error('Failed to save achievements:', error);
      }
    },
    [userId]
  );

  /**
   * Unlock an achievement
   */
  const unlockAchievement = useCallback(
    (achievementId: string, progress: number = 100): boolean => {
      const existing = state.achievements.find((a) => a.achievementId === achievementId);
      if (existing?.isUnlocked) return false;

      const newAchievement: UserAchievement = {
        achievementId,
        isUnlocked: progress >= 100,
        progress,
        unlockedAt: progress >= 100 ? new Date() : undefined,
      };

      const updatedAchievements = existing
        ? state.achievements.map((a) =>
            a.achievementId === achievementId ? newAchievement : a
          )
        : [...state.achievements, newAchievement];

      setState((prev) => ({
        ...prev,
        achievements: updatedAchievements,
        recentUnlocks: progress >= 100 ? [achievementId, ...prev.recentUnlocks] : prev.recentUnlocks,
      }));

      saveAchievements(updatedAchievements, state.streak);
      return progress >= 100;
    },
    [state.achievements, state.streak, saveAchievements]
  );

  /**
   * Update daily streak
   */
  const updateStreak = useCallback(
    (questionsAnswered: number, accuracy: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastActive = state.streak.lastActiveDate
        ? new Date(state.streak.lastActiveDate)
        : null;
      
      if (lastActive) {
        lastActive.setHours(0, 0, 0, 0);
      }

      let newStreak = state.streak.currentStreak;
      const isActiveToday = lastActive?.getTime() === today.getTime();

      if (!isActiveToday) {
        // Check if continuing streak (yesterday) or breaking streak
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastActive?.getTime() === yesterday.getTime()) {
          newStreak += 1;
        } else if (lastActive) {
          newStreak = 1; // Streak broken, restart
        } else {
          newStreak = 1; // First day
        }
      }

      // Calculate flame level
      let flameLevel = 0;
      if (newStreak >= 3) flameLevel = 1;
      if (newStreak >= 7) flameLevel = 2;
      if (newStreak >= 14) flameLevel = 3;
      if (newStreak >= 30) flameLevel = 4;
      if (newStreak >= 100) flameLevel = 5;

      const updatedStreak: StreakInfo = {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, state.streak.longestStreak),
        flameLevel,
        lastActiveDate: today,
        isActiveToday: true,
      };

      setState((prev) => ({
        ...prev,
        streak: updatedStreak,
      }));

      saveAchievements(state.achievements, updatedStreak);

      // Check for streak achievements
      checkStreakAchievements(newStreak);
    },
    [state.streak, state.achievements, saveAchievements]
  );

  /**
   * Check and unlock streak-based achievements
   */
  const checkStreakAchievements = useCallback(
    (currentStreak: number) => {
      const streakMilestones = [
        { id: 'perfect_10', value: 10 },
        { id: 'flawless_20', value: 20 },
        { id: 'unstoppable_50', value: 50 },
        { id: 'legendary_100', value: 100 },
        { id: 'daily_dedication_7', value: 7 },
        { id: 'daily_dedication_30', value: 30 },
        { id: 'daily_dedication_100', value: 100 },
      ];

      streakMilestones.forEach((milestone) => {
        if (currentStreak >= milestone.value) {
          unlockAchievement(milestone.id);
        }
      });
    },
    [unlockAchievement]
  );

  /**
   * Check accuracy-based achievements
   */
  const checkAccuracyAchievements = useCallback(
    (accuracy: number, questionCount: number) => {
      if (accuracy >= 80 && questionCount >= 20) {
        unlockAchievement('accuracy_80_session');
      }
      if (accuracy >= 90 && questionCount >= 30) {
        unlockAchievement('accuracy_90_session');
      }
      if (accuracy >= 95 && questionCount >= 50) {
        unlockAchievement('accuracy_95_session');
      }
    },
    [unlockAchievement]
  );

  /**
   * Check question count achievements
   */
  const checkQuestionCountAchievements = useCallback(
    (totalQuestions: number) => {
      const milestones = [
        { id: 'first_correct', count: 1 },
        { id: 'questions_100', count: 100 },
        { id: 'questions_500', count: 500 },
        { id: 'questions_1000', count: 1000 },
        { id: 'questions_5000', count: 5000 },
      ];

      milestones.forEach((milestone) => {
        if (totalQuestions >= milestone.count) {
          unlockAchievement(milestone.id);
        }
      });
    },
    [unlockAchievement]
  );

  /**
   * Record session completion and check for achievements
   */
  const recordSession = useCallback(
    (questionsAnswered: number, correctAnswers: number, totalQuestions: number) => {
      const accuracy = (correctAnswers / questionsAnswered) * 100;
      
      // Update streak
      updateStreak(questionsAnswered, accuracy);
      
      // Check achievements
      checkAccuracyAchievements(accuracy, questionsAnswered);
      checkQuestionCountAchievements(totalQuestions);
    },
    [updateStreak, checkAccuracyAchievements, checkQuestionCountAchievements]
  );

  /**
   * Get next unlock animation to show
   */
  const getNextUnlock = useCallback((): string | null => {
    if (state.recentUnlocks.length > 0) {
      return state.recentUnlocks[0];
    }
    return null;
  }, [state.recentUnlocks]);

  /**
   * Clear shown unlock
   */
  const clearUnlock = useCallback(() => {
    setState((prev) => ({
      ...prev,
      recentUnlocks: prev.recentUnlocks.slice(1),
    }));
  }, []);

  // Load achievements on mount
  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  return {
    achievements: state.achievements,
    streak: state.streak,
    isLoading: state.isLoading,
    unlockAchievement,
    updateStreak,
    recordSession,
    getNextUnlock,
    clearUnlock,
    reload: loadAchievements,
  };
}
