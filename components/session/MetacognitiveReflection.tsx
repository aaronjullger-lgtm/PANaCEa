/**
 * MetacognitiveReflection Component
 *
 * Post-session prompts for metacognitive reflection.
 * Research shows 15-20% learning gains from structured reflection.
 *
 * Prompts include:
 * - "What patterns did you notice in questions you missed?"
 * - "What will you do differently next time?"
 * - "Rate your confidence before you saw results"
 *
 * @see .clinerules Section 3: PEDAGOGY & SCIENCE OF LEARNING - Metacognition
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Target, Lightbulb, CheckCircle, ChevronRight, Save } from 'lucide-react';

interface SessionPerformance {
  totalQuestions: number;
  correctAnswers: number;
  missedSystems: string[];
  missedConditions: string[];
  averageTimePerQuestion: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface MetacognitiveReflectionProps {
  sessionPerformance: SessionPerformance;
  onComplete: (reflection: ReflectionData) => void;
  onSkip: () => void;
}

interface ReflectionData {
  patternsNoticed: string;
  improvementPlan: string;
  confidenceRating: number;
  topicsToReview: string[];
  completedAt: string;
}

const REFLECTION_PROMPTS = [
  {
    id: 'patterns',
    icon: Brain,
    title: 'Patterns in Learning Opportunities',
    question: 'What patterns did you notice in the questions you missed?',
    placeholder: 'I noticed I struggled with...',
    hint: 'Consider: Were they from certain organ systems? Similar question types? Time-pressured decisions?',
  },
  {
    id: 'improvement',
    icon: Target,
    title: 'Improvement Plan',
    question: 'What will you do differently next time?',
    placeholder: 'Next time I will...',
    hint: 'Think about: Study strategies, time management, content review priorities',
  },
  {
    id: 'confidence',
    icon: Lightbulb,
    title: 'Confidence Calibration',
    question: 'Before seeing results, how confident were you in your answers?',
    placeholder: '',
    hint: 'Comparing this to your actual score helps calibrate your self-assessment',
  },
];

export const MetacognitiveReflection: React.FC<MetacognitiveReflectionProps> = ({
  sessionPerformance,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [patternsNoticed, setPatternsNoticed] = useState('');
  const [improvementPlan, setImprovementPlan] = useState('');
  const [confidenceRating, setConfidenceRating] = useState(3);
  const [topicsToReview, setTopicsToReview] = useState<string[]>([]);

  const score = Math.round(
    (sessionPerformance.correctAnswers / sessionPerformance.totalQuestions) * 100
  );
  const uniqueMissedTopics = [
    ...new Set([...sessionPerformance.missedSystems, ...sessionPerformance.missedConditions]),
  ];

  const handleTopicToggle = (topic: string) => {
    setTopicsToReview((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleComplete = () => {
    const reflection: ReflectionData = {
      patternsNoticed,
      improvementPlan,
      confidenceRating,
      topicsToReview,
      completedAt: new Date().toISOString(),
    };
    onComplete(reflection);
  };

  const handleNext = () => {
    if (currentStep < REFLECTION_PROMPTS.length) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return patternsNoticed.length >= 10;
      case 1:
        return improvementPlan.length >= 10;
      case 2:
        return true; // Confidence rating always has a value
      default:
        return true;
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{}}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[var(--color-bg-primary)]/90 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
      >
        {/* Header */}
        <div className="bg-[var(--color-accent)] p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">Session Reflection</h2>
                <p className="text-white/80 text-sm">
                  Take a moment to reflect on your performance
                </p>
              </div>
            </div>
            <div className="bg-white/20 rounded-full px-4 py-2">
              <span className="text-white font-semibold">{score}%</span>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-4 flex gap-2">
            {REFLECTION_PROMPTS.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  idx <= currentStep ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {currentStep < REFLECTION_PROMPTS.length ? (
              <motion.div
                key={currentStep}
                initial={{ x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {(() => {
                  const prompt = REFLECTION_PROMPTS[currentStep];
                  if (!prompt) return null;
                  const Icon = prompt.icon;

                  return (
                    <>
                      <div className="flex items-center gap-3 text-[var(--color-accent)]">
                        <Icon className="w-6 h-6" />
                        <h3 className="text-lg font-semibold">{prompt.title}</h3>
                      </div>

                      <p className="text-[var(--color-text-primary)] text-lg">{prompt.question}</p>

                      {currentStep === 2 ? (
                        /* Confidence Rating Slider */
                        <div className="space-y-4 pt-4">
                          <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
                            <span>Not confident</span>
                            <span>Very confident</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={confidenceRating}
                            onChange={(e) => setConfidenceRating(parseInt(e.target.value))}
                            aria-label={`Confidence rating: ${confidenceRating} of 5`}
                            aria-valuemin={1}
                            aria-valuemax={5}
                            aria-valuenow={confidenceRating}
                            className="w-full h-3 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                          />
                          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                            {['1', '2', '3', '4', '5'].map((num) => (
                              <span
                                key={num}
                                className={
                                  confidenceRating === parseInt(num)
                                    ? 'text-[var(--color-accent)] font-bold'
                                    : ''
                                }
                              >
                                {num}
                              </span>
                            ))}
                          </div>

                          {/* Confidence Comparison */}
                          <div className="mt-6 p-4 bg-[var(--color-bg-tertiary)]/50 rounded-lg">
                            <p className="text-[var(--color-text-secondary)] text-sm">
                              <span className="font-semibold text-[var(--color-accent)]">
                                Calibration Check:
                              </span>{' '}
                              You were{' '}
                              {confidenceRating <= 2
                                ? 'not very'
                                : confidenceRating >= 4
                                  ? 'very'
                                  : 'moderately'}{' '}
                              confident and scored {score}%.
                              {Math.abs(confidenceRating * 20 - score) <= 20 ? (
                                <span className="text-[var(--color-data-pass)]">
                                  {' '}
                                  Your confidence was well-calibrated! ✓
                                </span>
                              ) : confidenceRating * 20 > score ? (
                                <span className="text-[var(--color-data-provisional)]">
                                  {' '}
                                  Consider being more cautious in your self-assessment.
                                </span>
                              ) : (
                                <span className="text-[var(--color-accent)]">
                                  {' '}
                                  You may be underestimating your abilities!
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Text Input */
                        <>
                          <textarea
                            value={currentStep === 0 ? patternsNoticed : improvementPlan}
                            onChange={(e) =>
                              currentStep === 0
                                ? setPatternsNoticed(e.target.value)
                                : setImprovementPlan(e.target.value)
                            }
                            placeholder={prompt.placeholder}
                            className="w-full h-32 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-xl p-4 resize-none
                              border-2 border-transparent focus:border-[var(--color-accent)] focus:outline-none
                              placeholder:text-[var(--color-text-muted)]"
                          />
                          <p className="text-[var(--color-text-muted)] text-sm flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                            {prompt.hint}
                          </p>
                        </>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            ) : (
              /* Topics to Review */
              <motion.div
                initial={{ x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 text-[var(--color-accent)]">
                  <CheckCircle className="w-6 h-6" />
                  <h3 className="text-lg font-semibold">Topics to Review</h3>
                </div>

                <p className="text-[var(--color-text-primary)]">
                  Select topics you want to prioritize in future sessions:
                </p>

                <div className="flex flex-wrap gap-2 mt-4">
                  {uniqueMissedTopics.length > 0 ? (
                    uniqueMissedTopics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => handleTopicToggle(topic)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          topicsToReview.includes(topic)
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80'
                        }`}
                      >
                        {topic}
                      </button>
                    ))
                  ) : (
                    <p className="text-[var(--color-text-muted)] italic">
                      Great job! No missed topics to review.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--color-border)] flex justify-between items-center">
          <button
            onClick={onSkip}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors text-sm"
          >
            Skip reflection
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              canProceed()
                ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
            }`}
          >
            {currentStep >= REFLECTION_PROMPTS.length ? (
              <>
                <Save className="w-5 h-5" />
                Save Reflection
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MetacognitiveReflection;
