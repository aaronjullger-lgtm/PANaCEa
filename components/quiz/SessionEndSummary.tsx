/**
 * Session End Summary
 *
 * Comprehensive summary displayed when ending a study session.
 * Shows performance metrics, PANCE distribution adherence, and recommendations.
 * Syncs session analytics to the database.
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Flame,
  Zap,
  BookOpen,
  Cloud,
  CloudOff,
} from 'lucide-react';
// Domain services
import {
  getSessionSummary,
  calculateDistributionDrift,
  resetSessionDistribution,
  PANCE_SYSTEM_PERCENTAGES,
} from '@/services/domain';

// Session services
import {
  analyzePatterns,
  resetAnswerPatterns,
  calculateBehavioralCalibration,
  resetBehavioralRecords,
  getBehavioralInsights,
  resetMomentum,
  getMomentumInsights,
  resetPauseTracking,
} from '@/services/session';

// Analytics services
import {
  getPrediction,
  resetPrediction,
  collectSessionAnalytics,
  syncSessionAnalytics,
} from '@/services/analytics';
import { ABBREVIATION_TO_TOPIC_MAP } from '../../src/constants';
import type { PerformanceRecord } from '../../types';
import { StreakVisualization } from './StreakVisualization';
import { ScorePredictionCard } from './ScorePredictionCard';
import { MetacognitiveReflection } from '../session/MetacognitiveReflection';

interface SessionEndSummaryProps {
  isOpen?: boolean; // For conditional rendering from parent
  performanceData: PerformanceRecord[];
  sessionDurationMs?: number;
  sessionStartTime?: number;
  sessionSummary?: any; // PANCE distribution summary
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

export const SessionEndSummary: React.FC<SessionEndSummaryProps> = ({
  isOpen = true,
  performanceData,
  sessionDurationMs,
  sessionStartTime,
  sessionSummary: externalSummary,
  onClose,
  onReviewMissed,
  onStartNewSession,
  onContinueStudying,
  onViewAnalytics,
  sessionSettings,
}) => {
  const { getToken } = useAuth();
  const syncAttempted = useRef(false);
  const [syncStatus, setSyncStatus] = React.useState<'pending' | 'synced' | 'failed' | null>(null);
  const [showReflection, setShowReflection] = React.useState(false);

  // Use external summary if provided, otherwise calculate
  const summary = externalSummary || getSessionSummary();
  const drifts = calculateDistributionDrift();
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
      if (!systemStats[system]) {
        systemStats[system] = { correct: 0, total: 0 };
      }
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
        targetPercent: PANCE_SYSTEM_PERCENTAGES[system] || 0,
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
      color: 'text-[var(--color-data-fail)]',
      bg: 'bg-[var(--color-data-fail)]/10',
    };
  };

  const grade = getGrade(overallStats.accuracy);

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
          console.log('[SessionEndSummary] Analytics synced:', result.sessionId);
        } else {
          setSyncStatus('failed');
          console.warn('[SessionEndSummary] Sync failed:', result.error);
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

  // Clean up all session data on unmount
  const handleClose = () => {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--color-border)]"
      >
        {/* Header with Grade */}
        <div className={`${grade.bg} p-6 text-center border-b border-[var(--color-border)]`}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="mb-4"
          >
            <Trophy className={`w-16 h-16 mx-auto ${grade.color}`} />
          </motion.div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Session Complete!
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className={`text-5xl font-bold ${grade.color}`}>{grade.grade}</div>
            <div className="text-left">
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {overallStats.accuracy}%
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {overallStats.correct}/{overallStats.total} correct
              </div>
            </div>
          </div>
          {/* Sync status indicator */}
          {syncStatus && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs">
              {syncStatus === 'pending' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[var(--color-text-muted)] animate-pulse" />
                  <span className="text-[var(--color-text-secondary)]">Saving progress...</span>
                </>
              )}
              {syncStatus === 'synced' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[var(--color-data-pass)]" />
                  <span className="text-[var(--color-data-pass)]">Progress saved</span>
                </>
              )}
              {syncStatus === 'failed' && (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-[var(--color-data-provisional)]" />
                  <span className="text-[var(--color-data-provisional)]">Saved locally</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]">
              <Target className="w-6 h-6 mx-auto mb-2 text-[var(--color-accent)]" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {overallStats.total}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Questions</div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]">
              <Clock className="w-6 h-6 mx-auto mb-2 text-[var(--color-accent)]" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {overallStats.durationMinutes}m
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Duration</div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]">
              <Zap className="w-6 h-6 mx-auto mb-2 text-[var(--color-data-provisional)]" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {overallStats.questionsPerMinute}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Q/min</div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 text-center border border-[var(--color-border)]">
              <Flame className="w-6 h-6 mx-auto mb-2 text-[var(--color-data-provisional)]" />
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {overallStats.maxStreak}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">Best Streak</div>
            </div>
          </div>

          {/* Distribution Score */}
          <div className="mb-6 p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
                <span className="font-medium text-[var(--color-text-primary)]">
                  PANCE Distribution Score
                </span>
              </div>
              <span
                className={`text-xl font-bold ${
                  summary.distributionScore >= 80
                    ? 'text-[var(--color-data-pass)]'
                    : summary.distributionScore >= 60
                      ? 'text-[var(--color-data-provisional)]'
                      : 'text-[var(--color-data-fail)]'
                }`}
              >
                {summary.distributionScore}/100
              </span>
            </div>
            <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.distributionScore}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={`h-full rounded-full ${
                  summary.distributionScore >= 80
                    ? 'bg-[var(--color-data-pass)]'
                    : summary.distributionScore >= 60
                      ? 'bg-[var(--color-data-provisional)]'
                      : 'bg-[var(--color-data-fail)]'
                }`}
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
                      <div
                        className={`h-full rounded-full transition-all ${
                          sp.accuracy >= 80
                            ? 'bg-[var(--color-data-pass)]'
                            : sp.accuracy >= 60
                              ? 'bg-[var(--color-data-provisional)]'
                              : 'bg-[var(--color-data-fail)]'
                        }`}
                        style={{ width: `${sp.accuracy}%` }}
                      />
                    </div>
                    <span
                      className={`w-12 text-xs font-bold text-right ${
                        sp.accuracy >= 80
                          ? 'text-[var(--color-data-pass)]'
                          : sp.accuracy >= 60
                            ? 'text-[var(--color-data-provisional)]'
                            : 'text-[var(--color-data-fail)]'
                      }`}
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

          {/* Weak Areas Alert */}
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
                {patternAnalysis.overallInsights.slice(0, 3).map((insight, i) => (
                  <li
                    key={`pattern-${i}`}
                    className="flex items-start gap-2 text-sm text-[var(--color-accent)]"
                  >
                    <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
                {behavioralCalibration.insights.slice(0, 2).map((insight, i) => (
                  <li
                    key={`behavior-${i}`}
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
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col sm:flex-row gap-3">
          {overallStats.incorrect > 0 && onReviewMissed && (
            <button
              onClick={onReviewMissed}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)] font-medium hover:bg-[var(--color-data-provisional)]/30 transition-colors"
            >
              <XCircle className="w-5 h-5" />
              Review {overallStats.incorrect} Missed
            </button>
          )}

          {/* Metacognitive Reflection Button - Research shows 15-20% learning gains */}
          <button
            onClick={() => setShowReflection(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium hover:bg-[var(--color-accent)]/30 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent)]/90 transition-colors"
            >
              <Zap className="w-5 h-5" />
              New Session
            </button>
          )}

          <button
            onClick={handleClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-bg-tertiary)]/80 transition-colors border border-[var(--color-border)]"
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
          onComplete={(reflection) => {
            console.log('[SessionEndSummary] Reflection submitted:', reflection);
            // TODO: Sync to database via API
            setShowReflection(false);
          }}
          onSkip={() => setShowReflection(false)}
        />
      )}
    </motion.div>
  );
};

export default SessionEndSummary;
