import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Lightbulb, ArrowRight, X, AlertTriangle, Target } from 'lucide-react';
import type { MetacognitionPrompt } from '@/lib/metacognition';

interface MetacognitionPromptModalProps {
  prompt: MetacognitionPrompt;
  conditionName: string;
  onDismiss: () => void;
}

/**
 * MetacognitionPromptModal - Displays reflection prompts for metacognitive learning
 *
 * Shows when:
 * - User has consecutive misses in a subcategory
 * - Question involves a known confusion pair
 * - High-yield topic missed
 * - Random sampling (10% of misses)
 */
const MetacognitionPromptModal: React.FC<MetacognitionPromptModalProps> = ({
  prompt,
  conditionName,
  onDismiss,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');

  const handleNextQuestion = () => {
    if (currentResponse.trim()) {
      setResponses((prev) => [...prev, currentResponse]);
    }

    if (currentQuestionIndex < prompt.reflectionQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setCurrentResponse('');
    } else {
      // All questions answered or skipped, dismiss
      onDismiss();
    }
  };

  const handleSkipAll = () => {
    onDismiss();
  };

  const getTriggerIcon = () => {
    switch (prompt.triggerReason) {
      case 'consecutive_misses':
        return <AlertTriangle className="w-6 h-6 text-data-provisional" />;
      case 'confusion_pair':
        return <Brain className="w-6 h-6 text-[var(--color-accent)]" />;
      case 'high_yield_miss':
        return <Target className="w-6 h-6 text-data-fail" />;
      default:
        return <Lightbulb className="w-6 h-6 text-[var(--color-category-practice)]" />;
    }
  };

  const getTriggerTitle = () => {
    switch (prompt.triggerReason) {
      case 'consecutive_misses':
        return 'Pattern Detected';
      case 'confusion_pair':
        return 'Common Confusion Pair';
      case 'high_yield_miss':
        return 'High-Yield Topic';
      default:
        return 'Reflection Moment';
    }
  };

  const getTriggerColor = () => {
    switch (prompt.triggerReason) {
      case 'consecutive_misses':
        return 'from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]/80';
      case 'confusion_pair':
        return 'from-[var(--color-accent)] to-[var(--color-accent)]/80';
      case 'high_yield_miss':
        return 'from-[var(--color-data-fail)] to-[var(--color-data-fail)]/80';
      default:
        return 'from-[var(--color-accent)] to-[var(--color-accent)]/60';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleSkipAll}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] overflow-hidden border border-[var(--color-border)]"
        >
          {/* Header with gradient */}
          <div className={`p-5 bg-gradient-to-r ${getTriggerColor()} text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">{getTriggerIcon()}</div>
                <div>
                  <h2 className="text-lg font-bold">{getTriggerTitle()}</h2>
                  <p className="text-sm text-white/80">{conditionName}</p>
                </div>
              </div>
              <button
                onClick={handleSkipAll}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Skip reflection"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Confusion Pair Info (if applicable) */}
          {prompt.confusionPairInfo && (
            <div className="mx-5 mt-4 p-4 bg-[var(--color-accent)]/10 rounded-xl border border-[var(--color-accent)]/30">
              <div className="flex items-start gap-3">
                <Brain className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-accent)] mb-1">
                    Often confused with: {prompt.confusionPairInfo.pairedCondition}
                  </p>
                  <p className="text-sm text-[var(--color-accent)]/80 mb-2">
                    {prompt.confusionPairInfo.distinguishingFeature}
                  </p>
                  <p className="text-xs text-[var(--color-accent)]/70 italic flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {prompt.confusionPairInfo.clinicalPearl}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reflection Question */}
          <div className="p-5">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">
                  Question {currentQuestionIndex + 1} of {prompt.reflectionQuestions.length}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">Optional reflection</span>
              </div>
              <p className="text-base font-medium text-[var(--color-text-primary)]">
                {prompt.reflectionQuestions[currentQuestionIndex]}
              </p>
            </div>

            {/* Response textarea (optional) */}
            <textarea
              value={currentResponse}
              onChange={(e) => setCurrentResponse(e.target.value)}
              placeholder="Type your thoughts here (optional)..."
              className="w-full h-24 p-3 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-category-practice)_50%,transparent)]"
            />

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mt-4 mb-4">
              {prompt.reflectionQuestions.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentQuestionIndex
                      ? 'bg-[var(--color-category-practice)]'
                      : idx < currentQuestionIndex
                        ? 'bg-data-pass'
                        : 'bg-[var(--color-bg-tertiary)]'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSkipAll}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNextQuestion}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text-inverse)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {currentQuestionIndex < prompt.reflectionQuestions.length - 1 ? (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </div>

          {/* Footer tip */}
          <div className="px-5 pb-5">
            <p className="text-xs text-center text-[var(--color-text-muted)]">
              <Brain className="w-3.5 h-3.5 inline-block mr-1 text-[var(--color-text-muted)]" aria-hidden />Metacognitive reflection improves long-term retention
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MetacognitionPromptModal;
