import { describe, expect, it } from 'vitest';

import {
  buildGeneratedStudySessionRecord,
  buildLegacyPriorityBreakdown,
  buildSessionModeLabel,
  buildSessionSettingsFromSnapshot,
  mapLaunchModeToSessionRequestMode,
  normalizeSessionGenerateResult,
  normalizeSessionQuestion,
} from '../lib/sessionGeneration';
import type { SessionGenerateResult } from '../lib/api/types/sessions';

function buildSessionResult(
  overrides: Partial<SessionGenerateResult> = {}
): SessionGenerateResult {
  return {
    sessionId: 'session-123',
    questions: [
      {
        id: 'q-1',
        question: 'Question 1',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        correctAnswerIndex: 0,
        source: 'due_review',
      },
      {
        id: 'q-2',
        question: 'Question 2',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        correctAnswerIndex: 1,
        source: 'new_card',
      },
    ],
    metadata: {
      dueReviewCount: 1,
      newCardCount: 1,
      systemDistribution: { Cardiovascular: 1, Pulmonary: 1 },
      estimatedMinutes: 3,
      mode: 'adaptive',
      source: 'on_demand',
    },
    ...overrides,
  };
}

describe('sessionGeneration helpers', () => {
  it('maps legacy launch modes onto live API modes', () => {
    expect(mapLaunchModeToSessionRequestMode('mainSession')).toBe('adaptive');
    expect(mapLaunchModeToSessionRequestMode('review')).toBe('review');
    expect(mapLaunchModeToSessionRequestMode('drill')).toBe('focused');
  });

  it('builds a legacy priority breakdown from metadata when none exists', () => {
    expect(
      buildLegacyPriorityBreakdown({
        dueReviewCount: 6,
        newCardCount: 4,
      })
    ).toEqual({ A: 6, B: 0, C: 4 });
  });

  it('normalizes generated sessions by deriving questionIds and fallback buckets', () => {
    const result = normalizeSessionGenerateResult(buildSessionResult());

    expect(result.questionIds).toEqual(['q-1', 'q-2']);
    expect(result.priorityBreakdown).toEqual({ A: 1, B: 0, C: 1 });
  });

  it('preserves explicit legacy fields when the server already provided them', () => {
    const result = normalizeSessionGenerateResult(
      buildSessionResult({
        questionIds: ['server-q-1', 'server-q-2'],
        priorityBreakdown: { A: 4, B: 2, C: 1 },
      })
    );

    expect(result.questionIds).toEqual(['server-q-1', 'server-q-2']);
    expect(result.priorityBreakdown).toEqual({ A: 4, B: 2, C: 1 });
  });

  it('normalizes question objects into QuizView-safe shape', () => {
    const question = normalizeSessionQuestion({
      id: 'q-3',
      question: 'Which diagnosis is most likely?',
      options: ['A. Asthma', 'B. COPD', 'C. PE', 'D. CHF'],
      correctAnswer: 'C',
      explanation: 'Pulmonary embolism best fits the presentation.',
      system: 'Pulmonary',
      condition: { name: 'Pulmonary Embolism', system: 'Pulmonary' },
      tags: ['Pulmonary Embolism'],
    });

    expect(question.correctAnswerIndex).toBe(2);
    expect(question.correctAnswer).toBe('C. PE');
    expect(question.condition).toBe('Pulmonary Embolism');
    expect(question.conditionId).toBe('pulmonary-embolism');
    expect(question.rationale).toContain('Pulmonary embolism');
    expect(question.topic).toBe('Pulmonary Embolism');
  });

  it('clamps invalid answer indexes to the available options', () => {
    const question = normalizeSessionQuestion({
      id: 'q-4',
      question: 'Which diagnosis is most likely?',
      options: ['A. Asthma', 'B. COPD', 'C. PE', 'D. CHF'],
      correctAnswerIndex: 9,
      correctAnswer: 'E',
    });

    expect(question.correctAnswerIndex).toBe(3);
    expect(question.correctAnswer).toBe('D. CHF');
  });

  it('returns -1 (never option A) when correctAnswer is unresolvable — patient safety', () => {
    // Patient-safety invariant: if we can't resolve the correctAnswer, we must
    // NOT silently fall back to 0 (option A). Return -1 so the question scores
    // as always-wrong and the data bug surfaces in analytics/logs instead of
    // mis-grading the student.
    const question = normalizeSessionQuestion({
      id: 'q-bad',
      question: 'Which diagnosis is most likely?',
      options: ['A. Asthma', 'B. COPD', 'C. PE', 'D. CHF'],
      correctAnswer: 'Sarcoidosis', // not in options, not a letter, not an index
    });

    expect(question.correctAnswerIndex).toBe(-1);
    // correctAnswer string is preserved so admins can see the bad data
    expect(question.correctAnswer).toBe('Sarcoidosis');
  });

  it('returns -1 when both correctAnswerIndex and correctAnswer are missing', () => {
    const question = normalizeSessionQuestion({
      id: 'q-empty',
      question: 'Which diagnosis is most likely?',
      options: ['A. Asthma', 'B. COPD', 'C. PE', 'D. CHF'],
      // no correctAnswer, no correctAnswerIndex
    });

    expect(question.correctAnswerIndex).toBe(-1);
  });

  it('builds persisted study-session metadata from the generated result', () => {
    const normalized = normalizeSessionGenerateResult(buildSessionResult());
    const record = buildGeneratedStudySessionRecord({
      request: {
        mode: 'focused',
        initialDifficulty: 'hard',
        systems: ['Pulmonary'],
        blueprintStage: 'clinical',
        blueprintExamTypes: ['EOR'],
        blueprintLabel: 'Pulmonary EOR',
        sessionLane: 'eor',
      },
      result: normalized,
    });

    expect(record.focus).toBe('growth');
    expect(record.difficulty).toBe('hard');
    expect(record.systemsTargeted).toEqual(['Pulmonary']);
    expect(record.questionIds).toEqual(['q-1', 'q-2']);
    expect(record.sessionType).toBe('eor');
  });

  it('reconstructs runner settings from a persisted snapshot', () => {
    const settings = buildSessionSettingsFromSnapshot(
      {
        id: 'session-123',
        mode: 'review',
        focus: 'review',
        difficulty: 'adaptive',
        systemsTargeted: ['Cardiovascular'],
        blueprintStage: 'general',
        blueprintLabel: 'PANCE',
        totalQuestions: 20,
      },
      ['Pulmonary']
    );

    expect(settings.mode).toBe('review');
    expect(settings.focus).toBe('review');
    expect(settings.systems).toEqual(['Cardiovascular', 'Pulmonary']);
    expect(settings.questionCount).toBe(20);
    expect(settings.stage).toBe('general');
  });

  it('builds a more specific mode label from stored session metadata', () => {
    expect(
      buildSessionModeLabel({
        id: 'session-123',
        mode: 'condition',
        systemsTargeted: [],
      })
    ).toBe('Practice → Targeted Session');
  });
});
