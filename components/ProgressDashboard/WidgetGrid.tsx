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
  Flame
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
  | 'topicSplit';

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
  colorClass = 'text-slate-900 dark:text-[var(--color-accent)]',
  trend,
  delay = 0
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center gap-2 mb-2">
      <span className={colorClass}>{icon}</span>
      <span className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide font-medium">
        {label}
      </span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
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
      <span className="text-xs text-slate-600 dark:text-slate-400">{subtext}</span>
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
      case 'speedVsAccuracy':
        return (
          <motion.div
            key={widgetId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide font-medium">
                Speed vs Accuracy
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{"Fast (<30s)"}</div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${data.fastCorrectRate ?? 0}%` }}
                  />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {data.fastCorrectRate ?? 0}%
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{"Slow (>60s)"}</div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${data.slowCorrectRate ?? 0}%` }}
                  />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {data.slowCorrectRate ?? 0}%
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
              {(data.fastCorrectRate ?? 0) < (data.slowCorrectRate ?? 0) 
                ? "⚡ Slow down! Your accuracy improves with more time."
                : "✓ Good pace! Your speed doesn't hurt accuracy."}
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
            className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-violet-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide font-medium">
                Topic Split
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Diagnosis</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{data.diagnosisAccuracy ?? 0}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-l-full overflow-hidden">
                  <div 
                    className="h-full bg-sky-500 rounded-l-full transition-all"
                    style={{ width: `${data.diagnosisAccuracy ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="w-px h-8 bg-slate-300 dark:bg-slate-600" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Management</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{data.managementAccuracy ?? 0}%</span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-r-full overflow-hidden">
                  <div 
                    className="h-full bg-violet-500 rounded-r-full transition-all"
                    style={{ width: `${data.managementAccuracy ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {(data.diagnosisAccuracy ?? 0) > (data.managementAccuracy ?? 0)
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {enabledWidgets.map((widgetId, index) => renderWidget(widgetId, index))}
    </div>
  );
};

export default WidgetGrid;
