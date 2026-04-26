import { useCallback, useMemo } from 'react';
import { useStudyStore } from '@/lib/stores/useStudyStore';
import type {
  StudySessionProgressRecord,
  StudySessionResponseRecord,
  StudySessionRuntime,
  StudySessionSummaryRecord,
} from '@/lib/study/sessionRuntime';

interface UseStudySessionEngineResult {
  session: StudySessionRuntime | null;
  progress: StudySessionProgressRecord | null;
  reviewQuestions: StudySessionRuntime['questions'];
  hydrateSession: (
    session: StudySessionRuntime,
    options?: { resetProgress?: boolean }
  ) => void;
  resumeSession: () => void;
  pauseSession: () => void;
  advanceSession: () => void;
  recordSessionResponse: (
    response: Omit<StudySessionResponseRecord, 'id' | 'sessionId'>
  ) => StudySessionResponseRecord | null;
  completeSession: (summary: StudySessionSummaryRecord) => void;
  clearActiveSession: () => void;
}

export function useStudySessionEngine(
  sessionId?: string | null
): UseStudySessionEngineResult {
  const activeSession = useStudyStore((state) => state.activeSession);
  const activeProgress = useStudyStore((state) => state.activeProgress);
  const sessionHistory = useStudyStore((state) => state.sessionHistory);
  const hydrateSession = useStudyStore((state) => state.hydrateSession);
  const resumeSession = useStudyStore((state) => state.resumeSession);
  const pauseSession = useStudyStore((state) => state.pauseSession);
  const advanceSession = useStudyStore((state) => state.advanceSession);
  const recordSessionResponse = useStudyStore(
    (state) => state.recordSessionResponse
  );
  const completeSession = useStudyStore((state) => state.completeSession);
  const getReviewQuestions = useStudyStore((state) => state.getReviewQuestions);
  const clearActiveSession = useStudyStore((state) => state.clearActiveSession);

  const snapshot = useMemo(() => {
    if (!sessionId) {
      if (activeSession && activeProgress) {
        return {
          session: activeSession,
          progress: activeProgress,
        };
      }
      return null;
    }

    if (
      activeSession?.sessionId === sessionId &&
      activeProgress?.sessionId === sessionId
    ) {
      return {
        session: activeSession,
        progress: activeProgress,
      };
    }

    const historicalRecord = sessionHistory.find(
      (record) => record.sessionId === sessionId
    );
    if (!historicalRecord) return null;

    return {
      session: historicalRecord.runtime,
      progress: historicalRecord.progress,
    };
  }, [activeProgress, activeSession, sessionHistory, sessionId]);

  const reviewQuestions = useMemo(
    () => (sessionId ? getReviewQuestions(sessionId) : []),
    [getReviewQuestions, sessionId]
  );

  const boundResumeSession = useCallback(() => {
    if (!sessionId) return;
    resumeSession(sessionId);
  }, [resumeSession, sessionId]);

  const boundPauseSession = useCallback(() => {
    if (!sessionId) return;
    pauseSession(sessionId);
  }, [pauseSession, sessionId]);

  const boundAdvanceSession = useCallback(() => {
    if (!sessionId) return;
    advanceSession(sessionId);
  }, [advanceSession, sessionId]);

  const boundRecordSessionResponse = useCallback(
    (response: Omit<StudySessionResponseRecord, 'id' | 'sessionId'>) => {
      if (!sessionId) return null;
      return recordSessionResponse({
        sessionId,
        questionId: response.questionId,
        canonicalQuestionId: response.canonicalQuestionId,
        questionNumber: response.questionNumber,
        questionIndex: response.questionIndex,
        result: response.result,
        selectedAnswer: response.selectedAnswer,
        selectedAnswerIndex: response.selectedAnswerIndex,
        timeSpentMs: response.timeSpentMs,
        submittedAt: response.submittedAt,
        system: response.system,
        conditionId: response.conditionId,
        syncState: response.syncState,
      });
    },
    [recordSessionResponse, sessionId]
  );

  return {
    session: snapshot?.session ?? null,
    progress: snapshot?.progress ?? null,
    reviewQuestions,
    hydrateSession,
    resumeSession: boundResumeSession,
    pauseSession: boundPauseSession,
    advanceSession: boundAdvanceSession,
    recordSessionResponse: boundRecordSessionResponse,
    completeSession,
    clearActiveSession,
  };
}

export default useStudySessionEngine;
