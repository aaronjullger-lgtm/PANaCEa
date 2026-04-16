import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { SessionSettings, Question, PerformanceRecord } from '@/types';
import { QuizViewWithErrorBoundary } from '@/components/session/QuizViewWithErrorBoundary';
import { Loader } from '@/components/loading';
import { EnhancedErrorMessage } from '@/components/shared/EnhancedErrorMessage';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient, createSessionsClient } from '@/lib/sdk';
import type { StudySessionRuntime } from '@/lib/study/sessionRuntime';
import {
  createStudySessionRuntimeFromQuestions,
  normalizeSessionQuestionsResult,
} from '@/lib/study/sessionRuntime';
import { useStudyStore } from '@/lib/stores/useStudyStore';

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
/** Derive growth areas (systems) from session questions for adaptive focus */
function deriveGrowthAreas(questions: Question[]): string[] {
  const systems = new Set<string>();
  for (const q of questions) {
    const sys = (q as { system?: string }).system ?? (q as { condition?: { system?: string } }).condition?.system;
    if (sys && typeof sys === 'string') systems.add(sys);
  }
  return Array.from(systems);
}

function buildSessionSettings(
  questionCount: number,
  runtime: StudySessionRuntime | null
): SessionSettings {
  const requestedSystems =
    runtime?.request.systems?.filter(Boolean) ??
    (runtime?.request.system ? [runtime.request.system] : []);

  return {
    mode: runtime?.metadata.mode === 'exam' ? 'exam' : 'standard',
    focus: runtime?.request.conditionId || runtime?.request.subcategory || runtime?.request.system ? 'topic' : 'all',
    systems: requestedSystems,
    difficulty: runtime?.request.initialDifficulty ?? 'adaptive',
    count: questionCount,
  };
}

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
  const { getToken } = useAuth();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [growthAreas, setGrowthAreas] = useState<string[]>([]);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const cachedSession = useStudyStore.getState().activeSession;
      if (cachedSession?.sessionId === sessionId && cachedSession.questions.length > 0) {
        setQuestions(cachedSession.questions);
        setGrowthAreas(deriveGrowthAreas(cachedSession.questions));
        setSessionSettings(buildSessionSettings(cachedSession.questions.length, cachedSession));
        return;
      }

      const api = createApiClient(getToken);
      const sessions = createSessionsClient(api);
      const result = await sessions.getQuestions(sessionId);
      const questionList = normalizeSessionQuestionsResult(result).questions as Question[];
      setQuestions(questionList);
      setGrowthAreas(deriveGrowthAreas(questionList));
      const hydratedSession = createStudySessionRuntimeFromQuestions({
        sessionId,
        questions: questionList,
        mode: 'adaptive',
      });
      useStudyStore.getState().hydrateSession(hydratedSession);
      setSessionSettings(buildSessionSettings(questionList.length, hydratedSession));
    } catch (err) {
      console.error('Error fetching session:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [getToken, sessionId]);

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
        description={error}
        actions={[
          {
            label: 'Try again',
            action: fetchSession,
            variant: 'primary',
          },
        ]}
        onDismiss={onExit}
      />
    );
  }

  if (!sessionSettings || questions.length === 0) {
    return (
      <EnhancedErrorMessage
        title="Session not found"
        description="The session does not contain any questions."
        onDismiss={onExit}
      />
    );
  }

  return (
    <QuizViewWithErrorBoundary
      modeLabel="Practice → Session"
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
      growthAreas={growthAreas}
      onEndSession={handleEndSession}
      onShowMenu={onExit ?? (() => {})}
      performanceData={performanceData}
      fontSizeAdjustment={fontSizeAdjustment}
      setFontSizeAdjustment={setFontSizeAdjustment}
      flaggedQuestions={flaggedQuestions}
      addFlaggedQuestion={addFlaggedQuestion}
      removeFlaggedQuestion={removeFlaggedQuestion}
      updateQuestionNote={updateQuestionNote}
      sessionId={sessionId}
      queueStrategy="finite"
      onReviewMissed={undefined}
    />
  );
};

export default SessionRunner;
