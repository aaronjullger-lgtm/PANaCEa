/**
 * Resume Session Modal
 * 2026 PA Student Optimization - Quick Resume for interrupted sessions
 * 
 * Prompts user to resume a saved session when detected on app load
 */

import React from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, XCircle, Clock, BookOpen } from 'lucide-react';
import type { SavedSessionState } from '@/lib/sessionStateManager';
import { formatSessionAge } from '@/lib/sessionStateManager';

interface ResumeSessionModalProps {
  isOpen: boolean;
  sessionState: SavedSessionState;
  onResume: () => void;
  onStartNew: () => void;
}

export const ResumeSessionModal: React.FC<ResumeSessionModalProps> = ({
  isOpen,
  sessionState,
  onResume,
  onStartNew,
}) => {
  if (!isOpen) return null;

  const ageMs = Date.now() - sessionState.timestamp;
  const ageStr = formatSessionAge(ageMs);
  const questionsRemaining = sessionState.queue.length - sessionState.currentQuestionIndex;
  const correctCount = sessionState.performanceData.filter((p) => p.isCorrect).length;
  const totalAnswered = sessionState.performanceData.length;
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-lg w-full"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-full">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                Resume Session?
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                You have an unfinished study session from {ageStr}
              </p>
            </div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
              <div className="text-2xl font-bold text-[var(--color-accent)]">
                {questionsRemaining}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                Questions Left
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
              <div className="text-2xl font-bold text-green-500">
                {accuracy}%
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                Accuracy
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {totalAnswered}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                Completed
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                Session Type
              </span>
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              {sessionState.sessionSettings.focus === 'all' && 'Practice - All Topics'}
              {sessionState.sessionSettings.focus === 'incorrect' && 'Review - Weak Areas'}
              {sessionState.sessionSettings.focus === 'unseen' && 'New Questions'}
              {sessionState.sessionSettings.focus === 'bookmarked' && 'Bookmarked Questions'}
              {sessionState.sessionSettings.focus === 'review' && 'Review Session'}
              {sessionState.sessionSettings.systems && sessionState.sessionSettings.systems.length > 0 && (
                <span className="ml-2 text-[var(--color-accent)]">
                  ({sessionState.sessionSettings.systems.join(', ')})
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onResume}
              className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-lg transition-colors"
            >
              <PlayCircle className="w-5 h-5" />
              Resume Where I Left Off
            </button>
            <button
              onClick={onStartNew}
              className="flex items-center justify-center gap-3 w-full px-6 py-3 border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-semibold rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5" />
              Start Fresh Session
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="px-6 pb-6">
          <p className="text-xs text-center text-[var(--color-text-muted)]">
            Saved sessions expire after 24 hours
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ResumeSessionModal;
