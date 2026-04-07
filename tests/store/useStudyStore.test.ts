/**
 * Tests for the Zustand study store.
 *
 * Verifies state transitions, selector helpers, and daily progress
 * auto-reset logic for the centralized study state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStudyStore, selectDueCount, selectGoalPercent, selectDailyProgress } from '../../store/useStudyStore';

describe('useStudyStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useStudyStore.setState({
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
        date: new Date().toLocaleDateString('en-CA'),
      },
      activeSession: {
        isActive: false,
        sessionType: null,
        startedAt: null,
        questionsCompleted: 0,
        focusArea: null,
      },
    });
  });

  describe('SRS Summary', () => {
    it('should set SRS summary with timestamp', () => {
      const before = Date.now();
      useStudyStore.getState().setSRSSummary({ dueCount: 42, overdueCount: 5 });
      const state = useStudyStore.getState();

      expect(state.srs.dueCount).toBe(42);
      expect(state.srs.overdueCount).toBe(5);
      expect(state.srs.lastFetchedAt).toBeGreaterThanOrEqual(before);
    });

    it('should decrement due count but not below 0', () => {
      useStudyStore.getState().setSRSSummary({ dueCount: 2 });
      useStudyStore.getState().decrementDueCount();
      expect(useStudyStore.getState().srs.dueCount).toBe(1);

      useStudyStore.getState().decrementDueCount();
      expect(useStudyStore.getState().srs.dueCount).toBe(0);

      useStudyStore.getState().decrementDueCount();
      expect(useStudyStore.getState().srs.dueCount).toBe(0); // stays at 0
    });

    it('selectDueCount should return dueCount slice', () => {
      useStudyStore.getState().setSRSSummary({ dueCount: 17 });
      expect(selectDueCount(useStudyStore.getState())).toBe(17);
    });
  });

  describe('Daily Progress', () => {
    it('should record correct and incorrect answers', () => {
      const { recordAnswer } = useStudyStore.getState();
      recordAnswer(true);
      recordAnswer(true);
      recordAnswer(false);

      const state = useStudyStore.getState();
      expect(state.dailyProgress.questionsAnswered).toBe(3);
      expect(state.dailyProgress.correctCount).toBe(2);
    });

    it('should accumulate study time', () => {
      useStudyStore.getState().addStudyTime(15);
      useStudyStore.getState().addStudyTime(10);
      expect(useStudyStore.getState().dailyProgress.studyMinutes).toBe(25);
    });

    it('should update daily goal', () => {
      useStudyStore.getState().setDailyGoal(60);
      expect(useStudyStore.getState().dailyProgress.dailyGoal).toBe(60);
    });

    it('selectGoalPercent should compute correctly', () => {
      useStudyStore.getState().setDailyGoal(10);
      useStudyStore.getState().recordAnswer(true);
      useStudyStore.getState().recordAnswer(false);
      useStudyStore.getState().recordAnswer(true);

      expect(selectGoalPercent(useStudyStore.getState())).toBeCloseTo(0.3, 5);
    });

    it('selectGoalPercent should cap at 1.0', () => {
      useStudyStore.getState().setDailyGoal(2);
      useStudyStore.getState().recordAnswer(true);
      useStudyStore.getState().recordAnswer(true);
      useStudyStore.getState().recordAnswer(true);

      expect(selectGoalPercent(useStudyStore.getState())).toBe(1);
    });

    it('selectGoalPercent should return 0 for goal=0', () => {
      useStudyStore.getState().setDailyGoal(0);
      useStudyStore.getState().recordAnswer(true);
      expect(selectGoalPercent(useStudyStore.getState())).toBe(0);
    });

    it('should reset daily progress', () => {
      useStudyStore.getState().recordAnswer(true);
      useStudyStore.getState().addStudyTime(30);
      useStudyStore.getState().resetDailyProgress();

      const state = useStudyStore.getState();
      expect(state.dailyProgress.questionsAnswered).toBe(0);
      expect(state.dailyProgress.studyMinutes).toBe(0);
    });
  });

  describe('Active Session', () => {
    it('should start and end a session', () => {
      useStudyStore.getState().startSession('drill', 'Cardiology');

      let session = useStudyStore.getState().activeSession;
      expect(session.isActive).toBe(true);
      expect(session.sessionType).toBe('drill');
      expect(session.focusArea).toBe('Cardiology');
      expect(session.startedAt).toBeGreaterThan(0);

      useStudyStore.getState().endSession();
      session = useStudyStore.getState().activeSession;
      expect(session.isActive).toBe(false);
      expect(session.sessionType).toBeNull();
    });

    it('should increment session questions', () => {
      useStudyStore.getState().startSession('main');
      useStudyStore.getState().incrementSessionQuestions();
      useStudyStore.getState().incrementSessionQuestions();

      expect(useStudyStore.getState().activeSession.questionsCompleted).toBe(2);
    });

    it('should reset questions on new session start', () => {
      useStudyStore.getState().startSession('main');
      useStudyStore.getState().incrementSessionQuestions();
      useStudyStore.getState().incrementSessionQuestions();
      useStudyStore.getState().startSession('drill'); // new session

      expect(useStudyStore.getState().activeSession.questionsCompleted).toBe(0);
    });
  });
});
