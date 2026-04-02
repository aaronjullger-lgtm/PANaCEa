/**
 * Learning Profile Dashboard
 *
 * Displays comprehensive user analytics from the database including:
 * - Lifetime stats and trends
 * - Test-taking patterns
 * - System strengths/weaknesses
 * - PANCE readiness score
 * - Personalized recommendations
 */

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { fetchLearningProfile } from '@/services/analytics';
import { ExplainabilityTooltip } from '@/components/ui/ExplainabilityTooltip';

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

export const LearningProfileDashboard: React.FC = () => {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadProfile();
  }, []);

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

  const getReadinessColor = (level: string | null): string => {
    switch (level) {
      case 'ready':
        return 'text-[var(--color-data-pass)]';
      case 'almost_ready':
        return 'text-[var(--color-accent)]';
      case 'progressing':
        return 'text-[var(--color-data-provisional)]';
      default:
        return 'text-[var(--color-text-muted)]';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-[var(--color-data-provisional)]" />
        <p className="text-[var(--color-text-muted)]">{error}</p>
        <button
          onClick={loadProfile}
          className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent)]/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
        <Brain className="w-16 h-16 text-[var(--color-text-muted)]" />
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
          No Learning Profile Yet
        </h3>
        <p className="text-[var(--color-text-muted)] max-w-md">
          Complete a few study sessions to build your personalized learning profile. We&apos;ll
          track your patterns and provide insights to optimize your studying.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Your Learning Profile
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Based on {profile.lifetimeQuestions.toLocaleString()} questions answered
          </p>
        </div>
        <button
          onClick={loadProfile}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* PANCE Readiness Score */}
      {profile.estimatedScore && (
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded-2xl p-6 border border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-accent)] mb-1 flex items-center gap-1.5">
                Estimated PANCE Score
                <ExplainabilityTooltip
                  formula={`Based on your ${profile.lifetimeQuestions.toLocaleString()} practice questions, weighted by difficulty and time decay.`}
                />
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-[var(--color-text-primary)]">
                  {profile.estimatedScore}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">/800</span>
              </div>
              <p
                className={`text-sm mt-2 font-medium ${getReadinessColor(profile.readinessLevel)}`}
              >
                {getReadinessLabel(profile.readinessLevel)}
              </p>
            </div>
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-[var(--color-border)]"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(profile.estimatedScore / 800) * 251} 251`}
                  className="text-[var(--color-accent)]"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold text-[var(--color-accent)]">
                  {Math.round((profile.estimatedScore / 800) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Lifetime Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Target className="w-5 h-5 text-[var(--color-accent)]" />}
          label="Lifetime Accuracy"
          value={`${Math.round(profile.lifetimeAccuracy)}%`}
          sublabel={`${profile.lifetimeCorrect.toLocaleString()}/${profile.lifetimeQuestions.toLocaleString()}`}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-[var(--color-accent)]" />}
          label="Study Time"
          value={formatStudyTime(profile.lifetimeStudyTimeMs)}
        />
        <StatCard
          icon={<Flame className="w-5 h-5 text-[var(--color-data-provisional)]" />}
          label="Best Streak"
          value={profile.bestEverStreak.toString()}
          sublabel="consecutive correct"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5 text-[var(--color-data-pass)]" />}
          label="Day Streak"
          value={profile.currentStreak.toString()}
          sublabel="days"
        />
      </div>

      {/* Aggregate Trends */}
      {aggregateStats && (
        <div className="bg-[var(--color-bg-primary)] rounded-xl p-4 border border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Performance Trends
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Avg Accuracy (Last 10)</p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                {aggregateStats.recentAvgAccuracy !== null
                  ? `${Math.round(aggregateStats.recentAvgAccuracy)}%`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Trend</p>
              <p
                className={`text-lg font-semibold flex items-center gap-1 ${
                  aggregateStats.accuracyTrend === 'improving'
                    ? 'text-[var(--color-data-pass)]'
                    : aggregateStats.accuracyTrend === 'declining'
                      ? 'text-[var(--color-data-fail)]'
                      : 'text-[var(--color-text-muted)]'
                }`}
              >
                {aggregateStats.accuracyTrend === 'improving' && <TrendingUp className="w-4 h-4" />}
                {aggregateStats.accuracyTrend === 'declining' && (
                  <TrendingDown className="w-4 h-4" />
                )}
                {aggregateStats.accuracyTrend === 'improving'
                  ? 'Improving'
                  : aggregateStats.accuracyTrend === 'declining'
                    ? 'Declining'
                    : 'Stable'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Total Sessions</p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                {aggregateStats.totalSessions}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test-Taking Patterns */}
      <div className="bg-[var(--color-bg-primary)] rounded-xl p-4 border border-[var(--color-border)]">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Your Test-Taking Patterns
        </h3>
        <div className="space-y-4">
          {/* Calibration */}
          {profile.overallCalibrationScore !== null && (
            <PatternItem
              label="Confidence Calibration"
              value={`${Math.round(profile.overallCalibrationScore)}/100`}
              description={
                profile.overallCalibrationScore >= 70
                  ? "You're well-calibrated - your confidence matches your performance"
                  : profile.overallCalibrationScore >= 50
                    ? 'Room for improvement in calibrating your confidence'
                    : 'Work on trusting your gut - you may be over/under-confident'
              }
              color={
                profile.overallCalibrationScore >= 70
                  ? 'green'
                  : profile.overallCalibrationScore >= 50
                    ? 'amber'
                    : 'red'
              }
            />
          )}

          {/* Answer Change Pattern */}
          {profile.changeHelpfulRatio !== null && (
            <PatternItem
              label="Answer Changes"
              value={`${Math.round(profile.changeHelpfulRatio * 100)}% helpful`}
              description={
                profile.changeHelpfulRatio >= 0.6
                  ? 'Your answer changes usually improve your score - deliberate when unsure'
                  : profile.changeHelpfulRatio <= 0.4
                    ? 'You often change to wrong answers - trust your first instinct more'
                    : 'Your changes are about 50/50 - consider trusting your gut'
              }
              color={
                profile.changeHelpfulRatio >= 0.6
                  ? 'green'
                  : profile.changeHelpfulRatio <= 0.4
                    ? 'red'
                    : 'amber'
              }
            />
          )}

          {/* Rushing Tendency */}
          {profile.rushingTendency !== null && (
            <PatternItem
              label="Pacing"
              value={
                profile.rushingTendency > 0.4
                  ? 'Tends to rush'
                  : profile.rushingTendency < 0.2
                    ? 'Methodical'
                    : 'Balanced'
              }
              description={
                profile.rushingTendency > 0.4
                  ? "You answer quickly - make sure you're reading carefully"
                  : 'Your pace is appropriate for the question complexity'
              }
              color={profile.rushingTendency > 0.4 ? 'amber' : 'green'}
            />
          )}

          {/* Fatigue Onset */}
          {profile.fatigueOnsetQuestion && (
            <PatternItem
              label="Optimal Session Length"
              value={`~${profile.fatigueOnsetQuestion} questions`}
              description="Your accuracy typically drops after this many questions"
              color="blue"
            />
          )}
        </div>
      </div>

      {/* System Strengths/Weaknesses */}
      {(profile.strongestSystems.length > 0 || profile.weakestSystems.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {profile.strongestSystems.length > 0 && (
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-data-pass)] mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Strong Systems
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.strongestSystems.map((system) => (
                  <span
                    key={system}
                    className="px-3 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-data-pass)] rounded-full text-sm"
                  >
                    {system}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.weakestSystems.length > 0 && (
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-data-provisional)] mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Focus Areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.weakestSystems.map((system) => (
                  <span
                    key={system}
                    className="px-3 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-data-provisional)] rounded-full text-sm"
                  >
                    {system}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {profile.recommendations.length > 0 && (
        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-accent)] mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Personalized Recommendations
          </h3>
          <ul className="space-y-2">
            {profile.recommendations.map((rec, i) => (
              <li
                key={`rec-${i}-${String(rec).slice(0, 40)}`}
                className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]"
              >
                <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] p-4 border-b border-[var(--color-border)] flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Recent Sessions
          </h3>
          <div className="divide-y divide-[var(--color-border)]">
            {sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {formatDate(session.startedAt)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {session.totalQuestions} questions
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        session.accuracy >= 80
                          ? 'text-[var(--color-data-pass)]'
                          : session.accuracy >= 60
                            ? 'text-[var(--color-data-provisional)]'
                            : 'text-[var(--color-data-fail)]'
                      }`}
                    >
                      {Math.round(session.accuracy)}%
                    </p>
                    {session.bestStreak > 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                        <Flame className="w-3 h-3 text-[var(--color-data-provisional)]" />
                        {session.bestStreak} streak
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper components
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
}> = ({ icon, label, value, sublabel }) => (
  <div className="bg-[var(--color-bg-primary)] rounded-xl p-4 border border-[var(--color-border)]">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
    </div>
    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
    {sublabel && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{sublabel}</p>}
  </div>
);

const PatternItem: React.FC<{
  label: string;
  value: string;
  description: string;
  color: 'green' | 'amber' | 'red' | 'blue';
}> = ({ label, value, description, color }) => {
  const colorClasses = {
    green: 'bg-[var(--color-bg-tertiary)] text-[var(--color-data-pass)]',
    amber: 'bg-[var(--color-bg-tertiary)] text-[var(--color-data-provisional)]',
    red: 'bg-[var(--color-bg-tertiary)] text-[var(--color-data-fail)]',
    blue: 'bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]',
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorClasses[color]}`}>
        {value}
      </span>
    </div>
  );
};

export default LearningProfileDashboard;
