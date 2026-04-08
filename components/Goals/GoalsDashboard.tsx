/**
 * Goals Dashboard
 *
 * Displays user goals with progress tracking, streaks, and CRUD operations.
 * Uses TanStack Query for data fetching and cache management.
 *
 * Features:
 * - Visual progress bars
 * - Streak badges
 * - Goal creation modal
 * - Goal editing
 * - Goal deletion with confirmation
 * - Filtering by status and type
 */

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Target,
  Plus,
  Flame,
  Trophy,
  CheckCircle,
  Filter,
} from 'lucide-react';
import GoalCard from './GoalCard.js';
import GoalCreateModal from './GoalCreateModal.js';
import GoalEditModal from './GoalEditModal.js';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '@/hooks/queries/useGoalQueries';
import type { UserGoal } from '@/hooks/queries/useGoalQueries';

// Re-export for downstream consumers
export type { UserGoal };

interface GoalsDashboardProps {
  className?: string;
}

export const GoalsDashboard: React.FC<GoalsDashboardProps> = ({ className = '' }) => {
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Inline delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // ─── TanStack Query hooks ────────────────────────────────────────────────
  const {
    data: goals = [],
    isLoading,
    error: queryError,
    refetch: fetchGoals,
  } = useGoals({ status: statusFilter, type: typeFilter });

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const error = queryError ? (queryError as Error).message : null;

  // ─── Handlers (thin wrappers around mutations) ───────────────────────────

  const handleCreateGoal = async (goalData: Partial<UserGoal>) => {
    await createGoal.mutateAsync(goalData);
    setShowCreateModal(false);
  };

  const handleUpdateGoal = async (goalId: string, updates: Partial<UserGoal>) => {
    await updateGoal.mutateAsync({ goalId, updates });
    setEditingGoal(null);
  };

  const handleDeleteGoal = async (goalId: string) => {
    await deleteGoal.mutateAsync(goalId);
  };

  // Calculate stats
  const stats = {
    total: goals.length,
    active: goals.filter((g) => g.status === 'active').length,
    completed: goals.filter((g) => g.status === 'completed').length,
    totalStreak: goals.reduce((sum, g) => sum + g.currentStreak, 0),
    bestStreak: Math.max(...goals.map((g) => g.bestStreak), 0),
  };

  return (
    <div className={`goals-dashboard ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-data-neutral flex items-center gap-2">
            <Target className="w-8 h-8 text-[var(--color-category-practice)]" />
            Your Goals
          </h1>
          <p className="text-data-neutral mt-1">
            Track your progress and stay motivated
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-category-practice)] transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Goal
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral text-sm mb-1">
            <Target className="w-4 h-4" />
            Active Goals
          </div>
          <div className="text-2xl font-bold text-data-neutral">
            {stats.active}
          </div>
        </div>

        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Completed
          </div>
          <div className="text-2xl font-bold text-data-pass">{stats.completed}</div>
        </div>

        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral text-sm mb-1">
            <Flame className="w-4 h-4" />
            Total Streak
          </div>
          <div className="text-2xl font-bold text-[var(--color-data-provisional)]">{stats.totalStreak}</div>
        </div>

        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral text-sm mb-1">
            <Trophy className="w-4 h-4" />
            Best Streak
          </div>
          <div className="text-2xl font-bold text-[var(--color-data-provisional)]">{stats.bestStreak}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-data-neutral" />
          <span className="text-sm text-data-neutral">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="px-3 py-1 rounded-lg border border-data-neutral bg-[var(--color-bg-primary)] text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-data-neutral">Type:</span>
          <select
            aria-label="Filter by goal type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1 rounded-lg border border-data-neutral bg-[var(--color-bg-primary)] text-sm"
          >
            <option value="all">All</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="exam_date">Exam Date</option>
            <option value="mastery">Mastery</option>
          </select>
        </div>
      </div>

      {/* Goals List */}
      {isLoading ? (
        <div className="text-center py-12 text-data-neutral">Loading goals...</div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-data-fail mb-4">{error}</p>
          <button
            onClick={fetchGoals}
            className="px-4 py-2 bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-category-practice)] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <Target className="w-16 h-16 mx-auto text-data-neutral mb-4" />
          <p className="text-data-neutral mb-4">
            No goals yet. Create your first goal to get started!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-category-practice)] transition-colors"
          >
            Create Goal
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => setEditingGoal(goal)}
                onDelete={() => setPendingDeleteId(goal.id)}
                confirming={pendingDeleteId === goal.id}
                onDeleteConfirm={() => {
                  setPendingDeleteId(null);
                  void handleDeleteGoal(goal.id);
                }}
                onDeleteCancel={() => setPendingDeleteId(null)}
                onUpdate={(updates) => handleUpdateGoal(goal.id, updates)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <GoalCreateModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateGoal} />
      )}

      {editingGoal && (
        <GoalEditModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onUpdate={(updates) => handleUpdateGoal(editingGoal.id, updates)}
        />
      )}
    </div>
  );
};

export default GoalsDashboard;
