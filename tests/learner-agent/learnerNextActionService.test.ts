import { describe, it, expect } from 'vitest';
import {
  rankCandidatesForTest,
  type RankedCandidate,
} from '@/lib/services/learner/learnerNextActionService';
import {
  surgeryRotationCandidates,
  EXPECTED_SURGERY_PRIMARY_ACTION_ID,
  SURGERY_ROTATION_LEARNER,
} from './surgeryRotationFixture';

describe('learnerNextActionService — surgery rotation fixture', () => {
  it('ranks overdue FSRS above rotation and assignment tasks', () => {
    const ranked = rankCandidatesForTest(surgeryRotationCandidates());
    expect(ranked[0]?.id).toBe(EXPECTED_SURGERY_PRIMARY_ACTION_ID);
    expect(ranked[0]?.type).toBe('fsrs_review_session');
  });

  it('does not promote assignment without beating overdue FSRS score', () => {
    const candidates = surgeryRotationCandidates();
    const fsrs = candidates.find((c) => c.type === 'fsrs_review_session')!;
    const assignment = candidates.find((c) => c.id.includes('plan-task'))!;
    expect(fsrs.score).toBeGreaterThan(assignment.score);
  });

  it('fixture reflects surgery rotation constraints', () => {
    expect(SURGERY_ROTATION_LEARNER.profile.currentRotation).toBe('Surgery');
    expect(SURGERY_ROTATION_LEARNER.dueItemCounts.overdueFsrs).toBeGreaterThan(0);
    expect(SURGERY_ROTATION_LEARNER.availableMinutes).toBeLessThanOrEqual(45);
  });

  it('tie-breaks by lexicographic id when scores equal', () => {
    const tied: RankedCandidate[] = [
      {
        id: 'nba:z',
        type: 'plan_task',
        title: 'Z',
        score: 50,
        estimatedMinutes: 10,
        whyNow: 'z',
        launchRoute: '/study',
        launchParams: {},
        sources: [],
      },
      {
        id: 'nba:a',
        type: 'plan_task',
        title: 'A',
        score: 50,
        estimatedMinutes: 10,
        whyNow: 'a',
        launchRoute: '/study',
        launchParams: {},
        sources: [],
      },
    ];
    const ranked = rankCandidatesForTest(tied);
    expect(ranked[0]?.id).toBe('nba:a');
  });
});
