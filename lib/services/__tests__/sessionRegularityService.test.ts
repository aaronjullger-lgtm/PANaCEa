import { describe, it, expect } from 'vitest';
import { computeStreak } from '../sessionRegularityService';

describe('sessionRegularityService', () => {
  describe('computeStreak', () => {
    it('returns 0 for empty dates', () => {
      expect(computeStreak([])).toBe(0);
    });

    it('returns 0 if last session date is not today or yesterday', () => {
      const oldDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
      expect(computeStreak([oldDate])).toBe(0);
    });

    it('returns 1 if only today has a session', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(computeStreak([today])).toBe(1);
    });

    it('returns streak for consecutive days ending today', () => {
      const today = new Date();
      const dates = [];
      for (let i = 2; i >= 0; i--) {
        dates.push(new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10));
      }
      expect(computeStreak(dates)).toBe(3);
    });

    it('breaks streak on gap', () => {
      const today = new Date();
      const dates = [
        new Date(today.getTime() - 5 * 86400000).toISOString().slice(0, 10),
        // gap on day -4, -3
        new Date(today.getTime() - 1 * 86400000).toISOString().slice(0, 10),
        today.toISOString().slice(0, 10),
      ];
      // Streak should count only today + yesterday = 2
      expect(computeStreak(dates)).toBe(2);
    });
  });

  // Note: computeSessionRegularity requires Prisma and is tested via DB integration tests.
  // The pure function computeStreak is the core logic tested here.
});
