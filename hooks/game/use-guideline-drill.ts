import { useState, useCallback, useMemo, useEffect } from 'react';
import { guidelineService } from '@/services/domain';
import type { Guideline, GuidelineCase } from '@/types/guidelines';

export type GuidelineDrillStatus = 'menu' | 'selecting' | 'playing' | 'feedback' | 'summary';

export interface GuidelineSessionResult {
  guidelineId: string;
  guidelineName: string;
  cases: {
    caseId: string;
    userScore: number;
    correctScore: number;
    isCorrect: boolean;
  }[];
  totalCorrect: number;
  totalAttempts: number;
}

export interface UseGuidelineDrillReturn {
  currentGuideline: Guideline | null;
  currentVignette: GuidelineCase | null;
  currentVignetteIndex: number;
  totalVignettes: number;
  userScore: number | null;
  isCorrect: boolean | null;
  score: number;
  streak: number;
  status: GuidelineDrillStatus;
  allGuidelines: Guideline[];
  sessionResult: GuidelineSessionResult | null;
  isLoading: boolean;
  selectGuideline: (guidelineId: string) => void;
  submitScore: (score: number) => void;
  nextVignette: () => void;
  reset: () => void;
  exitToMenu: () => void;
  backToSelection: () => void;
}

export function useGuidelineDrill(): UseGuidelineDrillReturn {
  const [currentGuideline, setCurrentGuideline] = useState<Guideline | null>(null);
  const [currentVignetteIndex, setCurrentVignetteIndex] = useState(0);
  const [userScore, setUserScore] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState<GuidelineDrillStatus>('menu');
  const [sessionResults, setSessionResults] = useState<GuidelineSessionResult['cases']>([]);
  const [allGuidelines, setAllGuidelines] = useState<Guideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGuidelines = async () => {
      try {
        const data = await guidelineService.getAllGuidelines();
        setAllGuidelines(data);
      } catch (error) {
        console.error('Failed to load guidelines', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadGuidelines();
  }, []);

  const currentVignette = useMemo((): GuidelineCase | null => {
    if (!currentGuideline || currentVignetteIndex >= currentGuideline.vignettes.length) {
      return null;
    }
    return currentGuideline.vignettes[currentVignetteIndex] ?? null;
  }, [currentGuideline, currentVignetteIndex]);

  const totalVignettes = currentGuideline?.vignettes.length ?? 0;

  const sessionResult: GuidelineSessionResult | null = useMemo(() => {
    if (status !== 'summary' || !currentGuideline) return null;
    return {
      guidelineId: currentGuideline.id,
      guidelineName: currentGuideline.name,
      cases: sessionResults,
      totalCorrect: sessionResults.filter((r) => r.isCorrect).length,
      totalAttempts: sessionResults.length,
    };
  }, [status, currentGuideline, sessionResults]);

  const selectGuideline = useCallback(
    (guidelineId: string) => {
      const guideline = allGuidelines.find((g) => g.id === guidelineId);
      if (!guideline) return;

      setCurrentGuideline(guideline);
      setCurrentVignetteIndex(0);
      setUserScore(null);
      setIsCorrect(null);
      setScore(0);
      setStreak(0);
      setSessionResults([]);
      setStatus('playing');
    },
    [allGuidelines]
  );

  const submitScore = useCallback(
    (submittedScore: number) => {
      if (!currentVignette || status !== 'playing') return;

      setUserScore(submittedScore);

      const correct = submittedScore === currentVignette.correctScore;
      setIsCorrect(correct);

      if (correct) {
        setScore((prev) => prev + 1);
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }

      setSessionResults((prev) => [
        ...prev,
        {
          caseId: currentVignette.id,
          userScore: submittedScore,
          correctScore: currentVignette.correctScore,
          isCorrect: correct,
        },
      ]);

      setStatus('feedback');
    },
    [currentVignette, status]
  );

  const nextVignette = useCallback(() => {
    if (!currentGuideline) return;

    if (currentVignetteIndex >= currentGuideline.vignettes.length - 1) {
      setStatus('summary');
      return;
    }

    setCurrentVignetteIndex((prev) => prev + 1);
    setUserScore(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [currentGuideline, currentVignetteIndex]);

  const reset = useCallback(() => {
    if (!currentGuideline) return;

    setCurrentVignetteIndex(0);
    setUserScore(null);
    setIsCorrect(null);
    setScore(0);
    setStreak(0);
    setSessionResults([]);
    setStatus('playing');
  }, [currentGuideline]);

  const exitToMenu = useCallback(() => {
    setCurrentGuideline(null);
    setCurrentVignetteIndex(0);
    setUserScore(null);
    setIsCorrect(null);
    setScore(0);
    setStreak(0);
    setSessionResults([]);
    setStatus('menu');
  }, []);

  const backToSelection = useCallback(() => {
    setCurrentGuideline(null);
    setCurrentVignetteIndex(0);
    setUserScore(null);
    setIsCorrect(null);
    setScore(0);
    setStreak(0);
    setSessionResults([]);
    setStatus('selecting');
  }, []);

  return {
    currentGuideline,
    currentVignette,
    currentVignetteIndex,
    totalVignettes,
    userScore,
    isCorrect,
    score,
    streak,
    status,
    allGuidelines,
    sessionResult,
    isLoading,
    selectGuideline,
    submitScore,
    nextVignette,
    reset,
    exitToMenu,
    backToSelection,
  };
}
