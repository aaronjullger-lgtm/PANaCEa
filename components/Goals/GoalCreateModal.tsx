/**
 * Goal Create Modal
 *
 * Modal for creating new goals with form validation.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap, useKeyboardNavigation } from '@/lib/utils/accessibilityUtils';
import { X, Target } from 'lucide-react';
import {
  useFormValidation,
  validateRequired,
  validateDateFuture,
} from '@/components/shared/FormValidation';
import { PrimaryButton, OutlineButton } from '@/components/shared/StandardButton';
import type { UserGoal } from './GoalsDashboard';

interface GoalCreateModalProps {
  onClose: () => void;
  onCreate: (goal: Partial<UserGoal>) => Promise<void>;
}

export const GoalCreateModal: React.FC<GoalCreateModalProps> = ({ onClose, onCreate }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form validation
  const {
    messages,
    addMessage,
    clearMessages,
    clearFieldMessages,
    hasErrors,
    FormValidation: ValidationDisplay,
  } = useFormValidation({ scrollToFirstError: true });

  // Accessibility: focus trap and escape key (always active since modal is rendered)
  useFocusTrap(modalRef as React.RefObject<HTMLElement>, true);
  useKeyboardNavigation(onClose);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goalType: 'daily' as 'daily' | 'weekly' | 'exam_date' | 'mastery',
    targetValue: 40,
    targetUnit: 'questions' as 'questions' | 'minutes' | 'conditions' | 'accuracy',
    targetDate: '',
    targetSystem: '',
    targetStability: 0.9,
    isRecurring: true,
    motivationNotes: '',
    rewardMessage: '',
  });

  // Validate form on changes
  useEffect(() => {
    clearMessages();

    // Validate title
    if (formData.title.trim()) {
      clearFieldMessages('goal-title');
    } else {
      addMessage({
        message: 'Title is required',
        severity: 'error',
        fieldId: 'goal-title',
      });
    }

    // Validate target date for exam goals
    if (formData.goalType === 'exam_date') {
      if (formData.targetDate) {
        clearFieldMessages('goal-target-date');
        const dateError = validateDateFuture(formData.targetDate, 'Target date');
        if (dateError) {
          addMessage({
            message: dateError,
            severity: 'error',
            fieldId: 'goal-target-date',
          });
        }
      } else {
        addMessage({
          message: 'Target date is required for exam goals',
          severity: 'error',
          fieldId: 'goal-target-date',
        });
      }
    }

    // Validate target system for mastery goals
    if (formData.goalType === 'mastery' && !formData.targetSystem) {
      addMessage({
        message: 'Target system is required for mastery goals',
        severity: 'error',
        fieldId: 'goal-target-system',
      });
    }

    // Validate target value range
    if (formData.goalType !== 'exam_date' && formData.targetValue < 1) {
      addMessage({
        message: 'Target value must be at least 1',
        severity: 'error',
        fieldId: 'goal-target-value',
      });
    }
  }, [formData, addMessage, clearMessages, clearFieldMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for validation errors
    if (hasErrors) {
      addMessage({
        message: 'Please fix the errors below before submitting',
        severity: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build goal payload
      const goalData: Partial<UserGoal> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        goalType: formData.goalType,
        isRecurring: formData.isRecurring,
        motivationNotes: formData.motivationNotes.trim() || undefined,
        rewardMessage: formData.rewardMessage.trim() || undefined,
      };

      // Add type-specific fields
      if (formData.goalType !== 'exam_date') {
        goalData.targetValue = formData.targetValue;
        goalData.targetUnit = formData.targetUnit;
      }

      if (formData.goalType === 'exam_date') {
        goalData.targetDate = formData.targetDate;
      }

      if (formData.goalType === 'mastery') {
        goalData.targetSystem = formData.targetSystem;
        goalData.targetStability = formData.targetStability;
      }

      await onCreate(goalData);
    } catch (err) {
      console.error('[GoalCreateModal] Submit error:', err);
      addMessage({
        message: err instanceof Error ? err.message : 'Failed to create goal',
        severity: 'error',
        actionable: true,
        actionLabel: 'Try Again',
        onAction: () => {
          // Clear the error message
          clearMessages();
        },
      });
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
          aria-labelledby="goal-create-title"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[var(--color-bg-primary)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-data-neutral dark:border-data-neutral">
            <h2
              id="goal-create-title"
              className="text-2xl font-bold text-data-neutral dark:text-data-neutral flex items-center gap-2"
            >
              <Target className="w-6 h-6 text-[var(--color-category-practice)]" />
              Create New Goal
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-data-neutral dark:hover:bg-data-neutral rounded-lg transition-colors"
              aria-label="Close modal"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Validation Display */}
            <ValidationDisplay />

            {/* Title */}
            <div>
              <label
                htmlFor="goal-title"
                className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
              >
                Goal Title *
              </label>
              <input
                id="goal-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg bg-[var(--color-bg-primary)] ${
                  messages.some((m) => m.fieldId === 'goal-title' && m.severity === 'error')
                    ? 'border-[var(--color-data-fail)] focus:border-[var(--color-data-fail)] focus:ring-[var(--color-data-fail)]'
                    : 'border-data-neutral dark:border-data-neutral focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]'
                }`}
                placeholder="e.g., Complete 40 questions daily"
                aria-invalid={messages.some(
                  (m) => m.fieldId === 'goal-title' && m.severity === 'error'
                )}
                aria-describedby={
                  messages.some((m) => m.fieldId === 'goal-title')
                    ? 'validation-messages'
                    : undefined
                }
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="goal-description"
                className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
              >
                Description
              </label>
              <textarea
                id="goal-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-[var(--color-bg-primary)]"
                rows={2}
                placeholder="Optional details about this goal"
              />
            </div>

            {/* Goal Type */}
            <div>
              <label
                htmlFor="goal-type"
                className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
              >
                Goal Type *
              </label>
              <select
                id="goal-type"
                value={formData.goalType}
                onChange={(e) => setFormData({ ...formData, goalType: e.target.value as any })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-[var(--color-bg-primary)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                title="Select goal type"
              >
                <option value="daily">Daily - Recurring daily target</option>
                <option value="weekly">Weekly - Recurring weekly target</option>
                <option value="exam_date">Exam Date - Complete by target date</option>
                <option value="mastery">Mastery - Reach stability threshold</option>
              </select>
            </div>

            {/* Target Value (not for exam_date) */}
            {formData.goalType !== 'exam_date' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="goal-target-value"
                    className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
                  >
                    Target Value
                  </label>
                  <input
                    id="goal-target-value"
                    type="number"
                    value={formData.targetValue}
                    onChange={(e) =>
                      setFormData({ ...formData, targetValue: parseInt(e.target.value) })
                    }
                    className={`w-full px-3 py-2 border rounded-lg bg-[var(--color-bg-primary)] ${
                      messages.some(
                        (m) => m.fieldId === 'goal-target-value' && m.severity === 'error'
                      )
                        ? 'border-[var(--color-data-fail)] focus:border-[var(--color-data-fail)] focus:ring-[var(--color-data-fail)]'
                        : 'border-data-neutral dark:border-data-neutral focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]'
                    }`}
                    min="1"
                    aria-invalid={
                      messages.some(
                        (m) => m.fieldId === 'goal-target-value' && m.severity === 'error'
                      )
                        ? 'true'
                        : 'false'
                    }
                    aria-describedby={
                      messages.some((m) => m.fieldId === 'goal-target-value')
                        ? 'validation-messages'
                        : undefined
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="goal-target-unit"
                    className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
                  >
                    Unit
                  </label>
                  <select
                    id="goal-target-unit"
                    value={formData.targetUnit}
                    onChange={(e) =>
                      setFormData({ ...formData, targetUnit: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-[var(--color-bg-primary)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    title="Select target unit"
                  >
                    <option value="questions">Questions</option>
                    <option value="minutes">Minutes</option>
                    <option value="conditions">Conditions</option>
                    <option value="accuracy">Accuracy %</option>
                  </select>
                </div>
              </div>
            )}

            {/* Target Date (exam_date only) */}
            {formData.goalType === 'exam_date' && (
              <div>
                <label
                  htmlFor="goal-target-date"
                  className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
                >
                  Target Date *
                </label>
                <input
                  id="goal-target-date"
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg bg-[var(--color-bg-primary)] ${
                    messages.some((m) => m.fieldId === 'goal-target-date' && m.severity === 'error')
                      ? 'border-[var(--color-data-fail)] focus:border-[var(--color-data-fail)] focus:ring-[var(--color-data-fail)]'
                      : 'border-data-neutral dark:border-data-neutral focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]'
                  }`}
                  required={formData.goalType === 'exam_date'}
                  aria-invalid={
                    messages.some((m) => m.fieldId === 'goal-target-date' && m.severity === 'error')
                      ? 'true'
                      : 'false'
                  }
                  aria-describedby={
                    messages.some((m) => m.fieldId === 'goal-target-date')
                      ? 'validation-messages'
                      : undefined
                  }
                />
              </div>
            )}

            {/* Target System (mastery only) */}
            {formData.goalType === 'mastery' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="goal-target-system"
                    className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1"
                  >
                    System *
                  </label>
                  <input
                    id="goal-target-system"
                    type="text"
                    value={formData.targetSystem}
                    onChange={(e) => setFormData({ ...formData, targetSystem: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg bg-[var(--color-bg-primary)] ${
                      messages.some(
                        (m) => m.fieldId === 'goal-target-system' && m.severity === 'error'
                      )
                        ? 'border-[var(--color-data-fail)] focus:border-[var(--color-data-fail)] focus:ring-[var(--color-data-fail)]'
                        : 'border-data-neutral dark:border-data-neutral focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]'
                    }`}
                    placeholder="e.g., CV, PULM"
                    required={formData.goalType === 'mastery'}
                    aria-invalid={
                      messages.some(
                        (m) => m.fieldId === 'goal-target-system' && m.severity === 'error'
                      )
                        ? 'true'
                        : 'false'
                    }
                    aria-describedby={
                      messages.some((m) => m.fieldId === 'goal-target-system')
                        ? 'validation-messages'
                        : undefined
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1">
                    Target Stability
                  </label>
                  <input
                    type="number"
                    value={formData.targetStability}
                    onChange={(e) =>
                      setFormData({ ...formData, targetStability: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-[var(--color-bg-primary)]"
                    min="0"
                    max="1"
                    step="0.1"
                  />
                </div>
              </div>
            )}

            {/* Recurring */}
            {(formData.goalType === 'daily' || formData.goalType === 'weekly') && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="recurring" className="text-sm text-data-neutral dark:text-data-neutral">
                  Recurring goal (resets after completion)
                </label>
              </div>
            )}

            {/* Motivation */}
            <div>
              <label className="block text-sm font-medium text-data-neutral dark:text-data-neutral mb-1">
                Motivation Notes
              </label>
              <input
                type="text"
                value={formData.motivationNotes}
                onChange={(e) => setFormData({ ...formData, motivationNotes: e.target.value })}
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-[var(--color-bg-primary)]"
                placeholder="Why is this goal important to you?"
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
                className="w-full px-3 py-2 border border-data-neutral dark:border-data-neutral rounded-lg bg-[var(--color-bg-primary)]"
                placeholder="Message to show when goal is completed"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <OutlineButton
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </OutlineButton>
              <PrimaryButton
                type="submit"
                disabled={isSubmitting}
                loading={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating...' : 'Create Goal'}
              </PrimaryButton>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GoalCreateModal;
