/**
 * Modal for flagging questions with issues
 * Part of Task 42: Feedback Loop Closure
 */

import React, { useState, useRef } from 'react';
import { X, Flag, AlertCircle, CheckCircle } from 'lucide-react';
import { useQuestionFlag } from '@/hooks/useQuestionFlag';
import { useFocusTrap, useKeyboardNavigation } from '@/lib/utils/accessibilityUtils';

interface FlagQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  questionText: string;
  correctAnswer?: string;
  topic?: string;
  system?: string;
  userId: string;
  userEmail?: string;
  userFirstName?: string;
}

type FlagType = 'typo' | 'incorrect_answer' | 'unclear' | 'outdated' | 'other';

export function FlagQuestionModal({
  isOpen,
  onClose,
  questionId,
  questionText,
  correctAnswer,
  topic,
  system,
  userId,
  userEmail,
  userFirstName,
}: FlagQuestionModalProps) {
  const [flagType, setFlagType] = useState<FlagType>('incorrect_answer');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { flagQuestion, loading, error } = useQuestionFlag();
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef as React.RefObject<HTMLElement>, isOpen);
  useKeyboardNavigation(onClose);

  const flagTypes: Array<{ value: FlagType; label: string; description: string }> = [
    {
      value: 'incorrect_answer',
      label: 'Incorrect Answer',
      description: 'The marked correct answer appears to be wrong.',
    },
    {
      value: 'typo',
      label: 'Typo or Grammar Issue',
      description: 'Spelling mistake, grammatical error, or formatting issue.',
    },
    {
      value: 'unclear',
      label: 'Unclear or Confusing',
      description: 'Question wording is ambiguous or difficult to understand.',
    },
    {
      value: 'outdated',
      label: 'Outdated Information',
      description: 'Content reflects old guidelines or deprecated practices.',
    },
    {
      value: 'other',
      label: 'Other Issue',
      description: 'Something else that needs attention.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      return;
    }

    const result = await flagQuestion({
      userId,
      userEmail,
      userFirstName,
      questionId,
      questionText,
      correctAnswer,
      topic,
      system,
      flagType,
      description: description.trim(),
      priority: flagType === 'incorrect_answer' ? 'high' : 'medium',
    });

    if (result.success) {
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        // Reset form
        setFlagType('incorrect_answer');
        setDescription('');
        setSubmitted(false);
      }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flag-modal-title"
    >
      <div ref={modalRef} className="relative w-full max-w-2xl bg-[var(--color-bg-secondary)] rounded-lg shadow-[0_18px_42px_var(--color-shadow-soft)] max-h-[90vh] overflow-y-auto border border-[var(--color-border)]">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-3">
            <Flag className="w-6 h-6 text-[var(--color-data-provisional)]" />
            <h2
              id="flag-modal-title"
              className="text-xl font-semibold text-[var(--color-text-primary)]"
            >
              Flag Question Issue
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          /* Success State */
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle className="w-16 h-16 text-data-pass mb-4" />
            <h3 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
              Thank You!
            </h3>
            <p className="text-[var(--color-text-secondary)] max-w-md">
              Your feedback has been submitted. We'll review this question and send you an email
              once it's fixed.
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6">
            {/* Question Preview */}
            <div className="mb-6 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-muted)] mb-2">Question:</p>
              <p className="text-[var(--color-text-primary)] text-sm line-clamp-3">
                {questionText}
              </p>
              {correctAnswer && (
                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                  Correct Answer: <span className="text-data-pass">{correctAnswer}</span>
                </p>
              )}
            </div>

            {/* Flag Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                What's the issue?
              </label>
              <div className="space-y-2">
                {flagTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFlagType(type.value)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      flagType === type.value
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)]'
                    }`}
                  >
                    <div className="font-medium text-[var(--color-text-primary)] mb-1">
                      {type.label}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Please describe the issue in detail
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: The correct answer should be X because..."
                rows={4}
                autoFocus
                className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent"
                required
              />
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Tip: Be specific about what you think is wrong and why. This helps us fix it faster!
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--color-data-fail)]">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !description.trim()}
                className="px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-inverse)] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--color-text-inverse)]/30 border-t-[var(--color-text-inverse)] rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4" />
                    Submit Flag
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
