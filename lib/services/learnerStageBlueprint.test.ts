import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  daysUntilSafe,
  checkRotationTransition,
} from './learnerStageBlueprint';

describe('learnerStageBlueprint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('daysUntilSafe', () => {
    it('returns 0 for today', () => {
      const today = new Date();
      expect(daysUntilSafe(today)).toBe(0);
    });

    it('returns positive number for future date', () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(daysUntilSafe(future)).toBe(7);
    });

    it('returns 0 for past date (floors at 0)', () => {
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(daysUntilSafe(past)).toBe(0);
    });

    it('handles exact day boundaries', () => {
      const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      expect(daysUntilSafe(tomorrow)).toBe(1);
    });
  });

  describe('checkRotationTransition', () => {
    it('returns no transition for non-clinical training phase', () => {
      const result = checkRotationTransition({
        trainingPhase: 'DIDACTIC',
        currentRotation: 'Internal Medicine',
        rotationEndDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      expect(result.shouldTransition).toBe(false);
      expect(result.message).toBeNull();
    });

    it('returns no transition for clinical with no rotation', () => {
      const result = checkRotationTransition({
        trainingPhase: 'CLINICAL',
        currentRotation: null,
        rotationEndDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      expect(result.shouldTransition).toBe(false);
      expect(result.message).toBeNull();
    });

    it('returns no transition for clinical with no end date', () => {
      const result = checkRotationTransition({
        trainingPhase: 'CLINICAL',
        currentRotation: 'Internal Medicine',
        rotationEndDate: null,
      });
      expect(result.shouldTransition).toBe(false);
      expect(result.message).toBeNull();
    });

    it('returns no transition when rotation is still active', () => {
      const result = checkRotationTransition({
        trainingPhase: 'CLINICAL',
        currentRotation: 'Internal Medicine',
        rotationEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      expect(result.shouldTransition).toBe(false);
      expect(result.message).toBeNull();
    });

    it('returns soft transition when rotation just ended', () => {
      const result = checkRotationTransition({
        trainingPhase: 'CLINICAL',
        currentRotation: 'Internal Medicine',
        rotationEndDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      });
      expect(result.shouldTransition).toBe(true);
      expect(result.message).toContain('Internal Medicine');
      expect(result.message).toContain('EOR has passed');
    });

    it('returns hard transition when rotation ended more than a week ago', () => {
      const result = checkRotationTransition({
        trainingPhase: 'CLINICAL',
        currentRotation: 'Surgery',
        rotationEndDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      });
      expect(result.shouldTransition).toBe(true);
      expect(result.message).toContain('Surgery');
      expect(result.message).toContain('14 days ago');
    });

    it('uses eorTestDate when available', () => {
      const result = checkRotationTransition({
        trainingPhase: 'CLINICAL',
        currentRotation: 'Psychiatry',
        rotationEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        eorTestDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      });
      expect(result.shouldTransition).toBe(true);
      expect(result.message).toContain('Psychiatry');
    });

    it('formats rotation name correctly', () => {
      const result = checkRotationTransition({
        trainingPhase: 'CLINICAL',
        currentRotation: 'internal medicine',
        rotationEndDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      expect(result.message).toContain('Internal Medicine');
    });
  });

  describe('calculateUrgency (via import)', () => {
    it('should be exported from the module', async () => {
      const mod = await import('./learnerStageBlueprint');
      expect(mod.default.calculateUrgency).toBeDefined();
    });

    it('returns 0.5 for null days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(null)).toBe(0.5);
    });

    it('returns 2.0 for 0 days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(0)).toBe(2.0);
    });

    it('returns 2.0 for 3 days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(3)).toBe(2.0);
    });

    it('returns 1.7 for 7 days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(7)).toBe(1.7);
    });

    it('returns 1.4 for 14 days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(14)).toBe(1.4);
    });

    it('returns 1.2 for 30 days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(30)).toBe(1.2);
    });

    it('returns 1.0 for 60 days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(60)).toBe(1.0);
    });

    it('returns 0.8 for > 60 days', async () => {
      const { default: mod } = await import('./learnerStageBlueprint');
      expect(mod.calculateUrgency(90)).toBe(0.8);
    });
  });
});
