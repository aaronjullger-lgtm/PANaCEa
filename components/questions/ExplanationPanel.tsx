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
  whyIncorrectE?: string;
  /** 4. High-Yield Image/Table: Placeholder for diagram or flow-chart (optional) */
  highYieldImageOrTable?: string;
  /** 5. Clinical Pearl: A memorable hook */
  clinicalPearl?: string;
  /** Common Pitfalls: Pre-written pitfalls (no unmoderated comments). @see docs/AUDIT_WISDOM_OF_THE_CROWDS.md */
  commonPitfalls?: string[];
  /** Grounding sources from Google Search (URIs + titles for evidence citations) */
  groundingSources?: Array<{ uri: string; title: string }>;
  /** PubMed citations (PMIDs with structured metadata) */
  pubmedCitations?: Array<{ pmid: string; title: string; authors: string; journal: string; year: number; url: string }>;
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
  /** Optional: grounding sources from Google Search for evidence citations */
  groundingSources?: Array<{ uri: string; title: string }>;
  /** Optional: PubMed citations for peer-reviewed references */
  pubmedCitations?: Array<{ pmid: string; title: string; authors: string; journal: string; year: number; url: string }>;
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
  groundingSources: propGroundingSources,
  pubmedCitations: propPubmedCitations,
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
      if (rationale.whyIncorrectE) parts.push(rationale.whyIncorrectE);
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
  const { data: peerData, loading: peerLoading } = usePeerValidation(questionId ?? '', isCorrect);

  // Compute compressed content (only used for legacy string rationale)
  const coreRationale = useMemo(
    () => (structured ? [] : compressExplanation(rationaleText ?? '')),
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

  // Render formatted text with simple markdown-style bold and strip basic HTML tags
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Strip simple HTML tags (from older content like <b>Correct:</b>)
    const withoutHtml = text.replace(/<[^>]+>/g, '');

    // Replace **text** with bold spans
    const parts = withoutHtml.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        return (
          <strong key={index} className="font-semibold text-[var(--color-text-primary)]">
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
      className="bg-[var(--color-card-bg)] rounded-xl overflow-hidden"
      style={{ fontSize: `calc(1rem + ${fontSizeAdjustment * 0.1}rem)`, boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
    >
      {/* Result Header */}
      <div
        className={`px-5 py-3 border-b border-[var(--color-border)] ${
          isCorrect
            ? 'bg-sage-50/20'
            : 'bg-dusty-rose-50/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`font-semibold text-lg flex items-center gap-2 ${
              isCorrect
                ? 'text-sage-600'
                : 'text-dusty-rose-600'
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
            className="bg-steel-blue-50/20 border border-steel-blue-200/40 rounded-lg p-3"
          >
            <p className="text-sm text-steel-blue-700">{adaptiveHint}</p>
          </motion.div>
        )}

        {/* STRUCTURED RATIONALE (New Format) */}
        {structured && isStructuredRationale(rationale) && (
          <>
            {/* Why Correct Section */}
            <motion.section variants={itemVariants}>
              <h3 className="font-semibold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--color-text-secondary)]" />
                Why This Is Correct
              </h3>
              <div className="bg-sage-50/20 border border-sage-200/40 rounded-lg px-4 py-3">
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  {renderFormattedText(rationale.whyCorrect)}
                </p>
              </div>
            </motion.section>

            {/* Why Incorrect Section */}
            <motion.section variants={itemVariants}>
              <h3 className="font-semibold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-dusty-rose-500" />
                Why Other Options Are Wrong
              </h3>
              <div className="space-y-2">
                {options.map((option, index) => {
                  if (index === correctAnswerIndex) return null;
                  const letter = String.fromCharCode(65 + index);
                  const key = `whyIncorrect${letter}` as keyof StructuredRationale;
                  const whyIncorrect = rationale[key];
                  const isUserChoice = index === userAnswerIndex;

                  // Show explanation if available; show placeholder for user's wrong choice if missing
                  if (!whyIncorrect || typeof whyIncorrect !== 'string') {
                    if (!isUserChoice) return null;
                    // Always show the user's incorrect choice, even without explanation
                    return (
                      <div
                        key={`option-${letter}`}
                        className="px-4 py-2 rounded-lg border bg-dusty-rose-50/20 border-dusty-rose-300/40"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-sm text-dusty-rose-600">
                            {letter}.
                          </span>
                          <div className="flex-1">
                            <span className="text-sm text-[var(--color-text-muted)] italic">
                              This was not the best answer.
                            </span>
                            <span className="ml-2 text-xs text-dusty-rose-600 font-medium">
                              (Your answer)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`option-${letter}`}
                      className={`px-4 py-2 rounded-lg border ${
                        isUserChoice
                          ? 'bg-dusty-rose-50/20 border-dusty-rose-300/40'
                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`font-semibold text-sm ${isUserChoice ? 'text-dusty-rose-600' : 'text-[var(--color-text-muted)]'}`}
                        >
                          {letter}.
                        </span>
                        <div className="flex-1">
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {renderFormattedText(whyIncorrect)}
                          </span>
                          {isUserChoice && (
                            <span className="ml-2 text-xs text-dusty-rose-600 font-medium">
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
                <h3 className="font-semibold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-steel-blue-500" />
                  High-Yield Image / Table
                </h3>
                <div className="bg-[var(--color-accent)]/8 border border-[var(--color-accent)]/20 rounded-lg px-4 py-3">
                  <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm">
                    {renderFormattedText(rationale.highYieldImageOrTable)}
                  </p>
                </div>
              </motion.section>
            )}

            {/* 5. Clinical Pearl */}
            {rationale.clinicalPearl && (
              <motion.section variants={itemVariants}>
                <h3 className="font-semibold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--color-data-provisional)]" />
                  Clinical Pearl
                </h3>
                <div className="bg-[var(--color-data-provisional)]/20 border border-[var(--color-data-provisional)]/30 rounded-lg px-4 py-3">
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
            <h3 className="font-semibold text-base mb-3 text-[var(--color-text-primary)] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
              Core Rationale
            </h3>
            <ul className="space-y-2 pl-1">
              {coreRationale.map((point, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-[var(--color-text-secondary)] leading-relaxed"
                >
                  <span className="text-[var(--color-accent)] mt-1.5 flex-shrink-0 font-semibold">
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
          <h3 className="font-semibold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[var(--color-data-provisional)]" />
            Buzzwords / Key Clues
          </h3>
          <p className="text-[var(--color-text-secondary)] bg-[var(--color-data-provisional)]/20 px-3 py-2 rounded-lg border border-[var(--color-data-provisional)]/30">
            {renderFormattedText(buzzwords)}
          </p>
        </motion.section>

        {/* Memory Hook / Mnemonic Section - Only show when mnemonic is available */}
        {mnemonic && mnemonic !== '[Mnemonic not available]' && (
          <motion.section variants={itemVariants}>
            <h3 className="font-semibold text-base mb-2 text-[var(--color-text-primary)] flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-deep-plum-500" />
              Memory Hook / Mnemonic
            </h3>
            <p className="px-3 py-2 rounded-lg border text-[var(--color-text-secondary)] bg-deep-plum-50/20 border-deep-plum-200/40">
              {mnemonic}
            </p>
          </motion.section>
        )}

        {/* Key Differentials Section */}
        {differentials.length > 0 && differentials[0] !== '[No differentials specified]' && (
          <motion.section variants={itemVariants}>
            <h3 className="font-semibold text-base mb-3 text-[var(--color-text-primary)]">
              Key Differentials
            </h3>
            <ul className="space-y-2 pl-1">
              {differentials.map((diff, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-[var(--color-text-secondary)] leading-relaxed"
                >
                  <span className="text-steel-blue-500 mt-1.5 flex-shrink-0 font-semibold">›</span>
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
                            ? 'bg-dusty-rose-50/20 border-dusty-rose-200/40'
                            : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                        }`}
                      >
                        <span
                          className={`font-medium ${
                            isUserChoice
                              ? 'text-dusty-rose-700'
                              : 'text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {index + 1}. {option}
                        </span>
                        {isUserChoice && (
                          <span className="ml-2 text-xs text-dusty-rose-600">
                            (Your answer)
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Highlight correct answer */}
                  <div className="px-3 py-2 rounded-lg bg-sage-50/20 border border-sage-200/40">
                    <span className="font-medium text-sage-700">
                      {correctAnswerIndex + 1}. {correctAnswer}
                    </span>
                    <span className="ml-2 text-xs text-sage-600">
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
                  ? 'bg-sage-100/30 text-sage-700 border border-sage-300/40'
                  : userReaction !== null
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                    : 'bg-[var(--color-bg-secondary)] hover:bg-sage-50/20 text-[var(--color-text-secondary)] hover:text-sage-700 border border-[var(--color-border)]'
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
                  ? 'bg-dusty-rose-100/30 text-dusty-rose-700 border border-dusty-rose-300/40'
                  : userReaction !== null
                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                    : 'bg-[var(--color-bg-secondary)] hover:bg-dusty-rose-50/20 text-[var(--color-text-secondary)] hover:text-dusty-rose-700 border border-[var(--color-border)]'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              Not Helpful
            </button>
          </div>
        </motion.div>

        {/* Evidence Sources — from Google Search grounding */}
        {(() => {
          // Merge sources from prop and structured rationale
          const rationaleSourcesRaw = isStructuredRationale(rationale) ? rationale.groundingSources : undefined;
          const allSources = propGroundingSources || rationaleSourcesRaw;
          if (!allSources || allSources.length === 0) return null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 pt-3 border-t border-[var(--color-border)]/40"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Evidence Sources
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allSources.map((source, idx) => (
                  <a
                    key={`${source.uri}-${idx}`}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md
                      bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/50
                      text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]
                      hover:border-[var(--color-accent)]/30 transition-colors
                      max-w-[280px] truncate"
                    title={source.title}
                  >
                    <span className="truncate">{source.title}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </motion.div>
          );
        })()}

        {/* PubMed References — peer-reviewed citations */}
        {(() => {
          const citations = propPubmedCitations || (isStructuredRationale(rationale) ? (rationale as any).pubmedCitations : undefined);
          if (!citations || citations.length === 0) return null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-3 pt-3 border-t border-[var(--color-border)]/40"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  References
                </span>
              </div>
              <div className="space-y-1.5">
                {citations.map((cite: any, idx: number) => (
                  <a
                    key={`pubmed-${cite.pmid}-${idx}`}
                    href={cite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs leading-relaxed px-2 py-1.5 rounded-md
                      bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/50
                      text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]
                      hover:border-[var(--color-accent)]/30 transition-colors"
                  >
                    <span className="font-medium">{cite.authors}</span>
                    {' '}({cite.year}).{' '}
                    <span className="italic">{cite.title}</span>
                    {' '}{cite.journal}.{' '}
                    <span className="text-[var(--color-accent)] font-medium">PMID: {cite.pmid}</span>
                  </a>
                ))}
              </div>
            </motion.div>
          );
        })()}

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
