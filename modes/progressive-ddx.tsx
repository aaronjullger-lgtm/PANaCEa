/**
 * Progressive Differential Diagnosis Mode
 * Priority 3: Enhanced DDx Training
 * 
 * Presents clinical case information gradually (chief complaint → vitals → exam → labs)
 * Students update their differential diagnosis at each stage
 * AI scores reasoning process, not just final answer
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, CheckCircle, X, Activity, Eye, FlaskConical, Brain } from 'lucide-react';

interface DiagnosisOption {
  id: string;
  name: string;
  isCorrect: boolean;
  likelihood: 'high' | 'medium' | 'low';
}

interface CaseStage {
  stage: 'complaint' | 'vitals' | 'exam' | 'labs';
  title: string;
  icon: React.ElementType;
  information: string;
  timeLimit: number; // seconds
}

interface ProgressiveDdxCase {
  id: string;
  patientAge: number;
  patientSex: 'M' | 'F';
  stages: CaseStage[];
  diagnosisOptions: DiagnosisOption[];
  correctDiagnosis: string;
  teachingPoints: string[];
  criticalRedFlags: string[];
}

interface DifferentialEntry {
  diagnosisId: string;
  probability: number; // 0-100
  stage: number;
}

export const ProgressiveDdxMode: React.FC = () => {
  // Mock case data (in production, fetch from API)
  const mockCase: ProgressiveDdxCase = {
    id: 'case_001',
    patientAge: 65,
    patientSex: 'M',
    stages: [
      {
        stage: 'complaint',
        title: 'Chief Complaint',
        icon: Brain,
        information: '65-year-old male presents with acute onset chest pain that started 2 hours ago while watching TV. Pain described as "crushing" and radiates to left arm.',
        timeLimit: 30,
      },
      {
        stage: 'vitals',
        title: 'Vital Signs',
        icon: Activity,
        information: 'BP: 158/92, HR: 110, RR: 22, Temp: 98.6°F, SpO2: 94% on RA. Patient appears diaphoretic and anxious.',
        timeLimit: 20,
      },
      {
        stage: 'exam',
        title: 'Physical Exam',
        icon: Eye,
        information: 'CV: Tachycardic, regular rhythm, no murmurs. Lungs: Clear bilaterally. Abdomen: Soft, non-tender. Extremities: No edema. Neurologic: Intact.',
        timeLimit: 30,
      },
      {
        stage: 'labs',
        title: 'Labs & Imaging',
        icon: FlaskConical,
        information: 'ECG: ST elevation in leads II, III, aVF. Troponin I: 2.3 ng/mL (elevated). CXR: Normal cardiac silhouette, no infiltrates.',
        timeLimit: 30,
      },
    ],
    diagnosisOptions: [
      { id: 'stemi', name: 'ST-Elevation MI (STEMI)', isCorrect: true, likelihood: 'high' },
      { id: 'nstemi', name: 'Non-ST-Elevation MI (NSTEMI)', isCorrect: false, likelihood: 'medium' },
      { id: 'unstable_angina', name: 'Unstable Angina', isCorrect: false, likelihood: 'medium' },
      { id: 'pe', name: 'Pulmonary Embolism', isCorrect: false, likelihood: 'low' },
      { id: 'aortic_dissection', name: 'Aortic Dissection', isCorrect: false, likelihood: 'medium' },
      { id: 'pericarditis', name: 'Acute Pericarditis', isCorrect: false, likelihood: 'low' },
      { id: 'gerd', name: 'GERD', isCorrect: false, likelihood: 'low' },
    ],
    correctDiagnosis: 'stemi',
    teachingPoints: [
      'ST elevation in inferior leads (II, III, aVF) indicates inferior wall STEMI',
      'Immediate cardiology consultation and cath lab activation required',
      'Time = muscle: Goal is PCI within 90 minutes of presentation',
      'Aspirin, antiplatelet therapy, and anticoagulation should be initiated immediately',
    ],
    criticalRedFlags: [
      'ST elevation on ECG - indicates transmural infarction',
      'Elevated troponin confirms myocardial injury',
      'Diaphoresis and radiation to left arm are classic MI symptoms',
    ],
  };

  const [currentCase] = useState<ProgressiveDdxCase>(mockCase);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [differential, setDifferential] = useState<DifferentialEntry[]>([]);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Set<string>>(new Set());
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const currentStage = currentCase.stages[currentStageIndex];
  const isLastStage = currentStageIndex === currentCase.stages.length - 1;

  const handleToggleDiagnosis = (diagnosisId: string) => {
    setSelectedDiagnoses((prev) => {
      const next = new Set(prev);
      if (next.has(diagnosisId)) {
        next.delete(diagnosisId);
      } else {
        next.add(diagnosisId);
      }
      return next;
    });
  };

  const handleProbabilityChange = (diagnosisId: string, probability: number) => {
    setDifferential((prev) => {
      const existing = prev.find((d) => d.diagnosisId === diagnosisId);
      if (existing) {
        return prev.map((d) =>
          d.diagnosisId === diagnosisId ? { ...d, probability } : d
        );
      }
      return [...prev, { diagnosisId, probability, stage: currentStageIndex }];
    });
  };

  const handleNextStage = () => {
    // Save current differential state
    selectedDiagnoses.forEach((diagnosisId) => {
      if (!differential.find((d) => d.diagnosisId === diagnosisId)) {
        setDifferential((prev) => [
          ...prev,
          { diagnosisId, probability: 50, stage: currentStageIndex },
        ]);
      }
    });

    if (isLastStage) {
      calculateScore();
      setIsComplete(true);
    } else {
      setCurrentStageIndex((prev) => prev + 1);
    }
  };

  const calculateScore = useCallback(() => {
    // Scoring logic:
    // 1. Correct diagnosis included early? +30 points
    // 2. Correct diagnosis has high probability? +30 points
    // 3. Dangerous diagnoses not missed? +20 points
    // 4. Appropriate probability updates at each stage? +20 points

    let totalScore = 0;

    // Check if correct diagnosis was included
    const correctDiagEntry = differential.find(
      (d) => d.diagnosisId === currentCase.correctDiagnosis
    );

    if (correctDiagEntry) {
      // Early inclusion bonus
      if (correctDiagEntry.stage === 0) totalScore += 30;
      else if (correctDiagEntry.stage === 1) totalScore += 25;
      else if (correctDiagEntry.stage === 2) totalScore += 20;
      else totalScore += 15;

      // High probability bonus
      if (correctDiagEntry.probability >= 80) totalScore += 30;
      else if (correctDiagEntry.probability >= 60) totalScore += 20;
      else if (correctDiagEntry.probability >= 40) totalScore += 10;
    }

    // Check dangerous diagnoses (PE, aortic dissection)
    const dangerousDiagnoses = ['pe', 'aortic_dissection'];
    const consideredDangerous = differential.filter((d) =>
      dangerousDiagnoses.includes(d.diagnosisId)
    );
    if (consideredDangerous.length > 0) totalScore += 20;

    // Reasoning quality (did probabilities change appropriately?)
    // This would require more complex logic in production
    totalScore += 20; // Simplified for now

    setScore(totalScore);
  }, [differential, currentCase.correctDiagnosis]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 75) return 'text-blue-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isComplete && score !== null) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-2xl p-8"
        >
          <div className="text-center mb-8">
            <div className={`text-6xl font-bold ${getScoreColor(score)} mb-2`}>
              {score}/100
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Clinical Reasoning Score
            </h2>
            <p className="text-[var(--color-text-muted)]">
              {score >= 90 && 'Excellent clinical reasoning!'}
              {score >= 75 && score < 90 && 'Good diagnostic approach'}
              {score >= 60 && score < 75 && 'Room for improvement'}
              {score < 60 && 'Review key diagnostic principles'}
            </p>
          </div>

          {/* Correct Diagnosis */}
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Correct Diagnosis
            </h3>
            <p className="text-green-700 dark:text-green-300">
              {currentCase.diagnosisOptions.find((d) => d.isCorrect)?.name}
            </p>
          </div>

          {/* Teaching Points */}
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
              Key Teaching Points
            </h3>
            <ul className="space-y-2">
              {currentCase.teachingPoints.map((point, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <ChevronRight className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Critical Red Flags */}
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
              Critical Red Flags
            </h3>
            <ul className="space-y-2">
              {currentCase.criticalRedFlags.map((flag, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400"
                >
                  <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-[var(--color-accent)] text-white rounded-lg font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Next Case
          </button>
        </motion.div>
      </div>
    );
  }

  const StageIcon = currentStage.icon;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-text-muted)]">
            Stage {currentStageIndex + 1} of {currentCase.stages.length}
          </span>
          <span className="text-sm font-medium text-[var(--color-text-muted)]">
            {Math.round(((currentStageIndex + 1) / currentCase.stages.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
          <div
            className="h-2 bg-[var(--color-accent)] rounded-full transition-all duration-300"
            style={{ width: `${((currentStageIndex + 1) / currentCase.stages.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Patient Info */}
      <div className="mb-6 p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg">
        <p className="text-sm text-[var(--color-text-secondary)]">
          <strong>Patient:</strong> {currentCase.patientAge}-year-old {currentCase.patientSex === 'M' ? 'male' : 'female'}
        </p>
      </div>

      {/* Current Stage Information */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStageIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="mb-6 p-6 bg-[var(--color-card-bg)] border-2 border-[var(--color-accent)] rounded-xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[var(--color-accent)]/20 rounded-full">
              <StageIcon className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              {currentStage.title}
            </h2>
          </div>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            {currentStage.information}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Differential Diagnosis Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Update Your Differential Diagnosis
        </h3>
        <div className="space-y-2">
          {currentCase.diagnosisOptions.map((diagnosis) => {
            const isSelected = selectedDiagnoses.has(diagnosis.id);
            const diffEntry = differential.find((d) => d.diagnosisId === diagnosis.id);

            return (
              <div
                key={diagnosis.id}
                className={`p-4 border-2 rounded-lg transition-all ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-card-bg)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => handleToggleDiagnosis(diagnosis.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                          : 'border-[var(--color-border)]'
                      }`}
                    >
                      {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {diagnosis.name}
                    </span>
                  </button>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <label className="text-xs text-[var(--color-text-muted)] mb-2 block">
                      Probability: {diffEntry?.probability || 50}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={diffEntry?.probability || 50}
                      onChange={(e) =>
                        handleProbabilityChange(diagnosis.id, parseInt(e.target.value))
                      }
                      className="w-full"
                    />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Button */}
      <button
        onClick={handleNextStage}
        disabled={selectedDiagnoses.size === 0}
        className="w-full py-3 bg-[var(--color-accent)] text-white rounded-lg font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLastStage ? 'Submit Final Diagnosis' : 'Continue to Next Stage'}
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ProgressiveDdxMode;
