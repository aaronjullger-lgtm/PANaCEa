/**
 * Goal Create Modal
 * 
 * Modal for creating new goals with form validation.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Calendar, TrendingUp } from 'lucide-react';
import type { UserGoal } from './GoalsDashboard';

interface GoalCreateModalProps {
  onClose: () => void;
  onCreate: (goal: Partial<UserGoal>) => Promise<void>;
}

export const GoalCreateModal: React.FC<GoalCreateModalProps> = ({ onClose, onCreate }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Validation
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      
      if (formData.goalType === 'exam_date' && !formData.targetDate) {
        throw new Error('Target date is required for exam goals');
      }
      
      if (formData.goalType === 'mastery' && !formData.targetSystem) {
        throw new Error('Target system is required for mastery goals');
      }
      
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
      setError(err instanceof Error ? err.message : 'Failed to create goal');
      setIsSubmitting(false);
    }
  };
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-600" />
              Create New Goal
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Goal Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                placeholder="e.g., Complete 40 questions daily"
                required
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                rows={2}
                placeholder="Optional details about this goal"
              />
            </div>
            
            {/* Goal Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Goal Type *
              </label>
              <select
                value={formData.goalType}
                onChange={(e) => setFormData({ ...formData, goalType: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Value
                  </label>
                  <input
                    type="number"
                    value={formData.targetValue}
                    onChange={(e) => setFormData({ ...formData, targetValue: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                    min="1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Unit
                  </label>
                  <select
                    value={formData.targetUnit}
                    onChange={(e) => setFormData({ ...formData, targetUnit: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Date *
                </label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                  required={formData.goalType === 'exam_date'}
                />
              </div>
            )}
            
            {/* Target System (mastery only) */}
            {formData.goalType === 'mastery' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    System *
                  </label>
                  <input
                    type="text"
                    value={formData.targetSystem}
                    onChange={(e) => setFormData({ ...formData, targetSystem: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                    placeholder="e.g., CV, PULM"
                    required={formData.goalType === 'mastery'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Stability
                  </label>
                  <input
                    type="number"
                    value={formData.targetStability}
                    onChange={(e) => setFormData({ ...formData, targetStability: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
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
                <label htmlFor="recurring" className="text-sm text-slate-700 dark:text-slate-300">
                  Recurring goal (resets after completion)
                </label>
              </div>
            )}
            
            {/* Motivation */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Motivation Notes
              </label>
              <input
                type="text"
                value={formData.motivationNotes}
                onChange={(e) => setFormData({ ...formData, motivationNotes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                placeholder="Why is this goal important to you?"
              />
            </div>
            
            {/* Reward Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reward Message
              </label>
              <input
                type="text"
                value={formData.rewardMessage}
                onChange={(e) => setFormData({ ...formData, rewardMessage: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                placeholder="Message to show when goal is completed"
              />
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GoalCreateModal;
