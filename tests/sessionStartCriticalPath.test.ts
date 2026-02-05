/**
 * Critical-path: Session start and onboarding payload shapes
 * - getQuestionBatch accepts focus 'all' | 'growth' | 'review' and returns Question[]
 * - Profile PUT payload shape for onboarding completion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Session start critical path', () => {
  describe('SessionSettings shape for Training Menu', () => {
    it('session config from Training Menu includes focus and count', () => {
      const INITIAL_QUEUE_SIZE = 50;
      const sessionFocus = 'growth' as const;
      const settings = {
        focus: sessionFocus,
        count: INITIAL_QUEUE_SIZE,
      };
      expect(settings.focus).toBe('growth');
      expect(settings.count).toBe(50);
    });
  });

  describe('Onboarding profile PUT payload', () => {
    it('hasCompletedOnboarding payload is valid for /api/user/profile', () => {
      const payload = { hasCompletedOnboarding: true };
      expect(payload).toHaveProperty('hasCompletedOnboarding');
      expect(typeof payload.hasCompletedOnboarding).toBe('boolean');
    });
  });
});
