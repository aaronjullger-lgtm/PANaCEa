import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, ArrowRight, RotateCcw, CheckCircle, XCircle, Award, Zap, Clock } from 'lucide-react';
import { useIsMobile } from '../../lib/utils/responsive';

interface MiniDrillLayoutProps {
  /** Title for the header */
  title: string;
  /** Current score */
  score: number;
  /** Total attempts */
  totalAttempts: number;
  /** Current streak */
  streak: number;
  /** Whether we're in feedback mode */
  isFeedback: boolean;
  /** Whether the last answer was correct */
  isCorrect: boolean | null;
  /** Exit handler */
  onExit: () => void;
  /** Reset handler */
  onReset: () => void;
  /** Children content */
  children: React.ReactNode;
  /** Footer content (usually feedback or input) */
  footer?: React.ReactNode;
}

/**
 * MiniDrillLayout - Shared layout wrapper for mini drill modes
 *
 * Provides consistent header, scoring, streak display, and footer
 * with responsive design for mobile/tablet/desktop.
 */
const MiniDrillLayout: React.FC<MiniDrillLayoutProps> = ({
  title,
  score,
  totalAttempts,
  streak,
  isFeedback,
  isCorrect,
  onExit,
  onReset,
  children,
  footer,
}) => {
  const isMobile = useIsMobile();

  // Animation variants
  const flashVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] dark:bg-data-neutral text-[var(--color-text-primary)] flex flex-col">
      {/* Flash overlay for correct/incorrect feedback */}
      <AnimatePresence>
        {isFeedback && isCorrect !== null && (
          <motion.div
            variants={flashVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15 }}
            className={`absolute inset-0 z-0 pointer-events-none ${
              isCorrect ? 'bg-data-pass/20' : 'bg-data-fail/20'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Header - Responsive with min touch targets */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm border-b border-[var(--color-border)]">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 sm:gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2 min-h-[44px] min-w-[44px] justify-center sm:justify-start"
          aria-label="Exit drill"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <h1 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] truncate px-2">
          {title}
        </h1>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Score - Hidden on very small screens */}
          <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] hidden xs:block">
            <span className="text-[var(--color-text-primary)] font-semibold">{score}</span>
            <span className="text-[var(--color-text-muted)]">/{totalAttempts}</span>
          </div>

          {/* Streak Counter */}
          <div className="flex items-center gap-1 min-h-[44px]">
            <Flame
              className={`w-5 h-5 sm:w-6 sm:h-6 ${
                streak > 0 ? 'text-[var(--color-data-provisional)]' : 'text-muted-foreground'
              }`}
            />
            <span
              className={`text-sm sm:text-base font-bold ${
                streak > 0 ? 'text-[var(--color-data-provisional)]' : 'text-muted-foreground'
              }`}
            >
              {streak}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area - Responsive padding, stacks on mobile */}
      <main className="flex-1 overflow-y-auto pt-16 sm:pt-16 pb-32 sm:pb-36 px-3 sm:px-6">
        {children}
      </main>

      {/* Fixed Footer Bar - Glassmorphism */}
      {footer && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-[var(--color-bg-primary)]/80 backdrop-blur-md border-t border-[var(--color-border)] shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.12)] dark:shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.35)]">
          {footer}
        </div>
      )}

      {/* Reset button (floating) - Responsive positioning with min touch target */}
      <button
        onClick={onReset}
        className="fixed bottom-20 sm:bottom-24 right-3 sm:right-4 p-3 min-h-[44px] min-w-[44px] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shadow-lg z-20 flex items-center justify-center"
        aria-label="Reset session"
        title="Reset session"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
    </div>
  );
};

interface QuestionCardProps {
  question: string;
  category?: string;
  subcategory?: string;
  isLoading?: boolean;
}

/**
 * QuestionCard - Displays the question text
 */
export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  category,
  subcategory,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-[var(--color-bg-secondary)] rounded-xl sm:rounded-2xl border border-[var(--color-border)] p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex gap-2 mb-3">
          <div className="w-16 h-5 bg-data-neutral dark:bg-data-neutral animate-pulse rounded" />
          <div className="w-20 h-5 bg-data-neutral dark:bg-data-neutral animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          <div className="w-full h-5 bg-data-neutral dark:bg-data-neutral animate-pulse rounded" />
          <div className="w-11/12 h-5 bg-data-neutral dark:bg-data-neutral animate-pulse rounded" />
          <div className="w-4/5 h-5 bg-data-neutral dark:bg-data-neutral animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-bg-secondary)] rounded-xl sm:rounded-2xl border border-[var(--color-border)] p-4 sm:p-6 mb-4 sm:mb-6"
    >
      {(category || subcategory) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {category && (
            <span className="px-2 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-xs font-medium text-[var(--color-text-secondary)]">
              {category}
            </span>
          )}
          {subcategory && (
            <span className="px-2 py-0.5 bg-[var(--color-bg-tertiary)]/50 rounded text-xs text-[var(--color-text-muted)]">
              {subcategory}
            </span>
          )}
        </div>
      )}
      <p className="text-base sm:text-lg text-[var(--color-text-primary)] leading-relaxed">
        {question}
      </p>
    </motion.div>
  );
};

interface AnswerOptionProps {
  index: number;
  text: string;
  isSelected: boolean;
  isCorrect: boolean | null;
  isAnswered: boolean;
  onSelect: (index: number) => void;
}

/**
 * AnswerOption - A single answer choice button
 */
export const AnswerOption: React.FC<AnswerOptionProps> = ({
  index,
  text,
  isSelected,
  isCorrect,
  isAnswered,
  onSelect,
}) => {
  let buttonClasses =
    'w-full text-left p-4 min-h-[56px] rounded-lg sm:rounded-xl transition-all duration-200 border text-sm sm:text-base';

  if (isAnswered) {
    if (isCorrect === true) {
      buttonClasses += ' bg-data-pass/10 border-data-pass text-data-pass';
    } else if (isSelected) {
      buttonClasses += ' bg-data-fail/10 border-data-fail text-data-fail';
    } else {
      buttonClasses +=
        ' bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-muted)] opacity-60';
    }
  } else {
    buttonClasses +=
      ' bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)] cursor-pointer';
  }

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => !isAnswered && onSelect(index)}
      disabled={isAnswered}
      className={buttonClasses}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <span className="font-bold text-[var(--color-text-muted)] flex-shrink-0">
          {String.fromCharCode(65 + index)}.
        </span>
        <span className="flex-1">{text}</span>
        {isAnswered && isCorrect === true && (
          <CheckCircle className="w-5 h-5 text-data-pass flex-shrink-0" />
        )}
        {isAnswered && isSelected && isCorrect === false && (
          <XCircle className="w-5 h-5 text-data-fail flex-shrink-0" />
        )}
      </div>
    </motion.button>
  );
};

interface FeedbackPanelProps {
  isCorrect: boolean;
  correctAnswer?: string;
  userAnswer?: string;
  explanation: string;
  pearl?: string;
  onNext: () => void;
  nextLabel?: string;
  // DEV-003 Item 5: Feedback data from API
  isRapidGuess?: boolean;
  nextReview?: {
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  } | null;
}

/**
 * FeedbackPanel - Displays feedback after answering
 */
export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  isCorrect,
  correctAnswer,
  userAnswer,
  explanation,
  pearl,
  onNext,
  nextLabel = 'Next Question',
  isRapidGuess,
  nextReview,
}) => {
  const feedbackVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <motion.div
      variants={feedbackVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className={`p-3 sm:p-4 ${
        isCorrect
          ? 'bg-data-pass/10 border-t-2 border-data-pass'
          : 'bg-data-fail/10 border-t-2 border-data-fail'
      }`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className={`text-lg font-bold ${isCorrect ? 'text-data-pass' : 'text-data-fail'}`}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </div>
            {!isCorrect && correctAnswer && (
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                Correct answer:{' '}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {correctAnswer}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onNext}
            className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base w-full sm:w-auto ${
              isCorrect
                ? 'bg-data-pass hover:bg-data-pass text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
            }`}
          >
            {nextLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Explanation */}
        <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg p-3">
          <span className="font-medium text-[var(--color-text-primary)]">Explanation: </span>
          {explanation}
        </div>

        {/* Pearl */}
        {pearl && (
          <div className="text-sm text-data-provisional dark:text-data-provisional/90 bg-data-provisional dark:bg-data-provisional/20 rounded-lg p-3 mt-2 border border-data-provisional dark:border-data-provisional/30 flex items-start gap-2">
            <Award className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">Pearl: </span>
              {pearl}
            </span>
          </div>
        )}

        {/* DEV-003 Item 5: Rapid Guess Indicator */}
        {isRapidGuess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 p-2.5 mt-2 bg-data-provisional/10 border border-data-provisional/30 rounded-lg text-sm"
          >
            <Zap className="w-4 h-4 text-data-provisional flex-shrink-0" />
            <span className="text-data-provisional font-medium">
              Rapid Guess — Answer submitted very quickly
            </span>
          </motion.div>
        )}

        {/* DEV-003 Item 5: Next Review Information */}
        {nextReview && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="flex items-start gap-3 p-3 mt-2 bg-data-pass/5 border border-data-pass/30 rounded-lg"
          >
            <Clock className="w-5 h-5 text-data-pass flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                Next Review in{' '}
                <span className="text-data-pass">
                  {nextReview.intervalDays === 0
                    ? 'Today'
                    : `${nextReview.intervalDays} day${nextReview.intervalDays !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">
                Due: {new Date(nextReview.nextDueDate).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[var(--color-text-muted)]">Stability:</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {nextReview.stability.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[var(--color-text-muted)]">Difficulty:</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {nextReview.difficulty.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

interface CategoryCardProps {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  onClick: (id: string) => void;
  index: number;
}

/**
 * CategoryCard - Card for selecting a drill category
 */
export const CategoryCard: React.FC<CategoryCardProps> = ({
  id,
  title,
  description,
  icon,
  gradient,
  onClick,
  index,
}) => {
  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: { scale: 1.02, y: -4 },
    tap: { scale: 0.98 },
  };

  return (
    <motion.button
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => onClick(id)}
      className={`relative p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} text-left shadow-xl overflow-hidden group`}
    >
      <div className="absolute inset-0 bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10">
        <div className="mb-2 sm:mb-3 p-2 sm:p-2.5 bg-foreground/20 rounded-lg sm:rounded-xl w-fit">
          {icon}
        </div>
        <h3 className="text-base sm:text-lg font-bold text-white mb-0.5 sm:mb-1">{title}</h3>
        <p className="text-white/80 text-xs sm:text-sm line-clamp-2">{description}</p>
      </div>

      <ArrowRight className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 w-4 h-4 sm:w-5 sm:h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
    </motion.button>
  );
};

export default MiniDrillLayout;
