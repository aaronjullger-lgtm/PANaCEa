/**
 * Code Blue Speed Mode Component
 * 
 * Timed ACLS/PALS rapid-fire drill mode with 5 seconds per question.
 * High-intensity training for emergency cardiac and pediatric protocols.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Siren, 
  Timer, 
  CheckCircle, 
  XCircle, 
  Play,
  RotateCcw,
  Trophy,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';

interface CodeBlueSpeedModeProps {
  onExit?: () => void;
}

interface CodeBlueQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: 'ACLS' | 'PALS' | 'Critical Care';
}

type ViewState = 'landing' | 'active' | 'complete';

// Sample ACLS/PALS questions for the speed drill
const CODE_BLUE_QUESTIONS: CodeBlueQuestion[] = [
  {
    id: 'cb1',
    question: 'First medication in cardiac arrest with shockable rhythm?',
    options: ['Amiodarone', 'Epinephrine', 'Atropine', 'Lidocaine'],
    correctIndex: 1,
    explanation: 'Epinephrine 1mg IV/IO every 3-5 minutes is the first medication in cardiac arrest.',
    category: 'ACLS'
  },
  {
    id: 'cb2',
    question: 'Initial joules for adult defibrillation (biphasic)?',
    options: ['50J', '100J', '120-200J', '360J'],
    correctIndex: 2,
    explanation: 'Biphasic defibrillators: 120-200J initially. Monophasic: 360J.',
    category: 'ACLS'
  },
  {
    id: 'cb3',
    question: 'Compression-to-ventilation ratio for pediatric 2-rescuer CPR?',
    options: ['30:2', '15:2', '5:1', '3:1'],
    correctIndex: 1,
    explanation: '15:2 for 2-rescuer pediatric CPR. 30:2 for single rescuer.',
    category: 'PALS'
  },
  {
    id: 'cb4',
    question: 'Target EtCO2 during CPR?',
    options: ['<10 mmHg', '10-20 mmHg', '35-40 mmHg', '>45 mmHg'],
    correctIndex: 1,
    explanation: 'EtCO2 >10 mmHg indicates adequate chest compressions. <10 mmHg suggests poor perfusion.',
    category: 'ACLS'
  },
  {
    id: 'cb5',
    question: 'Pediatric defibrillation dose (J/kg)?',
    options: ['1 J/kg', '2 J/kg', '4 J/kg', '10 J/kg'],
    correctIndex: 1,
    explanation: 'Initial: 2 J/kg. Subsequent: 4 J/kg (max 10 J/kg or adult dose).',
    category: 'PALS'
  },
  {
    id: 'cb6',
    question: 'Amiodarone dose in cardiac arrest?',
    options: ['150mg', '300mg', '500mg', '1g'],
    correctIndex: 1,
    explanation: 'First dose: 300mg IV/IO. Second dose: 150mg IV/IO.',
    category: 'ACLS'
  },
  {
    id: 'cb7',
    question: 'Minimum depth for adult chest compressions?',
    options: ['1 inch', '1.5 inches', '2 inches', '3 inches'],
    correctIndex: 2,
    explanation: 'At least 2 inches (5cm), no more than 2.4 inches (6cm).',
    category: 'ACLS'
  },
  {
    id: 'cb8',
    question: 'Pediatric epinephrine dose in cardiac arrest?',
    options: ['0.01 mg/kg IV', '0.1 mg/kg IV', '1 mg/kg IV', '0.01 mg/kg ET'],
    correctIndex: 0,
    explanation: '0.01 mg/kg IV/IO (1:10,000). Max single dose: 1mg.',
    category: 'PALS'
  },
  {
    id: 'cb9',
    question: 'Rate of chest compressions (all ages)?',
    options: ['60-80/min', '80-100/min', '100-120/min', '120-140/min'],
    correctIndex: 2,
    explanation: '100-120 compressions per minute for all ages.',
    category: 'ACLS'
  },
  {
    id: 'cb10',
    question: 'Post-cardiac arrest targeted temperature?',
    options: ['32-34°C', '36°C', '37.5°C', '39°C'],
    correctIndex: 0,
    explanation: 'Targeted temperature management: 32-36°C for at least 24 hours.',
    category: 'Critical Care'
  }
];

const TIME_PER_QUESTION = 5; // seconds

const CodeBlueSpeedMode: React.FC<CodeBlueSpeedModeProps> = ({ onExit }) => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [questions, setQuestions] = useState<CodeBlueQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [isTimeUp, setIsTimeUp] = useState(false);

  // Shuffle questions on start
  const handleStart = useCallback(() => {
    const shuffled = [...CODE_BLUE_QUESTIONS].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setScore({ correct: 0, total: 0 });
    setTimeLeft(TIME_PER_QUESTION);
    setViewState('active');
  }, []);

  // Timer countdown
  useEffect(() => {
    if (viewState !== 'active' || isSubmitted || isTimeUp) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimeUp(true);
          setIsSubmitted(true);
          hapticError();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewState, isSubmitted, isTimeUp]);

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerSelect = (index: number) => {
    if (isSubmitted) return;
    setSelectedAnswer(index);
  };

  const handleSubmit = useCallback(() => {
    if (selectedAnswer === null || isSubmitted) return;

    const isCorrect = selectedAnswer === currentQuestion.correctIndex;
    setIsSubmitted(true);
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    if (isCorrect) {
      hapticSuccess();
    } else {
      hapticError();
    }
  }, [selectedAnswer, isSubmitted, currentQuestion]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setIsTimeUp(false);
      setTimeLeft(TIME_PER_QUESTION);
    } else {
      setViewState('complete');
    }
  }, [currentQuestionIndex, questions.length]);

  const handleRestart = useCallback(() => {
    handleStart();
  }, [handleStart]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (isTimeUp && !isSubmitted) {
      setIsSubmitted(true);
      setScore(prev => ({
        correct: prev.correct,
        total: prev.total + 1
      }));
    }
  }, [isTimeUp, isSubmitted]);

  // Landing page
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-4">
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut"
                }}
                className="inline-flex items-center justify-center w-24 h-24 bg-red-500/10 rounded-full"
              >
                <Siren className="w-12 h-12 text-red-500" />
              </motion.div>
              
              <h1 className="text-4xl font-bold text-red-500">
                Code Blue Speed Mode
              </h1>
              
              <p className="text-xl text-[var(--color-text-muted)]">
                ACLS/PALS Rapid-Fire Challenge
              </p>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Timer className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">5 Seconds Per Question</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Think fast! Each question must be answered within 5 seconds.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">ACLS & PALS Focus</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Emergency cardiac protocols and pediatric advanced life support.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">High-Pressure Training</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Simulate real emergency scenarios under time pressure.
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-5 h-5" />
                Start Code Blue Drill
              </motion.button>

              <button
                onClick={onExit}
                className="w-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] py-2 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Complete page
  if (viewState === 'complete') {
    const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex items-center justify-center p-6"
        >
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-4">
              <Trophy className="w-20 h-20 text-red-500 mx-auto" />
              
              <h1 className="text-4xl font-bold">
                Code Blue Complete!
              </h1>
              
              <p className="text-xl text-[var(--color-text-muted)]">
                Final Results
              </p>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="text-6xl font-bold text-red-500">
                  {accuracy}%
                </div>
                <div className="text-lg text-[var(--color-text-muted)]">
                  {score.correct} correct out of {score.total}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{score.correct}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
                </div>
                <div className="bg-[var(--color-bg-primary)] rounded-lg p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{score.total - score.correct}</div>
                  <div className="text-sm text-[var(--color-text-muted)]">Missed</div>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRestart}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                  Try Again
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onExit}
                  className="flex-1 bg-[var(--color-bg-primary)] hover:bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Exit
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active drill page
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isCorrect = selectedAnswer === currentQuestion.correctIndex;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Siren className="w-6 h-6 text-red-500" />
              <div>
                <div className="font-semibold">Code Blue Speed</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-[var(--color-text-muted)]">Score</div>
              <div className="text-xl font-bold text-red-500">
                {score.correct}/{score.total}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="bg-red-500 h-2 rounded-full"
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center gap-2">
            <Timer className={`w-5 h-5 ${timeLeft <= 2 ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`} />
            <motion.div
              animate={{ 
                scale: timeLeft <= 2 ? [1, 1.1, 1] : 1,
                color: timeLeft <= 2 ? '#ef4444' : undefined
              }}
              transition={{ repeat: timeLeft <= 2 ? Infinity : 0, duration: 0.5 }}
              className={`text-2xl font-bold ${timeLeft <= 2 ? 'text-red-500' : ''}`}
            >
              {timeLeft}s
            </motion.div>
          </div>
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Category badge */}
            <div className="inline-flex items-center px-3 py-1 bg-red-500/10 text-red-500 text-sm font-medium rounded-full">
              {currentQuestion.category}
            </div>

            {/* Question */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6">
              <h2 className="text-xl font-semibold leading-relaxed">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const showResult = isSubmitted;
                const isThisCorrect = index === currentQuestion.correctIndex;

                return (
                  <motion.button
                    key={index}
                    whileHover={!isSubmitted ? { scale: 1.01 } : {}}
                    whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={isSubmitted}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      showResult
                        ? isThisCorrect
                          ? 'bg-green-500/10 border-green-500 text-green-500'
                          : isSelected
                          ? 'bg-red-500/10 border-red-500 text-red-500'
                          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] opacity-50'
                        : isSelected
                        ? 'bg-red-500/10 border-red-500'
                        : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-red-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex-1">{option}</span>
                      {showResult && isThisCorrect && (
                        <CheckCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                      )}
                      {showResult && isSelected && !isThisCorrect && (
                        <XCircle className="w-5 h-5 ml-2 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation (shown after submission) */}
            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg ${
                  isCorrect
                    ? 'bg-green-500/10 border-2 border-green-500/50'
                    : 'bg-red-500/10 border-2 border-red-500/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className={`font-semibold mb-1 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                      {isTimeUp ? 'Time\'s Up!' : isCorrect ? 'Correct!' : 'Incorrect'}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {!isSubmitted ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={selectedAnswer === null}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
                    selectedAnswer === null
                      ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  Submit Answer
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CodeBlueSpeedMode;
