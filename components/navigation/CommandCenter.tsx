import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Target,
  Clock,
  Award,
  Brain,
  Zap,
  Star,
  ChevronRight,
  Activity,
  Calendar,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import type { PerformanceRecord, SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { useSRSItems } from '@/hooks/useSRSItems';

interface CommandCenterProps {
  performanceData: PerformanceRecord[];
  onNavigate: (destination: string) => void;
  userId: string;
}

interface UserPreferences {
  favoriteDrills: string[];
  recentDrills: string[];
  studyGoals: {
    dailyQuestions: number;
    targetSystems: SystemCode[];
  };
}

interface BenchmarkDelta {
  metric: string;
  current: number;
  previous: number;
  delta: number;
  trend: 'up' | 'down' | 'stable';
}

interface StudyRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  actionDestination: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CommandCenter: React.FC<CommandCenterProps> = ({ performanceData, onNavigate, userId }) => {
  const { getToken } = useAuth();
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    favoriteDrills: [],
    recentDrills: [],
    studyGoals: {
      dailyQuestions: 50,
      targetSystems: [],
    },
  });

  const [grandRoundsCompleted, setGrandRoundsCompleted] = useState(false);

  // Load user preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`panceai_preferences_${userId}`);
    if (saved) {
      setUserPreferences(JSON.parse(saved));
    }
  }, [userId]);

  // Grand Rounds completion: server-authoritative (no localStorage)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch('/api/grand-rounds/completed', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json?.data?.completed === true && !cancelled) setGrandRoundsCompleted(true);
        else if (!cancelled) setGrandRoundsCompleted(false);
      } catch {
        if (!cancelled) setGrandRoundsCompleted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, getToken]);

  // Fetch SRS items from database
  const { dueCount: srsDueCount, loading: srsLoading } = useSRSItems();

  // Calculate flagged count
  const flaggedCount = useMemo(() => {
    const flagged = localStorage.getItem('panceai_flagged_v2');
    return flagged ? JSON.parse(flagged).length : 0;
  }, []);

  // Calculate today's question count
  const todayQuestionCount = useMemo(() => {
    const today = new Date().toDateString();
    return performanceData.filter((r) => new Date(r.timestamp).toDateString() === today).length;
  }, [performanceData]);

  // Calculate current streak
  const currentStreak = useMemo(() => {
    const streakData = localStorage.getItem('panceai_daily_streak');
    return streakData ? JSON.parse(streakData).currentStreak || 0 : 0;
  }, []);

  // Calculate benchmark deltas
  const benchmarkDeltas = useMemo((): BenchmarkDelta[] => {
    const last7Days = performanceData.filter((r) => {
      const daysDiff = (Date.now() - new Date(r.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });

    const previous7Days = performanceData.filter((r) => {
      const daysDiff = (Date.now() - new Date(r.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 7 && daysDiff <= 14;
    });

    const currentAccuracy =
      last7Days.length > 0
        ? (last7Days.filter((r) => r.isCorrect).length / last7Days.length) * 100
        : 0;

    const previousAccuracy =
      previous7Days.length > 0
        ? (previous7Days.filter((r) => r.isCorrect).length / previous7Days.length) * 100
        : 0;

    const currentAvgTime =
      last7Days.length > 0
        ? last7Days.reduce((sum, r) => sum + (r.timeSpentMs || 0), 0) / last7Days.length / 1000
        : 0;

    const previousAvgTime =
      previous7Days.length > 0
        ? previous7Days.reduce((sum, r) => sum + (r.timeSpentMs || 0), 0) /
          previous7Days.length /
          1000
        : 0;

    const accuracyDelta = currentAccuracy - previousAccuracy;
    const timeDelta = currentAvgTime - previousAvgTime;

    return [
      {
        metric: 'Accuracy',
        current: currentAccuracy,
        previous: previousAccuracy,
        delta: accuracyDelta,
        trend: accuracyDelta > 2 ? 'up' : accuracyDelta < -2 ? 'down' : 'stable',
      },
      {
        metric: 'Avg Decision Time',
        current: currentAvgTime,
        previous: previousAvgTime,
        delta: timeDelta,
        trend: timeDelta < -2 ? 'up' : timeDelta > 2 ? 'down' : 'stable',
      },
      {
        metric: 'Questions/Day',
        current: last7Days.length / 7,
        previous: previous7Days.length / 7,
        delta: last7Days.length / 7 - previous7Days.length / 7,
        trend: last7Days.length / 7 > previous7Days.length / 7 ? 'up' : 'down',
      },
    ];
  }, [performanceData]);

  // Generate personalized recommendations
  const recommendations = useMemo((): StudyRecommendation[] => {
    const recs: StudyRecommendation[] = [];

    // SRS-due items
    if (srsDueCount > 0) {
      recs.push({
        id: 'srs-due',
        title: 'Review Due Items',
        description: `${srsDueCount} items scheduled for review today`,
        priority: 'high',
        action: 'Start Reviews',
        actionDestination: 'main_session',
        icon: Clock,
      });
    }

    // Flagged items
    if (flaggedCount > 0) {
      recs.push({
        id: 'flagged',
        title: 'Revisit Flagged Questions',
        description: `${flaggedCount} questions marked for review`,
        priority: 'medium',
        action: 'Review Flagged',
        actionDestination: 'main_session_flagged',
        icon: AlertCircle,
      });
    }

    // Low-performing systems
    const systemStats = performanceData.reduce(
      (acc, r) => {
        // Guard against null system - cannot use as index
        if (!r.system) return acc;
        if (!acc[r.system]) {
          acc[r.system] = { correct: 0, total: 0 };
        }
        acc[r.system]!.total++;
        if (r.isCorrect) acc[r.system]!.correct++;
        return acc;
      },
      {} as Record<string, { correct: number; total: number }>
    );

    const weakSystems = Object.entries(systemStats)
      .filter(([_, stats]) => stats.total >= 5 && stats.correct / stats.total < 0.6)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .slice(0, 2);

    weakSystems.forEach(([system, stats]) => {
      // Guard against undefined topic name from map lookup
      const topicName = ABBREVIATION_TO_TOPIC_MAP[system as SystemCode] ?? system;
      recs.push({
        id: `weak-${system}`,
        title: `Strengthen ${topicName}`,
        description: `${Math.round((stats.correct / stats.total) * 100)}% accuracy - below target`,
        priority: 'high',
        action: 'Practice',
        actionDestination: `topic_focus_${system}`,
        icon: Target,
      });
    });

    // Daily goal progress
    const dailyGoal = userPreferences.studyGoals.dailyQuestions;
    const progress = (todayQuestionCount / dailyGoal) * 100;
    if (progress < 100) {
      recs.push({
        id: 'daily-goal',
        title: 'Complete Daily Goal',
        description: `${todayQuestionCount}/${dailyGoal} questions answered today`,
        priority: 'medium',
        action: 'Continue',
        actionDestination: 'main_session',
        icon: Target,
      });
    }

    // Streak maintenance
    if (currentStreak >= 3 && todayQuestionCount === 0) {
      recs.push({
        id: 'streak',
        title: 'Maintain Your Streak',
        description: `Study continuity at risk — answer at least 1 question today`,
        priority: 'high',
        action: 'Quick Session',
        actionDestination: 'main_session',
        icon: Flame,
      });
    }

    // Encourage variety
    const recentSystems = performanceData
      .slice(-20)
      .map((r) => r.system)
      .filter((v, i, a) => a.indexOf(v) === i);

    if (recentSystems.length <= 2) {
      recs.push({
        id: 'variety',
        title: 'Expand Your Practice',
        description: 'Try questions from different systems for better retention',
        priority: 'low',
        action: 'Random Mode',
        actionDestination: 'main_session_random',
        icon: Zap,
      });
    }

    return recs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [
    srsDueCount,
    flaggedCount,
    todayQuestionCount,
    currentStreak,
    performanceData,
    userPreferences,
  ]);

  // Favorite drills (top 3)
  const favoriteDrills = [
    { id: 'ecg_drill', name: 'ECG Interpretation', icon: Activity },
    { id: 'buzzword_mode', name: 'Buzzword Mode', icon: Zap },
    { id: 'mini_labs', name: 'Mini-Labs', icon: BookOpen },
  ].slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">
            Command Center
          </h1>
          <p className="text-lg text-[var(--color-text-muted)]">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </motion.div>

        {/* What to Study Now - Primary CTA */}
        {recommendations.length > 0 &&
          (() => {
            const topRecommendation = recommendations[0];
            if (!topRecommendation) return null;
            const IconComponent = topRecommendation.icon;

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
              >
                <div
                  className="p-6 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] shadow-xl cursor-pointer hover:shadow-2xl hover:brightness-110 transition-all group"
                  onClick={() => onNavigate(topRecommendation.actionDestination)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent className="w-6 h-6" />
                        <span className="text-sm font-semibold uppercase tracking-wider opacity-90">
                          Recommended Now
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold mb-2">{topRecommendation.title}</h2>
                      <p className="text-white/90 mb-4">{topRecommendation.description}</p>
                      <button className="px-6 py-2 bg-[var(--color-bg-primary)]/20 hover:bg-[var(--color-bg-primary)]/30 rounded-lg font-medium backdrop-blur-sm transition-all flex items-center gap-2">
                        {topRecommendation.action}
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* SRS Due */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-text-muted)]">SRS Reviews</span>
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">{srsDueCount}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Due today</div>
          </motion.div>

          {/* Study Continuity (consecutive days studied) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-text-muted)]">Study Continuity</span>
              <Zap className="w-5 h-5 text-teal-500" />
            </div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {currentStreak}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">days</div>
          </motion.div>

          {/* Today's Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-text-muted)]">Today's Questions</span>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {todayQuestionCount}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              of {userPreferences.studyGoals.dailyQuestions} goal
            </div>
          </motion.div>

          {/* Flagged */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-text-muted)]">Flagged</span>
              <AlertCircle className="w-5 h-5 text-slate-500" />
            </div>
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {flaggedCount}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">for review</div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Recommendations + Grand Rounds */}
          <div className="lg:col-span-2 space-y-6">
            {/* Grand Rounds - Daily Special Challenge */}
            {!grandRoundsCompleted && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="relative overflow-hidden rounded-xl bg-[var(--color-accent-secondary)] p-6 text-[var(--color-text-inverse)] shadow-xl"
              >
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-[var(--color-bg-primary)]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-6 h-6" />
                    <span className="text-sm font-semibold uppercase tracking-wider">
                      Daily Special Challenge
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Grand Rounds</h3>
                  <p className="text-white/90 mb-4">
                    Complex multi-system case with expert commentary. Complete once per day for
                    bonus XP.
                  </p>
                  <button
                    onClick={() => onNavigate('grand_rounds')}
                    className="px-6 py-2 bg-[var(--color-bg-primary)]/20 hover:bg-[var(--color-bg-primary)]/30 rounded-lg font-medium backdrop-blur-sm transition-all flex items-center gap-2 group"
                  >
                    Start Challenge
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Additional Recommendations */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Personalized Suggestions
              </h3>
              {recommendations.slice(1, 4).map((rec, index) => (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  onClick={() => onNavigate(rec.actionDestination)}
                  className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        rec.priority === 'high'
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : rec.priority === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                            : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      <rec.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        {rec.title}
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)]">{rec.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column: Benchmarks + Quick Links */}
          <div className="space-y-6">
            {/* Benchmark Deltas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            >
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                This Week vs Last Week
              </h3>
              <div className="space-y-3">
                {benchmarkDeltas.map((delta) => (
                  <div key={delta.metric} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-[var(--color-text-muted)]">{delta.metric}</div>
                      <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {delta.metric === 'Avg Decision Time'
                          ? `${delta.current.toFixed(1)}s`
                          : delta.metric === 'Questions/Day'
                            ? delta.current.toFixed(1)
                            : `${delta.current.toFixed(1)}%`}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-sm font-medium ${
                        delta.trend === 'up'
                          ? 'text-green-600 dark:text-green-400'
                          : delta.trend === 'down'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      {delta.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : delta.trend === 'down' ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : null}
                      <span>
                        {delta.metric === 'Avg Decision Time'
                          ? `${Math.abs(delta.delta).toFixed(1)}s`
                          : `${Math.abs(delta.delta).toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Links - Starred Drills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            >
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Quick Access
                </h3>
              </div>
              <div className="space-y-2">
                {favoriteDrills.map((drill) => (
                  <button
                    key={drill.id}
                    onClick={() => onNavigate(drill.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group text-left"
                  >
                    <drill.icon className="w-5 h-5 text-[var(--color-accent)]" />
                    <span className="flex-1 font-medium text-[var(--color-text-primary)]">
                      {drill.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
                <button
                  onClick={() => onNavigate('diagnostic_hub')}
                  className="w-full flex items-center justify-center gap-2 p-2 text-sm text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>Browse All Drills</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
