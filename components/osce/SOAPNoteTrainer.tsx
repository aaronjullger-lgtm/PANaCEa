/**
 * SOAP Note Trainer
 * Teaches clinical documentation with AI-powered grading
 * Phase 18: Requirement 69
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle, AlertCircle, Lightbulb, Award, Check } from 'lucide-react';
import { InlineSpinner } from '@/components/loading';
import type { SOAPNote } from '@/services/ai';
import { gradeSoapNote, type GradingResult } from '@/lib/services/soapGradingService';
import { storeSoapGradingEvent } from '@/lib/services/soapAnalyticsService';
import { toast } from '@/lib/toast';

interface SOAPNoteTrainerProps {
  patientCase: PatientCase;
  onComplete: (score: number) => void;
}

interface PatientCase {
  id: string;
  patientInfo: string;
  chiefComplaint: string;
  history: string;
  physicalExam: string;
  vitals: string;
  labs?: string;
}

export const SOAPNoteTrainer: React.FC<SOAPNoteTrainerProps> = ({ patientCase, onComplete }) => {
  const [soapNote, setSOAPNote] = useState<SOAPNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [activeSection, setActiveSection] = useState<keyof SOAPNote>('subjective');

  const handleSubmit = async () => {
    setIsGrading(true);

    try {
      const studentNote = `Subjective (S):\n${soapNote.subjective}\n\nObjective (O):\n${soapNote.objective}\n\nAssessment (A):\n${soapNote.assessment}\n\nPlan (P):\n${soapNote.plan}`;

      const caseContext = `Chief Complaint: ${patientCase.chiefComplaint}\nHistory: ${patientCase.history}\nVitals: ${patientCase.vitals}\nPhysical Exam: ${patientCase.physicalExam}\nLabs: ${patientCase.labs || 'N/A'}`;

      const result = await gradeSoapNote(studentNote, caseContext);
      setGradingResult(result);
      onComplete(result.totalScore);

      // Fire-and-forget analytics event; failures are handled inside the helper
      void storeSoapGradingEvent(patientCase.id, result);
    } catch (error) {
      console.error('Grading failed:', error);
      toast.error('Grading failed. Please check your connection and try again.');
    } finally {
      setIsGrading(false);
    }
  };

  const getSectionGuidance = (section: keyof SOAPNote): string => {
    const guidance = {
      subjective:
        "Document patient's chief complaint, history of present illness (HPI), past medical history, medications, allergies, and social history. Use patient's own words when appropriate.",
      objective:
        'Record vital signs, physical exam findings, and relevant lab/imaging results. Be specific and objective. Include pertinent negatives.',
      assessment:
        'List differential diagnoses ranked by likelihood. State your primary diagnosis clearly. Include ICD-10 codes if known.',
      plan: 'Detail treatment plan, medications (dose, route, frequency), follow-up instructions, patient education, and when to return. Include billing elements.',
    };
    return guidance[section];
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-data-pass';
    if (score >= 80) return 'text-[var(--color-category-practice)]';
    if (score >= 70) return 'text-[var(--color-warning)]';
    if (score >= 60) return 'text-[var(--color-warning-secondary)]';
    return 'text-data-fail';
  };

  const computeSectionTotal = (result: GradingResult | null) => {
    if (!result) return 0;
    return (
      result.breakdown.subjective +
      result.breakdown.objective +
      result.breakdown.assessment +
      result.breakdown.plan
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-[var(--color-accent)] rounded-xl p-6 text-[var(--color-text-inverse)]">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">SOAP Note Trainer</h2>
            <p className="text-[var(--color-text-inverse)]/90">Practice clinical documentation skills</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Patient Case */}
        <div className="space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Patient Case
            </h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-[var(--color-text-secondary)] mb-2">
                  Chief Complaint
                </h4>
                <p className="text-[var(--color-text-muted)] bg-[var(--color-accent-light)] p-3 rounded-lg">
                  "{patientCase.chiefComplaint}"
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--color-text-secondary)] mb-2">History</h4>
                <p className="text-[var(--color-text-muted)] text-sm whitespace-pre-line">
                  {patientCase.history}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--color-text-secondary)] mb-2">Vitals</h4>
                <p className="text-[var(--color-text-muted)] text-sm font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
                  {patientCase.vitals}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[var(--color-text-secondary)] mb-2">
                  Physical Exam
                </h4>
                <p className="text-[var(--color-text-muted)] text-sm whitespace-pre-line">
                  {patientCase.physicalExam}
                </p>
              </div>

              {patientCase.labs && (
                <div>
                  <h4 className="font-semibold text-[var(--color-text-secondary)] mb-2">Labs</h4>
                  <p className="text-[var(--color-text-muted)] text-sm font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg">
                    {patientCase.labs}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Guidance Card */}
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-[var(--color-accent)] mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-[var(--color-text-primary)] mb-2">
                  {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Guidance
                </h4>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {getSectionGuidance(activeSection)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SOAP Note Form */}
        <div className="space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              Write Your SOAP Note
            </h3>

            <div className="space-y-4">
              {/* Subjective */}
              <div>
                <label className="block font-semibold text-[var(--color-text-secondary)] mb-2">
                  Subjective (S)
                </label>
                <textarea
                  value={soapNote.subjective}
                  onChange={(e) => setSOAPNote({ ...soapNote, subjective: e.target.value })}
                  onFocus={() => setActiveSection('subjective')}
                  placeholder="Patient's chief complaint, HPI, PMH, medications, allergies..."
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg
                    bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
                    focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent
                    transition-colors resize-none"
                  rows={4}
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block font-semibold text-[var(--color-text-secondary)] mb-2">
                  Objective (O)
                </label>
                <textarea
                  value={soapNote.objective}
                  onChange={(e) => setSOAPNote({ ...soapNote, objective: e.target.value })}
                  onFocus={() => setActiveSection('objective')}
                  placeholder="Vital signs, physical exam findings, lab results..."
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg
                    bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
                    focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent
                    transition-colors resize-none"
                  rows={4}
                />
              </div>

              {/* Assessment */}
              <div>
                <label className="block font-semibold text-[var(--color-text-secondary)] mb-2">
                  Assessment (A)
                </label>
                <textarea
                  value={soapNote.assessment}
                  onChange={(e) => setSOAPNote({ ...soapNote, assessment: e.target.value })}
                  onFocus={() => setActiveSection('assessment')}
                  placeholder="Primary diagnosis, differential diagnoses, ICD-10 codes..."
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg
                    bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
                    focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent
                    transition-colors resize-none"
                  rows={3}
                />
              </div>

              {/* Plan */}
              <div>
                <label className="block font-semibold text-[var(--color-text-secondary)] mb-2">
                  Plan (P)
                </label>
                <textarea
                  value={soapNote.plan}
                  onChange={(e) => setSOAPNote({ ...soapNote, plan: e.target.value })}
                  onFocus={() => setActiveSection('plan')}
                  placeholder="Treatment plan, medications, follow-up, patient education..."
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg
                    bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
                    focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent
                    transition-colors resize-none"
                  rows={5}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={
                isGrading ||
                !soapNote.subjective ||
                !soapNote.objective ||
                !soapNote.assessment ||
                !soapNote.plan
              }
              className="w-full mt-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)]
                rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105 hover:bg-[var(--color-accent)]/80
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isGrading ? (
                <>
                  <InlineSpinner size="sm" />
                  <span>Consulting Chief Resident...</span>
                </>
              ) : (
                'Submit for AI Grading'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grading In-Progress Indicator */}
      <AnimatePresence>
        {isGrading && !gradingResult && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-[0_18px_42px_var(--color-shadow-soft)] flex items-center gap-4 border border-[var(--color-border)]"
            role="status"
            aria-live="polite"
          >
            <InlineSpinner size="xl" className="text-[var(--color-category-practice)]" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                Consulting Chief Resident...
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Your SOAP note is being graded against the answer key.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grading Results */}
      <AnimatePresence>
        {gradingResult && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)]"
          >
            {/* Overall Score */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 mb-6">
              <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-6">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                    Grading Results
                  </h3>
                  <p className="text-[var(--color-text-secondary)]">
                    Your SOAP note has been evaluated by a strict board-style examiner, focusing on
                    safety, completeness, and clear clinical reasoning.
                  </p>
                  {gradingResult.totalScore >= 90 && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-data-pass px-3 py-1 text-xs font-semibold text-data-pass">
                      <Award className="w-4 h-4" />
                      Honors-level performance
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle
                      className="text-[var(--color-text-muted)]"
                      stroke="currentColor"
                      strokeWidth="10"
                      fill="transparent"
                      r="45"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      className="text-[var(--color-category-practice)]"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeLinecap="round"
                      fill="transparent"
                      r="45"
                      cx="50"
                      cy="50"
                      strokeDasharray={2 * Math.PI * 45}
                      strokeDashoffset={2 * Math.PI * 45 * (1 - gradingResult.totalScore / 100)}
                    />
                  </svg>
                  <div className="text-center">
                    <div
                      className={`text-4xl font-bold ${getScoreColor(gradingResult.totalScore)}`}
                    >
                      {gradingResult.totalScore}
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">Total Score / 100</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section Scores */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              {(
                [
                  ['subjective', gradingResult.breakdown.subjective],
                  ['objective', gradingResult.breakdown.objective],
                  ['assessment', gradingResult.breakdown.assessment],
                  ['plan', gradingResult.breakdown.plan],
                ] as const
              ).map(([section, score]) => (
                <div key={section} className="bg-[var(--color-bg-tertiary)] rounded-lg p-4">
                  <div className="text-sm text-[var(--color-text-muted)] mb-1 capitalize">
                    {section}
                  </div>
                  <div className={`text-2xl font-bold ${getScoreColor((score / 25) * 100)}`}>
                    {score} / 25
                  </div>
                </div>
              ))}
            </div>

            {/* Scoring Explanation */}
            <div className="mb-6 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 p-4 text-sm text-[var(--color-text-secondary)]">
              <h4 className="font-semibold mb-1 text-[var(--color-text-primary)]">
                How your score is calculated
              </h4>
              <p>
                Each SOAP section contributes up to <strong>25 points</strong>. The four section
                scores always add up to your{' '}
                <strong>{computeSectionTotal(gradingResult)} / 100</strong> total, which is what you
                see displayed as <strong>{gradingResult.totalScore} / 100</strong>. Use the Missed
                Concepts and Suggestions lists below as a focused checklist for what to improve on
                your next attempt.
              </p>
            </div>

            {/* Detailed Feedback */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-data-pass" />
                  <h4 className="font-bold text-[var(--color-text-primary)]">Strengths</h4>
                </div>
                <ul className="space-y-2">
                  {gradingResult.feedback.strengths.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
                    >
                      <Check className="w-4 h-4 text-data-pass mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Missed Concepts */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-data-fail" />
                  <h4 className="font-bold text-[var(--color-text-primary)]">Missed Concepts</h4>
                </div>
                <ul className="space-y-2">
                  {gradingResult.feedback.missedConcepts.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
                    >
                      <span className="text-data-fail mt-1">!</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Suggestions */}
            {gradingResult.feedback.suggestions.length > 0 && (
              <div className="mt-6 border-t border-[var(--color-border)] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-[var(--color-accent)]" />
                  <h4 className="font-bold text-[var(--color-text-primary)]">
                    Style & Phrasing Suggestions
                  </h4>
                </div>
                <ul className="space-y-2">
                  {gradingResult.feedback.suggestions.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
                    >
                      <span className="text-[var(--color-accent)] mt-1">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Grading configuration

export default SOAPNoteTrainer;
