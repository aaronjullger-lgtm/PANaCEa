// hooks/useEnhancedOSCE.ts
// Integration hook for Enhanced OSCE features

import { useState, useCallback, useRef, useMemo } from 'react';
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

import {
  generatePatientPersonality,
  initializeRapportMeter,
  initializeEmotionalState,
  generateInformationRules,
  processEnhancedInteraction,
  buildEnhancedPatientPrompt,
  analyzeQuestionType,
} from '@/services/patientPersonalityEngine';

import {
  OSCEScoringEngine,
  createScoringEngine,
} from '@/services/osceScoringEngine';

export interface UseEnhancedOSCEOptions {
  enablePersonality?: boolean;
  enableRapport?: boolean;
  enableScoring?: boolean;
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
  isSessionActive: boolean;
  currentPhase: 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';
}

export interface UseEnhancedOSCEReturn {
  state: EnhancedOSCEState;
  
  // Session management
  initializeSession: (caseData: PatientEncounterCase) => void;
  endSession: (finalDiagnosis?: string, differentials?: string[]) => OSCEScoreReport;
  generateScoreReport: (params: { diagnosisSubmitted?: string; treatmentPlan?: string; differentials?: string[] }) => OSCEScoreReport | null;
  
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
}

export function useEnhancedOSCE(options: UseEnhancedOSCEOptions = {}): UseEnhancedOSCEReturn {
  const {
    enablePersonality = true,
    enableRapport = true,
    enableScoring = true,
  } = options;
  
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
    isSessionActive: false,
    currentPhase: 'history',
  });
  
  // Refs
  const scoringEngineRef = useRef<OSCEScoringEngine | null>(null);
  const caseDataRef = useRef<PatientEncounterCase | null>(null);
  
  // Initialize session
  const initializeSession = useCallback((caseData: PatientEncounterCase) => {
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
    
    setState({
      personality,
      rapportMeter: initializeRapportMeter(),
      emotionalState,
      infoRules,
      orders: [],
      examFindings: [],
      chatHistory: [],
      scoreReport: null,
      isSessionActive: true,
      currentPhase: 'history',
    });
  }, [enablePersonality, enableScoring]);
  
  // End session and generate report
  const endSession = useCallback((finalDiagnosis?: string, differentials?: string[]) => {
    let report: OSCEScoreReport | null = null;
    
    if (scoringEngineRef.current) {
      report = scoringEngineRef.current.generateReport(finalDiagnosis, differentials);
    }
    
    setState(prev => ({
      ...prev,
      isSessionActive: false,
      scoreReport: report,
    }));
    
    return report!;
  }, []);
  
  // Process a chat message through the personality engine
  const processMessage = useCallback((message: string) => {
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
    setState(prev => ({
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
  }, [state.personality, state.emotionalState, state.rapportMeter, state.infoRules, state.currentPhase]);
  
  // Add chat message to history
  const addChatMessage = useCallback((message: EnhancedChatMessage) => {
    setState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, message],
    }));
  }, []);
  
  // Place an order
  const placeOrder = useCallback((order: PlacedOrder) => {
    setState(prev => ({
      ...prev,
      orders: [...prev.orders, order],
    }));
    
    // Track in scoring engine
    if (scoringEngineRef.current) {
      scoringEngineRef.current.trackOrder(order);
    }
  }, []);
  
  // Cancel an order
  const cancelOrder = useCallback((orderId: string) => {
    setState(prev => ({
      ...prev,
      orders: prev.orders.map(o => 
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
    setState(prev => ({
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
    setState(prev => ({ ...prev, currentPhase: phase }));
  }, []);
  
  // Get rapport score
  const getRapportScore = useCallback(() => state.rapportMeter.score, [state.rapportMeter.score]);
  
  // Get emotion icon
  const getEmotionIcon = useCallback(() => {
    if (!state.emotionalState) return '😐';
    switch (state.emotionalState.current) {
      case 'anxious': return '😰';
      case 'frustrated': return '😤';
      case 'tearful': return '😢';
      case 'angry': return '😠';
      case 'relieved': return '😌';
      default: return '😐';
    }
  }, [state.emotionalState]);
  
  // Get intermediate score
  const getIntermediateScore = useCallback(() => {
    if (!scoringEngineRef.current) return 0;
    const scores = scoringEngineRef.current.calculateCompetencyScores();
    return Math.round(
      (scores.history + scores.physicalExam + scores.diagnosticReasoning + 
       scores.treatment + scores.communication + scores.efficiency) / 6
    );
  }, []);
  
  // Generate score report (wrapper around endSession for more flexible API)
  const generateScoreReport = useCallback((params: { 
    diagnosisSubmitted?: string; 
    treatmentPlan?: string; 
    differentials?: string[] 
  }): OSCEScoreReport | null => {
    if (!scoringEngineRef.current) return null;
    return scoringEngineRef.current.generateReport(params.diagnosisSubmitted, params.differentials);
  }, []);
  
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
  };
}

export default useEnhancedOSCE;
