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
import { mapLaunchModeToSessionRequestMode } from '@/lib/sessionGeneration';
import {
  generateStudySession,
  type GeneratedStudySession,
  type GenerateStudySessionOptions,
} from '@/lib/study/sessionRuntime';
import { useStudyStore } from '@/lib/stores/useStudyStore';

// =============================================================================
// TYPES
// =============================================================================

export type GenerateSessionOptions = GenerateStudySessionOptions;

export type GeneratedSession = GeneratedStudySession;

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
        const requestMode = mapLaunchModeToSessionRequestMode(options.mode);
        const { generatedSession, runtime } = await generateStudySession(api, {
          mode: requestMode,
          size: options.size || 20,
          systems: options.systems,
          initialDifficulty,
          sessionLane: options.mode === 'drill' ? 'drill' : 'main',
        });

        const session = generatedSession;
        setLastSession(session);
        useStudyStore.getState().hydrateSession(runtime);

        // Navigate to the session
        const isAdaptiveSession =
          options.adaptive ?? (requestMode === 'adaptive' || requestMode === 'focused');

        navigate(`/session/${session.sessionId}`, {
          state: {
            mode: requestMode,
            questionIds: session.questionIds,
            priorityBreakdown: session.priorityBreakdown,
            adaptive: isAdaptiveSession,
            initialDifficulty: session.initialDifficulty ?? initialDifficulty,
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
