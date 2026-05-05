import { describe, expect, it } from 'vitest';
import {
  buildCoreAdaptiveSessionSettings,
  buildStudyPlanCompletionPayloadFromSummary,
  flushQueuedReviewsForSessionSummary,
} from './CoreAdaptiveSession';

describe('buildCoreAdaptiveSessionSettings', () => {
  const blueprint = {
    weights: { Pulmonary: 0.5, Cardiovascular: 0.5 },
    gatedSystems: [],
    label: 'PANCE readiness',
    examTypes: ['PANCE'],
    stage: 'pance',
    urgencyMultiplier: 1.4,
  };

  it('keeps condition id and learner-facing condition name separate for study-plan targets', () => {
    const settings = buildCoreAdaptiveSessionSettings({
      blueprint,
      studyPlanSource: 'study-plan',
      sessionScope: {
        mode: 'condition',
        size: 12,
        system: 'Pulmonary',
        conditionId: 'pulmonary-embolism',
        conditionName: 'Pulmonary Embolism',
      },
    });

    expect(settings).toEqual(
      expect.objectContaining({
        mode: 'targeted',
        focus: 'topic',
        topic: 'Pulmonary Embolism',
        conditionId: 'pulmonary-embolism',
        conditionName: 'Pulmonary Embolism',
        count: 12,
      })
    );
  });

  it('does not reuse condition ids as condition names when no label is available', () => {
    const settings = buildCoreAdaptiveSessionSettings({
      blueprint,
      studyPlanSource: 'study-plan',
      sessionScope: {
        mode: 'condition',
        size: 12,
        conditionId: 'pulmonary-embolism',
      },
    });

    expect(settings.topic).toBe('pulmonary-embolism');
    expect(settings.conditionId).toBe('pulmonary-embolism');
    expect(settings.conditionName).toBeUndefined();
  });

  it('marks dedicated system-drill launches as targeted topic work', () => {
    const settings = buildCoreAdaptiveSessionSettings({
      blueprint,
      studyPlanSource: 'mode-library',
      sessionScope: {
        mode: 'system',
        size: 20,
        system: 'Pulmonary',
        systems: ['Pulmonary'],
      },
    });

    expect(settings).toEqual(
      expect.objectContaining({
        mode: 'targeted',
        focus: 'topic',
        topic: 'Pulmonary',
        systems: ['Pulmonary'],
        count: 20,
        interleaveMode: 'focused',
      })
    );
  });

  it('marks dedicated condition-drill launches as targeted topic work', () => {
    const settings = buildCoreAdaptiveSessionSettings({
      blueprint,
      studyPlanSource: 'mode-library',
      sessionScope: {
        mode: 'condition',
        size: 10,
        system: 'Pulmonary',
        conditionId: 'asthma',
        conditionName: 'Asthma',
      },
    });

    expect(settings).toEqual(
      expect.objectContaining({
        mode: 'targeted',
        focus: 'topic',
        topic: 'Asthma',
        conditionId: 'asthma',
        conditionName: 'Asthma',
        count: 10,
      })
    );
  });

  it('preserves explicit study-plan launch settings such as review focus', () => {
    const settings = buildCoreAdaptiveSessionSettings({
      blueprint,
      studyPlanSource: 'study-plan',
      studyPlanTaskId: 'task-1',
      studyPlanDate: '2026-05-02',
      sessionScope: {
        mode: 'adaptive',
        size: 8,
      },
      launchSettings: {
        mode: 'review',
        focus: 'review',
        count: 8,
        questionCount: 8,
      },
    });

    expect(settings).toEqual(
      expect.objectContaining({
        mode: 'review',
        focus: 'review',
        count: 8,
        questionCount: 8,
        systems: ['Pulmonary', 'Cardiovascular'],
        studyPlanTaskId: 'task-1',
        studyPlanDate: '2026-05-02',
        studyPlanSource: 'study-plan',
        urgencyMultiplier: 1.4,
      })
    );
  });

  it('does not attach study-plan telemetry context to manual launches', () => {
    const settings = buildCoreAdaptiveSessionSettings({
      blueprint,
      studyPlanSource: 'manual',
      studyPlanTaskId: 'task-1',
      studyPlanDate: '2026-05-02',
      sessionScope: {
        mode: 'adaptive',
        size: 8,
      },
    });

    expect(settings.studyPlanTaskId).toBeUndefined();
    expect(settings.studyPlanDate).toBeUndefined();
    expect(settings.studyPlanSource).toBeUndefined();
  });
});

describe('flushQueuedReviewsForSessionSummary', () => {
  it('flushes queued reviews with a fresh auth token before session summary', async () => {
    const syncAll = async (token?: string | null) => {
      expect(token).toBe('token-123');
    };

    await expect(
      flushQueuedReviewsForSessionSummary({
        getToken: async () => 'token-123',
        syncAll,
      })
    ).resolves.toBe(true);
  });

  it('returns false without throwing when queued review sync fails', async () => {
    const warnings: unknown[] = [];

    await expect(
      flushQueuedReviewsForSessionSummary({
        getToken: async () => 'token-123',
        syncAll: async () => {
          throw new Error('network down');
        },
        logger: { warn: (...args: unknown[]) => warnings.push(args) },
      })
    ).resolves.toBe(false);
    expect(warnings).toHaveLength(1);
  });
});

describe('buildStudyPlanCompletionPayloadFromSummary', () => {
  it('uses persisted answers instead of planned questions for completion metrics', () => {
    const payload = buildStudyPlanCompletionPayloadFromSummary({
      summary: {
        totalQuestions: 20,
        persistedAnswers: 3,
        correctAnswers: 2,
      },
      reviewSyncFlushed: true,
      planDate: '2026-05-03',
      taskId: 'task-1',
      sessionId: 'session-1',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        action: 'complete',
        planDate: '2026-05-03',
        taskId: 'task-1',
        actualQuestionsAnswered: 3,
        actualAccuracy: 2 / 3,
        linkedSessionId: 'session-1',
      })
    );
  });

  it('does not complete a study-plan task when answers have not synced', () => {
    expect(
      buildStudyPlanCompletionPayloadFromSummary({
        summary: {
          totalQuestions: 20,
          persistedAnswers: 0,
          correctAnswers: 0,
        },
        reviewSyncFlushed: true,
        planDate: '2026-05-03',
        taskId: 'task-1',
        sessionId: 'session-1',
      })
    ).toBeNull();

    expect(
      buildStudyPlanCompletionPayloadFromSummary({
        summary: {
          totalQuestions: 3,
          persistedAnswers: 3,
          correctAnswers: 2,
        },
        reviewSyncFlushed: false,
        planDate: '2026-05-03',
        taskId: 'task-1',
        sessionId: 'session-1',
      })
    ).toBeNull();
  });
});
