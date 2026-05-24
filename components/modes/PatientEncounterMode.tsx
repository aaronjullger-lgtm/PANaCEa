import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
  Activity,
  Stethoscope,
  Microscope,
  FileText,
  Pill,
  ChevronRight,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import type {
  PatientEncounterCase,
  PatientQuestion,
  EncounterSession,
  PatientPersona,
} from '@/types/drill-modes';
import type { PlacedOrder, ExamFinding, OrderCategory } from '@/types/osce-enhanced';

// Import OSCE Enhancement Components
import {
  OrderPanel,
  ExamPanel,
  RapportMeter,
  ScoreReport,
  OSCELiveSession,
  OSCEResultsView,
  OSCEHistoryPanel,
  EncounterTimer,
  VitalsStrip,
  PhaseStepper,
  EncounterWorkstation,
} from './osce';
import { useEnhancedOSCE } from '@/hooks/useEnhancedOSCE';
import { useEncounterReducer, type EncounterPhase, type ViewState } from '@/hooks/useEncounterReducer';
import { useOSCEMetrics } from '@/hooks/useOSCEMetrics';
import {
  getRandomEncounterCase,
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
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
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
import { Sparkline } from '@/components/ui/Sparkline';
import { ChatSkeleton, InlineButtonSpinner } from '@/components/loading';
import { EncounterLoadingView } from './EncounterLoadingView';
import { EncounterLandingView } from './EncounterLandingView';
import {
  PHASE_ORDER,
  canAdvancePhase,
  determineCategory,
  getRelevanceColor,
  getRelevanceLabel,
  getScoreColor,
  getSemanticVitalClass,
  getTranslatedText,
  generateTrendData,
} from '@/lib/utils/encounterHelpers';
import { useVitalsEngine } from '@/hooks/useVitalsEngine';
import { formatPatientAgeShort } from '@/lib/utils/ageFormatter';

import { useClinicalFidelitySettings } from '@/hooks/useClinicalFidelitySettings';
import {
  getCulturalCompetencyPrompt,
  getResourceLimitedPrompt,
  getAIDifficultyPrompt,
  OSCE_QUICK_START_PRESETS,
  type OSCEQuickStartPreset,
} from '@/config/osce-settings';
import { generateOSCEMarkdown, downloadOSCEReport } from '@/lib/utils/osceExport';
import { updateConditionSchedule, getDueConditions, getConditionStats, type OSCEConditionSchedule } from '@/lib/osce-spaced-repetition';

// Module 1 & Integration Imports
import { useSystemIntegration } from '@/contexts/SystemIntegrationContext';
import { useRealtimeSOAP } from '@/hooks/useRealtimeSOAP';
import { useTimingAnalytics } from '@/hooks/useTimingAnalytics';
import { SOAPDraftPanel } from '@/components/osce/SOAPDraftPanel';
import { TimingMetricsPanel } from '@/components/osce/TimingMetricsPanel';
import { ContextBanner } from '@/components/shared/ContextBanner';
import { PatientAVEngine } from '@/services/av/patientAVEngine';
import type { PatientAVStateMachine, AVState } from '@/types/patient-av-state-machine';

// Gemini access is server-side only — the browser bundle no longer carries
// any model API key. The scribe calls /api/scribe/soap/extract with a Clerk
// Bearer token instead (see useRealtimeSOAP / soapNoteService).

interface PatientEncounterModeProps {
  onExit?: () => void;
}

const PatientEncounterMode: React.FC<PatientEncounterModeProps> = ({ onExit }) => {
  const { getToken, userId } = useAuth();
  const persistKey = userId ? `user_${userId}` : 'anonymous';

  // Consolidated state via useReducer — replaces ~50 individual useState calls
  const [encounterState, , actions] = useEncounterReducer();
  const {
    viewState, phase, isPaused, pausedMs,
    currentCase, session, patientPersona, secretDiagnosis, encounterStartTime,
    currentQuestion, examAction, diagnosticOrder, userDiagnosis, treatmentPlan, newDifferential,
    physicalFindings, diagnosticResults, differentialDiagnoses,
    isLoading, isTyping, loadingStatusIndex, typingStatusIndex, languageMode, loadError,
    diagnosisFeedback, treatmentFeedback, aar, isPatientInfoExpanded, preceptorFeedback,
    streamedDebriefText, isStreamingDebrief, enhancedScoreReport, gradeResult, gradeResultLoading,
    showOrderPanel, showExamPanel, showRapportMeter, showLiveSession, showHistoryPanel, emrTab,
    enableCulturalCompetency, enableResourceLimited, aiDifficulty, presetFilters,
    dueConditions, conditionStats, osceStats,
    avEngine, currentAVState, wsUrl, voiceMode,
  } = encounterState;
  const {
    setViewState, setPhase, setIsPaused, setPausedMs,
    setCurrentCase, setSession, setPatientPersona, setSecretDiagnosis, setEncounterStartTime,
    setCurrentQuestion, setExamAction, setDiagnosticOrder, setUserDiagnosis, setTreatmentPlan, setNewDifferential,
    setPhysicalFindings, setDiagnosticResults, setDifferentialDiagnoses,
    setIsLoading, setIsTyping, setLoadingStatusIndex, setTypingStatusIndex, setLanguageMode, setLoadError,
    setDiagnosisFeedback, setTreatmentFeedback, setAar, setIsPatientInfoExpanded, setPreceptorFeedback,
    setStreamedDebriefText, setIsStreamingDebrief, setEnhancedScoreReport, setGradeResult, setGradeResultLoading,
    setShowOrderPanel, setShowExamPanel, setShowRapportMeter, setShowLiveSession, setShowHistoryPanel, setEmrTab,
    setEnableCulturalCompetency, setEnableResourceLimited, setAiDifficulty, setPresetFilters,
    setDueConditions, setConditionStats, setOsceStats,
    setAVEngine, setCurrentAVState, setWsUrl, setVoiceMode,
  } = actions;
  // --- State is now managed by useEncounterReducer above ---
  const pauseStartRef = useRef<number | null>(null);

  // Clinical Fidelity Mode (shared hook with Settings modal)
  const { settings: clinicalFidelity } = useClinicalFidelitySettings();
  const isFidelityModeActive = clinicalFidelity.rawLabValues || clinicalFidelity.emrInterface;

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
    getToken,
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
  const chatSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Abort debrief stream on unmount so we do not update state after unmount
  useEffect(() => {
    return () => {
      debriefAbortRef.current?.abort();
      debriefAbortRef.current = null;
    };
  }, []);

  // Fetch OSCE stats for landing page sparkline

  useEffect(() => {
    if (viewState !== 'landing') return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/osce/stats', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const json: any = await res.json();
        const d = unwrapApiEnvelope(json);
        if (d && typeof d.totalEncounters === 'number') {
          setOsceStats({
            totalEncounters: d.totalEncounters,
            passRate: d.passRate,
            averageScore: d.averageScore,
            trend: (d.trend || []).map((t: any) => t.score as number),
          });
        }
      } catch (statsErr) {
        console.debug('[PatientEncounter] stats fetch failed (optional)', statsErr);
      }
    })();
  }, [viewState, getToken]);

  // Load spaced-repetition due conditions for landing page
  useEffect(() => {
    if (viewState !== 'landing') return;
    try {
      setDueConditions(getDueConditions());
      setConditionStats(getConditionStats());
    } catch (lsErr) {
      console.debug('[PatientEncounter] localStorage condition stats failed', lsErr);
    }
  }, [viewState]);

  // AV state machine is managed by useEncounterReducer

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

  // getSemanticVitalClass extracted to lib/utils/encounterHelpers.ts

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

  // getTranslatedText extracted to lib/utils/encounterHelpers.ts

  // generateTrendData extracted to lib/utils/encounterHelpers.ts

  const handleStartEncounter = async (filters?: { targetSystems?: string[]; difficulty?: string } | null) => {
    setIsLoading(true);
    setLoadError(null);
    setViewState('loading_encounter');

    try {
      const token = await getToken();

      const newCase = await getRandomEncounterCase(token, filters ?? presetFilters ?? undefined);

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

      // Persist chat to server via serialized queue to prevent concurrent overwrites
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
        const savedSessionId = session.id;
        chatSaveQueueRef.current = chatSaveQueueRef.current
          .then(async () => {
            if (!savedSessionId) return;
            const saved = await saveOSCEChat(savedSessionId, messages, token);
            if (!saved) {
              toast.error('Chat could not be saved to the server. Your progress may not be recorded.');
            }
          })
          .catch((err) => {
            console.debug('[PatientEncounterMode] Chat save queue error', err);
          });
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
    // Store system filters so handleStartEncounter can use them
    const filters = preset.targetSystems.length > 0
      ? { targetSystems: preset.targetSystems }
      : null;
    setPresetFilters(filters);
    // Start encounter with preset applied (pass filters directly since setState is async)
    handleStartEncounter(filters);
  };

  // Memoized callbacks for React.memo'd children (prevents re-render cascades)
  const handleOrderPlace = useCallback((orders: PlacedOrder[]) => {
    const existingIds = new Set(enhancedOSCE.state.orders.map((o) => o.id));
    const newOrders = orders.filter((o) => !existingIds.has(o.id));
    newOrders.forEach((order) => {
      enhancedOSCE.placeOrder(order);
      setDiagnosticResults((prev) => [
        ...prev,
        { testName: order.itemName, result: 'Pending...', interpretation: '' },
      ]);
    });
  }, [enhancedOSCE]);

  const handleExamPerformed = useCallback((finding: ExamFinding) => {
    enhancedOSCE.recordExamFinding(finding);
    setPhysicalFindings((prev) => [
      ...prev,
      { maneuver: finding.maneuverName, finding: finding.finding },
    ]);
  }, [enhancedOSCE]);

  const handleCloseOrderPanel = useCallback(() => setShowOrderPanel(false), []);
  const handleCloseExamPanel = useCallback(() => setShowExamPanel(false), []);
  const handlePhaseSelect = useCallback((p: EncounterPhase) => setPhase(p), []);

  const togglePause = () => {
    if (isPaused && pauseStartRef.current != null) {
      // Resuming — accumulate paused duration
      setPausedMs(prev => prev + (Date.now() - pauseStartRef.current!));
      pauseStartRef.current = null;
    } else {
      // Pausing — record start of pause
      pauseStartRef.current = Date.now();
    }
    setIsPaused(prev => !prev);
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
    setPresetFilters(null);
    setPhysicalFindings([]);
    setDiagnosticResults([]);
    setPatientPersona(null);
    setSecretDiagnosis(null);
    setDifferentialDiagnoses([]);
    setTreatmentPlan('');
    setAar('');
    setPreceptorFeedback(null);
    setIsPaused(false);
    setPausedMs(0);
    pauseStartRef.current = null;
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
          performedAt: Date.now(),
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

      // NOTE: Session completion moved to handleEndEncounter only —
      // completing here caused the second call (with telemetry) to be
      // silently dropped by the backend's idempotency guard.
    } catch (error) {
      console.error('Treatment error:', error);
      toast.error('Could not evaluate treatment plan. Please try again.');
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

        // OSCE performance feeds the condition-level spaced repetition schedule.
        // We intentionally do NOT emit a QuestionAttempt record here — a session
        // id is not a legitimate question id, and pushing it through the main
        // sync queue would pollute FSRS/analytics with semantically wrong rows.
        // OSCE results are already persisted via completeOSCESession() +
        // gradeOSCESession() above.
        if (currentCase) {
          try {
            const osceScore = rubricResult.score ?? 0;
            updateConditionSchedule(
              currentCase.id,
              currentCase.correctDiagnosis || 'Unknown',
              'general',
              osceScore,
              {
                communicationScore: rubricResult.communicationScore,
                differentialScore: rubricResult.differentialScore,
                hadDangerousActions: (rubricResult.dangerousActionsDetected?.length ?? 0) > 0,
              }
            );
          } catch (dashErr) {
            console.warn('[PatientEncounter] dashboard update failed (non-critical)', dashErr);
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
  // PHASE_ORDER and canAdvancePhase extracted to lib/utils/encounterHelpers.ts

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

    const validation = canAdvancePhase(phase, nextPhase, session?.questions.length ?? 0);
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

  // determineCategory extracted to lib/utils/encounterHelpers.ts

  // getRelevanceColor extracted to lib/utils/encounterHelpers.ts

  // getRelevanceLabel extracted to lib/utils/encounterHelpers.ts

  // getScoreColor extracted to lib/utils/encounterHelpers.ts
  // Landing Page View - extracted to EncounterLandingView
  if (viewState === 'landing') {
    return (
      <EncounterLandingView
        onExit={onExit}
        osceStats={osceStats}
        conditionStats={conditionStats}
        dueConditions={dueConditions}
        aiDifficulty={aiDifficulty}
        enableCulturalCompetency={enableCulturalCompetency}
        enableResourceLimited={enableResourceLimited}
        isLoading={isLoading}
        loadError={loadError}
        showHistoryPanel={showHistoryPanel}
        setAiDifficulty={setAiDifficulty}
        setEnableCulturalCompetency={setEnableCulturalCompetency}
        setEnableResourceLimited={setEnableResourceLimited}
        applyPreset={applyPreset}
        handleStartEncounter={handleStartEncounter}
        setShowHistoryPanel={setShowHistoryPanel}
        setLoadError={setLoadError}
      />
    );
  }


  if (viewState === 'loading_encounter') {
    return (
      <EncounterLoadingView
        onExit={onExit}
        loadingStatusIndex={loadingStatusIndex}
        loadingStatusMessages={LOADING_STATUS_MESSAGES}
      />
    );
  }

  // Active Interview View - Clinical White/Navy Theme
  if (viewState === 'active' && currentCase && session) {
    // Sidebar content for EncounterWorkstation (Rapport + Encounter Log)
    const sidebarJsx = (
      <>
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
            {session.questions.map((q: { questionText: string; response: string }, idx: number) => (
              <div key={`hist-${idx}`} className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                  <MessageSquare className="w-3 h-3" /> History
                </div>
                <p className="text-[var(--color-text-inverse)] font-semibold">Q: {q.questionText}</p>
                <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                  A: {getTranslatedText(q.response, languageMode)}
                </p>
              </div>
            ))}
            {physicalFindings.map((f, idx) => (
              <div key={`phys-${idx}`} className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                  <Stethoscope className="w-3 h-3" /> Physical Exam
                </div>
                <p className="text-[var(--color-text-inverse)] font-semibold">Exam: {f.maneuver}</p>
                <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                  Finding: {f.finding}
                </p>
              </div>
            ))}
            {diagnosticResults.map((d, idx) => {
              const trendData = generateTrendData(d.result);
              return (
                <div key={`diag-${idx}`} className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                  <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                    <ClipboardList className="w-3 h-3" /> Diagnostic
                  </div>
                  <p className="text-[var(--color-text-inverse)] font-semibold">{d.testName}</p>
                  {isFidelityModeActive && clinicalFidelity.rawLabValues && trendData && (
                    <div className="flex items-center gap-1 h-6 mt-1">
                      {trendData.map((val, ti) => (
                        <div
                          key={ti}
                          className="w-1.5 bg-[var(--color-accent)] rounded-full opacity-70"
                          style={{ height: `${Math.max(4, Math.min(24, (val / Math.max(...trendData)) * 24))}px` }}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                    {d.result} — {d.interpretation}
                  </p>
                </div>
              );
            })}
            {diagnosisFeedback && (
              <div className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                  style={{ color: diagnosisFeedback.isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>
                  <ClipboardList className="w-3 h-3" /> Diagnosis Submitted
                </div>
                <p className="text-[var(--color-text-inverse)] font-semibold">{userDiagnosis}</p>
                <p className="text-data-neutral text-sm pl-4 border-l-2 border-data-neutral whitespace-pre-wrap">
                  {diagnosisFeedback.isCorrect ? 'Correct!' : `Expected: ${diagnosisFeedback.correctDiagnosis ?? 'N/A'}`}
                </p>
              </div>
            )}
            {isTyping && (
              <div className="bg-data-neutral-bg rounded-lg p-4 space-y-2 border border-data-neutral animate-pulse">
                <div className="flex items-center gap-2 text-xs font-bold text-data-neutral uppercase tracking-widest">
                  <MessageSquare className="w-3 h-3" />
                  {TYPING_STATUS_MESSAGES[typingStatusIndex]}
                </div>
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {isLoading && session.questions.length === 0 && (
              <ChatSkeleton />
            )}
            {session.questions.length === 0 && physicalFindings.length === 0 && diagnosticResults.length === 0 && !isLoading && (
              <p className="text-[var(--color-text-secondary)] text-center py-8 italic">
                Start the encounter by asking about the patient's history.
              </p>
            )}
          </div>
        </motion.div>
      </>
    );

    return (
      <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
        {/* Header */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-data-neutral-bg flex items-center justify-center shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] border border-data-neutral">
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
                          ? 'bg-data-neutral-bg border-data-neutral text-[var(--color-text-inverse)]'
                          : isCurrent
                            ? 'bg-data-neutral-bg border-data-neutral text-[var(--color-text-inverse)]'
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
              {/* Pause Toggle */}
              <button
                onClick={togglePause}
                className={`p-1.5 rounded-md transition-colors border ${
                  isPaused
                    ? 'bg-[var(--color-data-provisional)]/20 border-[var(--color-data-provisional)]/40 text-[var(--color-data-provisional)]'
                    : 'border-transparent text-data-neutral hover:text-[var(--color-text-inverse)]'
                }`}
                title={isPaused ? 'Resume encounter' : 'Pause encounter'}
                aria-label={isPaused ? 'Resume encounter' : 'Pause encounter'}
              >
                {isPaused ? <ArrowRight className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </button>

              {/* Encounter Timer */}
              <EncounterTimer
                startTime={encounterStartTime}
                isActive={viewState === 'active'}
                isPaused={isPaused}
                pausedMs={pausedMs}
                targetMinutes={15}
                compact
              />

              {/* Enhanced OSCE Panel Toggles */}
              <div className="hidden md:flex items-center gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-1 border border-[var(--color-border)]">
                <button
                  onClick={() => setShowRapportMeter(!showRapportMeter)}
                  className={`p-2 rounded-md transition-colors ${showRapportMeter ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Rapport Meter"
                  aria-label="Toggle Rapport Meter"
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowExamPanel(!showExamPanel)}
                  className={`p-2 rounded-md transition-colors ${showExamPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Physical Exam Panel"
                  aria-label="Toggle Physical Exam Panel"
                >
                  <StethoscopeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowOrderPanel(!showOrderPanel)}
                  className={`p-2 rounded-md transition-colors ${showOrderPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                  title="Toggle Order Panel"
                  aria-label="Toggle Order Panel"
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
              {/* Timer is rendered by EncounterTimer component above */}
              {onExit && (
                <Button
                  variant="ghost"
                  onClick={onExit}
                  aria-label="Exit Encounter"
                >
                  <X className="w-5 h-5" />
                </Button>
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
                avState={currentAVState}
                onClose={() => setShowLiveSession(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content — Clinical Workstation Layout */}
        <EncounterWorkstation
          vitals={{
            hr: currentVitals.hr,
            sbp: currentVitals.sbp ?? 120,
            dbp: currentVitals.dbp ?? 80,
            rr: currentVitals.rr,
            o2: currentVitals.o2,
          }}
          vitalsHistory={vitalsHistory}
          phase={phase}
          onPhaseSelect={handlePhaseSelect}
          avState={currentAVState}
          showOrders={showOrderPanel}
          showExam={showExamPanel}
          onToggleOrders={() => setShowOrderPanel(!showOrderPanel)}
          onToggleExam={() => setShowExamPanel(!showExamPanel)}
          orderPanel={
            <OrderPanel
              isOpen={showOrderPanel}
              onOrderPlace={handleOrderPlace}
              placedOrders={enhancedOSCE.state.orders}
              onClose={handleCloseOrderPanel}
            />
          }
          examPanel={
            <ExamPanel
              onExamPerformed={handleExamPerformed}
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
              onClose={handleCloseExamPanel}
            />
          }
          sidebarContent={sidebarJsx}
        >
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
                                    ? 'border-[var(--color-accent)] text-[var(--color-text-inverse)]'
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
                                <p className="text-lg font-semibold text-[var(--color-text-inverse)] whitespace-pre-wrap mb-4">
                                  {currentCase?.chiefComplaint
                                    ? getTranslatedText(currentCase.chiefComplaint, languageMode)
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
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.sbp ?? 0)}/{Math.round(currentVitals.dbp ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">mmHg</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Heart Rate</span>
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.hr ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">bpm</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">Respiratory Rate</span>
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.rr ?? 0)}</span>
                                  <span className="text-sm font-mono text-data-neutral ml-1">/min</span>
                                </div>
                                <div className="bg-data-neutral-bg rounded-lg p-4 border border-data-neutral">
                                  <span className="text-xs font-bold text-data-neutral uppercase tracking-widest block mb-2">O₂ Saturation</span>
                                  <span className="text-2xl font-mono font-bold text-[var(--color-text-inverse)]">{Math.round(currentVitals.o2 ?? 0)}</span>
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
                          <p className="text-lg font-semibold text-[var(--color-text-inverse)] whitespace-pre-wrap">
                            {currentCase?.chiefComplaint ? (
                              getTranslatedText(currentCase.chiefComplaint, languageMode)
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
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
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
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
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
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
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
                              <span className="text-3xl font-mono font-bold text-[var(--color-text-inverse)] tabular-nums">
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
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                      autoComplete="off"
                    />
                    <Button
                      variant="ghost"
                      onClick={handleAskQuestion}
                      disabled={!currentQuestion.trim()}
                      aria-label="Send Question"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => advancePhase('physical')}
                    >
                      Move to Physical Exam <ArrowRight className="w-4 h-4" />
                    </Button>
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
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => setShowRapportMeter(!showRapportMeter)}
                      className={`p-2 rounded-md transition-colors ${showRapportMeter ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Rapport Meter"
                      aria-label="Toggle Rapport Meter"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowExamPanel(!showExamPanel)}
                      className={`p-2 rounded-md transition-colors ${showExamPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Physical Exam Panel"
                      aria-label="Toggle Physical Exam Panel"
                    >
                      <StethoscopeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowOrderPanel(!showOrderPanel)}
                      className={`p-2 rounded-md transition-colors ${showOrderPanel ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      title="Toggle Order Panel"
                      aria-label="Toggle Order Panel"
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
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                      autoComplete="off"
                    />
                    <Button
                      variant="ghost"
                      onClick={handleOrderTest}
                      disabled={!currentQuestion.trim() || isLoading}
                      aria-label="Order Diagnostic Test"
                    >
                      {isLoading ? (
                        <InlineButtonSpinner />
                      ) : (
                        <Activity className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => advancePhase('diagnosis')}
                    >
                      Move to Diagnosis <ArrowRight className="w-4 h-4" />
                    </Button>
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
                             focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                    autoComplete="off"
                  />

                  {/* Differential Diagnoses */}
                  <div className="mb-4">
                    <label className="text-sm font-medium text-data-neutral/80 mb-2 block">
                      Differential Diagnoses <span className="text-data-neutral/50">(optional, up to 10)</span>
                    </label>
                    {differentialDiagnoses.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {differentialDiagnoses.map((dx, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm
                                     bg-data-neutral/10 border border-data-neutral/30 text-data-neutral"
                          >
                            {dx}
                            <button
                              type="button"
                              onClick={() => setDifferentialDiagnoses((prev) => prev.filter((_, i) => i !== idx))}
                              className="ml-1 text-data-neutral/50 hover:text-data-fail transition-colors"
                              aria-label={`Remove ${dx}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {differentialDiagnoses.length < 10 && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDifferential}
                          onChange={(e) => setNewDifferential(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newDifferential.trim()) {
                              e.preventDefault();
                              handleAddDifferential();
                            }
                          }}
                          placeholder="Add a differential..."
                          aria-label="Add a differential diagnosis"
                          className="flex-1 px-3 py-2 bg-data-neutral-bg border border-data-neutral/40 rounded-lg text-sm
                                   text-data-neutral placeholder-data-neutral/50
                                   focus:outline-none focus:ring-1 focus:ring-data-neutral focus:border-transparent"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={handleAddDifferential}
                          disabled={!newDifferential.trim()}
                          className="px-3 py-2 bg-data-neutral/10 border border-data-neutral/30 rounded-lg text-sm
                                   text-data-neutral hover:bg-data-neutral/20 disabled:opacity-40
                                   disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleSubmitDiagnosis}
                    disabled={!userDiagnosis.trim() || isLoading}
                    className="w-full min-h-[44px] py-3"
                  >
                    {isLoading ? (
                      <>
                        <InlineButtonSpinner size="sm" />
                        Evaluating...
                      </>
                    ) : (
                      'Submit Diagnosis'
                    )}
                  </Button>
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
                               text-[var(--color-text-inverse)] placeholder-data-neutral 
                               focus:outline-none focus:ring-2 focus:ring-data-neutral focus:border-transparent shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] min-h-[120px]"
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
                                 disabled:cursor-not-allowed min-h-[44px] py-3 rounded-lg font-semibold text-[var(--color-text-inverse)]
                                 transition-colors shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <InlineButtonSpinner size="sm" />
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
                               disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-[var(--color-text-inverse)]
                               transition-colors shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <InlineButtonSpinner size="sm" />
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
        </EncounterWorkstation>
      </div>
    );
  }

  // Results View - Virtual Preceptor Report Card (or streaming evaluation)
  if (viewState === 'results' && currentCase) {
    const showStreaming = isStreamingDebrief || streamedDebriefText.length > 0;

    if (showStreaming && !preceptorFeedback) {
      return (
        <div className="min-h-screen bg-data-neutral-bg text-data-neutral">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-data-neutral" />
                <div>
                  <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
                  <p className="text-sm text-data-neutral">AI is evaluating your encounter...</p>
                </div>
              </div>
              {onExit && (
                <Button
                  variant="ghost"
                  onClick={onExit}
                  aria-label="Exit debrief"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral">
              <p className="text-data-neutral text-sm mb-2">Streaming evaluation (token-by-token):</p>
              <pre className="text-[var(--color-text-inverse)] font-mono text-sm whitespace-pre-wrap break-words min-h-[120px]">
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
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-data-neutral" />
                <div>
                  <h1 className="text-2xl font-bold">Virtual Preceptor Debrief</h1>
                  <p className="text-sm text-data-neutral">Performance Evaluation</p>
                </div>
              </div>
              {onExit && (
                <Button
                  variant="ghost"
                  onClick={onExit}
                  aria-label="Exit debrief"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
            {/* Overall Score Hero — prefer Gemini rubric score when available */}
            {(() => {
              const rubricAvailable = gradeResult && typeof gradeResult.score === 'number';
              const displayScore = rubricAvailable ? gradeResult.score : preceptorFeedback.score;
              return (
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/80 rounded-2xl p-8 text-[var(--color-text-inverse)] shadow-xl text-center"
              >
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[var(--color-bg-primary)]/20 backdrop-blur-sm mb-4">
                  <Award className="w-12 h-12" />
                </div>
                <h2 className="text-5xl font-bold mb-2">{Math.round(displayScore)}%</h2>
                <p className="text-xl opacity-90">
                  {rubricAvailable ? 'AI-Graded Score' : 'Estimated Score (rubric unavailable)'}
                </p>
              </motion.div>
              );
            })()}

            {/* Clinical Reasoning Breakdown */}
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral shadow-md"
            >
              <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-inverse)]">Clinical Competencies</h3>
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
                          <span className="font-semibold text-[var(--color-text-inverse)]">{item.label}</span>
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
                  <h3 className="text-xl font-semibold text-[var(--color-text-inverse)]">Your Preceptor's Feedback</h3>
                  <p className="text-sm text-data-neutral">Clinical reasoning assessment</p>
                </div>
              </div>
              <div className="bg-data-neutral-bg rounded-lg p-5 border border-data-neutral">
                <p className="text-[var(--color-text-inverse)] leading-relaxed italic">"{preceptorFeedback.feedback}"</p>
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

            {/* AI-Graded Rubric (from Gemini grade API) – primary score source */}
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.52 }}
              className="bg-data-neutral-bg rounded-xl p-6 border border-data-neutral"
            >
              <h3 className="text-lg font-semibold mb-4 text-data-neutral flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-data-neutral" /> AI-Graded Rubric
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

                  {/* Extended scoring dimensions */}
                  {(gradeResult.communicationScore != null || gradeResult.differentialScore != null) && (
                    <div className="flex items-center gap-4 mb-4 p-3 bg-data-neutral-bg rounded-lg border border-data-neutral">
                      {gradeResult.communicationScore != null && (
                        <div className="flex-1 text-center">
                          <p className="text-xs text-data-neutral uppercase tracking-wider">Communication</p>
                          <p className={`text-xl font-bold ${
                            gradeResult.communicationScore >= 80 ? 'text-data-pass' :
                            gradeResult.communicationScore >= 60 ? 'text-data-provisional' : 'text-data-fail'
                          }`}>{gradeResult.communicationScore}</p>
                          <p className="text-xs text-data-neutral">out of 100</p>
                        </div>
                      )}
                      {gradeResult.communicationScore != null && gradeResult.differentialScore != null && (
                        <div className="h-10 w-px bg-data-neutral-bg" />
                      )}
                      {gradeResult.differentialScore != null && (
                        <div className="flex-1 text-center">
                          <p className="text-xs text-data-neutral uppercase tracking-wider">Differentials</p>
                          <p className={`text-xl font-bold ${
                            gradeResult.differentialScore >= 80 ? 'text-data-pass' :
                            gradeResult.differentialScore >= 60 ? 'text-data-provisional' : 'text-data-fail'
                          }`}>{gradeResult.differentialScore}</p>
                          <p className="text-xs text-data-neutral">out of 100</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dangerous actions alert */}
                  {gradeResult.dangerousActionsDetected && gradeResult.dangerousActionsDetected.length > 0 && (
                    <div className="mb-4 p-3 bg-[var(--color-data-fail)]/20 rounded-lg border border-[var(--color-data-fail)]/40">
                      <p className="text-sm font-semibold text-[var(--color-data-fail)] mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Dangerous Actions Detected ({gradeResult.dangerousActionsDetected.length})
                      </p>
                      <ul className="space-y-1">
                        {gradeResult.dangerousActionsDetected.map((action, idx) => (
                          <li key={idx} className="text-sm text-[var(--color-data-fail)] flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-[var(--color-data-fail)] flex-shrink-0" />
                            {action.description}
                            <span className="text-xs text-[var(--color-data-fail)]/70 ml-auto">-{action.penalty} pts</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRetryGrading}
                      disabled={gradeResultLoading}
                    >
                      {gradeResultLoading ? 'Grading…' : 'Retry grading'}
                    </Button>
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

            {/* Quick Preview — estimated from client-side detected actions (secondary to AI rubric above) */}
            {enhancedScoreReport && gradeResult && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.55 }}
              >
                <div className="mb-2 px-1">
                  <p className="text-xs text-data-neutral italic">
                    Quick Preview — estimated from detected actions. The AI-graded rubric above is the authoritative assessment.
                  </p>
                </div>
                <ScoreReport
                  report={{
                    ...enhancedScoreReport,
                    ...(differentialDiagnoses.length > 0 ? { submittedDifferentials: differentialDiagnoses } : {}),
                  }}
                />
              </motion.div>
            )}

            {/* Fallback: show client-side report as primary when rubric is unavailable */}
            {enhancedScoreReport && !gradeResult && !gradeResultLoading && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.55 }}
              >
                <div className="mb-2 px-1">
                  <p className="text-xs text-data-neutral italic">
                    Estimated score from detected actions (AI rubric unavailable — retry grading above for the official score).
                  </p>
                </div>
                <ScoreReport
                  report={{
                    ...enhancedScoreReport,
                    ...(differentialDiagnoses.length > 0 ? { submittedDifferentials: differentialDiagnoses } : {}),
                  }}
                />
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
              className="bg-[var(--color-accent)]/10 rounded-xl p-6 border border-[var(--color-accent)]/30"
            >
              <h3 className="text-lg font-semibold mb-3 text-[var(--color-accent)]">
                Correct Diagnosis
              </h3>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                {currentCase.correctDiagnosis}
              </p>
              {currentCase.teachingPoints && currentCase.teachingPoints.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-accent)]/30">
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
                <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-inverse)] flex items-center gap-2">
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
                className="flex-1 bg-data-neutral-bg hover:bg-data-neutral-bg py-4 rounded-xl font-semibold text-[var(--color-text-inverse)]
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
                    communicationScore: gradeResult?.communicationScore,
                    differentialScore: gradeResult?.differentialScore,
                    dangerousActionsDetected: gradeResult?.dangerousActionsDetected,
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
                       text-[var(--color-text-inverse)] transition-colors border border-data-neutral flex items-center gap-2"
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
                         text-[var(--color-text-inverse)] transition-colors border border-data-neutral"
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
