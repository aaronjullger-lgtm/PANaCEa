import React from 'react';
import { motion } from 'framer-motion';
import { X, Beaker, Pill, AlertTriangle, FileQuestion, Syringe, Shuffle, Activity } from 'lucide-react';
import { usePharmDrill, type PharmCategory } from '@/hooks/game/use-pharm-drill';
import MiniDrillLayout, { QuestionCard, AnswerOption, FeedbackPanel, CategoryCard } from './MiniDrillLayout';

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
    icon: <Activity className="w-6 h-6 sm:w-8 sm:h-8" />,
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
  } = usePharmDrill();

  const [isLoading, setIsLoading] = React.useState(false);

  const handleExit = () => {
    exitToMenu();
    if (onExit) {
      onExit();
    }
  };

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
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white">
        <div className="border-b border-purple-800/30 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Beaker className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold">Pharmacology Quiz</h1>
                <p className="text-sm text-purple-300">Drug Knowledge & Mechanisms</p>
              </div>
            </div>
            {onExit && (
              <button onClick={onExit} className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-purple-400">Master Pharmacology</h2>
              <p className="text-xl text-slate-300">High-yield drug mechanisms, side effects, and interactions</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-purple-800/30 text-left space-y-6">
              <h3 className="text-2xl font-semibold text-purple-400">What You'll Practice</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                  <h4 className="font-semibold text-white mb-2">Mechanisms of Action</h4>
                  <p className="text-slate-400 text-sm">How drugs work at the molecular level</p>
                </div>
                <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                  <h4 className="font-semibold text-white mb-2">Side Effects</h4>
                  <p className="text-slate-400 text-sm">Adverse reactions and contraindications</p>
                </div>
                <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                  <h4 className="font-semibold text-white mb-2">Drug Interactions</h4>
                  <p className="text-slate-400 text-sm">Critical combinations and warnings</p>
                </div>
                <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                  <h4 className="font-semibold text-white mb-2">Clinical Uses</h4>
                  <p className="text-slate-400 text-sm">Indications and therapeutic applications</p>
                </div>
              </div>

              <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                <p className="text-sm text-purple-300 font-semibold mb-2">Features:</p>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• PANCE high-yield medications</li>
                  <li>• Multiple question types (MOA, side effects, antidotes)</li>
                  <li>• Detailed explanations with pearls</li>
                  <li>• Score tracking and streak counter</li>
                </ul>
              </div>
            </div>

            <button onClick={handleStart} disabled={isLoading} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-3 mx-auto">
              {isLoading ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Loading...</>) : (<>Choose Category<Activity className="w-5 h-5" /></>)}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-base sm:text-lg font-semibold text-slate-200">Pharmacology Quiz</h1>
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
              Select Quiz Category
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
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
              category={currentQuestion.drugClass}
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
