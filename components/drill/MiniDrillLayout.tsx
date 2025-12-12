import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, ArrowRight, RotateCcw, CheckCircle, XCircle, Award } from 'lucide-react';

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
  // Animation variants
  const flashVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
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
              isCorrect ? 'bg-emerald-500/20' : 'bg-red-500/20'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Header - Responsive */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm border-b border-[var(--color-border)]">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 sm:gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1"
          aria-label="Exit"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <h1 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] truncate max-w-[50%]">
          {title}
        </h1>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Score */}
          <div className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-primary)] font-semibold">{score}</span>
            <span className="text-[var(--color-text-muted)]">/{totalAttempts}</span>
          </div>

          {/* Streak Counter */}
          <div className="flex items-center gap-1">
            <Flame
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                streak > 0 ? 'text-orange-500' : 'text-slate-400 dark:text-slate-600'
              }`}
            />
            <span
              className={`text-xs sm:text-sm font-bold ${
                streak > 0 ? 'text-orange-500' : 'text-slate-400 dark:text-slate-600'
              }`}
            >
              {streak}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area - Responsive padding */}
      <main className="flex-1 overflow-y-auto pt-14 sm:pt-16 pb-32 sm:pb-36 px-3 sm:px-4">
        {children}
      </main>

      {/* Fixed Footer Bar */}
      {footer && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] z-10">
          {footer}
        </div>
      )}

      {/* Reset button (floating) - Responsive positioning */}
      <button
        onClick={onReset}
        className="fixed bottom-20 sm:bottom-24 right-3 sm:right-4 p-2.5 sm:p-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shadow-lg z-20"
        aria-label="Reset session"
        title="Reset session"
      >
        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  );
};

interface QuestionCardProps {
  question: string;
  category?: string;
  subcategory?: string;
}

/**
 * QuestionCard - Displays the question text
 */
export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  category,
  subcategory,
}) => (
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
    'w-full text-left p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all duration-200 border text-sm sm:text-base';
  
  if (isAnswered) {
    if (isCorrect === true) {
      buttonClasses += ' bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 text-emerald-900 dark:text-emerald-100';
    } else if (isSelected) {
      buttonClasses += ' bg-red-100 dark:bg-red-900/50 border-red-500 text-red-900 dark:text-red-100';
    } else {
      buttonClasses += ' bg-[var(--color-bg-tertiary)] border-[var(--color-border)] text-[var(--color-text-muted)] opacity-60';
    }
  } else {
    buttonClasses += ' bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-text-muted)] cursor-pointer';
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
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        )}
        {isAnswered && isSelected && isCorrect === false && (
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
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
          ? 'bg-emerald-100 dark:bg-emerald-950/50 border-t-2 border-emerald-500'
          : 'bg-red-100 dark:bg-red-950/50 border-t-2 border-red-500'
      }`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className={`text-lg font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </div>
            {!isCorrect && correctAnswer && (
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                Correct answer: <span className="font-semibold text-[var(--color-text-primary)]">{correctAnswer}</span>
              </div>
            )}
          </div>
          <button
            onClick={onNext}
            className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium transition-colors text-sm sm:text-base w-full sm:w-auto ${
              isCorrect
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
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
          <div className="text-sm text-amber-900 dark:text-amber-300/90 bg-amber-100 dark:bg-amber-900/20 rounded-lg p-3 mt-2 border border-amber-300 dark:border-amber-700/30 flex items-start gap-2">
            <Award className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span><span className="font-medium">Pearl: </span>{pearl}</span>
          </div>
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
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="mb-2 sm:mb-3 p-2 sm:p-2.5 bg-white/20 rounded-lg sm:rounded-xl w-fit">
          {icon}
        </div>
        <h3 className="text-base sm:text-lg font-bold text-white mb-0.5 sm:mb-1">
          {title}
        </h3>
        <p className="text-white/80 text-xs sm:text-sm line-clamp-2">
          {description}
        </p>
      </div>

      <ArrowRight className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 w-4 h-4 sm:w-5 sm:h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
    </motion.button>
  );
};

export default MiniDrillLayout;
