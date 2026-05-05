import { describe, expect, it, vi } from 'vitest';
import {
  buildLearningIdentityRecommendations,
  runLearningIdentityAudit,
  type LearningIdentityProbe,
  type LearningIdentityProbeResult,
} from '../scripts/db/audit-learning-identity';

describe('learning identity audit', () => {
  it('runs probes as read-only query pairs and normalizes counts and samples', async () => {
    const probes: LearningIdentityProbe[] = [
      {
        id: 'question_attempt_missing_question',
        description: 'missing attempt target',
        countSql: 'SELECT count FROM attempts',
        sampleSql: 'SELECT sample FROM attempts',
      },
      {
        id: 'user_progress_missing_medical_content',
        description: 'missing progress target',
        countSql: 'SELECT count FROM progress',
        sampleSql: 'SELECT sample FROM progress',
      },
    ];
    const prisma = {
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([
          { id: 'attempt-1', createdAt: new Date('2026-05-01T12:00:00Z') },
        ])
        .mockResolvedValueOnce([{ count: BigInt(1) }])
        .mockResolvedValueOnce([{ id: 'progress-1', conditionId: 'legacy-cond' }]),
    };

    const report = await runLearningIdentityAudit(prisma, probes);

    expect(report.readOnly).toBe(true);
    expect(report.totalIssues).toBe(3);
    expect(report.probes).toEqual([
      {
        id: 'question_attempt_missing_question',
        description: 'missing attempt target',
        count: 2,
        samples: [{ id: 'attempt-1', createdAt: '2026-05-01T12:00:00.000Z' }],
      },
      {
        id: 'user_progress_missing_medical_content',
        description: 'missing progress target',
        count: 1,
        samples: [{ id: 'progress-1', conditionId: 'legacy-cond' }],
      },
    ]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(4);
  });

  it('adds targeted recommendations for unresolved progress and session identity', () => {
    const probes: LearningIdentityProbeResult[] = [
      {
        id: 'study_session_question_table_missing',
        description: '',
        count: 1,
        samples: [],
      },
      {
        id: 'user_progress_missing_medical_content',
        description: '',
        count: 4,
        samples: [],
      },
      {
        id: 'study_session_question_ids_unresolved',
        description: '',
        count: 2,
        samples: [],
      },
      {
        id: 'review_log_source_without_question_or_pregen',
        description: '',
        count: 1,
        samples: [],
      },
    ];

    const recommendations = buildLearningIdentityRecommendations(probes);

    expect(recommendations.join('\n')).toContain('UserProgress.conditionId');
    expect(recommendations.join('\n')).toContain('StudySessionQuestion links');
    expect(recommendations.join('\n')).toContain('StudySession.questionIds');
    expect(recommendations.join('\n')).toContain('ReviewLog source identity');
  });
});
