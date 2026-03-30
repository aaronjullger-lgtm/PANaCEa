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
import type { PlacedOrder, ExamFinding, OSCEScoreReport, BodyRegion, OrderCategory } from '@/types/osce-enhanced';

// Import OSCE Enhancement Components
import {
  OrderPanel,
  ExamPanel,
  RapportMeter,
  RapportIndicator,
  ScoreReport,
  OSCELiveSession,
  OSCEResultsView,
  OSCEHistoryPanel,
  EncounterTimer,
} from './osce';
import { useEnhancedOSCE } from '@/hooks/useEnhancedOSCE';
import { useOSCEMetrics } from '@/hooks/useOSCEMetrics';
import {
  getRandomEncounterCase,
  calculateEncounterScore,
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
import type { OsceGradeResult, OSCETelemetryPayload } from '@/services/domain';
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
import { ChatSkeleton } from '@/components/loading';
import { useVitalsEngine } from '@/hooks/useVitalsEngine';
import { formatPatientAge, formatPatientAgeShort, parsePatientAge } from '@/lib/utils/ageFormatter';

import { useClinicalFidelitySettings } from '@/hooks/useClinicalFidelitySettings';
import {
  getCulturalCompetencyPrompt,
  getResourceLimitedPrompt,
  getAIDifficultyPrompt,
  OSCE_QUICK_START_PRESETS,
  type OSCEQuickStartPreset,
} from '@/config/osce-settings';
import { generateOSCEMarkdown, downloadOSCEReport } from '@/lib/utils/osceExport';
import { updateConditionSchedule } from '@/lib/osce-spaced-repetition';

// Module 1 & Integration Imports
import { useSystemIntegration } from '@/contexts/SystemIntegrationContext';
import { useRealtimeSOAP } from '@/hooks/useRealtimeSOAP';
import { useTimingAnalytics } from '@/hooks/useTimingAnalytics';
import { SOAPDraftPanel } from '@/components/osce/SOAPDraftPanel';
import { TimingMetricsPanel } from '@/components/osce/TimingMetricsPanel';
import { ContextBanner } from '@/components/shared/ContextBanner';
import { PatientAVEngine } from '@/services/av/patientAVEngine';
import type { PatientAVStateMachine, AVState } from '@/types/patient-av-state-machine';

import { syncManager } from '@/lib/services/sync/syncManager';

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

  // OSCE scenario modifiers: cultural competency + resource-limited + difficulty
  const [enableCulturalCompetency, setEnableCulturalCompetency] = useState(false);
  const [enableResourceLimited, setEnableResourceLimited] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<'cooperative' | 'difficult' | 'very_difficult'>('cooperative');

  // Build scenario modifiers string for AI patient simulator
  const scenarioModifiers = useMemo(() => {
    let modifiers = '';
    if (aiDifficulty !== 'cooperative') {
      modifiers += '\n' + getAIDifficultyPrompt(aiDifficulty);
    }
    if (enableCulturalCompetency) {
      modifiers += getCulturalCompetencyPrompt();
    }
    if (enableResourceLimited) {
      modifiers += getResourceLimitedPrompt();
    }
    return modifiers || undefined;
  }, [aiDifficulty, enableCulturalCompetency, enableResourceLimited]);

  // Enhanced OSCE Panel States
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showExamPanel, setShowExamPanel] = useState(false);
  const [showRapportMeter, setShowRapportMeter] = useState(true);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [encounterStartTime, setEncounterStartTime] = useState<number>(Date.now());
  const [enhancedScoreReport, setEnhancedScoreReport] = useState<OSCEScoreReport | null>(null);
  const [gradeResult, setGradeResult] = useState<OsceGradeResult | null>(null);
  const [gradeResultLoading, setGradeResultLoading] = useState(false);
  const [emrTab, setEmrTab] = useState<'hpi' | 'pmh' | 'meds' | 'vitals' | 'labs'>('hpi');

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

  // OSCE Metrics: tracks clinical decisions, speech, rapport for implicit rating + FSRS telemetry
  const osceMetrics = useOSCEMetrics();

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

  // Fetch OSCE stats for landing page sparkline
  const [osceStats, setOsceStats] = useState<{
    totalEncounters: number;
    passRate: number | null;
    averageScore: number | null;
    trend: number[];
  } | null>(null);

  useEffect(() => {
    if (viewState !== 'landing') return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/osce/stats', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data ?? json;
        if (d && typeof d.totalEncounters === 'number') {
          setOsceStats({
            totalEncounters: d.totalEncounters,
            passRate: d.passRate,
            averageScore: d.averageScore,
            trend: (d.trend || []).map((t: any) => t.score as number),
          });
        }
      } catch {
        // silent — stats are optional
      }
    })();
  }, [viewState, getToken]);

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
        toast.error('Could not load patient personality. Proceeding with default.', { id: 'patient-persona-error' });
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
      toast.error('Voice interaction could not be initialized. Continuing without voice.', { id: 'voice-init-error' });
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
        toast.error('Unable to load patient case. Please try again.');
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

      const startTs = Date.now();
      setSession({
        id: sessionId,
        caseId: newCase.id,
        questions: [],
        startTime: startTs,
      });
      setEncounterStartTime(startTs);
      setViewState('active');
    } catch (err) {
      console.error('Failed to start encounter', err);
      setLoadError('Unable to load patient case. Please check your connection and try again.');
      toast.error('Unable to start encounter. Please check your connection and try again.');
      setViewState('landing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !currentCase || !session) return;

    setIsTyping(true);
    detectInterventionIntent(currentQuestion);

    // Track question in scoring engine + OSCE metrics
    osceMetrics.logAction('communication', currentQuestion);
    osceMetrics.logSpeech(currentQuestion);

    // Auto-detect rapport behaviors from question text
    const qLower = currentQuestion.toLowerCase();
    if (/\b(sorry|understand|must be|that sounds|i can see|how are you feeling|concerned)\b/.test(qLower)) {
      osceMetrics.logRapportBehavior('empathyStatements');
    }
    if (/\b(let me explain|this means|the reason|what this test|i'd like to tell you)\b/.test(qLower)) {
      osceMetrics.logRapportBehavior('educationStatements');
    }
    if (/^(tell me|describe|how|what|can you explain|walk me through)\b/.test(qLower)) {
      osceMetrics.logRapportBehavior('openEndedQuestions');
    } else if (/\?$/.test(currentQuestion.trim())) {
      osceMetrics.logRapportBehavior('closedEndedQuestions');
    }
    if (/\b(my name is|i'm (dr|doctor|your (pa|provider|nurse)))\b/.test(qLower)) {
      osceMetrics.logRapportBehavior('introducedSelf', true);
    }
    if (/\b(what do you think|your perspective|your concerns|what worries you|what matters to you)\b/.test(qLower)) {
      osceMetrics.logRapportBehavior('askedForPerspective', true);
    }

    if (enhancedOSCE.state.isSessionActive) {
      enhancedOSCE.processMessage(currentQuestion);
    }

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
        patientPersona,
        scenarioModifiers
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

      // Persist chat to server (full messages array for Cloudflare API)
      if (session.id) {
        const token = await getToken();
        const messages = [
          ...session.questions.flatMap((q) => [
            { role: 'user' as const, content: q.questionText },
            { role: 'assistant' as const, content: q.response },
          ]),
          { role: 'user' as const, content: currentQuestion },
          { role: 'assistant' as const, content: response },
        ];
        const saved = await saveOSCEChat(session.id, messages, token);
        if (!saved) {
          toast.error('Chat could not be saved to the server. Your progress may not be recorded.');
        }
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

      // Track diagnosis in OSCE metrics
      osceMetrics.logAction('diagnosis', userDiagnosis, { isCorrect: feedback.isCorrect });

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

  // Apply a quick-start preset and immediately start encounter
  const applyPreset = (preset: OSCEQuickStartPreset) => {
    setAiDifficulty(preset.difficulty);
    setEnableCulturalCompetency(preset.enableCulturalCompetency);
    setEnableResourceLimited(preset.enableResourceLimited);
    // Start encounter with preset applied
    handleStartEncounter();
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
    osceMetrics.reset();
  };

  const handlePhysicalExam = async () => {
    if (!examAction.trim() || !currentCase) return;
    setIsLoading(true);
    try {
      const result = await performPhysicalExam(examAction, currentCase);
      // Track exam in OSCE metrics
      osceMetrics.logAction('exam', examAction);
      // Track exam finding in scoring engine
      if (enhancedOSCE.state.isSessionActive) {
        const finding: ExamFinding = {
          maneuverId: `exam-${examAction.toLowerCase().replace(/\s+/g, '-')}`,
          maneuverName: examAction,
          region: 'chest_anterior', // default region
          finding: result,
          isAbnormal: false,
        };
        enhancedOSCE.recordExamFinding(finding);
      }
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
    // Track order in OSCE metrics + scoring engine
    osceMetrics.logAction('order', diagnosticOrder);
    if (enhancedOSCE.state.isSessionActive) {
      const category: OrderCategory = diagnosticOrder.toLowerCase().includes('ct') || diagnosticOrder.toLowerCase().includes('mri') || diagnosticOrder.toLowerCase().includes('xray') ? 'imaging' : 'labs';
      const order: PlacedOrder = {
        id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itemId: `custom-${diagnosticOrder.toLowerCase().replace(/\s+/g, '-')}`,
        itemName: diagnosticOrder,
        category,
        orderedAt: Date.now(),
        status: 'pending',
        isStat: false,
        alerts: [],
      };
      enhancedOSCE.placeOrder(order);
    }
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
      // Track treatment in OSCE metrics
      osceMetrics.logAction('treatment', treatmentPlan);

      // Complete session in backend
      if (session?.id) {
        const token = await getToken();
        const saved = await completeOSCESession(session.id, userDiagnosis, treatmentPlan, token);
        if (!saved) {
          toast.error('Session could not be saved. Your results may not be recorded.');
        }
      }
    } catch (error) {
      console.error('Treatment error:', error);
      toast.error('Could not evaluate treatment plan or save session. Please try again.');
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
      // Calculate OSCE metrics telemetry to persist with session completion
      const metrics = osceMetrics.calculateMetrics();
      const telemetryPayload: OSCETelemetryPayload = {
        totalTimeMs: metrics.totalTime,
        clinicalConfidenceIndex: metrics.clinicalConfidenceIndex,
        redFlagsMissed: metrics.redFlagsMissed,
        unnecessaryOrders: metrics.unnecessaryOrders,
        implicitRating: metrics.implicitRating
          ? { rating: metrics.implicitRating.continuousRating, confidence: metrics.implicitRating.confidence }
          : undefined,
        efficiencyScore: metrics.efficiencyScore,
        speechMetrics: metrics.speechMetrics as unknown as Record<string, unknown>,
        diagnosticEfficiency: metrics.diagnosticEfficiency as unknown as Record<string, unknown>,
        rapportMetrics: metrics.rapportMetrics as unknown as Record<string, unknown>,
        actionCount: metrics.actions.length,
      };

      // Complete session first so grade API can run (requires status === 'completed')
      const completed = await completeOSCESession(
        sessionId,
        userDiagnosis,
        treatmentPlan || '',
        authToken,
        telemetryPayload
      );
      if (!completed) toast.error('Session could not be saved. Your results may not be recorded.');
      const rubricResult = await gradeOSCESession(
        sessionId,
        authToken,
        differentialDiagnoses.length > 0 ? differentialDiagnoses : undefined
      );
      if (rubricResult) {
        setGradeResult(rubricResult);

        // Sync OSCE performance to FSRS scheduling via attempt endpoint
        // Derive correctness from rubric score (pass threshold: 60%)
        const osceScore = rubricResult.overallScore ?? rubricResult.score ?? 0;
        const maxScore = rubricResult.maxScore ?? 100;
        const scorePct = maxScore > 0 ? osceScore / maxScore : 0;
        const isPass = scorePct >= 0.6;

        if (currentCase?.conditionId || currentCase?.condition) {
          syncManager.queueAnswer({
            questionId: sessionId,
            selectedAnswer: 0,
            isCorrect: isPass,
            timeSpentMs: Date.now() - (session?.startTime || Date.now()),
            system: currentCase?.system ?? undefined,
            conditionId: currentCase?.conditionId ?? undefined,
            isMainSession: false,
            rating: isPass ? 3 : 1, // FSRS: Good(3) if pass, Again(1) if fail
          });

          // Update OSCE condition-level spaced repetition schedule
          try {
            updateConditionSchedule(
              currentCase.conditionId || currentCase.id,
              currentCase.correctDiagnosis || currentCase.condition || 'Unknown',
              currentCase.system || 'general',
              osceScore
            );
          } catch {
            // Non-critical — don't block results
          }
        }
      }
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

  // Phase ordering for validation
  const PHASE_ORDER: EncounterPhase[] = ['history', 'physical', 'diagnostic', 'diagnosis', 'treatment'];

  const canAdvancePhase = (from: EncounterPhase, to: EncounterPhase): { allowed: boolean; reason?: string } => {
    const fromIdx = PHASE_ORDER.indexOf(from);
    const toIdx = PHASE_ORDER.indexOf(to);

    // Can always go back
    if (toIdx <= fromIdx) return { allowed: true };

    // Validate minimum requirements before advancing
    if (from === 'history' && (session?.questions.length ?? 0) < 2) {
      return { allowed: false, reason: 'Ask at least 2 history questions before moving on.' };
    }
    // Skipping more than one phase forward requires confirmation
    if (toIdx - fromIdx > 1) {
      return { allowed: true, reason: `Skipping ${toIdx - fromIdx - 1} phase(s). Some scoring categories may be affected.` };
    }
    return { allowed: true };
  };

  const advancePhase = (target?: EncounterPhase) => {
    const nextPhase = target || (() => {
      if (phase === 'history') return 'physical' as EncounterPhase;
      if (phase === 'physical') return 'diagnostic' as EncounterPhase;
      if (phase === 'diagnostic') return 'diagnosis' as EncounterPhase;
      return null;
    })();

    if (!nextPhase) {
      if (phase === 'diagnosis') handleSubmitDiagnosis();
      return;
    }

    const validation = canAdvancePhase(phase, nextPhase);
    if (!validation.allowed) {
      toast.error(validation.reason || 'Cannot advance yet.');
      return;
    }
    if (validation.reason) {
      // Show warning but still allow
      toast.info(validation.reason);
    }

    setPhase(nextPhase);
    recordMilestone(`phase_${nextPhase}`);
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
        return 'text-[var(--color-data-neutral)] bg-[var(--color-data-neutral)]/10 border-[var(--color-data-neutral)]/20 dark:text-[var(--color-data-neutral)] dark:bg-[var(--color-data-neutral)]/20 dark:border-[var(--color-data-neutral)]/40';
      case 'helpful':
        return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 dark:border-[var(--color-accent)]/40';
      case 'unnecessary':
        return 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]/10 border-[var(--color-data-provisional)]/20 dark:text-[var(--color-data-provisional)] dark:bg-[var(--color-data-provisional)]/20 dark:border-[var(--color-data-provisional)]/40';
      case 'redundant':
        return 'text-muted-foreground bg-muted border-[var(--color-border)]';
      default:
        return 'text-muted-foreground bg-muted border-[var(--color-border)]';
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
      <div className="min-h-dvh bg-data-neutral-bg text-data-neutral transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-sm">
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
                className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors border border-data-neutral"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12">
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="space-y-8"
          >
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold text-data-neutral">Virtual Patient Encounter</h2>
              <p className="text-xl text-data-neutral max-w-2xl mx-auto">
                Practice clinical reasoning in a realistic patient interview simulation. Gather
                history, perform exams, order tests, and make your diagnosis.
              </p>

              {/* Performance Mini-Dashboard */}
              {osceStats && osceStats.totalEncounters > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-6 mt-4 p-3 rounded-xl bg-data-neutral-bg border border-data-neutral max-w-md mx-auto"
                >
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{osceStats.totalEncounters}</p>
                    <p className="text-[10px] text-data-neutral uppercase tracking-wider">Encounters</p>
                  </div>
                  {osceStats.averageScore !== null && (
                    <div className="text-center">
                      <p className={`text-lg font-bold ${osceStats.averageScore >= 70 ? 'text-data-pass' : 'text-data-provisional'}`}>
                        {osceStats.averageScore}%
                      </p>
                      <p className="text-[10px] text-data-neutral uppercase tracking-wider">Avg Score</p>
                    </div>
                  )}
                  {osceStats.passRate !== null && (
                    <div className="text-center">
                      <p className={`text-lg font-bold ${osceStats.passRate >= 70 ? 'text-data-pass' : 'text-data-provisional'}`}>
                        {osceStats.passRate}%
                      </p>
                      <p className="text-[10px] text-data-neutral uppercase tracking-wider">Pass Rate</p>
                    </div>
                  )}
                  {osceStats.trend.length >= 2 && (
                    <div className="flex flex-col items-center">
                      <Sparkline
                        data={osceStats.trend}
                        width={80}
                        height={28}
                        color={osceStats.trend[osceStats.trend.length - 1] >= 70 ? 'var(--color-data-pass)' : 'var(--color-data-provisional)'}
                        strokeWidth={1.5}
                        min={0}
                        max={100}
                      />
                      <p className="text-[10px] text-data-neutral uppercase tracking-wider">Trend</p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* What You'll Practice */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral">
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

              <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral">
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
            <div className="bg-data-neutral-bg rounded-2xl p-8 border border-data-neutral shadow-lg space-y-6">
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
                    <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center flex-shrink-0 border border-data-neutral">
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
              <div className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
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

            {/* Scenario Settings */}
            <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral shadow-md space-y-5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-data-neutral" />
                Encounter Settings
              </h3>

              {/* AI Difficulty */}
              <div>
                <label className="text-sm font-medium text-data-neutral block mb-2">Patient Difficulty</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cooperative', 'difficult', 'very_difficult'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setAiDifficulty(level)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        aiDifficulty === level
                          ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                          : 'bg-data-neutral-bg text-data-neutral border-data-neutral hover:border-[var(--color-accent)]/50'
                      }`}
                    >
                      {level === 'cooperative' ? 'Cooperative' : level === 'difficult' ? 'Difficult' : 'Very Difficult'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-data-neutral mt-1">
                  {aiDifficulty === 'cooperative' && 'Patient provides clear, direct answers.'}
                  {aiDifficulty === 'difficult' && 'Patient gives vague answers and needs redirection.'}
                  {aiDifficulty === 'very_difficult' && 'Patient is hostile, in pain, or cognitively impaired.'}
                </p>
              </div>

              {/* Toggle Row */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Cultural Competency */}
                <button
                  onClick={() => setEnableCulturalCompetency(prev => !prev)}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                    enableCulturalCompetency
                      ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                      : 'bg-data-neutral-bg border-data-neutral hover:border-[var(--color-accent)]/30'
                  }`}
                >
                  <Globe className={`w-5 h-5 mt-0.5 flex-shrink-0 ${enableCulturalCompetency ? 'text-[var(--color-accent)]' : 'text-data-neutral'}`} />
                  <div>
                    <span className={`text-sm font-medium block ${enableCulturalCompetency ? 'text-[var(--color-accent)]' : 'text-white'}`}>
                      Cultural Competency
                    </span>
                    <span className="text-xs text-data-neutral">
                      Patient has cultural beliefs affecting care decisions
                    </span>
                  </div>
                </button>

                {/* Resource-Limited */}
                <button
                  onClick={() => setEnableResourceLimited(prev => !prev)}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                    enableResourceLimited
                      ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                      : 'bg-data-neutral-bg border-data-neutral hover:border-[var(--color-accent)]/30'
                  }`}
                >
                  <FlaskConical className={`w-5 h-5 mt-0.5 flex-shrink-0 ${enableResourceLimited ? 'text-[var(--color-accent)]' : 'text-data-neutral'}`} />
                  <div>
                    <span className={`text-sm font-medium block ${enableResourceLimited ? 'text-[var(--color-accent)]' : 'text-white'}`}>
                      Resource-Limited
                    </span>
                    <span className="text-xs text-data-neutral">
                      Rural clinic — no CT, MRI, or advanced imaging
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick-Start Presets */}
            <div className="bg-data-neutral-bg rounded-2xl p-6 border border-data-neutral space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-data-neutral" />
                Quick Start — Focused Practice
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {OSCE_QUICK_START_PRESETS.slice(0, 8).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    disabled={isLoading}
                    className="p-3 rounded-xl border border-data-neutral bg-data-neutral-bg hover:border-[var(--color-accent)]/50
                             transition-all text-left group disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-white group-hover:text-[var(--color-accent)] transition-colors block mb-1">
                      {preset.label}
                    </span>
                    <span className="text-xs text-data-neutral line-clamp-2">{preset.description}</span>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        preset.difficulty === 'cooperative' ? 'bg-data-pass/20 text-data-pass'
                          : preset.difficulty === 'difficult' ? 'bg-data-provisional/20 text-data-provisional'
                          : 'bg-data-fail/20 text-data-fail'
                      }`}>
                        {preset.difficulty === 'cooperative' ? 'Easy' : preset.difficulty === 'difficult' ? 'Hard' : 'Expert'}
                      </span>
                      {preset.enableCulturalCompetency && (
                        <Globe className="w-3 h-3 text-data-neutral" />
                      )}
                      {preset.enableResourceLimited && (
                        <FlaskConical className="w-3 h-3 text-data-neutral" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Past Encounters Toggle */}
            <div className="text-center">
              <button
                onClick={() => setShowHistoryPanel(prev => !prev)}
                className="text-sm text-data-neutral hover:text-[var(--color-accent)] transition-colors flex items-center gap-1.5 mx-auto"
              >
                <Clock className="w-4 h-4" />
                {showHistoryPanel ? 'Hide Past Encounters' : 'View Past Encounters'}
              </button>
            </div>

            {/* History Panel */}
            <AnimatePresence>
              {showHistoryPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <OSCEHistoryPanel token={null} />
                </motion.div>
              )}
            </AnimatePresence>

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
                    <div aria-hidden="true" className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                  initial={{ y: -10 }}
                  animate={{ y: 0 }}
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
      <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-sm border border-data-neutral">
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
                className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors border border-data-neutral"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-data-neutral-bg rounded-xl border border-data-neutral overflow-hidden animate-pulse">
                <div className="p-4 md:p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-data-neutral-bg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-data-neutral-bg rounded" />
                    <div className="h-4 w-48 bg-data-neutral-bg rounded" />
                  </div>
                </div>
                <div className="px-4 pb-4 md:px-6 md:pb-6 space-y-3">
                  <div className="flex items-center gap-2 text-data-neutral">
                    <span className="w-2 h-2 rounded-full bg-data-neutral-bg animate-pulse" />
                    <span className="text-sm font-medium">
                      {LOADING_STATUS_MESSAGES[loadingStatusIndex]}
                    </span>
                  </div>
                  <div className="h-24 bg-data-neutral-bg rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-20 bg-data-neutral-bg rounded-lg" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral">
                <div className="h-4 w-24 bg-data-neutral-bg rounded mb-4" />
                <div className="flex gap-2">
                  <div className="flex-1 h-12 bg-data-neutral-bg rounded-lg" />
                  <div className="w-12 h-12 bg-data-neutral-bg rounded-lg" />
                </div>
              </div>
            </div>
            <div className="bg-data-neutral-bg rounded-xl border border-data-neutral p-4 md:p-6 min-h-[320px] flex flex-col items-center justify-center">
              <p className="text-data-neutral text-sm text-center max-w-xs">
                Conversation will appear here once the patient is ready.
              </p>
              <div className="flex items-center gap-2 mt-4 text-data-neutral">
                <div
                  className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
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
      <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-sm border border-data-neutral">
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
                          ? 'bg-data-neutral-bg border-data-neutral text-white'
                          : isCurrent
                            ? 'bg-data-neutral-bg border-data-neutral text-white'
                            : 'bg-transparent border-data-neutral text-data-neutral'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    {idx < phases.length - 1 && (
                      <div
                        className={`w-8 h-0.5 ${isCompleted ? 'bg-data-pass' : 'bg-[var(--color-border)]'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Phase Indicator */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-data-neutral-bg animate-pulse" />
              <span className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                {phase}
              </span>
              {session.id && (
                <button
                  onClick={() => setShowLiveSession(true)}
                  className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors"
                  title="Live voice patient"
                  aria-label="Live voice patient"
                >
                  <Phone className="w-4 h-4 text-data-neutral" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Encounter Timer */}
              <EncounterTimer
                startTime={encounterStartTime}
                isActive={viewState === 'active'}
                isPaused={isPaused}
                targetMinutes={15}
                compact
              />

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
                className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors flex items-center gap-2 border border-data-neutral"
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
                  className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors border border-data-neutral"
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
            className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6 py-3 px-4 rounded-xl bg-data-neutral-bg/80 border border-data-neutral"
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
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                className="bg-data-neutral-bg rounded-xl border border-data-neutral shadow-md overflow-hidden"
              >
                <div
                  className="p-4 md:p-6 flex items-start gap-4 cursor-pointer hover:bg-data-neutral-bg/50 transition-colors"
                  onClick={() => setIsPatientInfoExpanded(!isPatientInfoExpanded)}
                >
                  <div className="w-12 h-12 rounded-xl bg-data-neutral-bg flex items-center justify-center border border-data-neutral flex-shrink-0">
                    <User className="w-6 h-6 text-data-neutral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-data-neutral truncate">
                        {currentCase.patientName}
                      </h2>
                      <button
                        aria-label={isPatientInfoExpanded ? 'Collapse patient info' : 'Expand patient info'}
                        aria-expanded={isPatientInfoExpanded}
                        className="text-data-neutral p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {isPatientInfoExpanded ? (
                          <ChevronUp aria-hidden="true" className="w-5 h-5" />
                        ) : (
                          <ChevronDown aria-hidden="true" className="w-5 h-5" />
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
                            {(['hpi', 'pmh', 'meds', 'vitals', 'labs'] as const).map((tab) => (
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
                                      : tab === 'vitals'
                                        ? 'Vitals'
                                        : 'Labs'}
                              </button>
                            ))}
                          </div>
                          <div
                            className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral min-h-[120px]"
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
                            {emrTab === 'vitals' && (
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Blood Pressure</span>
                                  <span className="text-2xl font-mono font-bold text-white">{Math.round(currentVitals.sbp ?? 0)}/{Math.round(currentVitals.dbp ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">mmHg</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Heart Rate</span>
                                  <span className="text-2xl font-mono font-bold text-white">{Math.round(currentVitals.hr ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">bpm</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Respiratory Rate</span>
                                  <span className="text-2xl font-mono font-bold text-white">{Math.round(currentVitals.rr ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">/min</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">O₂ Saturation</span>
                                  <span className="text-2xl font-mono font-bold text-white">{Math.round(currentVitals.o2 ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                          <p className="text-xs font-bold text-data-neutral uppercase tracking-widest mb-2">
                            Chief Complaint
                          </p>
                          <p className="text-lg font-semibold text-white whitespace-pre-wrap">
                            {currentCase?.chiefComplaint ? (
                              getTranslatedText(currentCase.chiefComplaint)
                            ) : (
                              <span className="inline-block w-32 h-4 bg-data-neutral-bg rounded animate-pulse"></span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* When EMR interface is OFF, show always-visible vitals monitor; when ON, vitals are in Vitals tab only */}
                      {!clinicalFidelity.emrInterface && (
                      <div className="rounded-lg p-4 border border-data-neutral space-y-3 bg-data-neutral-bg">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-data-neutral uppercase tracking-widest">
                            EMR Monitor
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-data-neutral flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-data-neutral-bg animate-pulse" />
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
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
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
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
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
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
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
                          <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
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
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Phase Specific Inputs */}

              {/* HISTORY PHASE */}
              {phase === 'history' && (
                <motion.div
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Ask a Question</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                      placeholder="e.g., When did the chest pain start?"
                      className="flex-1 px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={!currentQuestion.trim()}
                      aria-label="Send Question"
                      className="px-4 py-3 bg-data-neutral-bg hover:bg-data-neutral-bg disabled:bg-data-neutral-bg 
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
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
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
                      className="flex-1 px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg 
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
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
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
                      className="flex-1 px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg 
                               text-data-neutral placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm"
                      autoComplete="off"
                    />
                    <button
                      onClick={handleOrderTest}
                      disabled={!currentQuestion.trim() || isLoading}
                      aria-label="Order Diagnostic Test"
                      className="px-4 py-3 bg-data-neutral-bg hover:bg-data-neutral-bg disabled:bg-data-neutral-bg 
                               disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm flex items-center justify-center min-w-[3.5rem]"
                    >
                      {isLoading ? (
                        <div aria-hidden="true" className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md"
                >
                  <h3 className="text-lg font-semibold mb-4 text-data-neutral">Final Diagnosis</h3>
                  <input
                    type="text"
                    value={userDiagnosis}
                    onChange={(e) => setUserDiagnosis(e.target.value)}
                    placeholder="Enter your primary diagnosis..."
                    aria-label="Enter your primary diagnosis"
                    className="w-full px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg mb-4
                             text-data-neutral placeholder-data-neutral 
                             focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={handleSubmitDiagnosis}
                    disabled={!userDiagnosis.trim() || isLoading}
                    className="w-full bg-data-neutral-bg hover:bg-data-neutral-bg disabled:bg-data-neutral-bg
                             disabled:cursor-not-allowed min-h-[44px] py-3 rounded-lg font-semibold text-white
                             transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div aria-hidden="true" className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                  initial={{ x: -20 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md space-y-4"
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
                      className="w-full px-4 py-3 bg-data-neutral-bg border border-data-neutral rounded-lg
                               text-white placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-sm min-h-[120px]"
                    />
                  </div>

                  {treatmentFeedback && (
                    <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
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
                        className="flex-1 bg-data-neutral-bg hover:bg-data-neutral-bg disabled:bg-data-neutral-bg
                                 disabled:cursor-not-allowed min-h-[44px] py-3 rounded-lg font-semibold text-white
                                 transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <div aria-hidden="true" className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                      className="flex-1 bg-data-neutral-bg hover:bg-data-neutral-bg disabled:bg-data-neutral-bg 
                               disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                               transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div aria-hidden="true" className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                <motion.div initial={{ y: -10 }} animate={{ y: 0 }}>
                  <RapportMeter
                    meter={enhancedOSCE.state.rapportMeter}
                    emotionalState={enhancedOSCE.state.emotionalState ?? undefined}
                    personality={enhancedOSCE.state.personality ?? undefined}
                    compact
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ x: 20 }}
                animate={{ x: 0 }}
                className="bg-data-neutral-bg rounded-xl p-4 md:p-6 border border-data-neutral shadow-md h-[600px] flex flex-col min-w-[250px] break-words"
              >
                <h3 className="text-lg font-semibold mb-4 text-data-neutral">Encounter Log</h3>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {/* History Log */}
                  {session.questions.map((q, idx) => (
                    <div
                      key={`hist-${idx}`}
                      className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral"
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
                      className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral"
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
                        className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral"
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
                    <div className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
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
                    <div className="flex items-center gap-2 text-data-neutral italic p-4 rounded-lg bg-data-neutral-bg/50 border border-data-neutral/50">
                      <div
                        className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-data-neutral-bg rounded-full animate-bounce"
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
              initial={false}
              animate={{}}
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
              initial={false}
              animate={{}}
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
        <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
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
                  className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors border border-data-neutral"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
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
        <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
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
                  className="p-2 rounded-lg bg-data-neutral-bg hover:bg-data-neutral-bg transition-colors border border-data-neutral"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            {/* Overall Score Hero */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/80 rounded-2xl p-8 text-white shadow-xl text-center"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <Award className="w-12 h-12" />
              </div>
              <h2 className="text-5xl font-bold mb-2">{Math.round(preceptorFeedback.score)}%</h2>
              <p className="text-xl opacity-90">Overall Performance</p>
            </motion.div>

            {/* Clinical Reasoning Breakdown */}
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-md"
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
                    <div key={idx} className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-data-neutral" />
                          <span className="font-semibold text-white">{item.label}</span>
                        </div>
                        <span className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
                          {item.score}/10
                        </span>
                      </div>
                      <div className="w-full bg-data-neutral-bg rounded-full h-2 overflow-hidden">
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
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-data-neutral-bg border border-data-neutral flex items-center justify-center">
                  <User className="w-6 h-6 text-data-neutral" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Your Preceptor's Feedback</h3>
                  <p className="text-sm text-data-neutral">Clinical reasoning assessment</p>
                </div>
              </div>
              <div className="bg-data-neutral-bg rounded-lg p-5 border border-data-neutral">
                <p className="text-white leading-relaxed italic">"{preceptorFeedback.feedback}"</p>
              </div>
            </motion.div>

            {/* Strengths & Areas for Improvement */}
            <div className="grid md:grid-cols-2 gap-6">
              {preceptorFeedback.strengths.length > 0 && (
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral"
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
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral"
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
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral"
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
                      className="flex items-start gap-2 text-sm text-data-neutral bg-data-neutral-bg rounded p-3 border border-data-neutral"
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
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.51 }}
                className="bg-data-neutral-bg rounded-xl p-6 border border-data-fail/50"
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
                      className="flex items-start gap-2 text-sm text-data-neutral bg-data-neutral-bg rounded p-3 border border-data-neutral"
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
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.52 }}
              className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral"
            >
              <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-data-neutral" /> Rubric Checklist
              </h3>
              {gradeResultLoading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Grading in progress">
                  <div className="h-4 bg-data-neutral-bg rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-data-neutral-bg rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-data-neutral-bg rounded animate-pulse w-5/6" />
                  <p className="text-sm text-data-neutral mt-2">Grading…</p>
                </div>
              ) : gradeResult ? (
                <>
                  {/* Score summary */}
                  <div className="flex items-center gap-4 mb-4 p-3 bg-data-neutral-bg rounded-lg border border-data-neutral">
                    <div className="flex-1 text-center">
                      <p className="text-xs text-data-neutral uppercase tracking-wider">Score</p>
                      <p className="text-2xl font-bold text-data-neutral">{gradeResult.score}</p>
                      <p className="text-xs text-data-neutral">out of 100</p>
                    </div>
                    <div className="h-10 w-px bg-data-neutral-bg" />
                    <div className="flex-1 text-center">
                      <p className="text-xs text-data-neutral uppercase tracking-wider">Clinical Reasoning</p>
                      <p className="text-2xl font-bold text-data-neutral">{gradeResult.clinicalReasoningScore}</p>
                      <p className="text-xs text-data-neutral">out of 100</p>
                    </div>
                  </div>

                  {/* Checklist if any */}
                  {gradeResult.checklist?.length > 0 ? (
                    <ul className="space-y-2 mb-4">
                      {gradeResult.checklist.map((item, idx) => (
                        <li
                          key={idx}
                          className={`flex items-start gap-2 text-sm rounded p-3 border ${
                            item.status === 'PASS'
                              ? 'bg-data-pass/30 border-data-pass text-data-neutral'
                              : 'bg-data-neutral-bg border-data-neutral text-data-neutral'
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
                  ) : (
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4 mb-4">
                      <p className="font-medium text-[var(--color-text-primary)]">No critical actions tracked</p>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        This case did not include a specific rubric checklist.
                      </p>
                    </div>
                  )}

                  {/* Red flags if any */}
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
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.53 }}
                className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral"
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
                        className="bg-data-neutral-bg rounded-lg p-3 border border-data-neutral"
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
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral"
              >
                <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                  <Activity className="w-5 h-5 text-data-neutral" /> Differential Diagnoses to Consider
                </h3>
                <p className="text-sm text-data-neutral mb-3">
                  Based on the presentation, you should have considered:
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {preceptorFeedback.differentialDiagnosis.map((dx, idx) => (
                    <div key={idx} className="bg-data-neutral-bg rounded-lg p-3 border border-data-neutral">
                      <span className="font-semibold text-data-neutral">{dx}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Correct Diagnosis Card */}
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
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
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-md"
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
                className="flex-1 bg-data-neutral-bg hover:bg-data-neutral-bg py-4 rounded-xl font-semibold text-white
                       transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <MessageSquare className="w-5 h-5" />
                Try Another Case
              </motion.button>
              <motion.button
                onClick={() => {
                  const md = generateOSCEMarkdown({
                    caseName: currentCase.chiefComplaint || currentCase.correctDiagnosis || 'Unknown Case',
                    correctDiagnosis: currentCase.correctDiagnosis,
                    userDiagnosis,
                    date: new Date().toLocaleDateString(),
                    score: gradeResult?.score,
                    clinicalReasoningScore: gradeResult?.clinicalReasoningScore,
                    checklist: gradeResult?.checklist,
                    redFlagsMissed: gradeResult?.redFlagsMissed,
                    strengths: preceptorFeedback?.strengths,
                    areasForImprovement: preceptorFeedback?.areasForImprovement,
                    teachingPoints: currentCase.teachingPoints,
                    totalTimeMs: Date.now() - encounterStartTime,
                  });
                  downloadOSCEReport(md, `OSCE_${currentCase.correctDiagnosis?.replace(/\s+/g, '_') || 'Report'}_${new Date().toISOString().slice(0, 10)}`);
                }}
                className="px-6 py-4 bg-data-neutral-bg hover:bg-data-neutral-bg rounded-xl font-semibold
                       text-white transition-colors border border-data-neutral flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FileText className="w-5 h-5" />
                Export
              </motion.button>
              {onExit && (
                <motion.button
                  onClick={onExit}
                  className="px-8 py-4 bg-data-neutral-bg hover:bg-data-neutral-bg rounded-xl font-semibold
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

  // Legacy results view (fallback if no preceptor feedback) — extracted to OSCEResultsView
  if (viewState === 'results' && currentCase && session && session.score) {
    return (
      <OSCEResultsView
        score={session.score}
        isCorrectDiagnosis={diagnosisFeedback?.isCorrect ?? false}
        userDiagnosis={userDiagnosis}
        diagnosisFeedback={diagnosisFeedback}
        aar={aar}
        correctDiagnosis={currentCase.correctDiagnosis}
        idealWorkup={currentCase.idealWorkup}
        onExit={onExit}
        onNewCase={handleNewCase}
      />
    );
  }

  return null;
};

export default PatientEncounterMode;
