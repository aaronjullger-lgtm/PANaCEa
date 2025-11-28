import { useState, useCallback } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

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
}

/**
 * Represents the current state of the game.
 */
export type GameState = 'loading' | 'active' | 'feedback' | 'summary';

// ============================================================================
// MOCK DATA
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
// HOOK: usePhotoDrill
// ============================================================================

export interface UsePhotoDrillReturn {
  /** The current case being displayed */
  currentCase: PhotoCase | null;
  /** Current index in the cases array */
  currentCaseIndex: number;
  /** Total number of cases */
  totalCases: number;
  /** Current score (number correct) */
  score: number;
  /** Current streak of correct answers */
  streak: number;
  /** The user's submitted answer (if any) */
  userAnswer: string | null;
  /** Whether the last answer was correct */
  isCorrect: boolean | null;
  /** Current game state */
  status: GameState;
  /** Submit an answer for the current case */
  submitAnswer: (answer: string) => void;
  /** Move to the next case */
  nextCase: () => void;
  /** Skip the current case (marks as incorrect) */
  skipCase: () => void;
  /** Reset the game to start over */
  reset: () => void;
}

/**
 * Custom hook for managing a photo drill game session.
 *
 * @param cases - Array of PhotoCase objects to use (defaults to MOCK_CASES)
 * @returns Game state and actions
 */
export function usePhotoDrill(
  cases: PhotoCase[] = MOCK_CASES
): UsePhotoDrillReturn {
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userAnswer, setUserAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<GameState>('active');

  const currentCase = cases.length > 0 ? cases[currentCaseIndex] ?? null : null;
  const totalCases = cases.length;

  /**
   * Submit an answer for the current case.
   * Case-insensitive matching.
   */
  const submitAnswer = useCallback(
    (answer: string) => {
      if (!currentCase || status !== 'active') {
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
   * If at the end, transitions to summary state.
   */
  const nextCase = useCallback(() => {
    if (currentCaseIndex >= totalCases - 1) {
      setStatus('summary');
    } else {
      setCurrentCaseIndex((prev) => prev + 1);
      setUserAnswer(null);
      setIsCorrect(null);
      setStatus('active');
    }
  }, [currentCaseIndex, totalCases]);

  /**
   * Skip the current case (counts as incorrect).
   */
  const skipCase = useCallback(() => {
    if (status !== 'active') {
      return;
    }

    // Mark as incorrect by breaking streak
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(false);

    // Move to next case or summary
    if (currentCaseIndex >= totalCases - 1) {
      setStatus('summary');
    } else {
      setCurrentCaseIndex((prev) => prev + 1);
      setStatus('active');
    }
  }, [currentCaseIndex, totalCases, status]);

  /**
   * Reset the game to start fresh.
   */
  const reset = useCallback(() => {
    setCurrentCaseIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswer(null);
    setIsCorrect(null);
    setStatus('active');
  }, []);

  return {
    currentCase,
    currentCaseIndex,
    totalCases,
    score,
    streak,
    userAnswer,
    isCorrect,
    status,
    submitAnswer,
    nextCase,
    skipCase,
    reset,
  };
}
