import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { X, Stethoscope, Search, Layers, AlertCircle, Shuffle, Lightbulb } from 'lucide-react';
import { useConditionDrill, type ConditionCategory } from '@/hooks/game/use-condition-drill';
import MiniDrillLayout, {
  QuestionCard,
  AnswerOption,
  FeedbackPanel,
  CategoryCard,
} from './MiniDrillLayout';
import { QuestionSkeleton, InlineSpinner } from '../loading';
import MetacognitionPromptModal from './MetacognitionPromptModal';
import DrillShell from './DrillShell';
import DrillSummaryCard from './DrillSummaryCard';
import { ROUTES } from '@/config/routes';

interface ConditionDrillSessionProps {
  onExit?: () => void;
  initialSystem?: string;
  initialSubcategory?: string;
}

/** Category cards for the lobby */
const CATEGORY_CARDS: Array<{
  id: ConditionCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}> = [
  {
    id: 'presentation',
    title: 'Presentations',
    description: 'Match symptoms to conditions',
    icon: <Stethoscope className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-accent)] to-[var(--color-accent)]',
  },
  {
    id: 'diagnosis',
    title: 'Diagnosis',
    description: 'Identify the condition',
    icon: <Search className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-accent)] to-[var(--color-accent)]',
  },
  {
    id: 'etiology',
    title: 'System Classification',
    description: 'Which organ system is affected?',
    icon: <Layers className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-data-pass)] to-[var(--color-data-pass)]',
  },
  {
    id: 'complication',
    title: 'Subcategories',
    description: 'Detailed condition classification',
    icon: <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]',
  },
  {
    id: 'random',
    title: 'Random Mix',
    description: 'All question types combined',
    icon: <Shuffle className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]',
  },
];

/**
 * ConditionDrillSession - Condition-based quiz drill mode
 */
const ConditionDrillSession: React.FC<ConditionDrillSessionProps> = ({
  onExit,
  initialSystem,
  initialSubcategory,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const {
    currentQuestion,
    score,
    streak,
    totalAttempts,
    userAnswerIndex,
    isCorrect,
    status,
    isLoading,
    error,
    isSubmitting,
    socraticHint,
    isLoadingHint,
    attemptNumber,
    metacognitionPrompt,
    isRapidGuess,
    nextReview,
    recordAnswerSelection,
    submitAnswer,
    retryAfterHint,
    nextQuestion,
    dismissMetacognition,
    reset,
    startSession,
    exitToMenu,
  } = useConditionDrill({
    initialSystem,
    initialSubcategory,
  });

  // Compute dynamic title based on filter props
  const drillTitle = initialSystem
    ? `${initialSystem} Drill`
    : initialSubcategory
      ? `${initialSubcategory} Drill`
      : 'Condition Drill';

  // Handler that records selection for implicit metrics then submits
  const handleAnswerSelect = (index: number) => {
    recordAnswerSelection(index);
    submitAnswer(index);
  };

  const handleExit = () => {
    exitToMenu();
    if (onExit) {
      onExit();
    }
  };

  // =========================================================================
  // MENU VIEW (landing or menu status)
  // =========================================================================
  if (status === 'menu' || status === 'landing') {
    return (
      <DrillShell
        title={drillTitle}
        breadcrumb={['Drills', 'Conditions', 'Select Type']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={prefersReducedMotion ? false : { y: -20 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
            className="text-center mb-6 sm:mb-8"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              Select Question Type
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-muted)]">
              Progressive drills for medical conditions
            </p>
          </motion.div>

          {/* Category Grid - Responsive */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl">
            {CATEGORY_CARDS.map((card, index) => (
              <CategoryCard
                key={card.id}
                id={card.id}
                title={card.title}
                description={card.description}
                icon={card.icon}
                gradient={card.gradient}
                onClick={(id) => startSession(id as ConditionCategory)}
                index={index}
              />
            ))}
          </div>
        </div>
      </DrillShell>
    );
  }

  // =========================================================================
  // METACOGNITION MODAL (shown as overlay on top of feedback)
  // =========================================================================
  const showMetacognitionModal =
    status === 'metacognition' && metacognitionPrompt?.shouldShow && currentQuestion;

  // =========================================================================
  // PLAYING / FEEDBACK / COACHING / METACOGNITION VIEW
  // =========================================================================
  if (
    status === 'playing' ||
    status === 'feedback' ||
    status === 'coaching' ||
    status === 'metacognition'
  ) {
    // Show smooth skeleton while fetching questions
    if (isLoading) {
      return (
        <MiniDrillLayout
          title={drillTitle}
          score={score}
          totalAttempts={totalAttempts}
          streak={streak}
          isFeedback={false}
          isCorrect={null}
          onExit={handleExit}
          onReset={reset}
        >
          <div className="max-w-4xl mx-auto py-4 sm:py-8">
            <QuestionSkeleton />
          </div>
        </MiniDrillLayout>
      );
    }

    // Show error state
    if (error) {
      return (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-[var(--color-data-fail)] mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Error Loading Questions</h2>
            <p className="text-[var(--color-text-muted)] mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleExit}
                className="px-4 py-2 bg-[var(--color-bg-secondary)] hover:opacity-90 rounded-lg transition-colors"
              >
                Exit
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 bg-[var(--color-accent)] hover:opacity-90 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Metacognition Modal Overlay */}
        {showMetacognitionModal && metacognitionPrompt && currentQuestion && (
          <MetacognitionPromptModal
            prompt={metacognitionPrompt}
            conditionName={currentQuestion.conditionName}
            onDismiss={dismissMetacognition}
          />
        )}

        <MiniDrillLayout
          title={drillTitle}
          score={score}
          totalAttempts={totalAttempts}
          streak={streak}
          isFeedback={status === 'feedback' || status === 'metacognition'}
          isCorrect={isCorrect}
          onExit={handleExit}
          onReset={reset}
          footer={
            (status === 'feedback' || status === 'metacognition') && currentQuestion ? (
              <FeedbackPanel
                isCorrect={isCorrect ?? false}
                correctAnswer={currentQuestion.options[currentQuestion.correctAnswerIndex]}
                explanation={currentQuestion.explanation}
                onNext={nextQuestion}
                isRapidGuess={isRapidGuess}
                nextReview={nextReview}
              />
            ) : undefined
          }
        >
          {currentQuestion && (
            <div className="max-w-3xl mx-auto">
              <QuestionCard
                question={currentQuestion.question}
                category={currentQuestion.system}
                subcategory={currentQuestion.type}
              />

              {/* Coach's Corner - Socratic Hint UI */}
              {status === 'coaching' && (
                <motion.div
                  initial={prefersReducedMotion ? false : { y: -10 }}
                  animate={{ y: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : undefined}
                  className="mb-6 rounded-xl border-2 border-[var(--color-data-provisional)]/50 bg-[var(--color-data-provisional)]/10 p-6 shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-data-provisional)] flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-[var(--color-text-inverse)]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
                        Coach's Corner
                      </h3>
                      {isLoadingHint ? (
                        <div role="status" aria-label="Loading hint" aria-live="polite" className="flex items-center gap-3 text-[var(--color-text-muted)]">
                          <InlineSpinner size="md" className="text-[var(--color-data-provisional)]" />
                          <span className="text-sm italic">Thinking about your answer...</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-[var(--color-text-primary)] mb-4 leading-relaxed">
                            {socraticHint}
                          </p>
                          <button
                            onClick={retryAfterHint}
                            className="px-5 py-2.5 bg-[var(--color-data-provisional)] hover:opacity-90 text-[var(--color-text-inverse)] font-semibold rounded-lg transition-all hover:scale-105 shadow-md"
                          >
                            Try Again
                          </button>
                          <p className="mt-3 text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              Getting it right after this hint will award 50% points (0.5 score)
                            </span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Answer Options */}
              <div className="space-y-2 sm:space-y-3 relative">
                {/* Submitting overlay */}
                {isSubmitting && (
                  <div role="status" aria-label="Submitting answer" aria-live="polite" className="absolute inset-0 bg-[var(--color-bg-primary)]/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                    <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
                  </div>
                )}
                {currentQuestion.options.map((option, index) => (
                  <AnswerOption
                    key={`${currentQuestion.id}-${index}`}
                    index={index}
                    text={option}
                    isSelected={userAnswerIndex === index}
                    isCorrect={
                      status === 'feedback' ? index === currentQuestion.correctAnswerIndex : null
                    }
                    isAnswered={status === 'feedback'}
                    onSelect={isSubmitting ? () => {} : handleAnswerSelect}
                  />
                ))}
              </div>
            </div>
          )}
        </MiniDrillLayout>
      </>
    );
  }

  // =========================================================================
  // COMPLETION VIEW
  // =========================================================================
  if (status === 'completed') {
    return (
      <DrillShell
        title={`${drillTitle} — Complete`}
        breadcrumb={['Drills', 'Conditions', 'Results']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName={drillTitle}
          icon={Stethoscope}
          accentColor="var(--color-accent)"
          stats={{ correct: score, total: totalAttempts, streak }}
          onNewSession={reset}
          onExit={handleExit}
          newSessionLabel="Try Again"
        />
      </DrillShell>
    );
  }

  // Fallback - Use skeleton loader for zero CLS
  return (
    <MiniDrillLayout
      title={drillTitle}
      score={0}
      totalAttempts={0}
      streak={0}
      isFeedback={false}
      isCorrect={null}
      onExit={handleExit}
      onReset={reset}
    >
      <div className="max-w-4xl mx-auto py-4 sm:py-8">
        <QuestionSkeleton />
      </div>
    </MiniDrillLayout>
  );
};

export default ConditionDrillSession;
