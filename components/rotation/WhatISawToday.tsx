/**
 * What I Saw Today - Reflection Mode
 * Priority 1: Enhanced Rotation Features
 * 
 * Allows students to log patients/conditions seen during their clinical shift
 * and generates targeted review questions immediately after clinical exposure
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, Plus, X, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import type { ClinicalRotation, SystemCode } from '@/types';

interface PatientEncounter {
  chiefComplaint: string;
  diagnosis?: string;
  system?: SystemCode;
  notableFindings?: string;
}

interface WhatISawTodayProps {
  currentRotation: ClinicalRotation | null;
  onGenerateQuestions: (encounters: PatientEncounter[]) => void;
  onClose: () => void;
}

export const WhatISawToday: React.FC<WhatISawTodayProps> = ({
  currentRotation,
  onGenerateQuestions,
  onClose,
}) => {
  const [encounters, setEncounters] = useState<PatientEncounter[]>([]);
  const [currentEncounter, setCurrentEncounter] = useState<PatientEncounter>({
    chiefComplaint: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddEncounter = () => {
    if (currentEncounter.chiefComplaint.trim()) {
      setEncounters([...encounters, currentEncounter]);
      setCurrentEncounter({ chiefComplaint: '' });
    }
  };

  const handleRemoveEncounter = (index: number) => {
    setEncounters(encounters.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (encounters.length === 0) return;
    
    setIsGenerating(true);
    try {
      await onGenerateQuestions(encounters);
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick add buttons for common chief complaints by rotation
  const quickAddSuggestions: Record<string, string[]> = {
    'Emergency Medicine': ['Chest pain', 'Shortness of breath', 'Abdominal pain', 'Trauma', 'Altered mental status'],
    'Family Medicine': ['Wellness exam', 'Diabetes follow-up', 'Hypertension', 'URI', 'Depression screening'],
    'Internal Medicine': ['CHF exacerbation', 'COPD exacerbation', 'Pneumonia', 'DVT/PE', 'AKI'],
    'Surgery': ['Appendicitis', 'Cholecystitis', 'Small bowel obstruction', 'Hernia repair', 'Post-op check'],
    'Pediatrics': ['Well child visit', 'Fever', 'Asthma', 'Developmental delay', 'Vaccination'],
    'Psychiatry': ['Depression', 'Anxiety', 'Bipolar disorder', 'Schizophrenia', 'Substance use'],
    'Obstetrics & Gynecology': ['Prenatal visit', 'Labor', 'Abnormal bleeding', 'Pelvic pain', 'Contraception'],
  };

  const suggestions = currentRotation ? quickAddSuggestions[currentRotation] || [] : [];

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-full">
              <Stethoscope className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                What I Saw Today
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {currentRotation || 'Clinical rotation'} reflection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <Clock className="inline w-4 h-4 mr-2" />
              <strong>End-of-shift reflection:</strong> Log the patients you saw today to generate targeted review questions. This reinforces learning immediately after clinical exposure.
            </p>
          </div>

          {/* Quick add suggestions */}
          {suggestions.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 block">
                Quick Add (Common in {currentRotation})
              </label>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setEncounters([...encounters, { chiefComplaint: suggestion }]);
                    }}
                    className="px-3 py-1.5 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add encounter form */}
          <div>
            <label className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 block">
              Add Patient Encounter
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentEncounter.chiefComplaint}
                onChange={(e) =>
                  setCurrentEncounter({ ...currentEncounter, chiefComplaint: e.target.value })
                }
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEncounter();
                  }
                }}
                placeholder="e.g., Chest pain, COPD exacerbation, Sprained ankle"
                className="flex-1 px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
              />
              <button
                onClick={handleAddEncounter}
                disabled={!currentEncounter.chiefComplaint.trim()}
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Encounter list */}
          {encounters.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 block">
                Today's Encounters ({encounters.length})
              </label>
              <div className="space-y-2">
                <AnimatePresence>
                  {encounters.map((encounter, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="flex-1 text-sm text-[var(--color-text-primary)]">
                        {encounter.chiefComplaint}
                        {encounter.diagnosis && (
                          <span className="text-[var(--color-text-muted)] ml-2">
                            → {encounter.diagnosis}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveEncounter(index)}
                        className="p-1 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                        aria-label="Remove encounter"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Generate questions button */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={encounters.length === 0 || isGenerating}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  Generate {encounters.length * 3} Review Questions
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* Info footer */}
          <div className="text-xs text-[var(--color-text-muted)] text-center pt-2">
            Generates 3 questions per encounter focusing on key concepts and differentials
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WhatISawToday;
