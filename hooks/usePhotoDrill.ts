// hooks/usePhotoDrill.ts
// Phase 3: Mock Logic - Custom hook for photo drill functionality

import { useReducer, useCallback, useEffect, useState } from "react";
import type {
  DrillSession,
  DrillSessionState,
  DrillSessionAction,
  PhotoDrillQuestion,
  DiagnosisOption,
  ConfusionMap,
  AnsweredQuestion,
  InputMode,
  PhotoDrillFilters,
  MediaAsset,
  MediaType,
} from "../types/photoMode";
import type { SystemCode } from "../types";

// ============================================
// MOCK DATA
// ============================================

/** Mock medical diagnoses for generating questions */
const MOCK_DIAGNOSES: DiagnosisOption[] = [
  // Cardiovascular - ECG
  {
    id: "afib",
    name: "Atrial Fibrillation",
    keyFeatures: ["Irregularly irregular rhythm", "Absent P waves", "Fibrillatory baseline"],
    system: "CV",
    subcategory: "ECG",
  },
  {
    id: "aflutter",
    name: "Atrial Flutter",
    keyFeatures: ["Sawtooth flutter waves", "Regular atrial rate ~300", "Variable AV block"],
    system: "CV",
    subcategory: "ECG",
  },
  {
    id: "vfib",
    name: "Ventricular Fibrillation",
    keyFeatures: ["Chaotic rhythm", "No identifiable QRS", "Disorganized electrical activity"],
    system: "CV",
    subcategory: "ECG",
  },
  {
    id: "stemi",
    name: "STEMI (Anterior)",
    keyFeatures: ["ST elevation in V1-V4", "Reciprocal ST depression", "Hyperacute T waves"],
    system: "CV",
    subcategory: "ECG",
  },
  {
    id: "wpw",
    name: "Wolff-Parkinson-White",
    keyFeatures: ["Short PR interval", "Delta wave", "Wide QRS complex"],
    system: "CV",
    subcategory: "ECG",
  },
  // Dermatology
  {
    id: "melanoma",
    name: "Melanoma",
    keyFeatures: ["Asymmetry", "Border irregularity", "Color variation", "Diameter >6mm"],
    system: "DERM",
    subcategory: "Oncology",
  },
  {
    id: "psoriasis",
    name: "Psoriasis",
    keyFeatures: ["Silvery scales", "Well-demarcated plaques", "Auspitz sign"],
    system: "DERM",
    subcategory: "Inflammatory",
  },
  {
    id: "eczema",
    name: "Atopic Dermatitis",
    keyFeatures: ["Erythematous patches", "Pruritic", "Flexural distribution"],
    system: "DERM",
    subcategory: "Inflammatory",
  },
  {
    id: "bcc",
    name: "Basal Cell Carcinoma",
    keyFeatures: ["Pearly papule", "Telangiectasia", "Rolled borders"],
    system: "DERM",
    subcategory: "Oncology",
  },
  {
    id: "shingles",
    name: "Herpes Zoster",
    keyFeatures: ["Dermatomal distribution", "Vesicular lesions", "Unilateral"],
    system: "DERM",
    subcategory: "Infectious",
  },
  // Pulmonary - X-ray
  {
    id: "pneumothorax",
    name: "Pneumothorax",
    keyFeatures: ["Absent lung markings", "Visible pleural line", "Mediastinal shift"],
    system: "PULM",
    subcategory: "Pleural Disease",
  },
  {
    id: "lobar-pneumonia",
    name: "Lobar Pneumonia",
    keyFeatures: ["Consolidation", "Air bronchograms", "Lobar distribution"],
    system: "PULM",
    subcategory: "Infectious",
  },
  {
    id: "chf-xray",
    name: "Pulmonary Edema (CHF)",
    keyFeatures: ["Cardiomegaly", "Kerley B lines", "Cephalization", "Bat-wing pattern"],
    system: "PULM",
    subcategory: "Pulmonary Circulation",
  },
  {
    id: "pleural-effusion",
    name: "Pleural Effusion",
    keyFeatures: ["Blunted costophrenic angle", "Meniscus sign", "Layering on decubitus"],
    system: "PULM",
    subcategory: "Pleural Disease",
  },
  // MSK - X-ray
  {
    id: "colles",
    name: "Colles Fracture",
    keyFeatures: ["Distal radius fracture", "Dorsal angulation", "Dinner fork deformity"],
    system: "MSK",
    subcategory: "Trauma/Fracture",
  },
  {
    id: "scaphoid-fx",
    name: "Scaphoid Fracture",
    keyFeatures: ["Waist fracture line", "Anatomical snuffbox tenderness", "May be occult"],
    system: "MSK",
    subcategory: "Trauma/Fracture",
  },
  // HEENT
  {
    id: "acute-glaucoma",
    name: "Acute Angle-Closure Glaucoma",
    keyFeatures: ["Mid-dilated fixed pupil", "Corneal haze", "Red eye"],
    system: "HEENT",
    subcategory: "Eye – Glaucoma",
  },
  {
    id: "retinal-detachment",
    name: "Retinal Detachment",
    keyFeatures: ["Curtain-like shadow", "Floaters", "Photopsia"],
    system: "HEENT",
    subcategory: "Eye – Retina",
  },
];

/** Mock media assets - using placeholder URLs */
const MOCK_MEDIA: MediaAsset[] = [
  {
    id: "ecg-afib-001",
    url: "https://placehold.co/800x400/1a1a2e/eee?text=ECG:+Atrial+Fibrillation",
    thumbnailUrl: "https://placehold.co/200x100/1a1a2e/eee?text=ECG:+AFib",
    type: "ecg",
    source: "Mock Medical Images",
    altText: "12-lead ECG showing irregular rhythm",
    system: "CV",
    subcategory: "ECG",
  },
  {
    id: "ecg-stemi-001",
    url: "https://placehold.co/800x400/1a1a2e/eee?text=ECG:+Anterior+STEMI",
    thumbnailUrl: "https://placehold.co/200x100/1a1a2e/eee?text=ECG:+STEMI",
    type: "ecg",
    source: "Mock Medical Images",
    altText: "12-lead ECG showing ST elevation",
    system: "CV",
    subcategory: "ECG",
  },
  {
    id: "ecg-aflutter-001",
    url: "https://placehold.co/800x400/1a1a2e/eee?text=ECG:+Atrial+Flutter",
    thumbnailUrl: "https://placehold.co/200x100/1a1a2e/eee?text=ECG:+Flutter",
    type: "ecg",
    source: "Mock Medical Images",
    altText: "12-lead ECG showing sawtooth pattern",
    system: "CV",
    subcategory: "ECG",
  },
  {
    id: "derm-melanoma-001",
    url: "https://placehold.co/600x600/1a1a2e/eee?text=Derm:+Melanoma",
    thumbnailUrl: "https://placehold.co/150x150/1a1a2e/eee?text=Melanoma",
    type: "derm",
    source: "Mock Medical Images",
    altText: "Skin lesion with irregular borders and color variation",
    system: "DERM",
    subcategory: "Oncology",
  },
  {
    id: "derm-psoriasis-001",
    url: "https://placehold.co/600x600/1a1a2e/eee?text=Derm:+Psoriasis",
    thumbnailUrl: "https://placehold.co/150x150/1a1a2e/eee?text=Psoriasis",
    type: "derm",
    source: "Mock Medical Images",
    altText: "Well-demarcated plaque with silvery scales",
    system: "DERM",
    subcategory: "Inflammatory",
  },
  {
    id: "xray-pneumothorax-001",
    url: "https://placehold.co/800x800/1a1a2e/eee?text=CXR:+Pneumothorax",
    thumbnailUrl: "https://placehold.co/200x200/1a1a2e/eee?text=PTX",
    type: "xray",
    source: "Mock Medical Images",
    altText: "Chest X-ray showing absent lung markings",
    system: "PULM",
    subcategory: "Pleural Disease",
  },
  {
    id: "xray-lobar-pneumonia-001",
    url: "https://placehold.co/800x800/1a1a2e/eee?text=CXR:+Lobar+Pneumonia",
    thumbnailUrl: "https://placehold.co/200x200/1a1a2e/eee?text=PNA",
    type: "xray",
    source: "Mock Medical Images",
    altText: "Chest X-ray showing consolidation",
    system: "PULM",
    subcategory: "Infectious",
  },
  {
    id: "xray-colles-001",
    url: "https://placehold.co/600x800/1a1a2e/eee?text=XR:+Colles+Fracture",
    thumbnailUrl: "https://placehold.co/150x200/1a1a2e/eee?text=Colles",
    type: "xray",
    source: "Mock Medical Images",
    altText: "Wrist X-ray showing distal radius fracture",
    system: "MSK",
    subcategory: "Trauma/Fracture",
  },
];

/** Map of correct diagnoses to their media assets */
const MEDIA_DIAGNOSIS_MAP: Record<string, string> = {
  "ecg-afib-001": "afib",
  "ecg-stemi-001": "stemi",
  "ecg-aflutter-001": "aflutter",
  "derm-melanoma-001": "melanoma",
  "derm-psoriasis-001": "psoriasis",
  "xray-pneumothorax-001": "pneumothorax",
  "xray-lobar-pneumonia-001": "lobar-pneumonia",
  "xray-colles-001": "colles",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get random distractors for a given correct diagnosis
 */
function getRandomDistractors(
  correctDiagnosis: DiagnosisOption,
  count: number = 3
): DiagnosisOption[] {
  // Get diagnoses from the same system first (more challenging)
  const sameSystemDiagnoses = MOCK_DIAGNOSES.filter(
    (d) => d.system === correctDiagnosis.system && d.id !== correctDiagnosis.id
  );
  
  // Get diagnoses from other systems
  const otherSystemDiagnoses = MOCK_DIAGNOSES.filter(
    (d) => d.system !== correctDiagnosis.system
  );
  
  // Prioritize same-system distractors
  const shuffledSameSystem = shuffleArray(sameSystemDiagnoses);
  const shuffledOtherSystem = shuffleArray(otherSystemDiagnoses);
  
  const distractors: DiagnosisOption[] = [];
  
  // Add same-system distractors first
  for (const d of shuffledSameSystem) {
    if (distractors.length >= count) break;
    distractors.push(d);
  }
  
  // Fill remaining with other-system distractors
  for (const d of shuffledOtherSystem) {
    if (distractors.length >= count) break;
    distractors.push(d);
  }
  
  return distractors;
}

/**
 * Generate a mock photo drill question
 */
function generateMockQuestion(filters?: PhotoDrillFilters): PhotoDrillQuestion {
  // Filter media based on provided filters
  let availableMedia = [...MOCK_MEDIA];
  
  if (filters?.system) {
    availableMedia = availableMedia.filter((m) => m.system === filters.system);
  }
  
  if (filters?.mediaType) {
    availableMedia = availableMedia.filter((m) => m.type === filters.mediaType);
  }
  
  // Pick a random media asset
  if (availableMedia.length === 0) {
    availableMedia = [...MOCK_MEDIA]; // Fallback to all media
  }
  
  const randomMedia = availableMedia[Math.floor(Math.random() * availableMedia.length)];
  
  // Get the correct diagnosis for this media
  const correctDiagnosisId = MEDIA_DIAGNOSIS_MAP[randomMedia.id];
  const correctDiagnosis = MOCK_DIAGNOSES.find((d) => d.id === correctDiagnosisId);
  
  if (!correctDiagnosis) {
    // Fallback if mapping is missing
    throw new Error(`No diagnosis found for media ${randomMedia.id}`);
  }
  
  // Get random distractors
  const distractors = getRandomDistractors(correctDiagnosis, 3);
  
  return {
    id: generateId(),
    media: randomMedia,
    correctDiagnosis: {
      ...correctDiagnosis,
      rationale: `This image shows classic features of ${correctDiagnosis.name}: ${correctDiagnosis.keyFeatures.join(", ")}.`,
    },
    distractors: distractors.map((d) => ({
      ...d,
      rationale: `This is NOT ${d.name} because the image lacks: ${d.keyFeatures[0]}.`,
    })),
    difficulty: filters?.difficulty || Math.floor(Math.random() * 3) + 1,
  };
}

// ============================================
// REDUCER
// ============================================

function createInitialSession(): DrillSession {
  return {
    id: generateId(),
    state: "view",
    currentQuestion: null,
    answeredQuestions: [],
    confusionMap: {},
    startedAt: Date.now(),
    score: { correct: 0, total: 0 },
    inputMode: "multiple-choice",
  };
}

function drillSessionReducer(
  state: DrillSession,
  action: DrillSessionAction
): DrillSession {
  switch (action.type) {
    case "LOAD_QUESTION":
      return {
        ...state,
        state: "view",
        currentQuestion: action.payload,
      };

    case "START_ANSWERING":
      return {
        ...state,
        state: "answering",
      };

    case "SUBMIT_ANSWER": {
      const { answer, timeTaken } = action.payload;
      const currentQuestion = state.currentQuestion;
      
      if (!currentQuestion) return state;
      
      const isCorrect = answer.id === currentQuestion.correctDiagnosis.id;
      
      const answeredQuestion: AnsweredQuestion = {
        question: currentQuestion,
        userAnswer: answer,
        isCorrect,
        timeTaken,
        answeredAt: Date.now(),
      };
      
      // Update confusion map if incorrect
      let newConfusionMap = { ...state.confusionMap };
      if (!isCorrect) {
        const realId = currentQuestion.correctDiagnosis.id;
        const existingEntries = newConfusionMap[realId] || [];
        newConfusionMap[realId] = [
          ...existingEntries,
          {
            mistakenId: answer.id,
            mistakenName: answer.name,
            timestamp: Date.now(),
            questionId: currentQuestion.id,
          },
        ];
      }
      
      return {
        ...state,
        state: isCorrect ? "feedback" : "ddx_comparison",
        answeredQuestions: [...state.answeredQuestions, answeredQuestion],
        confusionMap: newConfusionMap,
        score: {
          correct: state.score.correct + (isCorrect ? 1 : 0),
          total: state.score.total + 1,
        },
      };
    }

    case "SHOW_DDX_COMPARISON":
      return {
        ...state,
        state: "ddx_comparison",
      };

    case "NEXT_QUESTION":
      return {
        ...state,
        state: "view",
        currentQuestion: null,
      };

    case "SET_INPUT_MODE":
      return {
        ...state,
        inputMode: action.payload,
      };

    case "RESET_SESSION":
      return createInitialSession();

    default:
      return state;
  }
}

// ============================================
// HOOK
// ============================================

export interface UsePhotoDrillOptions {
  filters?: PhotoDrillFilters;
  autoLoadFirst?: boolean;
}

export interface UsePhotoDrillReturn {
  // Session state
  session: DrillSession;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadNextQuestion: () => Promise<void>;
  startAnswering: () => void;
  submitAnswer: (answer: DiagnosisOption, timeTaken: number) => void;
  proceedToNext: () => void;
  setInputMode: (mode: InputMode) => void;
  resetSession: () => void;
  
  // Computed
  allDiagnoses: DiagnosisOption[];
  currentOptions: DiagnosisOption[];
}

export function usePhotoDrill(options: UsePhotoDrillOptions = {}): UsePhotoDrillReturn {
  const { filters, autoLoadFirst = true } = options;
  
  const [session, dispatch] = useReducer(drillSessionReducer, null, createInitialSession);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Mock API call to fetch next image
   */
  const loadNextQuestion = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const question = generateMockQuestion(filters);
      dispatch({ type: "LOAD_QUESTION", payload: question });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load question");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);
  
  /**
   * Start the answering phase
   */
  const startAnswering = useCallback(() => {
    dispatch({ type: "START_ANSWERING" });
  }, []);
  
  /**
   * Submit an answer
   */
  const submitAnswer = useCallback((answer: DiagnosisOption, timeTaken: number) => {
    dispatch({ type: "SUBMIT_ANSWER", payload: { answer, timeTaken } });
  }, []);
  
  /**
   * Proceed to next question
   */
  const proceedToNext = useCallback(() => {
    dispatch({ type: "NEXT_QUESTION" });
  }, []);
  
  /**
   * Set input mode
   */
  const setInputMode = useCallback((mode: InputMode) => {
    dispatch({ type: "SET_INPUT_MODE", payload: mode });
  }, []);
  
  /**
   * Reset the session
   */
  const resetSession = useCallback(() => {
    dispatch({ type: "RESET_SESSION" });
  }, []);
  
  /**
   * Get shuffled answer options for current question
   */
  const currentOptions = (() => {
    if (!session.currentQuestion) return [];
    const { correctDiagnosis, distractors } = session.currentQuestion;
    return shuffleArray([correctDiagnosis, ...distractors]);
  })();
  
  // Auto-load first question on mount
  useEffect(() => {
    if (autoLoadFirst && !session.currentQuestion && !isLoading) {
      loadNextQuestion();
    }
  }, [autoLoadFirst, session.currentQuestion, isLoading, loadNextQuestion]);
  
  return {
    session,
    isLoading,
    error,
    loadNextQuestion,
    startAnswering,
    submitAnswer,
    proceedToNext,
    setInputMode,
    resetSession,
    allDiagnoses: MOCK_DIAGNOSES,
    currentOptions,
  };
}

export default usePhotoDrill;
