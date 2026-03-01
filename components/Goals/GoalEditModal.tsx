/**
 * Goal Edit Modal
 *
 * Modal for editing existing goals.
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap, useKeyboardNavigation } from '@/lib/utils/accessibilityUtils';
import { X, Edit2 } from 'lucide-react';
import type { UserGoal } from './GoalsDashboard';

interface GoalEditModalProps {
  goal: UserGoal;
  onClose: () => void;
  onUpdate: (updates: Partial<UserGoal>) => Promise<void>;
}

export const GoalEditModal: React.FC<GoalEditModalProps> = ({ goal, onClose, onUpdate }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accessibility: focus trap and escape key
  useFocusTrap(modalRef as React.RefObject<HTMLElement>, true);
  useKeyboardNavigation(onClose);

  const [formData, setFormData] = useState({
    title: goal.title,
    description: goal.description || '',
    status: goal.status,
    currentValue: goal.currentValue,
    motivationNotes: goal.motivationNotes || '',
    rewardMessage: goal.rewardMessage || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }

      const updates: Partial<UserGoal> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        status: formData.status as any,
        currentValue: formData.currentValue,
        motivationNotes: formData.motivationNotes.trim() || undefined,
        rewardMessage: formData.rewardMessage.trim() || undefined,
      };

      // Calculate progress percentage
      if (goal.targetValue) {
        updates.progressPercentage = (formData.currentValue / goal.targetValue) * 100;
      }

      // Set completedAt if status changed to completed
      if (formData.status === 'completed' && goal.status !== 'completed') {
        updates.completedAt = new Date().toISOString();
      }

      await onUpdate(updates);
    } catch (err) {
      console.error('[GoalEditModal] Submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update goal');
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]">
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="goal-edit-title"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[var(--color-bg-primary)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-data-neutral dark:border-data-neutral">
            <h2
              id="goal-edit-title"
              className="text-2xl font-bold text-data-neutral dark:text-data-neutral flex items-center gap-2"
            >
              <Edit2 className="w-6 h-6 text-[var(--color-category-practice)]" />
              Edit Goal
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-data-neutral dark:hover:bg-data-neutral rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div
                id="goal-edit-error"
                role="alert"
                className="p-3 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-lg text-[var(--color-data-fail)] text-sm"
              >
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label
                htmlFor="goal-edit-title-input"
                className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
              >
                Goal Title *
              </label>
              <input
                id="goal-edit-title-input"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-white dark:bg-data-neutral"
                aria-invalid={!!error && !formData.title.trim()}
                aria-describedby={!!error && !formData.title.trim() ? 'goal-edit-error' : undefined}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="goal-edit-description"
                className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
              >
                Description
              </label>
              <textarea
                id="goal-edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-white dark:bg-data-neutral"
                rows={2}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-white dark:bg-data-neutral"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Current Value */}
            <div>
              <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1">
                Current Progress
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.currentValue}
                  onChange={(e) =>
                    setFormData({ ...formData, currentValue: parseInt(e.target.value) })
                  }
                  className="flex-1 px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-white dark:bg-data-neutral"
                  min="0"
                />
                <span className="text-data-neutral dark:text-data-neutral">
                  / {goal.targetValue || '∞'} {goal.targetUnit || 'units'}
                </span>
              </div>
            </div>

            {/* Motivation */}
            <div>
              <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1">
                Motivation Notes
              </label>
              <input
                type="text"
                value={formData.motivationNotes}
                onChange={(e) => setFormData({ ...formData, motivationNotes: e.target.value })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-white dark:bg-data-neutral"
              />
            </div>

            {/* Reward Message */}
            <div>
              <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1">
                Reward Message
              </label>
              <input
                type="text"
                value={formData.rewardMessage}
                onChange={(e) => setFormData({ ...formData, rewardMessage: e.target.value })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-white dark:bg-data-neutral"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-data-neutral dark:border-data-neutral rounded-lg hover:bg-data-neutral dark:hover:bg-data-neutral transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting && (
                  <span
                    className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GoalEditModal;
