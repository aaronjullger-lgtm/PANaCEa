import React from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Beaker,
  Pill,
  AlertTriangle,
  FileQuestion,
  Syringe,
  Shuffle,
  Activity as ActivityIcon,
} from 'lucide-react';
import { usePharmDrill, type PharmCategory } from '@/hooks/game/use-pharm-drill';
import MiniDrillLayout, { QuestionCard, AnswerOption, CategoryCard } from './MiniDrillLayout';
import { EnhancedFeedbackPanel } from './EnhancedFeedbackPanel';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { QuestionSkeleton } from '@/components/loading';
import DrillShell from './DrillShell';
import { ROUTES } from '@/config/routes';

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
    gradient: 'from-[var(--color-accent)] to-[var(--color-accent)]',
  },
  {
    id: 'side_effect',
    title: 'Side Effects',
    description: 'Know the adverse reactions',
    icon: <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-data-fail)] to-[var(--color-data-fail)]',
  },
  {
    id: 'contraindication',
    title: 'Contraindications',
    description: 'When NOT to prescribe',
    icon: <X className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]',
  },
  {
    id: 'drug_class',
    title: 'Drug Classes',
    description: 'Classify medications correctly',
    icon: <Beaker className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-accent)] to-[var(--color-accent)]',
  },
  {
    id: 'antidote',
    title: 'Antidotes',
    description: 'Reversal agents & treatments',
    icon: <Syringe className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-data-pass)] to-[var(--color-data-pass)]',
  },
  {
    id: 'interaction',
    title: 'Drug Interactions',
    description: 'Critical combinations to know',
    icon: <FileQuestion className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-data-provisional)] to-[var(--color-data-provisional)]',
  },
  {
    id: 'clinical_use',
    title: 'Clinical Uses',
    description: 'Indications and applications',
    icon: <Pill className="w-6 h-6 sm:w-8 sm:h-8" />,
    gradient: 'from-[var(--color-accent)] to-[var(--color-accent)]',
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
    fsrsNextReview,
  } = usePharmDrill();

  const [isLoading, setIsLoading] = React.useState(false);

  const handleExit = () => {
    exitToMenu();
    onExit?.();
  };


  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-data-neutral p-6">
        <div className="max-w-4xl mx-auto">
          <QuestionSkeleton />
        </div>
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
      <DrillShell
        title="Pharmacology Quiz"
        breadcrumb={['Drills', 'Pharmacology']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
        hideBreadcrumb
      >
        <DrillLandingPage
          title="Pharmacology Quiz"
          description="High-yield drug mechanisms, side effects, and interactions"
          icon={Beaker}
          accentColor="purple"
          onStart={handleStart}
          onExit={onExit}
          isLoading={isLoading}
          instructions={[
            'PANCE high-yield medications',
            'Multiple question types (MOA, side effects, antidotes)',
            'Mechanisms of action at the molecular level',
            'Drug interactions and contraindications',
            'Detailed explanations with clinical pearls',
          ]}
        />
      </DrillShell>
    );
  }

  // =========================================================================
  // MENU VIEW
  // =========================================================================
  if (status === 'menu') {
    return (
      <DrillShell
        title="Pharmacology Quiz"
        breadcrumb={['Drills', 'Pharmacology', 'Select Category']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl" role="list" aria-label="Pharmacology quiz categories">
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
        </div>
      </DrillShell>
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
                  : [currentQuestion.drugClass]),
              ]}
              nextReview={fsrsNextReview}
            />
          ) : undefined
        }
      >
        {currentQuestion && (
          <div className="max-w-3xl mx-auto">
            <QuestionCard
              question={currentQuestion.question}
              category={
                Array.isArray(currentQuestion.drugClass)
                  ? currentQuestion.drugClass[0]
                  : currentQuestion.drugClass
              }
              subcategory={currentQuestion.type.replace('_', ' ')}
            />

            {/* Answer Options */}
            <div className="space-y-2 sm:space-y-3" role="radiogroup" aria-label="Answer options">
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
    <div className="fixed inset-0 z-50 bg-data-neutral flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <QuestionSkeleton />
      </div>
    </div>
  );
};

export default PharmDrillSession;
