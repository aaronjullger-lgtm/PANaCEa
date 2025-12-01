import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMiniLabDrill, type LabCategory, type LabPanel, type LabValue } from '@/hooks/game/use-mini-lab-drill';
import DiagnosisInput from '@/components/drill/DiagnosisInput';
import { Flame, X, ArrowRight, RotateCcw, FlaskConical, Heart, Droplets, Activity, Shuffle, AlertTriangle, Plus } from 'lucide-react';

interface MiniLabDrillSessionProps {
  onExit?: () => void;
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
    icon: <Activity className="w-8 h-8" />,
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
      return 'text-red-500 font-bold';
    }
    if (value.isAbnormal) {
      return value.abnormalDirection === 'high' 
        ? 'text-orange-500 font-semibold' 
        : 'text-blue-500 font-semibold';
    }
    return 'text-slate-300';
  };

  const getValueBg = () => {
    if (value.isCritical) {
      return 'bg-red-900/30 border-red-700';
    }
    if (value.isAbnormal) {
      return value.abnormalDirection === 'high'
        ? 'bg-orange-900/20 border-orange-700/50'
        : 'bg-blue-900/20 border-blue-700/50';
    }
    return 'bg-slate-800/50 border-slate-700/50';
  };

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${getValueBg()} last:border-b-0`}>
      <div className="flex items-center gap-2">
        {value.isCritical && (
          <AlertTriangle className="w-4 h-4 text-red-500" />
        )}
        <span className="text-slate-300 font-medium">{value.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className={`${getValueColor()} tabular-nums`}>
          {value.value} {value.unit}
        </span>
        <span className="text-slate-500 text-sm tabular-nums min-w-[80px] text-right">
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
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
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
    validDiagnoses,
    orderTest,
    availableTests,
  } = useMiniLabDrill();
  
  const [showOrderTestMenu, setShowOrderTestMenu] = React.useState(false);

  const handleExit = () => {
    exitToMenu();
    if (onExit) {
      onExit();
    }
  };

  const handleCategorySelect = (category: LabCategory) => {
    startSession(category);
  };
  
  const handleOrderTest = (testName: string) => {
    orderTest(testName);
    setShowOrderTestMenu(false);
  };

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
  // VIEW A: The Lobby (Status: 'menu')
  // =========================================================================
  if (status === 'menu') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Exit"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium">Exit</span>
          </button>
          <h1 className="text-lg font-semibold text-slate-200">Mini Lab Mode</h1>
          <div className="w-16" />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold text-slate-100 mb-2">
              Select Lab Category
            </h2>
            <p className="text-slate-400">
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
                  <div className="mb-3 p-2.5 bg-white/20 rounded-xl w-fit">
                    {card.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {card.title}
                  </h3>
                  <p className="text-white/80 text-sm">
                    {card.description}
                  </p>
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
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col">
        {/* Floating Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800/50">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Exit session"
          >
            <X className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Exit</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-400">
              Score: <span className="text-slate-200 font-semibold">{score}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame
                className={`w-5 h-5 ${
                  streak > 0 ? 'text-orange-500' : 'text-slate-600'
                }`}
              />
              <span
                className={`text-sm font-bold ${
                  streak > 0 ? 'text-orange-500' : 'text-slate-600'
                }`}
              >
                {streak}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 pb-32">
          {currentCase && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto space-y-4"
            >
              {/* Clinical Context */}
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center gap-4 mb-3">
                  <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300">
                    {currentCase.patientAge}yo {currentCase.patientSex === 'M' ? 'Male' : 'Female'}
                  </span>
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {currentCase.clinicalContext}
                </p>
              </div>

              {/* Lab Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {currentCase.panels.map((panel, index) => (
                  <motion.div
                    key={`${panel.name}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <LabPanelCard panel={panel} />
                  </motion.div>
                ))}
              </div>
              
              {/* Order Additional Tests Button */}
              {status === 'playing' && availableTests.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4"
                >
                  <button
                    onClick={() => setShowOrderTestMenu(!showOrderTestMenu)}
                    className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-200 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Order Additional Tests ({availableTests.length} available)
                  </button>
                  
                  {showOrderTestMenu && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 p-4 bg-slate-800 rounded-xl border border-slate-700 max-h-64 overflow-y-auto"
                      role="menu"
                      aria-label="Available laboratory tests"
                    >
                      <div className="grid grid-cols-1 gap-2">
                        {availableTests.map((testName, index) => (
                          <button
                            key={testName}
                            onClick={() => handleOrderTest(testName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOrderTest(testName);
                              }
                            }}
                            className="px-4 py-2 text-left bg-slate-700 hover:bg-slate-600 focus:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg text-slate-200 transition-colors"
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
        </main>

        {/* Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800">
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
                <div className="max-w-2xl mx-auto">
                  <p className="text-sm text-slate-400 mb-2 text-center">
                    What is your diagnosis?
                  </p>
                  <DiagnosisInput
                    onSubmit={submitAnswer}
                    autoFocus
                    options={validDiagnoses}
                  />
                </div>
              </motion.div>
            )}

            {status === 'feedback' && currentCase && (
              <motion.div
                key="feedback-controls"
                variants={feedbackVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className={`p-4 ${
                  isCorrect
                    ? 'bg-emerald-950/50 border-t-2 border-emerald-500'
                    : 'bg-red-950/50 border-t-2 border-red-500'
                }`}
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div
                        className={`text-lg font-bold ${
                          isCorrect ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isCorrect ? 'Correct!' : 'Incorrect'}
                      </div>
                      {!isCorrect && (
                        <div className="text-sm text-slate-300 mt-1">
                          Correct answer:{' '}
                          <span className="font-semibold text-slate-100">
                            {currentCase.correctDiagnosis}
                          </span>
                        </div>
                      )}
                      {userAnswer && !isCorrect && (
                        <div className="text-sm text-slate-500 mt-0.5">
                          Your answer: {userAnswer}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={nextCase}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                        isCorrect
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                      }`}
                    >
                      Next Case
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Key Findings */}
                  <div className="text-sm bg-slate-900/50 rounded-lg p-4 mb-3">
                    <h4 className="font-semibold text-slate-200 mb-2">Key Findings:</h4>
                    <ul className="space-y-1">
                      {currentCase.keyFindings.map((finding, idx) => (
                        <li key={idx} className="text-slate-400 flex items-start gap-2">
                          <span className="text-emerald-500 mt-1">•</span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Explanation */}
                  <div className="text-sm text-slate-400 bg-slate-900/50 rounded-lg p-3">
                    <span className="font-medium text-slate-300">
                      Explanation:{' '}
                    </span>
                    {currentCase.explanation}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Summary View (Status: 'summary')
  // =========================================================================
  if (status === 'summary') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-8 bg-slate-900 rounded-2xl shadow-2xl text-center"
        >
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            Session Complete
          </h2>
          <p className="text-slate-400 mb-6">
            Great work on your lab interpretation training!
          </p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400">
                {score}
              </div>
              <div className="text-sm text-slate-500">Correct</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Start New Session
            </button>
            <button
              onClick={handleExit}
              className="px-6 py-3 text-slate-400 hover:text-slate-200 font-medium transition-colors"
            >
              Exit to Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Loading...</p>
        <button
          onClick={handleExit}
          className="text-sky-400 hover:text-sky-300"
        >
          Exit
        </button>
      </div>
    </div>
  );
};

export default MiniLabDrillSession;
