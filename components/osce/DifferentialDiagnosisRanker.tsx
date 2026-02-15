/**
 * Differential Diagnosis Ranker
 * Drag-and-drop interface for ranking diagnoses by likelihood
 * Phase 18: Requirement 70
 */

import React, { useState } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { GripVertical, Award, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';

interface Diagnosis {
  id: string;
  name: string;
  description: string;
}

interface DifferentialDiagnosisRankerProps {
  patientPresentation: string;
  vitals: string;
  diagnoses: Diagnosis[];
  correctOrder: string[]; // Array of diagnosis IDs in correct order
  onComplete: (score: number) => void;
}

interface ScoredDiagnosis extends Diagnosis {
  userRank: number;
  correctRank: number;
  isCorrectPosition: boolean;
}

export const DifferentialDiagnosisRanker: React.FC<DifferentialDiagnosisRankerProps> = ({
  patientPresentation,
  vitals,
  diagnoses,
  correctOrder,
  onComplete,
}) => {
  const [orderedDiagnoses, setOrderedDiagnoses] = useState(diagnoses);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoredResults, setScoredResults] = useState<ScoredDiagnosis[]>([]);
  const [score, setScore] = useState(0);

  const handleSubmit = () => {
    // Calculate score based on ranking accuracy
    const results: ScoredDiagnosis[] = orderedDiagnoses.map((diagnosis, index) => {
      const correctRank = correctOrder.indexOf(diagnosis.id);
      const userRank = index;
      const isCorrectPosition = correctRank === userRank;

      return {
        ...diagnosis,
        userRank,
        correctRank,
        isCorrectPosition,
      };
    });

    // Scoring:
    // - Perfect position: 20 points
    // - Off by 1: 15 points
    // - Off by 2: 10 points
    // - Off by 3+: 5 points
    let totalScore = 0;
    results.forEach((result) => {
      const diff = Math.abs(result.userRank - result.correctRank);
      if (diff === 0) totalScore += 20;
      else if (diff === 1) totalScore += 15;
      else if (diff === 2) totalScore += 10;
      else totalScore += 5;
    });

    const percentageScore = (totalScore / (diagnoses.length * 20)) * 100;

    setScoredResults(results);
    setScore(Math.round(percentageScore));
    setIsSubmitted(true);
    onComplete(percentageScore);
  };

  const handleReset = () => {
    setOrderedDiagnoses([...diagnoses].sort(() => Math.random() - 0.5));
    setIsSubmitted(false);
    setScoredResults([]);
    setScore(0);
  };

  const getRankLabel = (rank: number): string => {
    const labels = [
      'Most Likely',
      '2nd Most Likely',
      '3rd Most Likely',
      '4th Most Likely',
      'Least Likely',
    ];
    return labels[rank] || `Rank ${rank + 1}`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 75) return 'text-blue-600 dark:text-blue-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Differential Diagnosis Challenge</h2>
        <p className="text-white/90">Rank diagnoses from most likely to least likely</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient Presentation */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Patient Presentation
            </h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                  Chief Complaint & History
                </h4>
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">
                  {patientPresentation}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                  Vital Signs
                </h4>
                <p className="text-sm text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
                  {vitals}
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Instructions</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
              <li>• Drag diagnoses to reorder them</li>
              <li>• Place most likely diagnosis at the top</li>
              <li>• Consider vitals and clinical presentation</li>
              <li>• Submit when ready to check your ranking</li>
            </ul>
          </div>
        </div>

        {/* Ranking Area */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              {isSubmitted ? 'Your Results' : 'Rank the Diagnoses'}
            </h3>

            {!isSubmitted ? (
              <Reorder.Group
                axis="y"
                values={orderedDiagnoses}
                onReorder={setOrderedDiagnoses}
                className="space-y-3"
              >
                {orderedDiagnoses.map((diagnosis, index) => (
                  <Reorder.Item
                    key={diagnosis.id}
                    value={diagnosis}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <motion.div
                      layout
                      className="flex items-start gap-3 p-4 bg-gradient-to-r from-[var(--color-bg-tertiary)] to-[var(--color-bg-secondary)] rounded-lg border-2 border-[var(--color-border)] hover:border-indigo-400 dark:hover:border-indigo-600 
                        transition-colors"
                    >
                      <GripVertical className="w-5 h-5 text-[var(--color-text-muted)] mt-1 flex-shrink-0" />

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            {diagnosis.name}
                          </h4>
                          <span
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 
                            bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded"
                          >
                            {getRankLabel(index)}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {diagnosis.description}
                        </p>
                      </div>
                    </motion.div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            ) : (
              <div className="space-y-3">
                {scoredResults.map((result) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: result.userRank * 0.1 }}
                    className={`p-4 rounded-lg border-2 ${
                      result.isCorrectPosition
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {result.isCorrectPosition ? (
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0" />
                      )}

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-[var(--color-text-primary)]">
                            {result.name}
                          </h4>
                          <div className="flex gap-2">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                result.isCorrectPosition
                                  ? 'bg-green-600 text-white'
                                  : 'bg-yellow-600 text-white'
                              }`}
                            >
                              Your: #{result.userRank + 1}
                            </span>
                            <span className="text-xs font-semibold bg-[var(--color-accent)] text-[var(--color-text-inverse)] px-2 py-1 rounded">
                              Correct: #{result.correctRank + 1}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {result.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              {!isSubmitted ? (
                <>
                  <button
                    onClick={handleSubmit}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white 
                      rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105"
                  >
                    Submit Ranking
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg font-semibold hover:bg-[var(--color-border)] transition-colors"
                  >
                    Shuffle
                  </button>
                </>
              ) : (
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white 
                    rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Display */}
      <AnimatePresence>
        {isSubmitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 
              rounded-xl p-8 shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Clinical Prioritization Score
                </h3>
                <p className="text-[var(--color-text-secondary)]">
                  {score >= 90 &&
                    'Excellent diagnostic reasoning! You correctly prioritized the differentials.'}
                  {score >= 75 &&
                    score < 90 &&
                    'Good work! Your ranking shows solid clinical thinking.'}
                  {score >= 60 &&
                    score < 75 &&
                    'Decent attempt. Review the key clinical features that distinguish these conditions.'}
                  {score < 60 &&
                    'Keep practicing! Consider vital signs and presentation patterns more carefully.'}
                </p>
              </div>
              <div className="text-center">
                <Award className={`w-12 h-12 mx-auto mb-2 ${getScoreColor(score)}`} />
                <div className={`text-6xl font-bold ${getScoreColor(score)}`}>{score}%</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teaching Points */}
      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg"
        >
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Teaching Points
          </h3>
          <div className="space-y-3 text-[var(--color-text-secondary)]">
            <p>
              <strong>Clinical Prioritization:</strong> In real practice, you must quickly assess
              which diagnoses are most life-threatening and most likely. Consider:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Vital sign abnormalities (unstable vitals = higher priority)</li>
              <li>Time-sensitive conditions (MI, PE, stroke)</li>
              <li>Common presentations vs. rare zebras</li>
              <li>Risk factors and patient demographics</li>
            </ul>
            <p className="mt-4 text-sm italic">
              Remember: "Common things are common, but don't miss the zebra when it's galloping
              through your ER with unstable vitals."
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DifferentialDiagnosisRanker;
