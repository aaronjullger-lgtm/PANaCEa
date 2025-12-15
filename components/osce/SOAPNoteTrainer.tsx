/**
 * SOAP Note Trainer
 * Teaches clinical documentation with AI-powered grading
 * Phase 18: Requirement 69
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle, AlertCircle, Lightbulb, Award } from 'lucide-react';
import { gradeSOAPNote, type GradingResult, type SOAPNote } from '@/services/geminiService';

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

export const SOAPNoteTrainer: React.FC<SOAPNoteTrainerProps> = ({
  patientCase,
  onComplete
}) => {
  const [soapNote, setSOAPNote] = useState<SOAPNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  });
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [activeSection, setActiveSection] = useState<keyof SOAPNote>('subjective');

  const handleSubmit = async () => {
    setIsGrading(true);
    
    try {
      // Use Gemini-powered grading
      const result = await gradeSOAPNote(soapNote, patientCase);
      setGradingResult(result);
      onComplete(result.overallScore);
    } catch (error) {
      console.error("Grading failed:", error);
      // Handle error appropriately in UI
    } finally {
      setIsGrading(false);
    }
  };

  const getSectionGuidance = (section: keyof SOAPNote): string => {
    const guidance = {
      subjective: "Document patient's chief complaint, history of present illness (HPI), past medical history, medications, allergies, and social history. Use patient's own words when appropriate.",
      objective: "Record vital signs, physical exam findings, and relevant lab/imaging results. Be specific and objective. Include pertinent negatives.",
      assessment: "List differential diagnoses ranked by likelihood. State your primary diagnosis clearly. Include ICD-10 codes if known.",
      plan: "Detail treatment plan, medications (dose, route, frequency), follow-up instructions, patient education, and when to return. Include billing elements."
    };
    return guidance[section];
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 80) return 'text-blue-600 dark:text-blue-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getGradeIcon = (grade: string) => {
    if (grade === 'A' || grade === 'B') return <Award className="w-8 h-8" />;
    if (grade === 'C') return <CheckCircle className="w-8 h-8" />;
    return <AlertCircle className="w-8 h-8" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">SOAP Note Trainer</h2>
            <p className="text-white/90">Practice clinical documentation skills</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Patient Case */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Patient Case
            </h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Chief Complaint
                </h4>
                <p className="text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  "{patientCase.chiefComplaint}"
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  History
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-line">
                  {patientCase.history}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Vitals
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                  {patientCase.vitals}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Physical Exam
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-line">
                  {patientCase.physicalExam}
                </p>
              </div>

              {patientCase.labs && (
                <div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Labs
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    {patientCase.labs}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Guidance Card */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Guidance
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {getSectionGuidance(activeSection)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SOAP Note Form */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Write Your SOAP Note
            </h3>

            <div className="space-y-4">
              {/* Subjective */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Subjective (S)
                </label>
                <textarea
                  value={soapNote.subjective}
                  onChange={(e) => setSOAPNote({ ...soapNote, subjective: e.target.value })}
                  onFocus={() => setActiveSection('subjective')}
                  placeholder="Patient's chief complaint, HPI, PMH, medications, allergies..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-colors resize-none"
                  rows={4}
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Objective (O)
                </label>
                <textarea
                  value={soapNote.objective}
                  onChange={(e) => setSOAPNote({ ...soapNote, objective: e.target.value })}
                  onFocus={() => setActiveSection('objective')}
                  placeholder="Vital signs, physical exam findings, lab results..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-colors resize-none"
                  rows={4}
                />
              </div>

              {/* Assessment */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Assessment (A)
                </label>
                <textarea
                  value={soapNote.assessment}
                  onChange={(e) => setSOAPNote({ ...soapNote, assessment: e.target.value })}
                  onFocus={() => setActiveSection('assessment')}
                  placeholder="Primary diagnosis, differential diagnoses, ICD-10 codes..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-colors resize-none"
                  rows={3}
                />
              </div>

              {/* Plan */}
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Plan (P)
                </label>
                <textarea
                  value={soapNote.plan}
                  onChange={(e) => setSOAPNote({ ...soapNote, plan: e.target.value })}
                  onFocus={() => setActiveSection('plan')}
                  placeholder="Treatment plan, medications, follow-up, patient education..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-colors resize-none"
                  rows={5}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isGrading || !soapNote.subjective || !soapNote.objective || !soapNote.assessment || !soapNote.plan}
              className="w-full mt-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white
                rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isGrading ? 'Grading Note...' : 'Submit for AI Grading'}
            </button>
          </div>
        </div>
      </div>

      {/* Grading Results */}
      <AnimatePresence>
        {gradingResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl"
          >
            {/* Overall Score */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Grading Results
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Your SOAP note has been analyzed by our AI attending
                  </p>
                </div>
                <div className="text-center">
                  <div className={`flex items-center gap-2 ${getScoreColor(gradingResult.overallScore)} mb-2`}>
                    {getGradeIcon(gradingResult.grade)}
                  </div>
                  <div className={`text-5xl font-bold ${getScoreColor(gradingResult.overallScore)}`}>
                    {gradingResult.grade}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 text-sm">
                    {gradingResult.overallScore}%
                  </div>
                </div>
              </div>
            </div>

            {/* Section Scores */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              {Object.entries(gradingResult.sectionScores).map(([section, score]) => (
                <div key={section} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 capitalize">
                    {section}
                  </div>
                  <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                    {score}%
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Feedback */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h4 className="font-bold text-gray-900 dark:text-white">Strengths</h4>
                </div>
                <ul className="space-y-2">
                  {gradingResult.feedback.strengths.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Areas for Improvement */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  <h4 className="font-bold text-gray-900 dark:text-white">Areas for Improvement</h4>
                </div>
                <ul className="space-y-2">
                  {gradingResult.feedback.improvements.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-yellow-600 dark:text-yellow-400 mt-1">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Critical Missing */}
              {gradingResult.feedback.criticalMissing.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="font-bold text-gray-900 dark:text-white">Critical Missing</h4>
                  </div>
                  <ul className="space-y-2">
                    {gradingResult.feedback.criticalMissing.map((item, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 mt-1">!</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Billing Elements */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-bold text-gray-900 dark:text-white">Billing Elements</h4>
                </div>
                <ul className="space-y-2">
                  {gradingResult.feedback.billingElements.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">$</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Grading configuration


export default SOAPNoteTrainer;
