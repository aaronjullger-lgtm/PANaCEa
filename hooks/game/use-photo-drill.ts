import { useState, useCallback, useMemo, useRef } from 'react';
import { submitDrillResult } from '@/services/drillService';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Clinical context for the "Clinical Presentation Mode" (formerly DERM).
 * Provides initial clues before revealing visual media.
 */
export interface ClinicalContext {
  /** Patient age */
  age: number;
  /** Patient sex */
  sex: 'M' | 'F';
  /** Chief complaint that brought the patient in */
  chiefComplaint: string;
  /** Key vital signs (formatted string) */
  vitals: string;
  /** Brief history */
  history: string;
  /** Optional additional clues */
  additionalFindings?: string[];
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
  /** Clinical context for Clinical Presentation Mode (optional, used for derm cases) */
  clinicalContext?: ClinicalContext;
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
// CLINICAL CONTEXT FOR CLINICAL PRESENTATION MODE
// ============================================================================

/**
 * Clinical context templates for each derm condition.
 * Used to generate realistic "patient chart" presentations.
 */
const DERM_CLINICAL_CONTEXTS: Record<string, Omit<ClinicalContext, 'age' | 'sex'> & { ageRange: [number, number] }> = {
  'Psoriasis': {
    ageRange: [20, 60],
    chiefComplaint: 'Itchy, scaly patches on elbows and knees for 3 months',
    vitals: 'BP 128/82, HR 76, Temp 98.4°F, RR 16',
    history: 'Patient reports intermittent flares, worse in winter. Family history of autoimmune disease.',
    additionalFindings: ['Nail pitting noted', 'No joint pain or swelling'],
  },
  'Eczema': {
    ageRange: [5, 40],
    chiefComplaint: 'Intensely itchy, red patches in flexural areas',
    vitals: 'BP 118/76, HR 82, Temp 98.2°F, RR 14',
    history: 'History of asthma and seasonal allergies. Symptoms worsen with stress and dry weather.',
    additionalFindings: ['Dry, lichenified skin', 'Excoriations from scratching'],
  },
  'Shingles': {
    ageRange: [50, 85],
    chiefComplaint: 'Painful, burning rash on one side of trunk for 5 days',
    vitals: 'BP 142/88, HR 88, Temp 99.8°F, RR 18',
    history: 'Pain preceded the rash by 2-3 days. History of childhood chickenpox. No recent immunosuppression.',
    additionalFindings: ['Rash follows dermatome', 'Allodynia in affected area'],
  },
  'Contact Dermatitis': {
    ageRange: [18, 65],
    chiefComplaint: 'Itchy, blistering rash after gardening 48 hours ago',
    vitals: 'BP 120/78, HR 72, Temp 98.6°F, RR 14',
    history: 'Was working in yard without gloves. Similar reaction to poison ivy 2 years ago.',
    additionalFindings: ['Linear pattern of vesicles', 'Sharp demarcation at clothing line'],
  },
  'Cellulitis': {
    ageRange: [30, 75],
    chiefComplaint: 'Rapidly spreading red, warm, swollen area on lower leg',
    vitals: 'BP 132/86, HR 98, Temp 101.2°F, RR 18',
    history: 'Noticed small cut on leg 4 days ago. Diabetes with A1c of 8.2%. No recent hospitalization.',
    additionalFindings: ['Tenderness to palpation', 'No fluctuance or drainage'],
  },
  'Melanoma': {
    ageRange: [35, 70],
    chiefComplaint: 'Changing mole on back noticed by spouse',
    vitals: 'BP 124/80, HR 70, Temp 98.4°F, RR 14',
    history: 'Mole has been present for years but recently changed color and became asymmetric. History of blistering sunburns.',
    additionalFindings: ['Irregular borders', 'Multiple colors within lesion', 'Greater than 6mm diameter'],
  },
  'Basal Cell Carcinoma': {
    ageRange: [55, 80],
    chiefComplaint: 'Non-healing sore on nose for 6 months',
    vitals: 'BP 138/84, HR 68, Temp 98.2°F, RR 14',
    history: 'Outdoor occupation for 30 years. Fair skin with history of frequent sunburns.',
    additionalFindings: ['Pearly, translucent appearance', 'Central ulceration', 'Telangiectasias visible'],
  },
  'Impetigo': {
    ageRange: [2, 12],
    chiefComplaint: 'Honey-colored crusted lesions around mouth and nose',
    vitals: 'BP 90/60, HR 95, Temp 99.4°F, RR 20',
    history: 'Lesions started as small blisters 4 days ago. Attends daycare. Several classmates have similar symptoms.',
    additionalFindings: ['Easily rupturing vesicles', 'Satellite lesions spreading'],
  },
};

/**
 * Generate clinical context for a derm case
 */
function generateClinicalContext(diagnosis: string): ClinicalContext {
  const template = DERM_CLINICAL_CONTEXTS[diagnosis];
  
  if (!template) {
    // Fallback for conditions without specific templates
    return {
      age: 45,
      sex: Math.random() > 0.5 ? 'M' : 'F',
      chiefComplaint: 'Skin lesion requiring evaluation',
      vitals: 'BP 120/80, HR 72, Temp 98.6°F, RR 14',
      history: 'Patient presents for dermatological evaluation.',
    };
  }
  
  // Generate random age within range
  const [minAge, maxAge] = template.ageRange;
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  
  // Random sex
  const sex: 'M' | 'F' = Math.random() > 0.5 ? 'M' : 'F';
  
  return {
    age,
    sex,
    chiefComplaint: template.chiefComplaint,
    vitals: template.vitals,
    history: template.history,
    additionalFindings: template.additionalFindings,
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

  // Generate clinical context for derm cases (Clinical Presentation Mode)
  const clinicalContext = modality === 'derm' 
    ? generateClinicalContext(diagnosis) 
    : undefined;

  return {
    id,
    imageUrl,
    modality,
    correctDiagnosis: diagnosis,
    distractors,
    explanation,
    clinicalContext,
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
/**
 * Calculate the Levenshtein distance between two strings.
 * This measures the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one string into another.
 * 
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns The Levenshtein distance between the two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create a 2D array to store distances
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));
  
  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Fuzzy matching function that uses Levenshtein distance to allow for minor spelling errors.
 * This is especially useful for medical terminology where users might have small typos.
 * 
 * @param input - The user's input string
 * @param target - The correct target string
 * @param threshold - Similarity threshold (0-1), default 0.8. Higher values require closer matches.
 * @returns true if the input is similar enough to the target
 */
export function fuzzyMatch(
  input: string,
  target: string,
  threshold: number = 0.8
): boolean {
  // Normalize both strings: lowercase and trim whitespace
  const normalizedInput = input.toLowerCase().trim();
  const normalizedTarget = target.toLowerCase().trim();
  
  // Exact match always returns true
  if (normalizedInput === normalizedTarget) {
    return true;
  }
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedInput, normalizedTarget);
  
  // Calculate similarity ratio based on the longer string
  const maxLength = Math.max(normalizedInput.length, normalizedTarget.length);
  const similarity = 1 - (distance / maxLength);
  
  // Return true if similarity meets or exceeds threshold
  return similarity >= threshold;
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
      if (!currentCase || status !== 'playing') {
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

      // Submit result
      const drillTypeMap: Record<string, 'radiology' | 'ecg' | 'derm'> = {
        'xray': 'radiology',
        'ecg': 'ecg',
        'derm': 'derm'
      };
      
      const drillType = drillTypeMap[currentCase.modality] || 'radiology';

      submitDrillResult(
        drillType,
        currentCase.id,
        correct,
        { title: currentCase.correctDiagnosis, category: currentCase.modality }
      );

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
        setStatus('playing');
      }
    }
  }, [currentCaseIndex, totalCases, selectedCategory, generateNewCase]);

  /**
   * Skip the current case (counts as incorrect).
   */
  const skipCase = useCallback(() => {
    if (status !== 'playing') {
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
        setStatus('playing');
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
      setStatus('playing');
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
