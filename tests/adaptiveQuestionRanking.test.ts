import { describe, expect, it } from 'vitest';
import {
  allocateAdaptiveSystemCounts,
  buildAdaptiveProfileSnapshot,
  buildAdaptiveSystemWeaknessMap,
  buildAdaptiveTopicMasteryMap,
  scoreAdaptiveCandidate,
} from '../lib/study/adaptiveQuestionRanking';

describe('adaptiveQuestionRanking', () => {
  const now = new Date('2026-04-15T12:00:00.000Z');

  it('marks recent unrecovered misses as resurfacing candidates', () => {
    const snapshot = buildAdaptiveProfileSnapshot({
      now,
      progress: [],
      conditionAccuracy: [],
      reviewSignals: [],
      attemptSignals: [
        {
          questionId: 'q-missed',
          conditionId: 'cond-weak',
          system: 'Cardiovascular',
          wasCorrect: false,
          createdAt: new Date('2026-04-15T00:00:00.000Z'),
        },
      ],
    });

    expect(snapshot.questions['q-missed']?.resurfacingEligible).toBe(true);
    expect(snapshot.questions['q-missed']?.resurfacingUrgency).toBeGreaterThan(0);
  });

  it('builds weaker scores for low-accuracy, due conditions than for mastered ones', () => {
    const snapshot = buildAdaptiveProfileSnapshot({
      now,
      progress: [
        {
          conditionId: 'cond-weak',
          system: 'Cardiovascular',
          nextReviewAt: new Date('2026-04-10T12:00:00.000Z'),
          stability: 3,
          totalAttempts: 6,
          correctCount: 2,
          accuracy: 2 / 6,
        },
        {
          conditionId: 'cond-strong',
          system: 'Pulmonary',
          nextReviewAt: new Date('2026-05-10T12:00:00.000Z'),
          stability: 28,
          totalAttempts: 8,
          correctCount: 8,
          accuracy: 1,
        },
      ],
      conditionAccuracy: [],
      reviewSignals: [
        {
          conditionId: 'cond-weak',
          system: 'Cardiovascular',
          wasCorrect: false,
          reviewedAt: new Date('2026-04-14T12:00:00.000Z'),
        },
        {
          conditionId: 'cond-weak',
          system: 'Cardiovascular',
          wasCorrect: false,
          reviewedAt: new Date('2026-04-13T12:00:00.000Z'),
        },
        {
          conditionId: 'cond-strong',
          system: 'Pulmonary',
          wasCorrect: true,
          reviewedAt: new Date('2026-04-14T12:00:00.000Z'),
        },
        {
          conditionId: 'cond-strong',
          system: 'Pulmonary',
          wasCorrect: true,
          reviewedAt: new Date('2026-04-13T12:00:00.000Z'),
        },
      ],
      attemptSignals: [],
    });

    const weak = snapshot.conditions['cond-weak'];
    const strong = snapshot.conditions['cond-strong'];

    expect(weak?.weaknessScore).toBeGreaterThan(strong?.weaknessScore ?? 0);
    expect((strong?.masteryScore ?? 0)).toBeGreaterThan(weak?.masteryScore ?? 0);
  });

  it('scores weak-area new questions above mastered-area new questions', () => {
    const snapshot = buildAdaptiveProfileSnapshot({
      now,
      progress: [
        {
          conditionId: 'cond-weak',
          system: 'Cardiovascular',
          nextReviewAt: new Date('2026-04-12T12:00:00.000Z'),
          stability: 4,
          totalAttempts: 7,
          correctCount: 3,
          accuracy: 3 / 7,
        },
        {
          conditionId: 'cond-mastered',
          system: 'Pulmonary',
          nextReviewAt: new Date('2026-04-25T12:00:00.000Z'),
          stability: 30,
          totalAttempts: 10,
          correctCount: 9,
          accuracy: 0.9,
        },
      ],
      conditionAccuracy: [],
      reviewSignals: [],
      attemptSignals: [],
    });

    const weakScore = scoreAdaptiveCandidate(
      {
        questionId: 'q-weak',
        conditionId: 'cond-weak',
        system: 'Cardiovascular',
        source: 'new_card',
        blueprintWeight: 0.11,
      },
      snapshot
    );

    const strongScore = scoreAdaptiveCandidate(
      {
        questionId: 'q-strong',
        conditionId: 'cond-mastered',
        system: 'Pulmonary',
        source: 'new_card',
        blueprintWeight: 0.09,
      },
      snapshot
    );

    expect(weakScore.total).toBeGreaterThan(strongScore.total);
  });

  it('allocates more questions to weaker systems while respecting caps', () => {
    const snapshot = buildAdaptiveProfileSnapshot({
      now,
      progress: [
        {
          conditionId: 'cond-weak',
          system: 'Cardiovascular',
          nextReviewAt: new Date('2026-04-11T12:00:00.000Z'),
          stability: 4,
          totalAttempts: 8,
          correctCount: 3,
          accuracy: 3 / 8,
        },
        {
          conditionId: 'cond-strong',
          system: 'Pulmonary',
          nextReviewAt: new Date('2026-04-30T12:00:00.000Z'),
          stability: 26,
          totalAttempts: 8,
          correctCount: 8,
          accuracy: 1,
        },
      ],
      conditionAccuracy: [],
      reviewSignals: [],
      attemptSignals: [],
    });

    const allocation = allocateAdaptiveSystemCounts({
      totalCount: 9,
      systems: ['Cardiovascular', 'Pulmonary'],
      blueprintWeights: { Cardiovascular: 0.11, Pulmonary: 0.09 },
      snapshot,
      perSystemCaps: { Cardiovascular: 5, Pulmonary: 5 },
      maxSingleSystemFraction: 0.5,
    });

    expect(allocation.Cardiovascular).toBeGreaterThan(allocation.Pulmonary);
    expect(allocation.Cardiovascular).toBeLessThanOrEqual(5);
  });

  it('exposes derived mastery and weakness maps for shared consumers', () => {
    const snapshot = buildAdaptiveProfileSnapshot({
      now,
      progress: [
        {
          conditionId: 'cond-weak',
          system: 'Cardiovascular',
          nextReviewAt: new Date('2026-04-10T12:00:00.000Z'),
          stability: 3,
          totalAttempts: 6,
          correctCount: 2,
          accuracy: 2 / 6,
        },
      ],
      conditionAccuracy: [],
      reviewSignals: [],
      attemptSignals: [],
    });

    const systemWeakness = buildAdaptiveSystemWeaknessMap(snapshot);
    const topicMastery = buildAdaptiveTopicMasteryMap(snapshot);

    expect(systemWeakness.Cardiovascular).toBeGreaterThan(0);
    expect(topicMastery['cond-weak']).toBeGreaterThanOrEqual(0);
  });
});
