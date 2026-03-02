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
  Target,
  AlertCircle,
  Sparkles,
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
import { OpenStaxAttributionFooter } from '@/components/ui/OpenStaxAttributionFooter';
import { usePeerValidation, PeerValidationBadge } from '@/hooks/usePeerValidation';

/**
 * Calculate estimated reading time based on text length
 * Average reading speed: ~200-250 words per minute
 * Returns 0 for very short content (< 50 words)
 */
function calculateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  if (words < 50) return 0; // Don't show reading time for very short content
  const wordsPerMinute = 225; // Average reading speed
  const minutes = Math.max(1, Math.round(words / wordsPerMinute));
  return minutes;
}

/**
 * Adaptive explanation hints based on user performance patterns
 * Provides targeted guidance for common mistakes
 * Uses word boundary matching to avoid false positives
 */
function getAdaptiveHint(
  isCorrect: boolean,
  userAnswer: string,
  correctAnswer: string
): string | null {
  if (isCorrect) return null;

  const userLower = userAnswer.toLowerCase();
  const correctLower = correctAnswer.toLowerCase();

  // Provide hints based on common patterns with word boundary checks
  if (/\bitis\b/.test(userLower) && /\bosis\b/.test(correctLower)) {
    return 'Tip: "-itis" means inflammation, while "-osis" refers to a condition or process.';
  }

  if (/\bhyper/.test(userLower) && /\bhypo/.test(correctLower)) {
    return 'Tip: "hyper-" means high/above, "hypo-" means low/below.';
  }

  if (/\bacute\b/.test(userLower) && /\bchronic\b/.test(correctLower)) {
    return 'Tip: Acute (sudden, short-term) vs Chronic (gradual, long-term).';
  }

  return null;
}

/**
 * Standardized rationale format (5-section template)
 * See docs/AUDIT_STANDARDIZED_RATIONALE.md
 */
export interface StructuredRationale {
  /** 1. Bottom Line: One sentence. "The diagnosis is X, and the treatment is Y." (for the student in a rush) */
  bottomLine?: string;
  /** 2. Why the Correct Answer is Right: Walk through vignette steps */
  whyCorrect: string;
  /** 3. Why the Distractors are Wrong: Explain why a student might have chosen each, then why it's wrong for this patient */
  whyIncorrectA?: string;
  whyIncorrectB?: string;
  whyIncorrectC?: string;
  whyIncorrectD?: string;
  /** 4. High-Yield Image/Table: Placeholder for diagram or flow-chart (optional) */
  highYieldImageOrTable?: string;
  /** 5. Clinical Pearl: A memorable hook */
  clinicalPearl?: string;
  /** Common Pitfalls: Pre-written pitfalls (no unmoderated comments). @see docs/AUDIT_WISDOM_OF_THE_CROWDS.md */
  commonPitfalls?: string[];
}

/**
 * Type guard to check if rationale is structured
 */
function isStructuredRationale(
  rationale: string | StructuredRationale
): rationale is StructuredRationale {
  return typeof rationale === 'object' && rationale !== null && 'whyCorrect' in rationale;
}

export interface ExplanationPanelProps {
  /** The full rationale - either string (legacy) or structured object (new) */
  rationale: string | StructuredRationale;
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
  /** Optional: attribution source (e.g. 'openstax') */
  contentSource?: string;
  /** Optional: content source title (e.g. book name) */
  contentSourceTitle?: string;
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
  contentSource,
  contentSourceTitle,
}) => {
  const [showWrongAnswers, setShowWrongAnswers] = useState(false);
  const [userReaction, setUserReaction] = useState<'helpful' | 'not_helpful' | null>(null);

  // Determine if we have structured rationale (new format) or legacy string
  const structured = useMemo(() => isStructuredRationale(rationale), [rationale]);

  // For legacy support: convert rationale to string if needed
  const rationaleText = useMemo(() => {
    if (isStructuredRationale(rationale)) {
      const parts = [rationale.bottomLine, rationale.whyCorrect];
      if (rationale.whyIncorrectA) parts.push(rationale.whyIncorrectA);
      if (rationale.whyIncorrectB) parts.push(rationale.whyIncorrectB);
      if (rationale.whyIncorrectC) parts.push(rationale.whyIncorrectC);
      if (rationale.whyIncorrectD) parts.push(rationale.whyIncorrectD);
      if (rationale.highYieldImageOrTable) parts.push(rationale.highYieldImageOrTable);
      if (rationale.clinicalPearl) parts.push(rationale.clinicalPearl);
      return parts.filter(Boolean).join(' ');
    }
    return rationale;
  }, [rationale]);

  // Calculate reading time
  const readingTimeMinutes = useMemo(() => calculateReadingTime(rationaleText), [rationaleText]);

  // Get adaptive hint if user answered incorrectly
  const adaptiveHint = useMemo(
    () => getAdaptiveHint(isCorrect, userAnswer, correctAnswer),
    [isCorrect, userAnswer, correctAnswer]
  );

  // Peer validation statistics for incorrect answers
  const { data: peerData, loading: peerLoading } = usePeerValidation(questionId, isCorrect);

  // Compute compressed content (only used for legacy string rationale)
  const coreRationale = useMemo(
    () => (structured ? [] : compressExplanation(rationaleText)),
    [structured, rationaleText]
  );
  const buzzwords = useMemo(() => extractBuzzwords(rationaleText), [rationaleText]);
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
  const handleReaction = useCallback(
    (reaction: 'helpful' | 'not_helpful') => {
      setUserReaction(reaction);
      if (questionId) {
        storeUserReaction(questionId, reaction);
      }
    },
    [questionId]
  );

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
      transition: { duration: 0.3, staggerChildren: 0.1 },
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
      <div
        className={`px-5 py-3 border-b border-[var(--color-border)] ${
          isCorrect
            ? 'bg-sage-50 dark:bg-sage-900/20'
            : 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`font-bold text-lg flex items-center gap-2 ${
              isCorrect
                ? 'text-sage-700 dark:text-sage-400'
                : 'text-dusty-rose-700 dark:text-dusty-rose-400'
            }`}
          >
            {isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {isCorrect ? 'Correct' : 'Incorrect'}
          </span>
          <span className="text-sm text-[var(--color-text-muted)] flex items-center gap-2">
            <span>{condition}</span>
            {readingTimeMinutes > 0 && (
              <span className="text-xs opacity-70">· {readingTimeMinutes} min read</span>
            )}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Adaptive Learning Hint */}
        {adaptiveHint && (
          <motion.div
            variants={itemVariants}
            className="bg-steel-blue-50 dark:bg-steel-blue-900/20 border border-steel-blue-200 dark:border-steel-blue-800 rounded-lg p-3"
          >
            <p className="text-sm text-steel-blue-800 dark:text-steel-blue-300">{adaptiveHint}</p>
          </motion.div>
        )}

        {/* STRUCTURED RATIONALE (New Format) */}
        {structured && isStructuredRationale(rationale) && (
          <>
            {/* Why Correct Section */}
            <motion.section variants={itemVariants}>
              <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                <Target className="w-4 h-4 text-sage-600 dark:text-sage-400" />
                Why This Is Correct
              </h3>
              <div className="bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800 rounded-lg px-4 py-3">
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  {renderFormattedText(rationale.whyCorrect)}
                </p>
              </div>
            </motion.section>

            {/* Why Incorrect Section */}
            <motion.section variants={itemVariants}>
              <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-dusty-rose-500" />
                Why Other Options Are Wrong
              </h3>
              <div className="space-y-2">
                {options.map((option, index) => {
                  if (index === correctAnswerIndex) return null;
                  const letter = ['A', 'B', 'C', 'D'][index];
                  const key = `whyIncorrect${letter}` as keyof StructuredRationale;
                  const whyIncorrect = rationale[key];
                  if (!whyIncorrect || typeof whyIncorrect !== 'string') return null;

                  const isUserChoice = index === userAnswerIndex;

                  return (
                    <div
                      key={`option-${letter}`}
                      className={`px-4 py-2 rounded-lg border ${
                        isUserChoice
                          ? 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20 border-dusty-rose-300 dark:border-dusty-rose-700'
                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`font-semibold text-sm ${isUserChoice ? 'text-dusty-rose-600 dark:text-dusty-rose-400' : 'text-[var(--color-text-muted)]'}`}
                        >
                          {letter}.
                        </span>
                        <div className="flex-1">
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {renderFormattedText(whyIncorrect)}
                          </span>
                          {isUserChoice && (
                            <span className="ml-2 text-xs text-dusty-rose-600 dark:text-dusty-rose-400 font-medium">
                              (Your answer)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>

            {/* 4. High-Yield Image/Table (placeholder for diagram or flow-chart) */}
            {rationale.highYieldImageOrTable && rationale.highYieldImageOrTable !== 'N/A' && (
              <motion.section variants={itemVariants}>
                <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-steel-blue-500" />
                  High-Yield Image / Table
                </h3>
                <div className="bg-steel-blue-50 dark:bg-steel-blue-900/20 border border-steel-blue-200 dark:border-steel-blue-800 rounded-lg px-4 py-3">
                  <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm">
                    {renderFormattedText(rationale.highYieldImageOrTable)}
                  </p>
                </div>
              </motion.section>
            )}

            {/* 5. Clinical Pearl */}
            {rationale.clinicalPearl && (
              <motion.section variants={itemVariants}>
                <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-muted-amber-500" />
                  Clinical Pearl
                </h3>
                <div className="bg-muted-amber-50 dark:bg-muted-amber-900/20 border border-muted-amber-200 dark:border-muted-amber-800 rounded-lg px-4 py-3">
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">
                    {renderFormattedText(rationale.clinicalPearl)}
                  </p>
                </div>
              </motion.section>
            )}
          </>
        )}

        {/* LEGACY RATIONALE (String Format) */}
        {!structured && (
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
                  <span className="text-[var(--color-accent)] mt-1.5 flex-shrink-0 font-bold">
                    -
                  </span>
                  <span>{renderFormattedText(point)}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* Buzzwords / Key Clues Section */}
        <motion.section variants={itemVariants}>
          <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-muted-amber-500" />
            Buzzwords / Key Clues
          </h3>
          <p className="text-[var(--color-text-secondary)] bg-muted-amber-50 dark:bg-muted-amber-900/20 px-3 py-2 rounded-lg border border-muted-amber-200 dark:border-muted-amber-800">
            {renderFormattedText(buzzwords)}
          </p>
        </motion.section>

        {/* Memory Hook / Mnemonic Section */}
        <motion.section variants={itemVariants}>
          <h3 className="font-bold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-deep-plum-500" />
            Memory Hook / Mnemonic
          </h3>
          <p
            className={`px-3 py-2 rounded-lg border ${
              mnemonic === '[Mnemonic not available]'
                ? 'text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                : 'text-[var(--color-text-secondary)] bg-deep-plum-50 dark:bg-deep-plum-900/20 border-deep-plum-200 dark:border-deep-plum-800'
            }`}
          >
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
                  <span className="text-steel-blue-500 mt-1.5 flex-shrink-0 font-bold">›</span>
                  <span>{renderFormattedText(diff)}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* Why Other Answers Were Wrong - Collapsible (Legacy only, structured shows inline) */}
        {!isCorrect && !structured && (
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
                            ? 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20 border-dusty-rose-200 dark:border-dusty-rose-800'
                            : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                        }`}
                      >
                        <span
                          className={`font-medium ${
                            isUserChoice
                              ? 'text-dusty-rose-700 dark:text-dusty-rose-400'
                              : 'text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {index + 1}. {option}
                        </span>
                        {isUserChoice && (
                          <span className="ml-2 text-xs text-dusty-rose-600 dark:text-dusty-rose-400">
                            (Your answer)
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Highlight correct answer */}
                  <div className="px-3 py-2 rounded-lg bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800">
                    <span className="font-medium text-sage-700 dark:text-sage-400">
                      {correctAnswerIndex + 1}. {correctAnswer}
                    </span>
                    <span className="ml-2 text-xs text-sage-600 dark:text-sage-400">
                      (Correct answer)
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {/* Peer Validation Badge */}
        {!isCorrect && questionId && <PeerValidationBadge peerData={peerData} />}

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
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-inverse)] rounded-lg transition-colors text-sm font-medium"
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
                  ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 border border-sage-300 dark:border-sage-700'
                  : userReaction !== null
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                    : 'bg-[var(--color-bg-secondary)] hover:bg-sage-50 dark:hover:bg-sage-900/20 text-[var(--color-text-secondary)] hover:text-sage-700 dark:hover:text-sage-400 border border-[var(--color-border)]'
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
                  ? 'bg-dusty-rose-100 dark:bg-dusty-rose-900/30 text-dusty-rose-700 dark:text-dusty-rose-400 border border-dusty-rose-300 dark:border-dusty-rose-700'
                  : userReaction !== null
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                    : 'bg-[var(--color-bg-secondary)] hover:bg-dusty-rose-50 dark:hover:bg-dusty-rose-900/20 text-[var(--color-text-secondary)] hover:text-dusty-rose-700 dark:hover:text-dusty-rose-400 border border-[var(--color-border)]'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              Not Helpful
            </button>
          </div>
        </motion.div>

        {contentSource === 'openstax' && (
          <OpenStaxAttributionFooter
            title={contentSourceTitle || 'Textbook'}
            sourceUrl="https://openstax.org"
          />
        )}
      </div>
    </motion.div>
  );
};

export default ExplanationPanel;
