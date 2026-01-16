import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { X, CheckCircle, XCircle, Droplets, ArrowRight, RotateCcw, Play, FlaskConical, BarChart2, Droplet, Calculator, AlertCircle } from 'lucide-react';
import type { FluidElectrolyteCase } from '@/types/drill-modes';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { MiniModeLayout, MiniModeHeader, MiniModeCard } from './MiniModeLayout';
import { useTheme } from '@/hooks/useTheme';
import { submitDrillResult } from '@/services/drillService';

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
      interpretation: 'Varies with dietary intake'
    },
    {
      parameter: 'Potassium (K)',
      normalRange: '25-125',
      unit: 'mEq/L',
      interpretation: 'Reflects dietary intake'
    },
    {
      parameter: 'Chloride (Cl)',
      normalRange: '110-250',
      unit: 'mEq/L'
    },
    {
      parameter: 'Creatinine',
      normalRange: '20-320',
      unit: 'mg/dL',
      interpretation: 'Used in FENa calculation'
    },
    {
      parameter: 'Osmolality',
      normalRange: '50-1200',
      unit: 'mOsm/kg',
      interpretation: 'Reflects concentrating ability'
    },
    {
      parameter: 'Specific Gravity',
      normalRange: '1.002-1.030',
      unit: '',
      interpretation: 'Correlates with osmolality'
    }
  ]
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
    const data = await response.json();
    if (!data.cases || data.cases.length === 0) {
      throw new Error('No cases returned from API');
    }
    return data.cases[0];
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
  
  // Theme styling
  const containerText = theme === 'dark' ? 'text-[#101729]' : 'text-[#E9ECF1]';
  const subtleText = theme === 'dark' ? 'text-[#364154]' : 'text-[#cbd5e1]';
  const accentBg = 'bg-[#364154]';
  const accentText = 'text-[#E9ECF1]';

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
    setScore(prev => ({
      correct: prev.correct + (validation.isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    // Trigger haptic feedback
    if (validation.isCorrect) {
      hapticSuccess();
      setFeedback(`Correct! Your answer of ${numericAnswer} ${currentCase.unit} is within the acceptable range.`);
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
      <div className="min-h-screen bg-white dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1] transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1F283A] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E9ECF1] dark:bg-[#364154] flex items-center justify-center shadow-sm">
                <Droplets className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Hydro-Mode</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Fluid & Electrolyte Management</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#364154] dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">Master Fluid & Electrolyte Calculations</h2>
              <p className="text-xl text-[#364154] dark:text-[#cbd5e1]">
                Practice real-world clinical calculations with instant feedback
              </p>
            </div>

            {/* Features Card */}
            <div className="bg-white dark:bg-[#364154] rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-6">What You'll Practice</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: 'FENa Calculations', desc: 'Fractional excretion of sodium for AKI workup', Icon: FlaskConical },
                  { title: 'Anion Gap', desc: 'Acid-base disorder assessment', Icon: BarChart2 },
                  { title: 'Maintenance Fluids', desc: '4-2-1 rule and pediatric calculations', Icon: Droplet },
                  { title: 'Free Water Deficit', desc: 'Hypernatremia management', Icon: Calculator },
                ].map((item, i) => (
                  <div key={i} className="bg-[#E9ECF1] dark:bg-[#1F283A] rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                      <item.Icon className="w-6 h-6 text-[var(--color-accent)]" />
                      <h4 className="font-semibold text-[#1F283A] dark:text-[#E9ECF1]">{item.title}</h4>
                    </div>
                    <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-xl p-6 border border-cyan-200 dark:border-cyan-900">
                <p className="text-sm text-[#1F283A] dark:text-[#E9ECF1] font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Key Features
                </p>
                <ul className="text-sm text-[#364154] dark:text-[#cbd5e1] space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-600 dark:text-cyan-400 mt-0.5">•</span>
                    <span>Clinical vignettes with realistic lab values</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-600 dark:text-cyan-400 mt-0.5">•</span>
                    <span>Formula hints provided for each calculation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-600 dark:text-cyan-400 mt-0.5">•</span>
                    <span>Comprehensive urine chemistry reference table</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-600 dark:text-cyan-400 mt-0.5">•</span>
                    <span>Reasonable margin of error for numeric answers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-600 dark:text-cyan-400 mt-0.5">•</span>
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
                className="px-10 py-4 bg-[#1F283A] text-[#E9ECF1] dark:bg-[#E9ECF1] dark:text-[#1F283A] hover:bg-[#364154] dark:hover:bg-white
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
      <div className="min-h-screen bg-white dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-cyan-200 dark:border-cyan-900 border-t-cyan-600 dark:border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium text-[#364154] dark:text-[#cbd5e1]">Loading case...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1]">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1F283A] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E9ECF1] dark:bg-[#364154] flex items-center justify-center shadow-sm">
                <Droplets className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Hydro-Mode</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Fluid & Electrolyte Management</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#364154] dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        <div className="max-w-2xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-8 border border-red-200 dark:border-red-900 text-center"
          >
            <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">Error Loading Case</h2>
            <p className="text-[#364154] dark:text-[#cbd5e1] mb-6">
              {error || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleStart}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
              >
                Try Again
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 
                           text-[#1F283A] dark:text-[#E9ECF1] rounded-lg font-semibold transition-colors"
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1]">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#364154] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E9ECF1] dark:bg-[#1F283A] flex items-center justify-center shadow-sm">
              <Droplets className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Hydro-Mode</h1>
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Fluid & Electrolyte Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Score</p>
              <p className="text-xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">
                {score.correct}/{score.total}
                {score.total > 0 && (
                  <span className="text-sm ml-2 text-cyan-600 dark:text-cyan-400">
                    ({Math.round((score.correct / score.total) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1F283A] dark:hover:bg-slate-700 transition-colors"
              title="Reset Score"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1F283A] dark:hover:bg-slate-700 transition-colors"
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
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Clinical Vignette */}
            <div className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md">
              <h2 className="text-xl font-semibold mb-3 text-cyan-600 dark:text-cyan-400">
                {currentCase.title}
              </h2>
              <p className="text-[#364154] dark:text-[#cbd5e1] leading-relaxed">
                {currentCase.vignette}
              </p>
            </div>

            {/* Labs */}
            <div className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md">
              <h3 className="text-lg font-semibold mb-4 text-cyan-600 dark:text-cyan-400">Laboratory Results</h3>
              
              {currentCase.labs.bmp && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[#364154] dark:text-[#cbd5e1] mb-2">Basic Metabolic Panel</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[#364154] dark:text-[#cbd5e1]">Sodium:</span>
                      <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.bmp.sodium} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[#364154] dark:text-[#cbd5e1]">Potassium:</span>
                      <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.bmp.potassium} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[#364154] dark:text-[#cbd5e1]">Chloride:</span>
                      <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.bmp.chloride} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[#364154] dark:text-[#cbd5e1]">HCO₃:</span>
                      <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.bmp.bicarbonate} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[#364154] dark:text-[#cbd5e1]">BUN:</span>
                      <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.bmp.bun} mg/dL</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[#364154] dark:text-[#cbd5e1]">Creatinine:</span>
                      <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.bmp.creatinine} mg/dL</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[#364154] dark:text-[#cbd5e1]">Glucose:</span>
                      <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.bmp.glucose} mg/dL</span>
                    </div>
                  </div>
                </div>
              )}

              {(currentCase.labs.urineNa || currentCase.labs.urineCr) && (
                <div>
                  <h4 className="text-sm font-semibold text-[#364154] dark:text-[#cbd5e1] mb-2">Urine Studies</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {currentCase.labs.urineNa && (
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                        <span className="text-[#364154] dark:text-[#cbd5e1]">Urine Na:</span>
                        <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.urineNa} mEq/L</span>
                      </div>
                    )}
                    {currentCase.labs.urineCr && (
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-[#1F283A] rounded border border-slate-200 dark:border-slate-700">
                        <span className="text-[#364154] dark:text-[#cbd5e1]">Urine Cr:</span>
                        <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.labs.urineCr} mg/dL</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Question */}
            <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-xl p-6 border border-cyan-200 dark:border-cyan-900 shadow-md">
              <h3 className="text-lg font-semibold mb-2 text-cyan-600 dark:text-cyan-400">Question</h3>
              <p className="text-[#1F283A] dark:text-[#E9ECF1] mb-4 font-medium">{currentCase.question}</p>
              
              {currentCase.calculationHint && (
                <div className="bg-white dark:bg-[#1F283A] rounded-lg p-3 mb-4 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-[#364154] dark:text-[#cbd5e1] mb-1">Formula Hint:</p>
                  <p className="text-sm text-[#1F283A] dark:text-[#E9ECF1] font-mono">{currentCase.calculationHint}</p>
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
                  className="flex-1 px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg 
                           text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                           focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed font-mono text-lg shadow-sm"
                />
                <div className="flex items-center px-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg text-[#364154] dark:text-[#cbd5e1] shadow-sm">
                  {currentCase.unit}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {!isSubmitted ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!userAnswer}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 
                             disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                             transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    Submit Answer
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-[#1F283A] hover:bg-[#364154] dark:bg-[#E9ECF1] dark:hover:bg-white 
                             text-[#E9ECF1] dark:text-[#1F283A] py-3 rounded-lg font-semibold
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
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-xl p-6 border shadow-md ${
                    isCorrect
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
                      : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold mb-2 ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {feedback}
                      </p>
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-sm leading-relaxed">
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
          >
            <h3 className="text-xl font-semibold mb-4 text-cyan-600 dark:text-cyan-400">Urine Chemistry Reference</h3>
            <div className="space-y-3">
              {URINE_CHEMISTRY_REFERENCE.reference.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50 dark:bg-[#1F283A] rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-[#1F283A] dark:text-[#E9ECF1]">{item.parameter}</h4>
                    <span className="text-cyan-600 dark:text-cyan-400 font-mono text-sm">{item.unit}</span>
                  </div>
                  <p className="text-[#364154] dark:text-[#cbd5e1] text-sm mb-1">
                    Normal: <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{item.normalRange}</span>
                  </p>
                  {item.interpretation && (
                    <p className="text-slate-500 dark:text-slate-400 text-xs italic">{item.interpretation}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Additional Calculation Tips */}
            <div className="mt-6 p-4 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-900">
              <h4 className="font-semibold text-cyan-600 dark:text-cyan-400 mb-3">Common Calculations</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-1">FENa:</p>
                  <p className="font-mono text-xs text-[#364154] dark:text-[#cbd5e1]">[(UNa × SCr) / (SNa × UCr)] × 100</p>
                </div>
                <div>
                  <p className="font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-1">Anion Gap:</p>
                  <p className="font-mono text-xs text-[#364154] dark:text-[#cbd5e1]">Na - (Cl + HCO₃)</p>
                </div>
                <div>
                  <p className="font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-1">Free Water Deficit:</p>
                  <p className="font-mono text-xs text-[#364154] dark:text-[#cbd5e1]">TBW × [(Na/140) - 1]</p>
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
