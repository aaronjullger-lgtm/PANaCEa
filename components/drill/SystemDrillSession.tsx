/**
 * SystemDrillSession - Organ system-based drill
 *
 * Allows users to select a PANCE system and practice questions from that system.
 * Uses /api/questions/system-drill endpoint for database-driven content.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  X,
  Heart,
  Brain,
  Activity,
  Droplets,
  Bone,
  Eye,
  Ear,
  Scissors,
  Baby,
  Users,
  Stethoscope,
  Shield,
  ArrowRight,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { QuestionSkeleton } from '@/components/loading/SkeletonLoader';
import { useAuth } from '@clerk/clerk-react';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { getDrillLandingStats, getCategoryBreakdown } from '@/services/analytics';
import QuizView from '@/components/session/QuizView';
import type { Question, PerformanceRecord, SessionSettings } from '../../types';

interface SystemDrillSessionProps {
  onExit?: () => void;
  /** When set, pre-select this system (id e.g. CV, or display name e.g. Cardiovascular) for Residency Cockpit deep link */
  initialSystem?: string;
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

const SYSTEM_OPTIONS = [
  {
    id: 'CV',
    name: 'Cardiovascular',
    icon: Heart,
    color: 'red',
    description: 'Heart, vessels, hypertension',
  },
  {
    id: 'NEURO',
    name: 'Neurology',
    icon: Brain,
    color: 'purple',
    description: 'CNS, PNS, stroke, seizures',
  },
  {
    id: 'PULM',
    name: 'Pulmonary',
    icon: Activity,
    color: 'blue',
    description: 'Lungs, asthma, COPD, pneumonia',
  },
  {
    id: 'GI',
    name: 'Gastroenterology',
    icon: Droplets,
    color: 'amber',
    description: 'GI tract, liver, pancreas',
  },
  {
    id: 'MSK',
    name: 'Musculoskeletal',
    icon: Bone,
    color: 'slate',
    description: 'Bones, joints, ligaments',
  },
  {
    id: 'DERM',
    name: 'Dermatology',
    icon: Scissors,
    color: 'pink',
    description: 'Skin lesions, rashes',
  },
  {
    id: 'HEENT',
    name: 'HEENT',
    icon: Eye,
    color: 'teal',
    description: 'Head, eyes, ears, nose, throat',
  },
  {
    id: 'ENDO',
    name: 'Endocrine',
    icon: Stethoscope,
    color: 'indigo',
    description: 'Diabetes, thyroid, hormones',
  },
  {
    id: 'RENAL',
    name: 'Renal/Urology',
    icon: Droplets,
    color: 'cyan',
    description: 'Kidneys, UTI, stones',
  },
  {
    id: 'REPRO',
    name: 'Reproductive',
    icon: Baby,
    color: 'rose',
    description: 'OB/GYN, pregnancy, STIs',
  },
  {
    id: 'HEME',
    name: 'Hematology',
    icon: Droplets,
    color: 'red',
    description: 'Anemia, coagulation, blood',
  },
  {
    id: 'ID',
    name: 'Infectious Disease',
    icon: Shield,
    color: 'green',
    description: 'Bacteria, viruses, parasites',
  },
  {
    id: 'PSYCH',
    name: 'Psychiatry',
    icon: Brain,
    color: 'violet',
    description: 'Mental health, mood, psychosis',
  },
];

const SystemDrillSession: React.FC<SystemDrillSessionProps> = ({
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
  initialSystem,
}) => {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [queue, setQueue] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  // Residency Cockpit: pre-select system when initialSystem is provided (id or display name)
  useEffect(() => {
    if (!initialSystem) return;
    const normalized = initialSystem.trim();
    const match = SYSTEM_OPTIONS.find(
      (o) =>
        o.id === normalized ||
        o.id === normalized.toUpperCase() ||
        o.name.toLowerCase() === normalized.toLowerCase()
    );
    if (match) {
      setSelectedSystem(match.id);
      setShowLanding(true);
    }
  }, [initialSystem]);

  const stats = getDrillLandingStats('system_drill');
  const categoryBreakdown = getCategoryBreakdown('system_drill');

  // Fetch question from API
  const fetchSystemQuestion = useCallback(
    async (system: string, difficulty?: string): Promise<Question> => {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/questions/system-drill', {
        method: 'POST',
        headers,
        body: JSON.stringify({ system, difficulty }),
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

  // Load initial questions when system is selected
  useEffect(() => {
    if (selectedSystem && queue.length === 0) {
      setIsLoading(true);
      setError(null);

      // Load 3 questions initially
      Promise.all([
        fetchSystemQuestion(selectedSystem),
        fetchSystemQuestion(selectedSystem),
        fetchSystemQuestion(selectedSystem),
      ])
        .then((questions) => {
          setQueue(questions);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error loading questions:', err);
          setError(err.message || 'Failed to load questions');
          setIsLoading(false);
        });
    }
  }, [selectedSystem, fetchSystemQuestion, queue.length]);

  // Replenish queue when running low
  const replenishQueue = useCallback(async () => {
    if (!selectedSystem) return;

    try {
      const newQuestion = await fetchSystemQuestion(selectedSystem);
      setQueue((prev) => [...prev, newQuestion]);
    } catch (err) {
      console.error('Failed to replenish queue:', err);
      // Soft fail - don't interrupt the session
    }
  }, [selectedSystem, fetchSystemQuestion]);

  const handleStart = () => {
    setShowLanding(false);
  };

  const handleSystemSelect = (systemId: string) => {
    setSelectedSystem(systemId);
  };

  const handleBackToMenu = () => {
    setSelectedSystem(null);
    setQueue([]);
    setError(null);
  };

  const handleEndSession = () => {
    setSelectedSystem(null);
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
        title="System Drill"
        description="Master an entire organ system"
        icon={Layers}
        accentColor="indigo"
        stats={stats}
        onStart={handleStart}
        instructions={[
          'Choose a PANCE organ system',
          'Practice conditions from that system',
          'Build comprehensive system knowledge',
          'Master high-yield system content',
        ]}
        objectives={[
          'Deep dive into one organ system',
          'Connect related conditions',
          'Build system-specific expertise',
          'Prepare for system-heavy PANCE sections',
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
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                System Progress
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
                          ? 'text-data-pass dark:text-data-pass'
                          : cat.accuracy >= 70
                            ? 'text-data-provisional dark:text-data-provisional'
                            : 'text-data-fail dark:text-data-fail'
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

  // If system selected, show QuizView with system-specific questions
  if (selectedSystem && !showLanding) {
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
            <div className="text-data-fail mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2 text-[var(--color-text-primary)]">
              Error Loading Questions
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={handleBackToMenu} className="btn-glass px-4 py-2">
                Back to Systems
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
              No questions found for {SYSTEM_OPTIONS.find((s) => s.id === selectedSystem)?.name}
            </p>
            <button onClick={handleBackToMenu} className="btn-glass px-4 py-2">
              Back to Systems
            </button>
          </div>
        </div>
      );
    }

    // Create session settings for system drill
    const sessionSettings: SessionSettings = {
      focus: 'all',
    };

    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          <QuizView
            initialQueue={queue}
            setParentQueue={setQueue}
            useSplitPane
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

  // System selection menu
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
        <h1 className="text-lg font-semibold">System Drill</h1>
        <div className="w-16" />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl font-bold mb-3">Select Organ System</h2>
          <p className="text-lg text-[var(--color-text-secondary)]">
            Master conditions from a single system
          </p>
        </motion.div>

        {/* System grid - Responsive 3-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {SYSTEM_OPTIONS.map((system, index) => {
            const Icon = system.icon;
            return (
              <motion.button
                key={system.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSystemSelect(system.id)}
                className="relative p-8 rounded-xl bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-[0_18px_42px_var(--color-shadow-soft)] hover:bg-[var(--color-bg-secondary)]/80 transition-all text-left group hover:scale-[1.03]"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-data-neutral/40 group-hover:bg-data-neutral/60 transition-colors">
                    <Icon className="w-7 h-7 text-data-neutral group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[var(--color-accent)]" />
                      {system.name}
                    </h3>
                    <p className="text-sm text-data-neutral leading-relaxed">{system.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-data-neutral group-hover:translate-x-1 group-hover:text-white transition-all" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default SystemDrillSession;
