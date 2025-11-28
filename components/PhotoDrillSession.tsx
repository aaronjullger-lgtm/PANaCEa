import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoDrill } from '@/hooks/game/use-photo-drill';
import { Flame, X, ArrowRight, RotateCcw } from 'lucide-react';

/**
 * PhotoDrillSession - Global Photo Mode UI
 * 
 * A radiology-style dark mode interface for medical image diagnosis training.
 * Consumes the usePhotoDrill hook for state management.
 */
const PhotoDrillSession: React.FC = () => {
  const {
    currentCase,
    currentCaseIndex,
    totalCases,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    submitAnswer,
    nextCase,
    skipCase,
    reset,
  } = usePhotoDrill();

  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && status === 'active') {
      submitAnswer(inputValue.trim());
      setInputValue('');
    }
  };

  const handleNextCase = () => {
    nextCase();
    setInputValue('');
  };

  const handleSkip = () => {
    skipCase();
    setInputValue('');
  };

  const handleReset = () => {
    reset();
    setInputValue('');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Exit session"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <div className="text-sm text-slate-500">
          Case {currentCaseIndex + 1} of {totalCases}
        </div>

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
      </header>

      {/* Main Stage */}
      <main className="flex-1 flex items-center justify-center p-4 pb-32">
        <AnimatePresence mode="wait">
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl aspect-[3/2] bg-slate-900 rounded-lg animate-pulse"
            />
          )}

          {(status === 'active' || status === 'feedback') && currentCase && (
            <motion.div
              key={currentCase.id}
              variants={imageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl"
            >
              <div className="relative bg-slate-900 rounded-lg overflow-hidden shadow-2xl">
                <img
                  src={currentCase.imageUrl}
                  alt={`Medical ${currentCase.modality.toUpperCase()} case - ${currentCase.id}`}
                  className="w-full aspect-[3/2] object-contain"
                />
                {/* Modality Badge */}
                <div className="absolute top-3 left-3 px-2 py-1 bg-slate-800/80 backdrop-blur-sm rounded text-xs font-medium uppercase tracking-wide text-slate-300">
                  {currentCase.modality}
                </div>
              </div>
            </motion.div>
          )}

          {status === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md p-8 bg-slate-900 rounded-2xl shadow-2xl text-center"
            >
              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                Session Complete
              </h2>
              <p className="text-slate-400 mb-6">
                You've completed all cases in this session.
              </p>

              <div className="flex justify-center gap-8 mb-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-emerald-400">
                    {score}
                  </div>
                  <div className="text-sm text-slate-500">Correct</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-slate-300">
                    {totalCases}
                  </div>
                  <div className="text-sm text-slate-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-sky-400">
                    {totalCases > 0
                      ? Math.round((score / totalCases) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-sm text-slate-500">Accuracy</div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Start New Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Control Bar (Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800">
        <AnimatePresence mode="wait">
          {status === 'active' && (
            <motion.div
              key="active-controls"
              variants={feedbackVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter your diagnosis..."
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-medium rounded-lg transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </form>
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

          {status === 'summary' && (
            <motion.div
              key="summary-controls"
              variants={feedbackVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="p-4 text-center text-slate-500"
            >
              <p>Session ended. View your results above.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PhotoDrillSession;
