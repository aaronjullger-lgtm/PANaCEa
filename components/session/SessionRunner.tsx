import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import type { SessionSettings, Question, PerformanceRecord } from '@/types';
import { QuizViewWithErrorBoundary } from '@/components/session/QuizViewWithErrorBoundary';
import { Loader } from '@/components/loading';
import { EnhancedErrorMessage } from '@/components/shared/EnhancedErrorMessage';
import type { StudySessionSnapshot } from '@/lib/api/types';
import {
  buildSessionModeLabel,
  buildSessionSettingsFromSnapshot,
} from '@/lib/sessionGeneration';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractSessionPayload(payload: unknown): {
  questions: Question[];
  session: StudySessionSnapshot | null;
} {
  if (!isRecord(payload)) {
    return { questions: [], session: null };
  }

  const nestedData = isRecord(payload.data) ? payload.data : null;
  const rawQuestions = nestedData?.questions ?? payload.questions;
  const rawSession = nestedData?.session ?? payload.session;

  return {
    questions: Array.isArray(rawQuestions) ? (rawQuestions as Question[]) : [],
    session: isStudySessionSnapshot(rawSession) ? rawSession : null,
  };
}

function isStudySessionSnapshot(value: unknown): value is StudySessionSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.systemsTargeted)
  );
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
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [growthAreas, setGrowthAreas] = useState<string[]>([]);
  const [sessionSnapshot, setSessionSnapshot] = useState<StudySessionSnapshot | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        throw new Error('Sign in to resume this session.');
      }

      const response = await fetch(getApiEndpoint(API_ENDPOINTS.SESSION_QUESTIONS(sessionId)), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.error?.message ??
          body?.message ??
          `Failed to fetch session: ${response.status}`;
        throw new Error(message);
      }
      const json = await response.json();
      const { questions: questionList, session } = extractSessionPayload(json);
      const derivedGrowthAreas = deriveGrowthAreas(questionList);
      setQuestions(questionList);
      setGrowthAreas(derivedGrowthAreas);
      setSessionSnapshot(session);

      const settings: SessionSettings = buildSessionSettingsFromSnapshot(
        session,
        derivedGrowthAreas
      );
      setSessionSettings(settings);
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
      modeLabel={buildSessionModeLabel(sessionSnapshot)}
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
