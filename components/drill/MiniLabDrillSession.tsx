import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useMiniLabDrill,
  type LabCategory,
  type LabPanel,
  type LabValue,
} from '@/hooks/game/use-mini-lab-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import MiniDrillLayout from '@/components/drill/MiniDrillLayout';
import { DrillLandingPage } from '@/components/drill/DrillLandingPage';
import { EnhancedFeedbackPanel } from '@/components/drill/EnhancedFeedbackPanel';
import { QuestionSkeleton } from '@/components/loading';
import {
  X,
  ArrowRight,
  RotateCcw,
  FlaskConical,
  Heart,
  Droplets,
  Activity as ActivityIcon,
  Shuffle,
  AlertTriangle,
  Plus,
} from 'lucide-react';

interface MiniLabDrillSessionProps {
  onExit?: () => void;
  onNavigateToReference?: (type: string, id: string) => void;
}

/** Category card data for the lobby */
const CATEGORY_CARDS: Array<{
  id: LabCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}> = [
  {
    id: 'hematology',
    title: 'Hematology',
    description: 'CBC, iron studies, coagulation',
    icon: <Droplets className="w-8 h-8" />,
    gradient: 'from-red-600 to-rose-700',
  },
  {
    id: 'metabolic',
    title: 'Metabolic',
    description: 'BMP, ABG, acid-base',
    icon: <FlaskConical className="w-8 h-8" />,
    gradient: 'from-amber-600 to-orange-700',
  },
  {
    id: 'endocrine',
    title: 'Endocrine',
    description: 'Thyroid, adrenal, glucose',
    icon: <ActivityIcon className="w-8 h-8" />,
    gradient: 'from-purple-600 to-violet-700',
  },
  {
    id: 'renal',
    title: 'Renal',
    description: 'Kidney function, electrolytes',
    icon: <Droplets className="w-8 h-8" />,
    gradient: 'from-cyan-600 to-teal-700',
  },
  {
    id: 'hepatic',
    title: 'Hepatic',
    description: 'LFTs, bilirubin, coagulation',
    icon: <FlaskConical className="w-8 h-8" />,
    gradient: 'from-emerald-600 to-green-700',
  },
  {
    id: 'cardiac',
    title: 'Cardiac',
    description: 'Troponin, BNP, lipids',
    icon: <Heart className="w-8 h-8" />,
    gradient: 'from-pink-600 to-red-700',
  },
  {
    id: 'random',
    title: 'Random Mix',
    description: 'All categories combined',
    icon: <Shuffle className="w-8 h-8" />,
    gradient: 'from-slate-600 to-gray-700',
  },
];

/**
 * LabValueRow - Renders a single lab value with styling
 */
const LabValueRow: React.FC<{ value: LabValue }> = ({ value }) => {
  const getValueColor = () => {
    if (value.isCritical) {
      return 'text-data-fail font-bold';
    }
    if (value.isAbnormal) {
      return value.abnormalDirection === 'high'
        ? 'text-[var(--color-data-provisional)] font-semibold'
        : 'text-[var(--color-category-practice)] font-semibold';
    }
    return 'text-data-neutral';
  };

  const getValueBg = () => {
    if (value.isCritical) {
      return 'bg-data-fail/30 border-data-fail';
    }
    if (value.isAbnormal) {
      return value.abnormalDirection === 'high'
        ? 'bg-[var(--color-data-provisional)]/20 border-[var(--color-data-provisional)]/50'
        : 'bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] border-[color-mix(in_srgb,var(--color-category-practice)_50%,transparent)]';
    }
    return 'bg-data-neutral/50 border-data-neutral/50';
  };

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 border-b ${getValueBg()} last:border-b-0`}
    >
      <div className="flex items-center gap-2">
        {value.isCritical && <AlertTriangle className="w-4 h-4 text-data-fail" />}
        <span className="text-data-neutral font-medium">{value.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className={`${getValueColor()} tabular-nums`}>
          {value.value} {value.unit}
        </span>
        <span className="text-data-neutral text-sm tabular-nums min-w-[80px] text-right">
          ({value.referenceRange})
        </span>
      </div>
    </div>
  );
};

/**
 * LabPanelCard - Renders a complete lab panel
 */
const LabPanelCard: React.FC<{ panel: LabPanel }> = ({ panel }) => {
  return (
    <div className="bg-data-neutral rounded-xl border border-data-neutral overflow-hidden">
      <div className="px-4 py-3 bg-data-neutral border-b border-data-neutral">
        <h3 className="text-white font-semibold">{panel.name}</h3>
      </div>
      <div>
        {panel.values.map((value, index) => (
          <LabValueRow key={`${value.name}-${index}`} value={value} />
        ))}
      </div>
    </div>
  );
};

/**
 * MiniLabDrillSession - Lab interpretation training mode
 */
const MiniLabDrillSession: React.FC<MiniLabDrillSessionProps> = ({ onExit }) => {
  const {
    currentCase,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    submitAnswer,
    nextCase,
    reset,
    startSession,
    exitToMenu,
    showCategoryMenu,
    validDiagnoses,
    orderTest,
    availableTests,
    isLoading: isDataLoading,
    loadError,
  } = useMiniLabDrill();

  const [showOrderTestMenu, setShowOrderTestMenu] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [totalAttempts, setTotalAttempts] = React.useState(0);

  const handleExit = () => {
    exitToMenu();
    if (onExit) {
      onExit();
    }
  };

  const handleReset = () => {
    setTotalAttempts(0);
    reset();
  };

  const handleStart = () => {
    setIsStarting(true);
    setTimeout(() => {
      showCategoryMenu();
      setIsStarting(false);
    }, 500);
  };

  const handleSubmitAnswer = (answer: string) => {
    setTotalAttempts((prev) => prev + 1);
    submitAnswer(answer);
  };

  const handleCategorySelect = (category: LabCategory) => {
    startSession(category);
  };

  const handleOrderTest = (testName: string) => {
    orderTest(testName);
    setShowOrderTestMenu(false);
  };

  const handleDeepDive = useCallback((_topic: string) => {
    // TODO: wire to reference library navigation
  }, []);

  // Animation variants
  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: { scale: 1.02, y: -4 },
    tap: { scale: 0.98 },
  };

  const feedbackVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  // =========================================================================
  // LANDING PAGE - Welcome screen with mode description
  // =========================================================================
  if (status === 'landing') {
    // Show loading state while fetching database content
    if (isDataLoading) {
      return (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] p-6">
          <div className="max-w-4xl mx-auto mt-20">
            <QuestionSkeleton />
          </div>
        </div>
      );
    }

    // Show error if database load failed
    if (loadError) {
      return (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-data-fail mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
              Database Error
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">{loadError}</p>
            <button
              onClick={onExit}
              className="px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] rounded-lg font-medium transition-colors"
            >
              Return to Menu
            </button>
          </div>
        </div>
      );
    }

    return (
      <DrillLandingPage
        title="Mini Lab Mode"
        description="Diagnose conditions from real lab values and clinical context"
        icon={FlaskConical}
        accentColor="green"
        onStart={handleStart}
        isLoading={isStarting}
        instructions={[
          'Realistic clinical vignettes with patient demographics',
          'Multiple lab panels (CBC, CMP, specific panels)',
          'Order additional tests as needed',
          'Highlighted abnormal and critical values',
          'Detailed explanations of key findings',
        ]}
      >
        {/* Exit button overlay */}
        {onExit && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onExit}
              className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </DrillLandingPage>
    );
  }

  // =========================================================================
  // VIEW A: The Lobby (Status: 'menu')
  // =========================================================================
  if (status === 'menu') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Exit"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium">Exit</span>
          </button>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Mini Lab Mode</h1>
          <div className="w-16" />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              Select Lab Category
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Diagnose conditions from structured lab results
            </p>
          </motion.div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
            {CATEGORY_CARDS.map((card, index) => (
              <motion.button
                key={card.id}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                transition={{ duration: 0.3, delay: index * 0.05 }}
                onClick={() => handleCategorySelect(card.id)}
                className={`relative p-5 rounded-2xl bg-gradient-to-br ${card.gradient} text-left shadow-xl overflow-hidden group`}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative z-10">
                  <div className="mb-3 p-2.5 bg-white/20 rounded-xl w-fit">{card.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-1">{card.title}</h3>
                  <p className="text-white/80 text-sm">{card.description}</p>
                </div>

                <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </motion.button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: The Drill (Status: 'playing' | 'feedback')
  // =========================================================================
  if (status === 'playing' || status === 'feedback') {
    // Build the footer content
    const footerContent = (
      <AnimatePresence mode="wait">
        {status === 'playing' && (
          <motion.div
            key="playing-controls"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            <div className="max-w-2xl mx-auto">
              <p className="text-sm text-[var(--color-text-secondary)] mb-2 text-center">
                What is your diagnosis?
              </p>
              <DiagnosisInput onSubmit={handleSubmitAnswer} autoFocus options={validDiagnoses} />
            </div>
          </motion.div>
        )}

        {status === 'feedback' && currentCase && (
          <EnhancedFeedbackPanel
            isCorrect={isCorrect!}
            correctAnswer={currentCase.correctDiagnosis}
            userAnswer={userAnswer}
            explanation={currentCase.explanation}
            keyFindings={currentCase.keyFindings}
            onNext={nextCase}
            nextLabel="Next Case"
            category="lab"
            tags={['lab', currentCase.category, currentCase.correctDiagnosis]}
            onDeepDive={handleDeepDive}
          />
        )}
      </AnimatePresence>
    );

    return (
      <MiniDrillLayout
        title="Mini Lab Mode"
        score={score}
        totalAttempts={totalAttempts}
        streak={streak}
        isFeedback={status === 'feedback'}
        isCorrect={isCorrect}
        onExit={handleExit}
        onReset={handleReset}
        footer={footerContent}
      >
        {currentCase && (
          <motion.div
            initial={false}
            animate={{}}
            className="max-w-4xl mx-auto space-y-4"
          >
            {/* Clinical Context */}
            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="px-2.5 py-1 bg-[var(--color-bg-tertiary)] rounded-lg text-xs font-semibold text-[var(--color-text-secondary)]">
                  {currentCase.patientAge}yo {currentCase.patientSex === 'M' ? 'Male' : 'Female'}
                </span>
              </div>
              <p className="text-[var(--color-text-primary)] leading-relaxed">
                {currentCase.clinicalContext}
              </p>
            </div>

            {/* Lab Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {currentCase.panels.map((panel, index) => (
                <motion.div
                  key={`${panel.name}-${index}`}
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <LabPanelCard panel={panel} />
                </motion.div>
              ))}
            </div>

            {/* Order Additional Tests Button */}
            {status === 'playing' && availableTests.length > 0 && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4"
              >
                <button
                  onClick={() => setShowOrderTestMenu(!showOrderTestMenu)}
                  className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Order Additional Tests ({availableTests.length} available)
                </button>

                {showOrderTestMenu && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-4 bg-[var(--color-bg-tertiary)] rounded-xl border border-[var(--color-border)] max-h-64 overflow-y-auto"
                    role="menu"
                    aria-label="Available laboratory tests"
                  >
                    <div className="grid grid-cols-1 gap-2">
                      {availableTests.map((testName) => (
                        <button
                          key={testName}
                          onClick={() => handleOrderTest(testName)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOrderTest(testName);
                            }
                          }}
                          className="px-4 py-2 text-left bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] focus:bg-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-category-practice)] rounded-lg text-[var(--color-text-primary)] transition-colors"
                          role="menuitem"
                          tabIndex={0}
                          aria-label={`Order ${testName}`}
                        >
                          {testName}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </MiniDrillLayout>
    );
  }

  // =========================================================================
  // Summary View (Status: 'summary')
  // =========================================================================
  if (status === 'summary') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-8 bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] text-center border border-[var(--color-border)]"
        >
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Session Complete
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Great work on your lab interpretation training!
          </p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-data-pass">{score}</div>
              <div className="text-sm text-[var(--color-text-muted)]">Correct</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-data-pass hover:bg-data-pass text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Session
            </button>
            <button
              onClick={handleExit}
              className="px-6 py-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium transition-colors"
            >
              Exit to Menu
            </button>
          </div>
        </motion.div>
      </div>
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

export default MiniLabDrillSession;
