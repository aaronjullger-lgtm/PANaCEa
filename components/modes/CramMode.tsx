/**
 * Cram Mode Component
 * 
 * High-yield rapid review mode featuring the 50 most important PANCE concepts.
 * Optimized for last-minute review and quick knowledge reinforcement.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Check, 
  X, 
  ChevronRight, 
  RotateCcw, 
  Trophy,
  Zap,
  BookOpen,
  Target,
  Loader2
} from 'lucide-react';
import { buzzwordService } from '../../services/buzzwordService';
import type { BuzzwordEntry } from '../../src/types';
import type { SystemCode } from '../../types';

interface CramModeProps {
  onExit: () => void;
}

interface CramQuestion {
  id: string;
  buzzword: string;
  condition: string;
  system: SystemCode;
  explanation: string;
  options: string[];
  correctIndex: number;
}

/**
 * Select 50 highest-yield buzzwords across all systems
 * Prioritized based on PANCE frequency and clinical importance
 */
const selectHighYieldBuzzwords = (allBuzzwords: BuzzwordEntry[]): BuzzwordEntry[] => {
  // Priority topics based on PANCE blueprint
  const prioritySystems: Record<string, number> = {
    'CV': 11,      // 11% of exam
    'PULM': 9,     // 9% of exam
    'GI': 8,       // 8% of exam
    'MSK': 8,      // 8% of exam
    'ID': 7,       // 7% of exam
    'NEURO': 7,    // 7% of exam
    'PSYCH': 7,    // 7% of exam
    'REPRO': 7,    // 7% of exam
    'ENDO': 6,     // 6% of exam
    'HEENT': 6,    // 6% of exam
    'PRO': 6,      // 6% of exam
    'HEME': 5,     // 5% of exam
    'RENAL': 5,    // 5% of exam
    'DERM': 4,     // 4% of exam
    'GU': 4,       // 4% of exam
  };

  // Calculate number of questions per system
  const questionsPerSystem: Record<string, number> = {} as any;
  let total = 0;
  Object.entries(prioritySystems).forEach(([system, percentage]) => {
    const count = Math.round((percentage / 100) * 50);
    questionsPerSystem[system] = count;
    total += count;
  });

  // Adjust to exactly 50 if rounding caused issues
  if (total < 50) {
    questionsPerSystem['CV'] += (50 - total);
  }

  // Select buzzwords proportionally by system
  const selected: BuzzwordEntry[] = [];
  Object.entries(questionsPerSystem).forEach(([system, count]) => {
    const systemBuzzwords = allBuzzwords.filter(b => b.system === system);
    const shuffled = [...systemBuzzwords].sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, count));
  });

  // Shuffle the final list
  return selected.sort(() => Math.random() - 0.5).slice(0, 50);
};

/**
 * Generate distractor options for multiple choice
 */
const generateOptions = (correct: string, allBuzzwords: BuzzwordEntry[]): string[] => {
  const distractors = allBuzzwords
    .filter(b => b.condition !== correct)
    .map(b => b.condition)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  
  const options = [...distractors, correct];
  return options.sort(() => Math.random() - 0.5);
};

/**
 * Convert buzzword entries to cram questions
 */
const createCramQuestions = (buzzwords: BuzzwordEntry[], allBuzzwords: BuzzwordEntry[]): CramQuestion[] => {
  return buzzwords.map((entry, index) => {
    const options = generateOptions(entry.condition, allBuzzwords);
    return {
      id: `cram-${index}`,
      buzzword: entry.buzzword,
      condition: entry.condition,
      system: entry.system,
      explanation: entry.explanation || `Key finding associated with ${entry.condition}`,
      options,
      correctIndex: options.indexOf(entry.condition),
    };
  });
};

export const CramMode: React.FC<CramModeProps> = ({ onExit }) => {
  const [questions, setQuestions] = useState<CramQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const allBuzzwords = await buzzwordService.getAllBuzzwords();
        const highYieldBuzzwords = selectHighYieldBuzzwords(allBuzzwords);
        const cramQuestions = createCramQuestions(highYieldBuzzwords, allBuzzwords);
        setQuestions(cramQuestions);
      } catch (error) {
        console.error("Failed to load buzzwords", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // Update elapsed time
  useEffect(() => {
    if (isLoading || isComplete) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, isLoading, isComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return; // Already answered
    
    setSelectedAnswer(index);
    setShowExplanation(true);
    
    if (index === currentQuestion.correctIndex) {
      setCorrectCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    window.location.reload(); // Simple restart
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading high-yield buzzwords...</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    const accuracy = (correctCount / questions.length) * 100;
    const avgTimePerQuestion = elapsedTime / questions.length;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4"
      >
        <div className="max-w-2xl mx-auto py-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center"
          >
            <Trophy className="w-20 h-20 mx-auto mb-6 text-orange-500" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-2">
              Cram Session Complete! <Trophy className="w-8 h-8 text-amber-500" />
            </h2>
            
            <div className="grid grid-cols-2 gap-4 my-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6">
                <Target className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {accuracy.toFixed(0)}%
                </div>
                <div className="text-sm text-green-600 dark:text-green-300">Accuracy</div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6">
                <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                  {formatTime(elapsedTime)}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-300">Total Time</div>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <div className="text-lg">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Questions Correct:
                </span>{' '}
                <span className="text-green-600 dark:text-green-400 font-bold">
                  {correctCount} / {questions.length}
                </span>
              </div>
              <div className="text-lg">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Avg Time/Question:
                </span>{' '}
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {avgTimePerQuestion.toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Try Again
              </button>
              <button
                onClick={onExit}
                className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
              >
                <BookOpen className="w-5 h-5" />
                Exit
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2 rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Cram Mode
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  50 High-Yield PANCE Concepts
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatTime(elapsedTime)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {currentIndex + 1} / {questions.length}
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-orange-500 to-amber-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
          >
            {/* System Badge */}
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm font-semibold">
                {currentQuestion.system}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>

            {/* Buzzword/Clinical Finding */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Clinical Finding:
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white leading-relaxed">
                "{currentQuestion.buzzword}"
              </p>
            </div>

            {/* Question */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Which condition is most commonly associated with this finding?
              </h3>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correctIndex;
                const showResult = showExplanation;

                let buttonClass = 'w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ';
                
                if (!showResult) {
                  buttonClass += 'border-gray-300 dark:border-gray-600 hover:border-orange-500 dark:hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20';
                } else if (isCorrect) {
                  buttonClass += 'border-green-500 bg-green-50 dark:bg-green-900/20';
                } else if (isSelected && !isCorrect) {
                  buttonClass += 'border-red-500 bg-red-50 dark:bg-red-900/20';
                } else {
                  buttonClass += 'border-gray-300 dark:border-gray-600 opacity-50';
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={showExplanation}
                    className={buttonClass}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-gray-900 dark:text-white">
                        {option}
                      </span>
                      {showResult && isCorrect && (
                        <Check className="w-6 h-6 text-green-600" />
                      )}
                      {showResult && isSelected && !isCorrect && (
                        <X className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
                >
                  <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Explanation
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next Button */}
            {showExplanation && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleNext}
                className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next Question
                    <ChevronRight className="w-6 h-6" />
                  </>
                ) : (
                  <>
                    View Results
                    <Trophy className="w-6 h-6" />
                  </>
                )}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CramMode;
