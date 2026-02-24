// hooks/useEnhancedOSCE.ts
// Integration hook for Enhanced OSCE features

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { PatientEncounterCase } from '@/types/drill-modes';
import type {
  PatientPersonalityMatrix,
  RapportMeter,
  EmotionalState,
  InformationControlRule,
  PlacedOrder,
  ExamFinding,
  OSCEScoreReport,
  EnhancedChatMessage,
  BodyRegion,
} from '@/types/osce-enhanced';
import { type VitalsDisplay, DEFAULT_VITALS } from '@/hooks/usePatientVitals';

import {
  generatePatientPersonality,
  initializeRapportMeter,
  initializeEmotionalState,
  generateInformationRules,
  processEnhancedInteraction,
  buildEnhancedPatientPrompt,
  analyzeQuestionType,
} from '@/services/domain';

import { OSCEScoringEngine, createScoringEngine } from '@/services/domain';

export interface UseEnhancedOSCEOptions {
  enablePersonality?: boolean;
  enableRapport?: boolean;
  enableScoring?: boolean;
  persistKey?: string;
}

export interface EnhancedOSCEState {
  personality: PatientPersonalityMatrix | null;
  rapportMeter: RapportMeter;
  emotionalState: EmotionalState | null;
  infoRules: InformationControlRule[];
  orders: PlacedOrder[];
  examFindings: ExamFinding[];
  chatHistory: EnhancedChatMessage[];
  scoreReport: OSCEScoreReport | null;
  vitals: VitalsDisplay;
  isSessionActive: boolean;
  currentPhase: 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';
}

export interface UseEnhancedOSCEReturn {
  state: EnhancedOSCEState;

  // Session management
  initializeSession: (caseData: PatientEncounterCase) => void;
  endSession: (finalDiagnosis?: string, differentials?: string[]) => OSCEScoreReport;
  generateScoreReport: (params: {
    diagnosisSubmitted?: string;
    treatmentPlan?: string;
    differentials?: string[];
  }) => OSCEScoreReport | null;

  // Chat/History
  processMessage: (message: string) => {
    updatedRapport: RapportMeter;
    nonVerbalCue: string | null;
    shouldRevealHidden: boolean;
    enhancedPrompt: string;
  };
  addChatMessage: (message: EnhancedChatMessage) => void;

  // Orders
  placeOrder: (order: PlacedOrder) => void;
  cancelOrder: (orderId: string) => void;
  getOrderAlerts: () => void;

  // Physical Exam
  recordExamFinding: (finding: ExamFinding) => void;
  getSuggestedExams: (chiefComplaint: string) => BodyRegion[];

  // Phase management
  setPhase: (phase: EnhancedOSCEState['currentPhase']) => void;

  // Rapport
  getRapportScore: () => number;
  getEmotionIcon: () => string;

  // Scoring
  getIntermediateScore: () => number;

  // Physiological interventions
  applyIntervention: (order: PlacedOrder) => void;
  timeTravel: (hours?: number) => void;
}

export function useEnhancedOSCE(options: UseEnhancedOSCEOptions = {}): UseEnhancedOSCEReturn {
  const { enablePersonality = true, enableRapport = true, enableScoring = true, persistKey } = options;

  // Persistence
  const storageKey = persistKey ? `panacea_osce_${persistKey}` : null;
  const hasRestoredRef = useRef(false);

  // State
  const [state, setState] = useState<EnhancedOSCEState>({
    personality: null,
    rapportMeter: initializeRapportMeter(),
    emotionalState: null,
    infoRules: [],
    orders: [],
    examFindings: [],
    chatHistory: [],
    scoreReport: null,
    vitals: DEFAULT_VITALS,
    isSessionActive: false,
    currentPhase: 'history',
  });

  // Refs
  const scoringEngineRef = useRef<OSCEScoringEngine | null>(null);
  const caseDataRef = useRef<PatientEncounterCase | null>(null);

  // Helper to convert case vitalSigns to VitalsDisplay
  const parseVitalsFromCase = (vitals: PatientEncounterCase['vitalSigns']): VitalsDisplay => {
    const bpMatch = vitals.bp.match(/^(\d+)\s*\/\s*(\d+)$/);
    const sbp = bpMatch ? parseInt(bpMatch[1], 10) : 120;
    const dbp = bpMatch ? parseInt(bpMatch[2], 10) : 80;
    return {
      hr: vitals.hr,
      sbp,
      dbp,
      rr: vitals.rr,
      o2: vitals.o2sat,
      bp: vitals.bp,
    };
  };

  // Mapping of drug class keywords to physiological effects
  const DRUG_EFFECTS = [
    {
      keywords: ['beta blocker', 'metoprolol', 'atenolol', 'propranolol'],
      effect: { hr: 0.85, sbp: 0.9, dbp: 0.9, rr: 1.0, o2: 1.0 },
    },
    {
      keywords: ['vasodilator', 'nitro', 'hydralazine', 'amlodipine'],
      effect: { hr: 1.0, sbp: 0.9, dbp: 0.9, rr: 1.0, o2: 1.0 },
    },
    {
      keywords: ['vasopressor', 'norepinephrine', 'epinephrine', 'phenylephrine'],
      effect: { hr: 1.1, sbp: 1.2, dbp: 1.15, rr: 1.0, o2: 1.0 },
    },
    {
      keywords: ['diuretic', 'furosemide', 'hydrochlorothiazide'],
      effect: { hr: 1.0, sbp: 0.95, dbp: 0.95, rr: 1.0, o2: 1.0 },
    },
  ];

  // Apply intervention (drug order) to vitals
  const applyIntervention = useCallback((order: PlacedOrder) => {
    if (order.category !== 'medications') return;
    const itemName = order.itemName.toLowerCase();
    const effect = DRUG_EFFECTS.find(e => e.keywords.some(kw => itemName.includes(kw)))?.effect;
    if (!effect) return;
    setState(prev => {
      const vitals = { ...prev.vitals };
      vitals.hr = Math.max(40, Math.round(vitals.hr * effect.hr));
      vitals.sbp = Math.max(90, Math.round(vitals.sbp * effect.sbp));
      vitals.dbp = Math.max(60, Math.round(vitals.dbp * effect.dbp));
      vitals.rr = Math.max(8, Math.round(vitals.rr * effect.rr));
      vitals.o2 = Math.max(80, Math.round(vitals.o2 * effect.o2));
      vitals.bp = `${vitals.sbp}/${vitals.dbp}`;
      return { ...prev, vitals };
    });
  }, []);

  // Simulate time passage (hours) and adjust vitals based on condition/interventions
  const timeTravel = useCallback((hours: number = 24) => {
    // Simple simulation: vitals tend to normalize slightly over time
    setState(prev => {
      const vitals = { ...prev.vitals };
      // Apply small random drift towards normal ranges
      const drift = (current: number, normal: number, maxChange: number) => {
        const diff = normal - current;
        const change = diff * 0.1 + (Math.random() * maxChange * 2 - maxChange);
        return Math.round(current + change);
      };
      const normal = DEFAULT_VITALS;
      vitals.hr = Math.max(40, Math.min(180, drift(vitals.hr, normal.hr, 5)));
      vitals.sbp = Math.max(90, Math.min(200, drift(vitals.sbp, normal.sbp, 10)));
      vitals.dbp = Math.max(60, Math.min(120, drift(vitals.dbp, normal.dbp, 8)));
      vitals.rr = Math.max(8, Math.min(40, drift(vitals.rr, normal.rr, 2)));
      vitals.o2 = Math.max(80, Math.min(100, drift(vitals.o2, normal.o2, 2)));
      vitals.bp = `${vitals.sbp}/${vitals.dbp}`;
      return { ...prev, vitals };
    });
  }, []);

  // Restore persisted session on mount
  useEffect(() => {
    if (!storageKey || hasRestoredRef.current) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version === 1 && data.caseData && data.state) {
          caseDataRef.current = data.caseData;
          setState(data.state);
          if (enableScoring) {
            scoringEngineRef.current = createScoringEngine(data.caseData);
          }
          hasRestoredRef.current = true;
        }
      }
    } catch (e) {
      console.warn('Failed to restore OSCE session', e);
    }
  }, [storageKey, enableScoring]);

  // Persist session state when active
  useEffect(() => {
    if (!storageKey || !caseDataRef.current) return;
    if (state.isSessionActive) {
      try {
        const data = {
          version: 1,
          caseData: caseDataRef.current,
          state,
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save OSCE session', e);
      }
    } else {
      // Clear storage when session ends
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, state, state.isSessionActive]);

  // Initialize session
  const initializeSession = useCallback(
    (caseData: PatientEncounterCase) => {
      caseDataRef.current = caseData;

      // Generate personality
      const personality = enablePersonality ? generatePatientPersonality() : null;

      // Initialize emotional state based on personality
      const emotionalState = personality ? initializeEmotionalState(personality) : null;

      // Generate information control rules
      const infoRules = personality ? generateInformationRules(personality) : [];

      // Initialize scoring engine
      if (enableScoring) {
        scoringEngineRef.current = createScoringEngine(caseData);
      }

      const vitals = parseVitalsFromCase(caseData.vitalSigns);
      setState({
        personality,
        rapportMeter: initializeRapportMeter(),
        emotionalState,
        infoRules,
        orders: [],
        examFindings: [],
        chatHistory: [],
        scoreReport: null,
        vitals,
        isSessionActive: true,
        currentPhase: 'history',
      });
    },
    [enablePersonality, enableScoring]
  );

  // End session and generate report
  const endSession = useCallback((finalDiagnosis?: string, differentials?: string[]) => {
    let report: OSCEScoreReport | null = null;

    if (scoringEngineRef.current) {
      report = scoringEngineRef.current.generateReport(finalDiagnosis, differentials);
    }

    setState((prev) => ({
      ...prev,
      isSessionActive: false,
      scoreReport: report,
    }));

    return report!;
  }, []);

  // Process a chat message through the personality engine
  const processMessage = useCallback(
    (message: string) => {
      if (!state.personality || !state.emotionalState) {
        return {
          updatedRapport: state.rapportMeter,
          nonVerbalCue: null,
          shouldRevealHidden: false,
          enhancedPrompt: '',
        };
      }

      // Process interaction
      const result = processEnhancedInteraction(
        message,
        state.personality,
        state.rapportMeter,
        state.emotionalState,
        state.infoRules
      );

      // Build enhanced prompt for AI
      const enhancedPrompt = buildEnhancedPatientPrompt(
        state.personality,
        result.updatedRapport.score,
        result.updatedEmotion,
        state.personality.hiddenAgenda !== 'none' && result.shouldRevealHidden
          ? [`Hidden agenda: ${state.personality.hiddenAgenda}`]
          : []
      );

      // Track question in scoring engine
      if (scoringEngineRef.current && state.currentPhase === 'history') {
        scoringEngineRef.current.trackQuestion(message, 'history');
      }

      // Update state
      setState((prev) => ({
        ...prev,
        rapportMeter: result.updatedRapport,
        emotionalState: result.updatedEmotion,
      }));

      return {
        updatedRapport: result.updatedRapport,
        nonVerbalCue: result.nonVerbalCue,
        shouldRevealHidden: result.shouldRevealHidden,
        enhancedPrompt,
      };
    },
    [
      state.personality,
      state.emotionalState,
      state.rapportMeter,
      state.infoRules,
      state.currentPhase,
    ]
  );

  // Add chat message to history
  const addChatMessage = useCallback((message: EnhancedChatMessage) => {
    setState((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, message],
    }));
  }, []);

  // Place an order
  const placeOrder = useCallback((order: PlacedOrder) => {
    setState((prev) => ({
      ...prev,
      orders: [...prev.orders, order],
    }));

    // Apply intervention if medication
    applyIntervention(order);

    // Track in scoring engine
    if (scoringEngineRef.current) {
      scoringEngineRef.current.trackOrder(order);
    }
  }, [applyIntervention]);

  // Cancel an order
  const cancelOrder = useCallback((orderId: string) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'cancelled' as const } : o
      ),
    }));
  }, []);

  // Get order alerts (placeholder)
  const getOrderAlerts = useCallback(() => {
    // Logic would check for duplicates, allergies, etc.
  }, []);

  // Record exam finding
  const recordExamFinding = useCallback((finding: ExamFinding) => {
    setState((prev) => ({
      ...prev,
      examFindings: [...prev.examFindings, finding],
    }));

    // Track in scoring engine
    if (scoringEngineRef.current) {
      scoringEngineRef.current.trackExam(finding);
    }
  }, []);

  // Get suggested exams based on chief complaint
  const getSuggestedExams = useCallback((chiefComplaint: string): BodyRegion[] => {
    const lower = chiefComplaint.toLowerCase();
    const suggestions: BodyRegion[] = [];

    if (/chest|heart|cardiac|breath|dyspnea/.test(lower)) {
      suggestions.push('heart', 'lungs', 'chest_anterior', 'neck');
    }
    if (/abdom|stomach|nausea|vomit|diarrhea|pain.*(belly|stomach)/.test(lower)) {
      suggestions.push('abdomen_ruq', 'abdomen_luq', 'abdomen_rlq', 'abdomen_llq');
    }
    if (/head|dizz|vision|eye/.test(lower)) {
      suggestions.push('head', 'eyes', 'neck');
    }
    if (/back|spine|lumbar/.test(lower)) {
      suggestions.push('back_upper', 'back_lower');
    }
    if (/leg|knee|hip|walk|gait/.test(lower)) {
      suggestions.push('leg_right', 'leg_left', 'neurological');
    }
    if (/arm|shoulder|hand|grip/.test(lower)) {
      suggestions.push('arm_right', 'arm_left', 'hand_right', 'hand_left');
    }
    if (/throat|swallow|neck|thyroid/.test(lower)) {
      suggestions.push('throat', 'neck');
    }

    // Always suggest basics
    if (!suggestions.includes('heart')) suggestions.push('heart');
    if (!suggestions.includes('lungs')) suggestions.push('lungs');

    return [...new Set(suggestions)];
  }, []);

  // Set current phase
  const setPhase = useCallback((phase: EnhancedOSCEState['currentPhase']) => {
    setState((prev) => ({ ...prev, currentPhase: phase }));
  }, []);

  // Get rapport score
  const getRapportScore = useCallback(() => state.rapportMeter.score, [state.rapportMeter.score]);

  // Get emotion icon
  const getEmotionIcon = useCallback(() => {
    if (!state.emotionalState) return '😐';
    switch (state.emotionalState.current) {
      case 'anxious':
        return '😰';
      case 'frustrated':
        return '😤';
      case 'tearful':
        return '😢';
      case 'angry':
        return '😠';
      case 'relieved':
        return '😌';
      default:
        return '😐';
    }
  }, [state.emotionalState]);

  // Get intermediate score
  const getIntermediateScore = useCallback(() => {
    if (!scoringEngineRef.current) return 0;
    const scores = scoringEngineRef.current.calculateCompetencyScores();
    return Math.round(
      (scores.history +
        scores.physicalExam +
        scores.diagnosticReasoning +
        scores.treatment +
        scores.communication +
        scores.efficiency) /
        6
    );
  }, []);

  // Generate score report (wrapper around endSession for more flexible API)
  const generateScoreReport = useCallback(
    (params: {
      diagnosisSubmitted?: string;
      treatmentPlan?: string;
      differentials?: string[];
    }): OSCEScoreReport | null => {
      if (!scoringEngineRef.current) return null;
      return scoringEngineRef.current.generateReport(
        params.diagnosisSubmitted,
        params.differentials
      );
    },
    []
  );

  return {
    state,
    initializeSession,
    endSession,
    generateScoreReport,
    processMessage,
    addChatMessage,
    placeOrder,
    cancelOrder,
    getOrderAlerts,
    recordExamFinding,
    getSuggestedExams,
    setPhase,
    getRapportScore,
    getEmotionIcon,
    getIntermediateScore,
    applyIntervention,
    timeTravel,
  };
}

export default useEnhancedOSCE;
