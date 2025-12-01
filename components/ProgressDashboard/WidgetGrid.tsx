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
  | 'studyDays';

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
  colorClass = 'text-[var(--color-accent)]',
  trend,
  delay = 0
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-[var(--color-glass-bg)] backdrop-blur-sm border border-[var(--color-glass-border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center gap-2 mb-2">
      <span className={colorClass}>{icon}</span>
      <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium">
        {label}
      </span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
      {trend !== undefined && (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${
          trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-[var(--color-text-muted)]'
        }`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    {subtext && (
      <span className="text-xs text-[var(--color-text-muted)]">{subtext}</span>
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
            colorClass="text-[var(--color-text-primary)]"
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
            colorClass="text-[var(--color-accent)]"
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
