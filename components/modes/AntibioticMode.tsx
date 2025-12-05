import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, Pill, ArrowRight, RotateCcw, Shuffle, Play } from 'lucide-react';
import type { AntibioticDrillQuestion, OrganismInfection, AntibioticDrug } from '@/types/drill-modes';
import { ORGANISMS, ANTIBIOTICS, COVERAGE_MAP, generateAntibioticDrill } from '@/data/modes/antibioticData';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { toTitleCase } from '@/lib/textUtils';

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
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-800/30">
            <h3 className="text-lg font-semibold mb-2 text-purple-400">Target Organism</h3>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-xl font-bold text-white mb-2">{currentDrill.organism.name}</h4>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-3 py-1 bg-purple-900/40 rounded-full text-purple-300 border border-purple-700/30">
                  {currentDrill.organism.category.replace('_', ' ')}
                </span>
              </div>
              {currentDrill.organism.description && (
                <p className="text-slate-400 text-sm mt-3">{currentDrill.organism.description}</p>
              )}
            </div>
          </div>

          {/* Drug Selection */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-800/30">
            <h3 className="text-lg font-semibold mb-4 text-purple-400">
              Select Appropriate Antibiotics
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Choose one or more antibiotics that provide coverage for this organism.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ANTIBIOTICS.map((drug) => (
                <button
                  key={drug.id}
                  onClick={() => toggleDrugSelection(drug.id)}
                  disabled={isSubmitted}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedDrugs.includes(drug.id)
                      ? 'border-purple-500 bg-purple-900/40'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                  } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="font-semibold text-white text-sm">{drug.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{toTitleCase(drug.class)}</div>
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
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-800/30">
          <h3 className="text-lg font-semibold mb-4 text-purple-400">Question</h3>
          <p className="text-slate-200 mb-6 leading-relaxed">{question}</p>

          {/* Answer Choices */}
          <div className="space-y-3">
            {choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(index)}
                disabled={isSubmitted}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedAnswer === index
                    ? 'border-purple-500 bg-purple-900/40'
                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                } ${isSubmitted ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedAnswer === index
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-slate-600'
                  }`}>
                    {selectedAnswer === index && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <span className="text-slate-200">{choice}</span>
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
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white">
        <div className="border-b border-purple-800/30 bg-black/20 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pill className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold">Bug-Drug Mastery</h1>
                <p className="text-sm text-purple-300">Antibiotic Selection & Knowledge</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8"
          >
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-purple-400">Master Antibiotic Selection</h2>
              <p className="text-xl text-slate-300">
                Sharpen your antimicrobial stewardship skills with rotating drill types
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-purple-800/30 text-left space-y-6">
              <h3 className="text-2xl font-semibold text-purple-400">Drill Types</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-800/30">
                  <h4 className="font-semibold text-white mb-2">Bug-Drug Coverage</h4>
                  <p className="text-slate-400 text-sm">Match organisms to appropriate antibiotics</p>
                </div>
                <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                  <h4 className="font-semibold text-white mb-2">Mechanism of Action</h4>
                  <p className="text-slate-400 text-sm">Understand how antibiotics work</p>
                </div>
                <div className="bg-red-900/20 rounded-lg p-4 border border-red-800/30">
                  <h4 className="font-semibold text-white mb-2">Side Effects</h4>
                  <p className="text-slate-400 text-sm">Know the adverse reactions and contraindications</p>
                </div>
                <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-800/30">
                  <h4 className="font-semibold text-white mb-2">Empiric Therapy</h4>
                  <p className="text-slate-400 text-sm">Choose the right antibiotic for clinical scenarios</p>
                </div>
              </div>

              <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800/30">
                <p className="text-sm text-purple-300 font-semibold mb-2">Features:</p>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Rotating drill types keep practice fresh</li>
                  <li>• Clinical pearls with every question</li>
                  <li>• Real-world clinical scenarios</li>
                  <li>• Comprehensive antibiotic database</li>
                  <li>• Immediate feedback and explanations</li>
                </ul>
              </div>
            </div>

            <motion.button
              onClick={handleStart}
              disabled={isLoading}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 
                       disabled:cursor-not-allowed rounded-xl font-bold text-lg shadow-2xl
                       transition-all duration-300 flex items-center justify-center gap-3 mx-auto"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading Questions...
                </>
              ) : (
                <>
                  <Pill className="w-6 h-6" />
                  Start Practice
                  <Play className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active Session
  if (!currentDrill) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white">
      {/* Header */}
      <div className="border-b border-purple-800/30 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Pill className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">Bug-Drug Mastery</h1>
              <p className="text-sm text-purple-300">Antibiotic Selection & Knowledge</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-400">Score</p>
              <p className="text-xl font-bold">
                {score.correct}/{score.total}
                {score.total > 0 && (
                  <span className="text-sm ml-2 text-purple-400">
                    ({Math.round((score.correct / score.total) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              title="Reset Score"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
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
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${getDrillTypeColor()} text-white font-semibold`}>
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
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 
                         disabled:cursor-not-allowed py-4 rounded-lg font-semibold text-lg
                         transition-colors flex items-center justify-center gap-2"
              >
                Submit Answer
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-4 rounded-lg font-semibold text-lg
                         transition-colors flex items-center justify-center gap-2"
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
                className={`rounded-xl p-6 border ${
                  isCorrect
                    ? 'bg-green-900/40 border-green-600/30'
                    : 'bg-red-900/40 border-red-600/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold mb-2 text-lg ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      {currentDrill.explanation}
                    </p>
                    
                    {currentDrill.pearls && currentDrill.pearls.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="font-semibold text-purple-400">Clinical Pearls:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
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
