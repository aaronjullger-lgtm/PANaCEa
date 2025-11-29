import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoDrill, type CategoryType } from '@/hooks/game/use-photo-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import { Flame, X, ArrowRight, RotateCcw, Heart, Scan, Activity, Shuffle } from 'lucide-react';

interface PhotoDrillSessionProps {
  /** Callback to navigate back to the menu */
  onExit?: () => void;
}

/** Category card data for the lobby */
const CATEGORY_CARDS: Array<{
  id: CategoryType;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}> = [
  {
    id: 'ecg',
    title: 'ECG',
    description: 'Electrocardiogram interpretation',
    icon: <Activity className="w-8 h-8" />,
    gradient: 'from-emerald-600 to-teal-700',
  },
  {
    id: 'derm',
    title: 'Derm',
    description: 'Dermatology lesion identification',
    icon: <Scan className="w-8 h-8" />,
    gradient: 'from-violet-600 to-purple-700',
  },
  {
    id: 'radiology',
    title: 'Radiology',
    description: 'X-ray and imaging analysis',
    icon: <Heart className="w-8 h-8" />,
    gradient: 'from-sky-600 to-blue-700',
  },
  {
    id: 'random',
    title: 'Random Mix',
    description: 'All categories combined',
    icon: <Shuffle className="w-8 h-8" />,
    gradient: 'from-orange-600 to-red-700',
  },
];

/**
 * PhotoDrillSession - Global Photo Mode UI
 * 
 * A full-screen immersive interface with two stages:
 * - Lobby: Category selection
 * - Drill: Infinite photo drill with smart type-ahead search
 */
const PhotoDrillSession: React.FC<PhotoDrillSessionProps> = ({ onExit }) => {
  const {
    currentCase,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    submitAnswer,
    nextCase,
    reset,
    startSession,
    exitToMenu,
  } = usePhotoDrill();

  const handleExit = () => {
    exitToMenu();
    if (onExit) {
      onExit();
    }
  };

  const handleCategorySelect = (category: CategoryType) => {
    startSession(category);
  };

  const handleDiagnosisSubmit = (diagnosis: string) => {
    submitAnswer(diagnosis);
  };

  const handleNextCase = () => {
    nextCase();
  };

  const handleReset = () => {
    reset();
  };

  // Animation variants
  const imageVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  const feedbackVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: { scale: 1.02, y: -4 },
    tap: { scale: 0.98 },
  };

  // =========================================================================
  // VIEW A: The Lobby (Status: 'menu')
  // =========================================================================
  if (status === 'menu') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Exit"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium">Exit</span>
          </button>
          <h1 className="text-lg font-semibold text-slate-200">Photo Drill</h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-slate-100 mb-2">
              Select Your Training Module
            </h2>
            <p className="text-slate-400">
              Choose a category to start your infinite drill session
            </p>
          </motion.div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
            {CATEGORY_CARDS.map((card, index) => (
              <motion.button
                key={card.id}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                transition={{ duration: 0.3, delay: index * 0.1 }}
                onClick={() => handleCategorySelect(card.id)}
                className={`relative p-6 rounded-2xl bg-gradient-to-br ${card.gradient} text-left shadow-xl overflow-hidden group`}
              >
                {/* Background glow effect */}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="mb-4 p-3 bg-white/20 rounded-xl w-fit">
                    {card.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {card.title}
                  </h3>
                  <p className="text-white/80 text-sm">
                    {card.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </motion.button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: The Drill (Status: 'playing' | 'feedback')
  // =========================================================================
  if (status === 'playing' || status === 'feedback') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col">
        {/* Floating Header */}
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/50">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Exit session"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Exit</span>
          </button>

          <div className="flex items-center gap-4">
            {/* Score */}
            <div className="text-sm text-slate-400">
              Score: <span className="text-slate-200 font-semibold">{score}</span>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center gap-1.5">
              <Flame
                className={`w-5 h-5 ${
                  streak > 0 ? 'text-orange-500' : 'text-slate-600'
                }`}
              />
              <span
                className={`text-sm font-bold ${
                  streak > 0 ? 'text-orange-500' : 'text-slate-600'
                }`}
              >
                {streak}
              </span>
            </div>
          </div>
        </header>

        {/* Main Stage - Image takes up full available height */}
        <main className="flex-1 flex items-center justify-center p-4 pt-16 pb-32">
          <AnimatePresence mode="wait">
            {currentCase && (
              <motion.div
                key={currentCase.id}
                variants={imageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="w-full max-w-3xl h-full flex items-center justify-center"
              >
                <div className="relative bg-slate-900 rounded-lg overflow-hidden shadow-2xl w-full">
                  <img
                    src={currentCase.imageUrl}
                    alt={`Medical ${currentCase.modality.toUpperCase()} case`}
                    className="w-full aspect-[3/2] object-contain"
                  />
                  {/* Modality Badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-slate-800/90 backdrop-blur-sm rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {currentCase.modality}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Fixed Bottom Bar with DiagnosisInput */}
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800">
          <AnimatePresence mode="wait">
            {status === 'playing' && (
              <motion.div
                key="playing-controls"
                variants={feedbackVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="p-4"
              >
                <div className="max-w-2xl mx-auto">
                  <DiagnosisInput
                    onSubmit={handleDiagnosisSubmit}
                    autoFocus
                  />
                </div>
              </motion.div>
            )}

            {status === 'feedback' && currentCase && (
              <motion.div
                key="feedback-controls"
                variants={feedbackVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className={`p-4 ${
                  isCorrect
                    ? 'bg-emerald-950/50 border-t-2 border-emerald-500'
                    : 'bg-red-950/50 border-t-2 border-red-500'
                }`}
              >
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div
                        className={`text-lg font-bold ${
                          isCorrect ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isCorrect ? 'Correct!' : 'Incorrect'}
                      </div>
                      {!isCorrect && (
                        <div className="text-sm text-slate-300 mt-1">
                          Correct answer:{' '}
                          <span className="font-semibold text-slate-100">
                            {currentCase.correctDiagnosis}
                          </span>
                        </div>
                      )}
                      {userAnswer && !isCorrect && (
                        <div className="text-sm text-slate-500 mt-0.5">
                          Your answer: {userAnswer}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleNextCase}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                        isCorrect
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                      }`}
                    >
                      Next Case
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Explanation */}
                  <div className="text-sm text-slate-400 bg-slate-900/50 rounded-lg p-3 mt-2">
                    <span className="font-medium text-slate-300">
                      Explanation:{' '}
                    </span>
                    {currentCase.explanation}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Summary View (Status: 'summary')
  // =========================================================================
  if (status === 'summary') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-8 bg-slate-900 rounded-2xl shadow-2xl text-center"
        >
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            Session Complete
          </h2>
          <p className="text-slate-400 mb-6">
            Great work on your training session!
          </p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400">
                {score}
              </div>
              <div className="text-sm text-slate-500">Correct</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Session
            </button>
            <button
              onClick={handleExit}
              className="px-6 py-3 text-slate-400 hover:text-slate-200 font-medium transition-colors"
            >
              Exit to Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Fallback for legacy 'active' status (backwards compatibility)
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Loading...</p>
        <button
          onClick={handleExit}
          className="text-sky-400 hover:text-sky-300"
        >
          Exit
        </button>
      </div>
    </div>
  );
};

export default PhotoDrillSession;
