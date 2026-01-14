/**
 * Goal Edit Modal
 * 
 * Modal for editing existing goals.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2 } from 'lucide-react';
import type { UserGoal } from './GoalsDashboard';

interface GoalEditModalProps {
  goal: UserGoal;
  onClose: () => void;
  onUpdate: (updates: Partial<UserGoal>) => Promise<void>;
}

export const GoalEditModal: React.FC<GoalEditModalProps> = ({ goal, onClose, onUpdate }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
              <Edit2 className="w-6 h-6 text-blue-600" />
              Edit Goal
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
              />
            </div>
            
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            {/* Current Value */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Current Progress
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.currentValue}
                  onChange={(e) => setFormData({ ...formData, currentValue: parseInt(e.target.value) })}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                  min="0"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  / {goal.targetValue || '∞'} {goal.targetUnit || 'units'}
                </span>
              </div>
            </div>
            
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
