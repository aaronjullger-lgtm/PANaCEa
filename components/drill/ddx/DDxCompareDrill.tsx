import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A symptom/finding card with its correct association and explanation.
 */
interface SymptomCard {
  id: string;
  symptom: string;
  /** 'A' for Condition A (Crohn's), 'B' for Condition B (UC) */
  correctAnswer: 'A' | 'B';
  explanation: string;
}

/**
 * Mock data: Crohn's Disease vs Ulcerative Colitis differential.
 * Each card represents a symptom/finding that belongs to one condition.
 */
const CROHNS_VS_UC_CARDS: SymptomCard[] = [
  {
    id: '1',
    symptom: 'Transmural inflammation',
    correctAnswer: 'A',
    explanation: 'Transmural inflammation (full thickness) is characteristic of Crohn\'s. UC only affects the mucosa.',
  },
  {
    id: '2',
    symptom: 'Mucosal inflammation only',
    correctAnswer: 'B',
    explanation: 'UC is limited to the mucosa and submucosa. Crohn\'s affects all layers.',
  },
  {
    id: '3',
    symptom: 'Skip lesions',
    correctAnswer: 'A',
    explanation: 'Skip lesions (patchy involvement with normal bowel in between) are typical of Crohn\'s disease.',
  },
  {
    id: '4',
    symptom: 'Continuous inflammation from rectum',
    correctAnswer: 'B',
    explanation: 'UC always involves the rectum and spreads proximally in a continuous pattern.',
  },
  {
    id: '5',
    symptom: 'Cobblestone appearance',
    correctAnswer: 'A',
    explanation: 'The cobblestone mucosa pattern is classic for Crohn\'s disease.',
  },
  {
    id: '6',
    symptom: 'Pseudopolyps',
    correctAnswer: 'B',
    explanation: 'Pseudopolyps (inflammatory polyps) are more characteristic of UC.',
  },
  {
    id: '7',
    symptom: 'Perianal disease (fistulas, abscesses)',
    correctAnswer: 'A',
    explanation: 'Perianal complications like fistulas and abscesses are common in Crohn\'s, rare in UC.',
  },
  {
    id: '8',
    symptom: 'Toxic megacolon risk',
    correctAnswer: 'B',
    explanation: 'Toxic megacolon is a serious complication more associated with UC.',
  },
  {
    id: '9',
    symptom: 'Granulomas on biopsy',
    correctAnswer: 'A',
    explanation: 'Non-caseating granulomas are pathognomonic for Crohn\'s disease.',
  },
  {
    id: '10',
    symptom: 'Crypt abscesses',
    correctAnswer: 'B',
    explanation: 'Crypt abscesses are more commonly seen in UC, though not specific.',
  },
  {
    id: '11',
    symptom: 'Terminal ileum involvement',
    correctAnswer: 'A',
    explanation: 'Terminal ileitis is very common in Crohn\'s disease. UC does not typically affect the ileum.',
  },
  {
    id: '12',
    symptom: 'Bloody diarrhea',
    correctAnswer: 'B',
    explanation: 'Bloody diarrhea is the hallmark of UC. Crohn\'s may have diarrhea but less commonly bloody.',
  },
  {
    id: '13',
    symptom: 'String sign on imaging',
    correctAnswer: 'A',
    explanation: 'The "string sign" (narrow terminal ileum) is seen in Crohn\'s disease.',
  },
  {
    id: '14',
    symptom: 'Lead pipe colon on imaging',
    correctAnswer: 'B',
    explanation: 'The "lead pipe" appearance (loss of haustra) is characteristic of chronic UC.',
  },
];

interface DDxCompareDrillProps {
  onExit?: () => void;
}

type DrillStatus = 'playing' | 'feedback';

/**
 * DDxCompareDrill - "Tug of War" style drill for differentiating conditions.
 * 
 * Split-screen layout with Condition A on the left and Condition B on the right.
 * Symptom cards appear in the center and users click left or right to assign.
 */
const DDxCompareDrill: React.FC<DDxCompareDrillProps> = ({ onExit }) => {
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [status, setStatus] = useState<DrillStatus>('playing');
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [userChoice, setUserChoice] = useState<'A' | 'B' | null>(null);
  const [score, setScore] = useState<number>(0);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [shuffledCards, setShuffledCards] = useState<SymptomCard[]>([]);

  // Condition metadata
  const conditionA = {
    name: "Crohn's Disease",
    color: 'blue',
    bgClass: 'bg-blue-900/50',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-400',
    hoverClass: 'hover:bg-blue-800/70',
    activeClass: 'bg-blue-700',
  };

  const conditionB = {
    name: 'Ulcerative Colitis',
    color: 'red',
    bgClass: 'bg-red-900/50',
    borderClass: 'border-red-500',
    textClass: 'text-red-400',
    hoverClass: 'hover:bg-red-800/70',
    activeClass: 'bg-red-700',
  };

  // Shuffle cards on mount
  useEffect(() => {
    const shuffled = [...CROHNS_VS_UC_CARDS].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
  }, []);

  const currentCard = useMemo(() => {
    return shuffledCards[currentCardIndex] || null;
  }, [shuffledCards, currentCardIndex]);

  const handleChoice = useCallback((choice: 'A' | 'B') => {
    if (!currentCard || status === 'feedback') return;

    const correct = choice === currentCard.correctAnswer;
    setUserChoice(choice);
    setIsCorrect(correct);
    setStatus('feedback');
    setTotalAttempts((prev) => prev + 1);

    if (correct) {
      setScore((prev) => prev + 1);
    }
  }, [currentCard, status]);

  const handleNext = useCallback(() => {
    if (currentCardIndex < shuffledCards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setStatus('playing');
      setUserChoice(null);
    } else {
      // Reset and reshuffle when all cards are done
      const reshuffled = [...CROHNS_VS_UC_CARDS].sort(() => Math.random() - 0.5);
      setShuffledCards(reshuffled);
      setCurrentCardIndex(0);
      setStatus('playing');
      setUserChoice(null);
    }
  }, [currentCardIndex, shuffledCards.length]);

  const handleReset = useCallback(() => {
    const reshuffled = [...CROHNS_VS_UC_CARDS].sort(() => Math.random() - 0.5);
    setShuffledCards(reshuffled);
    setCurrentCardIndex(0);
    setScore(0);
    setTotalAttempts(0);
    setStatus('playing');
    setUserChoice(null);
  }, []);

  const handleExit = () => {
    if (onExit) {
      onExit();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status === 'playing') {
        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
          e.preventDefault();
          handleChoice('A');
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'b') {
          e.preventDefault();
          handleChoice('B');
        }
      } else if (status === 'feedback') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [status, handleChoice, handleNext]);

  // Animation variants
  const cardVariants = {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -50, scale: 0.9 },
    // Swipe animations for left/right choices
    left: { x: -200, opacity: 0, rotate: -15 },
    right: { x: 200, opacity: 0, rotate: 15 },
  };

  const feedbackVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  if (shuffledCards.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/50">
        <button
          onClick={handleExit}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Exit"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <h1 className="text-lg font-semibold text-slate-200">DDx Compare</h1>

        <div className="flex items-center gap-4">
          {/* Score */}
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-500">
              {score}/{totalAttempts}
            </span>
          </div>

          {/* Progress */}
          <div className="text-sm text-slate-400">
            {currentCardIndex + 1}/{shuffledCards.length}
          </div>
        </div>
      </header>

      {/* Main Split Screen Layout */}
      <div className="flex-1 flex pt-14">
        {/* Left Side - Condition A (Crohn's) */}
        <button
          onClick={() => handleChoice('A')}
          disabled={status === 'feedback'}
          className={`
            flex-1 flex flex-col items-center justify-center p-6 transition-all duration-200
            ${conditionA.bgClass} ${conditionA.borderClass} border-r-2
            ${status === 'playing' ? conditionA.hoverClass + ' cursor-pointer' : ''}
            ${status === 'feedback' && userChoice === 'A' 
              ? (isCorrect ? 'bg-emerald-900/50 border-emerald-500' : 'bg-red-900/50 border-red-500') 
              : ''}
            disabled:cursor-default
          `}
          aria-label={`Select ${conditionA.name}`}
        >
          <ChevronLeft className={`w-12 h-12 ${conditionA.textClass} mb-4 opacity-60`} />
          <h2 className={`text-2xl sm:text-3xl font-bold ${conditionA.textClass}`}>
            {conditionA.name}
          </h2>
          <p className="text-sm text-slate-400 mt-2 hidden sm:block">
            Press ← or A
          </p>
          
          {/* Checkmark/X indicator */}
          {status === 'feedback' && currentCard?.correctAnswer === 'A' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute bottom-8 text-6xl"
            >
              ✓
            </motion.div>
          )}
        </button>

        {/* Right Side - Condition B (UC) */}
        <button
          onClick={() => handleChoice('B')}
          disabled={status === 'feedback'}
          className={`
            flex-1 flex flex-col items-center justify-center p-6 transition-all duration-200
            ${conditionB.bgClass} ${conditionB.borderClass} border-l-2
            ${status === 'playing' ? conditionB.hoverClass + ' cursor-pointer' : ''}
            ${status === 'feedback' && userChoice === 'B' 
              ? (isCorrect ? 'bg-emerald-900/50 border-emerald-500' : 'bg-red-900/50 border-red-500') 
              : ''}
            disabled:cursor-default
          `}
          aria-label={`Select ${conditionB.name}`}
        >
          <ChevronRight className={`w-12 h-12 ${conditionB.textClass} mb-4 opacity-60`} />
          <h2 className={`text-2xl sm:text-3xl font-bold ${conditionB.textClass}`}>
            {conditionB.name}
          </h2>
          <p className="text-sm text-slate-400 mt-2 hidden sm:block">
            Press → or B
          </p>
          
          {/* Checkmark indicator */}
          {status === 'feedback' && currentCard?.correctAnswer === 'B' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute bottom-8 text-6xl"
            >
              ✓
            </motion.div>
          )}
        </button>
      </div>

      {/* Center Card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <AnimatePresence mode="wait">
          {currentCard && (
            <motion.div
              key={currentCard.id}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit={userChoice === 'A' ? 'left' : userChoice === 'B' ? 'right' : 'exit'}
              transition={{ duration: 0.3 }}
              className={`
                pointer-events-auto max-w-md w-[90%] p-6 rounded-2xl shadow-2xl
                ${status === 'playing' 
                  ? 'bg-slate-800 border border-slate-700' 
                  : isCorrect 
                    ? 'bg-emerald-900 border border-emerald-600' 
                    : 'bg-red-900 border border-red-600'}
              `}
            >
              <p className="text-xl sm:text-2xl font-semibold text-center text-slate-100 mb-4">
                {currentCard.symptom}
              </p>

              {/* Feedback/Explanation */}
              <AnimatePresence>
                {status === 'feedback' && (
                  <motion.div
                    variants={feedbackVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="mt-4 pt-4 border-t border-slate-600"
                  >
                    <p className={`text-center font-bold mb-2 ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </p>
                    <p className="text-sm text-slate-300 text-center">
                      {currentCard.explanation}
                    </p>
                    <button
                      onClick={handleNext}
                      className="mt-4 w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors"
                    >
                      {currentCardIndex < shuffledCards.length - 1 ? 'Next Card' : 'Start Over'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset button */}
      <button
        onClick={handleReset}
        className="fixed bottom-4 right-4 p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-200 transition-colors shadow-lg z-20"
        aria-label="Reset session"
        title="Reset session"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
    </div>
  );
};

export default DDxCompareDrill;
