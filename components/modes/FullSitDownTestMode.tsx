import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { QuizView } from '@/components/session/QuizView';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import type { SessionSettings, QuizQuestion } from '@/types/study';

interface FullSitDownTestModeProps {
  /** Callback to navigate back to the menu */
  onExit?: () => void;
  /** Performance tracking callbacks */
  addPerformanceRecord?: (question: QuizQuestion, wasCorrect: boolean) => void;
  addMissedQuestion?: (question: QuizQuestion) => void;
  updateReviewQuestion?: (question: QuizQuestion, wasCorrect: boolean) => void;
  removeDueConcept?: (conditionId: string, taskType: string | null) => void;
  updateLastPerformanceErrorTag?: (tag: string) => void;
  performanceData?: Array<{ isCorrect: boolean }>;
  fontSizeAdjustment?: number;
  setFontSizeAdjustment?: (adjustment: number) => void;
  flaggedQuestions?: QuizQuestion[];
  addFlaggedQuestion?: (question: QuizQuestion) => void;
  removeFlaggedQuestion?: (question: QuizQuestion) => void;
  updateQuestionNote?: (question: QuizQuestion, note: string) => void;
}

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
  const [questionQueue, setQuestionQueue] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate 300-question session
  useEffect(() => {
    const generateSession = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        const response = await fetch(getApiEndpoint(API_ENDPOINTS.SESSION_GENERATE), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            mode: 'mainSession',
            size: 300,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate session: ${response.status}`);
        }

        const data = await response.json();
        if (!data.data?.questionIds) {
          throw new Error('Invalid session response');
        }

        // Create session settings object
        const settings: SessionSettings = {
          mode: 'mainSession',
          count: 300,
          systemFocus: undefined,
          difficulty: 'adaptive',
          sessionId: data.data.sessionId,
        };

        setSessionSettings(settings);
        // The API returns questions array; we can set as initial queue
        if (data.data.questions && Array.isArray(data.data.questions)) {
          setQuestionQueue(data.data.questions);
        } else {
          // If questions not included, we'll need to fetch them individually later
          // For now, leave empty queue; QuizView will fetch via getQuestionClient
          setQuestionQueue([]);
        }
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
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
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
      addPerformanceRecord={addPerformanceRecord}
      addMissedQuestion={addMissedQuestion}
      updateReviewQuestion={updateReviewQuestion}
      removeDueConcept={removeDueConcept}
      updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
      setIsLoading={setIsLoading}
      setError={setError}
      sessionSettings={sessionSettings}
      growthAreas={[]} // Not used for full sit-down test
      onEndSession={handleEndSession}
      onShowMenu={onExit}
      performanceData={performanceData}
      fontSizeAdjustment={fontSizeAdjustment}
      setFontSizeAdjustment={setFontSizeAdjustment}
      flaggedQuestions={flaggedQuestions}
      addFlaggedQuestion={addFlaggedQuestion}
      removeFlaggedQuestion={removeFlaggedQuestion}
      updateQuestionNote={updateQuestionNote}
      isFullSitDownTest={true}
    />
  );
};

export default FullSitDownTestMode;