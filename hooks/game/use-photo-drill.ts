import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { submitDrillResult } from '@/services/core';
import { recordDrillSession, getRecommendedDifficulty, type DrillType } from '@/services/analytics';

// Static fallbacks used in tests/offline mode (database-first in production)
export const MASTER_CONDITION_LIST: string[] = [
  'Atrial Fibrillation',
  'STEMI',
  'Psoriasis',
  'Shingles',
  'Pneumothorax',
  'Pneumonia',
  'Gout',
  'Ventricular Tachycardia',
  'Pericarditis',
  'Eczema',
  'Cellulitis',
  'Basal Cell Carcinoma',
  'Melanoma',
  'COPD Exacerbation',
  'Heart Failure',
  'Aortic Dissection',
  'Pleuritis',
  'ARDS',
  'Bronchitis',
  'Aspiration Pneumonitis',
  'Dermatitis Herpetiformis',
  'Tinea Corporis',
  'Erythema Multiforme',
];

const CATEGORY_DIAGNOSES: Record<NonNullable<CategoryType>, string[]> = {
  ecg: ['Atrial Fibrillation', 'STEMI', 'Ventricular Tachycardia', 'Pericarditis'],
  derm: [
    'Psoriasis',
    'Shingles',
    'Eczema',
    'Cellulitis',
    'Basal Cell Carcinoma',
    'Melanoma',
    'Dermatitis Herpetiformis',
    'Tinea Corporis',
    'Erythema Multiforme',
  ],
  radiology: [
    'Pneumothorax',
    'Pneumonia',
    'COPD Exacerbation',
    'Heart Failure',
    'Aortic Dissection',
    'Pleuritis',
    'ARDS',
    'Bronchitis',
    'Aspiration Pneumonitis',
  ],
  random: MASTER_CONDITION_LIST,
};

export const MOCK_CASES: PhotoCase[] = [
  {
    id: 'mock-ecg-1',
    imageUrl: 'https://dummyimage.com/600x400/1e293b/ffffff&text=ECG+Case+1',
    modality: 'ecg',
    correctDiagnosis: 'Atrial Fibrillation',
    distractors: ['STEMI', 'Pericarditis', 'Ventricular Tachycardia'],
    explanation: 'Irregularly irregular rhythm with absent P waves.',
  },
  {
    id: 'mock-ecg-2',
    imageUrl: 'https://dummyimage.com/600x400/1e293b/ffffff&text=ECG+Case+2',
    modality: 'ecg',
    correctDiagnosis: 'STEMI',
    distractors: ['Pericarditis', 'Atrial Fibrillation', 'Heart Failure'],
    explanation: 'ST elevation in contiguous leads.',
  },
  {
    id: 'mock-derm-1',
    imageUrl: 'https://dummyimage.com/600x400/8b5cf6/ffffff&text=Derm+Case',
    modality: 'derm',
    correctDiagnosis: 'Psoriasis',
    distractors: ['Eczema', 'Cellulitis', 'Tinea Corporis'],
    explanation: 'Well-demarcated plaques with silvery scale.',
  },
  {
    id: 'mock-xray-1',
    imageUrl: 'https://dummyimage.com/600x400/0ea5e9/ffffff&text=Chest+Xray',
    modality: 'xray',
    correctDiagnosis: 'Pneumothorax',
    distractors: ['Pneumonia', 'ARDS', 'COPD Exacerbation'],
    explanation: 'Absent lung markings with pleural line.',
  },
  {
    id: 'mock-xray-2',
    imageUrl: 'https://dummyimage.com/600x400/0ea5e9/ffffff&text=Chest+Xray+2',
    modality: 'xray',
    correctDiagnosis: 'Pneumonia',
    distractors: ['Pneumothorax', 'Aortic Dissection', 'Heart Failure'],
    explanation: 'Consolidation with air bronchograms.',
  },
];

export function generateRandomCase(
  category: CategoryType,
  options: { educationalCaption?: string } = {}
): PhotoCase {
  const pool =
    category && category !== 'random' ? CATEGORY_DIAGNOSES[category] : MASTER_CONDITION_LIST;

  // Ensure we have a valid pool with at least one diagnosis
  if (pool.length === 0) {
    throw new Error('No diagnoses available for category');
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const correctDiagnosis = pool[randomIndex] ?? MASTER_CONDITION_LIST[0] ?? 'Unknown Condition';

  const distractors = pool
    .filter((d) => d !== correctDiagnosis)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const modality: PhotoCase['modality'] =
    category === 'derm' ? 'derm' : category === 'radiology' ? 'xray' : 'ecg';

  const colorMap: Record<PhotoCase['modality'], string> = {
    ecg: '1e293b',
    derm: '8b5cf6',
    xray: '0ea5e9',
  };

  const explanation: string = options.educationalCaption ?? 'Key features support this diagnosis.';

  return {
    id: `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    imageUrl: `https://dummyimage.com/600x400/${colorMap[modality]}/ffffff&text=${encodeURIComponent(correctDiagnosis)}`,
    modality,
    correctDiagnosis,
    distractors: distractors.length ? distractors : MASTER_CONDITION_LIST.slice(0, 3),
    explanation,
  };
}

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
  /** URL to the case image (takes precedence when present) */
  imageUrl: string;
  /** Optional stored media/asset ID for resolving image from reference APIs */
  imageId?: string;
  /** The imaging modality type */
  modality: 'ecg' | 'xray' | 'derm';
  /** Category or system (e.g., 'cardiovascular', 'pulmonary') */
  category?: string;
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
 * - 'landing': Landing page for the drill (before category selection)
 * - 'menu': User is selecting a category in the lobby
 * - 'playing': Actively drilling with infinite queue
 * - 'feedback': Showing feedback for the last answer
 * - 'summary': Session complete
 */
export type GameStatus = 'landing' | 'menu' | 'playing' | 'feedback' | 'summary';

/**
 * @deprecated Use GameStatus instead.
 * Migration: 'loading' → 'menu', 'active' → 'playing'.
 * The 'feedback' and 'summary' states remain unchanged.
 */
export type GameState = 'loading' | 'active' | 'feedback' | 'summary';

/** Category types for training modules */
export type CategoryType = 'ecg' | 'derm' | 'radiology' | 'random' | null;

// ============================================================================
// API FETCHING FOR DATABASE-DRIVEN QUESTIONS
// ============================================================================

/**
 * Fetch photo cases from the database API
 *
 * @param modality - The image modality to fetch ('ecg', 'derm', 'radiology', or null for random)
 * @param count - Number of cases to fetch (default 20)
 * @returns Array of PhotoCase objects from approved media assets
 */
async function fetchPhotoCases(
  modality: 'ecg' | 'derm' | 'radiology' | null,
  count: number = 20
): Promise<PhotoCase[]> {
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  // In tests/offline mode, skip network entirely and return generated cases
  if (isTestEnv) {
    return Array.from({ length: count }).map(() =>
      generateRandomCase((modality as CategoryType) || 'random')
    );
  }

  try {
    // Build API URL
    const params = new URLSearchParams();
    if (modality) {
      params.append('modality', modality);
    }
    params.append('count', count.toString());

    const baseUrl =
      typeof window !== 'undefined' && window.location
        ? window.location.origin
        : 'http://localhost';
    const url = `${baseUrl}/api/drills/media?${params.toString()}`;

    // Fetch from API
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    const cases = await response.json();

    if (!Array.isArray(cases) || cases.length === 0) {
      throw new Error('No photo cases available');
    }

    return cases;
  } catch (error) {
    console.error('[Photo Drill] Failed to fetch cases, using fallback:', error);
    return Array.from({ length: count }).map(() =>
      generateRandomCase((modality as CategoryType) || 'random')
    );
  }
}

// ============================================================================
// FUZZY MATCH HELPER
// ============================================================================

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
    .map(() => Array(len2 + 1).fill(0) as number[]);

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    const row = matrix[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    const row = matrix[0];
    if (row) row[j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (currentRow && prevRow) {
        currentRow[j] = Math.min(
          (prevRow[j] ?? 0) + 1, // deletion
          (currentRow[j - 1] ?? 0) + 1, // insertion
          (prevRow[j - 1] ?? 0) + cost // substitution
        );
      }
    }
  }

  return matrix[len1]?.[len2] ?? 0;
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
export function fuzzyMatch(input: string, target: string, threshold: number = 0.8): boolean {
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
  const similarity = 1 - distance / maxLength;

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
  /** Total number of questions attempted in this session (alias for currentCaseIndex) */
  totalAttempts: number;
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
 * All cases are fetched from the database via /api/drills/media endpoint - no static data used.
 *
 * @returns Game state and actions
 */
export function usePhotoDrill(initialCases: PhotoCase[] = MOCK_CASES): UsePhotoDrillReturn {
  // MUST call all hooks at top level - Rules of Hooks requirement
  const auth = useAuth();
  const getToken: () => Promise<string | null> = auth?.getToken || (async () => null);

  // All state hooks come after useAuth
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(null);
  const [queue, setQueue] = useState<PhotoCase[]>(initialCases);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<GameStatus>('menu');

  // Track recently used diagnoses to avoid repetition
  const recentDiagnosesRef = useRef<Set<string>>(new Set());

  // Track session for drill statistics
  const sessionStartRef = useRef<number>(Date.now());
  const sessionDataRef = useRef({
    questionsAttempted: 0,
    correctAnswers: 0,
    bestStreak: 0,
  });

  // Current case from queue (all cases are dynamically generated)
  const currentCase = queue.length > 0 ? (queue[currentCaseIndex] ?? null) : null;
  const totalCases = queue.length;

  /**
   * Derive valid diagnoses from current queue (all unique diagnoses + distractors).
   * Used for type-ahead search - dynamically populated from API data.
   */
  const validDiagnoses = useMemo(() => {
    if (!selectedCategory) {
      return MASTER_CONDITION_LIST;
    }
    return CATEGORY_DIAGNOSES[selectedCategory] ?? MASTER_CONDITION_LIST;
  }, [selectedCategory]);

  /**
   * Fetch new cases from API and add to queue
   */
  const fetchMoreCases = useCallback(async (category: CategoryType, count: number = 20) => {
    try {
      const modality = category === 'random' ? null : category;
      const cases = await fetchPhotoCases(modality, count);
      return cases;
    } catch (error) {
      console.error('[Photo Drill] Failed to fetch cases:', error);
      throw error;
    }
  }, []);

  /**
   * Start a new session with the specified category.
   * Fetches initial queue from API and transitions to playing state.
   */
  const startSession = useCallback(
    (category: CategoryType) => {
      setSelectedCategory(category);
      recentDiagnosesRef.current.clear(); // Clear history on new session

      // Initialize session tracking
      sessionStartRef.current = Date.now();
      sessionDataRef.current = {
        questionsAttempted: 0,
        correctAnswers: 0,
        bestStreak: 0,
      };

      const seedQueue = Array.from({ length: INITIAL_QUEUE_SIZE }).map(() =>
        generateRandomCase(category || 'random')
      );
      setQueue(seedQueue);

      setCurrentCaseIndex(0);
      setScore(0);
      setStreak(0);
      setUserAnswer(null);
      setIsCorrect(null);
      setStatus('playing');

      // Replace seed queue with fetched cases when available
      void fetchMoreCases(category, INITIAL_QUEUE_SIZE)
        .then((initialQueue) => setQueue(initialQueue))
        .catch((error) => {
          console.error('[Photo Drill] Failed to start session:', error);
        });
    },
    [fetchMoreCases]
  );

  /**
   * Auto-refill queue when running low (background prefetch)
   */
  useEffect(() => {
    const MIN_QUEUE_SIZE = 5;

    if (selectedCategory && queue.length > 0 && queue.length - currentCaseIndex <= MIN_QUEUE_SIZE) {
      // Running low on cases, fetch more in background
      fetchMoreCases(selectedCategory, 10)
        .then((newCases) => {
          setQueue((prev) => [...prev, ...newCases]);
        })
        .catch((error) => {
          console.error('[Photo Drill] Background refill failed:', error);
          // Fail silently - user can continue with existing queue
        });
    }
  }, [currentCaseIndex, queue.length, selectedCategory, fetchMoreCases]);

  /**
   * Exit to the menu screen.
   */
  const exitToMenu = useCallback(() => {
    // Record session if any questions were attempted
    const sessionData = sessionDataRef.current;
    if (sessionData?.questionsAttempted && sessionData.questionsAttempted > 0 && selectedCategory) {
      const endTime = Date.now();
      const drillTypeMap: Record<string, DrillType> = {
        ecg: 'ecg_drill',
        derm: 'derm_drill',
        radiology: 'imaging_drill',
      };
      const categoryKey = selectedCategory as string;
      const drillType: DrillType = drillTypeMap[categoryKey] ?? 'imaging_drill';

      const questionsAttempted = sessionData.questionsAttempted ?? 0;
      const correctAnswers = sessionData.correctAnswers ?? 0;
      const accuracy = questionsAttempted > 0 ? (correctAnswers / questionsAttempted) * 100 : 0;

      recordDrillSession({
        drillType,
        startTime: new Date(sessionStartRef.current).toISOString(),
        endTime: new Date(endTime).toISOString(),
        questionsAttempted,
        correctAnswers,
        accuracy,
        timeSpent: Math.round((endTime - sessionStartRef.current) / 1000),
        bestStreak: sessionData.bestStreak ?? 0,
        difficulty: getRecommendedDifficulty(drillType),
      });
    }

    setSelectedCategory(null);
    setQueue([]);
    setCurrentCaseIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
    setStatus('menu');
  }, [selectedCategory]);

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
        xray: 'radiology',
        ecg: 'ecg',
        derm: 'derm',
      };

      const drillType = drillTypeMap[currentCase.modality] || 'radiology';

      submitDrillResult(
        drillType,
        currentCase.id,
        correct,
        { title: currentCase.correctDiagnosis, category: currentCase.modality },
        getToken
      );

      setStatus('feedback');
    },
    [currentCase, status, getToken]
  );

  /**
   * Advance to the next case.
   * For infinite mode, moves to next case in queue (auto-refill handled by useEffect).
   */
  const nextCase = useCallback(() => {
    // For infinite queue mode (when we have a selected category)
    if (selectedCategory !== null) {
      const placeholder = generateRandomCase(selectedCategory);
      setQueue((prev) => [...prev, placeholder]);

      fetchMoreCases(selectedCategory, 1)
        .then((more) => {
          if (!more.length) return;
          setQueue((prev) => {
            const trimmed = prev.slice(0, Math.max(prev.length - 1, 0));
            return [...trimmed, ...more];
          });
        })
        .catch(() => {
          // Keep placeholder on failure
        });

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
  }, [currentCaseIndex, totalCases, selectedCategory]);

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

    // Move to next case (queue auto-refills)
    const placeholder = generateRandomCase(selectedCategory || 'random');
    setQueue((prev) => [...prev, placeholder]);

    fetchMoreCases(selectedCategory || 'random', 1)
      .then((more) => {
        if (!more.length) return;
        setQueue((prev) => {
          const trimmed = prev.slice(0, Math.max(prev.length - 1, 0));
          return [...trimmed, ...more];
        });
      })
      .catch(() => {
        // Keep placeholder on failure
      });

    setCurrentCaseIndex((prev) => prev + 1);
    setStatus('playing');
  }, [status, selectedCategory, fetchMoreCases]);

  /**
   * Reset the game to start fresh (legacy support).
   * For new infinite mode, use startSession instead.
   */
  const reset = useCallback(async () => {
    recentDiagnosesRef.current.clear(); // Clear history on reset
    setCurrentCaseIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);

    // If we have a category, fetch new queue
    if (selectedCategory !== null) {
      const seedQueue = Array.from({ length: INITIAL_QUEUE_SIZE }).map(() =>
        generateRandomCase(selectedCategory)
      );
      setQueue(seedQueue);
      setStatus('playing');

      void fetchMoreCases(selectedCategory, INITIAL_QUEUE_SIZE)
        .then((newQueue) => setQueue(newQueue))
        .catch((error) => {
          console.error('[Photo Drill] Failed to reset:', error);
        });
    } else {
      setStatus('playing');
    }
  }, [selectedCategory, fetchMoreCases]);

  return {
    currentCase,
    currentCaseIndex,
    totalCases,
    totalAttempts: currentCaseIndex,
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

export const PHOTO_DRILL_MOCK_CASES = MOCK_CASES;
export default usePhotoDrill;
