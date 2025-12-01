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
  FileText
} from 'lucide-react';
import { calculateAccuracy } from '../../lib/dashboardUtils';

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
  longQuestionAccuracy?: number;  // Accuracy on questions > 150 words
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
  { id: 'currentStreak', label: 'Current Streak', icon: <Zap className="w-5 h-5" />, enabled: true },
  { id: 'bestStreak', label: 'Best Streak', icon: <Award className="w-5 h-5" />, enabled: true },
  { id: 'questionsAttempted', label: 'Questions Attempted', icon: <Target className="w-5 h-5" />, enabled: true },
  { id: 'overallAccuracy', label: 'Overall Accuracy', icon: <BarChart3 className="w-5 h-5" />, enabled: true },
  { id: 'todayProgress', label: 'Today\'s Progress', icon: <Clock className="w-5 h-5" />, enabled: true },
  { id: 'weekProgress', label: 'Week Progress', icon: <Calendar className="w-5 h-5" />, enabled: false },
  { id: 'recentTrend', label: 'Recent Trend', icon: <TrendingUp className="w-5 h-5" />, enabled: true },
  { id: 'studyDays', label: 'Study Days', icon: <Flame className="w-5 h-5" />, enabled: false },
  // Deep Insight widgets - disabled by default
  { id: 'vignetteStamina', label: 'Vignette Stamina', icon: <FileText className="w-5 h-5" />, enabled: false },
  { id: 'speedVsAccuracy', label: 'Speed vs Accuracy', icon: <Clock className="w-5 h-5" />, enabled: false },
  { id: 'secondGuessFactor', label: 'Second-Guess Factor', icon: <TrendingDown className="w-5 h-5" />, enabled: false },
  { id: 'topicSplit', label: 'Topic Split', icon: <BarChart3 className="w-5 h-5" />, enabled: false },
];

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
}

const StatCard: React.FC<StatCardProps> = ({ 
  icon, 
  label, 
  value, 
  subtext, 
  colorClass = 'text-slate-900 dark:text-slate-100',
  trend,
  delay = 0
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="widget-premium-glass widget-noise-texture p-4 hover:shadow-lg transition-shadow"
  >
    {/* Small uppercase label */}
    <div className="flex items-center gap-2 mb-3">
      <span className={colorClass}>{icon}</span>
      <span className="stat-label-sm">
        {label}
      </span>
    </div>
    {/* Large thin data value */}
    <div className="flex items-baseline gap-2">
      <span className={`text-4xl font-light ${colorClass}`}>{value}</span>
      {trend !== undefined && (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${
          trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-slate-500'
        }`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    {subtext && (
      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">{subtext}</span>
    )}
  </motion.div>
);

// ============================================================================
// Main Component
// ============================================================================

const WidgetGrid: React.FC<WidgetGridProps> = ({
  data,
  enabledWidgets,
  timeScope,
}) => {
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
      case 'currentStreak':
        return (
          <StatCard
            key={widgetId}
            icon={<Zap className="w-5 h-5" />}
            label="Current Streak"
            value={data.currentStreak}
            colorClass="text-orange-500"
            delay={delay}
          />
        );
      
      case 'bestStreak':
        return (
          <StatCard
            key={widgetId}
            icon={<Award className="w-5 h-5" />}
            label="Best Streak"
            value={data.bestStreak}
            colorClass="text-amber-500"
            delay={delay}
          />
        );
      
      case 'questionsAttempted':
        return (
          <StatCard
            key={widgetId}
            icon={<Target className="w-5 h-5" />}
            label="Questions"
            value={scopedData.questions}
            subtext={`${scopedData.correct} correct`}
            colorClass="text-slate-900 dark:text-slate-100"
            delay={delay}
          />
        );
      
      case 'overallAccuracy':
        return (
          <StatCard
            key={widgetId}
            icon={<BarChart3 className="w-5 h-5" />}
            label="Accuracy"
            value={`${scopedAccuracy}%`}
            colorClass="text-slate-900 dark:text-slate-100"
            delay={delay}
          />
        );
      
      case 'todayProgress':
        return (
          <StatCard
            key={widgetId}
            icon={<Clock className="w-5 h-5" />}
            label="Today"
            value={`${data.todayCorrect}/${data.todayQuestions}`}
            subtext={data.todayQuestions > 0 
              ? `${Math.round((data.todayCorrect / data.todayQuestions) * 100)}% accuracy`
              : 'No questions yet'
            }
            colorClass="text-blue-500"
            delay={delay}
          />
        );
      
      case 'weekProgress':
        return (
          <StatCard
            key={widgetId}
            icon={<Calendar className="w-5 h-5" />}
            label="This Week"
            value={`${data.weekCorrect}/${data.weekQuestions}`}
            subtext={data.weekQuestions > 0 
              ? `${Math.round((data.weekCorrect / data.weekQuestions) * 100)}% accuracy`
              : 'No questions yet'
            }
            colorClass="text-indigo-500"
            delay={delay}
          />
        );
      
      case 'recentTrend':
        return (
          <StatCard
            key={widgetId}
            icon={data.recentTrend >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            label="Recent Trend"
            value={`${data.recentTrend >= 0 ? '+' : ''}${data.recentTrend}%`}
            subtext="Last 50 vs previous 50"
            colorClass={data.recentTrend >= 0 ? 'text-green-500' : 'text-red-500'}
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
            colorClass="text-purple-500"
            delay={delay}
          />
        );
      
      // Deep Insight Widgets
      case 'vignetteStamina':
        // Short/Long question word count thresholds for UI display
        const SHORT_THRESHOLD = 50;
        const LONG_THRESHOLD = 150;
        const diff = (data.shortQuestionAccuracy ?? 0) - (data.longQuestionAccuracy ?? 0);
        // Positive diff means short questions have higher accuracy
        const diffText = diff > 0 
          ? `You perform ${Math.abs(diff).toFixed(0)}% worse when questions exceed ${LONG_THRESHOLD} words.`
          : diff < 0 
          ? `You are ${Math.abs(diff).toFixed(0)}% more accurate on longer questions.`
          : 'Your accuracy is consistent across question lengths.';
        return (
          <motion.div
            key={widgetId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="widget-premium-glass widget-noise-texture p-4 col-span-2"
            title={diffText}
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span className="stat-label-sm">
                Vignette Stamina
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1" title={`Accuracy on questions with less than ${SHORT_THRESHOLD} words`}>
                <div className="stat-label-sm mb-1">{`Short (<${SHORT_THRESHOLD} words)`}</div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.shortQuestionAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-2xl font-light text-slate-900 dark:text-slate-100 mt-1">
                  {data.shortQuestionAccuracy ?? 0}%
                </div>
              </div>
              <div className="flex-1" title={`Accuracy on questions with more than ${LONG_THRESHOLD} words`}>
                <div className="stat-label-sm mb-1">{`Long (>${LONG_THRESHOLD} words)`}</div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-purple-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.longQuestionAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
                <div className="text-2xl font-light text-slate-900 dark:text-slate-100 mt-1">
                  {data.longQuestionAccuracy ?? 0}%
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2" title={diffText}>
              💡 {diffText}
            </p>
          </motion.div>
        );

      case 'speedVsAccuracy':
        return (
          <motion.div
            key={widgetId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="widget-premium-glass widget-noise-texture p-4 col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="stat-label-sm">
                Speed vs Accuracy
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="stat-label-sm mb-1">{"Fast (<30s)"}</div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.fastCorrectRate ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-2xl font-light text-slate-900 dark:text-slate-100 mt-1">
                  {data.fastCorrectRate ?? 0}%
                </div>
              </div>
              <div className="flex-1">
                <div className="stat-label-sm mb-1">{"Slow (>60s)"}</div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.slowCorrectRate ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
                <div className="text-2xl font-light text-slate-900 dark:text-slate-100 mt-1">
                  {data.slowCorrectRate ?? 0}%
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
              💡 {(data.fastCorrectRate ?? 0) < (data.slowCorrectRate ?? 0) 
                ? "Slow down! Your accuracy improves with more time."
                : "Good pace! Your speed doesn't hurt accuracy."}
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
            colorClass={(data.secondGuessAccuracy ?? 50) >= 50 ? 'text-emerald-500' : 'text-amber-500'}
            delay={delay}
          />
        );
      
      case 'topicSplit':
        return (
          <motion.div
            key={widgetId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="widget-premium-glass widget-noise-texture p-4 col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-violet-500" />
              <span className="stat-label-sm">
                Topic Split
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="stat-label-sm">Diagnosis</span>
                  <span className="text-2xl font-light text-slate-900 dark:text-slate-100">{data.diagnosisAccuracy ?? 0}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-l-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-sky-500 rounded-l-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.diagnosisAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <div className="w-px h-8 bg-slate-300 dark:bg-slate-600" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="stat-label-sm">Management</span>
                  <span className="text-2xl font-light text-slate-900 dark:text-slate-100">{data.managementAccuracy ?? 0}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-r-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-violet-500 rounded-r-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.managementAccuracy ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              💡 {(data.diagnosisAccuracy ?? 0) > (data.managementAccuracy ?? 0)
                ? "Focus more on treatment & pharmacology."
                : "Focus more on diagnosis & differentials."}
            </p>
          </motion.div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {enabledWidgets.map((widgetId, index) => renderWidget(widgetId, index))}
    </div>
  );
};

export default WidgetGrid;
