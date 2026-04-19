/**
 * Session End Summary
 *
 * Comprehensive summary displayed when ending a study session.
 * Shows performance metrics, PANCE distribution adherence, and recommendations.
 * Syncs session analytics to the database.
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/config/appViews';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  BarChart3,
  Award,
  AlertTriangle,
  XCircle,
  Flame,
  Zap,
  BookOpen,
  Cloud,
  CloudOff,
  Sparkles,
} from 'lucide-react';
// Domain services
import {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
} from '@/services/domain';
import { BLUEPRINT_PERCENT_BY_ABBREVIATION } from '@/lib/constants/blueprint';

// Session services
import {
  analyzePatterns,
  resetAnswerPatterns,
  calculateBehavioralCalibration,
  resetBehavioralRecords,
  resetMomentum,
  resetPauseTracking,
} from '@/services/session';
import { getAccuracyTextClass, getAccuracyBarClass } from '@/lib/accuracyColorUtils';

// Analytics services
import {
  getPrediction,
  resetPrediction,
  collectSessionAnalytics,
  syncSessionAnalytics,
} from '@/services/analytics';
import { ABBREVIATION_TO_TOPIC_MAP } from "@/config/topic-map";
import type { PerformanceRecord, SessionSettings, SystemCode } from '../../types';
import { StreakVisualization } from './StreakVisualization';
import { ScorePredictionCard } from './ScorePredictionCard';
import { MetacognitiveReflection } from '../session/MetacognitiveReflection';
import { GEMINI_FLASH_MODEL } from "@/config/topic-map";
import { fireStreakCelebration } from '@/lib/streakCelebration';
import { saveLastSession } from '@/lib/utils/sessionStorage';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import styles from './SessionEndSummary.module.css';

interface SessionEndSummaryProps {
  isOpen?: boolean; // For conditional rendering from parent
  performanceData: PerformanceRecord[];
  sessionDurationMs?: number;
  sessionStartTime?: number;
  sessionSummary?: ReturnType<typeof getSessionSummary>;
  /** When true, fire confetti once (e.g. user just completed daily target / streak milestone) */
  celebrateStreak?: boolean;
  onClose: () => void;
  onReviewMissed?: () => void;
  onStartNewSession?: () => void;
  onContinueStudying?: () => void;
  onViewAnalytics?: () => void;
  sessionSettings?: {
    mode?: string;
    focus?: string;
    // difficulty is always 'same' (PANCE-level)
  };
}

interface SystemPerformance {
  system: string;
  name: string;
  correct: number;
  total: number;
  accuracy: number;
  targetPercent: number;
  actualPercent: number;
}

function getDistributionScoreClass(score: number): string {
  return getAccuracyTextClass(score);
}

function getDistributionBarClass(score: number): string {
  return getAccuracyBarClass(score);
}

function getAccuracyClass(accuracy: number): string {
  return getAccuracyTextClass(accuracy);
}

/** Bar fill with width set via ref to satisfy no-inline-style linter; width is dynamic (accuracy %). */
function AccuracyBarFill({ accuracy, barClass }: Readonly<{ accuracy: number; barClass: string }>) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.style.setProperty('--bar-pct', `${accuracy}%`);
  }, [accuracy]);
  return (
    <div ref={ref} className={`h-full rounded-full transition-all ${barClass} ${styles.barFill}`} />
  );
}

export const SessionEndSummary: React.FC<SessionEndSummaryProps> = ({
  isOpen = true,
  performanceData,
  sessionDurationMs,
  sessionStartTime,
  sessionSummary: externalSummary,
  celebrateStreak = false,
  onClose,
  onReviewMissed,
  onStartNewSession,
  onContinueStudying,
  onViewAnalytics,
  sessionSettings,
}) => {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const syncAttempted = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Accessibility: focus trap — move focus into modal when open, restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      const timer = requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
      return () => cancelAnimationFrame(timer);
    }
    return undefined;
  }, [isOpen]);

  // Accessibility: keep Tab/Shift+Tab inside modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const root = modalRef.current;
    const getFocusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    root.addEventListener('keydown', handleKeyDown);
    return () => root.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Micro-interaction: confetti when user completed daily target / streak milestone
  useEffect(() => {
    if (celebrateStreak && isOpen) {
      const t = setTimeout(() => fireStreakCelebration(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [celebrateStreak, isOpen]);

  // Quick Wins: Save session data for "Resume" and "Welcome back" features
  useEffect(() => {
    if (!isOpen || performanceData.length === 0) return;

    const correct = performanceData.filter((p) => p.isCorrect).length;
    const accuracy = correct / performanceData.length;

    // Find weakest system from this session
    const systemStats: Record<string, { correct: number; total: number }> = {};
    for (const p of performanceData) {
      const sys = p.system || p.topic;
      if (!sys) continue;
      systemStats[sys] ??= { correct: 0, total: 0 };
      systemStats[sys].total++;
      if (p.isCorrect) systemStats[sys].correct++;
    }

    let weakSystem: SystemCode | undefined;
    let lowestAccuracy = 1;
    for (const [sys, stats] of Object.entries(systemStats)) {
      if (stats.total < 2) continue; // Need at least 2 questions
      const acc = stats.correct / stats.total;
      if (acc < lowestAccuracy) {
        lowestAccuracy = acc;
        weakSystem = sys as SystemCode;
      }
    }

    const fallbackSettings: SessionSettings = {
      focus: 'all',
      systems: [],
      count: performanceData.length,
    };
    const mergedSettings: SessionSettings = sessionSettings
      ? {
          ...fallbackSettings,
          ...sessionSettings,
          mode: sessionSettings.mode as SessionSettings['mode'],
          focus: (sessionSettings.focus ?? 'all') as SessionSettings['focus'],
        }
      : fallbackSettings;
    saveLastSession({
      timestamp: Date.now(),
      settings: mergedSettings,
      questionsCompleted: performanceData.length,
      questionsCorrect: correct,
      accuracy,
      weakSystem,
      weakSystemName: weakSystem ? ABBREVIATION_TO_TOPIC_MAP[weakSystem] : undefined,
      duration: sessionDurationMs || 0,
    });
  }, [isOpen, performanceData, sessionSettings, sessionDurationMs]);
  const [syncStatus, setSyncStatus] = React.useState<'pending' | 'synced' | 'failed' | null>(null);
  const [showReflection, setShowReflection] = React.useState(false);
  const [aiSummary, setAiSummary] = React.useState<string | null>(null);
  const [loadingAiSummary, setLoadingAiSummary] = React.useState(false);

  // Use external summary if provided, otherwise calculate
  const summary = externalSummary ?? getSessionSummary();
  calculateDistributionDrift();
  const patternAnalysis = analyzePatterns();
  const behavioralCalibration = calculateBehavioralCalibration();

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const total = performanceData.length;
    const correct = performanceData.filter((p) => p.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Calculate streaks
    let maxStreak = 0;
    let currentStreak = 0;
    const streaks: number[] = [];
    for (const p of performanceData) {
      if (p.isCorrect) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        if (currentStreak > 0) streaks.push(currentStreak);
        currentStreak = 0;
      }
    }
    // Push final streak if it ended on a correct answer
    if (currentStreak > 0) streaks.push(currentStreak);

    // Calculate average streak
    const avgStreak =
      streaks.length > 0
        ? Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 10) / 10
        : 0;

    // Calculate average time per question
    const avgTimePerQuestionMs =
      performanceData.length > 0
        ? performanceData.reduce((sum, p) => sum + (p.timeSpentMs || 0), 0) / performanceData.length
        : 0;

    // Duration
    const durationMinutes = sessionDurationMs
      ? Math.round(sessionDurationMs / 60000)
      : summary.sessionDuration;

    const questionsPerMinute =
      durationMinutes > 0 ? Math.round((total / durationMinutes) * 10) / 10 : 0;

    return {
      total,
      correct,
      incorrect: total - correct,
      accuracy,
      maxStreak,
      avgStreak,
      avgTimePerQuestionMs,
      durationMinutes,
      questionsPerMinute,
    };
  }, [performanceData, sessionDurationMs, summary]);

  // Calculate per-system performance
  const systemPerformance: SystemPerformance[] = useMemo(() => {
    const systemStats: Record<string, { correct: number; total: number }> = {};

    for (const p of performanceData) {
      const system = p.topic;
      systemStats[system] ??= { correct: 0, total: 0 };
      systemStats[system].total++;
      if (p.isCorrect) systemStats[system].correct++;
    }

    return Object.entries(systemStats)
      .map(([system, stats]) => ({
        system,
        name: ABBREVIATION_TO_TOPIC_MAP[system] || system,
        correct: stats.correct,
        total: stats.total,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        targetPercent: BLUEPRINT_PERCENT_BY_ABBREVIATION[system] || 0,
        actualPercent:
          overallStats.total > 0 ? Math.round((stats.total / overallStats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [performanceData, overallStats.total]);

  // Identify weak areas
  const weakAreas = systemPerformance.filter((s) => s.accuracy < 60 && s.total >= 3);
  const strongAreas = systemPerformance.filter((s) => s.accuracy >= 80 && s.total >= 3);

  // Get grade/rating
  const getGrade = (accuracy: number) => {
    if (accuracy >= 90)
      return {
        grade: 'A',
        color: 'text-[var(--color-data-pass)]',
        bg: 'bg-[var(--color-data-pass)]/10',
      };
    if (accuracy >= 80)
      return { grade: 'B', color: 'text-[var(--color-accent)]', bg: 'bg-[var(--color-accent)]/10' };
    if (accuracy >= 70)
      return {
        grade: 'C',
        color: 'text-[var(--color-data-provisional)]',
        bg: 'bg-[var(--color-data-provisional)]/10',
      };
    if (accuracy >= 60)
      return {
        grade: 'D',
        color: 'text-[var(--color-data-provisional)]',
        bg: 'bg-[var(--color-data-provisional)]/15',
      };
    return {
      grade: 'F',
      color: 'text-[var(--color-data-provisional)]',
      bg: 'bg-[var(--color-data-provisional)]/10',
    };
  };

  const grade = getGrade(overallStats.accuracy);

  const fetchAiSummary = React.useCallback(async () => {
    setLoadingAiSummary(true);
    setAiSummary(null);
    try {
      const systemsPracticed = systemPerformance.map((s) => s.name).join(', ') || 'mixed systems';
      const weakNames = weakAreas.map((w) => w.name).join(', ') || 'none';
      const strongNames = strongAreas.map((s) => s.name).join(', ') || 'none';
      const prompt = `You are a study coach. Based on this session summary, write exactly 1-2 short, encouraging sentences. Format: "Today you improved on X; consider focusing on Y next." Session: total questions ${overallStats.total}, correct ${overallStats.correct}, accuracy ${overallStats.accuracy}%. Systems practiced: ${systemsPracticed}. Weak areas this session: ${weakNames}. Strong areas: ${strongNames}. Reply with only the 1-2 sentences, no preamble.`;
      const { callGeminiText } = await import('@/services/ai/geminiService');
      const text = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.6);
      setAiSummary((text || '').trim());
    } catch (err) {
      console.warn('[SessionEndSummary] AI summary generation failed', err);
      setAiSummary("We couldn't generate a summary right now. Try again in a moment.");
    } finally {
      setLoadingAiSummary(false);
    }
  }, [overallStats, systemPerformance, weakAreas, strongAreas]);

  // Sync session analytics to database on mount
  useEffect(() => {
    if (syncAttempted.current || performanceData.length < 3) return;
    syncAttempted.current = true;

    const syncToDatabase = async () => {
      try {
        setSyncStatus('pending');

        // Get auth token
        const token = await getToken();

        // Calculate final streak (current streak at end of session)
        let finalStreak = 0;
        for (let i = performanceData.length - 1; i >= 0; i--) {
          const record = performanceData[i];
          if (!record) break;
          if (record.isCorrect) finalStreak++;
          else break;
        }

        // Collect all analytics
        const analytics = collectSessionAnalytics(
          sessionStartTime || Date.now() - (sessionDurationMs || 0),
          overallStats.total,
          overallStats.correct,
          overallStats.maxStreak,
          finalStreak,
          sessionSettings?.mode,
          sessionSettings?.focus,
          'same' // All sessions are PANCE-level
        );

        // Sync to database
        const result = await syncSessionAnalytics(analytics, token);

        if (result.success) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('failed');
        }
      } catch (error) {
        setSyncStatus('failed');
        console.error('[SessionEndSummary] Sync error:', error);
      }
    };

    syncToDatabase();
  }, [
    performanceData,
    sessionStartTime,
    sessionDurationMs,
    overallStats,
    sessionSettings,
    getToken,
  ]);

  // Clean up all session data on unmount; restore focus to element that opened the modal
  const handleClose = () => {
    previousActiveElement.current?.focus?.();
    resetSessionDistribution();
    resetAnswerPatterns();
    resetBehavioralRecords();
    resetMomentum();
    resetPrediction();
    resetPauseTracking();
    onClose();
  };

  // Get performance prediction
  const prediction = getPrediction();

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.2, ease: [0.32, 0, 0.67, 0] } }}
      transition={{ duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
    >
      <motion.div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-summary-title"
        initial={prefersReducedMotion ? false : { scale: 0.92, opacity: 0, y: 12, filter: 'blur(8px)' }}
        animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ scale: 0.95, opacity: 0, y: 8, filter: 'blur(4px)', transition: { duration: 0.18, ease: [0.32, 0, 0.67, 0] } }}
        transition={{ ...springs.bouncy, opacity: { duration: 0.25 }, filter: { duration: 0.3 } }}
        className="w-full max-w-2xl max-h-[90vh] bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] overflow-hidden border border-[var(--color-border)] outline-none"
      >
        {/* Header with Grade */}
        <div className={`${grade.bg} p-6 text-center border-b border-[var(--color-border)]`}>
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...springs.bouncy, delay: 0.2 }}
            className="mb-4"
          >
            <Trophy className={`w-16 h-16 mx-auto ${grade.color}`} aria-hidden="true" />
          </motion.div>
          <h2
            id="session-summary-title"
            className="text-2xl font-bold text-[var(--color-text-primary)] mb-2"
          >
            Session Complete!
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className={`text-5xl font-bold ${grade.color}`}>{grade.grade}</div>
            <div className="text-left">
              <div className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">
                {overallStats.accuracy}%
              </div>
              <div className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                {overallStats.correct}/{overallStats.total} correct
              </div>
            </div>
          </div>
          {/* Sync status indicator */}
          {syncStatus && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs">
              {syncStatus === 'pending' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[var(--color-text-muted)] animate-pulse" aria-hidden="true" />
                  <span className="text-[var(--color-text-secondary)]">Saving progress...</span>
                </>
              )}
              {syncStatus === 'synced' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[var(--color-data-pass)]" aria-hidden="true" />
                  <span className="text-[var(--color-data-pass)]">Progress saved</span>
                </>
              )}
              {syncStatus === 'failed' && (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-[var(--color-data-provisional)]" aria-hidden="true" />
                  <span className="text-[var(--color-data-provisional)]">Saved locally</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.3, ...springs.bouncy, opacity: { delay: 0.3, duration: 0.25 } }}
              className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]"
            >
              <Target className="w-6 h-6 mx-auto mb-2 text-[var(--color-accent)]" aria-hidden="true" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
                {overallStats.total}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Questions</div>
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.4, ...springs.bouncy, opacity: { delay: 0.4, duration: 0.25 } }}
              className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]"
            >
              <Clock className="w-6 h-6 mx-auto mb-2 text-[var(--color-accent)]" aria-hidden="true" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
                {overallStats.durationMinutes}m
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Duration</div>
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.5, ...springs.bouncy, opacity: { delay: 0.5, duration: 0.25 } }}
              className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]"
            >
              <Zap className="w-6 h-6 mx-auto mb-2 text-[var(--color-data-provisional)]" aria-hidden="true" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
                {overallStats.questionsPerMinute}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Q/min</div>
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.6, ...springs.bouncy, opacity: { delay: 0.6, duration: 0.25 } }}
              className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]"
            >
              <Flame className="w-6 h-6 mx-auto mb-2 text-[var(--color-data-provisional)]" aria-hidden="true" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
                {overallStats.maxStreak}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Best Streak</div>
            </motion.div>
          </div>

          {/* Distribution Score */}
          <div className="mb-6 p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" aria-hidden="true" />
                <span className="font-medium text-[var(--color-text-primary)]">
                  PANCE Distribution Score
                </span>
              </div>
              <span
                className={`text-xl font-bold ${getDistributionScoreClass(summary.distributionScore)}`}
              >
                <span className="tabular-nums">{summary.distributionScore}/100</span>
              </span>
            </div>
            <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                initial={prefersReducedMotion ? false : { width: 0, filter: 'blur(2px)' }}
                animate={{ width: `${summary.distributionScore}%`, filter: 'blur(0px)' }}
                transition={{ duration: 1, delay: 0.7, ease: [0.22, 1, 0.36, 1], filter: { duration: 0.4, delay: 0.9 } }}
                className={`h-full rounded-full ${getDistributionBarClass(summary.distributionScore)}`}
              />
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              How closely your session followed the official PANCE content blueprint
            </p>
          </div>

          {/* System Breakdown */}
          {systemPerformance.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Performance by System
              </h3>
              <div className="space-y-2">
                {systemPerformance.slice(0, 8).map((sp) => (
                  <div key={sp.system} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-medium text-[var(--color-text-secondary)]">
                      {sp.system}
                    </span>
                    <div className="flex-1 h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                      <AccuracyBarFill
                        accuracy={sp.accuracy}
                        barClass={getAccuracyBarClass(sp.accuracy)}
                      />
                    </div>
                    <span
                      className={`w-12 text-xs font-bold text-right ${getAccuracyClass(sp.accuracy)}`}
                    >
                      {sp.accuracy}%
                    </span>
                    <span className="w-10 text-xs text-[var(--color-text-muted)] text-right">
                      {sp.correct}/{sp.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Focus Areas Alert */}
          {weakAreas.length > 0 && (
            <div className="mb-6 p-4 bg-[var(--color-data-provisional)]/10 rounded-xl border border-[var(--color-data-provisional)]/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-[var(--color-data-provisional)]" />
                <span className="font-medium text-[var(--color-data-provisional)]">
                  Focus Areas
                </span>
              </div>
              <p className="text-sm text-[var(--color-data-provisional)]">
                {weakAreas.map((w) => w.name).join(', ')} — consider reviewing these topics
              </p>
            </div>
          )}

          {/* Strong Areas */}
          {strongAreas.length > 0 && (
            <div className="mb-6 p-4 bg-[var(--color-data-pass)]/10 rounded-xl border border-[var(--color-data-pass)]/30">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-[var(--color-data-pass)]" />
                <span className="font-medium text-[var(--color-data-pass)]">Strong Areas</span>
              </div>
              <p className="text-sm text-[var(--color-data-pass)]">
                {strongAreas.map((s) => s.name).join(', ')}
              </p>
            </div>
          )}

          {/* Behavioral Insights Section */}
          {(patternAnalysis.overallInsights.length > 0 ||
            behavioralCalibration.insights.length > 0) && (
            <div className="mb-6 p-4 bg-[var(--color-accent)]/10 rounded-xl border border-[var(--color-accent)]/30">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
                <span className="font-medium text-[var(--color-accent)]">Test-Taking Insights</span>
              </div>
              <ul className="space-y-2">
                {patternAnalysis.overallInsights.slice(0, 3).map((insight) => (
                  <li
                    key={`pattern-${insight.slice(0, 50)}`}
                    className="flex items-start gap-2 text-sm text-[var(--color-accent)]"
                  >
                    <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
                {behavioralCalibration.insights.slice(0, 2).map((insight) => (
                  <li
                    key={`behavior-${insight.slice(0, 50)}`}
                    className="flex items-start gap-2 text-sm text-[var(--color-accent)]"
                  >
                    <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>

              {/* Answer change stats */}
              {(patternAnalysis.changedToCorrect > 0 || patternAnalysis.changedToWrong > 0) && (
                <div className="mt-3 pt-3 border-t border-[var(--color-accent)]/30">
                  <p className="text-xs text-[var(--color-accent)] mb-2">Answer Changes</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-[var(--color-data-pass)]">
                      ✓ {patternAnalysis.changedToCorrect} helped
                    </span>
                    <span className="text-[var(--color-data-fail)]">
                      ✗ {patternAnalysis.changedToWrong} hurt
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sprint 4: Score Prediction Card */}
          {prediction && overallStats.total >= 5 && (
            <div className="mb-6">
              <ScorePredictionCard
                performanceData={performanceData}
                avgTimePerQuestionMs={overallStats.avgTimePerQuestionMs}
                maxStreak={overallStats.maxStreak}
                avgStreak={overallStats.avgStreak}
              />
            </div>
          )}

          {/* Sprint 4: Streak Visualization */}
          {performanceData.length >= 5 && (
            <div className="mb-6">
              <StreakVisualization performanceData={performanceData} maxDisplay={50} />
            </div>
          )}

          {/* Optional: AI session summary (1-2 sentences) */}
          <div className="mb-6 p-4 bg-[var(--color-accent)]/10 rounded-xl border border-[var(--color-accent)]/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
              <span className="font-medium text-[var(--color-accent)]">AI Summary</span>
            </div>
            {aiSummary ? (
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                {aiSummary}
              </p>
            ) : (
              <button
                onClick={fetchAiSummary}
                disabled={loadingAiSummary}
                className="text-sm text-[var(--color-accent)] font-medium hover:underline disabled:opacity-50 min-h-[44px] px-4 py-2"
              >
                {loadingAiSummary ? 'Generating AI summary…' : 'Get AI summary'}
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col sm:flex-row gap-3">
          {overallStats.incorrect > 0 && onReviewMissed && (
            <button
              onClick={onReviewMissed}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)] font-medium hover:bg-[var(--color-data-provisional)]/30 transition-colors duration-200 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <XCircle className="w-5 h-5" aria-hidden="true" />
              Review {overallStats.incorrect} To Review
            </button>
          )}

          {/* Metacognitive Reflection Button - Research shows 15-20% learning gains */}
          <button
            onClick={() => setShowReflection(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium hover:bg-[var(--color-accent)]/30 transition-colors duration-200 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            <BookOpen className="w-5 h-5" aria-hidden="true" />
            Reflect
          </button>

          {onStartNewSession && (
            <button
              onClick={() => {
                resetSessionDistribution();
                resetAnswerPatterns();
                resetBehavioralRecords();
                resetMomentum();
                resetPrediction();
                resetPauseTracking();
                onStartNewSession();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-accent-cta)] text-[var(--color-text-inverse)] font-medium hover:bg-[var(--color-accent-cta)]/90 transition-colors duration-200 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <Zap className="w-5 h-5" aria-hidden="true" />
              New Session
            </button>
          )}

          <button
            onClick={handleClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-bg-tertiary)]/80 transition-colors duration-200 border border-[var(--color-border)] min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      </motion.div>

      {/* Metacognitive Reflection Modal */}
      {showReflection && (
        <MetacognitiveReflection
          sessionPerformance={{
            totalQuestions: overallStats.total,
            correctAnswers: overallStats.correct,
            missedSystems: weakAreas.map((w) => w.name),
            missedConditions: performanceData
              .filter((p) => !p.isCorrect)
              .map((p) => p.condition || '')
              .filter(Boolean),
            averageTimePerQuestion: overallStats.avgTimePerQuestionMs,
            difficulty: 'medium', // PANCE-level is always medium
          }}
          onComplete={async (reflection) => {
            try {
              const token = await getToken();
              const response = await fetch(getApiEndpoint(API_ENDPOINTS.REFLECTION), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ reflection }),
              });
              if (!response.ok) {
                const errorText = await response.text();
                console.error('[SessionEndSummary] Failed to save reflection:', response.status, errorText);
                toast.error('Reflection could not be saved. Please try again.');
              }
            } catch (error) {
              console.error('[SessionEndSummary] Error saving reflection:', error);
              toast.error('Reflection could not be saved. Check your connection.');
            }
            setShowReflection(false);
          }}
          onSkip={() => setShowReflection(false)}
        />
      )}
    </motion.div>
  );
};

export default SessionEndSummary;
