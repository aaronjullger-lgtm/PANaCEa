import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { QuizView } from '@/components/session/QuizView';
import type { ErrorTag, PerformanceRecord, Question, SessionSettings } from '@/types';
import { InlineSpinner } from '@/components/loading';
import { createApiClient } from '@/lib/sdk';
import { MAX_SESSION_SIZE } from '@/lib/constants/sessionDefaults';
import { useStudyStore } from '@/lib/stores/useStudyStore';
import { generateStudySession } from '@/lib/study/sessionRuntime';

interface FullSitDownTestModeProps {
  /** Callback to navigate back to the menu */
  onExit?: () => void;
  /** Performance tracking callbacks */
  addPerformanceRecord?: (record: PerformanceRecord) => void;
  addMissedQuestion?: (question: Question) => void;
  updateReviewQuestion?: (question: Question, wasCorrect: boolean) => void;
  removeDueConcept?: (conditionId: string, taskType: string | null) => void;
  updateLastPerformanceErrorTag?: (tag: ErrorTag) => void;
  performanceData?: PerformanceRecord[];
  fontSizeAdjustment?: number;
  setFontSizeAdjustment?: React.Dispatch<React.SetStateAction<number>>;
  flaggedQuestions?: Question[];
  addFlaggedQuestion?: (question: Question) => void;
  removeFlaggedQuestion?: (question: Question) => void;
  updateQuestionNote?: (question: Question, note: string) => void;
}

const NOOP = () => undefined;
const NOOP_SET_FONT_SIZE: React.Dispatch<React.SetStateAction<number>> = () => undefined;
const FULL_SIT_DOWN_COUNT = 300;

/**
 * Full Sit-Down Test Mode
 * 
 * A locked-in 300-question exam simulation that generates true exam-day analytics.
 * Uses the same QuizView component with isFullSitDownTest prop enabled.
 */
const FullSitDownTestMode: React.FC<FullSitDownTestModeProps> = ({
  onExit,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  removeDueConcept,
  updateLastPerformanceErrorTag,
  performanceData = [],
  fontSizeAdjustment = 0,
  setFontSizeAdjustment,
  flaggedQuestions = [],
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote,
}) => {
  const { getToken } = useAuth();
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ requested: FULL_SIT_DOWN_COUNT, generated: 0, completedBatches: 0, totalBatches: 0 });

  const generateSession = useCallback(async (forceRegenerate = false) => {
    try {
      setError(null);
      setIsLoading(true);

      if (!forceRegenerate) {
        const cachedSession = useStudyStore.getState().activeSession;
        if (
          cachedSession?.request.size === FULL_SIT_DOWN_COUNT &&
          cachedSession.questions.length >= FULL_SIT_DOWN_COUNT
        ) {
          setSessionSettings({
            mode: 'exam',
            focus: 'all',
            count: FULL_SIT_DOWN_COUNT,
            difficulty: 'adaptive',
          });
          setSessionId(cachedSession.sessionId);
          setQuestionQueue(cachedSession.questions.slice(0, FULL_SIT_DOWN_COUNT));
          setProgress({
            requested: FULL_SIT_DOWN_COUNT,
            generated: FULL_SIT_DOWN_COUNT,
            completedBatches: Math.ceil(FULL_SIT_DOWN_COUNT / MAX_SESSION_SIZE),
            totalBatches: Math.ceil(FULL_SIT_DOWN_COUNT / MAX_SESSION_SIZE),
          });
          return;
        }
      }

      setProgress({
        requested: FULL_SIT_DOWN_COUNT,
        generated: 0,
        completedBatches: 0,
        totalBatches: Math.ceil(FULL_SIT_DOWN_COUNT / MAX_SESSION_SIZE),
      });

      const api = createApiClient(getToken);
      const { generatedSession, runtime } = await generateStudySession(api, {
        mode: 'mainSession',
        size: FULL_SIT_DOWN_COUNT,
        onProgress: (nextProgress) => {
          setProgress({
            requested: nextProgress.requestedQuestions,
            generated: nextProgress.generatedQuestions,
            completedBatches: nextProgress.completedBatches,
            totalBatches: nextProgress.totalBatches,
          });
        },
      });
      useStudyStore.getState().hydrateSession(runtime);

      const settings: SessionSettings = {
        mode: 'exam',
        focus: 'all',
        count: FULL_SIT_DOWN_COUNT,
        difficulty: 'adaptive',
      };

      setSessionSettings(settings);
      setSessionId(generatedSession.sessionId);
      setQuestionQueue(generatedSession.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to generate full sit-down test session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void generateSession(false);
  }, [generateSession]);

  const handleRetry = useCallback(() => {
    void generateSession(true);
  }, [generateSession]);

  const handleEndSession = useCallback(() => {
    // Optionally send analytics before exiting
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div role="status" aria-live="polite" aria-label="Loading exam session" className="text-center">
          <div className="flex justify-center">
            <InlineSpinner size="xl" className="text-primary" />
          </div>
          <p className="mt-4 text-lg">Generating 300‑question exam session…</p>
          <p className="text-sm text-[var(--color-text-muted)]">This may take a moment.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-destructive mb-2">Session Generation Failed</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Retry
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="ml-2 px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-lg"
            >
              Exit
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!sessionSettings) {
    return null; // Should not happen
  }

  return (
    <QuizView
      modeLabel="Practice → Full Sit-Down Test"
      initialQueue={questionQueue}
      setParentQueue={setQuestionQueue}
      addPerformanceRecord={addPerformanceRecord ?? NOOP}
      addMissedQuestion={addMissedQuestion ?? NOOP}
      updateReviewQuestion={updateReviewQuestion ?? NOOP}
      removeDueConcept={removeDueConcept}
      updateLastPerformanceErrorTag={updateLastPerformanceErrorTag ?? NOOP}
      setIsLoading={setIsLoading}
      setError={setError}
      sessionSettings={sessionSettings}
      growthAreas={[]} // Not used for full sit-down test
      onEndSession={handleEndSession}
      onShowMenu={onExit ?? NOOP}
      performanceData={performanceData}
      fontSizeAdjustment={fontSizeAdjustment}
      setFontSizeAdjustment={setFontSizeAdjustment ?? NOOP_SET_FONT_SIZE}
      flaggedQuestions={flaggedQuestions}
      addFlaggedQuestion={addFlaggedQuestion ?? NOOP}
      removeFlaggedQuestion={removeFlaggedQuestion ?? NOOP}
      updateQuestionNote={updateQuestionNote ?? NOOP}
      isFullSitDownTest={true}
      totalQuestions={FULL_SIT_DOWN_COUNT}
      sessionId={sessionId}
      queueStrategy="finite"
    />
  );
};

export default FullSitDownTestMode;
