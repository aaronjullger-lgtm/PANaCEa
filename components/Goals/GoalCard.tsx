/**
 * Goal Card Component
 *
 * Displays individual goal with:
 * - Progress bar
 * - Streak badge
 * - Edit/Delete actions
 * - Status indicators
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  Calendar,
  Target,
  Edit2,
  Trash2,
  CheckCircle,
  Pause,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import type { UserGoal } from './GoalsDashboard';

interface GoalCardProps {
  goal: UserGoal;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<UserGoal>) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onEdit, onDelete, onUpdate }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'completed':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'paused':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'failed':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-slate-600 bg-slate-100 dark:bg-slate-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <TrendingUp className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'paused':
        return <Pause className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'exam_date':
        return 'Exam Goal';
      case 'mastery':
        return 'Mastery';
      default:
        return type;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilTarget = () => {
    if (!goal.targetDate) return null;
    const target = new Date(goal.targetDate);
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysRemaining = getDaysUntilTarget();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {goal.title}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(goal.status)}`}
            >
              {getStatusIcon(goal.status)}
              {goal.status}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
              {getTypeLabel(goal.goalType)}
            </span>
          </div>

          {goal.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{goal.description}</p>
          )}

          {goal.motivationNotes && (
            <p className="text-sm text-blue-600 dark:text-blue-400 italic">
              💭 {goal.motivationNotes}
            </p>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Edit goal"
          >
            <Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete goal"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-600 dark:text-slate-400">
            Progress: {goal.currentValue} / {goal.targetValue || '∞'} {goal.targetUnit || 'units'}
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {goal.progressPercentage.toFixed(0)}%
          </span>
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(goal.progressPercentage, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {/* Streak */}
        {goal.currentStreak > 0 && (
          <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-medium">
            <Flame className="w-4 h-4" />
            <span>{goal.currentStreak} day streak</span>
            {goal.bestStreak > goal.currentStreak && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                (best: {goal.bestStreak})
              </span>
            )}
          </div>
        )}

        {/* Target Date */}
        {goal.targetDate && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>
              {formatDate(goal.targetDate)}
              {daysRemaining !== null && daysRemaining > 0 && (
                <span className="ml-1 text-xs">({daysRemaining} days left)</span>
              )}
              {daysRemaining !== null && daysRemaining < 0 && (
                <span className="ml-1 text-xs text-red-600">(overdue)</span>
              )}
            </span>
          </div>
        )}

        {/* Target System */}
        {goal.targetSystem && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Target className="w-4 h-4" />
            <span>{goal.targetSystem}</span>
          </div>
        )}

        {/* Recurring Badge */}
        {goal.isRecurring && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            Recurring
          </span>
        )}
      </div>

      {/* Milestones */}
      {goal.milestones && Array.isArray(goal.milestones) && goal.milestones.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Milestones:</div>
          <div className="flex gap-2 flex-wrap">
            {(goal.milestones as any[]).map((milestone, idx) => (
              <div
                key={idx}
                className={`px-2 py-1 rounded text-xs ${
                  milestone.reached
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {milestone.reached && '✓ '}
                {milestone.value}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reward Message */}
      {goal.status === 'completed' && goal.rewardMessage && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-sm text-green-600 dark:text-green-400 font-medium">
            🎉 {goal.rewardMessage}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default GoalCard;
