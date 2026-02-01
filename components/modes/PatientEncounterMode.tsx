import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MessageSquare,
  Send,
  User,
  Clock,
  Award,
  CheckCircle,
  XCircle,
  Globe,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Heart,
  ClipboardList,
  Stethoscope as StethoscopeIcon,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import type {
  PatientEncounterCase,
  PatientQuestion,
  EncounterSession,
  PatientPersona,
} from '@/types/drill-modes';
import type { PlacedOrder, ExamFinding, OSCEScoreReport } from '@/types/osce-enhanced';

// Import OSCE Enhancement Components
import { OrderPanel, ExamPanel, RapportMeter, RapportIndicator, ScoreReport } from './osce';
import { useEnhancedOSCE } from '@/hooks/useEnhancedOSCE';
import {
  getRandomEncounterCase,
  calculateEncounterScore,
  saveChatMessage,
  getSessionHistory,
  clearSession,
  startOSCESession,
  saveOSCEChat,
  completeOSCESession,
  translateToSpanish,
  type SpanishMode,
  generatePatientCase,
} from '@/services/domain';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import {
  chatWithPatientSimulator,
  evaluateDiagnosis,
  performPhysicalExam,
  orderDiagnosticTest,
  evaluateTreatmentPlan,
  generateAfterActionReport,
} from '@/services/ai';
import { generateDebrief, type PreceptorFeedback } from '@/services/ai';
import {
  Activity,
  Stethoscope,
  Microscope,
  FileText,
  Pill,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  FlaskConical,
  Scan,
  TestTube,
} from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';
import { ChatSkeleton } from '@/components/loading/SkeletonLoader';
import { useVitalsEngine } from '@/hooks/useVitalsEngine';
import { formatPatientAge, formatPatientAgeShort, parsePatientAge } from '@/lib/utils/ageFormatter';

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
      return {
        emrInterface: false,
        writeOrders: false,
        rawLabValues: false,
        multimediaAuscultation: false,
      };
    }
  }
  return {
    emrInterface: false,
    writeOrders: false,
    rawLabValues: false,
    multimediaAuscultation: false,
  };
}

interface PatientEncounterModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'active' | 'results';
type EncounterPhase = 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';

const PatientEncounterMode: React.FC<PatientEncounterModeProps> = ({ onExit }) => {
  const { getToken } = useAuth();
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
  const [physicalFindings, setPhysicalFindings] = useState<{ maneuver: string; finding: string }[]>(
    []
  );
  const [diagnosticResults, setDiagnosticResults] = useState<
    { testName: string; result: string; interpretation: string }[]
  >([]);
  const [differentialDiagnoses, setDifferentialDiagnoses] = useState<string[]>([]);
  const [newDifferential, setNewDifferential] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [languageMode, setLanguageMode] = useState<SpanishMode>('english');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Feedback
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<{
    isCorrect: boolean;
    feedback: string;
    score: number;
  } | null>(null);
  const [treatmentFeedback, setTreatmentFeedback] = useState<{
    isCorrect: boolean;
    feedback: string;
    score: number;
  } | null>(null);
  const [aar, setAar] = useState<string>('');
  const [isPatientInfoExpanded, setIsPatientInfoExpanded] = useState(true);
  const [preceptorFeedback, setPreceptorFeedback] = useState<PreceptorFeedback | null>(null);

  // Clinical Fidelity Mode
  const [clinicalFidelity, setClinicalFidelity] = useState<ClinicalFidelitySettings>(() =>
    loadClinicalFidelitySettings()
  );
  const isFidelityModeActive = clinicalFidelity.rawLabValues || clinicalFidelity.emrInterface;

  // Enhanced OSCE Panel States
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showExamPanel, setShowExamPanel] = useState(false);
  const [showRapportMeter, setShowRapportMeter] = useState(true);
  const [enhancedScoreReport, setEnhancedScoreReport] = useState<OSCEScoreReport | null>(null);

  // Initialize Enhanced OSCE Hook
  const enhancedOSCE = useEnhancedOSCE({
    enablePersonality: true,
    enableRapport: true,
    enableScoring: true,
  });

  const fallbackVitals = useMemo(
    () => ({
      hr: 82,
      bp: '122/76',
      rr: 16,
      o2sat: 98,
    }),
    []
  );

  const initialVitals = useMemo(
    () => currentCase?.vitalSigns || fallbackVitals,
    [currentCase, fallbackVitals]
  );
  const pathologyKey = useMemo(
    () => currentCase?.correctDiagnosis || currentCase?.chiefComplaint || 'stable',
    [currentCase]
  );

  const {
    currentVitals,
    history: vitalsHistory,
    registerTick,
    applyIntervention,
  } = useVitalsEngine(initialVitals, pathologyKey);

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
    if (!range) return 'text-white';
    return value < range[0] || value > range[1] ? 'text-data-fail' : 'text-data-pass';
  }, []);

  const detectInterventionIntent = useCallback(
    (text: string) => {
      if (!text) return;
      const lower = text.toLowerCase();
      if (/(fluid|bolus|saline|lactated|ringer|ivf)/.test(lower)) {
        applyIntervention('fluids');
      }
      if (/(oxygen|o2|nasal cannula|non[-\s]?rebreather|mask|supplemental)/.test(lower)) {
        applyIntervention('oxygen');
      }
    },
    [applyIntervention]
  );

  const toggleLanguageMode = () => {
    setLanguageMode((prev) => {
      if (prev === 'english') return 'spanish';
      if (prev === 'spanish') return 'side-by-side';
      return 'english';
    });
  };

  const getTranslatedText = (text: string) => {
    if (languageMode === 'english') return text;
    const translated = translateToSpanish(text);
    if (languageMode === 'spanish') return translated;
    // Side-by-side mode: show both with subtle divider (no [ES] prefix)
    return `${text}\n\n—\n${translated}`;
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
        val = val - currentVal * 0.05 + noise;
      } else {
        // Falling (so previous was higher)
        val = val + currentVal * 0.05 + noise;
      }
    }

    return data;
  };

  const handleStartEncounter = async () => {
    setIsLoading(true);
    setLoadError(null);

    // Get authentication token
    const token = await getToken();

    // Use dynamic generation to ensure fresh content each time (backend OSCE case)
    const newCase = await getRandomEncounterCase(token);

    if (!newCase) {
      console.error('Failed to load case');
      setIsLoading(false);
      setLoadError(
        'Unable to load patient case. Please ensure the backend server is running (npm run dev:all) and try again.'
      );
      return;
    }

    setCurrentCase(newCase);

    // Initialize Enhanced OSCE with case data (pass full case for type compatibility)
    enhancedOSCE.initializeSession(newCase as any);

    // Start backend session
    let sessionId: string | undefined;
    try {
      const osceSession = await startOSCESession(newCase.id, token);
      if (osceSession) {
        sessionId = osceSession.id;
      }
    } catch (e) {
      console.error('Failed to start OSCE session', e);
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
    const chatHistory = session.questions
      .map((q) => [
        { role: 'user' as const, content: q.questionText },
        { role: 'model' as const, content: q.response },
      ])
      .flat();

    try {
      // Call Gemini Simulator
      const response = await chatWithPatientSimulator(
        currentCase,
        chatHistory,
        currentQuestion,
        patientPersona
      );

      const newQuestion: PatientQuestion = {
        questionText: currentQuestion,
        category: determineCategory(currentQuestion),
        relevance: 'helpful', // Default for AI interaction
        response: response,
        timestamp: Date.now(),
      };

      setSession((prev) =>
        prev
          ? {
              ...prev,
              questions: [...prev.questions, newQuestion],
            }
          : null
      );

      setCurrentQuestion('');

      // Persist chat messages individually
      if (session.id) {
        const token = await getToken();
        // Save user message
        await saveChatMessage(session.id, 'user', currentQuestion, token);
        // Save patient response
        await saveChatMessage(session.id, 'patient', response, token);
      }
    } catch (error) {
      console.error('Error getting patient response:', error);
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
      const feedback = await evaluateDiagnosis(
        currentCase.correctDiagnosis,
        userDiagnosis,
        caseContext
      );

      setDiagnosisFeedback(feedback);

      // Move to Treatment Phase
      setPhase('treatment');
    } catch (error) {
      console.error('Error submitting diagnosis:', error);
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
      setPhysicalFindings((prev) => [...prev, { maneuver: examAction, finding: result }]);
      setExamAction('');
    } catch (error) {
      console.error('Exam error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderTest = async () => {
    if (!diagnosticOrder.trim() || !currentCase) return;
    setIsLoading(true);
    try {
      const data = await orderDiagnosticTest(diagnosticOrder, currentCase);
      setDiagnosticResults((prev) => [
        ...prev,
        {
          testName: diagnosticOrder,
          result: data.result,
          interpretation: data.interpretation,
        },
      ]);
      setDiagnosticOrder('');
    } catch (error) {
      console.error('Diagnostic error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDifferential = () => {
    if (newDifferential.trim()) {
      setDifferentialDiagnoses((prev) => [...prev, newDifferential.trim()]);
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
        const token = await getToken();
        await completeOSCESession(session.id, userDiagnosis, treatmentPlan, token);
      }
    } catch (error) {
      console.error('Treatment error:', error);
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
        transcript: session.questions.flatMap((q) => [
          { role: 'user' as const, content: q.questionText },
          { role: 'model' as const, content: q.response },
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

      // Generate Enhanced OSCE Score Report
      const osceReport = enhancedOSCE.generateScoreReport({
        diagnosisSubmitted: userDiagnosis,
        treatmentPlan: treatmentPlan,
        differentials: differentialDiagnoses,
      });
      setEnhancedScoreReport(osceReport);

      // Generate legacy AAR for compatibility
      const report = await generateAfterActionReport(
        {
          sessionId: session?.id || 'unknown',
          startTime: new Date(session?.startTime || Date.now()).toISOString(),
          endTime: new Date().toISOString(),
          testsOrdered: diagnosticResults.map((r) => r.testName),
          chatHistory: session.questions.flatMap((q) => [
            { role: 'user', content: q.questionText },
            { role: 'model', content: q.response },
          ]),
          actionsPerformed: [
            ...physicalFindings.map((f) => `Exam: ${f.maneuver} -> ${f.finding}`),
            ...diagnosticResults.map((r) => `Lab: ${r.testName} -> ${r.result}`),
          ],
          diagnosisSubmitted: userDiagnosis,
          treatmentPlan: treatmentPlan ? [treatmentPlan] : [],
          score: feedback.score,
        },
        currentCase
      );
      setAar(report);

      setViewState('results');
    } catch (error) {
      console.error('Error ending encounter:', error);
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
    if (
      lowerQ.includes('history') ||
      lowerQ.includes('when') ||
      lowerQ.includes('how long') ||
      lowerQ.includes('family')
    ) {
      return 'history';
    }
    if (
      lowerQ.includes('exam') ||
      lowerQ.includes('physical') ||
      lowerQ.includes('abdomen') ||
      lowerQ.includes('heart')
    ) {
      return 'physical';
    }
    if (
      lowerQ.includes('lab') ||
      lowerQ.includes('test') ||
      lowerQ.includes('ecg') ||
      lowerQ.includes('xray')
    ) {
      return 'labs';
    }
    return 'other';
  };

  const getRelevanceColor = (relevance: PatientQuestion['relevance']) => {
    switch (relevance) {
      case 'essential':
        return 'text-sage-700 bg-sage-50 border-sage-200 dark:text-sage-300 dark:bg-sage-950/30 dark:border-sage-900';
      case 'helpful':
        return 'text-action-blue-700 bg-action-blue-50 border-action-blue-200 dark:text-action-blue-300 dark:bg-action-blue-950/30 dark:border-action-blue-900';
      case 'unnecessary':
        return 'text-muted-amber-700 bg-muted-amber-50 border-muted-amber-200 dark:text-muted-amber-300 dark:bg-muted-amber-950/30 dark:border-muted-amber-900';
      case 'redundant':
        return 'text-muted-foreground bg-muted border-border';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getRelevanceLabel = (relevance: PatientQuestion['relevance']) => {
    switch (relevance) {
      case 'essential':
        return 'Essential';
      case 'helpful':
        return 'Helpful';
      case 'unnecessary':
        return 'Unnecessary';
      case 'redundant':
        return 'Redundant';
      default:
        return 'Other';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-data-pass';
    if (score >= 60) return 'text-data-provisional';
    return 'text-data-fail';
  };

  // Landing Page View - Clinical White/Navy Theme
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-white transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-slate-400">Interactive Patient Interviews</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                aria-label="Exit Encounter"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800"
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
              <h2 className="text-4xl font-bold text-white">Virtual Patient Encounter</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Practice clinical reasoning in a realistic patient interview simulation. Gather
                history, perform exams, order tests, and make your diagnosis.
              </p>
            </div>

            {/* What You'll Practice */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-slate-400" />
                  Clinical Skills Practiced
                </h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />
                    History-taking and interview technique
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />
                    Physical examination interpretation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />
                    Diagnostic test selection and interpretation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />
                    Differential diagnosis development
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0" />
                    Treatment planning
                  </li>
                </ul>
              </div>

              <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-slate-400" />
                  How You're Evaluated
                </h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    Efficiency: Minimal unnecessary questions
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    Thoroughness: Covering key clinical domains
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-deep-plum-500 flex-shrink-0" />
                    Diagnostic accuracy: Correct final diagnosis
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-deep-plum-500 flex-shrink-0" />
                    Treatment appropriateness: Evidence-based plan
                  </li>
                </ul>
              </div>
            </div>

            {/* How It Works Card */}
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-white">Encounter Flow</h3>

              <div className="space-y-5">
                {[
                  {
                    num: 1,
                    title: 'Review the Chief Complaint',
                    desc: "You'll be presented with a patient's chief complaint and vital signs. The patient will respond dynamically to your questions.",
                    Icon: User,
                  },
                  {
                    num: 2,
                    title: 'Take History',
                    desc: 'Type questions to gather history. Use focused, open-ended questions first, then targeted follow-ups. Information is revealed only when you ask!',
                    Icon: MessageSquare,
                  },
                  {
                    num: 3,
                    title: 'Physical Exam & Diagnostics',
                    desc: 'Request physical exam maneuvers and order labs/imaging. Build your differential diagnosis as you gather data.',
                    Icon: Microscope,
                  },
                  {
                    num: 4,
                    title: 'Diagnose & Treat',
                    desc: 'Submit your diagnosis and treatment plan. Receive detailed feedback from a virtual preceptor on your clinical reasoning.',
                    Icon: FileText,
                  },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700">
                      <step.Icon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">
                        <span className="text-slate-400 mr-2">{step.num}.</span>
                        {step.title}
                      </h4>
                      <p className="text-slate-400 text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro Tips */}
              <div className="bg-slate-950 rounded-xl p-6 border border-slate-800">
                <p className="text-sm text-slate-300 font-semibold mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Clinical Pearls
                </p>
                <ul className="text-sm text-slate-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Start with open-ended questions (onset, location, duration, character,
                      aggravating/alleviating factors)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <span>Review of systems should be targeted based on your differential</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Order tests to rule in or rule out specific diagnoses, not as a shotgun
                      approach
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Think about pre-test probability before ordering expensive or invasive tests
                    </span>
                  </li>
                </ul>
              </div>

              {/* Estimated Time */}
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
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
                  className="max-w-md mx-auto p-4 bg-dusty-rose-50 dark:bg-dusty-rose-950/30 border border-dusty-rose-200 dark:border-dusty-rose-800 rounded-xl"
                >
                  <p className="text-sm text-dusty-rose-700 dark:text-dusty-rose-300">
                    {loadError}
                  </p>
                  <button
                    onClick={() => setLoadError(null)}
                    className="mt-2 text-xs text-dusty-rose-600 dark:text-dusty-rose-400 hover:underline"
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
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shadow-sm border border-slate-800">
                <MessageSquare className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Virtual OSCE</h1>
                <p className="text-sm text-slate-400">
                  Phase: <span className="font-semibold text-slate-300 uppercase">{phase}</span>
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
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 
                      ${
                        isCompleted
                          ? 'bg-slate-700 border-slate-700 text-white'
                          : isCurrent
                            ? 'bg-slate-500 border-slate-500 text-white'
                            : 'bg-transparent border-slate-700 text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    {idx < phases.length - 1 && (
                      <div
                        className={`w-8 h-0.5 ${isCompleted ? 'bg-slate-700' : 'bg-slate-700'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Phase Indicator */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {phase}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Enhanced OSCE Panel Toggles */}
              <div className="hidden md:flex items-center gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-1 border border-[var(--color-border)]">
                <button
                  onClick={() => setShowRapportMeter(!showRapportMeter)}
                  className={`p-2 rounded-md transition-colors ${showRapportMeter ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Rapport Meter"
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowExamPanel(!showExamPanel)}
                  className={`p-2 rounded-md transition-colors ${showExamPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Physical Exam Panel"
                >
                  <StethoscopeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowOrderPanel(!showOrderPanel)}
                  className={`p-2 rounded-md transition-colors ${showOrderPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Order Panel"
                >
                  <ClipboardList className="w-4 h-4" />
                </button>
              </div>
              {/* Clinical Fidelity Badge */}
              {isFidelityModeActive && (
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Fidelity
                  </span>
                </div>
              )}
              <button
                onClick={toggleLanguageMode}
                aria-label="Toggle Language Mode"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-2 border border-slate-800"
                title="Toggle Language (English / Spanish / Side-by-Side)"
              >
                <Globe className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-400 uppercase w-8 text-center">
                  {languageMode === 'side-by-side'
                    ? 'Dual'
                    : languageMode === 'spanish'
                      ? 'ES'
                      : 'EN'}
                </span>
              </button>
              <div
                className="flex items-center gap-2 text-sm"
                aria-label={`Time elapsed: ${minutes} minutes ${seconds} seconds`}
              >
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-white">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  aria-label="Exit Encounter"
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800"
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
                className="bg-slate-900 rounded-xl border border-slate-800 shadow-md overflow-hidden"
              >
                <div
                  className="p-4 md:p-6 flex items-start gap-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => setIsPatientInfoExpanded(!isPatientInfoExpanded)}
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 flex-shrink-0">
                    <User className="w-6 h-6 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white truncate">
                        {currentCase.patientName}
                      </h2>
                      <button className="text-slate-400 p-1">
                        {isPatientInfoExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-slate-400 truncate text-sm">
                      {formatPatientAgeShort(currentCase.age)} {currentCase.sex} •{' '}
                      {currentCase.chiefComplaint.substring(0, 40)}
                      {currentCase.chiefComplaint.length > 40 ? '...' : ''}
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
                      <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Chief Complaint
                        </p>
                        <p className="text-lg font-semibold text-white whitespace-pre-wrap">
                          {currentCase?.chiefComplaint ? (
                            getTranslatedText(currentCase.chiefComplaint)
                          ) : (
                            <span className="inline-block w-32 h-4 bg-slate-800 rounded animate-pulse"></span>
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg p-4 border border-slate-800 space-y-3 bg-slate-950">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            EMR Monitor
                          </p>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                            Live
                          </span>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {/* Blood Pressure Card */}
                          <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                              Blood Pressure
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.sbp ?? 0)}/
                                {Math.round(currentVitals.dbp ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-slate-400">mmHg</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.sbp}
                                width={180}
                                height={40}
                                referenceRange={[90, 140]}
                                showDots={false}
                                fillArea
                              />
                            </div>
                          </div>

                          {/* Heart Rate Card */}
                          <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                              Heart Rate
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.hr ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-slate-400">bpm</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.hr}
                                width={180}
                                height={40}
                                referenceRange={[60, 100]}
                                showDots={false}
                                fillArea
                              />
                            </div>
                          </div>

                          {/* Respiratory Rate Card */}
                          <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                              Respiratory Rate
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.rr ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-slate-400">/min</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.rr}
                                width={180}
                                height={40}
                                referenceRange={[12, 20]}
                                showDots={false}
                                fillArea
                              />
                            </div>
                          </div>

                          {/* O₂ Saturation Card */}
                          <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                              O₂ Saturation
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.o2 ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-slate-400">%</span>
                            </div>
                            <div className="mt-3">
                              <Sparkline
                                data={vitalsHistory.o2}
                                width={180}
                                height={40}
                                referenceRange={[94, 100]}
                                showDots={false}
                                fillArea
                              />
                            </div>
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
                  className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-800 shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-white">Ask a Question</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="e.g., When did the chest pain start?"
                      className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg 
                               text-white placeholder-slate-500 
                               focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={!currentQuestion.trim()}
                      aria-label="Send Question"
                      className="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => advancePhase('physical')}
                      className="text-sm text-slate-400 hover:text-white hover:underline flex items-center gap-1"
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
                  className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-800 shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-white">Perform Physical Exam</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Describe the maneuver you want to perform (e.g., "Auscultate heart", "Palpate
                    abdomen").
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handlePhysicalExam()}
                      placeholder="e.g., Auscultate lungs"
                      className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg 
                               text-white placeholder-slate-500 
                               focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => setShowRapportMeter(!showRapportMeter)}
                      className={`p-2 rounded-md transition-colors ${showRapportMeter ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Rapport Meter"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowExamPanel(!showExamPanel)}
                      className={`p-2 rounded-md transition-colors ${showExamPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Physical Exam Panel"
                    >
                      <StethoscopeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowOrderPanel(!showOrderPanel)}
                      className={`p-2 rounded-md transition-colors ${showOrderPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Order Panel"
                    >
                      <ClipboardList className="w-4 h-4" />
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
                  className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-800 shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-white">Order Diagnostics</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Order labs or imaging (e.g., "CBC", "Chest X-Ray").
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleOrderTest()}
                      placeholder="e.g., CBC, BMP, CXR"
                      className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg 
                               text-white placeholder-slate-500 
                               focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleOrderTest}
                      disabled={!currentQuestion.trim() || isLoading}
                      aria-label="Order Diagnostic Test"
                      className="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 
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
                      className="text-sm text-slate-400 hover:text-white hover:underline flex items-center gap-1"
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
                  className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-800 shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-white">Final Diagnosis</h3>
                  <input
                    type="text"
                    value={userDiagnosis}
                    onChange={(e) => setUserDiagnosis(e.target.value)}
                    placeholder="Enter your primary diagnosis..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg mb-4
                             text-white placeholder-slate-500 
                             focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent shadow-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={handleSubmitDiagnosis}
                    disabled={!userDiagnosis.trim() || isLoading}
                    className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 
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
                  className="bg-slate-900 rounded-xl p-4 md:p-6 border border-slate-800 shadow-md space-y-4"
                >
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-white">Treatment Plan</h3>
                    <p className="text-sm text-slate-400 mb-3">
                      Outline your management plan (medications, disposition, follow-up).
                    </p>
                    <textarea
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                      placeholder="e.g., Admit to telemetry, start Aspirin 325mg, Heparin drip..."
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg
                               text-white placeholder-slate-500 
                               focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-transparent shadow-sm min-h-[120px]"
                    />
                  </div>

                  {treatmentFeedback && (
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                        Treatment Feedback
                      </p>
                      <p className="text-sm text-slate-400">{treatmentFeedback.feedback}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {!treatmentFeedback && (
                      <button
                        onClick={handleTreatmentSubmit}
                        disabled={!treatmentPlan.trim() || isLoading}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 
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
                      className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 
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
              {/* Rapport Meter (when enabled) */}
              {showRapportMeter && enhancedOSCE.state.isSessionActive && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                  <RapportMeter
                    meter={enhancedOSCE.state.rapportMeter}
                    emotionalState={enhancedOSCE.state.emotionalState ?? undefined}
                    personality={enhancedOSCE.state.personality ?? undefined}
                    compact
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-950 rounded-xl p-4 md:p-6 border border-slate-800 shadow-md h-[600px] flex flex-col"
              >
                <h3 className="text-lg font-semibold mb-4 text-white">Encounter Log</h3>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {/* History Log */}
                  {session.questions.map((q, idx) => (
                    <div
                      key={`hist-${idx}`}
                      className="bg-slate-900 rounded-lg p-4 space-y-2 border border-slate-800"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <MessageSquare className="w-3 h-3" /> History
                      </div>
                      <p className="text-white font-semibold">Q: {q.questionText}</p>
                      <p className="text-slate-400 text-sm pl-4 border-l-2 border-slate-800 whitespace-pre-wrap">
                        A: {getTranslatedText(q.response)}
                      </p>
                    </div>
                  ))}

                  {/* Physical Exam Log */}
                  {physicalFindings.map((f, idx) => (
                    <div
                      key={`phys-${idx}`}
                      className="bg-slate-900 rounded-lg p-4 space-y-2 border border-slate-800"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <Stethoscope className="w-3 h-3" /> Physical Exam
                      </div>
                      <p className="text-white font-semibold">Exam: {f.maneuver}</p>
                      <p className="text-slate-400 text-sm pl-4 border-l-2 border-slate-700 whitespace-pre-wrap">
                        Finding: {f.finding}
                      </p>
                    </div>
                  ))}

                  {/* Diagnostic Log */}
                  {diagnosticResults.map((r, idx) => {
                    const trendData = generateTrendData(r.result);

                    return (
                      <div
                        key={`diag-${idx}`}
                        className="bg-slate-900 rounded-lg p-4 space-y-2 border border-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            <Activity className="w-3 h-3" /> Diagnostics
                          </div>
                          {trendData && !clinicalFidelity.rawLabValues && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                                Trend
                              </span>
                              <Sparkline
                                data={trendData}
                                width={60}
                                height={20}
                                color="#64748b"
                                strokeWidth={2}
                                showDots={false}
                              />
                            </div>
                          )}
                        </div>
                        <p className="text-white font-semibold">Order: {r.testName}</p>
                        <p className="text-white text-sm pl-4 border-l-2 border-slate-700 whitespace-pre-wrap font-mono">
                          Result: {r.result}
                        </p>
                        {/* Hide interpretation in Clinical Fidelity mode - makes user interpret raw values */}
                        {!clinicalFidelity.rawLabValues && r.interpretation && (
                          <p className="text-slate-400 text-xs pl-4 border-l-2 border-slate-700 italic">
                            Interpretation: {r.interpretation}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Diagnosis Log */}
                  {diagnosisFeedback && (
                    <div className="bg-slate-900 rounded-lg p-4 space-y-2 border border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <CheckCircle className="w-3 h-3" /> Diagnosis
                      </div>
                      <p className="text-white font-semibold">Dx: {userDiagnosis}</p>
                      <p className="text-slate-400 text-sm pl-4 border-l-2 border-slate-700 whitespace-pre-wrap">
                        {diagnosisFeedback.feedback}
                      </p>
                    </div>
                  )}

                  {/* Loading state with smooth skeleton */}
                  {isLoading && <ChatSkeleton messages={2} className="mt-4" />}

                  {/* Typing indicator (when AI is responding but not loading) */}
                  {isTyping && !isLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground italic p-4">
                      <div
                        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                      <span className="text-sm ml-2">Processing...</span>
                    </div>
                  )}

                  {/* Empty State */}
                  {session.questions.length === 0 &&
                    physicalFindings.length === 0 &&
                    diagnosticResults.length === 0 && (
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-center py-8 italic">
                        Start the encounter by asking about the patient's history.
                      </p>
                    )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Enhanced OSCE Panel Overlays */}
        <AnimatePresence>
          {showOrderPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowOrderPanel(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="max-w-2xl w-full max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <OrderPanel
                  isOpen={showOrderPanel}
                  onOrderPlace={(orders: PlacedOrder[]) => {
                    // Handle the newly placed orders
                    const existingIds = new Set(enhancedOSCE.state.orders.map((o) => o.id));
                    const newOrders = orders.filter((o) => !existingIds.has(o.id));
                    newOrders.forEach((order) => {
                      enhancedOSCE.placeOrder(order);
                      setDiagnosticResults((prev) => [
                        ...prev,
                        {
                          testName: order.itemName,
                          result: 'Pending...',
                          interpretation: '',
                        },
                      ]);
                    });
                  }}
                  placedOrders={enhancedOSCE.state.orders}
                  onClose={() => setShowOrderPanel(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showExamPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={() => setShowExamPanel(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="max-w-3xl w-full max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <ExamPanel
                  onExamPerformed={(finding) => {
                    enhancedOSCE.recordExamFinding(finding);
                    setPhysicalFindings((prev) => [
                      ...prev,
                      {
                        maneuver: finding.maneuverName,
                        finding: finding.finding,
                      },
                    ]);
                  }}
                  completedExams={enhancedOSCE.state.examFindings}
                  suggestedRegions={enhancedOSCE.getSuggestedExams(
                    currentCase?.chiefComplaint || ''
                  )}
                  caseData={
                    currentCase
                      ? {
                          physicalExamData: currentCase.physicalExamData,
                          correctDiagnosis: currentCase.correctDiagnosis,
                        }
                      : undefined
                  }
                  onClose={() => setShowExamPanel(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Results View - Virtual Preceptor Report Card
  if (viewState === 'results' && currentCase && preceptorFeedback) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-slate-400" />
              <div>
                <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
                <p className="text-sm text-slate-400">Performance Evaluation</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800"
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
            className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-md"
          >
            <h3 className="text-xl font-semibold mb-4 text-white">Clinical Competencies</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  label: 'History-Taking',
                  score: preceptorFeedback?.clinicalReasoning?.historyTaking ?? 0,
                  icon: MessageSquare,
                },
                {
                  label: 'Physical Exam',
                  score: preceptorFeedback?.clinicalReasoning?.physicalExam ?? 0,
                  icon: Stethoscope,
                },
                {
                  label: 'Diagnosis',
                  score: preceptorFeedback?.clinicalReasoning?.diagnosis ?? 0,
                  icon: FileText,
                },
                {
                  label: 'Management',
                  score: preceptorFeedback?.clinicalReasoning?.management ?? 0,
                  icon: Pill,
                },
              ].map((item, idx) => {
                const percentage = ((item.score ?? 0) / 10) * 100;
                const Icon = item.icon;
                return (
                  <div key={idx} className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-slate-400" />
                        <span className="font-semibold text-white">{item.label}</span>
                      </div>
                      <span className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
                        {item.score}/10
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }}
                        className={`h-full rounded-full ${
                          percentage >= 80
                            ? 'bg-data-pass'
                            : percentage >= 60
                              ? 'bg-data-provisional'
                              : 'bg-data-fail'
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
            className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-md"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
                <User className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Your Preceptor's Feedback</h3>
                <p className="text-sm text-slate-400">Clinical reasoning assessment</p>
              </div>
            </div>
            <div className="bg-slate-950 rounded-lg p-5 border border-slate-800">
              <p className="text-white leading-relaxed italic">"{preceptorFeedback.feedback}"</p>
            </div>
          </motion.div>

          {/* Strengths & Areas for Improvement */}
          <div className="grid md:grid-cols-2 gap-6">
            {preceptorFeedback.strengths.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-900 rounded-xl p-6 border border-slate-800"
              >
                <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-slate-500" /> Strengths
                </h3>
                <ul className="space-y-2">
                  {preceptorFeedback.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-slate-500 mt-0.5">•</span>
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
                className="bg-slate-900 rounded-xl p-6 border border-slate-800"
              >
                <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-slate-500" /> Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {preceptorFeedback.areasForImprovement.map((area, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-slate-500 mt-0.5">•</span>
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
              className="bg-slate-900 rounded-xl p-6 border border-slate-800"
            >
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-slate-500" /> Missed Critical Cues
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                The patient mentioned these important details that you didn't follow up on:
              </p>
              <ul className="space-y-2">
                {preceptorFeedback.missedCriticalCues.map((cue, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-slate-300 bg-slate-950 rounded p-3 border border-slate-800"
                  >
                    <span className="text-slate-500 font-bold mt-0.5">!</span>
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
              className="bg-slate-900 rounded-xl p-6 border border-slate-800"
            >
              <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-500" /> Differential Diagnoses to Consider
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                Based on the presentation, you should have considered:
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {preceptorFeedback.differentialDiagnosis.map((dx, idx) => (
                  <div key={idx} className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                    <span className="font-semibold text-slate-300">{dx}</span>
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
            className="bg-action-blue-50 dark:bg-action-blue-900/20 rounded-xl p-6 border border-action-blue-200 dark:border-action-blue-800"
          >
            <h3 className="text-lg font-semibold mb-3 text-action-blue-700 dark:text-action-blue-300">
              Correct Diagnosis
            </h3>
            <p className="text-2xl font-bold text-action-blue-900 dark:text-action-blue-100 mb-3">
              {currentCase.correctDiagnosis}
            </p>
            {currentCase.teachingPoints && currentCase.teachingPoints.length > 0 && (
              <div className="mt-4 pt-4 border-t border-action-blue-200 dark:border-action-blue-800">
                <p className="text-sm font-semibold text-action-blue-700 dark:text-action-blue-300 mb-2">
                  Teaching Points:
                </p>
                <ul className="space-y-1">
                  {currentCase.teachingPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-action-blue-900 dark:text-action-blue-100 flex items-start gap-2"
                    >
                      <Award className="w-4 h-4 text-action-blue-500 flex-shrink-0 mt-0.5" />
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
              className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-md"
            >
              <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                <FileText className="w-5 h-5" /> Additional Notes
              </h3>
              <div className="prose dark:prose-invert max-w-none text-slate-400 whitespace-pre-wrap text-sm">
                {aar}
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <motion.button
              onClick={handleNewCase}
              className="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-semibold text-white
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
                className="px-8 py-4 bg-slate-900 hover:bg-slate-800 rounded-xl font-semibold
                         text-white transition-colors border border-slate-800"
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
        <div className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-slate-400" />
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE - Results</h1>
                <p className="text-sm text-slate-400">Performance Summary</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800"
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
                ? 'bg-sage-50 dark:bg-sage-900/20 border-sage-200 dark:border-sage-800'
                : 'bg-muted-amber-50 dark:bg-muted-amber-900/20 border-muted-amber-200 dark:border-muted-amber-800'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {isCorrectDiagnosis ? (
                <CheckCircle className="w-8 h-8 text-data-pass" />
              ) : (
                <XCircle className="w-8 h-8 text-data-provisional" />
              )}
              <div>
                <h2
                  className={`text-2xl font-bold ${
                    isCorrectDiagnosis
                      ? 'text-sage-700 dark:text-sage-300'
                      : 'text-muted-amber-700 dark:text-muted-amber-300'
                  }`}
                >
                  {isCorrectDiagnosis ? 'Correct Diagnosis!' : 'Diagnosis Review'}
                </h2>
                <p className="text-[#364154] dark:text-[#cbd5e1]">
                  Your diagnosis: {userDiagnosis}
                </p>
              </div>
            </div>

            {diagnosisFeedback?.feedback && (
              <div className="mb-4 p-4 bg-card/50 rounded-lg border border-border/50">
                <p className="text-sm font-semibold mb-1 opacity-75">AI Feedback:</p>
                <p className="text-muted-foreground italic">"{diagnosisFeedback.feedback}"</p>
              </div>
            )}

            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
              <p className="text-sm text-slate-400 mb-1">Correct Diagnosis:</p>
              <p className="text-lg font-semibold text-white">{currentCase.correctDiagnosis}</p>
            </div>
          </motion.div>

          {/* Score Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900 rounded-xl p-6 border border-slate-800 text-center shadow-sm"
            >
              <Award className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-1">Overall Score</p>
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
              <CheckCircle className="w-8 h-8 text-data-pass mx-auto mb-2" />
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
              <Clock className="w-8 h-8 text-action-blue-500 dark:text-action-blue-400 mx-auto mb-2" />
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
              className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-sm"
            >
              <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                <FileText className="w-5 h-5" /> After-Action Report
              </h3>
              <div className="prose dark:prose-invert max-w-none text-slate-400 whitespace-pre-wrap">
                {aar}
              </div>
            </motion.div>
          )}

          {/* Ideal Workup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-sm"
          >
            <h3 className="text-xl font-semibold mb-4 text-white">Ideal Workup</h3>
            <ul className="space-y-2">
              {currentCase.idealWorkup.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-400">
                  <CheckCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
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
