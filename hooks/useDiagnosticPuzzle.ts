import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { DiagnosticPuzzleDailyPayload } from '@/services/core/diagnosticPuzzleService';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

interface DiagnosticPuzzleHookReturn {
  // Data
  puzzle: DiagnosticPuzzleDailyPayload['puzzle'] | null;
  userState: DiagnosticPuzzleDailyPayload['userState'] | null;
  // Loading states
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  // Actions
  fetchDailyPuzzle: (date?: string) => Promise<void>;
  submitGuess: (guess: string) => Promise<void>;
  // Stats
  stats: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    streak: number;
    guessDistribution: Record<number, number>;
  } | null;
  fetchStats: () => Promise<void>;
}

/**
 * Hook for managing diagnostic puzzle game state and interactions.
 */
export function useDiagnosticPuzzle(): DiagnosticPuzzleHookReturn {
  const { getToken, userId: clerkUserId } = useAuth();
  const [puzzle, setPuzzle] = useState<DiagnosticPuzzleDailyPayload['puzzle'] | null>(null);
  const [userState, setUserState] = useState<DiagnosticPuzzleDailyPayload['userState'] | null>(null);
  const [stats, setStats] = useState<DiagnosticPuzzleHookReturn['stats'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyPuzzle = useCallback(async (date?: string) => {
    if (!clerkUserId) {
      setError('User not authenticated');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const url = date
        ? `/api/diagnostic-puzzle/daily?date=${encodeURIComponent(date)}`
        : '/api/diagnostic-puzzle/daily';
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(getApiEnvelopeError(result, 'Failed to fetch puzzle'));
      }

      const payload = unwrapApiEnvelope<DiagnosticPuzzleDailyPayload>(result);
      setPuzzle(payload.puzzle);
      setUserState(payload.userState);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch diagnostic puzzle:', err);
    } finally {
      setIsLoading(false);
    }
  }, [clerkUserId, getToken]);

  const submitGuess = useCallback(async (guess: string) => {
    if (!clerkUserId || !puzzle) {
      setError('Cannot submit guess without puzzle');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch('/api/diagnostic-puzzle/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ guess }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(getApiEnvelopeError(result, 'Failed to submit guess'));
      }

      const payload = unwrapApiEnvelope<DiagnosticPuzzleDailyPayload>(result);
      setPuzzle(payload.puzzle);
      setUserState(payload.userState);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to submit guess:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [clerkUserId, puzzle, getToken]);

  const fetchStats = useCallback(async () => {
    if (!clerkUserId) return;
    try {
      const token = await getToken();
      const response = await fetch('/api/diagnostic-puzzle/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(getApiEnvelopeError(result, 'Failed to fetch stats'));
      }
      setStats(unwrapApiEnvelope<DiagnosticPuzzleHookReturn['stats']>(result));
    } catch (err) {
      console.error('Failed to fetch diagnostic puzzle stats:', err);
    }
  }, [clerkUserId, getToken]);

  // Auto-fetch daily puzzle on mount
  useEffect(() => {
    if (clerkUserId) {
      fetchDailyPuzzle();
      fetchStats();
    }
  }, [clerkUserId, fetchDailyPuzzle, fetchStats]);

  return {
    puzzle,
    userState,
    isLoading,
    isSubmitting,
    error,
    fetchDailyPuzzle,
    submitGuess,
    stats,
    fetchStats,
  };
}
