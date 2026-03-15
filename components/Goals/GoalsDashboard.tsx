/**
 * Goals Dashboard
 *
 * Displays user goals with progress tracking, streaks, and CRUD operations.
 * Features:
 * - Visual progress bars
 * - Streak badges
 * - Goal creation modal
 * - Goal editing
 * - Goal deletion
 * - Filtering by status and type
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  Target,
  Plus,
  Flame,
  Trophy,
  Calendar,
  TrendingUp,
  CheckCircle,
  Pause,
  XCircle,
  Edit2,
  Trash2,
  Filter,
} from 'lucide-react';
import GoalCard from './GoalCard.js';
import GoalCreateModal from './GoalCreateModal.js';
import GoalEditModal from './GoalEditModal.js';

export interface UserGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  goalType: 'daily' | 'weekly' | 'exam_date' | 'mastery';
  targetValue?: number;
  targetUnit?: 'questions' | 'minutes' | 'conditions' | 'accuracy';
  targetDate?: string;
  targetSystem?: string;
  targetStability?: number;
  currentValue: number;
  progressPercentage: number;
  status: 'active' | 'completed' | 'paused' | 'failed';
  isRecurring: boolean;
  milestones?: Array<{ value: number; reached: boolean; date?: string }>;
  currentStreak: number;
  bestStreak: number;
  lastMetDate?: string;
  motivationNotes?: string;
  rewardMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface GoalsDashboardProps {
  className?: string;
}

export const GoalsDashboard: React.FC<GoalsDashboardProps> = ({ className = '' }) => {
  const { getToken } = useAuth();
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  /**
   * Fetch goals from API
   */
  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('goalType', typeFilter);

      const response = await fetch(`/api/user/goals?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
          error?: string;
        };
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { goals?: UserGoal[] };
      setGoals(data.goals || []);
    } catch (err) {
      console.error('[GoalsDashboard] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, statusFilter, typeFilter]);

  /**
   * Create new goal
   */
  const handleCreateGoal = useCallback(
    async (goalData: Partial<UserGoal>) => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch('/api/user/goals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(goalData),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
          };
          throw new Error(errorData.error || 'Failed to create goal');
        }

        await fetchGoals(); // Refresh list
        setShowCreateModal(false);
      } catch (err) {
        console.error('[GoalsDashboard] Create error:', err);
        throw err;
      }
    },
    [getToken, fetchGoals]
  );

  /**
   * Update goal
   */
  const handleUpdateGoal = useCallback(
    async (goalId: string, updates: Partial<UserGoal>) => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`/api/user/goals/${goalId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
          };
          throw new Error(errorData.error || 'Failed to update goal');
        }

        await fetchGoals(); // Refresh list
        setEditingGoal(null);
      } catch (err) {
        console.error('[GoalsDashboard] Update error:', err);
        throw err;
      }
    },
    [getToken, fetchGoals]
  );

  /**
   * Delete goal
   */
  const handleDeleteGoal = useCallback(
    async (goalId: string) => {
      if (!confirm('Are you sure you want to delete this goal?')) return;

      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`/api/user/goals/${goalId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
          };
          throw new Error(errorData.error || 'Failed to delete goal');
        }

        await fetchGoals(); // Refresh list
      } catch (err) {
        console.error('[GoalsDashboard] Delete error:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete goal');
      }
    },
    [getToken, fetchGoals]
  );

  // Fetch on mount and when filters change
  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

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
          <h1 className="text-3xl font-bold text-data-neutral dark:text-data-neutral flex items-center gap-2">
            <Target className="w-8 h-8 text-[var(--color-category-practice)]" />
            Your Goals
          </h1>
          <p className="text-data-neutral dark:text-data-neutral mt-1">
            Track your progress and stay motivated
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[var(--color-category-practice)] text-white rounded-lg hover:bg-[var(--color-category-practice)] transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Goal
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral dark:border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral dark:text-data-neutral text-sm mb-1">
            <Target className="w-4 h-4" />
            Active Goals
          </div>
          <div className="text-2xl font-bold text-data-neutral dark:text-data-neutral">
            {stats.active}
          </div>
        </div>

        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral dark:border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral dark:text-data-neutral text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Completed
          </div>
          <div className="text-2xl font-bold text-data-pass">{stats.completed}</div>
        </div>

        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral dark:border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral dark:text-data-neutral text-sm mb-1">
            <Flame className="w-4 h-4" />
            Total Streak
          </div>
          <div className="text-2xl font-bold text-orange-600">{stats.totalStreak}</div>
        </div>

        <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-data-neutral dark:border-data-neutral">
          <div className="flex items-center gap-2 text-data-neutral dark:text-data-neutral text-sm mb-1">
            <Trophy className="w-4 h-4" />
            Best Streak
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.bestStreak}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-data-neutral dark:text-data-neutral" />
          <span className="text-sm text-data-neutral dark:text-data-neutral">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 rounded-lg border border-data-neutral dark:border-data-neutral bg-[var(--color-bg-primary)] text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-data-neutral dark:text-data-neutral">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1 rounded-lg border border-data-neutral dark:border-data-neutral bg-[var(--color-bg-primary)] text-sm"
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
        <div className="text-center py-12 text-data-neutral dark:text-data-neutral">Loading goals...</div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-data-fail mb-4">{error}</p>
          <button
            onClick={fetchGoals}
            className="px-4 py-2 bg-[var(--color-category-practice)] text-white rounded-lg hover:bg-[var(--color-category-practice)] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <Target className="w-16 h-16 mx-auto text-data-neutral dark:text-data-neutral mb-4" />
          <p className="text-data-neutral dark:text-data-neutral mb-4">
            No goals yet. Create your first goal to get started!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[var(--color-category-practice)] text-white rounded-lg hover:bg-[var(--color-category-practice)] transition-colors"
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
                onDelete={() => handleDeleteGoal(goal.id)}
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
