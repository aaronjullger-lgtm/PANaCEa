/**
 * Tests for Sprint 24 — Forgetting curve projection to exam date
 * Tests projectToExamDate in readinessProjectionService
 */

import { describe, it, expect } from 'vitest';
import {
  projectToExamDate,
  projectRetrievability,
  type CardState,
  type ExamCountdownProjection,
} from '../lib/services/readinessProjectionService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CardState> = {}): CardState {
  return {
    conditionId: 'cond-001',
    system: 'Cardiovascular',
    stability: 30,
    elapsedDays: 5,
    correct: 15,
    total: 20,
    ...overrides,
  };
}

// ─── projectToExamDate ───────────────────────────────────────────────

describe('projectToExamDate', () => {
  it('produces valid projection for typical scenario', () => {
    const cards = [
      makeCard({ system: 'Cardiovascular', stability: 30, elapsedDays: 5 }),
      makeCard({ system: 'Cardiovascular', stability: 15, elapsedDays: 10 }),
      makeCard({ system: 'Pulmonary', stability: 45, elapsedDays: 3 }),
      makeCard({ system: 'Neurology', stability: 5, elapsedDays: 20 }),
    ];

    const result = projectToExamDate(cards, 60);

    expect(result.daysUntilExam).toBe(60);
    expect(result.projectedScoreIfStop).toBeGreaterThanOrEqual(300);
    expect(result.projectedScoreIfStop).toBeLessThanOrEqual(800);
    expect(result.projectedScoreCurrentPace).toBeGreaterThanOrEqual(300);
    expect(result.interventions.length).toBeGreaterThan(0);
    expect(result.totalReviewsNeeded).toBeGreaterThanOrEqual(0);
    expect(result.overallDailyPace).toBeGreaterThanOrEqual(0);
  });

  it('stop-studying score is <= current-pace score', () => {
    // Use short-stability cards far from the exam so stop-vs-continue gap is unambiguous.
    const cards = [
      makeCard({ stability: 3, elapsedDays: 2 }),
      makeCard({ stability: 3, elapsedDays: 2 }),
      makeCard({ stability: 3, elapsedDays: 2 }),
    ];

    const result = projectToExamDate(cards, 90);
    expect(result.projectedScoreIfStop).toBeLessThanOrEqual(result.projectedScoreCurrentPace);
  });

  it('more reviews needed when exam is far away', () => {
    const cards = [makeCard({ stability: 10, elapsedDays: 5 })];

    const near = projectToExamDate(cards, 14);
    const far = projectToExamDate(cards, 180);

    // Far exam needs more reviews (stability must survive longer)
    expect(far.totalReviewsNeeded).toBeGreaterThanOrEqual(near.totalReviewsNeeded);
  });

  it('handles exam today (0 days)', () => {
    const cards = [makeCard()];
    const result = projectToExamDate(cards, 0);
    expect(result.daysUntilExam).toBe(0);
    expect(result.totalReviewsNeeded).toBe(0);
    expect(result.overallDailyPace).toBe(0);
  });

  it('handles empty card set', () => {
    const result = projectToExamDate([], 60);
    expect(result.projectedScoreIfStop).toBe(300); // 300 + 500 * 0
    expect(result.interventions).toHaveLength(0);
  });

  it('interventions are sorted by urgency (lowest projected first)', () => {
    const cards = [
      makeCard({ system: 'Cardiovascular', stability: 50, elapsedDays: 2 }),
      makeCard({ system: 'Neurology', stability: 3, elapsedDays: 30 }),
      makeCard({ system: 'Pulmonary', stability: 20, elapsedDays: 10 }),
    ];

    const result = projectToExamDate(cards, 60);
    for (let i = 1; i < result.interventions.length; i++) {
      expect(result.interventions[i]!.projectedAtExam).toBeGreaterThanOrEqual(
        result.interventions[i - 1]!.projectedAtExam
      );
    }
  });

  it('low-stability cards get more reviews', () => {
    const lowStab = [makeCard({ stability: 3, elapsedDays: 10 })];
    const highStab = [makeCard({ stability: 100, elapsedDays: 10 })];

    const lowResult = projectToExamDate(lowStab, 60);
    const highResult = projectToExamDate(highStab, 60);

    expect(lowResult.totalReviewsNeeded).toBeGreaterThan(highResult.totalReviewsNeeded);
  });
});

// ─── projectRetrievability (existing, verify it works correctly) ──────

describe('projectRetrievability', () => {
  it('returns 1 at t=0', () => {
    expect(projectRetrievability(30, 0)).toBeCloseTo(1, 2);
  });

  it('returns ~0.71 at t=S (FSRS v6: S is NOT the 90%-retention point)', () => {
    // With ts-fsrs v6 defaults (w19=0.1597, w20=2.27), R(t=S, S) ≈ 0.714.
    // The 90%-retention point is at t ≈ 0.41*S, not t=S.
    // See lib/fsrs-retrievability.ts for the derivation.
    const R = projectRetrievability(30, 30);
    expect(R).toBeCloseTo(0.714, 1);
  });

  it('decays over time', () => {
    const r1 = projectRetrievability(30, 10);
    const r2 = projectRetrievability(30, 60);
    expect(r1).toBeGreaterThan(r2);
  });

  it('higher stability = slower decay', () => {
    const lowStab = projectRetrievability(10, 30);
    const highStab = projectRetrievability(100, 30);
    expect(highStab).toBeGreaterThan(lowStab);
  });

  it('returns 0 for zero stability', () => {
    expect(projectRetrievability(0, 10)).toBe(0);
  });
});
