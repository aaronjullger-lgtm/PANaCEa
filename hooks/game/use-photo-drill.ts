import { useState, useCallback, useMemo, useRef } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Clinical presentation data for derm/clinical mode
 */
export interface ClinicalPresentationData {
  /** Patient age */
  age: number;
  /** Patient sex */
  sex: 'M' | 'F';
  /** Chief complaint */
  chiefComplaint: string;
  /** Brief history */
  history: string;
  /** Vital signs */
  vitals: {
    bp: string;
    hr: string;
    temp: string;
    rr: string;
    o2: string;
  };
  /** Key physical exam findings (shown before image) */
  physicalExam: string[];
}

/**
 * Represents a single photo case in the drill.
 */
export interface PhotoCase {
  /** Unique identifier for the case */
  id: string;
  /** URL to the case image */
  imageUrl: string;
  /** The imaging modality type */
  modality: 'ecg' | 'xray' | 'derm';
  /** The correct diagnosis for this case */
  correctDiagnosis: string;
  /** Array of distractor (incorrect) diagnoses */
  distractors: string[];
  /** Explanation shown after answering */
  explanation: string;
  /** Clinical presentation data for derm/clinical mode */
  clinicalPresentation?: ClinicalPresentationData;
}

/**
 * Represents the current state of the game.
 * - 'menu': User is selecting a category in the lobby
 * - 'playing': Actively drilling with infinite queue
 * - 'feedback': Showing feedback for the last answer
 * - 'summary': Session complete
 */
export type GameStatus = 'menu' | 'playing' | 'feedback' | 'summary';

/**
 * @deprecated Use GameStatus instead.
 * Migration: 'loading' → 'menu', 'active' → 'playing'.
 * The 'feedback' and 'summary' states remain unchanged.
 */
export type GameState = 'loading' | 'active' | 'feedback' | 'summary';

/** Category types for training modules */
export type CategoryType = 'ecg' | 'derm' | 'radiology' | 'random' | null;

// ============================================================================
// MASTER CONDITION LIST
// ============================================================================

/**
 * Master list of medical conditions used for both case generation and search.
 * This ensures the user can always find the answer in the type-ahead search.
 */
export const MASTER_CONDITION_LIST: string[] = [
  // Cardiac / ECG
  'Atrial Fibrillation',
  'Atrial Flutter',
  'Ventricular Tachycardia',
  'STEMI',
  'NSTEMI',
  'Pericarditis',
  'Sinus Bradycardia',
  'Heart Block',
  'Hyperkalemia',
  'Wolff-Parkinson-White Syndrome',
  // Dermatology
  'Psoriasis',
  'Eczema',
  'Shingles',
  'Contact Dermatitis',
  'Cellulitis',
  'Melanoma',
  'Basal Cell Carcinoma',
  'Impetigo',
  // Radiology (includes MSK imaging)
  'Pneumothorax',
  'Pneumonia',
  'Pulmonary Embolism',
  'Pleural Effusion',
  'Cardiomegaly',
  'Rib Fracture',
  'Gout',
  'Rheumatoid Arthritis',
];

// ============================================================================
// CATEGORY-SPECIFIC CONDITION MAPPINGS
// ============================================================================

const ECG_CONDITIONS = [
  'Atrial Fibrillation',
  'Atrial Flutter',
  'Ventricular Tachycardia',
  'STEMI',
  'NSTEMI',
  'Pericarditis',
  'Sinus Bradycardia',
  'Heart Block',
  'Hyperkalemia',
  'Wolff-Parkinson-White Syndrome',
];

const DERM_CONDITIONS = [
  'Psoriasis',
  'Eczema',
  'Shingles',
  'Contact Dermatitis',
  'Cellulitis',
  'Melanoma',
  'Basal Cell Carcinoma',
  'Impetigo',
];

const RADIOLOGY_CONDITIONS = [
  'Pneumothorax',
  'Pneumonia',
  'Pulmonary Embolism',
  'Pleural Effusion',
  'Cardiomegaly',
  'Rib Fracture',
  'Gout',
  'Rheumatoid Arthritis',
];

// ============================================================================
// CLINICAL PRESENTATION DATA FOR DERM CONDITIONS
// ============================================================================

/**
 * Clinical presentation templates for each derm condition.
 * These provide realistic patient presentations to synthesize clinical clues.
 */
const CLINICAL_PRESENTATIONS: Record<string, ClinicalPresentationData> = {
  'Psoriasis': {
    age: 35,
    sex: 'M',
    chiefComplaint: 'Itchy, scaly patches on elbows and knees',
    history: 'Symptoms worsened over past 2 months. Family history of psoriasis in mother. Recent stressful period at work. Tried OTC moisturizers without relief.',
    vitals: { bp: '122/78', hr: '72', temp: '98.6°F', rr: '16', o2: '99%' },
    physicalExam: [
      'Well-demarcated erythematous plaques',
      'Silvery-white scales on extensor surfaces',
      'Nail pitting on several fingers',
      'No joint swelling or tenderness',
    ],
  },
  'Eczema': {
    age: 8,
    sex: 'F',
    chiefComplaint: 'Intensely itchy rash in elbow and knee creases',
    history: 'History of allergies and asthma. Symptoms worse in winter. Parents note child scratches frequently at night. Uses fragrance-free soap.',
    vitals: { bp: '100/65', hr: '88', temp: '98.4°F', rr: '18', o2: '99%' },
    physicalExam: [
      'Erythematous, lichenified patches in flexural areas',
      'Excoriations from scratching',
      'Dry skin (xerosis) generalized',
      'No vesicles or pustules',
    ],
  },
  'Shingles': {
    age: 68,
    sex: 'F',
    chiefComplaint: 'Painful rash on right side of chest for 3 days',
    history: 'Burning pain preceded rash by 2 days. Had chickenpox as a child. Recently completed chemotherapy. Not vaccinated for shingles.',
    vitals: { bp: '138/82', hr: '78', temp: '99.2°F', rr: '16', o2: '98%' },
    physicalExam: [
      'Grouped vesicles on erythematous base',
      'Unilateral distribution following T4-T5 dermatome',
      'Does not cross midline',
      'Tender to light touch (allodynia)',
    ],
  },
  'Contact Dermatitis': {
    age: 42,
    sex: 'M',
    chiefComplaint: 'Itchy red rash on hands after gardening',
    history: 'Rash developed 24-48 hours after pulling weeds in backyard. Similar episode last summer. Works as office manager, gardens on weekends.',
    vitals: { bp: '118/74', hr: '68', temp: '98.4°F', rr: '14', o2: '99%' },
    physicalExam: [
      'Erythematous papules and vesicles in linear pattern',
      'Sharp demarcation at wrist (glove line)',
      'Weeping and crusting in some areas',
      'Pruritus without systemic symptoms',
    ],
  },
  'Cellulitis': {
    age: 55,
    sex: 'M',
    chiefComplaint: 'Painful, red, swollen right leg for 2 days',
    history: 'Diabetes mellitus type 2, poorly controlled (A1c 9.2%). Noticed small cut on foot last week. Increasing redness spreading up leg. Fever and chills.',
    vitals: { bp: '142/88', hr: '98', temp: '101.2°F', rr: '18', o2: '97%' },
    physicalExam: [
      'Warm, erythematous area on anterior lower leg',
      'Poorly demarcated borders with spreading erythema',
      'Pitting edema of affected leg',
      'Small healing wound on dorsum of foot',
      'Tender inguinal lymphadenopathy',
    ],
  },
  'Melanoma': {
    age: 62,
    sex: 'F',
    chiefComplaint: 'Changing mole on upper back noticed by husband',
    history: 'History of severe sunburns as teenager. Multiple nevi. Fair complexion. Mother had melanoma. Mole has grown and darkened over 6 months.',
    vitals: { bp: '128/76', hr: '70', temp: '98.6°F', rr: '14', o2: '99%' },
    physicalExam: [
      'Asymmetric pigmented lesion 8mm diameter',
      'Irregular, notched borders',
      'Color variation: brown, black, and red areas',
      'No satellite lesions',
      'No palpable lymphadenopathy',
    ],
  },
  'Basal Cell Carcinoma': {
    age: 72,
    sex: 'M',
    chiefComplaint: 'Non-healing "pimple" on nose for 6 months',
    history: 'Worked outdoors as farmer for 40 years. Fair skin, blue eyes. Never used sunscreen. Lesion bleeds with minor trauma and scabs over repeatedly.',
    vitals: { bp: '134/80', hr: '66', temp: '98.4°F', rr: '14', o2: '98%' },
    physicalExam: [
      'Pearly, translucent papule with telangiectasias',
      'Rolled borders',
      'Central depression with crusting',
      'Located on sun-exposed area (nose)',
    ],
  },
  'Impetigo': {
    age: 5,
    sex: 'M',
    chiefComplaint: 'Crusty sores around mouth and nose',
    history: 'Started as small blisters 4 days ago, now spreading. Several classmates have similar lesions. Low-grade fever. Good appetite and activity level.',
    vitals: { bp: '95/60', hr: '100', temp: '99.8°F', rr: '20', o2: '99%' },
    physicalExam: [
      'Honey-colored crusted lesions around nares and mouth',
      'Erythematous base beneath crusts',
      'Satellite lesions on cheeks',
      'Mild regional lymphadenopathy',
    ],
  },
};

/**
 * Generate clinical presentation data for a derm condition
 */
function generateClinicalPresentation(diagnosis: string): ClinicalPresentationData | undefined {
  const template = CLINICAL_PRESENTATIONS[diagnosis];
  if (!template) return undefined;
  
  // Add some random variation to age
  const ageVariation = Math.floor(Math.random() * 10) - 5;
  const age = Math.max(1, template.age + ageVariation);
  
  return {
    ...template,
    age,
  };
}

// ============================================================================
// HELPER: generateRandomCase
// ============================================================================

let caseCounter = 0;

/**
 * Options for generating a random case.
 */
export interface GenerateCaseOptions {
  /** Custom educational caption/explanation from manifest data */
  educationalCaption?: string;
}

/**
 * Generates a random PhotoCase based on the selected category.
 * Diagnoses are strictly selected from MASTER_CONDITION_LIST.
 *
 * @param category - The category to generate a case for
 * @param options - Optional configuration including educational caption
 * @returns A new PhotoCase object
 */
export function generateRandomCase(
  category: CategoryType,
  options?: GenerateCaseOptions
): PhotoCase {
  caseCounter++;
  const id = `case-${Date.now()}-${caseCounter}`;

  let modality: 'ecg' | 'xray' | 'derm';
  let conditionPool: string[];

  switch (category) {
    case 'ecg':
      modality = 'ecg';
      conditionPool = ECG_CONDITIONS;
      break;
    case 'derm':
      modality = 'derm';
      conditionPool = DERM_CONDITIONS;
      break;
    case 'radiology':
      modality = 'xray';
      conditionPool = RADIOLOGY_CONDITIONS;
      break;
    case 'random':
    default:
      // Random mix of all categories
      const rand = Math.random();
      if (rand < 0.33) {
        modality = 'ecg';
        conditionPool = ECG_CONDITIONS;
      } else if (rand < 0.66) {
        modality = 'derm';
        conditionPool = DERM_CONDITIONS;
      } else {
        modality = 'xray';
        conditionPool = RADIOLOGY_CONDITIONS;
      }
      break;
  }

  // Randomly select a diagnosis from the condition pool
  const diagnosis = conditionPool[Math.floor(Math.random() * conditionPool.length)];

  // Generate image URL - placeholder with condition name for easy matching later
  const categoryColors: Record<string, string> = {
    ecg: '1e293b',
    derm: '8b5cf6',
    xray: '0ea5e9',
  };
  const color = categoryColors[modality] || '64748b';
  const imageUrl = `https://placehold.co/600x400/${color}/FFF?text=${encodeURIComponent(diagnosis)}`;

  // Generate distractors from the same pool (excluding the correct answer)
  const otherConditions = conditionPool.filter((c) => c !== diagnosis);
  const shuffled = otherConditions.sort(() => Math.random() - 0.5);
  const distractors = shuffled.slice(0, Math.min(3, shuffled.length));

  // Use educational caption from manifest if provided, otherwise fallback to generic
  const explanation =
    options?.educationalCaption ?? 'Key features support this diagnosis.';

  // Generate clinical presentation for derm cases
  const clinicalPresentation = modality === 'derm' 
    ? generateClinicalPresentation(diagnosis) 
    : undefined;

  return {
    id,
    imageUrl,
    modality,
    correctDiagnosis: diagnosis,
    distractors,
    explanation,
    clinicalPresentation,
  };
}

// ============================================================================
// MOCK DATA (Legacy support)
// ============================================================================

export const MOCK_CASES: PhotoCase[] = [
  {
    id: 'case-ecg-001',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=ECG+Example',
    modality: 'ecg',
    correctDiagnosis: 'Atrial Fibrillation',
    distractors: ['Ventricular Tachycardia', 'Sinus Bradycardia', 'Heart Block'],
    explanation:
      'The irregularly irregular rhythm with absent P waves is characteristic of atrial fibrillation. The ventricular rate is variable and there is no consistent PR interval.',
  },
  {
    id: 'case-derm-001',
    imageUrl: 'https://placehold.co/600x400/8b5cf6/FFF?text=Derm+Lesion',
    modality: 'derm',
    correctDiagnosis: 'Psoriasis',
    distractors: ['Eczema', 'Contact Dermatitis', 'Ringworm'],
    explanation:
      'The well-demarcated, erythematous plaques with silvery scales on extensor surfaces are classic findings for psoriasis. Auspitz sign may be present when scales are removed.',
  },
  {
    id: 'case-xray-001',
    imageUrl: 'https://placehold.co/600x400/0ea5e9/FFF?text=Chest+XRay',
    modality: 'xray',
    correctDiagnosis: 'Pneumothorax',
    distractors: ['Pleural Effusion', 'Pneumonia', 'Cardiomegaly'],
    explanation:
      'The absence of lung markings in the peripheral lung field with a visible visceral pleural line indicates pneumothorax. There is no mediastinal shift suggesting a simple rather than tension pneumothorax.',
  },
  {
    id: 'case-ecg-002',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=ECG+STEMI',
    modality: 'ecg',
    correctDiagnosis: 'STEMI',
    distractors: ['NSTEMI', 'Pericarditis', 'Hyperkalemia'],
    explanation:
      'ST segment elevation in contiguous leads with reciprocal changes is diagnostic of STEMI. Immediate reperfusion therapy is indicated.',
  },
  {
    id: 'case-derm-002',
    imageUrl: 'https://placehold.co/600x400/8b5cf6/FFF?text=Derm+Rash',
    modality: 'derm',
    correctDiagnosis: 'Shingles',
    distractors: ['Herpes Simplex', 'Cellulitis', 'Impetigo'],
    explanation:
      'The unilateral, dermatomal distribution of grouped vesicles on an erythematous base is pathognomonic for herpes zoster (shingles). Pain often precedes the rash.',
  },
];

// ============================================================================
// FUZZY MATCH HELPER (STUB)
// ============================================================================

/**
 * Stub for fuzzy string matching.
 * To be implemented with string distance algorithms (e.g., Levenshtein) later.
 *
 * @param input - The user's input
 * @param target - The target string to match against
 * @param threshold - Similarity threshold (0-1), default 0.8
 * @returns true if strings are similar enough
 */
export function fuzzyMatch(
  input: string,
  target: string,
  _threshold: number = 0.8
): boolean {
  // For now, just do case-insensitive exact match
  // TODO: Implement Levenshtein distance or similar algorithm
  return input.toLowerCase().trim() === target.toLowerCase().trim();
}

// ============================================================================
// HOOK: usePhotoDrill (Category-Aware Infinite Queue)
// ============================================================================

export interface UsePhotoDrillReturn {
  /** The current case being displayed */
  currentCase: PhotoCase | null;
  /** Current index in the cases array */
  currentCaseIndex: number;
  /** Total number of cases in queue */
  totalCases: number;
  /** Current score (number correct) */
  score: number;
  /** Current streak of correct answers */
  streak: number;
  /** The user's submitted answer (if any) */
  userAnswer: string | null;
  /** Whether the last answer was correct */
  isCorrect: boolean | null;
  /** Current game status */
  status: GameStatus;
  /** @deprecated Use status instead - Legacy game state for backwards compatibility */
  gameStatus: GameStatus;
  /** Currently selected category */
  selectedCategory: CategoryType;
  /** The current queue of cases */
  queue: PhotoCase[];
  /** Valid diagnoses filtered by selected category (for type-ahead search) */
  validDiagnoses: string[];
  /** Submit an answer for the current case */
  submitAnswer: (answer: string) => void;
  /** Move to the next case (generates new case for infinite loop) */
  nextCase: () => void;
  /** Skip the current case (marks as incorrect) */
  skipCase: () => void;
  /** Reset the game to start over */
  reset: () => void;
  /** Start a new session with the given category */
  startSession: (category: CategoryType) => void;
  /** Exit to menu */
  exitToMenu: () => void;
}

/** Initial queue size when starting a session */
const INITIAL_QUEUE_SIZE = 3;
const MAX_RECENT_DIAGNOSES = 15; // Track last 15 diagnoses to avoid repetition

/**
 * Custom hook for managing a photo drill game session with category-aware infinite queue.
 *
 * @param cases - Array of PhotoCase objects to use (defaults to MOCK_CASES for legacy support)
 * @returns Game state and actions
 */
export function usePhotoDrill(
  cases: PhotoCase[] = MOCK_CASES
): UsePhotoDrillReturn {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(null);
  const [queue, setQueue] = useState<PhotoCase[]>([]);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<GameStatus>('menu');
  
  // Track recently used diagnoses to avoid repetition
  const recentDiagnosesRef = useRef<Set<string>>(new Set());

  // Use queue if we have a session, otherwise fall back to legacy cases
  const activeCases = queue.length > 0 ? queue : cases;
  const currentCase = activeCases.length > 0 ? activeCases[currentCaseIndex] ?? null : null;
  const totalCases = activeCases.length;

  /**
   * Derive valid diagnoses based on selectedCategory.
   * When a specific category is selected, only show conditions for that modality.
   * For 'random' or null, show all conditions.
   */
  const validDiagnoses = useMemo(() => {
    switch (selectedCategory) {
      case 'ecg':
        return ECG_CONDITIONS;
      case 'derm':
        return DERM_CONDITIONS;
      case 'radiology':
        return RADIOLOGY_CONDITIONS;
      case 'random':
      default:
        return MASTER_CONDITION_LIST;
    }
  }, [selectedCategory]);

  /**
   * Generate a new case while avoiding recently seen diagnoses
   */
  const generateNewCase = useCallback((category: CategoryType): PhotoCase => {
    let attempts = 0;
    let newCase: PhotoCase;
    
    // Try to generate a case we haven't seen recently
    do {
      newCase = generateRandomCase(category);
      attempts++;
    } while (recentDiagnosesRef.current.has(newCase.correctDiagnosis) && attempts < 10);
    
    // Add to recent diagnoses and maintain max size
    recentDiagnosesRef.current.add(newCase.correctDiagnosis);
    if (recentDiagnosesRef.current.size > MAX_RECENT_DIAGNOSES) {
      const firstItem = recentDiagnosesRef.current.values().next().value;
      if (firstItem) recentDiagnosesRef.current.delete(firstItem);
    }
    
    return newCase;
  }, []);

  /**
   * Start a new session with the specified category.
   * Generates initial queue and transitions to playing state.
   */
  const startSession = useCallback((category: CategoryType) => {
    setSelectedCategory(category);
    recentDiagnosesRef.current.clear(); // Clear history on new session
    
    // Generate initial queue
    const initialQueue: PhotoCase[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      initialQueue.push(generateNewCase(category));
    }
    
    setQueue(initialQueue);
    setCurrentCaseIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [generateNewCase]);

  /**
   * Exit to the menu screen.
   */
  const exitToMenu = useCallback(() => {
    setStatus('menu');
    setSelectedCategory(null);
    setQueue([]);
    setCurrentCaseIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
  }, []);

  /**
   * Submit an answer for the current case.
   * Case-insensitive matching.
   */
  const submitAnswer = useCallback(
    (answer: string) => {
      if (!currentCase || (status !== 'playing' && status !== 'active')) {
        return;
      }

      setUserAnswer(answer);

      // Case-insensitive comparison
      const correct = fuzzyMatch(answer, currentCase.correctDiagnosis);

      setIsCorrect(correct);

      if (correct) {
        setScore((prev) => prev + 1);
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }

      setStatus('feedback');
    },
    [currentCase, status]
  );

  /**
   * Advance to the next case.
   * For infinite mode, generates a new case and appends to queue.
   */
  const nextCase = useCallback(() => {
    // For infinite queue mode (when we have a selected category)
    if (selectedCategory !== null) {
      // Generate a new case and append to queue
      const newCase = generateNewCase(selectedCategory);
      setQueue((prev) => [...prev, newCase]);
      setCurrentCaseIndex((prev) => prev + 1);
      setUserAnswer(null);
      setIsCorrect(null);
      setStatus('playing');
    } else {
      // Legacy mode - finite cases
      if (currentCaseIndex >= totalCases - 1) {
        setStatus('summary');
      } else {
        setCurrentCaseIndex((prev) => prev + 1);
        setUserAnswer(null);
        setIsCorrect(null);
        setStatus('active');
      }
    }
  }, [currentCaseIndex, totalCases, selectedCategory, generateNewCase]);

  /**
   * Skip the current case (counts as incorrect).
   */
  const skipCase = useCallback(() => {
    if (status !== 'playing' && status !== 'active') {
      return;
    }

    // Mark as incorrect by breaking streak
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(false);

    // For infinite queue mode
    if (selectedCategory !== null) {
      const newCase = generateNewCase(selectedCategory);
      setQueue((prev) => [...prev, newCase]);
      setCurrentCaseIndex((prev) => prev + 1);
      setStatus('playing');
    } else {
      // Legacy mode
      if (currentCaseIndex >= totalCases - 1) {
        setStatus('summary');
      } else {
        setCurrentCaseIndex((prev) => prev + 1);
        setStatus('active');
      }
    }
  }, [currentCaseIndex, totalCases, status, selectedCategory, generateNewCase]);

  /**
   * Reset the game to start fresh (legacy support).
   * For new infinite mode, use startSession instead.
   */
  const reset = useCallback(() => {
    recentDiagnosesRef.current.clear(); // Clear history on reset
    setCurrentCaseIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
    
    // If we have a category, regenerate queue
    if (selectedCategory !== null) {
      const newQueue: PhotoCase[] = [];
      for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
        newQueue.push(generateNewCase(selectedCategory));
      }
      setQueue(newQueue);
      setStatus('playing');
    } else {
      setStatus('active');
    }
  }, [selectedCategory, generateNewCase]);

  return {
    currentCase,
    currentCaseIndex,
    totalCases,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    gameStatus: status, // Alias for backwards compatibility
    selectedCategory,
    queue,
    validDiagnoses,
    submitAnswer,
    nextCase,
    skipCase,
    reset,
    startSession,
    exitToMenu,
  };
}
