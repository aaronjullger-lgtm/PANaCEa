/**
 * Polypharmacy Puzzle Mode
 *
 * Interactive drug interaction and optimization challenge.
 * Students review complex medication lists, identify interactions,
 * contraindications, and redundancies, then optimize therapy.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pill,
  Info,
  Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import { InlineSpinner } from '@/components/loading';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

interface PolypharmacyPuzzleModeProps {
  onExit?: () => void;
}

interface Drug {
  id: string;
  name: string;
  genericName: string;
  indication: string;
  dose: string;
  frequency: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  clinicalImplication: string;
}

interface MedicationList {
  patientAge: number;
  patientSex: 'M' | 'F';
  conditions: string[];
  allergies: string[];
  renalFunction: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  medications: Drug[];
  interactions: DrugInteraction[];
  redundancies: string[];
  contraindications: string[];
}

interface PolypharmacyCase {
  id: string;
  scenario: string;
  medicationList: MedicationList;
  correctIdentifications: {
    interactions: number;
    redundancies: number;
    contraindications: number;
  };
  explanation: string;
}

// Sample cases for demonstration
const SAMPLE_CASES: PolypharmacyCase[] = [
  {
    id: 'case-1',
    scenario:
      '72-year-old male with hypertension, diabetes, depression, and recent MI. Recent labs show GFR 45 mL/min.',
    medicationList: {
      patientAge: 72,
      patientSex: 'M',
      conditions: ['Hypertension', 'Type 2 Diabetes', 'Depression', 'Post-MI'],
      allergies: [],
      renalFunction: 'moderate_impairment',
      medications: [
        {
          id: 'med-1',
          name: 'Lisinopril',
          genericName: 'lisinopril',
          indication: 'Hypertension',
          dose: '20 mg',
          frequency: 'daily',
        },
        {
          id: 'med-2',
          name: 'Metformin',
          genericName: 'metformin',
          indication: 'Diabetes',
          dose: '1000 mg',
          frequency: 'BID',
        },
        {
          id: 'med-3',
          name: 'NSAIDs (ibuprofen)',
          genericName: 'ibuprofen',
          indication: 'Pain',
          dose: '800 mg',
          frequency: 'TID',
        },
        {
          id: 'med-4',
          name: 'Aspirin',
          genericName: 'aspirin',
          indication: 'Post-MI',
          dose: '81 mg',
          frequency: 'daily',
        },
        {
          id: 'med-5',
          name: 'Citalopram',
          genericName: 'citalopram',
          indication: 'Depression',
          dose: '40 mg',
          frequency: 'daily',
        },
        {
          id: 'med-6',
          name: 'Metoprolol',
          genericName: 'metoprolol',
          indication: 'Post-MI',
          dose: '50 mg',
          frequency: 'BID',
        },
        {
          id: 'med-7',
          name: 'Omeprazole',
          genericName: 'omeprazole',
          indication: 'GERD',
          dose: '20 mg',
          frequency: 'daily',
        },
      ],
      interactions: [
        {
          drug1: 'NSAIDs (ibuprofen)',
          drug2: 'Lisinopril',
          severity: 'major',
          description: 'NSAIDs reduce ACE inhibitor efficacy and increase renal injury risk',
          clinicalImplication: 'Consider acetaminophen instead; monitor BP and renal function',
        },
        {
          drug1: 'NSAIDs (ibuprofen)',
          drug2: 'Aspirin',
          severity: 'major',
          description: 'Increased bleeding risk and GI ulceration',
          clinicalImplication: 'Avoid combination; use PPI if NSAIDs necessary',
        },
      ],
      redundancies: [],
      contraindications: ['Metformin contraindicated with GFR <45 mL/min (lactic acidosis risk)'],
    },
    correctIdentifications: {
      interactions: 2,
      redundancies: 0,
      contraindications: 1,
    },
    explanation:
      'Major issues: NSAIDs interfere with ACE inhibitor and aspirin, increase bleeding/renal risk. Metformin should be held or dose-adjusted with GFR 45. Consider alternatives: acetaminophen for pain, switch to insulin or sulfonylurea for diabetes.',
  },
];

const PolypharmacyPuzzleMode: React.FC<PolypharmacyPuzzleModeProps> = ({ onExit }) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentCase, setCurrentCase] = useState<PolypharmacyCase | null>(null);
  const [selectedDrugs, setSelectedDrugs] = useState<Set<string>>(new Set());
  const [identifiedIssues, setIdentifiedIssues] = useState({
    interactions: [] as string[],
    redundancies: [] as string[],
    contraindications: [] as string[],
  });
  const [showResults, setShowResults] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  // Fetch case from API or use demo data
  useEffect(() => {
    const loadCase = async () => {
      try {
        const token = await getToken();
        if (!token) {
          // Use demo case if not authenticated
          setCurrentCase(SAMPLE_CASES[0]!);
          setLoading(false);
          return;
        }

        const response = await fetch(
          '/api/questions/polypharmacy-drill?count=1&difficulty=medium',
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          // Middleware strips the `{ data: ... }` envelope at the HTTP layer,
          // so `cases` lives at the top level of response.json(). The old check
          // for `data.data.cases` matched neither shape and silently fell
          // through to SAMPLE_CASES[0] — every student got the demo case
          // instead of a real generated one. unwrapApiEnvelope() handles both
          // shapes defensively in case some deployed version still double-wraps.
          const json: any = await response.json();
          const data = unwrapApiEnvelope<{ cases?: PolypharmacyCase[] }>(json);
          const cases = data?.cases;
          if (Array.isArray(cases) && cases[0]) {
            setCurrentCase(cases[0] as PolypharmacyCase);
          } else {
            setCurrentCase(SAMPLE_CASES[0]!);
          }
        } else {
          // Fallback to demo
          setCurrentCase(SAMPLE_CASES[0]!);
        }
      } catch (error) {
        console.error('Failed to load polypharmacy case:', error);
        setCurrentCase(SAMPLE_CASES[0]!);
      } finally {
        setLoading(false);
      }
    };

    loadCase();
  }, [getToken]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const toggleDrugSelection = (drugId: string) => {
    const newSelection = new Set(selectedDrugs);
    if (newSelection.has(drugId)) {
      newSelection.delete(drugId);
    } else {
      newSelection.add(drugId);
    }
    setSelectedDrugs(newSelection);
  };

  const identifyIssue = (
    type: 'interaction' | 'redundancy' | 'contraindication',
    value: string
  ) => {
    setIdentifiedIssues((prev) => ({
      ...prev,
      [`${type}s`]: [...prev[`${type}s` as keyof typeof prev], value],
    }));
  };

  const checkInteraction = () => {
    if (!currentCase) return;

    const selectedArray = Array.from(selectedDrugs);
    if (selectedArray.length !== 2) {
      toast.error('Select exactly 2 drugs to check for interaction');
      return;
    }

    const drug1Name = currentCase.medicationList.medications.find(
      (m) => m.id === selectedArray[0]
    )?.name;
    const drug2Name = currentCase.medicationList.medications.find(
      (m) => m.id === selectedArray[1]
    )?.name;

    const interaction = currentCase.medicationList.interactions.find(
      (i) =>
        (i.drug1 === drug1Name && i.drug2 === drug2Name) ||
        (i.drug1 === drug2Name && i.drug2 === drug1Name)
    );

    if (interaction) {
      const issueId = `${drug1Name}-${drug2Name}`;
      if (!identifiedIssues.interactions.includes(issueId)) {
        identifyIssue('interaction', issueId);
        toast.success(`✓ Interaction found: ${interaction.severity.toUpperCase()}`, {
          description: interaction.description,
        });
      } else {
        toast.info('Already identified this interaction');
      }
    } else {
      toast.error('No interaction between these drugs');
    }

    setSelectedDrugs(new Set());
  };

  const checkContraindication = (drugId: string) => {
    if (!currentCase) return;

    const drug = currentCase.medicationList.medications.find((m) => m.id === drugId);
    if (!drug) return;

    const hasContraindication = currentCase.medicationList.contraindications.some(
      (c) => c.includes(drug.name) || c.includes(drug.genericName)
    );

    if (hasContraindication) {
      if (!identifiedIssues.contraindications.includes(drug.name)) {
        identifyIssue('contraindication', drug.name);
        toast.success(`✓ Contraindication found: ${drug.name}`);
      }
    } else {
      toast.error('No contraindication for this medication');
    }
  };

  const submitAnswer = () => {
    setShowResults(true);

    const score = calculateScore();
    if (score >= 80) {
      toast.success('Excellent work! Medication list optimized safely.', {
        duration: 5000,
      });
    } else if (score >= 60) {
      toast.warning('Good effort, but some issues missed.', {
        duration: 5000,
      });
    } else {
      toast.error('Review the explanation - several critical issues missed.', {
        duration: 5000,
      });
    }
  };

  const calculateScore = () => {
    if (!currentCase) return 0;
    const { correctIdentifications } = currentCase;
    const totalCorrect =
      correctIdentifications.interactions +
      correctIdentifications.redundancies +
      correctIdentifications.contraindications;
    const totalIdentified =
      identifiedIssues.interactions.length +
      identifiedIssues.redundancies.length +
      identifiedIssues.contraindications.length;

    if (totalCorrect === 0) return 0;
    return Math.min(100, Math.round((totalIdentified / totalCorrect) * 100));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity: 'major' | 'moderate' | 'minor') => {
    switch (severity) {
      case 'major':
        return 'text-data-fail';
      case 'moderate':
        return 'text-data-provisional';
      case 'minor':
        return 'text-[var(--color-data-provisional)]';
    }
  };

  const getRenalFunctionLabel = (rf: string) => {
    return rf
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Loading state
  if (loading || !currentCase) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div role="status" aria-live="polite" aria-label="Loading medication case" className="text-center">
          <div className="flex justify-center mb-4">
            <InlineSpinner size="xl" className="text-[var(--color-accent)]" />
          </div>
          <p className="text-[var(--color-text-muted)]">Loading medication case...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="w-5 h-5" />
            Exit
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
              <Clock className="w-5 h-5" />
              {formatTime(timeElapsed)}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
              <Brain className="w-5 h-5" />
              Issues Found:{' '}
              {identifiedIssues.interactions.length + identifiedIssues.contraindications.length}
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
            <Pill className="w-6 h-6 text-data-pass" />
            Polypharmacy Puzzle
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Review the medication list and identify interactions, contraindications, and
            redundancies
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Patient Info & Scenario */}
        <div className="space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Patient Information
            </h2>
            <div className="space-y-2 text-sm">
              <p className="text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-text-primary)]">Age/Sex:</span>{' '}
                {currentCase.medicationList.patientAge} years,{' '}
                {currentCase.medicationList.patientSex}
              </p>
              <p className="text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-text-primary)]">
                  Renal Function:
                </span>{' '}
                {getRenalFunctionLabel(currentCase.medicationList.renalFunction)}
              </p>
              <div>
                <span className="font-medium text-[var(--color-text-primary)]">Conditions:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentCase.medicationList.conditions.map((condition) => (
                    <span
                      key={condition}
                      className="px-2 py-1 rounded bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] text-[var(--color-category-practice)] text-xs"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Clinical Scenario
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm">{currentCase.scenario}</p>
          </div>

          {/* Action Panel */}
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={checkInteraction}
                disabled={selectedDrugs.size !== 2}
                title={
                  selectedDrugs.size !== 2
                    ? 'Select exactly 2 medications to check for interactions'
                    : 'Check for drug-drug interaction'
                }
                className="w-full px-4 py-3 rounded-lg bg-data-provisional/20 hover:bg-data-provisional/30 disabled:opacity-50 disabled:cursor-not-allowed border border-data-provisional/50 text-data-provisional font-medium transition-colors duration-200"
              >
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                Check Interaction ({selectedDrugs.size}/2 selected)
              </button>

              {!showResults && (
                <button
                  onClick={submitAnswer}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-text-inverse)] font-medium transition-colors duration-200"
                >
                  Submit Answer
                </button>
              )}
            </div>

            <div className="mt-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Select 2 drugs to check interactions. Click individual drugs to check
                contraindications.
              </p>
            </div>
          </div>
        </div>

        {/* Medication List */}
        <div className="space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Medication List
            </h2>
            <div className="space-y-2">
              {currentCase.medicationList.medications.map((med) => (
                <motion.div
                  key={med.id}
                  role="checkbox"
                  aria-checked={selectedDrugs.has(med.id)}
                  tabIndex={0}
                  onClick={() => toggleDrugSelection(med.id)}
                  onDoubleClick={() => checkContraindication(med.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDrugSelection(med.id); } }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedDrugs.has(med.id)
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 bg-[var(--color-bg-tertiary)]'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{med.name}</h3>
                      <p className="text-xs text-[var(--color-text-muted)]">{med.genericName}</p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        {med.dose} {med.frequency}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        For: {med.indication}
                      </p>
                    </div>
                    {selectedDrugs.has(med.id) && (
                      <CheckCircle className="w-5 h-5 text-[var(--color-accent)]" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4 text-center">
              Click to select • Double-click to check contraindication
            </p>
          </div>

          {/* Results */}
          <AnimatePresence>
            {showResults && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Results
                  </h2>
                  <div className="text-3xl font-bold text-[var(--color-accent)]">
                    {calculateScore()}%
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                      Key Interactions:
                    </h3>
                    {currentCase.medicationList.interactions.map((interaction, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-data-fail/10 border border-data-fail/30 rounded-lg mb-2"
                      >
                        <p className="text-sm font-medium text-data-fail">
                          {interaction.drug1} + {interaction.drug2}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {interaction.description}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          → {interaction.clinicalImplication}
                        </p>
                      </div>
                    ))}
                  </div>

                  {currentCase.medicationList.contraindications.length > 0 && (
                    <div>
                      <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
                        Contraindications:
                      </h3>
                      {currentCase.medicationList.contraindications.map((contra, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-data-provisional/10 border border-data-provisional/30 rounded-lg mb-2"
                        >
                          <p className="text-sm text-data-provisional">{contra}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Clinical Pearls
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {currentCase.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PolypharmacyPuzzleMode;
