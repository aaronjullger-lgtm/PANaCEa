import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, Pill, ArrowRight, RotateCcw, Shuffle, Play } from 'lucide-react';
import type { AntibioticDrillQuestion, OrganismInfection, AntibioticDrug } from '@/types/drill-modes';
import { ORGANISMS, ANTIBIOTICS, COVERAGE_MAP, generateAntibioticDrill } from '@/data/modes/antibioticData';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { toTitleCase } from '@/lib/textUtils';
import { submitDrillResult } from '@/services/drillService';

interface AntibioticModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'active';

const AntibioticMode: React.FC<AntibioticModeProps> = ({ onExit }) => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [currentDrill, setCurrentDrill] = useState<AntibioticDrillQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = () => {
    setIsLoading(true);
    // Simulate loading for content generation buffer
    setTimeout(() => {
      setCurrentDrill(generateAntibioticDrill());
      setIsLoading(false);
      setViewState('active');
    }, 1000);
  };

  const handleNext = () => {
    setCurrentDrill(generateAntibioticDrill());
    setSelectedAnswer(null);
    setSelectedDrugs([]);
    setIsSubmitted(false);
    setIsCorrect(false);
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
        selectedDrugs.every(drug => correctDrugSet.has(drug)) &&
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
    setScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1
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
      { title: getDrillTypeLabel(), category: currentDrill.type }
    );
  };

  const toggleDrugSelection = (drugId: string) => {
    if (isSubmitted) return;
    
    setSelectedDrugs(prev => 
      prev.includes(drugId)
        ? prev.filter(id => id !== drugId)
        : [...prev, drugId]
    );
  };

  const getDrillTypeLabel = () => {
    switch (currentDrill.type) {
      case 'coverage': return 'Bug-Drug Coverage';
      case 'mechanism': return 'Mechanism of Action';
      case 'side_effects': return 'Side Effects';
      case 'empiric_choice': return 'Empiric Therapy';
      default: return 'Antibiotic Drill';
    }
  };

  const getDrillTypeColor = () => {
    switch (currentDrill.type) {
      case 'coverage': return 'from-blue-600 to-indigo-700';
      case 'mechanism': return 'from-purple-600 to-violet-700';
      case 'side_effects': return 'from-red-600 to-rose-700';
      case 'empiric_choice': return 'from-emerald-600 to-green-700';
      default: return 'from-slate-600 to-gray-700';
    }
  };

  const renderDrillContent = () => {
    if (currentDrill.type === 'coverage' && currentDrill.organism) {
      return (
        <div className="space-y-6">
          {/* Organism Card */}
          <div className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-purple-600 dark:text-purple-400">Target Organism</h3>
            <div className="bg-slate-50 dark:bg-[#1F283A] rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xl font-bold text-[#1F283A] dark:text-[#E9ECF1] mb-2">{currentDrill.organism.name}</h4>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-3 py-1 bg-purple-50 dark:bg-purple-950/30 rounded-full text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900">
                  {currentDrill.organism.category.replace('_', ' ')}
                </span>
              </div>
              {currentDrill.organism.description && (
                <p className="text-[#364154] dark:text-[#cbd5e1] text-sm mt-3">{currentDrill.organism.description}</p>
              )}
            </div>
          </div>

          {/* Drug Selection */}
          <div className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md">
            <h3 className="text-lg font-semibold mb-4 text-purple-600 dark:text-purple-400">
              Select Appropriate Antibiotics
            </h3>
            <p className="text-[#364154] dark:text-[#cbd5e1] text-sm mb-4">
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
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1F283A] hover:border-purple-300 dark:hover:border-purple-700'
                  } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="font-semibold text-[#1F283A] dark:text-[#E9ECF1] text-sm">{drug.name}</div>
                  <div className="text-xs text-[#364154] dark:text-[#cbd5e1] mt-1">{toTitleCase(drug.class)}</div>
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
      currentDrill.clinicalScenario || '';
    
    const choices = 
      currentDrill.mechanismChoices || 
      currentDrill.sideEffectChoices || 
      currentDrill.empiricChoices || [];

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
        <div className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-purple-600 dark:text-purple-400">Question</h3>
          <p className="text-[#1F283A] dark:text-[#E9ECF1] mb-6 leading-relaxed font-medium">{question}</p>

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
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1F283A] hover:border-purple-300 dark:hover:border-purple-700'
                } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedAnswer === index
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {selectedAnswer === index && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <span className="text-[#1F283A] dark:text-[#E9ECF1]">{choice}</span>
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
      <div className="min-h-screen bg-white dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1] transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1F283A] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E9ECF1] dark:bg-[#364154] flex items-center justify-center shadow-sm">
                <Pill className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Bug-Drug Mastery</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Antibiotic Selection & Knowledge</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#364154] dark:hover:bg-slate-700 transition-colors"
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
              <h2 className="text-4xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">Master Antibiotic Selection</h2>
              <p className="text-xl text-[#364154] dark:text-[#cbd5e1]">
                Sharpen your antimicrobial stewardship skills with rotating drill types
              </p>
            </div>

            {/* Drill Types Card */}
            <div className="bg-white dark:bg-[#364154] rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-6">Drill Types</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: 'Bug-Drug Coverage', desc: 'Match organisms to appropriate antibiotics', icon: '🦠' },
                  { title: 'Mechanism of Action', desc: 'Understand how antibiotics work', icon: '⚡' },
                  { title: 'Side Effects', desc: 'Know the adverse reactions and contraindications', icon: '⚠️' },
                  { title: 'Empiric Therapy', desc: 'Choose the right antibiotic for clinical scenarios', icon: '🎯' }
                ].map((drill, i) => (
                  <div key={i} className="bg-[#E9ECF1] dark:bg-[#1F283A] rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{drill.icon}</span>
                      <h4 className="font-semibold text-[#1F283A] dark:text-[#E9ECF1]">{drill.title}</h4>
                    </div>
                    <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">{drill.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-6 border border-purple-200 dark:border-purple-900">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Key Features
                </p>
                <ul className="text-sm text-[#364154] dark:text-[#cbd5e1] space-y-2">
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
                disabled={isLoading}
                className="px-10 py-4 bg-[#1F283A] text-[#E9ECF1] dark:bg-[#E9ECF1] dark:text-[#1F283A] hover:bg-[#364154] dark:hover:bg-white
                         disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg
                         transition-all flex items-center justify-center gap-3 mx-auto shadow-lg hover:shadow-xl"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
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

  // Active Session - Clinical White/Navy Theme
  if (!currentDrill) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1]">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#364154] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E9ECF1] dark:bg-[#1F283A] flex items-center justify-center shadow-sm">
              <Pill className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Bug-Drug Mastery</h1>
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Antibiotic Selection & Knowledge</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Score</p>
              <p className="text-xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">
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
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1F283A] dark:hover:bg-slate-700 transition-colors"
              title="Reset Score"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1F283A] dark:hover:bg-slate-700 transition-colors"
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
                className="flex-1 bg-[#1F283A] hover:bg-[#364154] dark:bg-[#E9ECF1] dark:hover:bg-white 
                         text-[#E9ECF1] dark:text-[#1F283A] py-4 rounded-lg font-semibold text-lg
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
                    <p className={`font-semibold mb-2 text-lg ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </p>
                    <p className="text-[#364154] dark:text-[#cbd5e1] leading-relaxed">
                      {currentDrill.explanation}
                    </p>
                    
                    {currentDrill.pearls && currentDrill.pearls.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="font-semibold text-purple-600 dark:text-purple-400">Clinical Pearls:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[#364154] dark:text-[#cbd5e1]">
                          {currentDrill.pearls.map((pearl, idx) => (
                            <li key={idx}>{pearl}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Show correct answer for coverage drills */}
                    {!isCorrect && currentDrill.type === 'coverage' && currentDrill.correctDrugs && (
                      <div className="mt-4">
                        <p className="font-semibold text-purple-400 mb-2">Correct Antibiotics:</p>
                        <div className="flex flex-wrap gap-2">
                          {currentDrill.correctDrugs.map(drugId => {
                            const drug = ANTIBIOTICS.find(d => d.id === drugId);
                            return drug ? (
                              <span key={drugId} className="px-3 py-1 bg-green-900/40 rounded-full text-green-300 text-sm border border-green-700/30">
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
