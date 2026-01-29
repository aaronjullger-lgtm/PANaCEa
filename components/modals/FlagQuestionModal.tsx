/**
 * Modal for flagging questions with issues
 * Part of Task 42: Feedback Loop Closure
 */

import React, { useState } from 'react';
import { X, Flag, AlertCircle, CheckCircle } from 'lucide-react';
import { useQuestionFlag } from '../hooks/useQuestionFlag';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="relative w-full max-w-2xl bg-slate-800 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
            <Flag className="w-6 h-6 text-yellow-500" />
            <h2 className="text-xl font-semibold text-white">Flag Question Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          /* Success State */
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">Thank You!</h3>
            <p className="text-slate-300 max-w-md">
              Your feedback has been submitted. We'll review this question and send you an email
              once it's fixed.
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6">
            {/* Question Preview */}
            <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-2">Question:</p>
              <p className="text-white text-sm line-clamp-3">{questionText}</p>
              {correctAnswer && (
                <p className="text-sm text-slate-400 mt-2">
                  Correct Answer: <span className="text-green-400">{correctAnswer}</span>
                </p>
              )}
            </div>

            {/* Flag Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
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
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-900/30 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium text-white mb-1">{type.label}</div>
                    <div className="text-sm text-slate-400">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Please describe the issue in detail
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: The correct answer should be X because..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="mt-2 text-xs text-slate-400">
                Tip: Be specific about what you think is wrong and why. This helps us fix it faster!
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !description.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
