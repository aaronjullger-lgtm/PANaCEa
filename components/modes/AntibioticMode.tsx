import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  X,
  CheckCircle,
  XCircle,
  Pill,
  ArrowRight,
  RotateCcw,
  Shuffle,
  Play,
  Bug,
  Zap,
  AlertTriangle,
  Target,
  AlertCircle,
} from 'lucide-react';
import type {
  AntibioticDrillQuestion,
  OrganismInfection,
  AntibioticDrug,
} from '@/types/drill-modes';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { toTitleCase } from '@/lib/textUtils';
import { submitDrillResult } from '@/services/core';

interface AntibioticModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'loading' | 'active' | 'error';

interface AntibioticGuideline {
  id: string;
  organism: string;
  class: string;
  effective: string[];
  resistant: string[];
  notes?: string | null;
  description?: string | null;
}

/**
 * Static antibiotic drug database (reference data)
 */
const ANTIBIOTICS: AntibioticDrug[] = [
  { id: 'abx-001', name: 'Penicillin', class: 'Beta-lactam', description: 'Natural penicillin' },
  { id: 'abx-002', name: 'Amoxicillin', class: 'Beta-lactam', description: 'Aminopenicillin' },
  {
    id: 'abx-003',
    name: 'Amoxicillin-Clavulanate',
    class: 'Beta-lactam + Inhibitor',
    description: 'Extended spectrum',
  },
  {
    id: 'abx-004',
    name: 'Nafcillin',
    class: 'Beta-lactam',
    description: 'Anti-staphylococcal penicillin',
  },
  {
    id: 'abx-005',
    name: 'Piperacillin-Tazobactam',
    class: 'Beta-lactam + Inhibitor',
    description: 'Anti-pseudomonal',
  },
  {
    id: 'abx-006',
    name: 'Ceftriaxone',
    class: 'Cephalosporin (3rd gen)',
    description: 'Broad spectrum',
  },
  {
    id: 'abx-007',
    name: 'Cefepime',
    class: 'Cephalosporin (4th gen)',
    description: 'Anti-pseudomonal',
  },
  { id: 'abx-008', name: 'Vancomycin', class: 'Glycopeptide', description: 'MRSA coverage' },
  { id: 'abx-009', name: 'Azithromycin', class: 'Macrolide', description: 'Atypical coverage' },
  {
    id: 'abx-010',
    name: 'Ciprofloxacin',
    class: 'Fluoroquinolone',
    description: 'Gram-negative, atypical',
  },
  {
    id: 'abx-011',
    name: 'Levofloxacin',
    class: 'Fluoroquinolone',
    description: 'Respiratory quinolone',
  },
  {
    id: 'abx-012',
    name: 'Doxycycline',
    class: 'Tetracycline',
    description: 'Atypical, tick-borne',
  },
  {
    id: 'abx-013',
    name: 'Metronidazole',
    class: 'Nitroimidazole',
    description: 'Anaerobic coverage',
  },
  {
    id: 'abx-014',
    name: 'Meropenem',
    class: 'Carbapenem',
    description: 'Broad spectrum, last-line',
  },
  {
    id: 'abx-015',
    name: 'Fluconazole',
    class: 'Azole antifungal',
    description: 'Candida coverage',
  },
];

/**
 * Fetch antibiotic guidelines from database
 */
const fetchAntibioticGuidelines = async (): Promise<AntibioticGuideline[]> => {
  try {
    const response = await fetch('/api/drills/antibiotics');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = (await response.json()) as { guidelines?: AntibioticGuideline[] };
    return data.guidelines || [];
  } catch (error) {
    console.error('Failed to fetch antibiotic guidelines:', error);
    return [];
  }
};

/**
 * Generate a coverage drill question from guidelines
 */
const generateCoverageDrill = (
  guidelines: AntibioticGuideline[]
): AntibioticDrillQuestion | null => {
  if (guidelines.length === 0) return null;

  const guidelineIndex = Math.floor(Math.random() * guidelines.length);
  const guideline = guidelines[guidelineIndex];

  // Guard for array access returning undefined
  if (!guideline) return null;

  const organism: OrganismInfection = {
    id: guideline.id,
    name: guideline.organism,
    category: guideline.class.toLowerCase().replace(' ', '_') as OrganismInfection['category'],
    description: guideline.description || undefined,
  };

  // Map drug names to IDs
  const correctDrugs = guideline.effective
    .map((drugName) => ANTIBIOTICS.find((d) => d.name === drugName)?.id)
    .filter((id): id is string => id !== undefined);

  return {
    id: `drill-cov-${Date.now()}`,
    type: 'coverage',
    organism,
    correctDrugs,
    explanation:
      guideline.notes ||
      `For ${guideline.organism}, appropriate antibiotics include those targeting ${guideline.class} bacteria. ${guideline.effective.join(', ')} provide effective coverage.`,
  };
};

/**
 * Generate mechanism, side effects, and empiric drill questions
 * (keeping existing static question data for these types)
 */
const generateMechanismDrill = (): AntibioticDrillQuestion | null => {
  // Get antibiotics safely with guards
  const penicillin = ANTIBIOTICS[0];
  const vancomycin = ANTIBIOTICS[7];
  const azithromycin = ANTIBIOTICS[8];

  if (!penicillin || !vancomycin || !azithromycin) return null;

  const mechanisms = [
    {
      drug: penicillin, // Penicillin
      question: 'What is the mechanism of action of Penicillin?',
      choices: [
        'Inhibits cell wall synthesis by binding PBPs',
        'Inhibits protein synthesis at 30S ribosome',
        'Inhibits DNA gyrase',
        'Inhibits folic acid synthesis',
      ],
      correctIndex: 0,
      explanation:
        'Beta-lactams like Penicillin inhibit cell wall synthesis by binding to penicillin-binding proteins (PBPs), preventing peptidoglycan cross-linking.',
    },
    {
      drug: vancomycin, // Vancomycin
      question: 'What is the mechanism of action of Vancomycin?',
      choices: [
        'Inhibits protein synthesis at 50S ribosome',
        'Inhibits cell wall synthesis by binding D-Ala-D-Ala',
        'Disrupts cell membrane',
        'Inhibits folic acid synthesis',
      ],
      correctIndex: 1,
      explanation:
        'Vancomycin inhibits cell wall synthesis by binding to D-Ala-D-Ala terminal of peptidoglycan precursors, preventing cross-linking.',
    },
    {
      drug: azithromycin, // Azithromycin
      question: 'What is the mechanism of action of Azithromycin?',
      choices: [
        'Inhibits cell wall synthesis',
        'Inhibits protein synthesis at 50S ribosome',
        'Inhibits DNA gyrase',
        'Inhibits folic acid synthesis',
      ],
      correctIndex: 1,
      explanation:
        'Macrolides like Azithromycin inhibit protein synthesis by binding to the 50S ribosomal subunit, blocking translocation.',
    },
  ];

  const selectedIndex = Math.floor(Math.random() * mechanisms.length);
  const selected = mechanisms[selectedIndex];

  // Guard for array access returning undefined
  if (!selected) return null;

  return {
    id: `drill-mech-${Date.now()}`,
    type: 'mechanism',
    drug: selected.drug,
    mechanismQuestion: selected.question,
    mechanismChoices: selected.choices,
    correctMechanismIndex: selected.correctIndex,
    explanation: selected.explanation,
  };
};

const generateSideEffectDrill = (): AntibioticDrillQuestion | null => {
  // Get antibiotics safely with guards
  const azithromycin = ANTIBIOTICS[8];
  const vancomycin = ANTIBIOTICS[7];
  const ciprofloxacin = ANTIBIOTICS[9];

  if (!azithromycin || !vancomycin || !ciprofloxacin) return null;

  const sideEffects = [
    {
      drug: azithromycin, // Azithromycin
      question: 'What is a major adverse effect of Azithromycin?',
      choices: ['Nephrotoxicity', 'QT prolongation', 'Gray baby syndrome', 'Disulfiram reaction'],
      correctIndex: 1,
      explanation:
        'Azithromycin can cause QT prolongation, increasing risk of torsades de pointes, especially in patients with cardiac risk factors.',
    },
    {
      drug: vancomycin, // Vancomycin
      question: 'What are the major toxicities of Vancomycin?',
      choices: [
        'Hepatotoxicity and pancreatitis',
        'Nephrotoxicity and ototoxicity',
        'Bone marrow suppression',
        'Peripheral neuropathy',
      ],
      correctIndex: 1,
      explanation:
        'Vancomycin\'s major toxicities include nephrotoxicity and ototoxicity. "Red man syndrome" from rapid infusion is also notable.',
    },
    {
      drug: ciprofloxacin, // Ciprofloxacin
      question: 'What is a serious adverse effect of Fluoroquinolones like Ciprofloxacin?',
      choices: [
        'Tendon rupture',
        'Aplastic anemia',
        'Stevens-Johnson syndrome',
        'Hemorrhagic cystitis',
      ],
      correctIndex: 0,
      explanation:
        'Fluoroquinolones carry a black box warning for tendon rupture, particularly the Achilles tendon. Risk increases with age >60 and concurrent steroid use.',
    },
  ];

  const selectedIndex = Math.floor(Math.random() * sideEffects.length);
  const selected = sideEffects[selectedIndex];

  // Guard for array access returning undefined
  if (!selected) return null;

  return {
    id: `drill-side-${Date.now()}`,
    type: 'side_effects',
    drug: selected.drug,
    sideEffectQuestion: selected.question,
    sideEffectChoices: selected.choices,
    correctSideEffectIndex: selected.correctIndex,
    explanation: selected.explanation,
  };
};

const generateEmpiricChoiceDrill = (): AntibioticDrillQuestion | null => {
  const scenarios = [
    {
      scenario:
        'A 45-year-old presents with acute cystitis. Urine culture pending. What is the first-line empiric treatment?',
      choices: ['Ciprofloxacin', 'Nitrofurantoin or TMP-SMX', 'Amoxicillin', 'Vancomycin'],
      correctIndex: 1,
      explanation:
        'For uncomplicated UTI, first-line empiric therapy is Nitrofurantoin or TMP-SMX. Fluoroquinolones are reserved for complicated cases.',
    },
    {
      scenario:
        'A patient with suspected community-acquired pneumonia and risk factors for MRSA needs admission. What empiric coverage?',
      choices: [
        'Ceftriaxone + Azithromycin only',
        'Vancomycin + Piperacillin-Tazobactam',
        'Ceftriaxone + Azithromycin + Vancomycin',
        'Azithromycin alone',
      ],
      correctIndex: 2,
      explanation:
        'CAP with MRSA risk requires typical coverage (Ceftriaxone + Azithromycin) plus MRSA coverage (Vancomycin). Alternative: Linezolid instead of Vancomycin.',
    },
    {
      scenario:
        'A patient with hospital-acquired pneumonia and risk for Pseudomonas needs empiric therapy. What do you choose?',
      choices: [
        'Ceftriaxone + Azithromycin',
        'Vancomycin + Cefepime or Piperacillin-Tazobactam',
        'Amoxicillin-Clavulanate',
        'Meropenem alone',
      ],
      correctIndex: 1,
      explanation:
        'HAP with Pseudomonas risk requires anti-pseudomonal beta-lactam (Cefepime, Pip-Tazo, or Meropenem) plus MRSA coverage (Vancomycin or Linezolid).',
    },
  ];

  const selectedIndex = Math.floor(Math.random() * scenarios.length);
  const selected = scenarios[selectedIndex];

  // Guard for array access returning undefined
  if (!selected) return null;

  return {
    id: `drill-emp-${Date.now()}`,
    type: 'empiric_choice',
    clinicalScenario: selected.scenario,
    empiricChoices: selected.choices,
    correctEmpiricIndex: selected.correctIndex,
    explanation: selected.explanation,
  };
};

/**
 * Generate antibiotic drill - now uses database for coverage drills
 */
const generateAntibioticDrill = (
  guidelines: AntibioticGuideline[]
): AntibioticDrillQuestion | null => {
  const types: ('coverage' | 'mechanism' | 'side_effects' | 'empiric_choice')[] = [
    'coverage',
    'mechanism',
    'side_effects',
    'empiric_choice',
  ];
  const typeIndex = Math.floor(Math.random() * types.length);
  const randomType = types[typeIndex];

  // Guard for array access returning undefined - default to coverage
  if (!randomType) {
    return generateCoverageDrill(guidelines);
  }

  switch (randomType) {
    case 'coverage':
      return generateCoverageDrill(guidelines);
    case 'mechanism':
      return generateMechanismDrill();
    case 'side_effects':
      return generateSideEffectDrill();
    case 'empiric_choice':
      return generateEmpiricChoiceDrill();
  }
};

const AntibioticMode: React.FC<AntibioticModeProps> = ({ onExit }) => {
  const { getToken } = useAuth();
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [currentDrill, setCurrentDrill] = useState<AntibioticDrillQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [guidelines, setGuidelines] = useState<AntibioticGuideline[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setViewState('loading');
    setError(null);

    // Fetch guidelines if not already loaded
    let guidelineData = guidelines;
    if (guidelineData.length === 0) {
      guidelineData = await fetchAntibioticGuidelines();
      if (guidelineData.length === 0) {
        setError('Failed to load antibiotic guidelines. Please try again.');
        setViewState('error');
        return;
      }
      setGuidelines(guidelineData);
    }

    const drill = generateAntibioticDrill(guidelineData);
    if (!drill) {
      setError('Failed to generate drill. Please try again.');
      setViewState('error');
      return;
    }

    setCurrentDrill(drill);
    setViewState('active');
  };

  const handleNext = async () => {
    setViewState('loading');
    setSelectedAnswer(null);
    setSelectedDrugs([]);
    setIsSubmitted(false);
    setIsCorrect(false);
    setError(null);

    const drill = generateAntibioticDrill(guidelines);
    if (!drill) {
      setError('Failed to generate next drill. Please try again.');
      setViewState('error');
      return;
    }

    setCurrentDrill(drill);
    setViewState('active');
  };

  const handleReset = () => {
    setScore({ correct: 0, total: 0 });
    handleNext();
  };

  const handleSubmit = () => {
    if (!currentDrill) return;

    let correct = false;

    if (currentDrill.type === 'coverage') {
      // Check if selected drugs match correct drugs
      const correctDrugSet = new Set(currentDrill.correctDrugs || []);
      const selectedDrugSet = new Set(selectedDrugs);
      correct =
        selectedDrugs.length > 0 &&
        selectedDrugs.every((drug) => correctDrugSet.has(drug)) &&
        selectedDrugs.length <= correctDrugSet.size;
    } else {
      // For MCQ-type questions
      correct =
        selectedAnswer === currentDrill.correctMechanismIndex ||
        selectedAnswer === currentDrill.correctSideEffectIndex ||
        selectedAnswer === currentDrill.correctEmpiricIndex;
    }

    setIsCorrect(correct);
    setIsSubmitted(true);
    setScore((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    // Trigger haptic feedback
    if (correct) {
      hapticSuccess();
    } else {
      hapticError();
    }

    // Submit result to backend
    submitDrillResult(
      'antibiotic',
      currentDrill.id,
      correct,
      { title: getDrillTypeLabel(), category: currentDrill.type },
      getToken
    );
  };

  const toggleDrugSelection = (drugId: string) => {
    if (isSubmitted) return;

    setSelectedDrugs((prev) =>
      prev.includes(drugId) ? prev.filter((id) => id !== drugId) : [...prev, drugId]
    );
  };

  const getDrillTypeLabel = (): string => {
    if (!currentDrill) return 'Antibiotic Drill';
    switch (currentDrill.type) {
      case 'coverage':
        return 'Bug-Drug Coverage';
      case 'mechanism':
        return 'Mechanism of Action';
      case 'side_effects':
        return 'Side Effects';
      case 'empiric_choice':
        return 'Empiric Therapy';
      default:
        return 'Antibiotic Drill';
    }
  };

  const getDrillTypeColor = (): string => {
    if (!currentDrill) return 'from-slate-600 to-gray-700';
    switch (currentDrill.type) {
      case 'coverage':
        return 'from-blue-600 to-indigo-700';
      case 'mechanism':
        return 'from-purple-600 to-violet-700';
      case 'side_effects':
        return 'from-red-600 to-rose-700';
      case 'empiric_choice':
        return 'from-emerald-600 to-green-700';
      default:
        return 'from-slate-600 to-gray-700';
    }
  };

  const renderDrillContent = () => {
    if (!currentDrill) return null;
    if (currentDrill.type === 'coverage' && currentDrill.organism) {
      return (
        <div className="space-y-6">
          {/* Organism Card */}
          <div className="bg-white dark:bg-slate-700 rounded-xl p-6 border border-slate-200 dark:border-slate-600 shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-purple-600 dark:text-purple-400">
              Target Organism
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xl font-bold text-slate-800 dark:text-slate-50 mb-2">
                {currentDrill.organism.name}
              </h4>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-3 py-1 bg-purple-50 dark:bg-purple-950/30 rounded-full text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
                  {currentDrill.organism.category.replace('_', ' ')}
                </span>
              </div>
              {currentDrill.organism.description && (
                <p className="text-slate-600 dark:text-slate-300 text-sm mt-3">
                  {currentDrill.organism.description}
                </p>
              )}
            </div>
          </div>

          {/* Drug Selection */}
          <div className="bg-white dark:bg-slate-700 rounded-xl p-6 border border-slate-200 dark:border-slate-600 shadow-md">
            <h3 className="text-lg font-semibold mb-4 text-purple-600 dark:text-purple-400">
              Select Appropriate Antibiotics
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
              Choose one or more antibiotics that provide coverage for this organism.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ANTIBIOTICS.map((drug) => (
                <button
                  key={drug.id}
                  onClick={() => toggleDrugSelection(drug.id)}
                  disabled={isSubmitted}
                  className={`p-4 rounded-lg border-2 transition-all text-left shadow-sm ${
                    selectedDrugs.includes(drug.id)
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300 dark:hover:border-purple-700'
                  } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-50 text-sm">
                    {drug.name}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {toTitleCase(drug.class)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // MCQ-type drills
    const question =
      currentDrill.mechanismQuestion ||
      currentDrill.sideEffectQuestion ||
      currentDrill.clinicalScenario ||
      '';

    const choices =
      currentDrill.mechanismChoices ||
      currentDrill.sideEffectChoices ||
      currentDrill.empiricChoices ||
      [];

    return (
      <div className="space-y-6">
        {/* Drug/Scenario Card */}
        {currentDrill.drug && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-800/30">
            <h3 className="text-lg font-semibold mb-2 text-purple-400">Drug Focus</h3>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-xl font-bold text-white mb-2">{currentDrill.drug.name}</h4>
              <span className="px-3 py-1 bg-purple-900/40 rounded-full text-purple-300 text-sm border border-purple-700/30">
                {toTitleCase(currentDrill.drug.class)}
              </span>
            </div>
          </div>
        )}

        {/* Question */}
        <div className="bg-white dark:bg-slate-700 rounded-xl p-6 border border-slate-200 dark:border-slate-600 shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-purple-600 dark:text-purple-400">
            Question
          </h3>
          <p className="text-slate-800 dark:text-slate-50 mb-6 leading-relaxed font-medium">
            {question}
          </p>

          {/* Answer Choices */}
          <div className="space-y-3">
            {choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(index)}
                disabled={isSubmitted}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left shadow-sm ${
                  selectedAnswer === index
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300 dark:hover:border-purple-700'
                } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedAnswer === index
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {selectedAnswer === index && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <span className="text-slate-800 dark:text-slate-50">{choice}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const canSubmit = () => {
    if (!currentDrill) return false;
    if (currentDrill.type === 'coverage') {
      return selectedDrugs.length > 0;
    }
    return selectedAnswer !== null;
  };

  // Landing Page
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-50 transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shadow-sm">
                <Pill className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Bug-Drug Mastery</h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Antibiotic Selection & Knowledge
                </p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold text-slate-800 dark:text-slate-50">
                Master Antibiotic Selection
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-300">
                Sharpen your antimicrobial stewardship skills with rotating drill types
              </p>
            </div>

            {/* Drill Types Card */}
            <div className="bg-white dark:bg-slate-700 rounded-2xl p-8 border border-slate-200 dark:border-slate-600 shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-slate-800 dark:text-slate-50 mb-6">
                Drill Types
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'Bug-Drug Coverage',
                    desc: 'Match organisms to appropriate antibiotics',
                    Icon: Bug,
                  },
                  {
                    title: 'Mechanism of Action',
                    desc: 'Understand how antibiotics work',
                    Icon: Zap,
                  },
                  {
                    title: 'Side Effects',
                    desc: 'Know the adverse reactions and contraindications',
                    Icon: AlertTriangle,
                  },
                  {
                    title: 'Empiric Therapy',
                    desc: 'Choose the right antibiotic for clinical scenarios',
                    Icon: Target,
                  },
                ].map((drill, i) => (
                  <div
                    key={i}
                    className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <drill.Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-slate-800 dark:text-slate-50">
                        {drill.title}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{drill.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-6 border border-purple-200 dark:border-purple-900">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Key Features
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                    <span>Rotating drill types keep practice fresh</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                    <span>Clinical pearls with every question</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                    <span>Real-world clinical scenarios</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                    <span>Comprehensive antibiotic database</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                    <span>Immediate feedback and explanations</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center">
              <motion.button
                onClick={handleStart}
                disabled={(viewState as string) === 'loading'}
                className="px-10 py-4 bg-slate-800 text-slate-50 dark:bg-slate-100 dark:text-slate-800 hover:bg-slate-700 dark:hover:bg-white
                         disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg
                         transition-all flex items-center justify-center gap-3 mx-auto shadow-lg hover:shadow-xl"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {(viewState as string) === 'loading' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading Drill...
                  </>
                ) : (
                  <>
                    Start Practice
                    <Play className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Loading State
  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-900 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading drill...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (viewState === 'error') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-50">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shadow-sm">
                <Pill className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Bug-Drug Mastery</h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Antibiotic Selection & Knowledge
                </p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        <div className="max-w-2xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-8 border border-red-200 dark:border-red-900 text-center"
          >
            <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
              Error Loading Drill
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              {error || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleStart}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
              >
                Try Again
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 
                           text-slate-800 dark:text-slate-50 rounded-lg font-semibold transition-colors"
                >
                  Exit
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active Session - Clinical White/Navy Theme
  if (!currentDrill) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
              <Pill className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Bug-Drug Mastery</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Antibiotic Selection & Knowledge
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-600 dark:text-slate-300">Score</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-50">
                {score.correct}/{score.total}
                {score.total > 0 && (
                  <span className="text-sm ml-2 text-purple-600 dark:text-purple-400">
                    ({Math.round((score.correct / score.total) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              title="Reset Score"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Drill Type Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-900 shadow-sm">
            <Shuffle className="w-4 h-4" />
            {getDrillTypeLabel()}
          </div>
        </motion.div>

        {/* Drill Content */}
        <motion.div
          key={currentDrill.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {renderDrillContent()}

          {/* Submit Button */}
          <div className="flex gap-2">
            {!isSubmitted ? (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 
                         disabled:cursor-not-allowed py-4 rounded-lg font-semibold text-lg text-white
                         transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                Submit Answer
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white 
                         text-slate-50 dark:text-slate-800 py-4 rounded-lg font-semibold text-lg
                         transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                Next Question
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl p-6 border shadow-md ${
                  isCorrect
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
                    : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`font-semibold mb-2 text-lg ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
                    >
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {currentDrill.explanation}
                    </p>

                    {currentDrill.pearls && currentDrill.pearls.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="font-semibold text-purple-600 dark:text-purple-400">
                          Clinical Pearls:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {currentDrill.pearls.map((pearl, idx) => (
                            <li key={idx}>{pearl}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Show correct answer for coverage drills */}
                    {!isCorrect &&
                      currentDrill.type === 'coverage' &&
                      currentDrill.correctDrugs && (
                        <div className="mt-4">
                          <p className="font-semibold text-purple-400 mb-2">Correct Antibiotics:</p>
                          <div className="flex flex-wrap gap-2">
                            {currentDrill.correctDrugs.map((drugId) => {
                              const drug = ANTIBIOTICS.find((d) => d.id === drugId);
                              return drug ? (
                                <span
                                  key={drugId}
                                  className="px-3 py-1 bg-green-900/40 rounded-full text-green-300 text-sm border border-green-700/30"
                                >
                                  {drug.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default AntibioticMode;
