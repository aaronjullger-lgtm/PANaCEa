import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, Droplets, ArrowRight, RotateCcw, Play } from 'lucide-react';
import type { FluidElectrolyteCase } from '@/types/drill-modes';
import { 
  FLUID_ELECTROLYTE_CASES, 
  URINE_CHEMISTRY_REFERENCE, 
  getRandomFluidCase, 
  validateNumericAnswer 
} from '@/data/modes/fluidElectrolyteData';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';

interface FluidElectrolyteModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'active';

const FluidElectrolyteMode: React.FC<FluidElectrolyteModeProps> = ({ onExit }) => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [currentCase, setCurrentCase] = useState<FluidElectrolyteCase | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = () => {
    setIsLoading(true);
    // Simulate loading for content generation buffer
    setTimeout(() => {
      setCurrentCase(getRandomFluidCase());
      setIsLoading(false);
      setViewState('active');
    }, 1000);
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
  };

  const handleNext = () => {
    setCurrentCase(getRandomFluidCase());
    setUserAnswer('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setFeedback('');
  };

  const handleReset = () => {
    setScore({ correct: 0, total: 0 });
    handleNext();
  };

  // Landing Page
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 text-white">
        <div className="border-b border-cyan-800/30 bg-black/20 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Droplets className="w-8 h-8 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-bold">Hydro-Mode</h1>
                <p className="text-sm text-cyan-300">Fluid & Electrolyte Management</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8"
          >
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-cyan-400">Master Fluid & Electrolyte Calculations</h2>
              <p className="text-xl text-slate-300">
                Practice real-world clinical calculations with instant feedback
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-cyan-800/30 text-left space-y-6">
              <h3 className="text-2xl font-semibold text-cyan-400">What You'll Practice</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-800/30">
                  <h4 className="font-semibold text-white mb-2">FENa Calculations</h4>
                  <p className="text-slate-400 text-sm">Fractional excretion of sodium for AKI workup</p>
                </div>
                <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-800/30">
                  <h4 className="font-semibold text-white mb-2">Anion Gap</h4>
                  <p className="text-slate-400 text-sm">Acid-base disorder assessment</p>
                </div>
                <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-800/30">
                  <h4 className="font-semibold text-white mb-2">Maintenance Fluids</h4>
                  <p className="text-slate-400 text-sm">4-2-1 rule and pediatric calculations</p>
                </div>
                <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-800/30">
                  <h4 className="font-semibold text-white mb-2">Free Water Deficit</h4>
                  <p className="text-slate-400 text-sm">Hypernatremia management</p>
                </div>
              </div>

              <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-800/30">
                <p className="text-sm text-cyan-300 font-semibold mb-2">Features:</p>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Clinical vignettes with lab values</li>
                  <li>• Formula hints provided for each calculation</li>
                  <li>• Urine chemistry reference table</li>
                  <li>• Margin of error for numeric answers</li>
                  <li>• Detailed explanations and teaching points</li>
                </ul>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={isLoading}
              className="px-8 py-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 
                       disabled:cursor-not-allowed rounded-lg font-semibold text-lg
                       transition-colors flex items-center justify-center gap-3 mx-auto"
            >
              {isLoading ? (
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
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active Session
  if (!currentCase) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 text-white">
      {/* Header */}
      <div className="border-b border-cyan-800/30 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold">Hydro-Mode</h1>
              <p className="text-sm text-cyan-300">Fluid & Electrolyte Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-400">Score</p>
              <p className="text-xl font-bold">
                {score.correct}/{score.total}
                {score.total > 0 && (
                  <span className="text-sm ml-2 text-cyan-400">
                    ({Math.round((score.correct / score.total) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              title="Reset Score"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Side: Clinical Vignette + Labs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Clinical Vignette */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-cyan-800/30">
              <h2 className="text-xl font-semibold mb-3 text-cyan-400">
                {currentCase.title}
              </h2>
              <p className="text-slate-300 leading-relaxed">
                {currentCase.vignette}
              </p>
            </div>

            {/* Labs */}
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-cyan-800/30">
              <h3 className="text-lg font-semibold mb-4 text-cyan-400">Laboratory Results</h3>
              
              {currentCase.labs.bmp && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-400 mb-2">Basic Metabolic Panel</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                      <span className="text-slate-400">Sodium:</span>
                      <span className="font-mono">{currentCase.labs.bmp.sodium} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                      <span className="text-slate-400">Potassium:</span>
                      <span className="font-mono">{currentCase.labs.bmp.potassium} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                      <span className="text-slate-400">Chloride:</span>
                      <span className="font-mono">{currentCase.labs.bmp.chloride} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                      <span className="text-slate-400">HCO₃:</span>
                      <span className="font-mono">{currentCase.labs.bmp.bicarbonate} mEq/L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                      <span className="text-slate-400">BUN:</span>
                      <span className="font-mono">{currentCase.labs.bmp.bun} mg/dL</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                      <span className="text-slate-400">Creatinine:</span>
                      <span className="font-mono">{currentCase.labs.bmp.creatinine} mg/dL</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                      <span className="text-slate-400">Glucose:</span>
                      <span className="font-mono">{currentCase.labs.bmp.glucose} mg/dL</span>
                    </div>
                  </div>
                </div>
              )}

              {(currentCase.labs.urineNa || currentCase.labs.urineCr) && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-400 mb-2">Urine Studies</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {currentCase.labs.urineNa && (
                      <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                        <span className="text-slate-400">Urine Na:</span>
                        <span className="font-mono">{currentCase.labs.urineNa} mEq/L</span>
                      </div>
                    )}
                    {currentCase.labs.urineCr && (
                      <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                        <span className="text-slate-400">Urine Cr:</span>
                        <span className="font-mono">{currentCase.labs.urineCr} mg/dL</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Question */}
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur rounded-xl p-6 border border-cyan-600/30">
              <h3 className="text-lg font-semibold mb-2 text-cyan-300">Question</h3>
              <p className="text-slate-200 mb-4">{currentCase.question}</p>
              
              {currentCase.calculationHint && (
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Formula Hint:</p>
                  <p className="text-sm text-slate-300 font-mono">{currentCase.calculationHint}</p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isSubmitted && handleSubmit()}
                  placeholder="Enter your answer"
                  disabled={isSubmitted}
                  className="flex-1 px-4 py-3 bg-slate-900/70 border border-cyan-800/50 rounded-lg 
                           text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500
                           disabled:opacity-50 disabled:cursor-not-allowed font-mono text-lg"
                />
                <div className="flex items-center px-3 bg-slate-900/70 border border-cyan-800/50 rounded-lg text-slate-400">
                  {currentCase.unit}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {!isSubmitted ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!userAnswer}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 
                             disabled:cursor-not-allowed py-3 rounded-lg font-semibold
                             transition-colors flex items-center justify-center gap-2"
                  >
                    Submit Answer
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold
                             transition-colors flex items-center justify-center gap-2"
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
                  className={`rounded-xl p-6 border ${
                    isCorrect
                      ? 'bg-green-900/40 border-green-600/30'
                      : 'bg-red-900/40 border-red-600/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold mb-2 ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                        {feedback}
                      </p>
                      <p className="text-slate-300 text-sm leading-relaxed">
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
            className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-cyan-800/30"
          >
            <h3 className="text-xl font-semibold mb-4 text-cyan-400">Urine Chemistry Reference</h3>
            <div className="space-y-3">
              {URINE_CHEMISTRY_REFERENCE.reference.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-slate-200">{item.parameter}</h4>
                    <span className="text-cyan-400 font-mono text-sm">{item.unit}</span>
                  </div>
                  <p className="text-slate-400 text-sm mb-1">
                    Normal: <span className="font-mono text-slate-300">{item.normalRange}</span>
                  </p>
                  {item.interpretation && (
                    <p className="text-slate-500 text-xs italic">{item.interpretation}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Additional Calculation Tips */}
            <div className="mt-6 p-4 bg-cyan-900/20 rounded-lg border border-cyan-800/30">
              <h4 className="font-semibold text-cyan-400 mb-2">Common Calculations</h4>
              <div className="space-y-2 text-sm text-slate-300">
                <div>
                  <p className="font-semibold text-slate-200">FENa:</p>
                  <p className="font-mono text-xs">[(UNa × SCr) / (SNa × UCr)] × 100</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Anion Gap:</p>
                  <p className="font-mono text-xs">Na - (Cl + HCO₃)</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Free Water Deficit:</p>
                  <p className="font-mono text-xs">TBW × [(Na/140) - 1]</p>
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
