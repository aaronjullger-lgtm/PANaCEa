import { useCallback, useEffect, useState } from 'react';
import type { MedicalWordleGame } from '@/types';

export type WordleStatus = 'playing' | 'won' | 'lost';

interface WordleApiWord {
  id: string;
  buzzword: string;
  condition: string;
  system: string;
  subcategory?: string | null;
  explanation?: string | null;
}

interface WordleApiResponse {
  id: string;
  date: string;
  word: WordleApiWord;
  userState: {
    guesses: string[];
    status: WordleStatus;
    attemptsLeft: number;
    maxAttempts: number;
  };
}

const mapPayloadToGame = (payload: WordleApiResponse): MedicalWordleGame => {
  const hintClass = payload.word.subcategory || payload.word.explanation || undefined;

  return {
    id: payload.id,
    date: payload.date,
    targetWord: payload.word.buzzword.toUpperCase(),
    category: payload.word.system ?? 'Medical',
    hints: {
      class: hintClass,
      system: payload.word.system,
    },
  };
};

const parseApiResponse = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | WordleApiResponse | null;

  if (!response.ok) {
    const err = payload as { error?: string; message?: string } | null;
    const errorMessage = err?.error || err?.message || 'Wordle request failed';
    throw new Error(errorMessage);
  }

  return payload as WordleApiResponse;
};

const fetchWordleResource = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  return parseApiResponse(response);
};

export function useWordleGame() {
  const [game, setGame] = useState<MedicalWordleGame | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [status, setStatus] = useState<WordleStatus>('playing');
  const [attemptsLeft, setAttemptsLeft] = useState(6);
  const [maxAttempts, setMaxAttempts] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateFromPayload = useCallback((payload: WordleApiResponse) => {
    setGame(mapPayloadToGame(payload));
    setGuesses(payload.userState.guesses);
    setStatus(payload.userState.status);
    setAttemptsLeft(payload.userState.attemptsLeft);
    setMaxAttempts(payload.userState.maxAttempts);
  }, []);

  const loadDailyWord = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchWordleResource('/api/games/wordle/daily', {
        credentials: 'include',
      });
      updateFromPayload(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Wordle data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [updateFromPayload]);

  useEffect(() => {
    loadDailyWord();
  }, [loadDailyWord]);

  const submitGuess = useCallback(
    async (guess: string) => {
      try {
        const payload = await fetchWordleResource('/api/games/wordle/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ guess }),
        });
        updateFromPayload(payload);
        return payload;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to submit guess';
        throw new Error(message);
      }
    },
    [updateFromPayload]
  );

  return {
    game,
    guesses,
    status,
    attemptsLeft,
    maxAttempts,
    loading,
    error,
    submitGuess,
    refetch: loadDailyWord,
  };
}
