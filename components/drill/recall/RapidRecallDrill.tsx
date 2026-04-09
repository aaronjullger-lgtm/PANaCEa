import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Flame,
  RotateCcw,
  ArrowRight,
  Loader2,
  BadgeCheck,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { useAuth, useUser } from '@clerk/clerk-react';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import { buzzwordService } from '@/services/domain';
import { semanticValidationService } from '@/lib/services/semanticValidationService';
import { useTelemetryCollector } from '@/hooks/useTelemetryCollector';
import type { TelemetryData } from '@/types/telemetry';

interface RapidRecallDrillProps {
  onExit?: () => void;
  system?: string; // Optional: filter pearls by PANCE system
}

type DrillStatus = 'playing' | 'feedback' | 'summary';
type QuestionSource = 'pearl' | 'buzzword';

interface PearlQuestion {
  conditionId: string;
  conditionName: string;
  pearl: string;
}

/**
 * RapidRecallDrill - "Flashcard meets Type-ahead" drill mode.
 *
 * Displays clinical pearls or buzzwords and users must type the diagnosis.
 * Uses Pearl Harvester pattern to prioritize cached pearls before falling
 * back to buzzword dictionary.
 */
const RapidRecallDrill: React.FC<RapidRecallDrillProps> = ({ onExit, system }) => {
  const { getToken } = useAuth();

  // Telemetry collector for behavioral tracking (Phase 3 Milestone 3)
  const telemetry = useTelemetryCollector({
    defaultQuestionType: 'rapid_recall',
    updateInterval: 100, // Update elapsed time every 100ms
  });

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [questionSource, setQuestionSource] = useState<QuestionSource>('buzzword');

  // Score state
  const [streak, setStreak] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [totalCorrect, setTotalCorrect] = useState<number>(0);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [status, setStatus] = useState<DrillStatus>('playing');
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [usedQuestions, setUsedQuestions] = useState<Set<string>>(new Set());
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [acceptedSynonym, setAcceptedSynonym] = useState<boolean>(false);

  // Data state (buzzwords fallback)
  const [buzzwordDictionary, setBuzzwordDictionary] = useState<Record<string, string>>({});
  const [buzzwordsList, setBuzzwordsList] = useState<string[]>([]);
  const [allDiagnoses, setAllDiagnoses] = useState<string[]>([]);

  // Pearl state (primary source)
  const [pearlQuestions, setPearlQuestions] = useState<PearlQuestion[]>([]);
  const [usePearls, setUsePearls] = useState<boolean>(true); // Toggle for pearl vs buzzword mode

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Load data: prioritize pearls, fallback to buzzwords
  useEffect(() => {
    const loadData = async () => {
      try {
        // Try to load pearls first
        const token = await getToken();
        if (token && system) {
          try {
            const response = await fetch(`/api/conditions/pearls?system=${system}&random=true`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = (await response.json()) as { pearls?: PearlQuestion[] };
              if (data.pearls && data.pearls.length > 0) {
                setPearlQuestions(data.pearls);
                setUsePearls(true);
                // Pearl questions loaded successfully
              } else {
                // No pearls available, fall back to buzzwords
                setUsePearls(false);
              }
            }
          } catch (pearlError) {
            console.warn('[RapidRecallDrill] Failed to load pearls, using buzzwords:', pearlError);
            setUsePearls(false);
          }
        }

        // Load buzzwords as fallback
        const dict = await buzzwordService.getBuzzwordDictionary();
        const diagnoses = await buzzwordService.getAllBuzzwordConditions();

        setBuzzwordDictionary(dict);
        setBuzzwordsList(Object.keys(dict));
        setAllDiagnoses(diagnoses);
      } catch (error) {
        console.error('[RapidRecallDrill] Failed to load data', error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [system, getToken]);

  // Load high score from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('panceai_rapid_recall_high_score');
      if (saved) {
        setHighScore(parseInt(saved, 10) || 0);
      }
    } catch (e) {
      console.error('Failed to load high score:', e);
    }
  }, []);

  // Save high score when streak updates
  useEffect(() => {
    if (streak > highScore) {
      setHighScore(streak);
      try {
        localStorage.setItem('panceai_rapid_recall_high_score', streak.toString());
      } catch (e) {
        console.error('Failed to save high score:', e);
      }
    }
  }, [streak, highScore]);

  // Get next question (pearl or buzzword)
  const getNextQuestion = useCallback(() => {
    // Try pearls first if available
    if (usePearls && pearlQuestions.length > 0) {
      const available = pearlQuestions.filter((p) => !usedQuestions.has(p.conditionId + p.pearl));

      if (available.length === 0) {
        // Reset if all pearls used
        setUsedQuestions(new Set());
        const pearlIndex = Math.floor(Math.random() * pearlQuestions.length);
        const randomPearl = pearlQuestions[pearlIndex];
        // Guard for array access returning undefined
        if (!randomPearl) return;
        setCurrentQuestion(randomPearl.pearl);
        setCurrentAnswer(randomPearl.conditionName);
        setQuestionSource('pearl');
        return;
      }

      const availableIndex = Math.floor(Math.random() * available.length);
      const randomPearl = available[availableIndex];
      // Guard for array access returning undefined
      if (!randomPearl) return;
      setCurrentQuestion(randomPearl.pearl);
      setCurrentAnswer(randomPearl.conditionName);
      setQuestionSource('pearl');
      setUsedQuestions((prev) => new Set(prev).add(randomPearl.conditionId + randomPearl.pearl));
      return;
    }

    // Fallback to buzzwords
    if (buzzwordsList.length === 0) return;

    const available = buzzwordsList.filter((b) => !usedQuestions.has(b));
    let selectedBuzzword: string | undefined;

    if (available.length === 0) {
      // Reset if all buzzwords have been used
      setUsedQuestions(new Set());
      const buzzwordIndex = Math.floor(Math.random() * buzzwordsList.length);
      selectedBuzzword = buzzwordsList[buzzwordIndex];
    } else {
      const availableIndex = Math.floor(Math.random() * available.length);
      selectedBuzzword = available[availableIndex];
    }

    // Guard for array access returning undefined
    if (!selectedBuzzword) return;

    const answer = buzzwordDictionary[selectedBuzzword];
    // Guard for Record lookup returning undefined
    if (!answer) return;

    setCurrentQuestion(selectedBuzzword);
    setCurrentAnswer(answer);
    setQuestionSource('buzzword');
    setUsedQuestions((prev) => new Set(prev).add(selectedBuzzword));
  }, [usePearls, pearlQuestions, buzzwordsList, buzzwordDictionary, usedQuestions]);

  // Initialize with first question
  useEffect(() => {
    if (!isLoading && !currentQuestion && (pearlQuestions.length > 0 || buzzwordsList.length > 0)) {
      getNextQuestion();
    }
  }, [isLoading, currentQuestion, pearlQuestions, buzzwordsList, getNextQuestion]);

  // Start telemetry when a new question is displayed (Phase 3 Milestone 3)
  useEffect(() => {
    if (currentQuestion && status === 'playing') {
      telemetry.startQuestion('rapid_recall');
    }
  }, [currentQuestion]);

  /**
   * Normalize a diagnosis string for comparison.
   * Handles common variations in medical terminology.
   */
  const normalizeDiagnosis = (str: string): string => {
    return (
      str
        .toLowerCase()
        .trim()
        // Remove possessive 's (e.g., "Crohn's" → "Crohn")
        .replace(/['']s\b/g, '')
        // Remove common articles and connectors
        .replace(/\b(the|a|an|of|and)\b/g, ' ')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  };

  const handleSubmit = useCallback(
    async (answer: string) => {
      if (isValidating) return;

      // Finalize telemetry data before validation (Phase 3 Milestone 3)
      const telemetryData = telemetry.finalizeTelemetry();

      const normalizedAnswer = normalizeDiagnosis(answer);
      const normalizedCorrect = normalizeDiagnosis(currentAnswer);

      let isAnswerCorrect = normalizedAnswer === normalizedCorrect;
      let wasSemantic = false;

      if (!isAnswerCorrect) {
        setIsValidating(true);
        try {
          const result = await semanticValidationService.validate(answer, currentAnswer);
          isAnswerCorrect = result.isEquivalent;
          wasSemantic = result.viaModel && result.isEquivalent;
        } catch (error) {
          console.error('Semantic validation failed', error);
      } finally {
        setIsValidating(false);
      }
    }

    setAcceptedSynonym(wasSemantic);
      setUserAnswer(answer);
      setIsCorrect(isAnswerCorrect);
      setTotalAttempts((prev) => prev + 1);
      setStatus('feedback');

      if (isAnswerCorrect) {
        setStreak((prev) => prev + 1);
        setTotalCorrect((prev) => prev + 1);
      } else {
        setStreak(0);
      }
    },
    [currentAnswer, isValidating, telemetry]
  );

  const handleNext = useCallback(() => {
    getNextQuestion();
    setUserAnswer('');
    setAcceptedSynonym(false);
    setStatus('playing');
  }, [getNextQuestion]);

  const handleReset = useCallback(() => {
    setStreak(0);
    setTotalCorrect(0);
    setTotalAttempts(0);
    setUsedQuestions(new Set());
    getNextQuestion();
    setUserAnswer('');
    setAcceptedSynonym(false);
    setStatus('playing');
  }, [getNextQuestion]);

  const handleExit = () => {
    if (onExit) {
      onExit();
    }
  };

  // Animation variants
  const buzzwordVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  };

  const feedbackVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const flashVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading drill" className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div aria-hidden="true" className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || (buzzwordsList.length === 0 && pearlQuestions.length === 0)) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-[var(--color-text-primary)] font-medium">Could not load drill content. Please check your connection and try again.</p>
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      {/* Flash overlay for correct/incorrect feedback */}
      <AnimatePresence>
        {status === 'feedback' && (
          <motion.div
            variants={flashVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15 }}
            className={`absolute inset-0 z-0 pointer-events-none ${
              isCorrect ? 'bg-data-pass/20' : 'bg-data-fail/20'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm border-b border-[var(--color-border)]">
        <button
          onClick={handleExit}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Exit"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Exit</span>
        </button>

        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Rapid Recall</h1>

        <div className="flex items-center gap-4">
          {/* Score */}
          <div className="text-sm text-[var(--color-text-secondary)]">
            {totalCorrect}/{totalAttempts}
          </div>

          {/* Streak Counter */}
          <div className="flex items-center gap-1.5">
            <Flame
              className={`w-5 h-5 ${
                streak > 0 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-text-muted)]'
              }`}
            />
            <span
              className={`text-sm font-bold ${
                streak > 0 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              {streak}
            </span>
          </div>
        </div>
      </header>

      {/* Main Stage - Question Display */}
      <main className="flex-1 flex items-center justify-center p-4 pt-16 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            variants={buzzwordVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="text-center max-w-4xl"
          >
            <p className="text-sm uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
              {questionSource === 'pearl'
                ? 'What condition is associated with this clinical pearl?'
                : 'What diagnosis is this buzzword associated with?'}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-text-primary)] leading-tight">
              {currentQuestion}
            </h2>
            {questionSource === 'pearl' && (
              <span className="inline-block mt-3 px-3 py-1 text-xs font-medium bg-[color-mix(in_srgb,var(--color-category-practice)_10%,transparent)] text-[var(--color-category-practice)] rounded-full">
                Clinical Pearl
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Fixed Bottom Bar - Glassmorphism */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm border-t border-[var(--color-border)] shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.12)] dark:shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.35)]">
        <AnimatePresence mode="wait">
          {status === 'playing' && (
            <motion.div
              key="playing-controls"
              variants={feedbackVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="p-4"
            >
              <div className="max-w-2xl mx-auto relative">
                <DiagnosisInput
                  onSubmit={handleSubmit}
                  autoFocus
                  options={allDiagnoses}
                  disabled={isValidating}
                />
                {isValidating && (
                  <div role="status" aria-live="polite" className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                    <span className="text-xs font-medium">Verifying...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {status === 'feedback' && (
            <motion.div
              key="feedback-controls"
              variants={feedbackVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className={`p-4 ${
                isCorrect
                  ? 'bg-data-pass/50 border-t-2 border-data-pass'
                  : 'bg-data-fail/50 border-t-2 border-data-fail'
              }`}
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div
                      className={`text-lg font-bold ${
                        isCorrect ? 'text-data-pass' : 'text-data-fail'
                      }`}
                    >
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </div>
                    {isCorrect && acceptedSynonym && (
                      <div className="inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-full bg-data-pass/15 text-data-pass text-xs font-semibold">
                        <BadgeCheck className="w-4 h-4" /> Close enough! Accepted synonym
                      </div>
                    )}
                    {!isCorrect && (
                      <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Correct answer:{' '}
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {currentAnswer}
                        </span>
                      </div>
                    )}
                    {userAnswer && !isCorrect && (
                      <div className="text-sm text-[var(--color-text-muted)] mt-0.5">
                        Your answer: {userAnswer}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleNext}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                      isCorrect
                        ? 'bg-data-pass hover:bg-data-pass text-[var(--color-text-inverse)]'
                        : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
                    }`}
                  >
                    Next Card
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset button (floating) */}
      <button
        onClick={handleReset}
        className="fixed bottom-20 right-4 p-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shadow-lg"
        aria-label="Reset session"
        title="Reset session"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
    </div>
  );
};

export default RapidRecallDrill;
