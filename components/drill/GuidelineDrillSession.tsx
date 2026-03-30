import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileCheck,
  ChevronRight,
  CheckCircle,
  XCircle,
  ArrowRight,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useGuidelineDrill } from '@/hooks/game/use-guideline-drill';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { QuestionSkeleton } from '@/components/loading';
import DrillShell from '@/components/drill/DrillShell';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@clerk/clerk-react';

interface GuidelineDrillSessionProps {
  onExit?: () => void;
}

/**
 * GuidelineDrillSession - Clinical guidelines scoring drill
 *
 * Practice scoring systems like CURB-65, Wells Criteria, GCS, etc.
 */
const GuidelineDrillSession: React.FC<GuidelineDrillSessionProps> = ({ onExit }) => {
  const {
    currentGuideline,
    currentVignette,
    currentVignetteIndex,
    totalVignettes,
    userScore,
    isCorrect,
    score,
    streak,
    status,
    allGuidelines,
    sessionResult,
    isLoading,
    selectGuideline,
    submitScore,
    nextVignette,
    reset,
    exitToMenu,
    backToSelection,
  } = useGuidelineDrill();

  const [calculatedScore, setCalculatedScore] = useState(0);
  const [selectedCriteria, setSelectedCriteria] = useState<Set<string>>(new Set());
  const [hasStarted, setHasStarted] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const { getToken } = useAuth();


  const handleExit = () => {
    exitToMenu();
    if (onExit) onExit();
  };

  const handleSelectGuideline = (guidelineId: string) => {
    setCalculatedScore(0);
    setSelectedCriteria(new Set());
    selectGuideline(guidelineId);
  };

  const toggleCriterion = (criterionId: string, pointValue: number) => {
    const newSelected = new Set(selectedCriteria);
    if (newSelected.has(criterionId)) {
      newSelected.delete(criterionId);
      setCalculatedScore((prev) => prev - pointValue);
    } else {
      newSelected.add(criterionId);
      setCalculatedScore((prev) => prev + pointValue);
    }
    setSelectedCriteria(newSelected);
  };

  const handleSubmitScore = () => {
    setTotalAttempts((prev) => prev + 1);
    submitScore(calculatedScore);
  };

  const handleNextVignette = () => {
    setCalculatedScore(0);
    setSelectedCriteria(new Set());
    nextVignette();
  };

  const handleReset = () => {
    setCalculatedScore(0);
    setSelectedCriteria(new Set());
    setTotalAttempts(0);
    reset();
  };

  const handleStart = () => {
    setHasStarted(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
        <div className="max-w-4xl mx-auto">
          <QuestionSkeleton />
        </div>
      </div>
    );
  }

  // =========================================================================
  // LANDING PAGE - Welcome screen with mode description
  // =========================================================================
  if (!hasStarted) {
    return (
      <DrillShell
        title="Guideline Mode"
        breadcrumb={['Drills', 'Guidelines']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
        hideBreadcrumb
      >
        <DrillLandingPage
          title="Guideline Mode"
          description="Practice PANCE high-yield clinical scoring systems and criteria"
          icon={FileCheck}
          accentColor="blue"
          onStart={handleStart}
          onExit={onExit}
          instructions={[
            'Master clinical scoring systems like CURB-65, Wells Criteria, GCS',
            'Practice with realistic clinical vignettes',
            'Learn which criteria apply to each case',
            'Instant feedback with detailed explanations',
            'Track your accuracy across different guidelines',
          ]}
        />
      </DrillShell>
    );
  }

  // =========================================================================
  // MENU VIEW - Guideline Selection
  // =========================================================================
  if (status === 'menu' || status === 'selecting') {
    // Group guidelines by category
    const guidelinesByCategory = allGuidelines.reduce(
      (acc, g) => {
        // Infer category from guideline characteristics
        let category = 'General';
        if (['wells-dvt', 'wells-pe', 'chadsvasc', 'timi-nstemi'].includes(g.id))
          category = 'Cardiology';
        else if (['curb-65'].includes(g.id)) category = 'Pulmonology';
        else if (['ranson-pancreatitis', 'alvarado'].includes(g.id)) category = 'Gastroenterology';
        else if (['sirs', 'qsofa', 'gcs'].includes(g.id)) category = 'Emergency';
        else if (['sigecaps', 'cage'].includes(g.id)) category = 'Psychiatry';
        else if (['ottawa-ankle', 'kocher'].includes(g.id)) category = 'MSK/Trauma';
        else if (['amsel'].includes(g.id)) category = 'OB/GYN';
        else if (['apgar', 'kawasaki'].includes(g.id)) category = 'Pediatrics';

        const categoryList = acc[category] ?? [];
        categoryList.push(g);
        acc[category] = categoryList;
        return acc;
      },
      {} as Record<string, typeof allGuidelines>
    );

    return (
      <DrillShell
        title="Guideline Mode"
        breadcrumb={['Drills', 'Guidelines', 'Select Guideline']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-center mb-6 sm:mb-8"
            >
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Clinical Scoring Guidelines</h2>
              <p className="text-sm sm:text-base text-[var(--color-text-secondary)]">
                Practice PANCE high-yield criteria and scoring systems
              </p>
            </motion.div>

            {/* Guidelines by Category */}
            <div className="space-y-6">
              {Object.entries(guidelinesByCategory).map(([category, guidelines]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {guidelines.map((g, index) => (
                      <motion.button
                        key={g.id}
                        initial={{ y: 20 }}
                        animate={{ y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleSelectGuideline(g.id)}
                        className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-left hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)] transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] truncate">
                              {g.name}
                            </h4>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                              {g.description}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] flex-shrink-0 ml-2" />
                        </div>
                        <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                          {g.vignettes.length} case{g.vignettes.length !== 1 ? 's' : ''} • Max
                          score: {g.maxScore}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DrillShell>
    );
  }

  // =========================================================================
  // PLAYING VIEW - Vignette with Criteria Checkboxes
  // =========================================================================
  if (status === 'playing' && currentGuideline && currentVignette) {
    const playingFooter = (
      <div className="p-3 sm:p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-secondary)]">Your Score:</span>
            <span className="text-2xl font-bold text-[var(--color-accent)]">{calculatedScore}</span>
          </div>
          <button
            onClick={handleSubmitScore}
            className="px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white font-semibold rounded-lg transition-colors"
            aria-label="Submit calculated score"
          >
            Submit Score
          </button>
        </div>
      </div>
    );

    return (
      <MiniDrillLayout
        title={currentGuideline.name}
        score={score}
        totalAttempts={totalAttempts}
        streak={streak}
        isFeedback={false}
        isCorrect={null}
        onExit={handleExit}
        onReset={handleReset}
        footer={playingFooter}
      >
        <div className="max-w-3xl mx-auto">
          {/* Progress indicator */}
          <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-3 text-center">
            Case {currentVignetteIndex + 1} of {totalVignettes}
          </div>

          {/* Vignette */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Clinical Vignette
              </span>
            </div>
            <p className="text-base sm:text-lg text-[var(--color-text-primary)] leading-relaxed">
              {currentVignette.story}
            </p>
          </motion.div>

          {/* Criteria Checklist */}
          <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
              Select criteria that are met:
            </h3>
            <div className="space-y-2" role="group" aria-label="Scoring criteria checklist">
              {currentGuideline.components.map((criterion, index) => (
                <motion.button
                  key={criterion.id}
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => toggleCriterion(criterion.id, criterion.pointValue)}
                  className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                    selectedCriteria.has(criterion.id)
                      ? 'bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/50'
                      : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedCriteria.has(criterion.id)
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    {selectedCriteria.has(criterion.id) && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {criterion.label}
                    </span>
                    {criterion.description && (
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">
                        ({criterion.description})
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-bold flex-shrink-0 ${
                      criterion.pointValue >= 0 ? 'text-[var(--color-accent)]' : 'text-data-fail'
                    }`}
                  >
                    {criterion.pointValue >= 0 ? '+' : ''}
                    {criterion.pointValue}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </MiniDrillLayout>
    );
  }

  // =========================================================================
  // FEEDBACK VIEW
  // =========================================================================
  if (status === 'feedback' && currentGuideline && currentVignette) {
    const feedbackFooter = (
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        className={`p-3 sm:p-4 ${
          isCorrect
            ? 'bg-data-pass dark:bg-data-pass/50 border-t-2 border-data-pass'
            : 'bg-data-fail dark:bg-data-fail/50 border-t-2 border-data-fail'
        }`}
      >
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div
              className={`text-lg font-bold ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
            >
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Your score: {userScore} | Correct score: {currentVignette.correctScore}
            </p>
          </div>
          <button
            onClick={handleNextVignette}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-colors ${
              isCorrect
                ? 'bg-data-pass hover:bg-data-pass text-white'
                : 'bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]'
            }`}
            aria-label={currentVignetteIndex < totalVignettes - 1 ? 'Proceed to next clinical vignette' : 'View session summary'}
          >
            {currentVignetteIndex < totalVignettes - 1 ? 'Next Case' : 'View Summary'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );

    return (
      <MiniDrillLayout
        title={currentGuideline.name}
        score={score}
        totalAttempts={totalAttempts}
        streak={streak}
        isFeedback={true}
        isCorrect={isCorrect}
        onExit={handleExit}
        onReset={handleReset}
        footer={feedbackFooter}
      >
        <div className="max-w-3xl mx-auto">
          {/* Progress indicator */}
          <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-3 text-center">
            Case {currentVignetteIndex + 1} of {totalVignettes}
          </div>

          {/* Result Card */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className={`p-6 rounded-xl border mb-4 ${
              isCorrect
                ? 'bg-data-pass dark:bg-data-pass/30 border-data-pass dark:border-data-pass'
                : 'bg-data-fail dark:bg-data-fail/30 border-data-fail dark:border-data-fail'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {isCorrect ? (
                <CheckCircle className="w-8 h-8 text-data-pass dark:text-data-pass" />
              ) : (
                <XCircle className="w-8 h-8 text-data-fail dark:text-data-fail" />
              )}
              <div>
                <h2
                  className={`text-xl font-bold ${isCorrect ? 'text-[var(--color-data-pass)]' : 'text-[var(--color-data-fail)]'}`}
                >
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Your score: {userScore} | Correct score: {currentVignette.correctScore}
                </p>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Explanation
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {currentVignette.explanation}
              </p>
            </div>

            {/* Correct Criteria */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Criteria Met in This Case:
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentVignette.metCriteriaIds.map((id) => {
                  const criterion = currentGuideline.components.find((c) => c.id === id);
                  return criterion ? (
                    <span
                      key={id}
                      className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded text-xs text-[var(--color-text-secondary)]"
                    >
                      {criterion.label} (+{criterion.pointValue})
                    </span>
                  ) : null;
                })}
              </div>
            </div>

            {/* Deep Dive Section */}
            <div className="mt-4">
              <button
                onClick={() => setShowDeepDive(!showDeepDive)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors text-sm"
              >
                <span className="flex items-center gap-2 text-[var(--color-text-primary)] font-medium">
                  <BookOpen className="w-4 h-4 text-[var(--color-category-practice)]" />
                  Deep Dive - Related Reference Material
                </span>
                {showDeepDive ? (
                  <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </button>

              <AnimatePresence>
                {showDeepDive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 text-sm text-[var(--color-text-secondary)]">
                      <p>
                        Related guidelines and criteria scoring tools can be found in the Clinical
                        Reference Library.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </MiniDrillLayout>
    );
  }

  // =========================================================================
  // SUMMARY VIEW
  // =========================================================================
  if (status === 'summary' && sessionResult) {
    const percentage =
      sessionResult.totalAttempts > 0
        ? Math.round((sessionResult.totalCorrect / sessionResult.totalAttempts) * 100)
        : 0;

    return (
      <DrillShell
        title="Guideline Mode — Complete"
        breadcrumb={['Drills', 'Guidelines', 'Results']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
      >
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <Award className="w-16 h-16 text-[var(--color-accent)] mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{sessionResult.guidelineName}</h2>
            <p className="text-4xl font-bold text-[var(--color-accent)] mb-2">
              {sessionResult.totalCorrect}/{sessionResult.totalAttempts}
            </p>
            <p className="text-[var(--color-text-secondary)] mb-6">{percentage}% Accuracy</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-medium transition-colors"
                aria-label="Retry the same guideline"
              >
                Try Again
              </button>
              <button
                onClick={backToSelection}
                className="px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 rounded-lg font-medium transition-colors"
                aria-label="Choose a different guideline"
              >
                Choose Another Guideline
              </button>
            </div>
          </motion.div>
        </div>
      </DrillShell>
    );
  }

  // Fallback - Use skeleton loader for zero CLS
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <QuestionSkeleton />
      </div>
    </div>
  );
};

export default GuidelineDrillSession;
