/**
 * UserFriendlyStatsDisplay
 * 
 * A clean, intuitive display of analytics that regular users can understand.
 * Shows actionable insights without overwhelming with data.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  Brain,
  Zap,
  Calendar,
  Award,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Lightbulb,
  BookOpen,
  Timer,
  Flame,
  BarChart2,
  Activity,
  Sun,
  Moon,
  Coffee,
  RefreshCw,
} from 'lucide-react';
import {
  generateUserFriendlyStats,
  assessTestReadiness,
  analyzeStrengthsWeaknesses,
  type UserFriendlyStats,
  type TestReadinessAssessment,
  type StrengthWeaknessAnalysis,
} from '@/services/analytics';

// ============================================================================
// Types
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

// ============================================================================
// Sub-Components
// ============================================================================

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  trendValue,
  color = 'blue',
}) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4"
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend === 'up' ? 'text-emerald-500' :
            trend === 'down' ? 'text-red-500' :
            'text-[var(--color-text-muted)]'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> :
             trend === 'down' ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
        {subtext && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{subtext}</p>
        )}
      </div>
    </motion.div>
  );
};

const InsightCard: React.FC<{ insight: string; index: number }> = ({ insight, index }) => {
  const emoji = insight.slice(0, 2);
  const text = insight.slice(2).trim();
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-start gap-3 p-3 bg-[var(--color-surface)] rounded-lg"
    >
      <span className="text-xl">{emoji}</span>
      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{text}</p>
    </motion.div>
  );
};

const ReadinessGauge: React.FC<{ score: number; passProbability: number }> = ({
  score,
  passProbability,
}) => {
  const getColor = (s: number) => {
    if (s >= 80) return '#10b981'; // green
    if (s >= 65) return '#3b82f6'; // blue
    if (s >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };
  
  const getLabel = (s: number) => {
    if (s >= 80) return 'Ready';
    if (s >= 65) return 'Almost Ready';
    if (s >= 50) return 'Progressing';
    if (s >= 30) return 'Building';
    return 'Getting Started';
  };

  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Exam Readiness
      </h3>
      
      <div className="flex items-center gap-6">
        {/* Circular gauge */}
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="var(--color-surface)"
              strokeWidth="8"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke={getColor(score)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={251.2}
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * score / 100) }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">{score}</span>
            <span className="text-xs text-[var(--color-text-muted)]">/ 100</span>
          </div>
        </div>
        
        <div className="flex-1">
          <p className="text-lg font-semibold text-[var(--color-text-primary)]" style={{ color: getColor(score) }}>
            {getLabel(score)}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {passProbability}% estimated pass probability
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[var(--color-text-muted)]">Pass Probability</span>
              <span className="font-medium text-[var(--color-text-primary)]">{passProbability}%</span>
            </div>
            <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${passProbability}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: getColor(passProbability) }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemStrengthBar: React.FC<{
  system: string;
  mastery: number;
  trend: 'improving' | 'stable' | 'declining';
  isStrength: boolean;
}> = ({ system, mastery, trend, isStrength }) => {
  const getBarColor = (m: number) => {
    if (m >= 80) return 'bg-emerald-500';
    if (m >= 60) return 'bg-blue-500';
    if (m >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs font-medium text-[var(--color-text-primary)] truncate">
        {system}
      </div>
      <div className="flex-1 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${mastery}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${getBarColor(mastery)}`}
        />
      </div>
      <div className="w-10 text-xs font-medium text-right text-[var(--color-text-primary)]">
        {mastery}%
      </div>
      <div className={`w-4 ${
        trend === 'improving' ? 'text-emerald-500' :
        trend === 'declining' ? 'text-red-500' :
        'text-[var(--color-text-muted)]'
      }`}>
        {trend === 'improving' ? <TrendingUp className="w-4 h-4" /> :
         trend === 'declining' ? <TrendingDown className="w-4 h-4" /> :
         <Minus className="w-4 h-4" />}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{
  recommendation: {
    recommendation: string;
    priority: string;
    evidence: string;
    expectedImpact: string;
    actionable: string;
  };
  index: number;
}> = ({ recommendation, index }) => {
  const [expanded, setExpanded] = useState(false);
  
  const priorityColors = {
    critical: 'border-red-500/50 bg-red-500/5',
    high: 'border-amber-500/50 bg-amber-500/5',
    medium: 'border-blue-500/50 bg-blue-500/5',
    low: 'border-slate-500/50 bg-slate-500/5',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`border rounded-xl overflow-hidden ${priorityColors[recommendation.priority as keyof typeof priorityColors] || priorityColors.medium}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-[var(--color-surface)] transition-colors"
      >
        <div className={`mt-0.5 ${
          recommendation.priority === 'critical' ? 'text-red-500' :
          recommendation.priority === 'high' ? 'text-amber-500' :
          'text-blue-500'
        }`}>
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-[var(--color-text-primary)] text-sm">
            {recommendation.recommendation}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            {recommendation.expectedImpact}
          </p>
        </div>
        <ChevronRight className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[var(--color-border)]"
          >
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Research Evidence</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{recommendation.evidence}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Action Step</p>
                <p className="text-sm text-[var(--color-text-primary)] font-medium">{recommendation.actionable}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UserFriendlyStatsDisplay: React.FC = () => {
  const [stats, setStats] = useState<UserFriendlyStats | null>(null);
  const [readiness, setReadiness] = useState<TestReadinessAssessment | null>(null);
  const [systems, setSystems] = useState<StrengthWeaknessAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'systems'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, readinessData, systemsData] = await Promise.all([
        generateUserFriendlyStats(),
        assessTestReadiness(),
        analyzeStrengthsWeaknesses(),
      ]);
      setStats(statsData);
      setReadiness(readinessData);
      setSystems(systemsData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-[var(--color-text-muted)]">Analyzing your learning data...</span>
      </div>
    );
  }

  if (!stats || !readiness) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-3" />
        <p className="text-[var(--color-text-primary)] font-medium">Not enough data yet</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Complete more questions to see your personalized analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-[var(--color-surface)] p-1 rounded-xl">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'insights', label: 'Insights', icon: Lightbulb },
          { id: 'systems', label: 'Systems', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Readiness Gauge */}
            <ReadinessGauge 
              score={readiness.readinessScore} 
              passProbability={readiness.passProbability} 
            />

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Lifetime Accuracy"
                value={`${stats.accuracyLifetime}%`}
                icon={<Target className="w-5 h-5" />}
                trend={stats.accuracyTrend === 'improving' ? 'up' : stats.accuracyTrend === 'declining' ? 'down' : 'stable'}
                trendValue={`${stats.accuracyChange > 0 ? '+' : ''}${stats.accuracyChange}%`}
                color={stats.accuracyLifetime >= 70 ? 'green' : stats.accuracyLifetime >= 50 ? 'amber' : 'red'}
              />
              
              <StatCard
                label="Study Streak"
                value={stats.studyDaysStreak}
                subtext="consecutive days"
                icon={<Flame className="w-5 h-5" />}
                color={stats.studyDaysStreak >= 7 ? 'green' : stats.studyDaysStreak >= 3 ? 'amber' : 'blue'}
              />
              
              <StatCard
                label="Total Questions"
                value={stats.totalQuestionsLifetime.toLocaleString()}
                subtext={`${stats.last7DaysQuestions} this week`}
                icon={<BookOpen className="w-5 h-5" />}
                color="purple"
              />
              
              <StatCard
                label="Predicted Score"
                value={readiness.predictedScore}
                subtext={`${readiness.scoreRange.low}-${readiness.scoreRange.high} range`}
                icon={<Award className="w-5 h-5" />}
                color={readiness.predictedScore >= 500 ? 'green' : readiness.predictedScore >= 450 ? 'amber' : 'red'}
              />
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4 text-center">
                <Clock className="w-5 h-5 mx-auto text-blue-500 mb-2" />
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{stats.avgTimePerQuestion}s</p>
                <p className="text-xs text-[var(--color-text-muted)]">avg per question</p>
              </div>
              
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4 text-center">
                <Timer className="w-5 h-5 mx-auto text-amber-500 mb-2" />
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{stats.totalStudyHours}h</p>
                <p className="text-xs text-[var(--color-text-muted)]">total study time</p>
              </div>
              
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4 text-center">
                <Zap className="w-5 h-5 mx-auto text-purple-500 mb-2" />
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{stats.questionsPerHour}</p>
                <p className="text-xs text-[var(--color-text-muted)]">questions/hour</p>
              </div>
            </div>

            {/* Top Insights */}
            <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Key Insights for You
              </h3>
              <div className="space-y-3">
                {stats.topInsights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} index={i} />
                ))}
              </div>
            </div>

            {/* Behavioral Patterns */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Test-Taking Pattern
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">First Instinct Accuracy</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{stats.firstInstinctAccuracy}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">Answer Changes Help</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{stats.answerChangeHelpfulness}%</span>
                  </div>
                  <div className={`p-3 rounded-lg ${stats.shouldTrustFirstInstinct ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'} text-sm flex items-center gap-2`}>
                    <Lightbulb className="w-4 h-4 flex-shrink-0" />
                    {stats.shouldTrustFirstInstinct 
                      ? 'Trust your gut - your first answers are usually correct'
                      : 'Take your time - reconsidering helps your score'}
                  </div>
                </div>
              </div>

              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                  {stats.bestStudyTime.includes('AM') || parseInt(stats.bestStudyTime) < 12 
                    ? <Sun className="w-4 h-4" /> 
                    : <Moon className="w-4 h-4" />}
                  Optimal Study Time
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">Peak Performance</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{stats.bestStudyTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">Fatigue Point</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{stats.fatiguePoint} questions</span>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    Take a break every {stats.optimalBreakFrequency} questions
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
                Research-Backed Recommendations
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                Personalized advice based on learning science research
              </p>
              <div className="space-y-3">
                {readiness.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} recommendation={rec} index={i} />
                ))}
              </div>
            </div>

            {/* Study Focus Areas */}
            {readiness.priorityAreas.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Priority Study Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {readiness.priorityAreas.map(area => (
                    <span
                      key={area}
                      className="px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full text-sm font-medium"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths to Maintain */}
            {readiness.strengths.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Strengths to Maintain
                </h3>
                <div className="flex flex-wrap gap-2">
                  {readiness.strengths.map(strength => (
                    <span
                      key={strength}
                      className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Days to Ready */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Calendar className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {readiness.recommendedStudyDays === 0 
                      ? "You're Ready!" 
                      : `${readiness.recommendedStudyDays} days`}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {readiness.recommendedStudyDays === 0
                      ? "You've reached your target readiness level"
                      : "of focused study recommended before exam"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'systems' && systems && (
          <motion.div
            key="systems"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Strengths */}
            {systems.strengths.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Your Strengths ({systems.strengths.length})
                </h3>
                <div className="space-y-3">
                  {systems.strengths.slice(0, 5).map(sys => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend}
                      isStrength
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {systems.weaknesses.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Areas to Improve ({systems.weaknesses.length})
                </h3>
                <div className="space-y-3">
                  {systems.weaknesses.slice(0, 5).map(sys => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend}
                      isStrength={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Improving */}
            {systems.improving.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Rapidly Improving ({systems.improving.length})
                </h3>
                <div className="space-y-3">
                  {systems.improving.slice(0, 3).map(sys => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend}
                      isStrength
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Declining */}
            {systems.declining.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Needs Review ({systems.declining.length})
                </h3>
                <div className="space-y-3">
                  {systems.declining.slice(0, 3).map(sys => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend}
                      isStrength={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Analytics
        </button>
      </div>
    </div>
  );
};

export default UserFriendlyStatsDisplay;
