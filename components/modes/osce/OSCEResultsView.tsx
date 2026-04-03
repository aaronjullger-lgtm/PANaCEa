/**
 * OSCEResultsView — Legacy fallback results view for OSCE encounters.
 *
 * Rendered when viewState === 'results' and the session has a numeric score
 * but no preceptor/AAR feedback (i.e. the newer debrief flow did not run).
 *
 * Extracted from PatientEncounterMode.tsx to reduce component size.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Award, CheckCircle, Clock, FileText, MessageSquare, X, XCircle } from 'lucide-react';

export interface OSCEScore {
  overall: number;
  thoroughness: number;
  efficiency: number;
}

export interface OSCEResultsViewProps {
  score: OSCEScore;
  isCorrectDiagnosis: boolean;
  userDiagnosis: string;
  diagnosisFeedback: { isCorrect?: boolean; feedback?: string } | null;
  aar: string | null;
  correctDiagnosis: string;
  idealWorkup: string[];
  onExit?: () => void;
  onNewCase: () => void;
}

function getScoreColor(s: number): string {
  if (s >= 80) return 'text-data-pass';
  if (s >= 60) return 'text-data-provisional';
  return 'text-data-fail';
}

export const OSCEResultsView: React.FC<OSCEResultsViewProps> = ({
  score,
  isCorrectDiagnosis,
  userDiagnosis,
  diagnosisFeedback,
  aar,
  correctDiagnosis,
  idealWorkup,
  onExit,
  onNewCase,
}) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-data-neutral" />
            <div>
              <h1 className="text-2xl font-bold">Virtual OSCE — Results</h1>
              <p className="text-sm text-data-neutral">Performance Summary</p>
            </div>
          </div>
          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors border border-data-neutral"
              aria-label="Close results"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Diagnosis Result */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className={`rounded-xl p-6 border ${
            isCorrectDiagnosis
              ? 'bg-[var(--color-data-neutral)]/10 dark:bg-[var(--color-data-neutral)]/20 border-[var(--color-data-neutral)]/20 dark:border-[var(--color-data-neutral)]/40'
              : 'bg-[var(--color-data-provisional)]/10 dark:bg-[var(--color-data-provisional)]/20 border-[var(--color-data-provisional)]/20 dark:border-[var(--color-data-provisional)]/40'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {isCorrectDiagnosis ? (
              <CheckCircle className="w-8 h-8 text-data-pass" aria-hidden="true" />
            ) : (
              <XCircle className="w-8 h-8 text-data-provisional" aria-hidden="true" />
            )}
            <div>
              <h2
                className={`text-2xl font-bold ${
                  isCorrectDiagnosis
                    ? 'text-[var(--color-data-neutral)] dark:text-[var(--color-data-neutral)]'
                    : 'text-[var(--color-data-provisional)] dark:text-[var(--color-data-provisional)]'
                }`}
              >
                {isCorrectDiagnosis ? 'Correct Diagnosis!' : 'Diagnosis Review'}
              </h2>
              <p className="text-[#364154] dark:text-[#cbd5e1]">Your diagnosis: {userDiagnosis}</p>
            </div>
          </div>

          {diagnosisFeedback?.feedback && (
            <div className="mb-4 p-4 bg-card/50 rounded-lg border border-[var(--color-border)]/50">
              <p className="text-sm font-semibold mb-1 opacity-75">AI Feedback:</p>
              <p className="text-muted-foreground italic">&ldquo;{diagnosisFeedback.feedback}&rdquo;</p>
            </div>
          )}

          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
            <p className="text-sm text-data-neutral mb-1">Correct Diagnosis:</p>
            <p className="text-lg font-semibold text-white">{correctDiagnosis}</p>
          </div>
        </motion.div>

        {/* Score Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral text-center shadow-sm"
          >
            <Award className="w-8 h-8 text-data-neutral mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-data-neutral mb-1">Overall Score</p>
            <p className={`text-4xl font-bold tabular-nums ${getScoreColor(score.overall)}`}>
              {Math.round(score.overall)}%
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-6 border border-[var(--color-border)] text-center shadow-sm"
          >
            <CheckCircle className="w-8 h-8 text-data-pass mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground mb-1">Thoroughness</p>
            <p className={`text-4xl font-bold tabular-nums ${getScoreColor(score.thoroughness)}`}>
              {Math.round(score.thoroughness)}%
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl p-6 border border-[var(--color-border)] text-center shadow-sm"
          >
            <Clock className="w-8 h-8 text-[var(--color-accent)] mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground mb-1">Efficiency</p>
            <p className={`text-4xl font-bold tabular-nums ${getScoreColor(score.efficiency)}`}>
              {Math.round(score.efficiency)}%
            </p>
          </motion.div>
        </div>

        {/* After Action Report */}
        {aar && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-sm"
          >
            <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <FileText className="w-5 h-5" /> After-Action Report
            </h3>
            <div className="prose dark:prose-invert max-w-none text-data-neutral whitespace-pre-wrap">
              {aar}
            </div>
          </motion.div>
        )}

        {/* Ideal Workup */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-sm"
        >
          <h3 className="text-xl font-semibold mb-4 text-white">Ideal Workup</h3>
          <ul className="space-y-2">
            {idealWorkup.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-data-neutral">
                <CheckCircle className="w-5 h-5 text-data-neutral flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-2">
          <motion.button
            onClick={onNewCase}
            className="flex-1 bg-data-neutral-bg hover:opacity-90 py-4 rounded-xl font-semibold text-white
                       transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <MessageSquare className="w-5 h-5" />
            Try Another Case
          </motion.button>
          {onExit && (
            <motion.button
              onClick={onExit}
              className="px-8 py-4 bg-data-neutral-bg hover:opacity-90 rounded-xl font-semibold
                         text-white transition-colors border border-data-neutral focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Exit
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};
