/**
 * Quick Review Mode Component
 * Allows rapid review of recently missed questions for immediate reinforcement
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, XCircle, Clock, Target } from 'lucide-react';
import type { Question } from '../types';

interface QuickReviewModeProps {
  missedQuestions: Question[];
  onClose: () => void;
  onStartReview: (questions: Question[]) => void;
}

export const QuickReviewMode: React.FC<QuickReviewModeProps> = ({
  missedQuestions,
  onClose,
  onStartReview,
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'all'>('today');
  const [selectedCount, setSelectedCount] = useState<number>(10);
  
  // Filter questions by timeframe
  const getFilteredQuestions = () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    let filtered = [...missedQuestions];
    
    switch (selectedTimeframe) {
      case 'today':
        filtered = filtered.filter(q => 
          q.lastReviewedAt && (now - new Date(q.lastReviewedAt).getTime()) < dayMs
        );
        break;
      case 'week':
        filtered = filtered.filter(q => 
          q.lastReviewedAt && (now - new Date(q.lastReviewedAt).getTime()) < 7 * dayMs
        );
        break;
      case 'all':
        // No filtering
        break;
    }
    
    // Sort by most recent first
    filtered.sort((a, b) => {
      const aTime = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
      const bTime = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
      return bTime - aTime;
    });
    
    return filtered.slice(0, selectedCount);
  };
  
  const filteredQuestions = getFilteredQuestions();
  const totalMissed = missedQuestions.length;
  
  // Get stats by timeframe
  const todayMissed = missedQuestions.filter(q => {
    if (!q.lastReviewedAt) return false;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return new Date(q.lastReviewedAt).getTime() > dayAgo;
  }).length;
  
  const weekMissed = missedQuestions.filter(q => {
    if (!q.lastReviewedAt) return false;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(q.lastReviewedAt).getTime() > weekAgo;
  }).length;
  
  const handleStartReview = () => {
    if (filteredQuestions.length > 0) {
      onStartReview(filteredQuestions);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Quick Review</h2>
                <p className="text-blue-100 text-sm">Reinforce what you've learned</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
              <Clock className="w-5 h-5 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {todayMissed}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Today</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
              <Target className="w-5 h-5 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {weekMissed}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">This Week</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
              <RefreshCw className="w-5 h-5 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalMissed}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Total</div>
            </div>
          </div>
          
          {/* Timeframe Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Timeframe
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'today', label: 'Today', count: todayMissed },
                { value: 'week', label: 'This Week', count: weekMissed },
                { value: 'all', label: 'All Time', count: totalMissed },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedTimeframe(option.value as any)}
                  className={`
                    p-3 rounded-lg border-2 transition-all duration-200
                    ${selectedTimeframe === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  <div className="font-semibold text-sm">{option.label}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {option.count} questions
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Question Count Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Number of Questions
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((count) => (
                <button
                  key={count}
                  onClick={() => setSelectedCount(count)}
                  className={`
                    flex-1 py-2 px-4 rounded-lg border-2 transition-all duration-200 font-semibold
                    ${selectedCount === count
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          
          {/* Review Summary */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20 rounded-lg p-4 mb-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Ready to Review
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredQuestions.length} questions selected
                </div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          {/* Empty State */}
          {filteredQuestions.length === 0 && (
            <div className="text-center py-8">
              <div className="text-slate-400 dark:text-slate-600 mb-2">
                <CheckCircle2 className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                No missed questions in this timeframe
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                Try selecting a different timeframe or keep studying!
              </p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartReview}
              disabled={filteredQuestions.length === 0}
              className="flex-1 py-3 px-6 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              Start Review ({filteredQuestions.length})
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default QuickReviewMode;
