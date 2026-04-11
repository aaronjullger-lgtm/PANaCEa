/**
 * useEncounterReducer — consolidated state management for PatientEncounterMode.
 *
 * Replaces ~50 individual useState calls with a single useReducer.
 * Benefits:
 *   1. Batched state updates (React batches dispatch calls in the same event loop)
 *   2. Stable dispatch reference (never changes identity → safe for useCallback deps)
 *   3. Actions are serializable for debugging / time-travel
 *   4. Reducers are pure functions — easy to unit test
 *
 * Usage pattern: the hook returns [state, dispatch, actions] where `actions` is a
 * bag of pre-bound dispatch helpers that match the old setter signatures.
 */

import { useReducer, useCallback, useMemo } from 'react';
import type { PatientEncounterCase } from '@/types/drill-modes';
import type { OSCEScoreReport } from '@/types/osce-enhanced';
import type { AVState } from '@/types/patient-av-state-machine';
import type { PatientAVEngine } from '@/services/av/patientAVEngine';
import type { OSCEConditionSchedule } from '@/lib/osce-spaced-repetition';

// ---------------------------------------------------------------------------
// Type Aliases
// ---------------------------------------------------------------------------

export type ViewState = 'landing' | 'loading_encounter' | 'active' | 'results';
export type EncounterPhase = 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';
export type SpanishMode = 'english' | 'spanish' | 'side-by-side';
export type EmrTab = 'hpi' | 'pmh' | 'meds' | 'vitals' | 'labs';
export type AIDifficulty = 'cooperative' | 'difficult' | 'very_difficult';

export interface PatientPersona {
  name: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  [key: string]: unknown;
}

export interface EncounterSessionQuestion {
  questionText: string;
  response: string;
  category?: string;
  relevance?: string;
  timestamp?: number;
}

export interface EncounterSessionScore {
  overall: number;
  thoroughness: number;
  efficiency: number;
}

export interface EncounterSession {
  id: string;
  startTime: number;
  questions: EncounterSessionQuestion[];
  caseId?: string;
  score?: EncounterSessionScore;
}

export interface DiagnosisFeedback {
  isCorrect: boolean;
  feedback: string;
  score: number;
}

export interface PreceptorFeedback {
  [key: string]: unknown;
}

export interface OsceGradeResult {
  [key: string]: unknown;
}

export interface OsceStats {
  totalEncounters: number;
  passRate: number | null;
  averageScore: number | null;
  trend: number[];
}

export interface ConditionStats {
  total: number;
  due: number;
  mastered: number;
  struggling: number;
}

export interface PhysicalFinding {
  maneuver: string;
  finding: string;
}

export interface DiagnosticResult {
  testName: string;
  result: string;
  interpretation: string;
}

export interface PresetFilters {
  targetSystems?: string[];
  difficulty?: string;
}

// ---------------------------------------------------------------------------
// State Shape
// ---------------------------------------------------------------------------

export interface EncounterState {
  // Navigation
  viewState: ViewState;
  phase: EncounterPhase;
  isPaused: boolean;
  pausedMs: number;

  // Case / Session
  currentCase: PatientEncounterCase | null;
  session: EncounterSession | null;
  patientPersona: PatientPersona | null;
  secretDiagnosis: string | null;
  encounterStartTime: number;

  // User Input
  currentQuestion: string;
  examAction: string;
  diagnosticOrder: string;
  userDiagnosis: string;
  treatmentPlan: string;
  newDifferential: string;

  // Clinical Data
  physicalFindings: PhysicalFinding[];
  diagnosticResults: DiagnosticResult[];
  differentialDiagnoses: string[];

  // Loading / Status
  isLoading: boolean;
  isTyping: boolean;
  loadingStatusIndex: number;
  typingStatusIndex: number;
  languageMode: SpanishMode;
  loadError: string | null;

  // Feedback / Results
  diagnosisFeedback: DiagnosisFeedback | null;
  treatmentFeedback: DiagnosisFeedback | null;
  aar: string;
  isPatientInfoExpanded: boolean;
  preceptorFeedback: PreceptorFeedback | null;
  streamedDebriefText: string;
  isStreamingDebrief: boolean;
  enhancedScoreReport: OSCEScoreReport | null;
  gradeResult: OsceGradeResult | null;
  gradeResultLoading: boolean;

  // UI Panels
  showOrderPanel: boolean;
  showExamPanel: boolean;
  showRapportMeter: boolean;
  showLiveSession: boolean;
  showHistoryPanel: boolean;
  emrTab: EmrTab;

  // Settings / Modifiers
  enableCulturalCompetency: boolean;
  enableResourceLimited: boolean;
  aiDifficulty: AIDifficulty;
  presetFilters: PresetFilters | null;

  // Landing Page
  dueConditions: OSCEConditionSchedule[];
  conditionStats: ConditionStats | null;
  osceStats: OsceStats | null;

  // AV Engine
  avEngine: PatientAVEngine | null;
  currentAVState: AVState | null;
  wsUrl: string | null;
  voiceMode: boolean;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Generic "set field" action — covers the majority of simple setter calls */
type SetFieldAction<K extends keyof EncounterState> = {
  type: 'SET_FIELD';
  field: K;
  value: EncounterState[K];
};

/** Batch multiple fields at once (e.g., starting an encounter sets case + session + viewState) */
type SetFieldsAction = {
  type: 'SET_FIELDS';
  payload: Partial<EncounterState>;
};

/** Append to an array field */
type AppendAction<K extends keyof EncounterState> = {
  type: 'APPEND';
  field: K;
  item: EncounterState[K] extends Array<infer U> ? U : never;
};

/** Updater function pattern (like setState(prev => ...)) */
type UpdateFieldAction<K extends keyof EncounterState> = {
  type: 'UPDATE_FIELD';
  field: K;
  updater: (prev: EncounterState[K]) => EncounterState[K];
};

/** Reset to initial state (e.g., when exiting to landing) */
type ResetAction = {
  type: 'RESET';
  /** Fields to preserve (e.g., landing page data) */
  preserve?: (keyof EncounterState)[];
};

export type EncounterAction =
  | SetFieldAction<keyof EncounterState>
  | SetFieldsAction
  | AppendAction<keyof EncounterState>
  | UpdateFieldAction<keyof EncounterState>
  | ResetAction;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

export const INITIAL_ENCOUNTER_STATE: EncounterState = {
  viewState: 'landing',
  phase: 'history',
  isPaused: false,
  pausedMs: 0,
  currentCase: null,
  session: null,
  patientPersona: null,
  secretDiagnosis: null,
  encounterStartTime: Date.now(),
  currentQuestion: '',
  examAction: '',
  diagnosticOrder: '',
  userDiagnosis: '',
  treatmentPlan: '',
  newDifferential: '',
  physicalFindings: [],
  diagnosticResults: [],
  differentialDiagnoses: [],
  isLoading: false,
  isTyping: false,
  loadingStatusIndex: 0,
  typingStatusIndex: 0,
  languageMode: 'english',
  loadError: null,
  diagnosisFeedback: null,
  treatmentFeedback: null,
  aar: '',
  isPatientInfoExpanded: true,
  preceptorFeedback: null,
  streamedDebriefText: '',
  isStreamingDebrief: false,
  enhancedScoreReport: null,
  gradeResult: null,
  gradeResultLoading: false,
  showOrderPanel: false,
  showExamPanel: false,
  showRapportMeter: true,
  showLiveSession: false,
  showHistoryPanel: false,
  emrTab: 'hpi',
  enableCulturalCompetency: false,
  enableResourceLimited: false,
  aiDifficulty: 'cooperative',
  presetFilters: null,
  dueConditions: [],
  conditionStats: null,
  osceStats: null,
  avEngine: null,
  currentAVState: null,
  wsUrl: null,
  voiceMode: false,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function encounterReducer(state: EncounterState, action: EncounterAction): EncounterState {
  switch (action.type) {
    case 'SET_FIELD':
      if (state[action.field] === action.value) return state; // Skip no-op
      return { ...state, [action.field]: action.value };

    case 'SET_FIELDS':
      return { ...state, ...action.payload };

    case 'APPEND': {
      const arr = state[action.field];
      if (!Array.isArray(arr)) return state;
      return { ...state, [action.field]: [...arr, action.item] };
    }

    case 'UPDATE_FIELD': {
      const newValue = action.updater(state[action.field]);
      if (newValue === state[action.field]) return state;
      return { ...state, [action.field]: newValue };
    }

    case 'RESET': {
      if (!action.preserve?.length) return { ...INITIAL_ENCOUNTER_STATE, encounterStartTime: Date.now() };
      const preserved: Partial<EncounterState> = {};
      for (const key of action.preserve) {
        (preserved as Record<string, unknown>)[key] = state[key];
      }
      return { ...INITIAL_ENCOUNTER_STATE, encounterStartTime: Date.now(), ...preserved };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns [state, dispatch, actions].
 *
 * `actions` wraps dispatch into setter-style helpers that match the old useState
 * API so callers can migrate incrementally without touching every JSX callback.
 */
export function useEncounterReducer() {
  const [state, dispatch] = useReducer(encounterReducer, INITIAL_ENCOUNTER_STATE);

  // ---- Convenience setter factory (stable ref via dispatch) ----
  const set = useCallback(
    <K extends keyof EncounterState>(field: K) =>
      (value: EncounterState[K] | ((prev: EncounterState[K]) => EncounterState[K])) => {
        if (typeof value === 'function') {
          dispatch({
            type: 'UPDATE_FIELD',
            field,
            updater: value as (prev: EncounterState[K]) => EncounterState[K],
          });
        } else {
          dispatch({ type: 'SET_FIELD', field, value });
        }
      },
    [],
  );

  // ---- Pre-built setters (stable identity — dispatch never changes) ----
  const actions = useMemo(
    () => ({
      // Navigation
      setViewState: set('viewState'),
      setPhase: set('phase'),
      setIsPaused: set('isPaused'),
      setPausedMs: set('pausedMs'),

      // Case / Session
      setCurrentCase: set('currentCase'),
      setSession: set('session'),
      setPatientPersona: set('patientPersona'),
      setSecretDiagnosis: set('secretDiagnosis'),
      setEncounterStartTime: set('encounterStartTime'),

      // User Input
      setCurrentQuestion: set('currentQuestion'),
      setExamAction: set('examAction'),
      setDiagnosticOrder: set('diagnosticOrder'),
      setUserDiagnosis: set('userDiagnosis'),
      setTreatmentPlan: set('treatmentPlan'),
      setNewDifferential: set('newDifferential'),

      // Clinical Data
      setPhysicalFindings: set('physicalFindings'),
      setDiagnosticResults: set('diagnosticResults'),
      setDifferentialDiagnoses: set('differentialDiagnoses'),

      // Loading / Status
      setIsLoading: set('isLoading'),
      setIsTyping: set('isTyping'),
      setLoadingStatusIndex: set('loadingStatusIndex'),
      setTypingStatusIndex: set('typingStatusIndex'),
      setLanguageMode: set('languageMode'),
      setLoadError: set('loadError'),

      // Feedback / Results
      setDiagnosisFeedback: set('diagnosisFeedback'),
      setTreatmentFeedback: set('treatmentFeedback'),
      setAar: set('aar'),
      setIsPatientInfoExpanded: set('isPatientInfoExpanded'),
      setPreceptorFeedback: set('preceptorFeedback'),
      setStreamedDebriefText: set('streamedDebriefText'),
      setIsStreamingDebrief: set('isStreamingDebrief'),
      setEnhancedScoreReport: set('enhancedScoreReport'),
      setGradeResult: set('gradeResult'),
      setGradeResultLoading: set('gradeResultLoading'),

      // UI Panels
      setShowOrderPanel: set('showOrderPanel'),
      setShowExamPanel: set('showExamPanel'),
      setShowRapportMeter: set('showRapportMeter'),
      setShowLiveSession: set('showLiveSession'),
      setShowHistoryPanel: set('showHistoryPanel'),
      setEmrTab: set('emrTab'),

      // Settings / Modifiers
      setEnableCulturalCompetency: set('enableCulturalCompetency'),
      setEnableResourceLimited: set('enableResourceLimited'),
      setAiDifficulty: set('aiDifficulty'),
      setPresetFilters: set('presetFilters'),

      // Landing Page
      setDueConditions: set('dueConditions'),
      setConditionStats: set('conditionStats'),
      setOsceStats: set('osceStats'),

      // AV Engine
      setAVEngine: set('avEngine'),
      setCurrentAVState: set('currentAVState'),
      setWsUrl: set('wsUrl'),
      setVoiceMode: set('voiceMode'),

      // Batch helpers
      setFields: (payload: Partial<EncounterState>) =>
        dispatch({ type: 'SET_FIELDS', payload }),
      reset: (preserve?: (keyof EncounterState)[]) =>
        dispatch({ type: 'RESET', preserve }),
    }),
    [set],
  );

  return [state, dispatch, actions] as const;
}
