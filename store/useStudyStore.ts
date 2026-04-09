/**
 * useStudyStore — Zustand store for globally-shared study state
 *
 * Centralizes state that multiple components need without prop drilling:
 * - SRS schedule summary (due counts, next review)
 * - Active study session metadata (not full session state — that stays in SessionContext)
 * - Daily progress tracking (questions answered, time studied)
 *
 * This store does NOT replace SessionContext or useSRSItems. It holds
 * derived/summary data that components like NavRail badges, DrillHub counts,
 * and DashboardPage metrics all need simultaneously.
 *
 * Why Zustand over Context:
 * - Selective subscriptions: components only re-render for the slice they use
 * - No provider nesting: accessible anywhere without wrapping
 * - Built-in devtools support
 * - Persist middleware for offline-first
 *
 * @module store/useStudyStore
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SRSScheduleSummary {
  /** Total items due for review right now */
  dueCount: number;
  /** Items overdue by more than 1 day */
  overdueCount: number;
  /** Items due within the next 24 hours */
  upcomingCount: number;
  /** Total items in the SRS system */
  totalCards: number;
  /** When this summary was last fetched */
  lastFetchedAt: number | null;
}

export interface DailyProgress {
  /** Questions answered today (all types) */
  questionsAnswered: number;
  /** Questions answered correctly today */
  correctCount: number;
  /** Total study time in minutes today */
  studyMinutes: number;
  /** Daily goal (from preferences) */
  dailyGoal: number;
  /** Date string (YYYY-MM-DD) this progress applies to */
  date: string;
}

export interface ActiveSessionMeta {
  /** Whether a study session is currently active */
  isActive: boolean;
  /** Session type — covers all Prisma SessionType values (lowercase) */
  sessionType: 'main' | 'drill' | 'cram' | 'rapid_recall' | 'grand_rounds' | 'osce' | 'pance_simulator' | null;
  /** When the session started */
  startedAt: number | null;
  /** Questions completed in this session */
  questionsCompleted: number;
  /** Session focus area (organ system, rotation, etc.) */
  focusArea: string | null;
}

interface StudyStoreState {
  // ── Slices ────────────────────────────────────────────────────────────
  srs: SRSScheduleSummary;
  dailyProgress: DailyProgress;
  activeSession: ActiveSessionMeta;

  // ── SRS Actions ───────────────────────────────────────────────────────
  /** Update the SRS schedule summary (called after fetching from API) */
  setSRSSummary: (summary: Partial<SRSScheduleSummary>) => void;
  /** Decrement due count by 1 (optimistic update after answering a review) */
  decrementDueCount: () => void;

  // ── Daily Progress Actions ────────────────────────────────────────────
  /** Record a completed question */
  recordAnswer: (correct: boolean) => void;
  /** Add study time in minutes */
  addStudyTime: (minutes: number) => void;
  /** Set the daily goal (from preferences) */
  setDailyGoal: (goal: number) => void;
  /** Reset daily progress (called at midnight or date change) */
  resetDailyProgress: () => void;

  // ── Session Actions ───────────────────────────────────────────────────
  /** Mark a session as started */
  startSession: (type: ActiveSessionMeta['sessionType'], focusArea?: string) => void;
  /** Mark a session as ended */
  endSession: () => void;
  /** Increment questions completed in the active session */
  incrementSessionQuestions: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
function todayString(): string {
  // toLocaleDateString('en-CA') reliably produces YYYY-MM-DD across browsers
  return new Date().toLocaleDateString('en-CA');
}

// ── Store ────────────────────────────────────────────────────────────────

export const useStudyStore = create<StudyStoreState>()(
  devtools(
    subscribeWithSelector((set) => ({
      // ── Initial State ─────────────────────────────────────────────────
      srs: {
        dueCount: 0,
        overdueCount: 0,
        upcomingCount: 0,
        totalCards: 0,
        lastFetchedAt: null,
      },

      dailyProgress: {
        questionsAnswered: 0,
        correctCount: 0,
        studyMinutes: 0,
        dailyGoal: 40,
        date: todayString(),
      },

      activeSession: {
        isActive: false,
        sessionType: null,
        startedAt: null,
        questionsCompleted: 0,
        focusArea: null,
      },

      // ── SRS Actions ─────────────────────────────────────────────────
      setSRSSummary: (summary) =>
        set(
          (state) => ({
            srs: {
              ...state.srs,
              ...summary,
              lastFetchedAt: Date.now(),
            },
          }),
          false,
          'srs/setSummary'
        ),

      decrementDueCount: () =>
        set(
          (state) => ({
            srs: {
              ...state.srs,
              dueCount: Math.max(0, state.srs.dueCount - 1),
            },
          }),
          false,
          'srs/decrementDue'
        ),

      // ── Daily Progress Actions ────────────────────────────────────────
      recordAnswer: (correct) =>
        set(
          (state) => {
            const today = todayString();
            // Auto-reset if date changed
            const isNewDay = state.dailyProgress.date !== today;
            return {
              dailyProgress: {
                ...state.dailyProgress,
                questionsAnswered: isNewDay
                  ? 1
                  : state.dailyProgress.questionsAnswered + 1,
                correctCount: isNewDay
                  ? (correct ? 1 : 0)
                  : state.dailyProgress.correctCount + (correct ? 1 : 0),
                studyMinutes: isNewDay ? 0 : state.dailyProgress.studyMinutes,
                date: today,
              },
            };
          },
          false,
          'daily/recordAnswer'
        ),

      addStudyTime: (minutes) =>
        set(
          (state) => ({
            dailyProgress: {
              ...state.dailyProgress,
              studyMinutes: state.dailyProgress.studyMinutes + minutes,
            },
          }),
          false,
          'daily/addTime'
        ),

      setDailyGoal: (goal) =>
        set(
          (state) => ({
            dailyProgress: {
              ...state.dailyProgress,
              dailyGoal: goal,
            },
          }),
          false,
          'daily/setGoal'
        ),

      resetDailyProgress: () =>
        set(
          {
            dailyProgress: {
              questionsAnswered: 0,
              correctCount: 0,
              studyMinutes: 0,
              dailyGoal: 40,
              date: todayString(),
            },
          },
          false,
          'daily/reset'
        ),

      // ── Session Actions ─────────────────────────────────────────────
      startSession: (type, focusArea) =>
        set(
          {
            activeSession: {
              isActive: true,
              sessionType: type,
              startedAt: Date.now(),
              questionsCompleted: 0,
              focusArea: focusArea ?? null,
            },
          },
          false,
          'session/start'
        ),

      endSession: () =>
        set(
          {
            activeSession: {
              isActive: false,
              sessionType: null,
              startedAt: null,
              questionsCompleted: 0,
              focusArea: null,
            },
          },
          false,
          'session/end'
        ),

      incrementSessionQuestions: () =>
        set(
          (state) => ({
            activeSession: {
              ...state.activeSession,
              questionsCompleted: state.activeSession.questionsCompleted + 1,
            },
          }),
          false,
          'session/incrementQuestions'
        ),
    })),
    { name: 'PANaCEa Study Store' }
  )
);

// ── Selector helpers (for selective subscriptions) ──────────────────────

/** Use: const dueCount = useStudyStore(selectDueCount) */
export const selectDueCount = (state: StudyStoreState) => state.srs.dueCount;

/** Use: const progress = useStudyStore(selectDailyProgress) */
export const selectDailyProgress = (state: StudyStoreState) => state.dailyProgress;

/** Use: const isInSession = useStudyStore(selectIsInSession) */
export const selectIsInSession = (state: StudyStoreState) => state.activeSession.isActive;

/** Use: const goalPercent = useStudyStore(selectGoalPercent) */
export const selectGoalPercent = (state: StudyStoreState) => {
  const { questionsAnswered, dailyGoal } = state.dailyProgress;
  return dailyGoal > 0 ? Math.min(1, questionsAnswered / dailyGoal) : 0;
};

/** Use: const srsSummary = useStudyStore(selectSRSSummary) */
export const selectSRSSummary = (state: StudyStoreState) => state.srs;
