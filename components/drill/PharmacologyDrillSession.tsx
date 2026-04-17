/**
 * PharmacologyDrillSession — QuizView-based pharm practice mode.
 *
 * Architectural note: this is intentionally distinct from `PharmDrillSession.tsx`.
 * They are NOT duplicates — they are two different drill modes for pharmacology.
 *
 * - `PharmacologyDrillSession` (this file): drug-class-driven practice using the
 *   full `QuizView` pipeline. Pulls questions from `/api/questions/pharmacology-drill`
 *   and submits via the main session FSRS path (sessionType='drill' routed through
 *   the regular QuizView submission).
 * - `PharmDrillSession`: lightweight "mini-drill" variant using the `usePharmDrill`
 *   game hook, renders inside `MiniDrillLayout` + `EnhancedFeedbackPanel`. Category-
 *   card UX (mechanism, side_effect, contraindication, antidote, etc.).
 *
 * Both are wired into `components/layout/DrillViewRouter.tsx` and
 * `config/lazyComponents.tsx` — users can pick either mode for pharm practice.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  Pill,
  X,
  Heart,
  Shield,
  Brain,
  Zap,
  Droplets,
  Activity,
  Syringe,
  ArrowRight,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { QuestionSkeleton } from '@/components/loading';
import { useAuth } from '@clerk/clerk-react';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { getDrillLandingStats, getCategoryBreakdown } from '@/services/analytics';
import QuizView from '@/components/session/QuizView';
import type { Question, PerformanceRecord, SessionSettings } from '@/types';

interface PharmacologyDrillSessionProps {
  onExit?: () => void;
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: Question) => void;
  updateReviewQuestion: (question: Question, wasCorrect: boolean) => void;
  updateLastPerformanceErrorTag: (tag: any) => void;
  performanceData: PerformanceRecord[];
  fontSizeAdjustment: number;
  setFontSizeAdjustment: React.Dispatch<React.SetStateAction<number>>;
  flaggedQuestions: Question[];
  addFlaggedQuestion: (question: Question) => void;
  removeFlaggedQuestion: (question: Question) => void;
  updateQuestionNote: (question: Question, note: string) => void;
}

const DRUG_CLASS_OPTIONS = [
  {
    id: 'beta-blockers',
    name: 'Beta Blockers',
    icon: Heart,
    color: 'red',
    description: 'Metoprolol, Atenolol, Carvedilol',
  },
  {
    id: 'ace-inhibitors',
    name: 'ACE Inhibitors',
    icon: Heart,
    color: 'rose',
    description: 'Lisinopril, Enalapril, Ramipril',
  },
  {
    id: 'antibiotics',
    name: 'Antibiotics',
    icon: Shield,
    color: 'green',
    description: 'Penicillins, Cephalosporins, Fluoroquinolones',
  },
  {
    id: 'anticoagulants',
    name: 'Anticoagulants',
    icon: Droplets,
    color: 'red',
    description: 'Warfarin, Heparin, DOACs',
  },
  {
    id: 'antidiabetics',
    name: 'Antidiabetics',
    icon: Activity,
    color: 'blue',
    description: 'Metformin, Insulin, SGLT2i',
  },
  {
    id: 'antihypertensives',
    name: 'Antihypertensives',
    icon: Heart,
    color: 'purple',
    description: 'CCBs, ARBs, Diuretics',
  },
  {
    id: 'antipsychotics',
    name: 'Antipsychotics',
    icon: Brain,
    color: 'violet',
    description: 'Haloperidol, Risperidone, Quetiapine',
  },
  {
    id: 'antidepressants',
    name: 'Antidepressants',
    icon: Brain,
    color: 'indigo',
    description: 'SSRIs, SNRIs, TCAs',
  },
  {
    id: 'bronchodilators',
    name: 'Bronchodilators',
    icon: Activity,
    color: 'cyan',
    description: 'Albuterol, Ipratropium, Theophylline',
  },
  {
    id: 'corticosteroids',
    name: 'Corticosteroids',
    icon: Syringe,
    color: 'amber',
    description: 'Prednisone, Hydrocortisone, Dexamethasone',
  },
  {
    id: 'diuretics',
    name: 'Diuretics',
    icon: Droplets,
    color: 'teal',
    description: 'Furosemide, HCTZ, Spironolactone',
  },
  {
    id: 'nsaids',
    name: 'NSAIDs',
    icon: Zap,
    color: 'orange',
    description: 'Ibuprofen, Naproxen, Ketorolac',
  },
  {
    id: 'opioids',
    name: 'Opioids',
    icon: Pill,
    color: 'slate',
    description: 'Morphine, Oxycodone, Hydrocodone',
  },
  {
    id: 'statins',
    name: 'Statins',
    icon: Heart,
    color: 'pink',
    description: 'Atorvastatin, Simvastatin, Rosuvastatin',
  },
];

const PharmacologyDrillSession: React.FC<PharmacologyDrillSessionProps> = ({
  onExit,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  updateLastPerformanceErrorTag,
  performanceData,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  flaggedQuestions,
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedDrugClass, setSelectedDrugClass] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [queue, setQueue] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const stats = getDrillLandingStats('pharmacology');
  const categoryBreakdown = getCategoryBreakdown('pharmacology'); // Get actual category breakdown

  // Fetch question from API
  const fetchPharmQuestion = useCallback(
    async (drugClass?: string, difficulty?: string): Promise<Question> => {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/questions/pharmacology-drill', {
        method: 'POST',
        headers,
        body: JSON.stringify({ drugClass, difficulty }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to access questions');
        }
        throw new Error(`Failed to fetch question: ${response.status}`);
      }

      return response.json();
    },
    [getToken]
  );

  // Load initial questions when drug class is selected (or on "All Drug Classes")
  useEffect(() => {
    if (!(selectedDrugClass || selectedDrugClass === 'all') || queue.length > 0) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const drugClassParam = selectedDrugClass === 'all' ? undefined : selectedDrugClass;

    // Load 3 questions initially
    Promise.all([
      fetchPharmQuestion(drugClassParam),
      fetchPharmQuestion(drugClassParam),
      fetchPharmQuestion(drugClassParam),
    ])
      .then((questions) => {
        if (!cancelled) {
          setQueue(questions);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error loading questions:', err);
          setError(err.message || 'Failed to load questions');
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [selectedDrugClass, fetchPharmQuestion, queue.length]);

  // Replenish queue when running low
  const replenishQueue = useCallback(async () => {
    if (!selectedDrugClass && selectedDrugClass !== 'all') return;

    try {
      const drugClassParam = selectedDrugClass === 'all' ? undefined : selectedDrugClass;
      const newQuestion = await fetchPharmQuestion(drugClassParam);
      setQueue((prev) => [...prev, newQuestion]);
    } catch (err) {
      console.error('Failed to replenish queue:', err);
      // Soft fail - don't interrupt the session
    }
  }, [selectedDrugClass, fetchPharmQuestion]);

  const handleStart = () => {
    setShowLanding(false);
  };

  const handleDrugClassSelect = (drugClassId: string) => {
    setSelectedDrugClass(drugClassId);
  };

  const handleBackToMenu = () => {
    setSelectedDrugClass(null);
    setQueue([]);
    setError(null);
  };

  const handleEndSession = () => {
    setSelectedDrugClass(null);
    setQueue([]);
    setShowLanding(true);
  };

  const handleShowMenu = () => {
    handleBackToMenu();
  };

  // Landing page
  if (showLanding) {
    return (
      <DrillLandingPage
        title="Pharmacology Drill"
        description="Master drug classes and mechanisms"
        icon={Pill}
        accentColor="green"
        stats={stats}
        onStart={handleStart}
        instructions={[
          'Choose a drug class or practice all',
          'Learn mechanisms of action',
          'Master side effects and interactions',
          'Build pharmacology expertise',
        ]}
        objectives={[
          'Understand drug mechanisms',
          'Recognize adverse effects',
          'Learn drug-drug interactions',
          'Apply pharmacology to clinical scenarios',
        ]}
        estimatedMinutes={15}
      >
        {onExit && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
              aria-label="Exit"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Category Progress */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-data-pass" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Drug Class Progress
              </h3>
            </div>
            <div className="space-y-2">
              {categoryBreakdown.slice(0, 5).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{cat.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {cat.attempts} attempts
                    </span>
                    <span
                      className={`font-semibold ${
                        cat.accuracy >= 80
                          ? 'text-data-pass'
                          : cat.accuracy >= 70
                            ? 'text-data-provisional'
                            : 'text-data-fail'
                      }`}
                    >
                      {cat.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DrillLandingPage>
    );
  }

  // If drug class selected, show QuizView with pharmacology questions
  if (selectedDrugClass && !showLanding) {
    if (isLoading && queue.length === 0) {
      return (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] p-6">
          <div className="max-w-4xl mx-auto mt-20">
            <QuestionSkeleton />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="mb-4 flex justify-center"><AlertTriangle className="w-10 h-10 text-data-fail" /></div>
            <h2 className="text-xl font-bold mb-2 text-[var(--color-text-primary)]">
              Error Loading Questions
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={handleBackToMenu} className="btn-glass px-4 py-2">
                Back to Drug Classes
              </button>
              <button onClick={() => window.location.reload()} className="btn-secondary px-4 py-2">
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (queue.length === 0) {
      return (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <h2 className="text-xl font-bold mb-2 text-[var(--color-text-primary)]">
              No Questions Available
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4">
              No pharmacology questions found for{' '}
              {selectedDrugClass === 'all'
                ? 'all drug classes'
                : DRUG_CLASS_OPTIONS.find((d) => d.id === selectedDrugClass)?.name}
            </p>
            <button onClick={handleBackToMenu} className="btn-glass px-4 py-2">
              Back to Drug Classes
            </button>
          </div>
        </div>
      );
    }

    // Create session settings for pharmacology drill
    const sessionSettings: SessionSettings = {
      focus: 'topic',
      topic: 'Pharmacology',
    };

    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          <QuizView
            modeLabel="Practice → Pharmacology Quiz"
            initialQueue={queue}
            setParentQueue={setQueue}
            addPerformanceRecord={addPerformanceRecord}
            addMissedQuestion={addMissedQuestion}
            updateReviewQuestion={updateReviewQuestion}
            updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
            setIsLoading={setIsLoading}
            setError={setError}
            sessionSettings={sessionSettings}
            growthAreas={[]}
            onEndSession={handleEndSession}
            onShowMenu={handleShowMenu}
            performanceData={performanceData}
            fontSizeAdjustment={fontSizeAdjustment}
            setFontSizeAdjustment={setFontSizeAdjustment}
            flaggedQuestions={flaggedQuestions}
            addFlaggedQuestion={addFlaggedQuestion}
            removeFlaggedQuestion={removeFlaggedQuestion}
            updateQuestionNote={updateQuestionNote}
          />
        </div>
      </div>
    );
  }

  // Drug class selection menu
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium">Exit</span>
        </button>
        <h1 className="text-lg font-semibold">Pharmacology Drill</h1>
        <div className="w-16" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <motion.div
          initial={prefersReducedMotion ? false : { y: -20 }}
          animate={{ y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : undefined}
          className="text-center mb-8"
        >
          <h2 className="text-3xl font-bold mb-2">Select Drug Class</h2>
          <p className="text-[var(--color-text-secondary)]">Master pharmacology by drug class</p>
        </motion.div>

        {/* "All Drug Classes" option */}
        <div className="max-w-6xl mx-auto mb-6">
          <motion.button
            initial={prefersReducedMotion ? false : { y: 20 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            onClick={() => handleDrugClassSelect('all')}
            className="w-full p-6 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-[var(--color-text-inverse)] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[var(--color-bg-primary)]/20">
                  <Pill className="w-8 h-8" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold mb-1">All Drug Classes</h3>
                  <p className="text-sm text-data-pass">Practice all pharmacology topics</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        </div>

        {/* Drug class grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {DRUG_CLASS_OPTIONS.map((drugClass, index) => {
            const Icon = drugClass.icon;
            return (
              <motion.button
                key={drugClass.id}
                initial={prefersReducedMotion ? false : { y: 20 }}
                animate={{ y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: (index + 1) * 0.05 }}
                onClick={() => handleDrugClassSelect(drugClass.id)}
                className="relative p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-data-pass hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-lg bg-${drugClass.color}-100 dark:bg-${drugClass.color}-900/20`}
                  >
                    <Icon
                      className={`w-6 h-6 text-${drugClass.color}-600 dark:text-${drugClass.color}-400`}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                      {drugClass.name}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {drugClass.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default PharmacologyDrillSession;
