/**
 * Widget Grid Component
 *
 * Flexible grid layout for customizable dashboard widgets.
 * Allows users to choose which statistics to display.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Target,
  Award,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Flame,
  FileText,
} from 'lucide-react';
import { calculateAccuracy } from '../../lib/dashboardUtils';

// ============================================================================
// Constants - Gold Achievement Thresholds
// ============================================================================

// Reserved for extraordinary performance only
const GOLD_ACHIEVEMENT_STREAK_THRESHOLD = 10;
const GOLD_ACHIEVEMENT_TREND_THRESHOLD = 10;
const PERFECT_DAY_QUESTION_THRESHOLD = 10;

// ============================================================================
// Types
// ============================================================================

export type WidgetId =
  | 'currentStreak'
  | 'bestStreak'
  | 'questionsAttempted'
  | 'overallAccuracy'
  | 'todayProgress'
  | 'weekProgress'
  | 'recentTrend'
  | 'studyDays'
  | 'speedVsAccuracy'
  | 'secondGuessFactor'
  | 'topicSplit'
  | 'vignetteStamina';

export interface WidgetConfig {
  id: WidgetId;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

export interface WidgetData {
  currentStreak: number;
  bestStreak: number;
  questionsAttempted: number;
  overallAccuracy: number;
  todayQuestions: number;
  todayCorrect: number;
  weekQuestions: number;
  weekCorrect: number;
  monthQuestions: number;
  monthCorrect: number;
  recentTrend: number;
  studyDays: number;
  // Deep Insight metrics
  avgTimeMs?: number;
  fastCorrectRate?: number; // Accuracy when answering quickly (< 30s)
  slowCorrectRate?: number; // Accuracy when answering slowly (> 60s)
  secondGuessAccuracy?: number; // Accuracy when answer was changed
  diagnosisAccuracy?: number;
  managementAccuracy?: number;
  // Vignette Stamina - Reading Fatigue metrics
  shortQuestionAccuracy?: number; // Accuracy on questions < 50 words
  longQuestionAccuracy?: number; // Accuracy on questions > 150 words
}

export type TimeScope = 'today' | '1wk' | '1mo';

interface WidgetGridProps {
  data: WidgetData;
  enabledWidgets: WidgetId[];
  timeScope: TimeScope;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_WIDGET_CONFIG: WidgetConfig[] = [
  // PRIORITIZE CURRENT FORM OVER LIFETIME STATS
  {
    id: 'todayProgress',
    label: "Today's Session",
    icon: <Clock className="w-5 h-5" />,
    enabled: true,
  },
  {
    id: 'recentTrend',
    label: 'Recent Form',
    icon: <TrendingUp className="w-5 h-5" />,
    enabled: true,
  },
  {
    id: 'currentStreak',
    label: 'Study Continuity',
    icon: <Zap className="w-5 h-5" />,
    enabled: true,
  },
  {
    id: 'overallAccuracy',
    label: 'Current Accuracy',
    icon: <BarChart3 className="w-5 h-5" />,
    enabled: true,
  },
  // De-emphasized: Lifetime stats (disabled by default)
  {
    id: 'questionsAttempted',
    label: 'Total Questions',
    icon: <Target className="w-5 h-5" />,
    enabled: false,
  },
  { id: 'bestStreak', label: 'Best Streak', icon: <Award className="w-5 h-5" />, enabled: false },
  { id: 'studyDays', label: 'Study Days', icon: <Flame className="w-5 h-5" />, enabled: false },
  {
    id: 'weekProgress',
    label: 'Week Progress',
    icon: <Calendar className="w-5 h-5" />,
    enabled: false,
  },
  // Deep Insight widgets - disabled by default (Case Endurance = accuracy on long vs short questions)
  {
    id: 'vignetteStamina',
    label: 'Case Endurance',
    icon: <FileText className="w-5 h-5" />,
    enabled: false,
  },
  {
    id: 'speedVsAccuracy',
    label: 'Speed vs Accuracy',
    icon: <Clock className="w-5 h-5" />,
    enabled: false,
  },
  {
    id: 'secondGuessFactor',
    label: 'Second-Guess Factor',
    icon: <TrendingDown className="w-5 h-5" />,
    enabled: false,
  },
  {
    id: 'topicSplit',
    label: 'Topic Split',
    icon: <BarChart3 className="w-5 h-5" />,
    enabled: false,
  },
];

/** Short descriptions for Settings tooltip preview (reduces cognitive load when toggling widgets) */
export const WIDGET_PREVIEW_INFO: Record<WidgetId, { description: string }> = {
  todayProgress: { description: 'Questions done today and session accuracy.' },
  recentTrend: { description: 'Trend vs previous 50 questions (+/- %).' },
  currentStreak: { description: 'Consecutive correct answers in a row.' },
  overallAccuracy: { description: 'Current accuracy (today/week/month scope).' },
  questionsAttempted: { description: 'Total questions in selected time scope.' },
  bestStreak: { description: 'Personal best consecutive correct streak.' },
  studyDays: { description: 'Number of days with at least one question.' },
  weekProgress: { description: "This week's questions and accuracy." },
  vignetteStamina: { description: 'Accuracy on short vs long questions (Case Endurance).' },
  speedVsAccuracy: { description: 'Fast (<30s) vs slow (>60s) answer accuracy.' },
  secondGuessFactor: { description: 'Accuracy when you changed your answer.' },
  topicSplit: { description: 'Diagnosis vs management question accuracy.' },
};

// ============================================================================
// Widget Components
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  colorClass?: string;
  trend?: number;
  delay?: number;
  isGoldAchievement?: boolean; // Reserved for extraordinary achievements
  isClinicalAchievement?: boolean; // Teal/green success (avoids red/yellow medical alarm)
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtext,
  colorClass = 'text-[var(--color-text-primary)]',
  trend,
  delay = 0,
  isGoldAchievement = false,
  isClinicalAchievement = false,
}) => {
  const isHighlight = isGoldAchievement || isClinicalAchievement;
  const highlightClass = isClinicalAchievement ? 'clinical-achievement' : 'gold-achievement';
  const highlightTextClass = isClinicalAchievement ? 'text-[var(--color-accent)]' : 'text-data-provisional';
  const highlightIconClass = isClinicalAchievement ? 'text-[var(--color-accent)]' : 'text-data-provisional';
  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`${
        isHighlight ? `${highlightClass} rounded-2xl` : 'widget-premium-glass widget-noise-texture'
      } p-4 hover:shadow-lg transition-all duration-300 relative`}
    >
      {isHighlight && (
        <Award
          className={`absolute top-2 right-2 w-5 h-5 ${highlightIconClass} ${isGoldAchievement ? 'animate-pulse' : ''}`}
        />
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className={isHighlight ? highlightTextClass : colorClass}>{icon}</span>
        <span className={`stat-label-sm ${isHighlight ? highlightTextClass : ''}`}>{label}</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`text-4xl font-light ${isHighlight ? `${highlightTextClass} font-bold` : colorClass}`}
        >
          {value}
        </span>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${
              trend > 0 ? 'text-[var(--color-accent)]' : trend < 0 ? 'text-data-neutral' : 'text-data-neutral'
            }`}
          >
            {trend > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : null}
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
        )}
      </div>

      {subtext && (
        <span
          className={`text-[10px] mt-1 block ${isHighlight ? `${highlightTextClass} font-semibold` : 'text-[var(--color-text-muted)]'}`}
        >
          {subtext}
        </span>
      )}
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const WidgetGrid: React.FC<WidgetGridProps> = ({ data, enabledWidgets, timeScope }) => {
  // Get appropriate data based on time scope
  const getScopedQuestions = () => {
    switch (timeScope) {
      case 'today':
        return { questions: data.todayQuestions, correct: data.todayCorrect };
      case '1wk':
        return { questions: data.weekQuestions, correct: data.weekCorrect };
      case '1mo':
        return { questions: data.monthQuestions, correct: data.monthCorrect };
    }
  };

  const scopedData = getScopedQuestions();
  const scopedAccuracy = calculateAccuracy(scopedData.correct, scopedData.questions);

  // Render individual widgets
  const renderWidget = (widgetId: WidgetId, index: number) => {
    const delay = index * 0.05;

    switch (widgetId) {
      case 'currentStreak': {
        // Clinical: "Study Continuity" / "Consecutive Correct" with teal (no red/yellow)
        const isStrongConsistency = data.currentStreak >= GOLD_ACHIEVEMENT_STREAK_THRESHOLD;
        return (
          <StatCard
            key={widgetId}
            icon={<Zap className="w-5 h-5" />}
            label={isStrongConsistency ? 'Study Continuity' : 'Consecutive Correct'}
            value={data.currentStreak}
            subtext={isStrongConsistency ? 'Strong consistency' : 'Questions in a row'}
            colorClass="text-[var(--color-accent)]"
            isClinicalAchievement={isStrongConsistency}
            delay={delay}
          />
        );
      }

      case 'bestStreak':
        // De-emphasized: Lifetime stat
        return (
          <StatCard
            key={widgetId}
            icon={<Award className="w-5 h-5" />}
            label="All-Time Best"
            value={data.bestStreak}
            subtext="Personal record"
            colorClass="text-[var(--color-text-muted)]"
            delay={delay}
          />
        );

      case 'questionsAttempted':
        // De-emphasized: Total lifetime questions
        return (
          <StatCard
            key={widgetId}
            icon={<Target className="w-5 h-5" />}
            label="Total Attempts"
            value={scopedData.questions}
            subtext={`${scopedData.correct} correct`}
            colorClass="text-[var(--color-text-muted)]"
            delay={delay}
          />
        );

      case 'overallAccuracy':
        // Emphasize: This is rolling/scoped accuracy, not lifetime
        return (
          <StatCard
            key={widgetId}
            icon={<BarChart3 className="w-5 h-5" />}
            label="Current Accuracy"
            value={`${scopedAccuracy}%`}
            subtext={
              timeScope === 'today' ? 'Today' : timeScope === '1wk' ? 'This week' : 'This month'
            }
            colorClass="text-[var(--color-text-primary)]"
            delay={delay}
          />
        );

      case 'todayProgress': {
        // Emphasize: Today's performance (clinical tone: teal for strong session)
        const isStrongSession =
          data.todayQuestions >= PERFECT_DAY_QUESTION_THRESHOLD &&
          data.todayCorrect === data.todayQuestions;
        return (
          <StatCard
            key={widgetId}
            icon={isStrongSession ? <Award className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            label="Today's Session"
            value={data.todayQuestions === 0 ? '—' : `${data.todayCorrect}/${data.todayQuestions}`}
            subtext={
              data.todayQuestions > 0
                ? isStrongSession
                  ? 'Strong performance'
                  : `${Math.round((data.todayCorrect / data.todayQuestions) * 100)}% accuracy`
                : 'Ready to start'
            }
            colorClass="text-[var(--color-accent)]"
            isClinicalAchievement={isStrongSession}
            delay={delay}
          />
        );
      }

      case 'weekProgress':
        return (
          <StatCard
            key={widgetId}
            icon={<Calendar className="w-5 h-5" />}
            label="This Week"
            value={`${data.weekCorrect}/${data.weekQuestions}`}
            subtext={
              data.weekQuestions > 0
                ? `${Math.round((data.weekCorrect / data.weekQuestions) * 100)}% accuracy`
                : 'No questions yet'
            }
            colorClass="text-[var(--color-accent)]"
            delay={delay}
          />
        );

      case 'recentTrend':
        // Emphasize: Your current form matters more than past mistakes
        return (
          <StatCard
            key={widgetId}
            icon={
              data.recentTrend >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )
            }
            label="Recent Form"
            value={`${data.recentTrend >= 0 ? '+' : ''}${data.recentTrend}%`}
            subtext="Last 50 questions"
            colorClass={data.recentTrend >= 0 ? 'text-[var(--color-accent)]' : 'text-data-neutral'}
            delay={delay}
          />
        );

      case 'studyDays':
        return (
          <StatCard
            key={widgetId}
            icon={<Flame className="w-5 h-5" />}
            label="Study Days"
            value={data.studyDays}
            colorClass="text-[var(--color-accent)]"
            delay={delay}
          />
        );

      // Deep Insight Widgets
      case 'vignetteStamina': {
        // Short/Long question word count thresholds for UI display
        const SHORT_THRESHOLD = 50;
        const LONG_THRESHOLD = 150;
        const diff = (data.shortQuestionAccuracy ?? 0) - (data.longQuestionAccuracy ?? 0);
        // Positive diff means short questions have higher accuracy
        const diffText =
          diff > 0
            ? `You perform ${Math.abs(diff).toFixed(0)}% worse when questions exceed ${LONG_THRESHOLD} words.`
            : diff < 0
              ? `You are ${Math.abs(diff).toFixed(0)}% more accurate on longer questions.`
              : 'Your accuracy is consistent across question lengths.';
        return (
          <motion.div
            key={widgetId}
            initial={{ y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="widget-premium-glass widget-noise-texture p-4 col-span-2"
            title={diffText}
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-[var(--color-accent)]" />
              <span className="stat-label-sm">Case Endurance</span>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="flex-1"
                title={`Accuracy on questions with less than ${SHORT_THRESHOLD} words`}
              >
                <div className="stat-label-sm mb-1">{`Short (<${SHORT_THRESHOLD} words)`}</div>
                <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--color-accent)]/60 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.shortQuestionAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-2xl font-light text-[var(--color-text-primary)] mt-1">
                  {data.shortQuestionAccuracy ?? 0}%
                </div>
              </div>
              <div
                className="flex-1"
                title={`Accuracy on questions with more than ${LONG_THRESHOLD} words`}
              >
                <div className="stat-label-sm mb-1">{`Long (>${LONG_THRESHOLD} words)`}</div>
                <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--color-accent)] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.longQuestionAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
                <div className="text-2xl font-light text-[var(--color-text-primary)] mt-1">
                  {data.longQuestionAccuracy ?? 0}%
                </div>
              </div>
            </div>
            <p
              className="text-[10px] text-[var(--color-text-muted)] mt-2 flex items-start gap-1"
              title={diffText}
            >
              <Award className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{diffText}</span>
            </p>
          </motion.div>
        );
      }

      case 'speedVsAccuracy':
        return (
          <motion.div
            key={widgetId}
            initial={{ y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="widget-premium-glass widget-noise-texture p-4 col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-[var(--color-category-practice)]" />
              <span className="stat-label-sm">Speed vs Accuracy</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="stat-label-sm mb-1">{'Fast (<30s)'}</div>
                <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--color-category-practice)] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.fastCorrectRate ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-2xl font-light text-[var(--color-text-primary)] mt-1">
                  {data.fastCorrectRate ?? 0}%
                </div>
              </div>
              <div className="flex-1">
                <div className="stat-label-sm mb-1">{'Slow (>60s)'}</div>
                <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-data-pass rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.slowCorrectRate ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
                <div className="text-2xl font-light text-[var(--color-text-primary)] mt-1">
                  {data.slowCorrectRate ?? 0}%
                </div>
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2 flex items-start gap-1">
              <Award className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                {(data.fastCorrectRate ?? 0) < (data.slowCorrectRate ?? 0)
                  ? 'Slow down! Your accuracy improves with more time.'
                  : "Good pace! Your speed doesn't hurt accuracy."}
              </span>
            </p>
          </motion.div>
        );

      case 'secondGuessFactor':
        return (
          <StatCard
            key={widgetId}
            icon={<TrendingDown className="w-5 h-5" />}
            label="Second-Guess Factor"
            value={`${data.secondGuessAccuracy ?? 0}%`}
            subtext="Accuracy when changing answers"
            colorClass={
              (data.secondGuessAccuracy ?? 50) >= 50 ? 'text-data-pass' : 'text-data-provisional'
            }
            delay={delay}
          />
        );

      case 'topicSplit':
        return (
          <motion.div
            key={widgetId}
            initial={{ y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="widget-premium-glass widget-noise-texture p-4 col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
              <span className="stat-label-sm">Topic Split</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="stat-label-sm">Diagnosis</span>
                  <span className="text-2xl font-light text-[var(--color-text-primary)]">
                    {data.diagnosisAccuracy ?? 0}%
                  </span>
                </div>
                <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-l-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--color-accent)] rounded-l-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.diagnosisAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <div className="w-px h-8 bg-[var(--color-border)]" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="stat-label-sm">Management</span>
                  <span className="text-2xl font-light text-[var(--color-text-primary)]">
                    {data.managementAccuracy ?? 0}%
                  </span>
                </div>
                <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-r-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--color-accent)] rounded-r-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.managementAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] flex items-start gap-1">
              <Award className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                {(data.diagnosisAccuracy ?? 0) > (data.managementAccuracy ?? 0)
                  ? 'Focus more on treatment & pharmacology.'
                  : 'Focus more on diagnosis & differentials.'}
              </span>
            </p>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 grid-flow-dense">
      {enabledWidgets.map((widgetId, index) => renderWidget(widgetId, index))}
    </div>
  );
};

export default WidgetGrid;
