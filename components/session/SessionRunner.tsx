import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import type { SessionSettings, Question, PerformanceRecord } from '@/types';
import { QuizViewWithErrorBoundary } from '@/components/session/QuizViewWithErrorBoundary';
import Loader from '@/components/loading/Loader';
import { EnhancedErrorMessage } from '@/components/shared/EnhancedErrorMessage';

interface SessionRunnerProps {
  /** Callback to navigate back to the menu */
  onExit?: () => void;
  /** Function to add a performance record */
  addPerformanceRecord: (record: PerformanceRecord) => void;
  /** Function to add a missed question */
  addMissedQuestion: (question: Question) => void;
  /** Function to update review question */
  updateReviewQuestion: (question: Question, wasCorrect: boolean) => void;
  /** Update last performance error tag */
  updateLastPerformanceErrorTag: (tag: any) => void;
  /** Current performance data */
  performanceData: PerformanceRecord[];
  /** Font size adjustment */
  fontSizeAdjustment: number;
  /** Set font size adjustment */
  setFontSizeAdjustment: React.Dispatch<React.SetStateAction<number>>;
  /** Flagged questions */
  flaggedQuestions: Question[];
  /** Add flagged question */
  addFlaggedQuestion: (question: Question) => void;
  /** Remove flagged question */
  removeFlaggedQuestion: (question: Question) => void;
  /** Update question note */
  updateQuestionNote: (question: Question, note: string) => void;
  /** When user answers a Due sibling correctly, remove that concept from the Due queue */
  removeDueConcept?: (conditionId: string, taskType: string | null) => void;
}

/**
 * SessionRunner – resumes a previously generated study session by its ID.
 * Fetches the session's questions and renders the QuizView with the stored order.
 */
const SessionRunner: React.FC<SessionRunnerProps> = ({
  onExit,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  updateLastPerformanceErrorTag,
  performanceData,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  flaggedQuestions,
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote,
  removeDueConcept,
}) => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.SESSION_QUESTIONS(sessionId)));
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch session: ${response.status} ${text}`);
      }
      const json = await response.json();
      const questions =
        json?.data?.questions ?? json?.questions ?? [];
      setQuestions(Array.isArray(questions) ? questions : []);

      // Construct minimal SessionSettings from the session metadata (if available).
      // For now, we use defaults; could be extended if the endpoint returns session metadata.
      const settings: SessionSettings = {
        mode: 'standard',
        focus: 'all',
        systems: [],
        difficulty: 'adaptive',
      };
      setSessionSettings(settings);
    } catch (err) {
      console.error('Error fetching session:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleEndSession = useCallback(() => {
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  if (loading) {
    return <Loader message="Loading session…" />;
  }

  if (error) {
    return (
      <EnhancedErrorMessage
        title="Could not load session"
        message={error}
        action={{
          label: 'Try again',
          onClick: fetchSession,
        }}
        onBack={onExit}
      />
    );
  }

  if (!sessionSettings || questions.length === 0) {
    return (
      <EnhancedErrorMessage
        title="Session not found"
        message="The session does not contain any questions."
        onBack={onExit}
      />
    );
  }

  return (
    <QuizViewWithErrorBoundary
      initialQueue={questions}
      setParentQueue={setQuestions}
      addPerformanceRecord={addPerformanceRecord}
      addMissedQuestion={addMissedQuestion}
      updateReviewQuestion={updateReviewQuestion}
      removeDueConcept={removeDueConcept}
      updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
      setIsLoading={setLoading}
      setError={setError}
      sessionSettings={sessionSettings}
      growthAreas={[]} // TODO: could be derived from session metadata
      onEndSession={handleEndSession}
      onShowMenu={onExit}
      performanceData={performanceData}
      fontSizeAdjustment={fontSizeAdjustment}
      setFontSizeAdjustment={setFontSizeAdjustment}
      flaggedQuestions={flaggedQuestions}
      addFlaggedQuestion={addFlaggedQuestion}
      removeFlaggedQuestion={removeFlaggedQuestion}
      updateQuestionNote={updateQuestionNote}
      onReviewMissed={
        performanceData.some((p) => !p.isCorrect) ? () => {/* TODO: implement review missed */} : undefined
      }
    />
  );
};

export default SessionRunner;