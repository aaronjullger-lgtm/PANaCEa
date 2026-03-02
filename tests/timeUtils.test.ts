/**
 * Unit tests for time utility functions
 * Focus: circadian phase calculation
 */

import { describe, it, expect } from 'vitest';
import { getCircadianPhase, CircadianPhase } from '../lib/utils/timeUtils';

describe('getCircadianPhase', () => {
  // Helper to create a Date object with specific hour/minute
  const makeDate = (hour: number, minute: number = 0): Date => {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  describe('morning phase (5:00 – 11:59)', () => {
    it('should return "morning" at 5:00', () => {
      const date = makeDate(5, 0);
      expect(getCircadianPhase(date)).toBe('morning');
    });

    it('should return "morning" at 5:01', () => {
      const date = makeDate(5, 1);
      expect(getCircadianPhase(date)).toBe('morning');
    });

    it('should return "morning" at 11:59', () => {
      const date = makeDate(11, 59);
      expect(getCircadianPhase(date)).toBe('morning');
    });

    it('should return "morning" at 9:30', () => {
      const date = makeDate(9, 30);
      expect(getCircadianPhase(date)).toBe('morning');
    });
  });

  describe('afternoon phase (12:00 – 16:59)', () => {
    it('should return "afternoon" at 12:00', () => {
      const date = makeDate(12, 0);
      expect(getCircadianPhase(date)).toBe('afternoon');
    });

    it('should return "afternoon" at 12:01', () => {
      const date = makeDate(12, 1);
      expect(getCircadianPhase(date)).toBe('afternoon');
    });

    it('should return "afternoon" at 16:59', () => {
      const date = makeDate(16, 59);
      expect(getCircadianPhase(date)).toBe('afternoon');
    });

    it('should return "afternoon" at 14:45', () => {
      const date = makeDate(14, 45);
      expect(getCircadianPhase(date)).toBe('afternoon');
    });
  });

  describe('evening phase (17:00 – 20:59)', () => {
    it('should return "evening" at 17:00', () => {
      const date = makeDate(17, 0);
      expect(getCircadianPhase(date)).toBe('evening');
    });

    it('should return "evening" at 17:01', () => {
      const date = makeDate(17, 1);
      expect(getCircadianPhase(date)).toBe('evening');
    });

    it('should return "evening" at 20:59', () => {
      const date = makeDate(20, 59);
      expect(getCircadianPhase(date)).toBe('evening');
    });

    it('should return "evening" at 19:30', () => {
      const date = makeDate(19, 30);
      expect(getCircadianPhase(date)).toBe('evening');
    });
  });

  describe('night phase (21:00 – 4:59)', () => {
    it('should return "night" at 21:00', () => {
      const date = makeDate(21, 0);
      expect(getCircadianPhase(date)).toBe('night');
    });

    it('should return "night" at 21:01', () => {
      const date = makeDate(21, 1);
      expect(getCircadianPhase(date)).toBe('night');
    });

    it('should return "night" at 23:59', () => {
      const date = makeDate(23, 59);
      expect(getCircadianPhase(date)).toBe('night');
    });

    it('should return "night" at 0:00 (midnight)', () => {
      const date = makeDate(0, 0);
      expect(getCircadianPhase(date)).toBe('night');
    });

    it('should return "night" at 4:59', () => {
      const date = makeDate(4, 59);
      expect(getCircadianPhase(date)).toBe('night');
    });

    it('should return "night" at 2:30', () => {
      const date = makeDate(2, 30);
      expect(getCircadianPhase(date)).toBe('night');
    });
  });

  describe('edge cases', () => {
    it('should transition from night to morning at 5:00', () => {
      const night = makeDate(4, 59);
      const morning = makeDate(5, 0);
      expect(getCircadianPhase(night)).toBe('night');
      expect(getCircadianPhase(morning)).toBe('morning');
    });

    it('should transition from morning to afternoon at 12:00', () => {
      const morning = makeDate(11, 59);
      const afternoon = makeDate(12, 0);
      expect(getCircadianPhase(morning)).toBe('morning');
      expect(getCircadianPhase(afternoon)).toBe('afternoon');
    });

    it('should transition from afternoon to evening at 17:00', () => {
      const afternoon = makeDate(16, 59);
      const evening = makeDate(17, 0);
      expect(getCircadianPhase(afternoon)).toBe('afternoon');
      expect(getCircadianPhase(evening)).toBe('evening');
    });

    it('should transition from evening to night at 21:00', () => {
      const evening = makeDate(20, 59);
      const night = makeDate(21, 0);
      expect(getCircadianPhase(evening)).toBe('evening');
      expect(getCircadianPhase(night)).toBe('night');
    });
  });

  describe('default parameter', () => {
    it('should use current time when no argument provided', () => {
      // We cannot predict the exact phase, but the function should not throw
      expect(() => getCircadianPhase()).not.toThrow();
      // Ensure return value is one of the allowed phases
      const phase = getCircadianPhase();
      const validPhases: CircadianPhase[] = ['morning', 'afternoon', 'evening', 'night'];
      expect(validPhases).toContain(phase);
    });
  });
});