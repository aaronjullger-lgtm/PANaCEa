import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Heart, Wind, Bug, Activity as ActivityIcon, Utensils, Brain, Bone, Shuffle, Pill } from 'lucide-react';
import { useFirstLineDrill, type FirstLineCategory } from '@/hooks/game/use-first-line-drill';
import MiniDrillLayout, { QuestionCard, AnswerOption, CategoryCard } from './MiniDrillLayout';
import { EnhancedFeedbackPanel } from './EnhancedFeedbackPanel';
import { QuestionSkeleton } from '@/components/loading/SkeletonLoader';

interface FirstLineDrillSessionProps {
  onExit?: () => void;
}

/** Category cards for the lobby */
const CATEGORY_CARDS: Array<{
  id: FirstLineCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}> = [
  {
    id: 'Cardiology',
    title: 'Cardiology',
    description: 'HTN, CHF, AFib, CAD treatments',
    icon: <Heart className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-red-600 to-rose-700',
  },
  {
    id: 'Pulmonology',
    title: 'Pulmonology',
    description: 'Asthma, COPD, pneumonia',
    icon: <Wind className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-cyan-600 to-teal-700',
  },
  {
    id: 'Infectious Disease',
    title: 'Infectious Disease',
    description: 'UTI, cellulitis, pharyngitis',
    icon: <Bug className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-green-600 to-emerald-700',
  },
  {
    id: 'Endocrinology',
    title: 'Endocrinology',
    description: 'Diabetes, thyroid, osteoporosis',
    icon: <ActivityIcon className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-purple-600 to-violet-700',
  },
  {
    id: 'Gastroenterology',
    title: 'Gastroenterology',
    description: 'GERD, IBD, H. pylori',
    icon: <Utensils className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-amber-600 to-orange-700',
  },
  {
    id: 'Psychiatry',
    title: 'Psychiatry',
    description: 'Depression, anxiety, bipolar',
    icon: <Brain className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-indigo-600 to-blue-700',
  },
  {
    id: 'Rheumatology',
    title: 'Rheumatology',
    description: 'Gout, RA, osteoarthritis',
    icon: <Bone className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-slate-600 to-gray-700',
  },
  {
    id: 'random',
    title: 'Random Mix',
    description: 'All categories combined',
    icon: <Shuffle className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-pink-600 to-rose-700',
  },
];

/**
 * FirstLineDrillSession - First-line treatment quiz drill mode
 */
const FirstLineDrillSession: React.FC<FirstLineDrillSessionProps> = ({ onExit }) => {
  const {
    currentQuestion,
    score,
    streak,
    totalAttempts,
    userAnswerIndex,
    isCorrect,
    status,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
    isLoading,
  } = useFirstLineDrill();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading treatments...</p>
        </div>
      </div>
    );
  }

  const handleExit = () => {
    exitToMenu();
    if (onExit) {
      onExit();
    }
  };

  const handleDeepDive = useCallback((topic: string) => {
    console.log('Deep dive into:', topic);
    // Could open a modal, navigate to reference library, etc.
  }, []);

  // =========================================================================
  // MENU VIEW
  // =========================================================================
  if (status === 'menu') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--color-border)]">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Exit"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Exit</span>
          </button>
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">First Line Treatment</h1>
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
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              Select Category
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
              What's the go-to treatment for each condition?
            </p>
          </motion.div>

          {/* Category Grid - Responsive */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl">
            {CATEGORY_CARDS.map((card, index) => (
              <CategoryCard
                key={card.id}
                id={card.id}
                title={card.title}
                description={card.description}
                icon={card.icon}
                gradient={card.gradient}
                onClick={(id) => startSession(id as FirstLineCategory)}
                index={index}
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // PLAYING / FEEDBACK VIEW
  // =========================================================================
  if (status === 'playing' || status === 'feedback') {
    return (
      <MiniDrillLayout
        title="First Line Treatment"
        score={score}
        totalAttempts={totalAttempts}
        streak={streak}
        isFeedback={status === 'feedback'}
        isCorrect={isCorrect}
        onExit={handleExit}
        onReset={reset}
        footer={
          status === 'feedback' && currentQuestion ? (
            <EnhancedFeedbackPanel
              isCorrect={isCorrect ?? false}
              correctAnswer={currentQuestion.options[currentQuestion.correctAnswerIndex]}
              explanation={currentQuestion.explanation}
              pearl={currentQuestion.pearl}
              onNext={nextQuestion}
              nextLabel="Next Question"
              category="procedure"
              tags={['treatment', 'first-line', currentQuestion.category, currentQuestion.condition]}
              onDeepDive={handleDeepDive}
            />
          ) : undefined
        }
      >
        {currentQuestion && (
          <div className="max-w-3xl mx-auto">
            <QuestionCard
              question={`What is the first-line treatment for ${currentQuestion.condition}?`}
              category={currentQuestion.category}
            />

            {/* Answer Options */}
            <div className="space-y-2 sm:space-y-3">
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
                  onSelect={submitAnswer}
                />
              ))}
            </div>
          </div>
        )}
      </MiniDrillLayout>
    );
  }

  // Fallback - Use skeleton loader for zero CLS
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <QuestionSkeleton />
      </div>
    </div>
  );
};

export default FirstLineDrillSession;
