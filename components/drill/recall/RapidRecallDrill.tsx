import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, RotateCcw, ArrowRight } from 'lucide-react';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import { BUZZWORD_BANK, getBuzzwordDictionary, getAllBuzzwordConditions } from '@/data/buzzwordBank';

/**
 * Get buzzword dictionary from the comprehensive bank
 */
const BUZZWORD_DICTIONARY = getBuzzwordDictionary();

/** Get all buzzwords as an array */
const BUZZWORDS = Object.keys(BUZZWORD_DICTIONARY);

/** Get all diagnoses as options for autocomplete */
const ALL_DIAGNOSES = getAllBuzzwordConditions();

interface RapidRecallDrillProps {
  onExit?: () => void;
}

type DrillStatus = 'playing' | 'feedback' | 'summary';

/**
 * RapidRecallDrill - "Flashcard meets Type-ahead" drill mode.
 * 
 * Displays a massive buzzword in the center and users must type the
 * associated diagnosis. Uses the same full-screen dark mode layout
 * as PhotoDrill.
 */
const RapidRecallDrill: React.FC<RapidRecallDrillProps> = ({ onExit }) => {
  const [currentBuzzword, setCurrentBuzzword] = useState<string>('');
  const [streak, setStreak] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [totalCorrect, setTotalCorrect] = useState<number>(0);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [status, setStatus] = useState<DrillStatus>('playing');
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [usedBuzzwords, setUsedBuzzwords] = useState<Set<string>>(new Set());

  // Load high score from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('panceai_rapid_recall_high_score');
      if (saved) {
        setHighScore(parseInt(saved, 10) || 0);
      }
    } catch (e) {
      console.error('Failed to load high score:', e);
    }
  }, []);

  // Save high score when streak updates
  useEffect(() => {
    if (streak > highScore) {
      setHighScore(streak);
      try {
        localStorage.setItem('panceai_rapid_recall_high_score', streak.toString());
      } catch (e) {
        console.error('Failed to save high score:', e);
      }
    }
  }, [streak, highScore]);

  // Get a random buzzword that hasn't been used yet in this session
  const getNextBuzzword = useCallback(() => {
    const available = BUZZWORDS.filter((b) => !usedBuzzwords.has(b));
    if (available.length === 0) {
      // Reset if all buzzwords have been used
      setUsedBuzzwords(new Set());
      return BUZZWORDS[Math.floor(Math.random() * BUZZWORDS.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }, [usedBuzzwords]);

  // Initialize with first buzzword
  useEffect(() => {
    if (!currentBuzzword) {
      setCurrentBuzzword(getNextBuzzword());
    }
  }, [currentBuzzword, getNextBuzzword]);

  /**
   * Normalize a diagnosis string for comparison.
   * Handles common variations in medical terminology.
   */
  const normalizeDiagnosis = (str: string): string => {
    return str
      .toLowerCase()
      .trim()
      // Remove possessive 's (e.g., "Crohn's" → "Crohn")
      .replace(/['']s\b/g, '')
      // Remove common articles and connectors
      .replace(/\b(the|a|an|of|and)\b/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSubmit = useCallback((answer: string) => {
    const correctAnswer = BUZZWORD_DICTIONARY[currentBuzzword];
    const normalizedAnswer = normalizeDiagnosis(answer);
    const normalizedCorrect = normalizeDiagnosis(correctAnswer);
    const isAnswerCorrect = normalizedAnswer === normalizedCorrect;
    
    setUserAnswer(answer);
    setIsCorrect(isAnswerCorrect);
    setTotalAttempts((prev) => prev + 1);
    setStatus('feedback');

    if (isAnswerCorrect) {
      setStreak((prev) => prev + 1);
      setTotalCorrect((prev) => prev + 1);
    } else {
      setStreak(0);
    }

    // Mark this buzzword as used
    setUsedBuzzwords((prev) => new Set([...prev, currentBuzzword]));
  }, [currentBuzzword]);

  const handleNext = useCallback(() => {
    setCurrentBuzzword(getNextBuzzword());
    setUserAnswer('');
    setStatus('playing');
  }, [getNextBuzzword]);

  const handleReset = useCallback(() => {
    setStreak(0);
    setTotalCorrect(0);
    setTotalAttempts(0);
    setUsedBuzzwords(new Set());
    setCurrentBuzzword(getNextBuzzword());
    setUserAnswer('');
    setStatus('playing');
  }, [getNextBuzzword]);

  const handleExit = () => {
    if (onExit) {
      onExit();
    }
  };

  // Animation variants
  const buzzwordVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  };

  const feedbackVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const flashVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col">
      {/* Flash overlay for correct/incorrect feedback */}
      <AnimatePresence>
        {status === 'feedback' && (
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

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/50">
        <button
          onClick={handleExit}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Exit"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <h1 className="text-lg font-semibold text-slate-200">Rapid Recall</h1>

        <div className="flex items-center gap-4">
          {/* Score */}
          <div className="text-sm text-slate-400">
            {totalCorrect}/{totalAttempts}
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

      {/* Main Stage - Buzzword Display */}
      <main className="flex-1 flex items-center justify-center p-4 pt-16 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBuzzword}
            variants={buzzwordVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <p className="text-sm uppercase tracking-widest text-slate-500 mb-4">
              What diagnosis is this buzzword associated with?
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-100 leading-tight">
              {currentBuzzword}
            </h2>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Fixed Bottom Bar with Input/Feedback */}
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
                  onSubmit={handleSubmit}
                  autoFocus
                  options={ALL_DIAGNOSES}
                />
              </div>
            </motion.div>
          )}

          {status === 'feedback' && (
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
                          {BUZZWORD_DICTIONARY[currentBuzzword]}
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
                    onClick={handleNext}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                      isCorrect
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                    }`}
                  >
                    Next Card
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset button (floating) */}
      <button
        onClick={handleReset}
        className="fixed bottom-20 right-4 p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        aria-label="Reset session"
        title="Reset session"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
    </div>
  );
};

export default RapidRecallDrill;
