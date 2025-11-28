import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight, RotateCcw, AlertCircle } from 'lucide-react';
import type { Guideline, GuidelineCase, GuidelineDrillStatus, GuidelineDrillResult } from '@/types/guidelines';

interface GuidelineCaseDrillProps {
  /** The guideline to practice */
  guideline: Guideline;
  /** Callback when the session is complete */
  onComplete?: (result: GuidelineDrillResult) => void;
  /** Callback to exit the drill */
  onExit?: () => void;
}

/**
 * GuidelineCaseDrill - Vignette-based scoring drill component.
 * 
 * Runs a "Read -> Calculate -> Feedback" loop for clinical scoring guidelines.
 * Shows visual diff of criteria met/unmet after each answer.
 */
const GuidelineCaseDrill: React.FC<GuidelineCaseDrillProps> = ({
  guideline,
  onComplete,
  onExit,
}) => {
  const [currentVignetteIndex, setCurrentVignetteIndex] = useState(0);
  const [userScoreInput, setUserScoreInput] = useState<number | null>(null);
  const [status, setStatus] = useState<GuidelineDrillStatus>('answering');
  const [results, setResults] = useState<GuidelineDrillResult['cases']>([]);

  const currentVignette: GuidelineCase | undefined = guideline.vignettes[currentVignetteIndex];
  const totalVignettes = guideline.vignettes.length;
  const isCorrect = userScoreInput === currentVignette?.correctScore;

  // Get risk tier for a given score
  const getRiskTier = useCallback((score: number) => {
    if (!guideline.scoringMap) return null;
    return guideline.scoringMap.find(
      (tier) => score >= tier.minScore && score <= tier.maxScore
    );
  }, [guideline.scoringMap]);

  // Handle score submission
  const handleSubmit = useCallback(() => {
    if (userScoreInput === null || !currentVignette) return;

    setResults((prev) => [
      ...prev,
      {
        caseId: currentVignette.id,
        userScore: userScoreInput,
        correctScore: currentVignette.correctScore,
        isCorrect: userScoreInput === currentVignette.correctScore,
      },
    ]);
    setStatus('feedback');
  }, [userScoreInput, currentVignette]);

  // Handle moving to next case
  const handleNextCase = useCallback(() => {
    if (currentVignetteIndex >= totalVignettes - 1) {
      // Session complete - results already includes current case from handleSubmit
      setStatus('summary');
      const finalResults: GuidelineDrillResult = {
        total: totalVignettes,
        correct: results.filter((r) => r.isCorrect).length,
        cases: results,
      };
      onComplete?.(finalResults);
    } else {
      setCurrentVignetteIndex((prev) => prev + 1);
      setUserScoreInput(null);
      setStatus('answering');
    }
  }, [currentVignetteIndex, totalVignettes, results, onComplete]);

  // Reset the drill
  const handleReset = useCallback(() => {
    setCurrentVignetteIndex(0);
    setUserScoreInput(null);
    setStatus('answering');
    setResults([]);
  }, []);

  // Score button click handler
  const handleScoreClick = (score: number) => {
    if (status === 'answering') {
      setUserScoreInput(score);
    }
  };

  // Animation variants
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  // Calculate final stats - results already includes current case when in feedback/summary state
  const correctCount = results.filter((r) => r.isCorrect).length;
  const accuracy = totalVignettes > 0 ? Math.round((correctCount / totalVignettes) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <XCircle className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-100">{guideline.name}</h1>
          <p className="text-xs text-slate-500">
            Case {currentVignetteIndex + 1} of {totalVignettes}
          </p>
        </div>

        <div className="text-sm text-slate-500">
          {correctCount}/{currentVignetteIndex + (status === 'answering' ? 0 : 1)} correct
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-32">
        <AnimatePresence mode="wait">
          {status === 'summary' ? (
            // Summary View
            <motion.div
              key="summary"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-2xl mx-auto"
            >
              <div className="bg-slate-900 rounded-2xl p-8 text-center">
                <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
                <p className="text-slate-400 mb-6">
                  You've completed all {totalVignettes} cases for {guideline.name}.
                </p>

                <div className="flex justify-center gap-8 mb-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-emerald-400">{correctCount}</div>
                    <div className="text-sm text-slate-500">Correct</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-slate-300">{totalVignettes}</div>
                    <div className="text-sm text-slate-500">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-sky-400">{accuracy}%</div>
                    <div className="text-sm text-slate-500">Accuracy</div>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Practice Again
                </button>
              </div>
            </motion.div>
          ) : (
            // Answering / Feedback View
            <motion.div
              key={`case-${currentVignetteIndex}`}
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-3xl mx-auto space-y-6"
            >
              {/* Vignette Card */}
              <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-sky-400 mt-0.5 flex-shrink-0" />
                  <h2 className="text-lg font-semibold text-slate-100">Clinical Vignette</h2>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                    {currentVignette?.story}
                  </p>
                </div>
              </div>

              {/* Score Input Section */}
              {status === 'answering' && (
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-lg font-semibold mb-4">
                    Calculate the {guideline.name} Score
                  </h3>
                  
                  {/* Score Buttons */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    {Array.from({ length: guideline.maxScore + 1 }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => handleScoreClick(i)}
                        className={`w-12 h-12 rounded-lg font-bold text-lg transition-all ${
                          userScoreInput === i
                            ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={userScoreInput === null}
                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Submit Score
                  </button>
                </div>
              )}

              {/* Feedback Section */}
              {status === 'feedback' && currentVignette && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Result Banner */}
                  <div
                    className={`rounded-xl p-4 border-2 ${
                      isCorrect
                        ? 'bg-emerald-950/50 border-emerald-500'
                        : 'bg-red-950/50 border-red-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isCorrect ? (
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                      ) : (
                        <XCircle className="w-8 h-8 text-red-400" />
                      )}
                      <div>
                        <div className={`text-xl font-bold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isCorrect ? 'Correct!' : 'Incorrect'}
                        </div>
                        <div className="text-sm text-slate-300">
                          {isCorrect
                            ? `Score: ${currentVignette.correctScore}`
                            : `Your answer: ${userScoreInput} | Correct: ${currentVignette.correctScore}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk Tier */}
                  {guideline.scoringMap && (
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Risk Stratification</h4>
                      <div className="text-lg font-semibold text-slate-100">
                        {getRiskTier(currentVignette.correctScore)?.tier || 'Unknown'}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {getRiskTier(currentVignette.correctScore)?.recommendation}
                      </p>
                    </div>
                  )}

                  {/* Criteria Breakdown - The Visual Diff */}
                  <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h4 className="text-lg font-semibold mb-4">Criteria Breakdown</h4>
                    <ul className="space-y-3">
                      {guideline.components.map((component) => {
                        const isMet = currentVignette.metCriteriaIds.includes(component.id);
                        return (
                          <li
                            key={component.id}
                            className={`flex items-start gap-3 p-3 rounded-lg ${
                              isMet ? 'bg-emerald-950/30' : 'bg-slate-800/50'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {isMet ? (
                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <XCircle className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div
                                className={`font-medium ${
                                  isMet ? 'text-emerald-300' : 'text-slate-500'
                                }`}
                              >
                                {component.label}
                                <span className="ml-2 text-sm">
                                  ({isMet ? `+${component.pointValue}` : '0'} pt)
                                </span>
                              </div>
                              {component.description && (
                                <div className={`text-sm mt-1 ${isMet ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {component.description}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    
                    {/* Total Score */}
                    <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Total Score</span>
                      <span className="text-2xl font-bold text-slate-100">
                        {currentVignette.correctScore} / {guideline.maxScore}
                      </span>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h4 className="text-lg font-semibold mb-3">Clinical Reasoning</h4>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                        {currentVignette.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNextCase}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {currentVignetteIndex >= totalVignettes - 1 ? 'View Results' : 'Next Case'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default GuidelineCaseDrill;
