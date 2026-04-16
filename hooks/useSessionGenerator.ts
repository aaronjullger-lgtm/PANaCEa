/**
 * useSessionGenerator Hook
 *
 * Handles the generation of new Main Sessions using the Priority Waterfall algorithm.
 * Calls the /api/study/session/generate endpoint and navigates to the session.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

import {
  getPerformanceMetrics,
  getNextDifficultyLevel,
  DifficultyLevel,
} from '@/lib/services/progressiveDifficultyService';
import { createApiClient } from '@/lib/sdk';
import { generateStudySession, type GenerateStudySessionOptions } from '@/lib/study/sessionRuntime';
import { useStudyStore } from '@/lib/stores/useStudyStore';

// =============================================================================
// TYPES
// =============================================================================

export interface GenerateSessionOptions extends GenerateStudySessionOptions {}

export interface GeneratedSession {
  sessionId: string;
  mode: string;
  questionIds: string[];
  priorityBreakdown: {
    A: number;
    B: number;
    C: number;
  };
  deficitsAddressed: Array<{
    system: string;
    deficitPercent: number;
  }>;
  interleavingEnforced: boolean;
  message: string;
  initialDifficulty?: DifficultyLevel;
}

interface UseSessionGeneratorReturn {
  generateSession: (options: GenerateSessionOptions) => Promise<GeneratedSession | null>;
  isGenerating: boolean;
  error: Error | null;
  lastSession: GeneratedSession | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSessionGenerator(): UseSessionGeneratorReturn {
  const { getToken, userId } = useAuth();
  const navigate = useNavigate();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastSession, setLastSession] = useState<GeneratedSession | null>(null);

  const generateSession = useCallback(
    async (options: GenerateSessionOptions): Promise<GeneratedSession | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        let initialDifficulty: DifficultyLevel | undefined = undefined;

        if (options.adaptive && userId) {
          const metrics = await getPerformanceMetrics(userId);
          initialDifficulty = getNextDifficultyLevel(metrics, 'medium'); // Start with medium and adjust
        }

        const api = createApiClient(getToken);
        const { generatedSession, runtime } = await generateStudySession(api, {
          ...options,
          initialDifficulty,
        });

        const session: GeneratedSession = generatedSession;
        setLastSession(session);
        useStudyStore.getState().hydrateSession(runtime);

        // Navigate to the session
        navigate(`/session/${session.sessionId}`, {
          state: {
            mode: session.mode,
            questionIds: session.questionIds,
            priorityBreakdown: session.priorityBreakdown,
            adaptive: options.adaptive,
            initialDifficulty: session.initialDifficulty,
          },
        });

        return session;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [getToken, navigate, userId]
  );

  return {
    generateSession,
    isGenerating,
    error,
    lastSession,
  };
}

export default useSessionGenerator;
