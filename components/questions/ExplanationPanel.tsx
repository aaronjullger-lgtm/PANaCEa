/**
 * ExplanationPanel Component
 * 
 * A comprehensive UI component for delivering ultra-concise, high-yield 
 * post-question rationales. Focuses on actionable learning, brevity, 
 * buzzwords, and diagnostic clues.
 * 
 * VISUAL CONSTRAINTS: PANaCEa branding (dark slate, medical blue, white text, gold accents)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  GraduationCap,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  compressExplanation,
  extractBuzzwords,
  generateMnemonicIfAvailable,
  buildDifferentialList,
  storeUserReaction,
  updateWeaknessMap,
  updateConfusionGraph,
} from '@/lib/services/explanationCompressionService';

// TODO: Implement adaptive explanations based on user bias
// TODO: Add time-to-read analysis
// TODO: Add optional audio playback support

export interface ExplanationPanelProps {
  /** The full rationale text from the question */
  rationale: string;
  /** The condition name/ID for the question */
  condition: string;
  /** The condition ID/slug for navigation */
  conditionSlug?: string;
  /** Whether the user answered correctly */
  isCorrect: boolean;
  /** The correct answer text */
  correctAnswer: string;
  /** The user's selected answer text */
  userAnswer: string;
  /** Index of the correct answer (0-based) */
  correctAnswerIndex: number;
  /** Index of the user's selected answer (0-based) */
  userAnswerIndex: number;
  /** All answer options */
  options: string[];
  /** Optional array of commonly confused conditions */
  confusionPairs?: string[];
  /** Optional unique question identifier for analytics */
  questionId?: string;
  /** Optional callback when user clicks "View Full Condition Breakdown" */
  onViewCondition?: (slug: string) => void;
  /** Optional callback when user clicks "Teach me this" */
  onTeachMe?: (conditionSlug: string) => void;
  /** Optional font size adjustment */
  fontSizeAdjustment?: number;
}

/**
 * ExplanationPanel - High-yield post-question rationale component
 */
const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  rationale,
  condition,
  conditionSlug,
  isCorrect,
  correctAnswer,
  userAnswer,
  correctAnswerIndex,
  userAnswerIndex,
  options,
  confusionPairs = [],
  questionId,
  onViewCondition,
  onTeachMe,
  fontSizeAdjustment = 0,
}) => {
  const [showWrongAnswers, setShowWrongAnswers] = useState(false);
  const [userReaction, setUserReaction] = useState<'helpful' | 'not_helpful' | null>(null);

  // Compute compressed content
  const coreRationale = useMemo(() => compressExplanation(rationale), [rationale]);
  const buzzwords = useMemo(() => extractBuzzwords(rationale), [rationale]);
  const mnemonic = useMemo(() => generateMnemonicIfAvailable(condition), [condition]);
  const differentials = useMemo(
    () => buildDifferentialList(condition, confusionPairs),
    [condition, confusionPairs]
  );

  // Track confusion when user answers incorrectly
  React.useEffect(() => {
    if (!isCorrect && questionId) {
      updateWeaknessMap(conditionSlug || condition, false);
      if (userAnswer !== correctAnswer) {
        // Try to extract condition name from the wrong answer for confusion graph
        updateConfusionGraph(condition, userAnswer);
      }
    }
  }, [isCorrect, questionId, condition, conditionSlug, userAnswer, correctAnswer]);

  // Handle reaction button click
  const handleReaction = useCallback((reaction: 'helpful' | 'not_helpful') => {
    setUserReaction(reaction);
    if (questionId) {
      storeUserReaction(questionId, reaction);
    }
  }, [questionId]);

  // Handle view condition click
  const handleViewCondition = useCallback(() => {
    if (onViewCondition && conditionSlug) {
      onViewCondition(conditionSlug);
    }
  }, [onViewCondition, conditionSlug]);

  // Handle teach me click
  const handleTeachMe = useCallback(() => {
    if (onTeachMe && conditionSlug) {
      onTeachMe(conditionSlug);
    }
  }, [onTeachMe, conditionSlug]);

  // Render formatted text with bold terms
  const renderFormattedText = (text: string) => {
    // Replace **text** with bold spans
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        return (
          <strong key={index} className="font-bold text-[var(--color-text-primary)]">
            {content}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, staggerChildren: 0.1 }
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  const collapseVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { opacity: 1, height: 'auto' },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm"
      style={{ fontSize: `calc(1rem + ${fontSizeAdjustment * 0.1}rem)` }}
    >
      {/* Result Header */}
      <div className={`px-5 py-3 border-b border-[var(--color-border)] ${
        isCorrect 
          ? 'bg-green-50 dark:bg-green-900/20' 
          : 'bg-red-50 dark:bg-red-900/20'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`font-bold text-lg flex items-center gap-2 ${
            isCorrect 
              ? 'text-green-700 dark:text-green-400' 
              : 'text-red-700 dark:text-red-400'
          }`}>
            {isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {isCorrect ? 'Correct' : 'Incorrect'}
          </span>
          <span className="text-sm text-[var(--color-text-muted)]">
            {condition}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Core Rationale Section */}
        <motion.section variants={itemVariants}>
          <h3 className="font-bold text-base mb-3 text-[var(--color-text-primary)] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
            Core Rationale
          </h3>
          <ul className="space-y-2 pl-1">
            {coreRationale.map((point, index) => (
              <li 
                key={index} 
                className="flex items-start gap-2 text-[var(--color-text-secondary)] leading-relaxed"
              >
                <span className="text-[var(--color-accent)] mt-1.5 flex-shrink-0">•</span>
                <span>{renderFormattedText(point)}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Buzzwords / Key Clues Section */}
        <motion.section variants={itemVariants}>
          <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Buzzwords / Key Clues
          </h3>
          <p className="text-[var(--color-text-secondary)] bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
            {renderFormattedText(buzzwords)}
          </p>
        </motion.section>

        {/* Memory Hook / Mnemonic Section */}
        <motion.section variants={itemVariants}>
          <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-purple-500" />
            Memory Hook / Mnemonic
          </h3>
          <p className={`px-3 py-2 rounded-lg border ${
            mnemonic === '[Mnemonic not available]'
              ? 'text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
              : 'text-[var(--color-text-secondary)] bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
          }`}>
            {mnemonic}
          </p>
        </motion.section>

        {/* Key Differentials Section */}
        {differentials.length > 0 && differentials[0] !== '[No differentials specified]' && (
          <motion.section variants={itemVariants}>
            <h3 className="font-bold text-base mb-3 text-[var(--color-text-primary)]">
              Key Differentials
            </h3>
            <ul className="space-y-2 pl-1">
              {differentials.map((diff, index) => (
                <li 
                  key={index} 
                  className="flex items-start gap-2 text-[var(--color-text-secondary)] leading-relaxed"
                >
                  <span className="text-blue-500 mt-1.5 flex-shrink-0">→</span>
                  <span>{renderFormattedText(diff)}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* Why Other Answers Were Wrong - Collapsible */}
        {!isCorrect && (
          <motion.section variants={itemVariants}>
            <button
              type="button"
              onClick={() => setShowWrongAnswers(!showWrongAnswers)}
              className="flex items-center gap-2 text-[var(--color-accent)] hover:opacity-80 transition-opacity font-medium"
            >
              {showWrongAnswers ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Why other answers were wrong
            </button>
            
            <AnimatePresence>
              {showWrongAnswers && (
                <motion.div
                  variants={collapseVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={{ duration: 0.2 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  {options.map((option, index) => {
                    if (index === correctAnswerIndex) return null;
                    
                    const isUserChoice = index === userAnswerIndex;
                    
                    return (
                      <div
                        key={index}
                        className={`px-3 py-2 rounded-lg border ${
                          isUserChoice
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                        }`}
                      >
                        <span className={`font-medium ${
                          isUserChoice 
                            ? 'text-red-700 dark:text-red-400' 
                            : 'text-[var(--color-text-secondary)]'
                        }`}>
                          {index + 1}. {option}
                        </span>
                        {isUserChoice && (
                          <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                            (Your answer)
                          </span>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Highlight correct answer */}
                  <div className="px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <span className="font-medium text-green-700 dark:text-green-400">
                      {correctAnswerIndex + 1}. {correctAnswer}
                    </span>
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                      (Correct answer)
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {/* Action Buttons */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-wrap gap-3 pt-3 border-t border-[var(--color-border)]"
        >
          {/* View Full Condition Breakdown */}
          {onViewCondition && conditionSlug && (
            <button
              type="button"
              onClick={handleViewCondition}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              View Full Condition Breakdown
            </button>
          )}

          {/* Teach Me This */}
          {onTeachMe && conditionSlug && (
            <button
              type="button"
              onClick={handleTeachMe}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white dark:text-slate-900 rounded-lg transition-colors text-sm font-medium"
            >
              <GraduationCap className="w-4 h-4" />
              Teach me this
            </button>
          )}
        </motion.div>

        {/* Reaction Buttons */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center gap-4 pt-3 border-t border-[var(--color-border)]"
        >
          <span className="text-sm text-[var(--color-text-muted)]">
            Was this explanation helpful?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleReaction('helpful')}
              disabled={userReaction !== null}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                userReaction === 'helpful'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                  : userReaction !== null
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                    : 'bg-[var(--color-bg-secondary)] hover:bg-green-50 dark:hover:bg-green-900/20 text-[var(--color-text-secondary)] hover:text-green-700 dark:hover:text-green-400 border border-[var(--color-border)]'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              Helpful
            </button>
            <button
              type="button"
              onClick={() => handleReaction('not_helpful')}
              disabled={userReaction !== null}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                userReaction === 'not_helpful'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                  : userReaction !== null
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                    : 'bg-[var(--color-bg-secondary)] hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-700 dark:hover:text-red-400 border border-[var(--color-border)]'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              Not Helpful
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ExplanationPanel;
