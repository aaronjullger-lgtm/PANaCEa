import { create } from 'zustand';
import type {
  StudyAttemptRecord,
  StudySessionHistoryRecord,
  StudySessionProgressRecord,
  StudySessionResponseRecord,
  StudySessionRuntime,
  StudySessionSummaryRecord,
} from '@/lib/study/sessionRuntime';
import {
  buildStudyReviewQueue,
  createStudySessionProgress,
  getReviewQuestionIds,
} from '@/lib/study/sessionRuntime';
import {
  clearPersistedActiveStudyProgress,
  clearPersistedActiveStudySession,
  loadPersistedActiveStudyProgress,
  loadPersistedActiveStudySession,
  loadPersistedStudyAttempts,
  loadPersistedStudyHistory,
  loadPersistedStudySummaries,
  savePersistedActiveStudyProgress,
  savePersistedActiveStudySession,
  savePersistedStudyAttempts,
  savePersistedStudyHistory,
  savePersistedStudySummaries,
} from '@/lib/study/persistence';
import type { Question } from '@/types';

interface StudySessionSnapshot {
  session: StudySessionRuntime;
  progress: StudySessionProgressRecord;
  history?: StudySessionHistoryRecord;
}

interface RecordSessionResponseInput {
  sessionId?: string | null;
  questionId: string;
  canonicalQuestionId?: string | null;
  questionNumber: number;
  questionIndex?: number;
  result: 'correct' | 'incorrect';
  selectedAnswer?: string;
  selectedAnswerIndex?: number;
  timeSpentMs: number;
  submittedAt?: number;
  system?: string | null;
  conditionId?: string | null;
  syncState: 'queued' | 'synced' | 'local';
}

interface StudyStoreState {
  activeSession: StudySessionRuntime | null;
  activeProgress: StudySessionProgressRecord | null;
  attemptHistory: StudyAttemptRecord[];
  recentSummaries: StudySessionSummaryRecord[];
  sessionHistory: StudySessionHistoryRecord[];
  hydrateSession: (
    session: StudySessionRuntime,
    options?: { resetProgress?: boolean }
  ) => void;
  resumeSession: (sessionId?: string | null) => void;
  pauseSession: (sessionId?: string | null) => void;
  advanceSession: (sessionId?: string | null) => void;
  recordAttempt: (
    attempt: Omit<StudyAttemptRecord, 'id' | 'submittedAt'> &
      Partial<Pick<StudyAttemptRecord, 'id' | 'submittedAt'>>
  ) => StudyAttemptRecord;
  recordSessionResponse: (
    response: RecordSessionResponseInput
  ) => StudySessionResponseRecord | null;
  completeSession: (summary: StudySessionSummaryRecord) => void;
  getSessionSnapshot: (sessionId: string) => StudySessionSnapshot | null;
  getReviewQuestions: (sessionId: string) => Question[];
  clearActiveSession: () => void;
}

function createResponseRecord(
  response: RecordSessionResponseInput,
  progress: StudySessionProgressRecord
): StudySessionResponseRecord {
  const submittedAt = response.submittedAt ?? Date.now();
  const questionIndex = response.questionIndex ?? progress.currentQuestionIndex;

  return {
    id: `response_${response.sessionId}_${questionIndex}_${submittedAt}`,
    sessionId: response.sessionId ?? progress.sessionId,
    questionId: response.questionId,
    canonicalQuestionId: response.canonicalQuestionId,
    questionNumber: response.questionNumber,
    questionIndex,
    result: response.result,
    selectedAnswer: response.selectedAnswer,
    selectedAnswerIndex: response.selectedAnswerIndex,
    timeSpentMs: response.timeSpentMs,
    submittedAt,
    system: response.system,
    conditionId: response.conditionId,
    syncState: response.syncState,
  };
}

function upsertResponse(
  responses: StudySessionResponseRecord[],
  nextResponse: StudySessionResponseRecord
): StudySessionResponseRecord[] {
  const filtered = responses.filter(
    (response) =>
      !(
        response.questionIndex === nextResponse.questionIndex &&
        response.questionNumber === nextResponse.questionNumber
      )
  );
  return [...filtered, nextResponse].sort((left, right) => left.questionIndex - right.questionIndex);
}

const initialActiveSession = loadPersistedActiveStudySession();
const loadedActiveProgress = loadPersistedActiveStudyProgress();
const initialActiveProgress =
  initialActiveSession && loadedActiveProgress?.sessionId === initialActiveSession.sessionId
    ? loadedActiveProgress
    : null;
const initialAttempts = loadPersistedStudyAttempts();
const initialSummaries = loadPersistedStudySummaries();
const initialHistory = loadPersistedStudyHistory();

if (!initialActiveProgress) {
  clearPersistedActiveStudyProgress();
}

export const useStudyStore = create<StudyStoreState>((set, get) => ({
  activeSession: initialActiveSession,
  activeProgress: initialActiveProgress,
  attemptHistory: initialAttempts,
  recentSummaries: initialSummaries,
  sessionHistory: initialHistory,

  hydrateSession: (session, options) =>
    set((state) => {
      const now = Date.now();
      const nextSession: StudySessionRuntime = {
        ...session,
        updatedAt: now,
      };
      const shouldReuseProgress =
        !options?.resetProgress &&
        state.activeProgress?.sessionId === session.sessionId;
      const previousProgress = shouldReuseProgress ? state.activeProgress : null;
      const nextProgress: StudySessionProgressRecord = previousProgress
        ? {
            ...previousProgress,
            status: 'active',
            lastActiveAt: now,
            pausedAt: null,
            currentQuestionIndex: Math.min(
              previousProgress.currentQuestionIndex,
              Math.max(0, nextSession.questions.length - 1)
            ),
          }
        : createStudySessionProgress(session.sessionId);

      savePersistedActiveStudySession(nextSession);
      savePersistedActiveStudyProgress(nextProgress);

      return {
        activeSession: nextSession,
        activeProgress: nextProgress,
      };
    }),

  resumeSession: (sessionId) =>
    set((state) => {
      if (!state.activeSession || !state.activeProgress) return state;
      if (sessionId && state.activeSession.sessionId !== sessionId) return state;

      const nextProgress: StudySessionProgressRecord = {
        ...state.activeProgress,
        status: 'active',
        pausedAt: null,
        lastActiveAt: Date.now(),
      };
      savePersistedActiveStudyProgress(nextProgress);
      return { activeProgress: nextProgress };
    }),

  pauseSession: (sessionId) =>
    set((state) => {
      if (!state.activeSession || !state.activeProgress) return state;
      if (sessionId && state.activeSession.sessionId !== sessionId) return state;
      if (state.activeProgress.status === 'completed') return state;

      const now = Date.now();
      const nextProgress: StudySessionProgressRecord = {
        ...state.activeProgress,
        status: 'paused',
        pausedAt: now,
        lastActiveAt: now,
      };
      savePersistedActiveStudyProgress(nextProgress);
      return { activeProgress: nextProgress };
    }),

  advanceSession: (sessionId) =>
    set((state) => {
      if (!state.activeSession || !state.activeProgress) return state;
      if (sessionId && state.activeSession.sessionId !== sessionId) return state;

      const totalQuestions = state.activeSession.questions.length;
      const nextProgress: StudySessionProgressRecord = {
        ...state.activeProgress,
        status: 'active',
        pausedAt: null,
        lastActiveAt: Date.now(),
        currentQuestionIndex: Math.min(
          state.activeProgress.currentQuestionIndex + 1,
          totalQuestions
        ),
        questionNumber: Math.min(
          state.activeProgress.questionNumber + 1,
          totalQuestions + 1
        ),
      };
      savePersistedActiveStudyProgress(nextProgress);
      return { activeProgress: nextProgress };
    }),

  recordAttempt: (attempt) => {
    const record: StudyAttemptRecord = {
      ...attempt,
      id:
        attempt.id ??
        `attempt_${attempt.sessionId ?? 'nosession'}_${attempt.questionId}_${attempt.submittedAt ?? Date.now()}`,
      submittedAt: attempt.submittedAt ?? Date.now(),
    };

    set((state) => {
      const nextAttempts = [record, ...state.attemptHistory].slice(0, 250);
      savePersistedStudyAttempts(nextAttempts);
      return { attemptHistory: nextAttempts };
    });

    return record;
  },

  recordSessionResponse: (response) => {
    const targetSessionId = response.sessionId ?? get().activeSession?.sessionId ?? null;
    if (!targetSessionId) return null;

    const activeProgress = get().activeProgress;
    if (!activeProgress || activeProgress.sessionId !== targetSessionId) return null;

    const record = createResponseRecord(
      { ...response, sessionId: targetSessionId },
      activeProgress
    );

    set((state) => {
      if (!state.activeProgress || state.activeProgress.sessionId !== targetSessionId) {
        return state;
      }

      const nextProgress: StudySessionProgressRecord = {
        ...state.activeProgress,
        status: 'active',
        pausedAt: null,
        lastActiveAt: Date.now(),
        responses: upsertResponse(state.activeProgress.responses, record),
      };

      savePersistedActiveStudyProgress(nextProgress);
      return { activeProgress: nextProgress };
    });

    return record;
  },

  completeSession: (summary) =>
    set((state) => {
      const nextSummaries = [summary, ...state.recentSummaries].slice(0, 12);
      savePersistedStudySummaries(nextSummaries);

      const isActiveSession = state.activeSession?.sessionId === summary.sessionId;
      const isActiveProgress = state.activeProgress?.sessionId === summary.sessionId;
      const runtime = isActiveSession ? state.activeSession : null;
      const progress =
        isActiveProgress && state.activeProgress
          ? {
              ...state.activeProgress,
              status: 'completed' as const,
              pausedAt: null,
              completedAt: Date.now(),
              lastActiveAt: Date.now(),
            }
          : null;

      const nextHistory =
        runtime && progress
          ? [
              {
                sessionId: summary.sessionId,
                runtime,
                progress,
                summary,
                reviewQuestionIds: getReviewQuestionIds(progress),
              },
              ...state.sessionHistory.filter(
                (record) => record.sessionId !== summary.sessionId
              ),
            ].slice(0, 12)
          : state.sessionHistory;

      savePersistedStudyHistory(nextHistory);

      if (isActiveSession) {
        clearPersistedActiveStudySession();
      }
      if (isActiveProgress) {
        clearPersistedActiveStudyProgress();
      }

      return {
        recentSummaries: nextSummaries,
        sessionHistory: nextHistory,
        activeSession: isActiveSession ? null : state.activeSession,
        activeProgress: isActiveProgress ? null : state.activeProgress,
      };
    }),

  getSessionSnapshot: (sessionId) => {
    const state = get();
    if (
      state.activeSession?.sessionId === sessionId &&
      state.activeProgress?.sessionId === sessionId
    ) {
      return {
        session: state.activeSession,
        progress: state.activeProgress,
      };
    }

    const historicalRecord = state.sessionHistory.find(
      (record) => record.sessionId === sessionId
    );
    if (!historicalRecord) return null;

    return {
      session: historicalRecord.runtime,
      progress: historicalRecord.progress,
      history: historicalRecord,
    };
  },

  getReviewQuestions: (sessionId) => {
    const snapshot = get().getSessionSnapshot(sessionId);
    if (!snapshot) return [];
    return buildStudyReviewQueue(snapshot.session, snapshot.progress);
  },

  clearActiveSession: () =>
    set(() => {
      clearPersistedActiveStudySession();
      clearPersistedActiveStudyProgress();
      return {
        activeSession: null,
        activeProgress: null,
      };
    }),
}));

export const useStudy = useStudyStore;
