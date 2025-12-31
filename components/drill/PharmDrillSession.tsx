import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Beaker, Pill, AlertTriangle, FileQuestion, Syringe, Shuffle, Activity as ActivityIcon } from 'lucide-react';
import { usePharmDrill, type PharmCategory } from '@/hooks/game/use-pharm-drill';
import MiniDrillLayout, { QuestionCard, AnswerOption, CategoryCard } from './MiniDrillLayout';
import { EnhancedFeedbackPanel } from './EnhancedFeedbackPanel';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';

interface PharmDrillSessionProps {
  onExit?: () => void;
}

/** Category cards for the lobby */
const CATEGORY_CARDS: Array<{
  id: PharmCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}> = [
  {
    id: 'mechanism',
    title: 'Mechanism of Action',
    description: 'How do these drugs work?',
    icon: <ActivityIcon className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-purple-600 to-violet-700',
  },
  {
    id: 'side_effect',
    title: 'Side Effects',
    description: 'Know the adverse reactions',
    icon: <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-red-600 to-rose-700',
  },
  {
    id: 'contraindication',
    title: 'Contraindications',
    description: 'When NOT to prescribe',
    icon: <X className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-orange-600 to-amber-700',
  },
  {
    id: 'drug_class',
    title: 'Drug Classes',
    description: 'Classify medications correctly',
    icon: <Beaker className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-blue-600 to-cyan-700',
  },
  {
    id: 'antidote',
    title: 'Antidotes',
    description: 'Reversal agents & treatments',
    icon: <Syringe className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'interaction',
    title: 'Drug Interactions',
    description: 'Critical combinations to know',
    icon: <FileQuestion className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-pink-600 to-rose-700',
  },
  {
    id: 'clinical_use',
    title: 'Clinical Uses',
    description: 'Indications and applications',
    icon: <Pill className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-indigo-600 to-purple-700',
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
 * PharmDrillSession - Pharmacology quiz drill mode
 */
const PharmDrillSession: React.FC<PharmDrillSessionProps> = ({ onExit }) => {
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
    showCategoryMenu,
    isLoading: isDataLoading,
  } = usePharmDrill();

  const [isLoading, setIsLoading] = React.useState(false);

  const handleExit = () => {
    exitToMenu();
    onExit?.();
  };

  const handleDeepDive = useCallback((topic: string) => {
    console.log('Deep dive into:', topic);
    // Could open a modal, navigate to reference library, etc.
  }, []);

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const handleStart = () => {
    setIsLoading(true);
    setTimeout(() => {
      showCategoryMenu();
      setIsLoading(false);
    }, 500);
  };

  // =========================================================================
  // LANDING PAGE
  // =========================================================================
  if (status === 'landing') {
    return (
      <DrillLandingPage
        title="Pharmacology Quiz"
        description="High-yield drug mechanisms, side effects, and interactions"
        icon={Beaker}
        accentColor="purple"
        onStart={handleStart}
        isLoading={isLoading}
        instructions={[
          'PANCE high-yield medications',
          'Multiple question types (MOA, side effects, antidotes)',
          'Mechanisms of action at the molecular level',
          'Drug interactions and contraindications',
          'Detailed explanations with clinical pearls',
        ]}
      >
        {/* Exit button overlay */}
        {onExit && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </DrillLandingPage>
    );
  }

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
          <h1 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">Pharmacology Quiz</h1>
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
              Select Quiz Category
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
              High-yield PANCE pharmacology review
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
                onClick={(id) => startSession(id as PharmCategory)}
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
        title="Pharmacology Quiz"
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
              onNext={nextQuestion}
              nextLabel="Next Question"
              category="procedure"
              tags={[
                'pharmacology',
                currentQuestion.type,
                ...(Array.isArray(currentQuestion.drugClass) 
                  ? currentQuestion.drugClass 
                  : [currentQuestion.drugClass])
              ]}
              onDeepDive={handleDeepDive}
            />
          ) : undefined
        }
      >
        {currentQuestion && (
          <div className="max-w-3xl mx-auto">
            <QuestionCard
              question={currentQuestion.question}
              category={Array.isArray(currentQuestion.drugClass) ? currentQuestion.drugClass[0] : currentQuestion.drugClass}
              subcategory={currentQuestion.type.replace('_', ' ')}
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

export default PharmDrillSession;
