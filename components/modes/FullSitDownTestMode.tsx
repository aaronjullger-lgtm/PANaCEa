import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { QuizView } from '@/components/session/QuizView';
import type { ErrorTag, PerformanceRecord, Question, SessionSettings } from '@/types';
import { mapLaunchModeToSessionRequestMode } from '@/lib/sessionGeneration';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractGeneratedSession(payload: unknown): { sessionId: string; questions: Question[] } | null {
  if (!isRecord(payload)) return null;

  const root = isRecord(payload.data) ? payload.data : payload;
  if (typeof root.sessionId !== 'string') return null;

  return {
    sessionId: root.sessionId,
    questions: Array.isArray(root.questions) ? (root.questions as Question[]) : [],
  };
}

const NOOP = () => undefined;
const NOOP_SET_FONT_SIZE: React.Dispatch<React.SetStateAction<number>> = () => undefined;

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

  // Generate 300-question session
  useEffect(() => {
    const generateSession = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        const response = await fetch('/api/study/session/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            mode: mapLaunchModeToSessionRequestMode('mainSession'),
            size: 300,
            sessionLane: 'main',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate session: ${response.status}`);
        }

        const data = extractGeneratedSession(await response.json());
        if (!data) {
          throw new Error('Invalid session response');
        }

        const settings: SessionSettings = {
          mode: 'exam',
          focus: 'all',
          count: 300,
          difficulty: 'adaptive',
        };

        setSessionSettings(settings);
        setSessionId(data.sessionId);
        setQuestionQueue(data.questions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to generate full sit-down test session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    generateSession();
  }, [getToken]);

  const handleEndSession = useCallback(() => {
    // Optionally send analytics before exiting
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div role="status" aria-label="Loading exam session" className="text-center">
          <div aria-hidden="true" className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg">Generating 300‑question exam session…</p>
          <p className="text-sm text-muted-foreground">This may take a moment.</p>
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
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Retry
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="ml-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg"
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
      totalQuestions={300}
      sessionId={sessionId}
    />
  );
};

export default FullSitDownTestMode;
