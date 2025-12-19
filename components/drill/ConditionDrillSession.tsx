import React from 'react';
import { motion } from 'framer-motion';
import { X, Stethoscope, Search, Layers, AlertCircle, Shuffle, Lightbulb } from 'lucide-react';
import { useConditionDrill, type ConditionCategory } from '@/hooks/game/use-condition-drill';
import MiniDrillLayout, { QuestionCard, AnswerOption, FeedbackPanel, CategoryCard } from './MiniDrillLayout';
import { QuestionSkeleton } from '../loading/SkeletonLoader';

interface ConditionDrillSessionProps {
  onExit?: () => void;
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
    gradient: 'from-violet-600 to-purple-700',
  },
  {
    id: 'diagnosis',
    title: 'Diagnosis',
    description: 'Identify the condition',
    icon: <Search className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-blue-600 to-indigo-700',
  },
  {
    id: 'etiology',
    title: 'System Classification',
    description: 'Which organ system is affected?',
    icon: <Layers className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-teal-600 to-cyan-700',
  },
  {
    id: 'complication',
    title: 'Subcategories',
    description: 'Detailed condition classification',
    icon: <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-orange-600 to-amber-700',
  },
  {
    id: 'random',
    title: 'Random Mix',
    description: 'All question types combined',
    icon: <Shuffle className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-slate-600 to-gray-700',
  },
];

/**
 * ConditionDrillSession - Condition-based quiz drill mode
 */
const ConditionDrillSession: React.FC<ConditionDrillSessionProps> = ({ onExit }) => {
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
    submitAnswer,
    retryAfterHint,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
  } = useConditionDrill();

  const handleExit = () => {
    exitToMenu();
    if (onExit) {
      onExit();
    }
  };

  // =========================================================================
  // MENU VIEW
  // =========================================================================
  if (status === 'menu') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Exit"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Exit</span>
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-400" />
            <h1 className="text-base sm:text-lg font-semibold text-slate-200">Condition Drill</h1>
          </div>
          <div className="w-12 sm:w-16" />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-6 sm:mb-8"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
              Select Question Type
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
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
        </main>
      </div>
    );
  }

  // =========================================================================
  // PLAYING / FEEDBACK / COACHING VIEW
  // =========================================================================
  if (status === 'playing' || status === 'feedback' || status === 'coaching') {
    // Show smooth skeleton while fetching questions
    if (isLoading) {
      return (
        <MiniDrillLayout
          title="Condition Drill"
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
        <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-500 mb-4">
              <AlertCircle className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Error Loading Questions</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleExit}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Exit
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <MiniDrillLayout
        title="Condition Drill"
        score={score}
        totalAttempts={totalAttempts}
        streak={streak}
        isFeedback={status === 'feedback'}
        isCorrect={isCorrect}
        onExit={handleExit}
        onReset={reset}
        footer={
          status === 'feedback' && currentQuestion ? (
            <FeedbackPanel
              isCorrect={isCorrect ?? false}
              correctAnswer={currentQuestion.options[currentQuestion.correctAnswerIndex]}
              explanation={currentQuestion.explanation}
              onNext={nextQuestion}
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
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 p-6 shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                      Coach's Corner
                    </h3>
                    {isLoadingHint ? (
                      <div className="flex items-center gap-3 text-amber-700 dark:text-amber-300">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm italic">Thinking about your answer...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-amber-900 dark:text-amber-100 mb-4 leading-relaxed">
                          {socraticHint}
                        </p>
                        <button
                          onClick={retryAfterHint}
                          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-all hover:scale-105 shadow-md"
                        >
                          Try Again
                        </button>
                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                          💡 Getting it right after this hint will award 50% points (0.5 score)
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
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                  <div className="w-6 h-6 border-3 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {currentQuestion.options.map((option, index) => (
                <AnswerOption
                  key={index}
                  index={index}
                  text={option}
                  isSelected={userAnswerIndex === index}
                  isCorrect={
                    status === 'feedback'
                      ? index === currentQuestion.correctAnswerIndex
                      : null
                  }
                  isAnswered={status === 'feedback'}
                  onSelect={isSubmitting ? () => {} : submitAnswer}
                />
              ))}
            </div>
          </div>
        )}
      </MiniDrillLayout>
    );
  }

  // Fallback
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Loading...</p>
        <button onClick={handleExit} className="text-sky-400 hover:text-sky-300">
          Exit
        </button>
      </div>
    </div>
  );
};

export default ConditionDrillSession;
