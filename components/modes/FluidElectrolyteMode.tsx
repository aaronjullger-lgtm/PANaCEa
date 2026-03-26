import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  X,
  CheckCircle,
  XCircle,
  Droplets,
  ArrowRight,
  RotateCcw,
  Play,
  FlaskConical,
  BarChart2,
  Droplet,
  Calculator,
  AlertCircle,
} from 'lucide-react';
import type { FluidElectrolyteCase } from '@/types/drill-modes';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { MiniModeLayout, MiniModeHeader, MiniModeCard } from './MiniModeLayout';
import { useTheme } from '@/hooks/useTheme';
import { submitDrillResult } from '@/services/core';

interface FluidElectrolyteModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'loading' | 'active' | 'error';

/**
 * Urine Chemistry Reference Table (static reference data)
 */
const URINE_CHEMISTRY_REFERENCE = {
  reference: [
    {
      parameter: 'Sodium (Na)',
      normalRange: '40-220',
      unit: 'mEq/L',
      interpretation: 'Varies with dietary intake',
    },
    {
      parameter: 'Potassium (K)',
      normalRange: '25-125',
      unit: 'mEq/L',
      interpretation: 'Reflects dietary intake',
    },
    {
      parameter: 'Chloride (Cl)',
      normalRange: '110-250',
      unit: 'mEq/L',
    },
    {
      parameter: 'Creatinine',
      normalRange: '20-320',
      unit: 'mg/dL',
      interpretation: 'Used in FENa calculation',
    },
    {
      parameter: 'Osmolality',
      normalRange: '50-1200',
      unit: 'mOsm/kg',
      interpretation: 'Reflects concentrating ability',
    },
    {
      parameter: 'Specific Gravity',
      normalRange: '1.002-1.030',
      unit: '',
      interpretation: 'Correlates with osmolality',
    },
  ],
};

/**
 * Validate numeric answer with margin of error
 */
const validateNumericAnswer = (
  userAnswer: number,
  correctAnswer: number,
  marginOfError: number
): { isCorrect: boolean; difference: number } => {
  const difference = Math.abs(userAnswer - correctAnswer);
  return {
    isCorrect: difference <= marginOfError,
    difference,
  };
};

/**
 * Fetch random fluid case from database API
 */
const fetchFluidCase = async (): Promise<FluidElectrolyteCase | null> => {
  try {
    const response = await fetch('/api/drills/fluids?count=1');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = (await response.json()) as { cases?: FluidElectrolyteCase[] };
    if (!data.cases || data.cases.length === 0) {
      throw new Error('No cases returned from API');
    }
    return data.cases[0] ?? null;
  } catch (error) {
    console.error('Failed to fetch fluid case:', error);
    return null;
  }
};

const FluidElectrolyteMode: React.FC<FluidElectrolyteModeProps> = ({ onExit }) => {
  const { getToken } = useAuth();
  const [theme] = useTheme();
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [currentCase, setCurrentCase] = useState<FluidElectrolyteCase | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Theme styling (semantic tokens only)
  const containerText = theme === 'dark' ? 'text-data-neutral' : 'text-data-neutral';
  const subtleText = theme === 'dark' ? 'text-data-neutral' : 'text-data-neutral';
  const accentBg = 'bg-data-neutral';
  const accentText = 'text-data-neutral';

  const handleStart = async () => {
    setViewState('loading');
    setError(null);

    const fluidCase = await fetchFluidCase();

    if (!fluidCase) {
      setError('Failed to load fluid case. Please try again.');
      setViewState('error');
      return;
    }

    setCurrentCase(fluidCase);
    setViewState('active');
  };

  const handleSubmit = () => {
    if (!currentCase) return;

    const numericAnswer = parseFloat(userAnswer);

    if (isNaN(numericAnswer)) {
      setFeedback('Please enter a valid number.');
      return;
    }

    const validation = validateNumericAnswer(
      numericAnswer,
      currentCase.correctAnswer,
      currentCase.marginOfError
    );

    setIsSubmitted(true);
    setIsCorrect(validation.isCorrect);
    setScore((prev) => ({
      correct: prev.correct + (validation.isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    // Trigger haptic feedback
    if (validation.isCorrect) {
      hapticSuccess();
      setFeedback(
        `Correct! Your answer of ${numericAnswer} ${currentCase.unit} is within the acceptable range.`
      );
    } else {
      hapticError();
      setFeedback(
        `Your answer of ${numericAnswer} ${currentCase.unit} is outside the acceptable range. ` +
          `The correct answer is ${currentCase.correctAnswer} ${currentCase.unit} (±${currentCase.marginOfError}).`
      );
    }

    // Submit result to backend
    submitDrillResult(
      'fluid',
      currentCase.id,
      validation.isCorrect,
      { title: currentCase.title, category: currentCase.category },
      getToken
    );
  };

  const handleNext = async () => {
    setViewState('loading');
    setUserAnswer('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setFeedback('');
    setError(null);

    const fluidCase = await fetchFluidCase();

    if (!fluidCase) {
      setError('Failed to load next case. Please try again.');
      setViewState('error');
      return;
    }

    setCurrentCase(fluidCase);
    setViewState('active');
  };

  const handleReset = () => {
    setScore({ correct: 0, total: 0 });
    handleNext();
  };

  // Landing Page - Clinical White/Navy Theme
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-data-neutral dark:text-data-neutral transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-data-neutral dark:border-data-neutral bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-data-neutral dark:bg-data-neutral flex items-center justify-center shadow-sm">
                <Droplets className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Hydro-Mode</h1>
                <p className="text-sm text-data-neutral dark:text-data-neutral">
                  Fluid & Electrolyte Management
                </p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral dark:bg-data-neutral dark:hover:bg-data-neutral transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12">
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="space-y-8"
          >
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold text-data-neutral dark:text-data-neutral">
                Master Fluid & Electrolyte Calculations
              </h2>
              <p className="text-xl text-data-neutral dark:text-data-neutral">
                Practice real-world clinical calculations with instant feedback
              </p>
            </div>

            {/* Features Card */}
            <div className="bg-[var(--color-bg-primary)] rounded-2xl p-8 border border-data-neutral dark:border-data-neutral shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-data-neutral dark:text-data-neutral mb-6">
                What You'll Practice
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'FENa Calculations',
                    desc: 'Fractional excretion of sodium for AKI workup',
                    Icon: FlaskConical,
                  },
                  { title: 'Anion Gap', desc: 'Acid-base disorder assessment', Icon: BarChart2 },
                  {
                    title: 'Maintenance Fluids',
                    desc: '4-2-1 rule and pediatric calculations',
                    Icon: Droplet,
                  },
                  {
                    title: 'Free Water Deficit',
                    desc: 'Hypernatremia management',
                    Icon: Calculator,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-data-neutral dark:bg-data-neutral rounded-xl p-4 border border-data-neutral dark:border-data-neutral"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <item.Icon className="w-6 h-6 text-[var(--color-accent)]" />
                      <h4 className="font-semibold text-data-neutral dark:text-data-neutral">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-sm text-data-neutral dark:text-data-neutral">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--color-accent)]/5 rounded-xl p-6 border border-[var(--color-accent)]/30">
                <p className="text-sm text-data-neutral dark:text-data-neutral font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[var(--color-accent)]" />
                  Key Features
                </p>
                <ul className="text-sm text-data-neutral dark:text-data-neutral space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Clinical vignettes with realistic lab values</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Formula hints provided for each calculation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Comprehensive urine chemistry reference table</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Reasonable margin of error for numeric answers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Detailed explanations and teaching points</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center">
              <motion.button
                onClick={handleStart}
                disabled={(viewState as string) === 'loading'}
                className="px-10 py-4 bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] hover:opacity-90
                         disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg
                         transition-all flex items-center justify-center gap-3 mx-auto shadow-lg hover:shadow-xl"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {(viewState as string) === 'loading' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading Case...
                  </>
                ) : (
                  <>
                    Start Practice
                    <Play className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Loading State
  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-data-neutral dark:text-data-neutral flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium text-data-neutral dark:text-data-neutral">Loading case...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-data-neutral dark:text-data-neutral">
        {/* Header */}
        <div className="border-b border-data-neutral dark:border-data-neutral bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-data-neutral dark:bg-data-neutral flex items-center justify-center shadow-sm">
                <Droplets className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Hydro-Mode</h1>
                <p className="text-sm text-data-neutral dark:text-data-neutral">
                  Fluid & Electrolyte Management
                </p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral dark:bg-data-neutral dark:hover:bg-data-neutral transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        <div className="max-w-2xl mx-auto px-4 py-16">
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="bg-data-fail dark:bg-data-fail/30 rounded-2xl p-8 border border-data-fail dark:border-data-fail text-center"
          >
            <AlertCircle className="w-16 h-16 text-data-fail dark:text-data-fail mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-data-fail dark:text-data-fail mb-2">
              Error Loading Case
            </h2>
            <p className="text-data-neutral dark:text-data-neutral mb-6">
              {error || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleStart}
                className="px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white rounded-lg font-semibold transition-colors"
              >
                Try Again
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="px-6 py-3 bg-data-neutral hover:bg-data-neutral dark:bg-data-neutral dark:hover:bg-data-neutral 
                           text-data-neutral dark:text-data-neutral rounded-lg font-semibold transition-colors"
                >
                  Exit
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active Session - White Theme Variant
  if (!currentCase) return null;

  return (
    <div className="min-h-screen bg-data-neutral dark:bg-data-neutral text-data-neutral dark:text-data-neutral">
      {/* Header */}
      <div className="border-b border-data-neutral dark:border-data-neutral bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-data-neutral dark:bg-data-neutral flex items-center justify-center shadow-sm">
              <Droplets className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Hydro-Mode</h1>
              <p className="text-sm text-data-neutral dark:text-data-neutral">
                Fluid & Electrolyte Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-data-neutral dark:text-data-neutral">Score</p>
              <p className="text-xl font-bold text-data-neutral dark:text-data-neutral">
                {score.correct}/{score.total}
                {score.total > 0 && (
                  <span className="text-sm ml-2 text-[var(--color-accent)]">
                    ({Math.round((score.correct / score.total) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral dark:bg-data-neutral dark:hover:bg-data-neutral transition-colors"
              title="Reset Score"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral dark:bg-data-neutral dark:hover:bg-data-neutral transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Side: Clinical Vignette + Labs */}
          <motion.div
            initial={{ x: -20 }}
            animate={{ x: 0 }}
            className="space-y-4"
          >
            {/* Clinical Vignette */}
            <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 border border-data-neutral dark:border-data-neutral shadow-md">
              <h2 className="text-xl font-semibold mb-3 text-[var(--color-accent)]">
                {currentCase.title}
              </h2>
              <p className="text-data-neutral dark:text-data-neutral leading-relaxed">
                {currentCase.vignette}
              </p>
            </div>

            {/* Labs */}
            <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 border border-data-neutral dark:border-data-neutral shadow-md">
              <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">
                Laboratory Results
              </h3>

              {currentCase.labs.bmp && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-data-neutral dark:text-data-neutral mb-2">
                    Basic Metabolic Panel
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                      <span className="text-data-neutral dark:text-data-neutral">Sodium:</span>
                      <span className="font-mono text-data-neutral dark:text-data-neutral">
                        {currentCase.labs.bmp.sodium} mEq/L
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                      <span className="text-data-neutral dark:text-data-neutral">Potassium:</span>
                      <span className="font-mono text-data-neutral dark:text-data-neutral">
                        {currentCase.labs.bmp.potassium} mEq/L
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                      <span className="text-data-neutral dark:text-data-neutral">Chloride:</span>
                      <span className="font-mono text-data-neutral dark:text-data-neutral">
                        {currentCase.labs.bmp.chloride} mEq/L
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                      <span className="text-data-neutral dark:text-data-neutral">HCO₃:</span>
                      <span className="font-mono text-data-neutral dark:text-data-neutral">
                        {currentCase.labs.bmp.bicarbonate} mEq/L
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                      <span className="text-data-neutral dark:text-data-neutral">BUN:</span>
                      <span className="font-mono text-data-neutral dark:text-data-neutral">
                        {currentCase.labs.bmp.bun} mg/dL
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                      <span className="text-data-neutral dark:text-data-neutral">Creatinine:</span>
                      <span className="font-mono text-data-neutral dark:text-data-neutral">
                        {currentCase.labs.bmp.creatinine} mg/dL
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                      <span className="text-data-neutral dark:text-data-neutral">Glucose:</span>
                      <span className="font-mono text-data-neutral dark:text-data-neutral">
                        {currentCase.labs.bmp.glucose} mg/dL
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(currentCase.labs.urineNa || currentCase.labs.urineCr) && (
                <div>
                  <h4 className="text-sm font-semibold text-data-neutral dark:text-data-neutral mb-2">
                    Urine Studies
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {currentCase.labs.urineNa && (
                      <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                        <span className="text-data-neutral dark:text-data-neutral">Urine Na:</span>
                        <span className="font-mono text-data-neutral dark:text-data-neutral">
                          {currentCase.labs.urineNa} mEq/L
                        </span>
                      </div>
                    )}
                    {currentCase.labs.urineCr && (
                      <div className="flex justify-between p-2 bg-data-neutral dark:bg-data-neutral rounded border border-data-neutral dark:border-data-neutral">
                        <span className="text-data-neutral dark:text-data-neutral">Urine Cr:</span>
                        <span className="font-mono text-data-neutral dark:text-data-neutral">
                          {currentCase.labs.urineCr} mg/dL
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Question */}
            <div className="bg-[var(--color-accent)]/5 rounded-xl p-6 border border-[var(--color-accent)]/30 shadow-md">
              <h3 className="text-lg font-semibold mb-2 text-[var(--color-accent)]">
                Question
              </h3>
              <p className="text-data-neutral dark:text-data-neutral mb-4 font-medium">
                {currentCase.question}
              </p>

              {currentCase.calculationHint && (
                <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 mb-4 border border-data-neutral dark:border-data-neutral">
                  <p className="text-xs font-semibold text-data-neutral dark:text-data-neutral mb-1">
                    Formula Hint:
                  </p>
                  <p className="text-sm text-data-neutral dark:text-data-neutral font-mono">
                    {currentCase.calculationHint}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  id="fluid-electrolyte-answer"
                  name="fluid-electrolyte-answer"
                  type="number"
                  step="any"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isSubmitted && handleSubmit()}
                  placeholder="Enter your answer"
                  disabled={isSubmitted}
                  autoComplete="off"
                  className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-data-neutral dark:border-data-neutral rounded-lg 
                           text-data-neutral dark:text-data-neutral placeholder-data-neutral dark:placeholder-data-neutral 
                           focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed font-mono text-lg shadow-sm"
                />
                <div className="flex items-center px-3 bg-[var(--color-bg-primary)] border border-data-neutral dark:border-data-neutral rounded-lg text-data-neutral dark:text-data-neutral shadow-sm">
                  {currentCase.unit}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {!isSubmitted ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!userAnswer}
                    className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 disabled:bg-data-neutral dark:disabled:bg-data-neutral 
                             disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                             transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    Submit Answer
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] hover:opacity-90 py-3 rounded-lg font-semibold
                             transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    Next Case
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {isSubmitted && (
                <motion.div
                  initial={{ y: -10 }}
                  animate={{ y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-xl p-6 border shadow-md ${
                    isCorrect
                      ? 'bg-data-pass border-data-pass dark:bg-data-pass/30 dark:border-data-pass'
                      : 'bg-data-fail border-data-fail dark:bg-data-fail/30 dark:border-data-fail'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-data-pass dark:text-data-pass flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="w-6 h-6 text-data-fail dark:text-data-fail flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`font-semibold mb-2 ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
                      >
                        {feedback}
                      </p>
                      <p className="text-data-neutral dark:text-data-neutral text-sm leading-relaxed">
                        {currentCase.explanation}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right Side: Urine Chemistry Reference */}
          <motion.div
            initial={{ x: 20 }}
            animate={{ x: 0 }}
            className="bg-[var(--color-bg-primary)] rounded-xl p-6 border border-data-neutral dark:border-data-neutral shadow-md"
          >
            <h3 className="text-xl font-semibold mb-4 text-[var(--color-accent)]">
              Urine Chemistry Reference
            </h3>
            <div className="space-y-3">
              {URINE_CHEMISTRY_REFERENCE.reference.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-data-neutral dark:bg-data-neutral rounded-lg border border-data-neutral dark:border-data-neutral"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-data-neutral dark:text-data-neutral">
                      {item.parameter}
                    </h4>
                    <span className="text-[var(--color-accent)] font-mono text-sm">
                      {item.unit}
                    </span>
                  </div>
                  <p className="text-data-neutral dark:text-data-neutral text-sm mb-1">
                    Normal:{' '}
                    <span className="font-mono text-data-neutral dark:text-data-neutral">
                      {item.normalRange}
                    </span>
                  </p>
                  {item.interpretation && (
                    <p className="text-data-neutral dark:text-data-neutral text-xs italic">
                      {item.interpretation}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Additional Calculation Tips */}
            <div className="mt-6 p-4 bg-[var(--color-accent)]/5 rounded-lg border border-[var(--color-accent)]/30">
              <h4 className="font-semibold text-[var(--color-accent)] mb-3">
                Common Calculations
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-data-neutral dark:text-data-neutral mb-1">FENa:</p>
                  <p className="font-mono text-xs text-data-neutral dark:text-data-neutral">
                    [(UNa × SCr) / (SNa × UCr)] × 100
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-data-neutral dark:text-data-neutral mb-1">Anion Gap:</p>
                  <p className="font-mono text-xs text-data-neutral dark:text-data-neutral">
                    Na - (Cl + HCO₃)
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-data-neutral dark:text-data-neutral mb-1">
                    Free Water Deficit:
                  </p>
                  <p className="font-mono text-xs text-data-neutral dark:text-data-neutral">
                    TBW × [(Na/140) - 1]
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FluidElectrolyteMode;
