import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight, RotateCcw, AlertCircle } from 'lucide-react';
import type {
  Guideline,
  GuidelineCase,
  GuidelineDrillStatus,
  GuidelineDrillResult,
} from '@/types/guidelines';

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
  const getRiskTier = useCallback(
    (score: number) => {
      if (!guideline.scoringMap) return null;
      return guideline.scoringMap.find((tier) => score >= tier.minScore && score <= tier.maxScore);
    },
    [guideline.scoringMap]
  );

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
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <XCircle className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <div className="text-center">
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">{guideline.name}</h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Case {currentVignetteIndex + 1} of {totalVignettes}
          </p>
        </div>

        <div className="text-sm text-[var(--color-text-muted)]">
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
              <div className="bg-[var(--color-bg-secondary)] rounded-2xl p-8 text-center">
                <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
                <p className="text-[var(--color-text-muted)] mb-6">
                  You've completed all {totalVignettes} cases for {guideline.name}.
                </p>

                <div className="flex justify-center gap-8 mb-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[var(--color-data-pass)]">
                      {correctCount}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[var(--color-text-secondary)]">
                      {totalVignettes}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[var(--color-accent)]">{accuracy}%</div>
                    <div className="text-sm text-[var(--color-text-muted)]">Accuracy</div>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 rounded-lg font-medium transition-colors"
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
              <div className="bg-data-neutral rounded-xl p-6 border border-data-neutral">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                  <h2 className="text-lg font-semibold text-data-neutral">Clinical Vignette</h2>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-data-neutral whitespace-pre-line leading-relaxed">
                    {currentVignette?.story}
                  </p>
                </div>
              </div>

              {/* Score Input Section */}
              {status === 'answering' && (
                <div className="bg-data-neutral rounded-xl p-6 border border-data-neutral">
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
                            ? 'bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)]/50'
                            : 'bg-data-neutral text-data-neutral hover:bg-data-neutral'
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
                    className="w-full py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 disabled:bg-data-neutral disabled:text-data-neutral text-white font-medium rounded-lg transition-colors"
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
                        ? 'bg-data-pass/50 border-data-pass'
                        : 'bg-data-fail/50 border-data-fail'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isCorrect ? (
                        <CheckCircle className="w-8 h-8 text-data-pass" />
                      ) : (
                        <XCircle className="w-8 h-8 text-data-fail" />
                      )}
                      <div>
                        <div
                          className={`text-xl font-bold ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
                        >
                          {isCorrect ? 'Correct!' : 'Incorrect'}
                        </div>
                        <div className="text-sm text-data-neutral">
                          {isCorrect
                            ? `Score: ${currentVignette.correctScore}`
                            : `Your answer: ${userScoreInput} | Correct: ${currentVignette.correctScore}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk Tier */}
                  {guideline.scoringMap && (
                    <div className="bg-data-neutral rounded-xl p-4 border border-data-neutral">
                      <h4 className="text-sm font-medium text-data-neutral mb-2">
                        Risk Stratification
                      </h4>
                      <div className="text-lg font-semibold text-data-neutral">
                        {getRiskTier(currentVignette.correctScore)?.tier || 'Unknown'}
                      </div>
                      <p className="text-sm text-data-neutral mt-1">
                        {getRiskTier(currentVignette.correctScore)?.recommendation}
                      </p>
                    </div>
                  )}

                  {/* Criteria Breakdown - The Visual Diff */}
                  <div className="bg-data-neutral rounded-xl p-6 border border-data-neutral">
                    <h4 className="text-lg font-semibold mb-4">Criteria Breakdown</h4>
                    <ul className="space-y-3">
                      {guideline.components.map((component) => {
                        const isMet = currentVignette.metCriteriaIds.includes(component.id);
                        return (
                          <li
                            key={component.id}
                            className={`flex items-start gap-3 p-3 rounded-lg ${
                              isMet ? 'bg-data-pass/30' : 'bg-data-neutral/50'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {isMet ? (
                                <CheckCircle className="w-5 h-5 text-data-pass" />
                              ) : (
                                <XCircle className="w-5 h-5 text-data-neutral" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div
                                className={`font-medium ${
                                  isMet ? 'text-data-pass' : 'text-data-neutral'
                                }`}
                              >
                                {component.label}
                                <span className="ml-2 text-sm">
                                  ({isMet ? `+${component.pointValue}` : '0'} pt)
                                </span>
                              </div>
                              {component.description && (
                                <div
                                  className={`text-sm mt-1 text-[var(--color-text-muted)]`}
                                >
                                  {component.description}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Total Score */}
                    <div className="mt-4 pt-4 border-t border-data-neutral flex justify-between items-center">
                      <span className="text-data-neutral font-medium">Total Score</span>
                      <span className="text-2xl font-bold text-data-neutral">
                        {currentVignette.correctScore} / {guideline.maxScore}
                      </span>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="bg-data-neutral rounded-xl p-6 border border-data-neutral">
                    <h4 className="text-lg font-semibold mb-3">Clinical Reasoning</h4>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-data-neutral whitespace-pre-line leading-relaxed">
                        {currentVignette.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNextCase}
                    className="w-full py-4 bg-data-neutral hover:bg-data-neutral text-data-neutral font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
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
