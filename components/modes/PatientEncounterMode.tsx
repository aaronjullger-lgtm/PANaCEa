import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Send, User, Clock, Award, CheckCircle, XCircle, Globe, ArrowRight } from 'lucide-react';
import type { PatientEncounterCase, PatientQuestion, EncounterSession } from '@/types/drill-modes';
import { getRandomEncounterCase, calculateEncounterScore } from '@/data/modes/patientEncounterData';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { translateToSpanish, type SpanishMode } from '@/services/medicalSpanishService';
import { chatWithPatientSimulator, evaluateDiagnosis, performPhysicalExam, orderDiagnosticTest, evaluateTreatmentPlan, generateAfterActionReport } from '@/services/geminiService';
import { Activity, Stethoscope, Microscope, FileText, Pill, ChevronRight, PauseCircle, PlayCircle } from 'lucide-react';

interface PatientEncounterModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'active' | 'results';
type EncounterPhase = 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';

const PatientEncounterMode: React.FC<PatientEncounterModeProps> = ({ onExit }) => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [phase, setPhase] = useState<EncounterPhase>('history');
  const [isPaused, setIsPaused] = useState(false);
  
  const [currentCase, setCurrentCase] = useState<PatientEncounterCase | null>(null);
  const [session, setSession] = useState<EncounterSession | null>(null);
  
  // Phase Inputs
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [examAction, setExamAction] = useState<string>('');
  const [diagnosticOrder, setDiagnosticOrder] = useState<string>('');
  const [userDiagnosis, setUserDiagnosis] = useState<string>('');
  const [treatmentPlan, setTreatmentPlan] = useState<string>('');
  
  // Phase Data
  const [physicalFindings, setPhysicalFindings] = useState<{maneuver: string, finding: string}[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<{testName: string, result: string, interpretation: string}[]>([]);
  const [differentialDiagnoses, setDifferentialDiagnoses] = useState<string[]>([]);
  const [newDifferential, setNewDifferential] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [languageMode, setLanguageMode] = useState<SpanishMode>('english');
  
  // Feedback
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<{ isCorrect: boolean; feedback: string; score: number } | null>(null);
  const [treatmentFeedback, setTreatmentFeedback] = useState<{ isCorrect: boolean; feedback: string; score: number } | null>(null);
  const [aar, setAar] = useState<string>('');

  const toggleLanguageMode = () => {
    setLanguageMode(prev => {
      if (prev === 'english') return 'spanish';
      if (prev === 'spanish') return 'side-by-side';
      return 'english';
    });
  };

  const getTranslatedText = (text: string) => {
    if (languageMode === 'english') return text;
    const translated = translateToSpanish(text);
    if (languageMode === 'spanish') return translated;
    return `${text}\n\n[ES] ${translated}`;
  };

  const handleStartEncounter = () => {
    setIsLoading(true);
    // Simulate loading for content generation buffer
    setTimeout(() => {
      // Use dynamic generation to ensure fresh content each time
      const newCase = getRandomEncounterCase(true);
      setCurrentCase(newCase);
      setSession({
        caseId: newCase.id,
        questions: [],
        startTime: Date.now(),
      });
      setIsLoading(false);
      setViewState('active');
    }, 1500);
  };

  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !currentCase || !session) return;

    setIsTyping(true);
    
    // Prepare history for AI
    const chatHistory = session.questions.map(q => [
      { role: 'user' as const, content: q.questionText },
      { role: 'model' as const, content: q.response }
    ]).flat();

    try {
      // Call Gemini Simulator
      const response = await chatWithPatientSimulator(currentCase, chatHistory, currentQuestion);
      
      const newQuestion: PatientQuestion = {
        questionText: currentQuestion,
        category: determineCategory(currentQuestion),
        relevance: 'helpful', // Default for AI interaction
        response: response,
        timestamp: Date.now(),
      };

      setSession(prev => prev ? ({
        ...prev,
        questions: [...prev.questions, newQuestion],
      }) : null);

      setCurrentQuestion('');
      hapticSuccess();
    } catch (error) {
      console.error("Error getting patient response:", error);
      // Fallback or error toast could go here
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmitDiagnosis = async () => {
    if (!session || !currentCase) return;

    setIsLoading(true);

    try {
      // Evaluate diagnosis with AI
      const caseContext = `Patient: ${currentCase.patientName}, ${currentCase.age}yo ${currentCase.sex}. CC: ${currentCase.chiefComplaint}. Correct Dx: ${currentCase.correctDiagnosis}`;
      const feedback = await evaluateDiagnosis(currentCase.correctDiagnosis, userDiagnosis, caseContext);
      
      setDiagnosisFeedback(feedback);
      
      // Move to Treatment Phase
      setPhase('treatment');
    } catch (error) {
      console.error("Error submitting diagnosis:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewCase = () => {
    setCurrentCase(null);
    setSession(null);
    setUserDiagnosis('');
    setCurrentQuestion('');
    setViewState('landing');
    setPhase('history');
    setLanguageMode('english');
    setDiagnosisFeedback(null);
    setTreatmentFeedback(null);
    setPhysicalFindings([]);
    setDiagnosticResults([]);
    setDifferentialDiagnoses([]);
    setTreatmentPlan('');
    setAar('');
  };

  const handlePhysicalExam = async () => {
    if (!examAction.trim() || !currentCase) return;
    setIsLoading(true);
    try {
      const result = await performPhysicalExam(examAction, currentCase);
      setPhysicalFindings(prev => [...prev, { maneuver: examAction, finding: result }]);
      setExamAction('');
    } catch (error) {
      console.error("Exam error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderTest = async () => {
    if (!diagnosticOrder.trim() || !currentCase) return;
    setIsLoading(true);
    try {
      const data = await orderDiagnosticTest(diagnosticOrder, currentCase);
      setDiagnosticResults(prev => [...prev, { 
        testName: diagnosticOrder, 
        result: data.result, 
        interpretation: data.interpretation 
      }]);
      setDiagnosticOrder('');
    } catch (error) {
      console.error("Diagnostic error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDifferential = () => {
    if (newDifferential.trim()) {
      setDifferentialDiagnoses(prev => [...prev, newDifferential.trim()]);
      setNewDifferential('');
    }
  };

  const handleTreatmentSubmit = async () => {
    if (!treatmentPlan.trim() || !currentCase) return;
    setIsLoading(true);
    try {
      const feedback = await evaluateTreatmentPlan(treatmentPlan, currentCase);
      setTreatmentFeedback(feedback);
      
      // Generate AAR
      const report = await generateAfterActionReport({
        questions: session?.questions,
        physical: physicalFindings,
        labs: diagnosticResults,
        diagnosis: userDiagnosis,
        treatment: treatmentPlan,
        diagnosisFeedback,
        treatmentFeedback: feedback
      }, currentCase);
      setAar(report);
      
      setViewState('results');
    } catch (error) {
      console.error("Treatment error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const advancePhase = (target?: EncounterPhase) => {
    if (target) {
      setPhase(target);
      return;
    }
    
    if (phase === 'history') setPhase('physical');
    else if (phase === 'physical') setPhase('diagnostic');
    else if (phase === 'diagnostic') setPhase('diagnosis');
    else if (phase === 'diagnosis') handleSubmitDiagnosis();
  };

  const determineCategory = (question: string): PatientQuestion['category'] => {
    const lowerQ = question.toLowerCase();
    if (lowerQ.includes('history') || lowerQ.includes('when') || lowerQ.includes('how long') || lowerQ.includes('family')) {
      return 'history';
    }
    if (lowerQ.includes('exam') || lowerQ.includes('physical') || lowerQ.includes('abdomen') || lowerQ.includes('heart')) {
      return 'physical';
    }
    if (lowerQ.includes('lab') || lowerQ.includes('test') || lowerQ.includes('ecg') || lowerQ.includes('xray')) {
      return 'labs';
    }
    return 'other';
  };

  const getRelevanceColor = (relevance: PatientQuestion['relevance']) => {
    switch (relevance) {
      case 'essential': return 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/30 dark:border-green-900';
      case 'helpful': return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-900';
      case 'unnecessary': return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-900';
      case 'redundant': return 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/30 dark:border-slate-700';
      default: return 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/30 dark:border-slate-700';
    }
  };

  const getRelevanceLabel = (relevance: PatientQuestion['relevance']) => {
    switch (relevance) {
      case 'essential': return 'Essential';
      case 'helpful': return 'Helpful';
      case 'unnecessary': return 'Unnecessary';
      case 'redundant': return 'Redundant';
      default: return 'Other';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Landing Page View - Clinical White/Navy Theme
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1] transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1F283A] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E9ECF1] dark:bg-[#364154] flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Interactive Patient Interviews</p>
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
              <h2 className="text-4xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">Ready to Interview Your Patient?</h2>
              <p className="text-xl text-[#364154] dark:text-[#cbd5e1]">
                Test your clinical reasoning and history-taking skills
              </p>
            </div>

            {/* How It Works Card */}
            <div className="bg-white dark:bg-[#364154] rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-[#1F283A] dark:text-[#E9ECF1]">How It Works</h3>
              
              <div className="space-y-5">
                {[
                  {
                    num: 1,
                    title: 'Review the Chief Complaint',
                    desc: "You'll be presented with a patient's chief complaint and vital signs",
                    icon: '👤'
                  },
                  {
                    num: 2,
                    title: 'Ask Questions',
                    desc: 'Type questions to gather history, physical exam findings, and test results. Information is revealed only when you ask!',
                    icon: '💬'
                  },
                  {
                    num: 3,
                    title: 'Make Your Diagnosis',
                    desc: 'Submit your diagnosis when you feel you have enough information',
                    icon: '🔍'
                  },
                  {
                    num: 4,
                    title: 'Get Scored',
                    desc: 'Receive feedback on your thoroughness, efficiency, and diagnostic accuracy',
                    icon: '📊'
                  }
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-secondary)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
                      <span className="text-xl">{step.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-1">{step.title}</h4>
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro Tips */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-accent)] font-semibold mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Pro Tips
                </p>
                <ul className="text-sm text-[#364154] dark:text-[#cbd5e1] space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Ask essential questions first (onset, character, severity)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Avoid unnecessary questions that waste time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Be thorough but efficient - quality over quantity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>Consider differential diagnoses as you gather information</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center">
              <motion.button
                onClick={handleStartEncounter}
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
                    Generating Case...
                  </>
                ) : (
                  <>
                    Start Interview
                    <MessageSquare className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active Interview View - Clinical White/Navy Theme
  if (viewState === 'active' && currentCase && session) {
    const elapsedSeconds = Math.floor((Date.now() - session.startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1]">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#364154] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E9ECF1] dark:bg-[#1F283A] flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">
                  Phase: <span className="font-semibold text-[var(--color-accent)] uppercase">{phase}</span>
                </p>
              </div>
            </div>
            
            {/* Phase Progress Indicator */}
            <div className="hidden md:flex items-center gap-2">
              {['history', 'physical', 'diagnostic', 'diagnosis', 'treatment'].map((p, idx) => {
                const phases = ['history', 'physical', 'diagnostic', 'diagnosis', 'treatment'];
                const currentIdx = phases.indexOf(phase);
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                
                return (
                  <div key={p} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 
                      ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                        isCurrent ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' : 
                        'bg-transparent border-slate-300 text-slate-400'}`}>
                      {idx + 1}
                    </div>
                    {idx < phases.length - 1 && (
                      <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-slate-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleLanguageMode}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1F283A] dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                title="Toggle Language (English / Spanish / Side-by-Side)"
              >
                <Globe className="w-4 h-4 text-[#364154] dark:text-[#cbd5e1]" />
                <span className="text-xs font-medium text-[#364154] dark:text-[#cbd5e1] uppercase w-8 text-center">
                  {languageMode === 'side-by-side' ? 'Dual' : languageMode === 'spanish' ? 'ES' : 'EN'}
                </span>
              </button>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-[#364154] dark:text-[#cbd5e1]" />
                <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
              </div>
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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: Patient Info & Inputs */}
            <div className="space-y-4">
              {/* Patient Card (Always Visible) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-secondary)] flex items-center justify-center border border-[var(--color-border)]">
                    <User className="w-6 h-6 text-[var(--color-accent)]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.patientName}</h2>
                    <p className="text-[#364154] dark:text-[#cbd5e1]">{currentCase.age} year old {currentCase.sex === 'M' ? 'male' : currentCase.sex === 'F' ? 'female' : 'patient'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-accent)] mb-1">CHIEF COMPLAINT</p>
                    <p className="text-lg font-semibold text-[#1F283A] dark:text-[#E9ECF1] whitespace-pre-wrap">
                      {getTranslatedText(currentCase.chiefComplaint)}
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#1F283A] rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-[#364154] dark:text-[#cbd5e1] mb-3">VITAL SIGNS</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">BP:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.bp}</span>
                      </div>
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">HR:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.hr} bpm</span>
                      </div>
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">RR:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.rr} /min</span>
                      </div>
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">Temp:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.temp}°F</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#364154] dark:text-[#cbd5e1]">O₂ Sat:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.o2sat}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Phase Specific Inputs */}
              
              {/* HISTORY PHASE */}
              {phase === 'history' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Ask a Question</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="e.g., When did the chest pain start?"
                      className="flex-1 px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg 
                               text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={!currentQuestion.trim()}
                      className="px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => advancePhase('physical')}
                      className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
                    >
                      Move to Physical Exam <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* PHYSICAL EXAM PHASE */}
              {phase === 'physical' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Perform Physical Exam</h3>
                  <p className="text-sm text-slate-500 mb-3">Describe the maneuver you want to perform (e.g., "Auscultate heart", "Palpate abdomen").</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handlePhysicalExam()}
                      placeholder="e.g., Auscultate lungs"
                      className="flex-1 px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg 
                               text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handlePhysicalExam}
                      disabled={!currentQuestion.trim()}
                      className="px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm"
                    >
                      <Stethoscope className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => advancePhase('diagnostic')}
                      className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
                    >
                      Move to Diagnostics <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* DIAGNOSTIC PHASE */}
              {phase === 'diagnostic' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Order Diagnostics</h3>
                  <p className="text-sm text-slate-500 mb-3">Order labs or imaging (e.g., "CBC", "Chest X-Ray").</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleOrderTest()}
                      placeholder="e.g., CBC, BMP, CXR"
                      className="flex-1 px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg 
                               text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleOrderTest}
                      disabled={!currentQuestion.trim()}
                      className="px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm"
                    >
                      <Activity className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => advancePhase('diagnosis')}
                      className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
                    >
                      Move to Diagnosis <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* DIAGNOSIS PHASE */}
              {phase === 'diagnosis' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)] shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Final Diagnosis</h3>
                  <input
                    type="text"
                    value={userDiagnosis}
                    onChange={(e) => setUserDiagnosis(e.target.value)}
                    placeholder="Enter your primary diagnosis..."
                    className="w-full px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg mb-4
                             text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                             focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={handleSubmitDiagnosis}
                    disabled={!userDiagnosis.trim()}
                    className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                             disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                             transition-colors shadow-sm"
                  >
                    Submit Diagnosis
                  </button>
                </motion.div>
              )}

              {/* TREATMENT PHASE */}
              {phase === 'treatment' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)] shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Treatment Plan</h3>
                  <p className="text-sm text-slate-500 mb-3">Outline your management plan (medications, disposition, follow-up).</p>
                  <textarea
                    value={treatmentPlan}
                    onChange={(e) => setTreatmentPlan(e.target.value)}
                    placeholder="e.g., Admit to telemetry, start Aspirin 325mg, Heparin drip..."
                    className="w-full px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg mb-4
                             text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                             focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm min-h-[120px]"
                  />
                  <button
                    onClick={handleTreatmentSubmit}
                    disabled={!treatmentPlan.trim()}
                    className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                             disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                             transition-colors shadow-sm"
                  >
                    Finalize Encounter
                  </button>
                </motion.div>
              )}

            </div>

            {/* Right Column: Output Stream */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md h-[600px] flex flex-col"
              >
                <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Encounter Log</h3>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {/* History Log */}
                  {session.questions.map((q, idx) => (
                    <div key={`hist-${idx}`} className="bg-slate-50 dark:bg-[#1F283A] rounded-lg p-4 space-y-2 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                        <MessageSquare className="w-3 h-3" /> History
                      </div>
                      <p className="text-[#1F283A] dark:text-[#E9ECF1] font-semibold">Q: {q.questionText}</p>
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-sm pl-4 border-l-2 border-[var(--color-border)] whitespace-pre-wrap">
                        A: {getTranslatedText(q.response)}
                      </p>
                    </div>
                  ))}

                  {/* Physical Exam Log */}
                  {physicalFindings.map((f, idx) => (
                    <div key={`phys-${idx}`} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2 border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase">
                        <Stethoscope className="w-3 h-3" /> Physical Exam
                      </div>
                      <p className="text-[#1F283A] dark:text-[#E9ECF1] font-semibold">Exam: {f.maneuver}</p>
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-sm pl-4 border-l-2 border-blue-300 whitespace-pre-wrap">
                        Finding: {f.finding}
                      </p>
                    </div>
                  ))}

                  {/* Diagnostic Log */}
                  {diagnosticResults.map((r, idx) => (
                    <div key={`diag-${idx}`} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-2 border border-purple-100 dark:border-purple-800">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-500 uppercase">
                        <Activity className="w-3 h-3" /> Diagnostics
                      </div>
                      <p className="text-[#1F283A] dark:text-[#E9ECF1] font-semibold">Order: {r.testName}</p>
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-sm pl-4 border-l-2 border-purple-300 whitespace-pre-wrap font-mono">
                        Result: {r.result}
                      </p>
                    </div>
                  ))}

                  {/* Diagnosis Log */}
                  {diagnosisFeedback && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2 border border-green-100 dark:border-green-800">
                      <div className="flex items-center gap-2 text-xs font-bold text-green-500 uppercase">
                        <CheckCircle className="w-3 h-3" /> Diagnosis
                      </div>
                      <p className="text-[#1F283A] dark:text-[#E9ECF1] font-semibold">Dx: {userDiagnosis}</p>
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-sm pl-4 border-l-2 border-green-300 whitespace-pre-wrap">
                        {diagnosisFeedback.feedback}
                      </p>
                    </div>
                  )}

                  {isTyping && (
                    <div className="flex items-center gap-2 text-slate-400 italic p-4">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="text-sm ml-2">Processing...</span>
                    </div>
                  )}
                  
                  {/* Empty State */}
                  {session.questions.length === 0 && physicalFindings.length === 0 && diagnosticResults.length === 0 && (
                    <p className="text-[#364154] dark:text-[#cbd5e1] text-center py-8 italic">
                      Start the encounter by asking about the patient's history.
                    </p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results View
  if (viewState === 'results' && currentCase && session && session.score) {
    const { score } = session;
    const isCorrectDiagnosis = diagnosisFeedback?.isCorrect ?? false;

    return (
      <div className="min-h-screen bg-white dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1]">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#364154] sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-[var(--color-accent)]" />
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE - Results</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Performance Summary</p>
              </div>
            </div>
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

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {/* Diagnosis Result */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-6 border ${
              isCorrectDiagnosis
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {isCorrectDiagnosis ? (
                <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-orange-500 dark:text-orange-400" />
              )}
              <div>
                <h2 className={`text-2xl font-bold ${
                  isCorrectDiagnosis ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'
                }`}>
                  {isCorrectDiagnosis ? 'Correct Diagnosis!' : 'Diagnosis Review'}
                </h2>
                <p className="text-[#364154] dark:text-[#cbd5e1]">Your diagnosis: {userDiagnosis}</p>
              </div>
            </div>
            
            {diagnosisFeedback?.feedback && (
              <div className="mb-4 p-4 bg-white/50 dark:bg-black/20 rounded-lg border border-black/5 dark:border-white/5">
                <p className="text-sm font-semibold mb-1 opacity-75">AI Feedback:</p>
                <p className="text-[#364154] dark:text-[#cbd5e1] italic">"{diagnosisFeedback.feedback}"</p>
              </div>
            )}

            <div className="bg-white dark:bg-[#364154] rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1] mb-1">Correct Diagnosis:</p>
              <p className="text-lg font-semibold text-[var(--color-accent)]">{currentCase.correctDiagnosis}</p>
            </div>
          </motion.div>

          {/* Score Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center shadow-sm"
            >
              <Award className="w-8 h-8 text-[var(--color-accent)] mx-auto mb-2" />
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1] mb-1">Overall Score</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.overall)}`}>
                {Math.round(score.overall)}%
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center shadow-sm"
            >
              <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400 mx-auto mb-2" />
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1] mb-1">Thoroughness</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.thoroughness)}`}>
                {Math.round(score.thoroughness)}%
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center shadow-sm"
            >
              <Clock className="w-8 h-8 text-blue-500 dark:text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-[#364154] dark:text-[#cbd5e1] mb-1">Efficiency</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.efficiency)}`}>
                {Math.round(score.efficiency)}%
              </p>
            </motion.div>
          </div>

          {/* After Action Report (AAR) */}
          {aar && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <h3 className="text-xl font-semibold mb-4 text-[var(--color-accent)] flex items-center gap-2">
                <FileText className="w-5 h-5" /> After-Action Report
              </h3>
              <div className="prose dark:prose-invert max-w-none text-[#364154] dark:text-[#cbd5e1] whitespace-pre-wrap">
                {aar}
              </div>
            </motion.div>
          )}

          {/* Ideal Workup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <h3 className="text-xl font-semibold mb-4 text-[var(--color-accent)]">Ideal Workup</h3>
            <ul className="space-y-2">
              {currentCase.idealWorkup.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[#364154] dark:text-[#cbd5e1]">
                  <CheckCircle className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
};

export default PatientEncounterMode;
