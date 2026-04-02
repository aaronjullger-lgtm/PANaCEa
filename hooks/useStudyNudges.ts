import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Configuration for study nudge behavior and notification preferences.
 */
export interface StudyNudgeConfig {
  /** UTC timestamp when the study session started (Date.now()) */
  sessionStartTime?: number;
  /** Running count of questions completed in current session */
  questionsCompleted?: number;
  /** Rolling accuracy as a decimal (0–1) */
  accuracy?: number;
  /** Current system/topic being studied (e.g. 'CV', 'PULM') */
  currentSystem?: string;
  /** Number of cards/questions due for review */
  dueReviewCount?: number;
  /** Current consecutive day study streak */
  dayStreak?: number;
  /** Notification level filter */
  notificationLevel: 'all' | 'important' | 'minimal' | 'off';
}

/**
 * Internal state tracking nudge cooldowns and last-fired times.
 */
interface NudgeState {
  lastBreakReminder: number;
  lastSessionSummary: number;
  lastStreakEncouragement: number;
  lastWeakAreaNudge: number;
  lastOverdueReminder: number;
}

const NUDGE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between same nudge type
const BREAK_REMINDER_INTERVAL_MS = 90 * 60 * 1000; // 90 minutes of study
const QUESTIONS_PER_SUMMARY = 25; // Trigger summary every 25 questions
const STREAK_MILESTONES = [7, 14, 30, 60, 100];

/**
 * useStudyNudges
 *
 * Monitors study behavior and triggers contextual toast notifications based on:
 * - Session duration (break reminders)
 * - Question completion milestones (progress summaries)
 * - Study streaks (encouragement)
 * - Accuracy drops (targeted help)
 * - Overdue reviews (review queue management)
 *
 * All nudges respect the notificationLevel filter:
 * - 'off': No notifications
 * - 'minimal': Break reminders only
 * - 'important': Break + weak area + overdue reminders
 * - 'all': All notification types
 */
export function useStudyNudges(config: StudyNudgeConfig) {
  const nudgeStateRef = useRef<NudgeState>({
    lastBreakReminder: 0,
    lastSessionSummary: 0,
    lastStreakEncouragement: 0,
    lastWeakAreaNudge: 0,
    lastOverdueReminder: 0,
  });

  const previousQuestionsRef = useRef(config.questionsCompleted ?? 0);
  const previousStreakRef = useRef(config.dayStreak ?? 0);
  const previousAccuracyRef = useRef(config.accuracy ?? 1);

  /**
   * Checks if a nudge type has exceeded its cooldown period.
   */
  const canFireNudge = (nudgeType: keyof NudgeState, now: number): boolean => {
    const lastFired = nudgeStateRef.current[nudgeType];
    return now - lastFired >= NUDGE_COOLDOWN_MS;
  };

  /**
   * Records that a nudge type was just fired, updating its timestamp.
   */
  const recordNudgeFired = (nudgeType: keyof NudgeState, now: number) => {
    nudgeStateRef.current[nudgeType] = now;
  };

  /**
   * Determines if a nudge should fire based on notification level.
   * - 'off': Never fire
   * - 'minimal': Only break reminders
   * - 'important': Break + weak area + overdue
   * - 'all': All types
   */
  const shouldFireForLevel = (nudgeType: string): boolean => {
    const { notificationLevel } = config;

    if (notificationLevel === 'off') return false;
    if (notificationLevel === 'minimal') return nudgeType === 'break';
    if (notificationLevel === 'important') {
      return ['break', 'weakArea', 'overdue'].includes(nudgeType);
    }
    // 'all'
    return true;
  };

  useEffect(() => {
    if (config.notificationLevel === 'off') return;

    const now = Date.now();

    // Break Reminder: After 90 minutes of continuous study
    if (
      config.sessionStartTime &&
      shouldFireForLevel('break') &&
      canFireNudge('lastBreakReminder', now)
    ) {
      const sessionDurationMs = now - config.sessionStartTime;
      if (sessionDurationMs >= BREAK_REMINDER_INTERVAL_MS) {
        toast.info(
          "You've been studying for 90 minutes — time for a 10-min break! Your brain consolidates better with rest."
        );
        recordNudgeFired('lastBreakReminder', now);
      }
    }

    // Session Summary: Every 25 questions completed
    if (
      config.questionsCompleted !== undefined &&
      shouldFireForLevel('summary') &&
      canFireNudge('lastSessionSummary', now)
    ) {
      const prevQuestions = previousQuestionsRef.current;
      if (
        config.questionsCompleted > prevQuestions &&
        config.questionsCompleted % QUESTIONS_PER_SUMMARY === 0
      ) {
        const accuracyPercent = config.accuracy
          ? Math.round(config.accuracy * 100)
          : 0;
        toast.success(
          `Nice work! 25 questions done with ${accuracyPercent}% accuracy.`
        );
        recordNudgeFired('lastSessionSummary', now);
      }
      previousQuestionsRef.current = config.questionsCompleted;
    }

    // Streak Encouragement: When dayStreak hits milestones
    if (
      config.dayStreak !== undefined &&
      shouldFireForLevel('streak') &&
      canFireNudge('lastStreakEncouragement', now)
    ) {
      const prevStreak = previousStreakRef.current;
      if (
        config.dayStreak > prevStreak &&
        STREAK_MILESTONES.includes(config.dayStreak)
      ) {
        toast.success(
          `🔥 ${config.dayStreak}-day streak! Consistency is the #1 predictor of PANCE success.`
        );
        recordNudgeFired('lastStreakEncouragement', now);
      }
      previousStreakRef.current = config.dayStreak;
    }

    // Weak Area Nudge: When accuracy drops below 60% in current system
    if (
      config.accuracy !== undefined &&
      config.currentSystem &&
      shouldFireForLevel('weakArea') &&
      canFireNudge('lastWeakAreaNudge', now)
    ) {
      const prevAccuracy = previousAccuracyRef.current;
      // Trigger if accuracy drops from ≥0.6 to <0.6, or was already below 0.6 and dropped further
      if (
        config.accuracy < 0.6 &&
        (prevAccuracy >= 0.6 || config.accuracy < prevAccuracy)
      ) {
        toast.warning(
          `Your ${config.currentSystem} accuracy is dropping. Quick targeted drill?`
        );
        recordNudgeFired('lastWeakAreaNudge', now);
      }
      previousAccuracyRef.current = config.accuracy;
    }

    // Overdue Reminder: If >50 cards due and not in active session
    if (
      config.dueReviewCount !== undefined &&
      config.dueReviewCount > 50 &&
      !config.sessionStartTime &&
      shouldFireForLevel('overdue') &&
      canFireNudge('lastOverdueReminder', now)
    ) {
      toast.warning(
        `You have ${config.dueReviewCount} overdue reviews. Even 10 minutes helps prevent forgetting.`
      );
      recordNudgeFired('lastOverdueReminder', now);
    }
  }, [
    config.sessionStartTime,
    config.questionsCompleted,
    config.accuracy,
    config.currentSystem,
    config.dueReviewCount,
    config.dayStreak,
    config.notificationLevel,
  ]);

  /**
   * Clean up on unmount to reset cooldowns if needed.
   */
  useEffect(() => {
    return () => {
      // Optional: could reset refs here if you want a fresh slate on remount.
      // For now, we keep cooldowns active to prevent toast spam across sessions.
    };
  }, []);
}
