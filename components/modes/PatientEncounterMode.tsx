import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Phone,
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
import {
  OrderPanel,
  ExamPanel,
  RapportMeter,
  RapportIndicator,
  ScoreReport,
  OSCELiveSession,
} from './osce';
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
  gradeOSCESession,
  translateToSpanish,
  type SpanishMode,
  generatePatientCase,
} from '@/services/domain';
import type { OsceGradeResult } from '@/services/domain';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';
import { toast } from '@/lib/toast';
import {
  chatWithPatientSimulator,
  evaluateDiagnosis,
  performPhysicalExam,
  orderDiagnosticTest,
  evaluateTreatmentPlan,
  generateAfterActionReport,
  buildDebriefPrompt,
  cleanDebriefJsonResponse,
  normalizeDebriefFeedback,
  getFallbackDebriefFeedback,
  type PreceptorFeedback,
} from '@/services/ai';
import { streamGeminiText } from '@/lib/utils/streamingClient';
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
  AlertTriangle,
} from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';
import { ChatSkeleton } from '@/components/loading/SkeletonLoader';
import { useVitalsEngine } from '@/hooks/useVitalsEngine';
import { formatPatientAge, formatPatientAgeShort, parsePatientAge } from '@/lib/utils/ageFormatter';

import { useClinicalFidelitySettings } from '@/hooks/useClinicalFidelitySettings';

// Module 1 & Integration Imports
import { useSystemIntegration } from '@/contexts/SystemIntegrationContext';
import { useRealtimeSOAP } from '@/hooks/useRealtimeSOAP';
import { useTimingAnalytics } from '@/hooks/useTimingAnalytics';
import { SOAPDraftPanel } from '@/components/osce/SOAPDraftPanel';
import { TimingMetricsPanel } from '@/components/osce/TimingMetricsPanel';
import { ContextBanner } from '@/components/shared/ContextBanner';
import { PatientAVEngine } from '@/services/av/patientAVEngine';
import type { PatientAVStateMachine, AVState } from '@/types/patient-av-state-machine';

// Gemini API Key (from environment or config)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface PatientEncounterModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'loading_encounter' | 'active' | 'results';
type EncounterPhase = 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';

const PatientEncounterMode: React.FC<PatientEncounterModeProps> = ({ onExit }) => {
  const { getToken, userId } = useAuth();
  const persistKey = userId ? `user_${userId}` : 'anonymous';
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
  const [loadingStatusIndex, setLoadingStatusIndex] = useState(0);
  const [typingStatusIndex, setTypingStatusIndex] = useState(0);
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
  const [streamedDebriefText, setStreamedDebriefText] = useState('');
  const [isStreamingDebrief, setIsStreamingDebrief] = useState(false);

  // Clinical Fidelity Mode (shared hook with Settings modal)
  const { settings: clinicalFidelity } = useClinicalFidelitySettings();
  const isFidelityModeActive = clinicalFidelity.rawLabValues || clinicalFidelity.emrInterface;

  // Enhanced OSCE Panel States
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showExamPanel, setShowExamPanel] = useState(false);
  const [showRapportMeter, setShowRapportMeter] = useState(true);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [enhancedScoreReport, setEnhancedScoreReport] = useState<OSCEScoreReport | null>(null);
  const [gradeResult, setGradeResult] = useState<OsceGradeResult | null>(null);
  const [gradeResultLoading, setGradeResultLoading] = useState(false);
  const [emrTab, setEmrTab] = useState<'hpi' | 'pmh' | 'meds' | 'labs'>('hpi');

  // Initialize Enhanced OSCE Hook
  const enhancedOSCE = useEnhancedOSCE({
    enablePersonality: true,
    enableRapport: true,
    enableScoring: true,
    persistKey,
  });

  // NEW: Integration hooks
  const { integration } = useSystemIntegration();

  // NEW: Real-time SOAP generation
  const {
    draftNote,
    addTranscript,
    addVitals: addSOAPVitals,
    finalize: finalizeSOAP,
  } = useRealtimeSOAP({
    sessionId: session?.id || null,
    geminiApiKey: GEMINI_API_KEY,
    enabled: viewState === 'active',
  });

  // NEW: Timing analytics
  const {
    startMetric,
    endMetric,
    recordNode,
    recordMilestone,
    endSession: endTimingSession,
    currentMetrics,
  } = useTimingAnalytics({
    sessionId: session?.id || null,
    caseId: currentCase?.id || null,
    enabled: viewState === 'active',
  });

  // Refs for cleanup: diagnosis timing metric id; debrief stream abort
  const diagnosisMetricIdRef = useRef<string | null>(null);
  const debriefAbortRef = useRef<AbortController | null>(null);

  // Abort debrief stream on unmount so we do not update state after unmount
  useEffect(() => {
    return () => {
      debriefAbortRef.current?.abort();
      debriefAbortRef.current = null;
    };
  }, []);

  // NEW: State machine for Module 1
  const [avEngine, setAVEngine] = useState<PatientAVEngine | null>(null);
  const [currentAVState, setCurrentAVState] = useState<AVState | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);

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

  // Rotate typing status message during AI response (latency masking)
  const TYPING_STATUS_MESSAGES = [
    'Reading vitals…',
    'Reviewing your question…',
    'Patient is responding…',
    'Checking chart…',
  ];
  useEffect(() => {
    if (!isTyping) return;
    const interval = setInterval(() => {
      setTypingStatusIndex((i) => (i + 1) % TYPING_STATUS_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isTyping]);

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
        toast.error('Could not load patient personality. Proceeding with default.');
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

  // Rotate status message while encounter is loading (latency masking)
  const LOADING_STATUS_MESSAGES = [
    'Reviewing patient chart…',
    'Nurse is paging the patient…',
    'Pulling up vitals…',
    'Room is being prepared…',
  ];
  useEffect(() => {
    if (viewState !== 'loading_encounter') return;
    const interval = setInterval(() => {
      setLoadingStatusIndex((i) => (i + 1) % LOADING_STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [viewState]);

  // NEW: Initialize state machine when case loads
  useEffect(() => {
    const caseWithStateMachine = currentCase as any; // Type extension for new field
    if (!caseWithStateMachine?.stateMachine) return;

    let unsubscribe: (() => void) | undefined;

    try {
      const stateMachine = caseWithStateMachine.stateMachine as unknown as PatientAVStateMachine;
      const engine = new PatientAVEngine(stateMachine);

      // Subscribe to state transitions — capture unsubscribe for cleanup
      unsubscribe = engine.on((event) => {
        if (event.type === 'TRANSITION_COMPLETED') {
          const newState = engine.getCurrentAVState();
          setCurrentAVState(newState);

          // Emit to integration service for coordination
          integration.emit({
            type: 'MODULE_ENTERED',
            timestamp: new Date().toISOString(),
            sourceModule: 'osce',
            sessionId: session?.id || 'unknown',
            payload: {
              stateTransition: event.payload,
              newState: newState.id,
            },
          });

          // Show notification for critical state changes
          if (newState.id.includes('critical') || newState.id.includes('severe')) {
            toast.warning(`Patient state changed: ${newState.name}`);
          }
        }
      });

      setAVEngine(engine);
      setCurrentAVState(engine.getCurrentAVState());
    } catch (error) {
      console.error('Failed to initialize state machine:', error);
    }

    // Cleanup: unsubscribe stale engine listener when case/session changes
    return () => {
      unsubscribe?.();
    };
  }, [currentCase, integration, session?.id]);

  // NEW: Update state machine when vitals change (debounced to avoid trigger cascade)
  useEffect(() => {
    if (!avEngine) return;

    const timer = setTimeout(() => {
      const vitalsForEngine = {
        hr: currentVitals.hr,
        bp: `${currentVitals.sbp}/${currentVitals.dbp}`,
        temp: 98.6, // Default
        rr: currentVitals.rr,
        o2: currentVitals.o2,
      };

      avEngine.updateVitals(vitalsForEngine);

      // Also update SOAP generator
      addSOAPVitals(vitalsForEngine);

      // Check for critical vitals
      if (currentVitals.o2 < 88 || currentVitals.hr > 150 || currentVitals.hr < 50) {
        integration.emit({
          type: 'VITALS_CRITICAL' as any,
          timestamp: new Date().toISOString(),
          sourceModule: 'osce',
          sessionId: session?.id || 'unknown',
          payload: {
            vitals: vitalsForEngine,
            trigger:
              currentVitals.o2 < 88
                ? 'hypoxia_severe'
                : currentVitals.hr > 150
                  ? 'tachycardia_severe'
                  : 'bradycardia',
          },
        });
      }
    }, 250); // Debounce 250ms — prevents trigger evaluation on every vitals tick

    return () => clearTimeout(timer);
  }, [currentVitals, avEngine, addSOAPVitals, integration, session?.id]);

  // HUD mode: medical-monitor style UI when Live OSCE session is active
  useEffect(() => {
    const root = document.documentElement;
    if (showLiveSession) {
      root.classList.add('live-osce-hud');
    }
    return () => {
      root.classList.remove('live-osce-hud');
    };
  }, [showLiveSession]);

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
    setViewState('loading_encounter');

    try {
      const token = await getToken();

      const newCase = await getRandomEncounterCase(token);

      if (!newCase) {
        console.error('Failed to load case');
        setLoadError(
          'Unable to load patient case. Please ensure the backend server is running (npm run dev:all) and try again.'
        );
        setViewState('landing');
        return;
      }

      setCurrentCase(newCase);
      enhancedOSCE.initializeSession(newCase as any);

      let sessionId: string | undefined;
      try {
        const osceSession = await startOSCESession(newCase.id, token);
        if (osceSession) {
          sessionId = osceSession.id;
        }
      } catch (e) {
        console.error('Failed to start OSCE session', e);
        toast.error('Session could not be recorded. Your encounter will still run locally.');
      }

      setSession({
        id: sessionId,
        caseId: newCase.id,
        questions: [],
        startTime: Date.now(),
      });
      setViewState('active');
    } catch (err) {
      console.error('Failed to start encounter', err);
      setLoadError('Unable to load patient case. Please check your connection and try again.');
      setViewState('landing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !currentCase || !session) return;

    setIsTyping(true);
    detectInterventionIntent(currentQuestion);

    // NEW: Track conversation node for echo path
    const parentNodeId =
      session.questions.length > 0 ? `node-${session.questions.length - 1}` : undefined;
    const nodeId = recordNode('question', currentQuestion, parentNodeId, 0.8); // 0.8 = relevance

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

      // NEW: Forward to SOAP generator
      await addTranscript('student', currentQuestion);
      await addTranscript('patient', response);

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
      toast.error('Could not get patient response. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  // NEW: Start diagnosis timing when entering diagnosis phase; store id for endMetric on submit
  useEffect(() => {
    if (phase === 'diagnosis' && session?.id) {
      const metricId = startMetric(
        'Time to diagnosis',
        'diagnosis',
        'critical',
        120 // Target: 2 minutes
      );
      diagnosisMetricIdRef.current = metricId ?? null;
      return () => {
        diagnosisMetricIdRef.current = null;
      };
    }
    return undefined;
  }, [phase, session?.id, startMetric]);

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

      // NEW: Emit DIAGNOSIS_MADE event for coordination
      const isCorrect = feedback.isCorrect;
      const timeElapsed = Date.now() - new Date(session.startTime).getTime();

      integration.emit({
        type: 'DIAGNOSIS_MADE',
        timestamp: new Date().toISOString(),
        sourceModule: 'osce',
        sessionId: session.id!,
        payload: {
          diagnosis: userDiagnosis,
          correctDiagnosis: currentCase.correctDiagnosis,
          isCorrect,
          confidence: feedback.score / 100,
          timeToAction: timeElapsed / 1000,
        },
      });

      // NEW: Record milestone
      recordMilestone(
        isCorrect ? 'Correct Diagnosis' : 'Incorrect Diagnosis',
        120, // 2 min target
        isCorrect
      );

      // End diagnosis timing metric so analytics has duration
      const metricId = diagnosisMetricIdRef.current;
      if (metricId) {
        endMetric(metricId);
        diagnosisMetricIdRef.current = null;
      }

      // Move to Treatment Phase
      setPhase('treatment');
    } catch (error) {
      console.error('Error submitting diagnosis:', error);
      toast.error('Could not evaluate diagnosis. Please try again.');
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
    setGradeResult(null);
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
      toast.error('Could not perform exam. Please try again.');
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
      toast.error('Could not order or retrieve diagnostic result. Please try again.');
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

    setIsLoading(true);
    setPreceptorFeedback(null);
    setGradeResult(null);
    setGradeResultLoading(true);
    setStreamedDebriefText('');
    setIsStreamingDebrief(true);
    setViewState('results');

    const token = await getToken();
    const authToken = token ?? '';
    const sessionId = session?.id;
    if (!sessionId) {
      setIsLoading(false);
      setGradeResultLoading(false);
      setIsStreamingDebrief(false);
      toast.error('Session is missing. Please try again.');
      return;
    }

    try {
      // Complete session first so grade API can run (requires status === 'completed')
      const completed = await completeOSCESession(
        sessionId,
        userDiagnosis,
        treatmentPlan || '',
        authToken
      );
      if (!completed) toast.error('Session could not be saved. Your results may not be recorded.');
      const rubricResult = await gradeOSCESession(sessionId, authToken);
      if (rubricResult) setGradeResult(rubricResult);
    } catch (e) {
      console.error('Error completing or grading OSCE session:', e);
      toast.error('Could not save or grade session. Showing debrief only.');
    } finally {
      setGradeResultLoading(false);
    }

    try {
      const prompt = buildDebriefPrompt(sessionSummary, currentCase);
      debriefAbortRef.current = new AbortController();
      const fullText = await streamGeminiText(prompt, {
        modelName: 'gemini-2.5-pro',
        temperature: 0.7,
        token: token ?? undefined,
        onChunk: (chunk) => setStreamedDebriefText((prev) => prev + chunk),
        signal: debriefAbortRef.current.signal,
      });
      debriefAbortRef.current = null;

      const cleaned = cleanDebriefJsonResponse(fullText);
      const parsed = JSON.parse(cleaned);
      const feedback = normalizeDebriefFeedback(parsed);
      setPreceptorFeedback(feedback);
      setStreamedDebriefText('');
      setIsStreamingDebrief(false);

      const osceReport = enhancedOSCE.generateScoreReport({
        diagnosisSubmitted: userDiagnosis,
        treatmentPlan: treatmentPlan,
        differentials: differentialDiagnoses,
      });
      setEnhancedScoreReport(osceReport);

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
    } catch (error) {
      debriefAbortRef.current = null;
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error streaming Virtual Preceptor debrief:', error);
      toast.error('Debrief could not be loaded. Showing a summary instead.');
      const fallback = getFallbackDebriefFeedback(sessionSummary, currentCase);
      setPreceptorFeedback(fallback);
      setStreamedDebriefText('');
      setIsStreamingDebrief(false);

      setEnhancedScoreReport(
        enhancedOSCE.generateScoreReport({
          diagnosisSubmitted: userDiagnosis,
          treatmentPlan: treatmentPlan,
          differentials: differentialDiagnoses,
        })
      );
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
          score: fallback.score,
        },
        currentCase
      ).catch((err) => {
        console.error('After-action report failed', err);
        toast.error('Summary report could not be generated.');
        return '';
      });
      setAar(report);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryGrading = useCallback(async () => {
    if (!session?.id) return;
    setGradeResultLoading(true);
    try {
      const token = await getToken();
      const authToken = token ?? '';
      const rubricResult = await gradeOSCESession(session.id, authToken);
      if (rubricResult) setGradeResult(rubricResult);
      else toast.error('Grading still unavailable. Try again later.');
    } catch (e) {
      console.error('Retry grading failed', e);
      toast.error('Could not load rubric. Try again later.');
    } finally {
      setGradeResultLoading(false);
    }
  }, [session?.id, getToken]);

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
        return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 dark:border-[var(--color-accent)]/40';
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
      <div className="min-h-dvh bg-data-neutral text-data-neutral transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-data-neutral flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-data-neutral" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-data-neutral">Interactive Patient Interviews</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                aria-label="Exit Encounter"
                className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors border border-data-neutral"
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
              <h2 className="text-4xl font-bold text-data-neutral">Virtual Patient Encounter</h2>
              <p className="text-xl text-data-neutral max-w-2xl mx-auto">
                Practice clinical reasoning in a realistic patient interview simulation. Gather
                history, perform exams, order tests, and make your diagnosis.
              </p>
            </div>

            {/* What You'll Practice */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-data-neutral rounded-2xl p-6 border border-data-neutral">
                <h3 className="text-lg font-semibold text-data-neutral mb-4 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-data-neutral" />
                  Clinical Skills Practiced
                </h3>
                <ul className="space-y-2 text-sm text-data-neutral">
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

              <div className="bg-data-neutral rounded-2xl p-6 border border-data-neutral">
                <h3 className="text-lg font-semibold text-data-neutral mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-data-neutral" />
                  How You're Evaluated
                </h3>
                <ul className="space-y-2 text-sm text-data-neutral">
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-data-neutral flex-shrink-0" />
                    Efficiency: Minimal unnecessary questions
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-data-neutral flex-shrink-0" />
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
            <div className="bg-data-neutral rounded-2xl p-8 border border-data-neutral shadow-lg space-y-6">
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
                    <div className="w-10 h-10 rounded-xl bg-data-neutral flex items-center justify-center flex-shrink-0 border border-data-neutral">
                      <step.Icon className="w-5 h-5 text-data-neutral" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">
                        <span className="text-data-neutral mr-2">{step.num}.</span>
                        {step.title}
                      </h4>
                      <p className="text-data-neutral text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro Tips */}
              <div className="bg-data-neutral rounded-xl p-6 border border-data-neutral">
                <p className="text-sm text-data-neutral font-semibold mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Clinical Pearls
                </p>
                <ul className="text-sm text-data-neutral space-y-2">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" />
                    <span>
                      Start with open-ended questions (onset, location, duration, character,
                      aggravating/alleviating factors)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" />
                    <span>Review of systems should be targeted based on your differential</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" />
                    <span>
                      Order tests to rule in or rule out specific diagnoses, not as a shotgun
                      approach
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-data-neutral mt-0.5 flex-shrink-0" />
                    <span>
                      Think about pre-test probability before ordering expensive or invasive tests
                    </span>
                  </li>
                </ul>
              </div>

              {/* Estimated Time */}
              <div className="flex items-center justify-center gap-2 text-sm text-data-neutral">
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

  if (viewState === 'loading_encounter') {
    return (
      <div className="min-h-screen bg-data-neutral text-data-neutral">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-data-neutral flex items-center justify-center shadow-sm border border-data-neutral">
                <MessageSquare className="w-6 h-6 text-data-neutral" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-data-neutral">Virtual OSCE</h1>
                <p className="text-sm text-data-neutral">Preparing your encounter…</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                aria-label="Exit"
                className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors border border-data-neutral"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-data-neutral rounded-xl border border-data-neutral overflow-hidden animate-pulse">
                <div className="p-4 md:p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-data-neutral flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-data-neutral rounded" />
                    <div className="h-4 w-48 bg-data-neutral rounded" />
                  </div>
                </div>
                <div className="px-4 pb-4 md:px-6 md:pb-6 space-y-3">
                  <div className="flex items-center gap-2 text-data-neutral">
                    <span className="w-2 h-2 rounded-full bg-data-neutral animate-pulse" />
                    <span className="text-sm font-medium">
                      {LOADING_STATUS_MESSAGES[loadingStatusIndex]}
                    </span>
                  </div>
                  <div className="h-24 bg-data-neutral rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-20 bg-data-neutral rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-data-neutral rounded-xl p-4 md:p-6 border border-data-neutral">
                <div className="h-4 w-24 bg-data-neutral rounded mb-4" />
                <div className="flex gap-2">
                  <div className="flex-1 h-12 bg-data-neutral rounded-lg" />
                  <div className="w-12 h-12 bg-data-neutral rounded-lg" />
                </div>
              </div>
            </div>
            <div className="bg-data-neutral rounded-xl border border-data-neutral p-4 md:p-6 min-h-[320px] flex flex-col items-center justify-center">
              <p className="text-data-neutral text-sm text-center max-w-xs">
                Conversation will appear here once the patient is ready.
              </p>
              <div className="flex items-center gap-2 mt-4 text-data-neutral">
                <div
                  className="w-2 h-2 bg-data-neutral rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-data-neutral rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-data-neutral rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
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
      <div className="min-h-screen bg-data-neutral text-data-neutral">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-data-neutral flex items-center justify-center shadow-sm border border-data-neutral">
                <MessageSquare className="w-6 h-6 text-data-neutral" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-data-neutral">Virtual OSCE</h1>
                <p className="text-sm text-data-neutral">
                  Phase: <span className="font-semibold text-data-neutral uppercase">{phase}</span>
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
                          ? 'bg-data-neutral border-data-neutral text-white'
                          : isCurrent
                            ? 'bg-data-neutral border-data-neutral text-white'
                            : 'bg-transparent border-data-neutral text-data-neutral'
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
              <div className="w-2 h-2 rounded-full bg-data-neutral animate-pulse" />
              <span className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                {phase}
              </span>
              {session.id && (
                <button
                  onClick={() => setShowLiveSession(true)}
                  className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors"
                  title="Live voice patient"
                  aria-label="Live voice patient"
                >
                  <Phone className="w-4 h-4 text-data-neutral" />
                </button>
              )}
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
                {session.id && (
                  <button
                    onClick={() => setShowLiveSession(true)}
                    className={`p-2 rounded-md transition-colors ${showLiveSession ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                    title="Live voice patient"
                    aria-label="Open live voice patient"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Clinical Fidelity Badge */}
              {isFidelityModeActive && (
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <Shield className="w-3.5 h-3.5 text-data-neutral" />
                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                    Fidelity
                  </span>
                </div>
              )}
              <button
                onClick={toggleLanguageMode}
                aria-label="Toggle Language Mode"
                className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors flex items-center gap-2 border border-data-neutral"
                title="Toggle Language (English / Spanish / Side-by-Side)"
              >
                <Globe className="w-4 h-4 text-data-neutral" />
                <span className="text-xs font-medium text-data-neutral uppercase w-8 text-center">
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
                <Clock className="w-4 h-4 text-data-neutral" />
                <span className="font-mono text-white">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  aria-label="Exit Encounter"
                  className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors border border-data-neutral"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Voice Patient overlay */}
        {showLiveSession && session.id && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4">
            <div className="relative max-w-md w-full">
              <OSCELiveSession
                sessionId={session.id}
                patientContext={
                  currentCase
                    ? {
                        patientName: currentCase.patientName,
                        age: typeof currentCase.age === 'number' ? currentCase.age : undefined,
                        sex: currentCase.sex,
                        chiefComplaint: currentCase.chiefComplaint,
                      }
                    : undefined
                }
                onClose={() => setShowLiveSession(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Phase progression stepper */}
          <nav
            className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6 py-3 px-4 rounded-xl bg-data-neutral/80 border border-data-neutral"
            aria-label="Encounter phase"
          >
            {(
              [
                { id: 'history' as const, label: 'History' },
                { id: 'physical' as const, label: 'Physical Exam' },
                { id: 'diagnostic' as const, label: 'Diagnostics' },
                { id: 'diagnosis' as const, label: 'Diagnosis' },
                { id: 'treatment' as const, label: 'Treatment' },
              ] as const
            ).map((step, idx) => {
              const isCurrent = phase === step.id;
              const order = ['history', 'physical', 'diagnostic', 'diagnosis', 'treatment'].indexOf(
                phase
              );
              const stepOrder = [
                'history',
                'physical',
                'diagnostic',
                'diagnosis',
                'treatment',
              ].indexOf(step.id);
              const isPast = stepOrder < order;
              const isFuture = stepOrder > order;
              return (
                <React.Fragment key={step.id}>
                  {idx > 0 && (
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 ${
                        isPast
                          ? 'text-data-neutral'
                          : isCurrent
                            ? 'text-[var(--color-accent)]'
                            : 'text-data-neutral'
                      }`}
                      aria-hidden
                    />
                  )}
                  <span
                    className={`text-sm font-medium transition-colors ${
                      isCurrent ? 'text-white' : isPast ? 'text-data-neutral' : 'text-data-neutral'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {step.label}
                  </span>
                </React.Fragment>
              );
            })}
            <span className="ml-auto text-xs text-data-neutral">
              {phase === 'history' && 'Next: gather history and move to physical exam'}
              {phase === 'physical' && 'Next: perform focused physical exam'}
              {phase === 'diagnostic' && 'Next: order labs/imaging as needed'}
              {phase === 'diagnosis' && 'Next: submit your diagnosis'}
              {phase === 'treatment' && 'Next: submit treatment plan'}
            </span>
          </nav>

          {/* NEW: Three-column layout for sidebar integration */}
          <div className="grid md:grid-cols-12 gap-6">
            {/* Left Column: Patient Info & Inputs (8 cols) */}
            <div className="md:col-span-8 space-y-4">
              {/* Patient Card (Collapsible) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-data-neutral rounded-xl border border-data-neutral shadow-md overflow-hidden"
              >
                <div
                  className="p-4 md:p-6 flex items-start gap-4 cursor-pointer hover:bg-data-neutral/50 transition-colors"
                  onClick={() => setIsPatientInfoExpanded(!isPatientInfoExpanded)}
                >
                  <div className="w-12 h-12 rounded-xl bg-data-neutral flex items-center justify-center border border-data-neutral flex-shrink-0">
                    <User className="w-6 h-6 text-data-neutral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-data-neutral truncate">
                        {currentCase.patientName}
                      </h2>
                      <button className="text-data-neutral p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        {isPatientInfoExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-data-neutral truncate text-sm">
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
                      {clinicalFidelity.emrInterface ? (
                        <>
                          <div
                            className="flex border-b border-data-neutral"
                            role="tablist"
                            aria-label="EMR sections"
                          >
                            {(['hpi', 'pmh', 'meds', 'labs'] as const).map((tab) => (
                              <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={emrTab === tab ? 'true' : 'false'}
                                onClick={() => setEmrTab(tab)}
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                  emrTab === tab
                                    ? 'border-[var(--color-accent)] text-white'
                                    : 'border-transparent text-data-neutral hover:text-data-neutral'
                                }`}
                              >
                                {tab === 'hpi'
                                  ? 'HPI'
                                  : tab === 'pmh'
                                    ? 'PMH'
                                    : tab === 'meds'
                                      ? 'Meds'
                                      : 'Labs'}
                              </button>
                            ))}
                          </div>
                          <div
                            className="bg-data-neutral rounded-lg p-4 border border-data-neutral min-h-[120px]"
                            role="tabpanel"
                          >
                            {emrTab === 'hpi' && (
                              <>
                                <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                                  Chief Complaint
                                </p>
                                <p className="text-lg font-semibold text-white whitespace-pre-wrap mb-4">
                                  {currentCase?.chiefComplaint
                                    ? getTranslatedText(currentCase.chiefComplaint)
                                    : '—'}
                                </p>
                                <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                                  History of Present Illness
                                </p>
                                <p className="text-sm text-data-neutral whitespace-pre-wrap">
                                  {currentCase?.historyData &&
                                  typeof currentCase.historyData === 'object'
                                    ? (currentCase.historyData['HPI'] ??
                                      currentCase.historyData['hpi'] ??
                                      currentCase.historyData['presentIllness'] ??
                                      (Object.entries(currentCase.historyData)
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join('\n\n') ||
                                        'No HPI documented.'))
                                    : 'No HPI documented.'}
                                </p>
                              </>
                            )}
                            {emrTab === 'pmh' && (
                              <p className="text-sm text-data-neutral whitespace-pre-wrap">
                                {currentCase?.historyData &&
                                typeof currentCase.historyData === 'object'
                                  ? (currentCase.historyData['pastMedicalHistory'] ??
                                    currentCase.historyData['PMH'] ??
                                    currentCase.historyData['pmh'] ??
                                    currentCase.historyData['Past Medical History'] ??
                                    (Object.entries(currentCase.historyData)
                                      .filter(([k]) => /pmh|past|medical|history/i.test(k))
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join('\n\n') ||
                                      'No PMH documented.'))
                                  : 'No PMH documented.'}
                              </p>
                            )}
                            {emrTab === 'meds' && (
                              <p className="text-sm text-data-neutral whitespace-pre-wrap">
                                {currentCase?.historyData &&
                                typeof currentCase.historyData === 'object'
                                  ? (currentCase.historyData['medications'] ??
                                    currentCase.historyData['meds'] ??
                                    currentCase.historyData['Meds'] ??
                                    currentCase.historyData['Medications'] ??
                                    (Object.entries(currentCase.historyData)
                                      .filter(([k]) => /med|drug|rx/i.test(k))
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join('\n\n') ||
                                      'No medications documented.'))
                                  : 'No medications documented.'}
                              </p>
                            )}
                            {emrTab === 'labs' && (
                              <div className="text-sm text-data-neutral space-y-1">
                                {currentCase?.labData &&
                                typeof currentCase.labData === 'object' &&
                                Object.keys(currentCase.labData).length > 0
                                  ? Object.entries(currentCase.labData).map(([k, v]) => (
                                      <div
                                        key={k}
                                        className="flex justify-between gap-4 py-1 border-b border-data-neutral last:border-0"
                                      >
                                        <span className="font-medium text-data-neutral">{k}</span>
                                        <span className="font-mono">{String(v)}</span>
                                      </div>
                                    ))
                                  : 'No labs documented.'}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                          <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                            Chief Complaint
                          </p>
                          <p className="text-lg font-semibold text-white whitespace-pre-wrap">
                            {currentCase?.chiefComplaint ? (
                              getTranslatedText(currentCase.chiefComplaint)
                            ) : (
                              <span className="inline-block w-32 h-4 bg-data-neutral rounded animate-pulse"></span>
                            )}
                          </p>
                        </div>
                      )}

                      <div className="rounded-lg p-4 border border-data-neutral space-y-3 bg-data-neutral">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                            EMR Monitor
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-data-neutral flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-data-neutral animate-pulse" />
                              Live
                            </span>
                            <button
                              type="button"
                              onClick={() => enhancedOSCE.timeTravel()}
                              className="text-[10px] font-bold uppercase tracking-widest text-data-neutral hover:text-data-neutral border border-data-neutral px-1 py-0.5 rounded"
                            >
                              Sim 24h
                            </button>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {/* Blood Pressure Card */}
                          <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              Blood Pressure
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.sbp ?? 0)}/
                                {Math.round(currentVitals.dbp ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">mmHg</span>
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
                          <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              Heart Rate
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.hr ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">bpm</span>
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
                          <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              Respiratory Rate
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.rr ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">/min</span>
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
                          <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                            <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">
                              O₂ Saturation
                            </span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-3xl font-mono font-bold text-white tabular-nums">
                                {Math.round(currentVitals.o2 ?? 0)}
                              </span>
                              <span className="text-sm font-mono text-data-neutral">%</span>
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
                  className="bg-data-neutral rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Ask a Question</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="e.g., When did the chest pain start?"
                      className="flex-1 px-4 py-3 bg-data-neutral border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={!currentQuestion.trim()}
                      aria-label="Send Question"
                      className="px-4 py-3 bg-data-neutral hover:bg-data-neutral disabled:bg-data-neutral 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => advancePhase('physical')}
                      className="text-sm text-data-neutral hover:text-data-neutral hover:underline flex items-center gap-1"
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
                  className="bg-data-neutral rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">
                    Perform Physical Exam
                  </h3>
                  <p className="text-sm text-data-neutral mb-3">
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
                      className="flex-1 px-4 py-3 bg-data-neutral border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm"
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
                  className="bg-data-neutral rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Order Diagnostics</h3>
                  <p className="text-sm text-data-neutral mb-3">
                    Order labs or imaging (e.g., "CBC", "Chest X-Ray").
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleOrderTest()}
                      placeholder="e.g., CBC, BMP, CXR"
                      className="flex-1 px-4 py-3 bg-data-neutral border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleOrderTest}
                      disabled={!currentQuestion.trim() || isLoading}
                      aria-label="Order Diagnostic Test"
                      className="px-4 py-3 bg-data-neutral hover:bg-data-neutral disabled:bg-data-neutral 
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
                      className="text-sm text-data-neutral hover:text-data-neutral hover:underline flex items-center gap-1"
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
                  className="bg-data-neutral rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Final Diagnosis</h3>
                  <input
                    type="text"
                    value={userDiagnosis}
                    onChange={(e) => setUserDiagnosis(e.target.value)}
                    placeholder="Enter your primary diagnosis..."
                    className="w-full px-4 py-3 bg-data-neutral border border-data-neutral rounded-lg mb-4
                             text-data-neutral placeholder-data-neutral 
                             focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={handleSubmitDiagnosis}
                    disabled={!userDiagnosis.trim() || isLoading}
                    className="w-full bg-data-neutral hover:bg-data-neutral disabled:bg-data-neutral
                             disabled:cursor-not-allowed min-h-[44px] py-3 rounded-lg font-semibold text-white
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
                  className="bg-data-neutral rounded-xl p-4 md:p-6 border border-data-neutral shadow-md space-y-4"
                >
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-data-neutral">Treatment Plan</h3>
                    <p className="text-sm text-data-neutral mb-3">
                      Outline your management plan (medications, disposition, follow-up).
                    </p>
                    <textarea
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                      placeholder="e.g., Admit to telemetry, start Aspirin 325mg, Heparin drip..."
                      className="w-full px-4 py-3 bg-data-neutral border border-data-neutral rounded-lg
                               text-white placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm min-h-[120px]"
                    />
                  </div>

                  {treatmentFeedback && (
                    <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                      <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                        Treatment Feedback
                      </p>
                      <p className="text-sm text-data-neutral">{treatmentFeedback.feedback}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {!treatmentFeedback && (
                      <button
                        onClick={handleTreatmentSubmit}
                        disabled={!treatmentPlan.trim() || isLoading}
                        className="flex-1 bg-data-neutral hover:bg-data-neutral disabled:bg-data-neutral
                                 disabled:cursor-not-allowed min-h-[44px] py-3 rounded-lg font-semibold text-white
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
                      className="flex-1 bg-data-neutral hover:bg-data-neutral disabled:bg-data-neutral 
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
                className="bg-data-neutral rounded-xl p-4 md:p-6 border border-data-neutral shadow-md h-[600px] flex flex-col min-w-[250px] break-words"
              >
                <h3 className="text-lg font-semibold mb-4 text-data-neutral">Encounter Log</h3>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {/* History Log */}
                  {session.questions.map((q, idx) => (
                    <div
                      key={`hist-${idx}`}
                      className="bg-data-neutral rounded-lg p-4 space-y-2 border border-data-neutral"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                        <MessageSquare className="w-3 h-3" /> History
                      </div>
                      <p className="text-white font-semibold">Q: {q.questionText}</p>
                      <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                        A: {getTranslatedText(q.response)}
                      </p>
                    </div>
                  ))}

                  {/* Physical Exam Log */}
                  {physicalFindings.map((f, idx) => (
                    <div
                      key={`phys-${idx}`}
                      className="bg-data-neutral rounded-lg p-4 space-y-2 border border-data-neutral"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                        <Stethoscope className="w-3 h-3" /> Physical Exam
                      </div>
                      <p className="text-white font-semibold">Exam: {f.maneuver}</p>
                      <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
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
                        className="bg-data-neutral rounded-lg p-4 space-y-2 border border-data-neutral"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                            <Activity className="w-3 h-3" /> Diagnostics
                          </div>
                          {trendData && !clinicalFidelity.rawLabValues && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-data-neutral uppercase font-bold tracking-widest">
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
                        <p className="text-white text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap font-mono">
                          Result: {r.result}
                        </p>
                        {/* Hide interpretation in Clinical Fidelity mode - makes user interpret raw values */}
                        {!clinicalFidelity.rawLabValues && r.interpretation && (
                          <p className="text-data-neutral text-xs pl-4 border-l-2 border-data-neutral italic">
                            Interpretation: {r.interpretation}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Diagnosis Log */}
                  {diagnosisFeedback && (
                    <div className="bg-data-neutral rounded-lg p-4 space-y-2 border border-data-neutral">
                      <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                        <CheckCircle className="w-3 h-3" /> Diagnosis
                      </div>
                      <p className="text-white font-semibold">Dx: {userDiagnosis}</p>
                      <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                        {diagnosisFeedback.feedback}
                      </p>
                    </div>
                  )}

                  {/* Loading state with smooth skeleton */}
                  {isLoading && <ChatSkeleton messages={2} className="mt-4" />}

                  {/* Typing indicator with rotating status (latency masking so user knows system is thinking) */}
                  {isTyping && !isLoading && (
                    <div className="flex items-center gap-2 text-data-neutral italic p-4 rounded-lg bg-data-neutral/50 border border-data-neutral/50">
                      <div
                        className="w-2 h-2 bg-data-neutral rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-data-neutral rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-data-neutral rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                      <span className="text-sm ml-2">
                        {TYPING_STATUS_MESSAGES[typingStatusIndex % TYPING_STATUS_MESSAGES.length]}
                      </span>
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
              className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md z-50 flex items-center justify-center p-4"
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
              className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md z-50 flex items-center justify-center p-4"
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

  // Results View - Virtual Preceptor Report Card (or streaming evaluation)
  if (viewState === 'results' && currentCase) {
    const showStreaming = isStreamingDebrief || streamedDebriefText.length > 0;

    if (showStreaming && !preceptorFeedback) {
      return (
        <div className="min-h-screen bg-data-neutral text-data-neutral">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-data-neutral" />
                <div>
                  <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
                  <p className="text-sm text-data-neutral">AI is evaluating your encounter...</p>
                </div>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors border border-data-neutral"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="bg-data-neutral rounded-xl p-6 border border-data-neutral">
              <p className="text-data-neutral text-sm mb-2">Streaming evaluation (token-by-token):</p>
              <pre className="text-white font-mono text-sm whitespace-pre-wrap break-words min-h-[120px]">
                {streamedDebriefText || (
                  <span className="text-data-neutral">Waiting for first tokens...</span>
                )}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    if (preceptorFeedback) {
      return (
        <div className="min-h-screen bg-data-neutral text-data-neutral">
          {/* Header */}
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-data-neutral" />
                <div>
                  <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
                  <p className="text-sm text-data-neutral">Performance Evaluation</p>
                </div>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors border border-data-neutral"
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
              className="bg-data-neutral rounded-xl p-6 border border-data-neutral shadow-md"
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
                    <div key={idx} className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-data-neutral" />
                          <span className="font-semibold text-white">{item.label}</span>
                        </div>
                        <span className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
                          {item.score}/10
                        </span>
                      </div>
                      <div className="w-full bg-data-neutral rounded-full h-2 overflow-hidden">
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
              className="bg-data-neutral rounded-xl p-6 border border-data-neutral shadow-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-data-neutral border border-data-neutral flex items-center justify-center">
                  <User className="w-6 h-6 text-data-neutral" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Your Preceptor's Feedback</h3>
                  <p className="text-sm text-data-neutral">Clinical reasoning assessment</p>
                </div>
              </div>
              <div className="bg-data-neutral rounded-lg p-5 border border-data-neutral">
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
                  className="bg-data-neutral rounded-xl p-6 border border-data-neutral"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-data-neutral" /> Strengths
                  </h3>
                  <ul className="space-y-2">
                    {preceptorFeedback.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral">
                        <span className="text-data-neutral mt-0.5">•</span>
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
                  className="bg-data-neutral rounded-xl p-6 border border-data-neutral"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-data-neutral" /> Areas for Improvement
                  </h3>
                  <ul className="space-y-2">
                    {preceptorFeedback.areasForImprovement.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-data-neutral">
                        <span className="text-data-neutral mt-0.5">•</span>
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
                className="bg-data-neutral rounded-xl p-6 border border-data-neutral"
              >
                <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-data-neutral" /> Missed Critical Cues
                </h3>
                <p className="text-sm text-data-neutral mb-3">
                  The patient mentioned these important details that you didn't follow up on:
                </p>
                <ul className="space-y-2">
                  {preceptorFeedback.missedCriticalCues.map((cue, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-data-neutral bg-data-neutral rounded p-3 border border-data-neutral"
                    >
                      <span className="text-data-neutral font-bold mt-0.5">!</span>
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Dangerous or inappropriate actions */}
            {preceptorFeedback.dangerousActions?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.51 }}
                className="bg-data-neutral rounded-xl p-6 border border-data-fail/50"
              >
                <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-data-fail" /> Dangerous or Inappropriate
                  Actions
                </h3>
                <p className="text-sm text-data-neutral mb-3">
                  The preceptor identified the following safety or appropriateness concerns:
                </p>
                <ul className="space-y-2">
                  {preceptorFeedback.dangerousActions.map((action, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-data-neutral bg-data-neutral rounded p-3 border border-data-neutral"
                    >
                      <AlertTriangle className="w-4 h-4 text-data-fail flex-shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Rubric Checklist (from grade API) – always show section: loading, unavailable, or checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52 }}
              className="bg-data-neutral rounded-xl p-6 border border-data-neutral"
            >
              <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-data-neutral" /> Rubric Checklist
              </h3>
              {gradeResultLoading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Grading in progress">
                  <div className="h-4 bg-data-neutral rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-data-neutral rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-data-neutral rounded animate-pulse w-5/6" />
                  <p className="text-sm text-data-neutral mt-2">Grading…</p>
                </div>
              ) : gradeResult &&
                (gradeResult.checklist?.length > 0 || gradeResult.redFlagsMissed?.length > 0) ? (
                <>
                  {gradeResult.checklist?.length > 0 && (
                    <ul className="space-y-2 mb-4">
                      {gradeResult.checklist.map((item, idx) => (
                        <li
                          key={idx}
                          className={`flex items-start gap-2 text-sm rounded p-3 border ${
                            item.status === 'PASS'
                              ? 'bg-data-pass/30 border-data-pass text-data-neutral'
                              : 'bg-data-neutral border-data-neutral text-data-neutral'
                          }`}
                        >
                          {item.status === 'PASS' ? (
                            <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-data-fail flex-shrink-0 mt-0.5" />
                          )}
                          <span className="font-medium">{item.item}</span>
                          {item.feedback && (
                            <span className="text-data-neutral text-xs block mt-1 pl-6">
                              {item.feedback}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {gradeResult.redFlagsMissed?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-data-fail mb-2">Red flags missed:</p>
                      <ul className="space-y-1">
                        {gradeResult.redFlagsMissed.map((flag, idx) => (
                          <li key={idx} className="text-sm text-data-neutral flex items-center gap-2">
                            <XCircle className="w-3.5 h-3.5 text-data-fail flex-shrink-0" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4">
                  <p className="font-medium text-[var(--color-text-primary)]">Rubric unavailable for this case</p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Grading could not be completed. You can retry below or use the Preceptor feedback.
                  </p>
                  {session?.id && (
                    <button
                      type="button"
                      onClick={handleRetryGrading}
                      disabled={gradeResultLoading}
                      className="mt-3 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                    >
                      {gradeResultLoading ? 'Grading…' : 'Retry grading'}
                    </button>
                  )}
                </div>
              )}
            </motion.div>

            {/* Bedside Manner (from Ghost Listener / soft skills analysis) */}
            {gradeResult?.softSkillsReport && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.53 }}
                className="bg-data-neutral rounded-xl p-6 border border-data-neutral"
              >
                <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                  <Heart className="w-5 h-5 text-data-neutral" aria-hidden />
                  Bedside Manner
                </h3>
                <div className="grid gap-3">
                  {(['empathy', 'professionalism', 'pacing'] as const).map((key) => {
                    const item = gradeResult.softSkillsReport![key];
                    if (!item) return null;
                    const pct = (item.score / 5) * 100;
                    return (
                      <div
                        key={key}
                        className="bg-data-neutral rounded-lg p-3 border border-data-neutral"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-data-neutral capitalize">
                            {key}
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              pct >= 80
                                ? 'text-data-pass'
                                : pct >= 60
                                  ? 'text-data-provisional'
                                  : 'text-data-fail'
                            }`}
                          >
                            {item.score}/5
                          </span>
                        </div>
                        <p className="text-xs text-data-neutral">{item.feedback}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Differential Diagnoses to Consider */}
            {preceptorFeedback.differentialDiagnosis.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-data-neutral rounded-xl p-6 border border-data-neutral"
              >
                <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                  <Activity className="w-5 h-5 text-data-neutral" /> Differential Diagnoses to Consider
                </h3>
                <p className="text-sm text-data-neutral mb-3">
                  Based on the presentation, you should have considered:
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {preceptorFeedback.differentialDiagnosis.map((dx, idx) => (
                    <div key={idx} className="bg-data-neutral rounded-lg p-3 border border-data-neutral">
                      <span className="font-semibold text-data-neutral">{dx}</span>
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
              className="bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/20 rounded-xl p-6 border border-[var(--color-accent)]/30 dark:border-[var(--color-accent)]/40"
            >
              <h3 className="text-lg font-semibold mb-3 text-[var(--color-accent)]">
                Correct Diagnosis
              </h3>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                {currentCase.correctDiagnosis}
              </p>
              {currentCase.teachingPoints && currentCase.teachingPoints.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-accent)]/30 dark:border-[var(--color-accent)]/40">
                  <p className="text-sm font-semibold text-[var(--color-accent)] mb-2">
                    Teaching Points:
                  </p>
                  <ul className="space-y-1">
                    {currentCase.teachingPoints.map((point, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-[var(--color-text-primary)] flex items-start gap-2"
                      >
                        <Award className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
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
                className="bg-data-neutral rounded-xl p-6 border border-data-neutral shadow-md"
              >
                <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Additional Notes
                </h3>
                <div className="prose dark:prose-invert max-w-none text-data-neutral whitespace-pre-wrap text-sm">
                  {aar}
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <motion.button
                onClick={handleNewCase}
                className="flex-1 bg-data-neutral hover:bg-data-neutral py-4 rounded-xl font-semibold text-white
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
                  className="px-8 py-4 bg-data-neutral hover:bg-data-neutral rounded-xl font-semibold
                         text-white transition-colors border border-data-neutral"
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
  }

  // Legacy results view (fallback if no preceptor feedback)
  if (viewState === 'results' && currentCase && session && session.score) {
    const { score } = session;
    const isCorrectDiagnosis = diagnosisFeedback?.isCorrect ?? false;

    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-data-neutral" />
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE - Results</h1>
                <p className="text-sm text-data-neutral">Performance Summary</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-data-neutral hover:bg-data-neutral transition-colors border border-data-neutral"
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

            <div className="bg-data-neutral rounded-lg p-4 border border-data-neutral">
              <p className="text-sm text-data-neutral mb-1">Correct Diagnosis:</p>
              <p className="text-lg font-semibold text-white">{currentCase.correctDiagnosis}</p>
            </div>
          </motion.div>

          {/* Score Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-data-neutral rounded-xl p-6 border border-data-neutral text-center shadow-sm"
            >
              <Award className="w-8 h-8 text-data-neutral mx-auto mb-2" />
              <p className="text-sm text-data-neutral mb-1">Overall Score</p>
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
              <Clock className="w-8 h-8 text-[var(--color-accent)] mx-auto mb-2" />
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
              className="bg-data-neutral rounded-xl p-6 border border-data-neutral shadow-sm"
            >
              <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                <FileText className="w-5 h-5" /> After-Action Report
              </h3>
              <div className="prose dark:prose-invert max-w-none text-data-neutral whitespace-pre-wrap">
                {aar}
              </div>
            </motion.div>
          )}

          {/* Ideal Workup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-data-neutral rounded-xl p-6 border border-data-neutral shadow-sm"
          >
            <h3 className="text-xl font-semibold mb-4 text-white">Ideal Workup</h3>
            <ul className="space-y-2">
              {currentCase.idealWorkup.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-data-neutral">
                  <CheckCircle className="w-5 h-5 text-data-neutral flex-shrink-0 mt-0.5" />
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
