/**
 * Deidentified PA student fixture — surgery rotation start.
 * Used to verify deterministic NBA balances FSRS, rotation, assignments, time.
 */

import type { RankedCandidate } from '@/lib/services/learner/learnerNextActionService';

export const SURGERY_ROTATION_LEARNER = {
  userId: 'fixture-user-surgery-001',
  profile: {
    examDate: '2026-11-01T00:00:00.000Z',
    currentRotation: 'Surgery',
    rotationEndDate: '2026-08-15T00:00:00.000Z',
    dailyGoal: 30,
    sessionLengthMinutes: 45,
    preferredSystems: ['GI', 'CV'],
  },
  dueItemCounts: {
    overdueFsrs: 12,
    dueTodayFsrs: 5,
    pendingPlanTasks: 2,
  },
  allocation: {
    recommendedSplit: 'targeted_heavy' as const,
    retentionPriority: 82,
    readinessPriority: 45,
    recommendedTargetedCount: 18,
    recommendedMainCount: 8,
    mainSystems: ['GI'],
    targetedConditions: ['appendicitis', 'cholecystitis'],
    reasonSummary: 'Retention priority is elevated due to overdue FSRS cards.',
    generatedAt: new Date('2026-07-15T12:00:00.000Z'),
  },
  assignments: [
    {
      id: 'plan-task-surg-1',
      title: 'Surgery EOR: acute abdomen',
      dueAt: '2026-07-16T08:00:00.000Z',
      status: 'pending',
      mode: 'targeted',
      estimatedMinutes: 25,
      rationale: 'Rotation-aligned block',
    },
  ],
  availableMinutes: 40,
};

/** Candidates mirroring engine inputs for pure ranking tests */
export function surgeryRotationCandidates(): RankedCandidate[] {
  return [
    {
      id: 'nba:fsrs_overdue:appendicitis',
      type: 'fsrs_review_session',
      title: 'Targeted review: 12 overdue topics',
      score: 112,
      estimatedMinutes: 36,
      whyNow: '12 FSRS reviews are overdue.',
      launchRoute: '/study',
      launchParams: { mode: 'targeted', lane: 'targeted', count: '20' },
      sources: [{ type: 'fsrs', detail: '12 overdue UserProgress rows' }],
    },
    {
      id: 'nba:plan:plan-task-surg-1',
      type: 'plan_task',
      title: 'Surgery EOR: acute abdomen',
      score: 100,
      estimatedMinutes: 25,
      whyNow: 'Rotation-aligned block due tomorrow.',
      launchRoute: '/study',
      launchParams: { mode: 'targeted' },
      sources: [{ type: 'study_plan', detail: 'DailyStudyPlan task plan-task-surg-1' }],
    },
    {
      id: 'nba:allocator_targeted',
      type: 'targeted_drill',
      title: 'Targeted retention session',
      score: 96.4,
      estimatedMinutes: 36,
      whyNow: SURGERY_ROTATION_LEARNER.allocation.reasonSummary,
      launchRoute: '/study',
      launchParams: { mode: 'targeted', lane: 'targeted', count: '18' },
      sources: [{ type: 'allocator', detail: 'retentionPriority=82' }],
    },
    {
      id: 'nba:rotation_weak:GI',
      type: 'main_readiness_session',
      title: 'Surgery: strengthen GI',
      score: 85,
      estimatedMinutes: 30,
      whyNow: 'During Surgery, GI accuracy is below 70%.',
      launchRoute: '/study',
      launchParams: { mode: 'main', lane: 'eor', system: 'GI' },
      sources: [{ type: 'rotation', detail: 'Surgery systems GI,CV,MSK' }],
    },
  ];
}

export const EXPECTED_SURGERY_PRIMARY_ACTION_ID = 'nba:fsrs_overdue:appendicitis';
