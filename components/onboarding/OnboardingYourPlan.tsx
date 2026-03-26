/**
 * Onboarding "Your plan" step after profile (and optional baseline).
 * Shows suggested focus (weak systems or all), first goal, and actions: Start first session, Set exam date, Skip.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Play, Calendar, ChevronRight } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';

interface OnboardingYourPlanProps {
  weakestSystems?: string[];
  examDate?: string | null;
  onStartSession: () => void;
  onSetExamDate?: (date: string) => void;
  onSkip: () => void;
}

export function OnboardingYourPlan({
  weakestSystems = [],
  examDate,
  onStartSession,
  onSetExamDate,
  onSkip,
}: OnboardingYourPlanProps) {
  const { getToken } = useAuth();
  const [examDateInput, setExamDateInput] = useState(examDate ?? '');
  const [savingExamDate, setSavingExamDate] = useState(false);
  const [examDateSaved, setExamDateSaved] = useState(false);

  const focusText =
    weakestSystems.length > 0 ? weakestSystems.slice(0, 3).join(', ') : 'all systems';

  const handleSaveExamDate = async () => {
    if (!examDateInput.trim() || !onSetExamDate) return;
    setSavingExamDate(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Please sign in to save exam date.');
        return;
      }
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ examDate: examDateInput.trim() }),
      });
      if (res.ok) {
        onSetExamDate(examDateInput.trim());
        setExamDateSaved(true);
        toast.success('Exam date saved.');
      } else {
        toast.error('Could not save exam date. Try again.');
      }
    } catch {
      toast.error('Could not save exam date. Try again.');
    } finally {
      setSavingExamDate(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-lg w-full p-8 border border-[var(--color-border)]"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-[var(--color-accent)]/20 rounded-full">
            <Target className="w-12 h-12 text-[var(--color-accent)]" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] text-center mb-2">
          Your plan
        </h2>
        <p className="text-[var(--color-text-muted)] text-center mb-6">
          We suggest focusing on{' '}
          <strong className="text-[var(--color-text-primary)]">{focusText}</strong>. Your first
          goal: <strong className="text-[var(--color-text-primary)]">20 questions today</strong>.
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={onStartSession}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white rounded-xl font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            <Play className="w-5 h-5" />
            Start first session
            <ChevronRight className="w-5 h-5" />
          </button>

          {onSetExamDate && (
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex-1 flex gap-2">
                <Calendar className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-2.5" />
                <input
                  type="date"
                  value={examDateInput}
                  onChange={(e) => setExamDateInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                />
              </div>
              <button
                onClick={handleSaveExamDate}
                disabled={savingExamDate || !examDateInput.trim()}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
              >
                {examDateSaved ? 'Saved' : savingExamDate ? 'Saving...' : 'Set exam date'}
              </button>
            </div>
          )}

          <button
            onClick={onSkip}
            className="w-full px-6 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  );
}
