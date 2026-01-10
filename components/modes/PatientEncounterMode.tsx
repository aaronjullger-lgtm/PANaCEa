import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Send, User, Clock, Award, CheckCircle, XCircle, Globe, ArrowRight, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import type { PatientEncounterCase, PatientQuestion, EncounterSession, PatientPersona } from '@/types/drill-modes';
import { getRandomEncounterCase, calculateEncounterScore, saveChatMessage, getSessionHistory, clearSession } from '@/services/osceService';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { translateToSpanish, type SpanishMode } from '@/services/medicalSpanishService';
import { chatWithPatientSimulator, evaluateDiagnosis, performPhysicalExam, orderDiagnosticTest, evaluateTreatmentPlan, generateAfterActionReport } from '@/services/geminiService';
import { generatePatientCase } from '@/services/patientEncounterGenerator';
import { startOSCESession, saveOSCEChat, completeOSCESession } from '@/services/osceService';
import { generateDebrief, type PreceptorFeedback } from '@/services/virtualPreceptorService';
import { Activity, Stethoscope, Microscope, FileText, Pill, ChevronRight, PauseCircle, PlayCircle } from 'lucide-react';
import { Sparkline } from '@/components/Sparkline';
import { ChatSkeleton } from '@/components/loading/SkeletonLoader';
import { useVitalsEngine } from '@/hooks/useVitalsEngine';

// Clinical Fidelity settings interface
interface ClinicalFidelitySettings {
  emrInterface: boolean;
  writeOrders: boolean;
  rawLabValues: boolean;
  multimediaAuscultation: boolean;
}

// Load clinical fidelity settings from localStorage
function loadClinicalFidelitySettings(): ClinicalFidelitySettings {
  const saved = localStorage.getItem('panceai_clinical_fidelity');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return { emrInterface: false, writeOrders: false, rawLabValues: false, multimediaAuscultation: false };
    }
  }
  return { emrInterface: false, writeOrders: false, rawLabValues: false, multimediaAuscultation: false };
}

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
  const [patientPersona, setPatientPersona] = useState<PatientPersona | null>(null);
  const [secretDiagnosis, setSecretDiagnosis] = useState<string | null>(null);
  
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
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Feedback
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<{ isCorrect: boolean; feedback: string; score: number } | null>(null);
  const [treatmentFeedback, setTreatmentFeedback] = useState<{ isCorrect: boolean; feedback: string; score: number } | null>(null);
  const [aar, setAar] = useState<string>('');
  const [isPatientInfoExpanded, setIsPatientInfoExpanded] = useState(true);
  const [preceptorFeedback, setPreceptorFeedback] = useState<PreceptorFeedback | null>(null);
  
  // Clinical Fidelity Mode
  const [clinicalFidelity, setClinicalFidelity] = useState<ClinicalFidelitySettings>(() => loadClinicalFidelitySettings());
  const isFidelityModeActive = clinicalFidelity.rawLabValues || clinicalFidelity.emrInterface;

  const fallbackVitals = useMemo(() => ({
    hr: 82,
    bp: '122/76',
    rr: 16,
    o2sat: 98,
  }), []);

  const initialVitals = useMemo(() => currentCase?.vitalSigns || fallbackVitals, [currentCase, fallbackVitals]);
  const pathologyKey = useMemo(() => currentCase?.correctDiagnosis || currentCase?.chiefComplaint || 'stable', [currentCase]);

  const { currentVitals, history: vitalsHistory, registerTick, applyIntervention } = useVitalsEngine(initialVitals, pathologyKey);
  
  // Listen for changes to clinical fidelity settings
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'panceai_clinical_fidelity') {
        setClinicalFidelity(loadClinicalFidelitySettings());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Generate a dynamic patient persona on initial mount
  useEffect(() => {
    let isActive = true;

    const initPersona = async () => {
      try {
        const persona = await generatePatientCase();
        if (!isActive) return;
        setPatientPersona(persona);
        // Store secret diagnosis separately so it is never accidentally rendered
        setSecretDiagnosis(persona.secretDiagnosis || null);
      } catch (error) {
        console.error('Failed to generate patient persona:', error);
      }
    };

    initPersona();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!session || session.questions.length === 0) return;
    registerTick();
  }, [session?.questions.length, registerTick, session]);

  const getSemanticVitalClass = useCallback((value: number, range?: [number, number]) => {
    if (!range) return 'text-[var(--color-text-primary)]';
    return value < range[0] || value > range[1] ? 'text-red-500' : 'text-green-500';
  }, []);

  const detectInterventionIntent = useCallback((text: string) => {
    if (!text) return;
    const lower = text.toLowerCase();
    if (/(fluid|bolus|saline|lactated|ringer|ivf)/.test(lower)) {
      applyIntervention('fluids');
    }
    if (/(oxygen|o2|nasal cannula|non[-\s]?rebreather|mask|supplemental)/.test(lower)) {
      applyIntervention('oxygen');
    }
  }, [applyIntervention]);

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

  const generateTrendData = (currentValueStr: string): number[] | null => {
    // Extract first number found in string
    const match = currentValueStr.match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    
    const currentVal = parseFloat(match[0]);
    if (isNaN(currentVal)) return null;
  
    // Generate 5-7 historical points
    const points = 6;
    const data: number[] = [];
    
    // Create a trend that leads to the current value
    // Randomly decide if trend is stable, rising, or falling
    const trendType = Math.random();
    
    let val = currentVal;
    
    // Work backwards
    for (let i = 0; i < points; i++) {
      data.unshift(val);
      
      // Add noise
      const noise = (Math.random() - 0.5) * (currentVal * 0.1); // 10% variance
      
      if (trendType < 0.6) {
        // Stable
        val = val + noise;
      } else if (trendType < 0.8) {
        // Rising (so previous was lower)
        val = val - (currentVal * 0.05) + noise;
      } else {
        // Falling (so previous was higher)
        val = val + (currentVal * 0.05) + noise;
      }
    }
    
    return data;
  };

  const handleStartEncounter = async () => {
    setIsLoading(true);
    setLoadError(null);
    
    // Use dynamic generation to ensure fresh content each time (backend OSCE case)
    const newCase = await getRandomEncounterCase();
    
    if (!newCase) {
      console.error("Failed to load case");
      setIsLoading(false);
      setLoadError("Unable to load patient case. Please ensure the backend server is running (npm run dev:all) and try again.");
      return;
    }
    
    setCurrentCase(newCase);

    // Start backend session
    let sessionId: string | undefined;
    try {
      const osceSession = await startOSCESession(newCase.id);
      if (osceSession) {
        sessionId = osceSession.id;
      }
    } catch (e) {
      console.error("Failed to start OSCE session", e);
    }

    // Simulate loading for content generation buffer
    setTimeout(() => {
      setSession({
        id: sessionId,
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
    detectInterventionIntent(currentQuestion);
    
    // Prepare history for AI
    const chatHistory = session.questions.map(q => [
      { role: 'user' as const, content: q.questionText },
      { role: 'model' as const, content: q.response }
    ]).flat();

    try {
      // Call Gemini Simulator
      const response = await chatWithPatientSimulator(
        currentCase,
        chatHistory,
        currentQuestion,
        patientPersona,
      );
      
      const newQuestion: PatientQuestion = {
        questionText: currentQuestion,
        category: determineCategory(currentQuestion),
        relevance: 'helpful', // Default for AI interaction
        response: response,
        timestamp: Date.now(),
      };

      setSession(prev => prev ? ({
        ...prev,
        questions: [...prev.questions, newQuestion]
      }) : null);
      
      setCurrentQuestion('');

      // Persist chat messages individually
      if (session.id) {
        // Save user message
        await saveChatMessage(session.id, 'user', currentQuestion);
        // Save patient response
        await saveChatMessage(session.id, 'patient', response);
      }

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
    setPatientPersona(null);
    setSecretDiagnosis(null);
    setDifferentialDiagnoses([]);
    setTreatmentPlan('');
    setAar('');
    setPreceptorFeedback(null);
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
      
      // Complete session in backend
      if (session?.id) {
        await completeOSCESession(session.id, userDiagnosis, treatmentPlan);
      }
    } catch (error) {
      console.error("Treatment error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndEncounter = async () => {
    if (!currentCase || !session) return;
    
    setIsLoading(true);
    try {
      // Prepare session summary for Virtual Preceptor
      const sessionSummary = {
        transcript: session.questions.flatMap(q => [
          { role: 'user' as const, content: q.questionText },
          { role: 'model' as const, content: q.response }
        ]),
        physicalExams: physicalFindings,
        diagnosticTests: diagnosticResults,
        diagnosisSubmitted: userDiagnosis,
        treatmentPlan: treatmentPlan || undefined,
        differentials: differentialDiagnoses.length > 0 ? differentialDiagnoses : undefined,
      };
      
      // Get Virtual Preceptor evaluation
      const feedback = await generateDebrief(sessionSummary, currentCase);
      setPreceptorFeedback(feedback);
      
      // Generate legacy AAR for compatibility
      const report = await generateAfterActionReport({
        sessionId: session?.id || 'unknown',
        startTime: new Date(session?.startTime || Date.now()).toISOString(),
        endTime: new Date().toISOString(),
        testsOrdered: diagnosticResults.map(r => r.testName),
        chatHistory: session.questions.flatMap(q => [
          { role: 'user', content: q.questionText },
          { role: 'model', content: q.response }
        ]),
        actionsPerformed: [
          ...physicalFindings.map(f => `Exam: ${f.maneuver} -> ${f.finding}`),
          ...diagnosticResults.map(r => `Lab: ${r.testName} -> ${r.result}`)
        ],
        diagnosisSubmitted: userDiagnosis,
        treatmentPlan: treatmentPlan ? [treatmentPlan] : [],
        score: feedback.score
      }, currentCase);
      setAar(report);
      
      setViewState('results');
    } catch (error) {
      console.error("Error ending encounter:", error);
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
      case 'redundant': return 'text-muted-foreground bg-muted border-border';
      default: return 'text-muted-foreground bg-muted border-border';
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
      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Interactive Patient Interviews</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                aria-label="Exit Encounter"
                className="p-2 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
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
              <h2 className="text-4xl font-bold text-[var(--color-text-primary)]">Virtual Patient Encounter</h2>
              <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
                Practice clinical reasoning in a realistic patient interview simulation. 
                Gather history, perform exams, order tests, and make your diagnosis.
              </p>
            </div>

            {/* What You'll Practice */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-teal-50 dark:bg-slate-teal-950/20 rounded-2xl p-6 border border-slate-teal-200 dark:border-slate-teal-800">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-slate-teal-600 dark:text-slate-teal-400" />
                  Clinical Skills Practiced
                </h3>
                <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    History-taking and interview technique
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Physical examination interpretation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Diagnostic test selection and interpretation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Differential diagnosis development
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Treatment planning
                  </li>
                </ul>
              </div>

              <div className="bg-dusty-plum-50 dark:bg-dusty-plum-950/20 rounded-2xl p-6 border border-dusty-plum-200 dark:border-dusty-plum-800">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-dusty-plum-600 dark:text-dusty-plum-400" />
                  How You're Evaluated
                </h3>
                <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-dusty-plum-500 flex-shrink-0" />
                    Efficiency: Minimal unnecessary questions
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-dusty-plum-500 flex-shrink-0" />
                    Thoroughness: Covering key clinical domains
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-dusty-plum-500 flex-shrink-0" />
                    Diagnostic accuracy: Correct final diagnosis
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-dusty-plum-500 flex-shrink-0" />
                    Treatment appropriateness: Evidence-based plan
                  </li>
                </ul>
              </div>
            </div>

            {/* How It Works Card */}
            <div className="bg-[var(--color-bg-primary)] rounded-2xl p-8 border border-[var(--color-border)] shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-[var(--color-text-primary)]">Encounter Flow</h3>
              
              <div className="space-y-5">
                {[
                  {
                    num: 1,
                    title: 'Review the Chief Complaint',
                    desc: "You'll be presented with a patient's chief complaint and vital signs. The patient will respond dynamically to your questions.",
                    Icon: User
                  },
                  {
                    num: 2,
                    title: 'Take History',
                    desc: 'Type questions to gather history. Use focused, open-ended questions first, then targeted follow-ups. Information is revealed only when you ask!',
                    Icon: MessageSquare
                  },
                  {
                    num: 3,
                    title: 'Physical Exam & Diagnostics',
                    desc: 'Request physical exam maneuvers and order labs/imaging. Build your differential diagnosis as you gather data.',
                    Icon: Microscope
                  },
                  {
                    num: 4,
                    title: 'Diagnose & Treat',
                    desc: 'Submit your diagnosis and treatment plan. Receive detailed feedback from a virtual preceptor on your clinical reasoning.',
                    Icon: FileText
                  }
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-secondary)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
                      <step.Icon className="w-5 h-5 text-[var(--color-accent)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        <span className="text-[var(--color-text-secondary)] mr-2">{step.num}.</span>
                        {step.title}
                      </h4>
                      <p className="text-[var(--color-text-secondary)] text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro Tips */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 border border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-accent)] font-semibold mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Clinical Pearls
                </p>
                <ul className="text-sm text-[var(--color-text-secondary)] space-y-2">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <span>Start with open-ended questions (onset, location, duration, character, aggravating/alleviating factors)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <span>Review of systems should be targeted based on your differential</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <span>Order tests to rule in or rule out specific diagnoses, not as a shotgun approach</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <span>Think about pre-test probability before ordering expensive or invasive tests</span>
                  </li>
                </ul>
              </div>

              {/* Estimated Time */}
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Clock className="w-4 h-4" />
                <span>Typical encounter: 10-20 minutes</span>
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center space-y-4">
              <motion.button
                onClick={handleStartEncounter}
                disabled={isLoading}
                className="px-10 py-4 bg-card text-card-foreground dark:bg-foreground dark:text-background hover:bg-card/90 dark:hover:bg-foreground/90
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
              
              {/* Error Message */}
              {loadError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-md mx-auto p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl"
                >
                  <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
                  <button
                    onClick={() => setLoadError(null)}
                    className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
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
      <div className="min-h-screen bg-[var(--color-bg-secondary)] dark:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">
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

            {/* Mobile Phase Indicator */}
            <div className="md:hidden flex items-center gap-2 bg-[var(--color-bg-tertiary)] px-3 py-1.5 rounded-full border border-[var(--color-border)]">
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
              <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
                {phase}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Clinical Fidelity Badge */}
              {isFidelityModeActive && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-700">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold">Fidelity Mode</span>
                </div>
              )}
              <button
                onClick={toggleLanguageMode}
                aria-label="Toggle Language Mode"
                className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2"
                title="Toggle Language (English / Spanish / Side-by-Side)"
              >
                <Globe className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase w-8 text-center">
                  {languageMode === 'side-by-side' ? 'Dual' : languageMode === 'spanish' ? 'ES' : 'EN'}
                </span>
              </button>
              <div className="flex items-center gap-2 text-sm" aria-label={`Time elapsed: ${minutes} minutes ${seconds} seconds`}>
                <Clock className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="font-mono text-[var(--color-text-primary)]">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  aria-label="Exit Encounter"
                  className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
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
              {/* Patient Card (Collapsible) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] shadow-md overflow-hidden"
              >
                <div 
                  className="p-4 md:p-6 flex items-start gap-4 cursor-pointer hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                  onClick={() => setIsPatientInfoExpanded(!isPatientInfoExpanded)}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-secondary)] flex items-center justify-center border border-[var(--color-border)] flex-shrink-0">
                    <User className="w-6 h-6 text-[var(--color-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-[var(--color-text-primary)] truncate">{currentCase.patientName}</h2>
                      <button className="text-[var(--color-text-secondary)] p-1">
                        {isPatientInfoExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-[var(--color-text-secondary)] truncate text-sm">
                      {currentCase.age}yo {currentCase.sex} • {currentCase.chiefComplaint.substring(0, 40)}{currentCase.chiefComplaint.length > 40 ? '...' : ''}
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {isPatientInfoExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4 md:px-6 md:pb-6 space-y-3"
                    >
                      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
                        <p className="text-xs font-semibold text-[var(--color-accent)] mb-1">CHIEF COMPLAINT</p>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)] whitespace-pre-wrap">
                          {currentCase?.chiefComplaint ? getTranslatedText(currentCase.chiefComplaint) : <span className="inline-block w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>}
                        </p>
                      </div>

                      <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border)] space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-[var(--color-text-secondary)]">EMR MONITOR</p>
                          <span className="text-[10px] uppercase tracking-wide text-[var(--color-accent)]">Live</span>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="bg-[var(--color-bg-primary)] rounded-md p-3 border border-[var(--color-border)]">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-[var(--color-text-secondary)]">Blood Pressure</span>
                              <span className={`text-lg font-semibold ${getSemanticVitalClass(currentVitals.sbp, [90, 140])}`}>
                                {Math.round(currentVitals.sbp)}/{Math.round(currentVitals.dbp)} mmHg
                              </span>
                            </div>
                            <Sparkline
                              data={vitalsHistory.sbp}
                              width={180}
                              height={48}
                              referenceRange={[90, 140]}
                              showDots={false}
                              fillArea
                            />
                          </div>

                          <div className="bg-[var(--color-bg-primary)] rounded-md p-3 border border-[var(--color-border)]">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-[var(--color-text-secondary)]">Heart Rate</span>
                              <span className={`text-lg font-semibold ${getSemanticVitalClass(currentVitals.hr, [60, 100])}`}>
                                {Math.round(currentVitals.hr)} bpm
                              </span>
                            </div>
                            <Sparkline
                              data={vitalsHistory.hr}
                              width={180}
                              height={48}
                              referenceRange={[60, 100]}
                              showDots={false}
                              fillArea
                            />
                          </div>

                          <div className="bg-[var(--color-bg-primary)] rounded-md p-3 border border-[var(--color-border)]">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-[var(--color-text-secondary)]">Respiratory Rate</span>
                              <span className={`text-lg font-semibold ${getSemanticVitalClass(currentVitals.rr, [12, 20])}`}>
                                {Math.round(currentVitals.rr)} /min
                              </span>
                            </div>
                            <Sparkline
                              data={vitalsHistory.rr}
                              width={180}
                              height={48}
                              referenceRange={[12, 20]}
                              showDots={false}
                              fillArea
                            />
                          </div>

                          <div className="bg-[var(--color-bg-primary)] rounded-md p-3 border border-[var(--color-border)]">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-[var(--color-text-secondary)]">O₂ Saturation</span>
                              <span className={`text-lg font-semibold ${getSemanticVitalClass(currentVitals.o2, [94, 100])}`}>
                                {Math.round(currentVitals.o2)}%
                              </span>
                            </div>
                            <Sparkline
                              data={vitalsHistory.o2}
                              width={180}
                              height={48}
                              referenceRange={[94, 100]}
                              showDots={false}
                              fillArea
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Phase Specific Inputs */}
              
              {/* HISTORY PHASE */}
              {phase === 'history' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-[var(--color-bg-primary)] rounded-xl p-4 md:p-6 border border-[var(--color-border)] shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Ask a Question</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="e.g., When did the chest pain start?"
                      className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                               text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] 
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={!currentQuestion.trim()}
                      aria-label="Send Question"
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
                  className="bg-[var(--color-bg-primary)] rounded-xl p-4 md:p-6 border border-[var(--color-border)] shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Perform Physical Exam</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">Describe the maneuver you want to perform (e.g., "Auscultate heart", "Palpate abdomen").</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handlePhysicalExam()}
                      placeholder="e.g., Auscultate lungs"
                      className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                               text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] 
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handlePhysicalExam}
                      disabled={!currentQuestion.trim() || isLoading}
                      aria-label="Perform Physical Exam"
                      className="px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm flex items-center justify-center min-w-[3.5rem]"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Stethoscope className="w-5 h-5" />
                      )}
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
                  className="bg-[var(--color-bg-primary)] rounded-xl p-4 md:p-6 border border-[var(--color-border)] shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Order Diagnostics</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">Order labs or imaging (e.g., "CBC", "Chest X-Ray").</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleOrderTest()}
                      placeholder="e.g., CBC, BMP, CXR"
                      className="flex-1 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg 
                               text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] 
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleOrderTest}
                      disabled={!currentQuestion.trim() || isLoading}
                      aria-label="Order Diagnostic Test"
                      className="px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm flex items-center justify-center min-w-[3.5rem]"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Activity className="w-5 h-5" />
                      )}
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
                  className="bg-[var(--color-bg-secondary)] rounded-xl p-4 md:p-6 border border-[var(--color-border)] shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Final Diagnosis</h3>
                  <input
                    type="text"
                    value={userDiagnosis}
                    onChange={(e) => setUserDiagnosis(e.target.value)}
                    placeholder="Enter your primary diagnosis..."
                    className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg mb-4
                             text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] 
                             focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={handleSubmitDiagnosis}
                    disabled={!userDiagnosis.trim() || isLoading}
                    className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                             disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                             transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      'Submit Diagnosis'
                    )}
                  </button>
                </motion.div>
              )}

              {/* TREATMENT PHASE */}
              {phase === 'treatment' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-[var(--color-bg-secondary)] rounded-xl p-4 md:p-6 border border-[var(--color-border)] shadow-md space-y-4"
                >
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Treatment Plan</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mb-3">Outline your management plan (medications, disposition, follow-up).</p>
                    <textarea
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                      placeholder="e.g., Admit to telemetry, start Aspirin 325mg, Heparin drip..."
                      className="w-full px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg
                               text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] 
                               focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent shadow-sm min-h-[120px]"
                    />
                  </div>
                  
                  {treatmentFeedback && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Treatment Feedback:</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{treatmentFeedback.feedback}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    {!treatmentFeedback && (
                      <button
                        onClick={handleTreatmentSubmit}
                        disabled={!treatmentPlan.trim() || isLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 
                                 disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                                 transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Evaluating...
                          </>
                        ) : (
                          'Submit Treatment Plan'
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={handleEndEncounter}
                      disabled={isLoading}
                      className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-slate-300 dark:disabled:bg-slate-700 
                               disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                               transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Consulting Preceptor...
                        </>
                      ) : (
                        <>
                          <Award className="w-5 h-5" />
                          End Encounter & Get Feedback
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

            </div>

            {/* Right Column: Output Stream */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-[var(--color-bg-primary)] rounded-xl p-4 md:p-6 border border-[var(--color-border)] shadow-md h-[600px] flex flex-col"
              >
                <h3 className="text-lg font-semibold mb-4 text-[var(--color-accent)]">Encounter Log</h3>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {/* History Log */}
                  {session.questions.map((q, idx) => (
                    <div key={`hist-${idx}`} className="bg-[var(--color-bg-secondary)] rounded-lg p-4 space-y-2 border border-[var(--color-border)]">
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)] uppercase">
                        <MessageSquare className="w-3 h-3" /> History
                      </div>
                      <p className="text-[var(--color-text-primary)] font-semibold">Q: {q.questionText}</p>
                      <p className="text-[var(--color-text-secondary)] text-sm pl-4 border-l-2 border-[var(--color-border)] whitespace-pre-wrap">
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
                      <p className="text-[var(--color-text-primary)] font-semibold">Exam: {f.maneuver}</p>
                      <p className="text-[var(--color-text-secondary)] text-sm pl-4 border-l-2 border-blue-300 whitespace-pre-wrap">
                        Finding: {f.finding}
                      </p>
                    </div>
                  ))}

                  {/* Diagnostic Log */}
                  {diagnosticResults.map((r, idx) => {
                    const trendData = generateTrendData(r.result);
                    
                    return (
                      <div key={`diag-${idx}`} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-2 border border-purple-100 dark:border-purple-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-purple-500 uppercase">
                            <Activity className="w-3 h-3" /> Diagnostics
                          </div>
                          {trendData && !clinicalFidelity.rawLabValues && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-purple-400 uppercase font-semibold">Trend</span>
                              <Sparkline 
                                data={trendData} 
                                width={60} 
                                height={20} 
                                color="#a855f7" 
                                strokeWidth={2}
                                showDots={false}
                              />
                            </div>
                          )}
                        </div>
                        <p className="text-[#1F283A] dark:text-[#E9ECF1] font-semibold">Order: {r.testName}</p>
                        <p className="text-[#364154] dark:text-[#cbd5e1] text-sm pl-4 border-l-2 border-purple-300 whitespace-pre-wrap font-mono">
                          Result: {r.result}
                        </p>
                        {/* Hide interpretation in Clinical Fidelity mode - makes user interpret raw values */}
                        {!clinicalFidelity.rawLabValues && r.interpretation && (
                          <p className="text-[#64748b] dark:text-[#94a3b8] text-xs pl-4 border-l-2 border-purple-200 italic">
                            Interpretation: {r.interpretation}
                          </p>
                        )}
                      </div>
                    );
                  })}

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

                  {/* Loading state with smooth skeleton */}
                  {isLoading && (
                    <ChatSkeleton messages={2} className="mt-4" />
                  )}

                  {/* Typing indicator (when AI is responding but not loading) */}
                  {isTyping && !isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground italic p-4">
                      <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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

  // Results View - Virtual Preceptor Report Card
  if (viewState === 'results' && currentCase && preceptorFeedback) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-[var(--color-accent)]" />
              <div>
                <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Performance Evaluation</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          {/* Overall Score Hero */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white shadow-xl text-center"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <Award className="w-12 h-12" />
            </div>
            <h2 className="text-5xl font-bold mb-2">{Math.round(preceptorFeedback.score)}%</h2>
            <p className="text-xl opacity-90">Overall Performance</p>
          </motion.div>

          {/* Clinical Reasoning Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--color-bg-primary)] rounded-xl p-6 border border-[var(--color-border)] shadow-md"
          >
            <h3 className="text-xl font-semibold mb-4 text-[var(--color-accent)]">Clinical Competencies</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: 'History-Taking', score: preceptorFeedback?.clinicalReasoning?.historyTaking || 0, icon: MessageSquare },
                { label: 'Physical Exam', score: preceptorFeedback?.clinicalReasoning?.physicalExam || 0, icon: Stethoscope },
                { label: 'Diagnosis', score: preceptorFeedback?.clinicalReasoning?.diagnosis || 0, icon: FileText },
                { label: 'Management', score: preceptorFeedback?.clinicalReasoning?.management || 0, icon: Pill },
              ].map((item, idx) => {
                const percentage = (item.score / 10) * 100;
                const Icon = item.icon;
                return (
                  <div key={idx} className="bg-[var(--color-bg-secondary)] rounded-lg p-4 border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-[var(--color-accent)]" />
                        <span className="font-semibold text-[var(--color-text-primary)]">{item.label}</span>
                      </div>
                      <span className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
                        {item.score}/10
                      </span>
                    </div>
                    <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }}
                        className={`h-full rounded-full ${
                          percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Preceptor Narrative Feedback */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[var(--color-bg-primary)] rounded-xl p-6 border border-[var(--color-border)] shadow-md"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[var(--color-accent)]">Your Preceptor's Feedback</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Clinical reasoning assessment</p>
              </div>
            </div>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-5 border border-[var(--color-border)]">
              <p className="text-[var(--color-text-primary)] leading-relaxed italic">
                "{preceptorFeedback.feedback}"
              </p>
            </div>
          </motion.div>

          {/* Strengths & Areas for Improvement */}
          <div className="grid md:grid-cols-2 gap-6">
            {preceptorFeedback.strengths.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800"
              >
                <h3 className="text-lg font-semibold mb-4 text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Strengths
                </h3>
                <ul className="space-y-2">
                  {preceptorFeedback.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-green-900 dark:text-green-100">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {preceptorFeedback.areasForImprovement.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800"
              >
                <h3 className="text-lg font-semibold mb-4 text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5" /> Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {preceptorFeedback.areasForImprovement.map((area, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-orange-900 dark:text-orange-100">
                      <span className="text-orange-500 mt-0.5">•</span>
                      <span>{area}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>

          {/* Missed Critical Cues */}
          {preceptorFeedback.missedCriticalCues.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800"
            >
              <h3 className="text-lg font-semibold mb-4 text-red-700 dark:text-red-300 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Missed Critical Cues
              </h3>
              <p className="text-sm text-red-900 dark:text-red-100 mb-3">
                The patient mentioned these important details that you didn't follow up on:
              </p>
              <ul className="space-y-2">
                {preceptorFeedback.missedCriticalCues.map((cue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-red-900 dark:text-red-100 bg-red-100 dark:bg-red-900/30 rounded p-3 border border-red-200 dark:border-red-800">
                    <span className="text-red-500 font-bold mt-0.5">!</span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Differential Diagnoses to Consider */}
          {preceptorFeedback.differentialDiagnosis.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800"
            >
              <h3 className="text-lg font-semibold mb-4 text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <Activity className="w-5 h-5" /> Differential Diagnoses to Consider
              </h3>
              <p className="text-sm text-purple-900 dark:text-purple-100 mb-3">
                Based on the presentation, you should have considered:
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {preceptorFeedback.differentialDiagnosis.map((dx, idx) => (
                  <div key={idx} className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <span className="font-semibold text-purple-900 dark:text-purple-100">{dx}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Correct Diagnosis Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800"
          >
            <h3 className="text-lg font-semibold mb-3 text-blue-700 dark:text-blue-300">Correct Diagnosis</h3>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-3">{currentCase.correctDiagnosis}</p>
            {currentCase.teachingPoints && currentCase.teachingPoints.length > 0 && (
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Teaching Points:</p>
                <ul className="space-y-1">
                  {currentCase.teachingPoints.map((point, idx) => (
                    <li key={idx} className="text-sm text-blue-900 dark:text-blue-100 flex items-start gap-2">
                      <Award className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>

          {/* Legacy AAR (if available) */}
          {aar && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-[var(--color-bg-primary)] rounded-xl p-6 border border-[var(--color-border)] shadow-md"
            >
              <h3 className="text-xl font-semibold mb-4 text-[var(--color-accent)] flex items-center gap-2">
                <FileText className="w-5 h-5" /> Additional Notes
              </h3>
              <div className="prose dark:prose-invert max-w-none text-[var(--color-text-secondary)] whitespace-pre-wrap text-sm">
                {aar}
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <motion.button
              onClick={handleNewCase}
              className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] py-4 rounded-xl font-semibold text-white
                       transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <MessageSquare className="w-5 h-5" />
              Try Another Case
            </motion.button>
            {onExit && (
              <motion.button
                onClick={onExit}
                className="px-8 py-4 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded-xl font-semibold
                         text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Exit
              </motion.button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Legacy results view (fallback if no preceptor feedback)
  if (viewState === 'results' && currentCase && session && session.score) {
    const { score } = session;
    const isCorrectDiagnosis = diagnosisFeedback?.isCorrect ?? false;

    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-[var(--color-accent)]" />
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE - Results</h1>
                <p className="text-sm text-muted-foreground">Performance Summary</p>
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
              <div className="mb-4 p-4 bg-card/50 rounded-lg border border-border/50">
                <p className="text-sm font-semibold mb-1 opacity-75">AI Feedback:</p>
                <p className="text-muted-foreground italic">"{diagnosisFeedback.feedback}"</p>
              </div>
            )}

            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Correct Diagnosis:</p>
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
              <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.overall)}`}>
                {Math.round(score.overall)}%
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-xl p-6 border border-border text-center shadow-sm"
            >
              <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Thoroughness</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.thoroughness)}`}>
                {Math.round(score.thoroughness)}%
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-xl p-6 border border-border text-center shadow-sm"
            >
              <Clock className="w-8 h-8 text-blue-500 dark:text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Efficiency</p>
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
              className="bg-card rounded-xl p-6 border border-border shadow-sm"
            >
              <h3 className="text-xl font-semibold mb-4 text-[var(--color-accent)] flex items-center gap-2">
                <FileText className="w-5 h-5" /> After-Action Report
              </h3>
              <div className="prose dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
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
                <li key={idx} className="flex items-start gap-2 text-muted-foreground">
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
