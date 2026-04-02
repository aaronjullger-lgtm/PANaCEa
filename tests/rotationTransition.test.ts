import { describe, it, expect } from 'vitest';
import { checkRotationTransition, daysUntilSafe } from '../lib/services/learnerStageBlueprint';

describe('checkRotationTransition', () => {
  it('returns no transition for non-clinical users', () => {
    const result = checkRotationTransition({
      trainingPhase: 'DIDACTIC',
      currentRotation: 'Family Medicine',
      rotationEndDate: new Date('2025-01-01'),
    });
    expect(result.shouldTransition).toBe(false);
    expect(result.message).toBeNull();
  });

  it('returns no transition when no rotation set', () => {
    const result = checkRotationTransition({
      trainingPhase: 'CLINICAL',
      currentRotation: null,
    });
    expect(result.shouldTransition).toBe(false);
  });

  it('returns no transition when no end date', () => {
    const result = checkRotationTransition({
      trainingPhase: 'CLINICAL',
      currentRotation: 'Surgery',
      rotationEndDate: null,
      eorTestDate: null,
    });
    expect(result.shouldTransition).toBe(false);
  });

  it('detects rotation ended > 7 days ago', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const result = checkRotationTransition({
      trainingPhase: 'CLINICAL',
      currentRotation: 'family_medicine',
      rotationEndDate: pastDate,
    });
    expect(result.shouldTransition).toBe(true);
    expect(result.message).toContain('ended');
    expect(result.message).toContain('Family Medicine');
  });

  it('detects rotation just ended (< 7 days ago)', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const result = checkRotationTransition({
      trainingPhase: 'CLINICAL',
      currentRotation: 'surgery',
      eorTestDate: pastDate,
    });
    expect(result.shouldTransition).toBe(true);
    expect(result.message).toContain('EOR has passed');
  });

  it('returns no transition for future rotation end', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const result = checkRotationTransition({
      trainingPhase: 'CLINICAL',
      currentRotation: 'Internal Medicine',
      rotationEndDate: futureDate,
    });
    expect(result.shouldTransition).toBe(false);
    expect(result.message).toBeNull();
  });

  it('prefers eorTestDate over rotationEndDate', () => {
    const futureEnd = new Date();
    futureEnd.setDate(futureEnd.getDate() + 30);
    const pastEor = new Date();
    pastEor.setDate(pastEor.getDate() - 2);
    const result = checkRotationTransition({
      trainingPhase: 'CLINICAL',
      currentRotation: 'Pediatrics',
      rotationEndDate: futureEnd,
      eorTestDate: pastEor,
    });
    // eorTestDate is past, so should transition even though rotationEndDate is future
    expect(result.shouldTransition).toBe(true);
  });
});

describe('daysUntilSafe', () => {
  it('returns 0 for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(daysUntilSafe(past)).toBe(0);
  });

  it('returns positive for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(daysUntilSafe(future)).toBeGreaterThan(0);
  });
});
