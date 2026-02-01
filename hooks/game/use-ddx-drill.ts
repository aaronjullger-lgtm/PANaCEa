/**
 * useDifferentialDrill - Hook for Differential Diagnosis drill mode
 *
 * Fetches DDx data from the database and generates questions.
 * Practice identifying differentials for presenting complaints.
 */

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { recordDrillSession } from '@/services/analytics';

export type DDxDrillStatus = 'landing' | 'loading' | 'playing' | 'feedback' | 'complete' | 'error';

export interface DDxQuestion {
  id: string;
  presentingComplaint: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: string;
  questionType: 'mustNotMiss' | 'mostCommon' | 'distinguishing' | 'redFlag' | 'workup';
}

export interface DDxData {
  id: string;
  presentingComplaint: string;
  category: string;
  differentialList: string[];
  mustNotMiss: string[];
  mostCommon?: string[];
  mostDangerous?: string[];
  workup?: string;
  redFlags?: string[];
  distinguishingFeatures?: Record<string, string[]>;
  clinicalPearls?: string[];
  isHighYield?: boolean;
}

export interface UseDDxDrillReturn {
  currentQuestion: DDxQuestion | null;
  score: number;
  totalAttempts: number;
  streak: number;
  userAnswerIndex: number | null;
  isCorrect: boolean | null;
  status: DDxDrillStatus;
  error: string | null;
  availableCategories: string[];
  submitAnswer: (index: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (category?: string) => void;
  exitToMenu: () => void;
}

/**
 * Generate a question from DDx data
 */
function generateDDxQuestion(ddx: DDxData, allDDx: DDxData[]): DDxQuestion | null {
  const questionTypes: Array<DDxQuestion['questionType']> = [
    'mustNotMiss',
    'mostCommon',
    'distinguishing',
    'redFlag',
  ];
  const availableTypes = questionTypes.filter((type: (typeof questionTypes)[0]) => {
    if (type === 'mustNotMiss' && ddx.mustNotMiss?.length > 0) return true;
    if (type === 'mostCommon' && (ddx.mostCommon?.length ?? 0) > 0) return true;
    if (
      type === 'distinguishing' &&
      ddx.distinguishingFeatures &&
      Object.keys(ddx.distinguishingFeatures).length > 0
    )
      return true;
    if (type === 'redFlag' && (ddx.redFlags?.length ?? 0) > 0) return true;
    return false;
  });

  if (availableTypes.length === 0) return null;

  const questionType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

  switch (questionType) {
    case 'mustNotMiss': {
      const correctAnswer =
        ddx.mustNotMiss[Math.floor(Math.random() * ddx.mustNotMiss.length)] ?? '';
      const distractors = getDistractorDiagnoses(correctAnswer, ddx, allDDx, 3);
      const options = shuffleArray(
        [correctAnswer, ...distractors].filter(
          (x): x is string => typeof x === 'string' && x !== ''
        )
      );

      return {
        id: `${ddx.id}-mnm-${Date.now()}`,
        presentingComplaint: ddx.presentingComplaint,
        questionText: `A patient presents with ${ddx.presentingComplaint.toLowerCase()}. Which diagnosis is a "must not miss" condition?`,
        options,
        correctIndex: options.indexOf(correctAnswer),
        explanation: `${correctAnswer} is a must-not-miss diagnosis for ${ddx.presentingComplaint} due to its potentially life-threatening nature.`,
        category: ddx.category,
        questionType: 'mustNotMiss',
      };
    }

    case 'mostCommon': {
      const mostCommon = ddx.mostCommon ?? [];
      if (mostCommon.length === 0) return null;
      const correctAnswer = mostCommon[Math.floor(Math.random() * mostCommon.length)] ?? '';
      if (!correctAnswer) return null;
      const distractors = getDistractorDiagnoses(correctAnswer, ddx, allDDx, 3);
      const options = shuffleArray(
        [correctAnswer, ...distractors].filter(
          (x): x is string => typeof x === 'string' && x !== ''
        )
      );

      return {
        id: `${ddx.id}-mc-${Date.now()}`,
        presentingComplaint: ddx.presentingComplaint,
        questionText: `Which is the MOST COMMON cause of ${ddx.presentingComplaint.toLowerCase()}?`,
        options,
        correctIndex: options.indexOf(correctAnswer),
        explanation: `${correctAnswer} is among the most common causes of ${ddx.presentingComplaint}.`,
        category: ddx.category,
        questionType: 'mostCommon',
      };
    }

    case 'distinguishing': {
      const features = ddx.distinguishingFeatures ?? {};
      const pairs = Object.keys(features);
      if (pairs.length === 0) return null;

      const pairKey = pairs[Math.floor(Math.random() * pairs.length)];
      if (!pairKey) return null;
      const pairFeatures = features[pairKey] ?? [];
      if (pairFeatures.length === 0) return null;
      const correctFeature = pairFeatures[Math.floor(Math.random() * pairFeatures.length)];
      if (!correctFeature) return null;

      // Get distractors from other conditions' features
      const distractorFeatures = allDDx
        .filter((d: (typeof allDDx)[0]) => d.id !== ddx.id && d.distinguishingFeatures)
        .flatMap((d: (typeof allDDx)[0]) => Object.values(d.distinguishingFeatures ?? {}).flat())
        .filter((f): f is string => typeof f === 'string' && f !== '' && f !== correctFeature)
        .slice(0, 3);

      const options = shuffleArray([correctFeature, ...distractorFeatures.slice(0, 3)]);

      return {
        id: `${ddx.id}-dist-${Date.now()}`,
        presentingComplaint: ddx.presentingComplaint,
        questionText: `For ${ddx.presentingComplaint}, which feature helps distinguish between ${pairKey}?`,
        options,
        correctIndex: options.indexOf(correctFeature),
        explanation: `${correctFeature} is a distinguishing feature for ${pairKey}.`,
        category: ddx.category,
        questionType: 'distinguishing',
      };
    }

    case 'redFlag': {
      const redFlags = ddx.redFlags ?? [];
      if (redFlags.length === 0) return null;
      const correctAnswer = redFlags[Math.floor(Math.random() * redFlags.length)] ?? '';
      if (!correctAnswer) return null;

      // Get distractors from reassuring features or other non-red-flag items
      const distractors = allDDx
        .filter((d: (typeof allDDx)[0]) => d.redFlags)
        .flatMap((d: (typeof allDDx)[0]) => d.redFlags ?? [])
        .filter(
          (f: string | undefined): f is string =>
            f !== undefined && f !== correctAnswer && !redFlags.includes(f)
        )
        .slice(0, 3);

      const options = shuffleArray(
        [correctAnswer, ...distractors].filter(
          (x): x is string => typeof x === 'string' && x !== ''
        )
      );

      return {
        id: `${ddx.id}-rf-${Date.now()}`,
        presentingComplaint: ddx.presentingComplaint,
        questionText: `A patient presents with ${ddx.presentingComplaint.toLowerCase()}. Which finding is a RED FLAG requiring urgent evaluation?`,
        options,
        correctIndex: options.indexOf(correctAnswer),
        explanation: `${correctAnswer} is a red flag for ${ddx.presentingComplaint} that warrants urgent evaluation.`,
        category: ddx.category,
        questionType: 'redFlag',
      };
    }

    default:
      return null;
  }
}

/**
 * Get distractor diagnoses that are plausible but incorrect
 */
function getDistractorDiagnoses(
  correct: string,
  currentDDx: DDxData,
  allDDx: DDxData[],
  count: number
): string[] {
  const distractors: string[] = [];

  // First, try to get distractors from the same presenting complaint's differential list
  const sameComplaintDiagnoses = currentDDx.differentialList.filter(
    (d) => d !== correct && !currentDDx.mustNotMiss?.includes(d)
  );

  distractors.push(...shuffleArray(sameComplaintDiagnoses).slice(0, count));

  // If we need more, get from other DDx entries
  if (distractors.length < count) {
    const otherDiagnoses = allDDx
      .filter((d: (typeof allDDx)[0]) => d.id !== currentDDx.id)
      .flatMap((d: (typeof allDDx)[0]) => d.differentialList)
      .filter((d: string) => d !== correct && !distractors.includes(d));

    distractors.push(...shuffleArray(otherDiagnoses).slice(0, count - distractors.length));
  }

  return distractors.slice(0, count);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp!;
  }
  return shuffled;
}

export function useDifferentialDrill(): UseDDxDrillReturn {
  const { getToken } = useAuth();
  const [ddxData, setDdxData] = useState<DDxData[]>([]);
  const [questions, setQuestions] = useState<DDxQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<DDxDrillStatus>('landing');
  const [error, setError] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  const sessionStartRef = useRef<number>(Date.now());
  const sessionDataRef = useRef({
    questionsAttempted: 0,
    correctAnswers: 0,
    bestStreak: 0,
  });

  const currentQuestion = questions[currentQuestionIndex] || null;

  // Fetch DDx data from API
  const fetchDDxData = useCallback(
    async (category?: string) => {
      setStatus('loading');
      setError(null);

      try {
        const token = await getToken();
        const url = category
          ? `/api/reference/differentials?category=${encodeURIComponent(category)}`
          : '/api/reference/differentials';

        const response = await fetch(url, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch differentials: ${response.statusText}`);
        }

        const result = await response.json();
        const data: DDxData[] = result.data || result;

        if (!data || data.length === 0) {
          throw new Error('No differential diagnosis data available.');
        }

        setDdxData(data);

        // Extract unique categories
        const categories: string[] = [...new Set(data.map((d: (typeof data)[0]) => d.category))];
        setAvailableCategories(categories);

        // Generate questions from DDx data
        const generatedQuestions: DDxQuestion[] = [];
        const shuffledDDx = shuffleArray(data);

        for (const ddx of shuffledDDx.slice(0, 15)) {
          const question = generateDDxQuestion(ddx, data);
          if (question) {
            generatedQuestions.push(question);
          }
        }

        if (generatedQuestions.length === 0) {
          throw new Error('Could not generate questions from available data.');
        }

        setQuestions(shuffleArray(generatedQuestions));
        setCurrentQuestionIndex(0);
        setStatus('playing');
        sessionStartRef.current = Date.now();
        sessionDataRef.current = {
          questionsAttempted: 0,
          correctAnswers: 0,
          bestStreak: 0,
        };
      } catch (err) {
        console.error('DDx drill error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load differential diagnosis data');
        setStatus('error');
      }
    },
    [getToken]
  );

  const submitAnswer = useCallback(
    (index: number) => {
      if (status !== 'playing' || !currentQuestion || userAnswerIndex !== null) return;

      setUserAnswerIndex(index);
      const correct = index === currentQuestion.correctIndex;
      setIsCorrect(correct);
      setTotalAttempts((prev) => prev + 1);
      sessionDataRef.current.questionsAttempted++;

      if (correct) {
        setScore((prev) => prev + 1);
        setStreak((prev) => {
          const newStreak = prev + 1;
          if (newStreak > sessionDataRef.current.bestStreak) {
            sessionDataRef.current.bestStreak = newStreak;
          }
          return newStreak;
        });
        sessionDataRef.current.correctAnswers++;
      } else {
        setStreak(0);
      }

      setStatus('feedback');
    },
    [status, currentQuestion, userAnswerIndex]
  );

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setUserAnswerIndex(null);
      setIsCorrect(null);
      setStatus('playing');
    } else {
      // End of session
      setStatus('complete');

      // Record session stats
      const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const now = new Date().toISOString();
      recordDrillSession({
        drillType: 'ddx_drill',
        startTime: new Date(sessionStartRef.current).toISOString(),
        endTime: now,
        questionsAttempted: sessionDataRef.current.questionsAttempted,
        correctAnswers: sessionDataRef.current.correctAnswers,
        accuracy:
          sessionDataRef.current.questionsAttempted > 0
            ? Math.round(
                (sessionDataRef.current.correctAnswers /
                  sessionDataRef.current.questionsAttempted) *
                  100
              )
            : 0,
        timeSpent: duration,
        bestStreak: sessionDataRef.current.bestStreak,
      });
    }
  }, [currentQuestionIndex, questions.length]);

  const reset = useCallback(() => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setTotalAttempts(0);
    setStreak(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('landing');
    setQuestions([]);
    sessionDataRef.current = {
      questionsAttempted: 0,
      correctAnswers: 0,
      bestStreak: 0,
    };
  }, []);

  const startSession = useCallback(
    (category?: string) => {
      reset();
      fetchDDxData(category);
    },
    [reset, fetchDDxData]
  );

  const exitToMenu = useCallback(() => {
    reset();
  }, [reset]);

  return {
    currentQuestion,
    score,
    totalAttempts,
    streak,
    userAnswerIndex,
    isCorrect,
    status,
    error,
    availableCategories,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
  };
}
