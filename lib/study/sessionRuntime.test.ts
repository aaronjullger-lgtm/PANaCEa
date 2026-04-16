import { describe, expect, it } from 'vitest';
import {
  buildStudyReviewQueue,
  createStudySessionProgress,
  createStudySessionRuntimeFromQuestions,
  getReviewQuestionIds,
  normalizeGeneratedStudySession,
  normalizeSessionGeneratePayload,
  normalizeSessionQuestionsResult,
} from '@/lib/study/sessionRuntime';

describe('sessionRuntime', () => {
  it('maps legacy session modes to canonical session generation payloads', () => {
    expect(normalizeSessionGeneratePayload({ mode: 'mainSession', size: 10 })).toMatchObject({
      mode: 'adaptive',
      size: 10,
    });

    expect(normalizeSessionGeneratePayload({ mode: 'drill', size: 8 })).toMatchObject({
      mode: 'focused',
      sessionLane: 'drill',
      size: 8,
    });
  });

  it('normalizes generated sessions into runtime and legacy-friendly shapes', () => {
    const normalized = normalizeGeneratedStudySession(
      {
        sessionId: 'ses_1',
        questions: [
          {
            id: 'q_1',
            question: 'Question 1',
            options: ['A', 'B'],
            correctAnswer: 'B',
            correctAnswerIndex: 1,
            topic: 'Cardiology',
            conditionId: 'cond_1',
          },
        ],
        metadata: {
          dueReviewCount: 1,
          newCardCount: 0,
          systemDistribution: { cardiology: 1 },
          estimatedMinutes: 2,
          mode: 'adaptive',
          source: 'on_demand',
          adaptiveVersion: 'v1',
          selectionMix: {
            dueReviewCount: 1,
            resurfacedCount: 0,
            newCardCount: 0,
          },
        },
      },
      { mode: 'adaptive', size: 20 }
    );

    expect(normalized.generatedSession.questionIds).toEqual(['q_1']);
    expect(normalized.runtime.questions[0]?.correctAnswerIndex).toBe(1);
    expect(normalized.generatedSession.priorityBreakdown).toEqual({ A: 1, B: 0, C: 0 });
    expect(normalized.runtime.metadata.selectionMix).toEqual({
      dueReviewCount: 1,
      resurfacedCount: 0,
      newCardCount: 0,
    });
  });

  it('unwraps session question payload envelopes', () => {
    const result = normalizeSessionQuestionsResult({
      data: {
        questions: [
          {
            question: 'Question 2',
            options: ['A', 'B'],
            correctAnswer: 'A',
            topic: 'Pulm',
            condition: 'Asthma',
          },
        ],
      },
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.id).toMatch(/^localq_/);
    expect(result.questions[0]?.correctAnswerIndex).toBe(0);
  });

  it('creates resumable runtime and review queues from normalized questions', () => {
    const runtime = createStudySessionRuntimeFromQuestions({
      sessionId: 'ses_resume',
      questions: [
        {
          id: 'q_1',
          question: 'Question 1',
          options: ['A', 'B'],
          correctAnswer: 'A',
          system: 'Cardio',
        },
        {
          id: 'q_2',
          question: 'Question 2',
          options: ['A', 'B'],
          correctAnswer: 'B',
          system: 'Pulm',
        },
      ],
      mode: 'adaptive',
    });

    const progress = createStudySessionProgress('ses_resume', {
      responses: [
        {
          id: 'resp_1',
          sessionId: 'ses_resume',
          questionId: 'q_1',
          questionNumber: 1,
          questionIndex: 0,
          result: 'incorrect',
          timeSpentMs: 4000,
          submittedAt: Date.now(),
          syncState: 'queued',
        },
      ],
    });

    expect(runtime.questionIds).toEqual(['q_1', 'q_2']);
    expect(getReviewQuestionIds(progress)).toEqual(['q_1']);
    expect(buildStudyReviewQueue(runtime, progress).map((question) => question.id)).toEqual([
      'q_1',
    ]);
  });
});
