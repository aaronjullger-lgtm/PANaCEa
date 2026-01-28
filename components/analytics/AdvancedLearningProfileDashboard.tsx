/**
 * Advanced Learning Profile Dashboard
 *
 * Comprehensive, real-time analytics dashboard displaying:
 * - Cognitive state monitoring
 * - Learning velocity trends
 * - System mastery visualization
 * - PANCE readiness indicators
 * - Personalized AI insights
 * - Study optimization recommendations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  Brain,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Award,
  AlertTriangle,
  BarChart3,
  Calendar,
  Flame,
  CheckCircle,
  XCircle,
  ChevronRight,
  RefreshCw,
  Activity,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Eye,
  Lightbulb,
  Gauge,
  Heart,
  Timer,
  Coffee,
  Sparkles,
  GraduationCap,
  Moon,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { fetchLearningProfile } from '@/services/analytics';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  getCognitiveState,
  getLearningVelocity,
  getPerformanceByTimeOfDay,
  getOptimalStudyTime,
  shouldSuggestBreak,
  type CognitiveState,
  type LearningVelocity,
  type PerformanceByTimeOfDay,
} from '@/services/analytics';

// ============================================================================
// Types
// ============================================================================

interface LearningProfile {
  lifetimeQuestions: number;
  lifetimeCorrect: number;
  lifetimeAccuracy: number;
  lifetimeStudyTimeMs: number;
  bestEverStreak: number;
  currentStreak: number;
  overallCalibrationScore: number | null;
  changeHelpfulRatio: number | null;
  avgTimePerQuestion: number | null;
  rushingTendency: number | null;
  avgSessionLength: number | null;
  fatigueOnsetQuestion: number | null;
  strongestSystems: string[];
  weakestSystems: string[];
  estimatedScore: number | null;
  readinessLevel: string | null;
  learningInsights: string[];
  recommendations: string[];
  bestStudyHour: number | null;
  updatedAt: string;
}

interface SessionSummary {
  id: string;
  startedAt: string;
  totalQuestions: number;
  accuracy: number;
  bestStreak: number;
  predictedScore: number | null;
  momentumTrend: string | null;
}

interface AggregateStats {
  recentAvgAccuracy: number | null;
  recentAvgQuestions: number | null;
  recentAvgMomentum: number | null;
  accuracyTrend: 'improving' | 'declining' | 'stable';
  totalSessions: number;
}

// ============================================================================
// Main Component
// ============================================================================

export const AdvancedLearningProfileDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cognitive' | 'systems' | 'insights'>(
    'overview'
  );

  // Real-time analytics
  const [cognitiveState, setCognitiveState] = useState<CognitiveState | null>(null);
  const [learningVelocity, setLearningVelocity] = useState<LearningVelocity | null>(null);
  const [timeOfDayStats, setTimeOfDayStats] = useState<PerformanceByTimeOfDay[]>([]);
  const [optimalTime, setOptimalTime] = useState<{ hour: number; confidence: number } | null>(null);
  const [breakSuggestion, setBreakSuggestion] = useState<{ suggest: boolean; reason?: string }>({
    suggest: false,
  });

  // Load profile from database
  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const data = await fetchLearningProfile(token);

      if (data.error) {
        setError(data.error);
      } else {
        setProfile(data.profile);
        setSessions(data.sessions);
        setAggregateStats(data.aggregateStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Load real-time analytics
  const loadRealTimeAnalytics = () => {
    try {
      setCognitiveState(getCognitiveState());
      setLearningVelocity(getLearningVelocity());
      setTimeOfDayStats(getPerformanceByTimeOfDay());
      setOptimalTime(getOptimalStudyTime());
      setBreakSuggestion(shouldSuggestBreak());
    } catch (e) {
      console.warn('[Dashboard] Real-time analytics error:', e);
    }
  };

  useEffect(() => {
    loadProfile();
    loadRealTimeAnalytics();

    // Refresh real-time data periodically
    const interval = setInterval(loadRealTimeAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  // Utility functions
  const formatStudyTime = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getHourIcon = (hour: number) => {
    if (hour >= 5 && hour < 12) return <Sunrise className="w-4 h-4 text-muted-amber-500" />;
    if (hour >= 12 && hour < 17) return <Sun className="w-4 h-4 text-muted-amber-400" />;
    if (hour >= 17 && hour < 21) return <Sunset className="w-4 h-4 text-muted-amber-600" />;
    return <Moon className="w-4 h-4 text-deep-plum-500" />;
  };

  const getReadinessGradient = (level: string | null): string => {
    switch (level) {
      case 'ready':
        return 'from-data-pass to-sage-400';
      case 'almost_ready':
        return 'from-steel-blue-500 to-slate-teal-400';
      case 'progressing':
        return 'from-data-provisional to-muted-amber-400';
      default:
        return 'from-[var(--color-border)] to-[var(--color-border)]';
    }
  };

  const getReadinessLabel = (level: string | null): string => {
    switch (level) {
      case 'ready':
        return 'Ready for PANCE';
      case 'almost_ready':
        return 'Almost Ready';
      case 'progressing':
        return 'Progressing';
      default:
        return 'Building Foundation';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-[var(--color-accent)] animate-spin" />
          <p className="text-[var(--color-text-muted)]">Analyzing your learning data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-data-provisional" />
        <p className="text-[var(--color-text-muted)]">{error}</p>
        <PrimaryButton size="sm" onClick={loadProfile}>
          Try Again
        </PrimaryButton>
      </div>
    );
  }

  // Empty state
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-steel-blue-100 to-deep-plum-100 dark:from-steel-blue-900/50 dark:to-deep-plum-900/50 flex items-center justify-center">
          <Brain className="w-10 h-10 text-steel-blue-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">
          No Learning Profile Yet
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Complete a few study sessions to build your personalized learning profile. We&apos;ll
          analyze your patterns and provide AI-powered insights to optimize your studying.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Break Suggestion Banner */}
      <AnimatePresence>
        {breakSuggestion.suggest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-muted-amber-50 dark:bg-muted-amber-900/30 border border-muted-amber-200 dark:border-muted-amber-800 rounded-xl p-4 flex items-center gap-4"
          >
            <Coffee className="w-6 h-6 text-muted-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-muted-amber-800 dark:text-muted-amber-200">Time for a Break?</p>
              <p className="text-sm text-muted-amber-600 dark:text-muted-amber-300">{breakSuggestion.reason}</p>
            </div>
            <button
              onClick={() => setBreakSuggestion({ suggest: false })}
              className="px-3 py-1 text-sm text-muted-amber-600 hover:bg-muted-amber-100 dark:hover:bg-muted-amber-900/50 rounded-lg"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'overview' as const, label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'cognitive' as const, label: 'Mental State', icon: <Brain className="w-4 h-4" /> },
          { id: 'systems' as const, label: 'Systems', icon: <Target className="w-4 h-4" /> },
          { id: 'insights' as const, label: 'AI Insights', icon: <Sparkles className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-steel-blue-500 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* PANCE Readiness Hero */}
            {profile.estimatedScore && (
              <div
                className={`bg-gradient-to-br ${getReadinessGradient(profile.readinessLevel)} rounded-2xl p-6 text-white shadow-lg`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm font-medium mb-1">Estimated PANCE Score</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold">{profile.estimatedScore}</span>
                      <span className="text-white/70">/800</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <GraduationCap className="w-5 h-5 text-white/80" />
                      <span className="font-medium">
                        {getReadinessLabel(profile.readinessLevel)}
                      </span>
                    </div>
                  </div>

                  {/* Circular Progress */}
                  <div className="relative w-28 h-28">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-white/20"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(profile.estimatedScore / 800) * 301} 301`}
                        className="text-white"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">
                        {Math.round((profile.estimatedScore / 800) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<Target className="w-5 h-5 text-steel-blue-500" />}
                label="Lifetime Accuracy"
                value={`${Math.round(profile.lifetimeAccuracy)}%`}
                sublabel={`${profile.lifetimeCorrect.toLocaleString()} / ${profile.lifetimeQuestions.toLocaleString()}`}
                trend={aggregateStats?.accuracyTrend}
              />
              <StatCard
                icon={<Clock className="w-5 h-5 text-deep-plum-500" />}
                label="Total Study Time"
                value={formatStudyTime(profile.lifetimeStudyTimeMs)}
                sublabel="all sessions"
              />
              <StatCard
                icon={<Flame className="w-5 h-5 text-muted-amber-500" />}
                label="Best Streak"
                value={profile.bestEverStreak.toString()}
                sublabel="consecutive correct"
              />
              <StatCard
                icon={<Calendar className="w-5 h-5 text-data-pass" />}
                label="Study Streak"
                value={`${profile.currentStreak} days`}
                sublabel={profile.currentStreak > 7 ? '🔥 On fire!' : 'Keep it going!'}
              />
            </div>

            {/* Learning Velocity */}
            {learningVelocity && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-steel-blue-500" />
                  Learning Velocity
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Questions/Hour</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {Math.round(learningVelocity.masteryRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Retention Rate</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {Math.round(learningVelocity.retentionEfficiency)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Trend</p>
                    <div
                      className={`flex items-center gap-1 text-lg font-semibold ${
                        learningVelocity.trend === 'accelerating'
                          ? 'text-data-pass'
                          : learningVelocity.trend === 'decelerating'
                            ? 'text-data-fail'
                            : 'text-slate-500'
                      }`}
                    >
                      {learningVelocity.trend === 'accelerating' && (
                        <TrendingUp className="w-5 h-5" />
                      )}
                      {learningVelocity.trend === 'decelerating' && (
                        <TrendingDown className="w-5 h-5" />
                      )}
                      {learningVelocity.trend === 'stable' && '→'}
                      <span className="capitalize">{learningVelocity.trend}</span>
                    </div>
                  </div>
                </div>

                {/* Personal Best Indicator */}
                {learningVelocity.personalBestRatio > 0.9 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-sm">
                      <Award
                        className={`w-5 h-5 ${learningVelocity.personalBestRatio >= 1 ? 'text-muted-amber-500' : 'text-slate-400'}`}
                      />
                      <span className="text-slate-600 dark:text-slate-300">
                        {learningVelocity.personalBestRatio >= 1
                          ? "You're at your personal best!"
                          : `${Math.round(learningVelocity.personalBestRatio * 100)}% of your personal best`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Optimal Study Time */}
            {optimalTime && optimalTime.confidence > 0.5 && (
              <div className="bg-gradient-to-r from-deep-plum-100 to-deep-plum-50 dark:from-deep-plum-900/30 dark:to-deep-plum-800/30 rounded-xl p-5 border border-deep-plum-200 dark:border-deep-plum-800">
                <div className="flex items-center gap-4">
                  {getHourIcon(optimalTime.hour)}
                  <div>
                    <p className="text-sm text-deep-plum-600 dark:text-deep-plum-400 font-medium">
                      Optimal Study Time
                    </p>
                    <p className="text-2xl font-bold text-deep-plum-700 dark:text-deep-plum-300">
                      {optimalTime.hour === 0
                        ? '12'
                        : optimalTime.hour > 12
                          ? optimalTime.hour - 12
                          : optimalTime.hour}
                      :00 {optimalTime.hour >= 12 ? 'PM' : 'AM'}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-deep-plum-500 dark:text-deep-plum-400">Confidence</p>
                    <p className="text-lg font-semibold text-deep-plum-600 dark:text-deep-plum-300">
                      {Math.round(optimalTime.confidence * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <RecentSessionsList sessions={sessions.slice(0, 5)} formatDate={formatDate} />
            )}
          </motion.div>
        )}

        {/* Cognitive Tab */}
        {activeTab === 'cognitive' && (
          <motion.div
            key="cognitive"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {cognitiveState ? (
              <>
                {/* Cognitive State Dashboard */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-deep-plum-500" />
                    Current Mental State
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Cognitive Load */}
                    <CognitiveGauge
                      label="Cognitive Load"
                      value={cognitiveState.cognitiveLoad}
                      icon={<Gauge className="w-5 h-5" />}
                      lowLabel="Light"
                      highLabel="Heavy"
                      description={
                        cognitiveState.cognitiveLoad > 70
                          ? 'Your brain is working hard - consider easier content'
                          : cognitiveState.cognitiveLoad > 40
                            ? 'Good challenge level'
                            : 'Room for more challenging content'
                      }
                    />

                    {/* Attention Level */}
                    <CognitiveGauge
                      label="Focus Level"
                      value={cognitiveState.attentionLevel}
                      icon={<Eye className="w-5 h-5" />}
                      lowLabel="Scattered"
                      highLabel="Locked In"
                      isPositive
                      description={
                        cognitiveState.attentionLevel > 70
                          ? 'Excellent focus! Great time to study'
                          : cognitiveState.attentionLevel > 40
                            ? 'Moderate focus - minimize distractions'
                            : 'Attention wandering - try a short break'
                      }
                    />

                    {/* Fatigue Level */}
                    <CognitiveGauge
                      label="Fatigue"
                      value={cognitiveState.fatigueLevel}
                      icon={<BatteryMedium className="w-5 h-5" />}
                      lowLabel="Fresh"
                      highLabel="Tired"
                      description={
                        cognitiveState.fatigueLevel > 60
                          ? 'Mental fatigue detected - accuracy may decline'
                          : cognitiveState.fatigueLevel > 30
                            ? 'Some fatigue building - pace yourself'
                            : 'Energy levels good'
                      }
                    />

                    {/* Flow State */}
                    <CognitiveGauge
                      label="Flow State"
                      value={cognitiveState.flowState}
                      icon={<Zap className="w-5 h-5" />}
                      lowLabel="Disengaged"
                      highLabel="In Flow"
                      isPositive
                      description={
                        cognitiveState.flowState > 70
                          ? "You're in the zone! Optimal learning state"
                          : cognitiveState.flowState > 40
                            ? 'Approaching flow - find the right challenge'
                            : 'Adjust difficulty to find your flow'
                      }
                    />
                  </div>
                </div>

                {/* Test-Taking Patterns */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
                    <Timer className="w-5 h-5 text-steel-blue-500" />
                    Test-Taking Patterns
                  </h3>

                  <div className="space-y-6">
                    {/* Calibration */}
                    {profile.overallCalibrationScore !== null && (
                      <PatternInsight
                        label="Confidence Calibration"
                        value={`${Math.round(profile.overallCalibrationScore)}/100`}
                        description={
                          profile.overallCalibrationScore >= 70
                            ? 'Excellent! Your confidence accurately predicts your performance.'
                            : profile.overallCalibrationScore >= 50
                              ? 'Room for improvement - practice noticing uncertainty cues.'
                              : "Work on recognizing when you're truly confident vs guessing."
                        }
                        quality={
                          profile.overallCalibrationScore >= 70
                            ? 'excellent'
                            : profile.overallCalibrationScore >= 50
                              ? 'good'
                              : 'needs-work'
                        }
                      />
                    )}

                    {/* Answer Change Pattern */}
                    {profile.changeHelpfulRatio !== null && (
                      <PatternInsight
                        label="Answer Change Success"
                        value={`${Math.round(profile.changeHelpfulRatio * 100)}% beneficial`}
                        description={
                          profile.changeHelpfulRatio >= 0.6
                            ? 'Your second guesses usually improve your score. Deliberate when uncertain!'
                            : profile.changeHelpfulRatio <= 0.4
                              ? 'You often change to wrong answers. Trust your first instinct more.'
                              : "Your changes are mixed. Consider why you're changing before you do."
                        }
                        quality={
                          profile.changeHelpfulRatio >= 0.6
                            ? 'excellent'
                            : profile.changeHelpfulRatio <= 0.4
                              ? 'needs-work'
                              : 'good'
                        }
                      />
                    )}

                    {/* Pacing */}
                    {profile.rushingTendency !== null && (
                      <PatternInsight
                        label="Pacing Style"
                        value={
                          profile.rushingTendency > 0.4
                            ? 'Quick decider'
                            : profile.rushingTendency < 0.2
                              ? 'Methodical thinker'
                              : 'Balanced approach'
                        }
                        description={
                          profile.rushingTendency > 0.4
                            ? "You answer quickly. Make sure you're not missing key details."
                            : profile.rushingTendency < 0.2
                              ? 'You take your time. Watch the clock on timed exams.'
                              : 'Good pace - you balance speed and accuracy well.'
                        }
                        quality={
                          profile.rushingTendency > 0.5
                            ? 'needs-work'
                            : profile.rushingTendency < 0.15
                              ? 'good'
                              : 'excellent'
                        }
                      />
                    )}

                    {/* Fatigue Onset */}
                    {profile.fatigueOnsetQuestion && (
                      <PatternInsight
                        label="Stamina Threshold"
                        value={`~${profile.fatigueOnsetQuestion} questions`}
                        description="Your accuracy typically starts declining after this point. Plan breaks accordingly."
                        quality="info"
                      />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start a study session to track cognitive metrics</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Systems Tab */}
        {activeTab === 'systems' && (
          <motion.div
            key="systems"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Strengths */}
            {profile.strongestSystems.length > 0 && (
              <div className="bg-sage-50 dark:bg-sage-900/20 rounded-xl p-6 border border-sage-200 dark:border-sage-800">
                <h3 className="text-lg font-semibold text-sage-700 dark:text-sage-300 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Your Strongest Systems
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {profile.strongestSystems.map((system, i) => (
                    <div
                      key={system}
                      className="bg-white dark:bg-sage-900/30 rounded-lg p-4 border border-sage-200 dark:border-sage-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '✓'}
                        </span>
                        <span className="font-medium text-sage-700 dark:text-sage-300">
                          {system}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {profile.weakestSystems.length > 0 && (
              <div className="bg-muted-amber-50 dark:bg-muted-amber-900/20 rounded-xl p-6 border border-muted-amber-200 dark:border-muted-amber-800">
                <h3 className="text-lg font-semibold text-muted-amber-700 dark:text-muted-amber-300 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Systems Needing Focus
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {profile.weakestSystems.map((system) => (
                    <div
                      key={system}
                      className="bg-white dark:bg-muted-amber-900/30 rounded-lg p-4 border border-muted-amber-200 dark:border-muted-amber-700 group hover:border-muted-amber-400 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-muted-amber-700 dark:text-muted-amber-300">
                          {system}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-amber-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Time of Day Performance */}
            {timeOfDayStats.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-deep-plum-500" />
                  Performance by Time of Day
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {timeOfDayStats.map((stat) => (
                    <div
                      key={stat.hour}
                      className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                    >
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {stat.hour === 0
                          ? '12am'
                          : stat.hour > 12
                            ? `${stat.hour - 12}pm`
                            : `${stat.hour}am`}
                      </p>
                      <p
                        className={`text-lg font-bold mt-1 ${
                          stat.accuracy >= 80
                            ? 'text-data-pass'
                            : stat.accuracy >= 60
                              ? 'text-data-provisional'
                              : 'text-data-fail'
                        }`}
                      >
                        {Math.round(stat.accuracy)}%
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{stat.questionsAttempted}q</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* AI Insights Tab */}
        {activeTab === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Learning Insights */}
            {profile.learningInsights.length > 0 && (
              <div className="bg-gradient-to-br from-deep-plum-100 to-deep-plum-50 dark:from-deep-plum-900/30 dark:to-deep-plum-800/30 rounded-xl p-6 border border-deep-plum-200 dark:border-deep-plum-800">
                <h3 className="text-lg font-semibold text-deep-plum-700 dark:text-deep-plum-300 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Learning Insights
                </h3>
                <ul className="space-y-3">
                  {profile.learningInsights.map((insight, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 bg-white/60 dark:bg-deep-plum-900/40 rounded-lg p-3"
                    >
                      <Sparkles className="w-5 h-5 text-deep-plum-500 flex-shrink-0 mt-0.5" />
                      <span className="text-deep-plum-700 dark:text-deep-plum-200">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {profile.recommendations.length > 0 && (
              <div className="bg-steel-blue-50 dark:bg-steel-blue-900/20 rounded-xl p-6 border border-steel-blue-200 dark:border-steel-blue-800">
                <h3 className="text-lg font-semibold text-steel-blue-700 dark:text-steel-blue-300 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Personalized Recommendations
                </h3>
                <div className="space-y-3">
                  {profile.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-white dark:bg-steel-blue-900/40 rounded-lg p-4 border border-steel-blue-100 dark:border-steel-blue-800 hover:border-steel-blue-300 dark:hover:border-steel-blue-600 transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-full bg-steel-blue-100 dark:bg-steel-blue-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-steel-blue-600 dark:text-steel-blue-300 font-semibold text-sm">
                          {i + 1}
                        </span>
                      </div>
                      <span className="text-steel-blue-700 dark:text-steel-blue-200 flex-1">{rec}</span>
                      <ChevronRight className="w-5 h-5 text-steel-blue-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-4">
              <button className="p-5 bg-sage-50 dark:bg-sage-900/20 rounded-xl border border-sage-200 dark:border-sage-800 text-left hover:border-sage-400 transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-sage-100 dark:bg-sage-800">
                    <Zap className="w-5 h-5 text-sage-600 dark:text-sage-400" />
                  </div>
                  <span className="font-semibold text-sage-700 dark:text-sage-300">
                    Quick Practice
                  </span>
                </div>
                <p className="text-sm text-sage-600 dark:text-sage-400">
                  AI-selected questions targeting your weak areas
                </p>
              </button>

              <button className="p-5 bg-deep-plum-50 dark:bg-deep-plum-900/20 rounded-xl border border-deep-plum-200 dark:border-deep-plum-800 text-left hover:border-deep-plum-400 transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-deep-plum-100 dark:bg-deep-plum-800">
                    <Brain className="w-5 h-5 text-deep-plum-600 dark:text-deep-plum-400" />
                  </div>
                  <span className="font-semibold text-deep-plum-700 dark:text-deep-plum-300">
                    Flow Mode
                  </span>
                </div>
                <p className="text-sm text-deep-plum-600 dark:text-deep-plum-400">
                  Adaptive difficulty to maximize learning efficiency
                </p>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  trend?: 'improving' | 'declining' | 'stable';
}> = ({ icon, label, value, sublabel, trend }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {trend && (
        <span className="ml-auto">
          {trend === 'improving' && <TrendingUp className="w-4 h-4 text-data-pass" />}
          {trend === 'declining' && <TrendingDown className="w-4 h-4 text-data-fail" />}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
  </div>
);

const CognitiveGauge: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  lowLabel: string;
  highLabel: string;
  isPositive?: boolean;
  description: string;
}> = ({ label, value, icon, lowLabel, highLabel, isPositive = false, description }) => {
  const getColor = () => {
    if (isPositive) {
      if (value >= 70) return 'text-data-pass bg-data-pass';
      if (value >= 40) return 'text-data-provisional bg-data-provisional';
      return 'text-data-fail bg-data-fail';
    } else {
      if (value <= 30) return 'text-data-pass bg-data-pass';
      if (value <= 60) return 'text-data-provisional bg-data-provisional';
      return 'text-data-fail bg-data-fail';
    }
  };

  const colorClass = getColor();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={colorClass.split(' ')[0]}>{icon}</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        </div>
        <span className={`text-lg font-bold ${colorClass.split(' ')[0]}`}>
          {Math.round(value)}%
        </span>
      </div>
      <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${colorClass.split(' ')[1]}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
};

const PatternInsight: React.FC<{
  label: string;
  value: string;
  description: string;
  quality: 'excellent' | 'good' | 'needs-work' | 'info';
}> = ({ label, value, description, quality }) => {
  const qualityStyles = {
    excellent:
      'bg-sage-100 dark:bg-sage-900/40 text-sage-700 dark:text-sage-300 border-sage-200 dark:border-sage-800',
    good: 'bg-steel-blue-100 dark:bg-steel-blue-900/40 text-steel-blue-700 dark:text-steel-blue-300 border-steel-blue-200 dark:border-steel-blue-800',
    'needs-work':
      'bg-muted-amber-100 dark:bg-muted-amber-900/40 text-muted-amber-700 dark:text-muted-amber-300 border-muted-amber-200 dark:border-muted-amber-800',
    info: 'bg-slate-100 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  return (
    <div className={`rounded-lg p-4 border ${qualityStyles[quality]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium">{label}</p>
          <p className="text-sm mt-1 opacity-80">{description}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-white/50 dark:bg-black/20">
          {value}
        </span>
      </div>
    </div>
  );
};

const RecentSessionsList: React.FC<{
  sessions: SessionSummary[];
  formatDate: (date: string) => string;
}> = ({ sessions, formatDate }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
      <BarChart3 className="w-4 h-4 text-steel-blue-500" />
      Recent Sessions
    </h3>
    <div className="divide-y divide-slate-100 dark:divide-slate-700">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {formatDate(session.startedAt)}
            </p>
            <p className="text-xs text-slate-500">{session.totalQuestions} questions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p
                className={`text-lg font-bold ${
                  session.accuracy >= 80
                    ? 'text-data-pass'
                    : session.accuracy >= 60
                      ? 'text-data-provisional'
                      : 'text-data-fail'
                }`}
              >
                {Math.round(session.accuracy)}%
              </p>
              {session.bestStreak > 0 && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-muted-amber-500" />
                  {session.bestStreak} streak
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Export both named and default
export { AdvancedLearningProfileDashboard as LearningProfileDashboard };
export default AdvancedLearningProfileDashboard;
