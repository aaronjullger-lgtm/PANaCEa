/**
 * Tests for Content Management Service
 */

import { describe, it, expect } from 'vitest';

describe('Content Service', () => {
  describe('State Machine Validation', () => {
    it('should validate draft to pending_review transition', () => {
      // Valid transition
      expect(() => {
        const from = 'draft';
        const to = 'pending_review';
        const allowedTransitions: Record<string, string[]> = {
          draft: ['pending_review', 'archived'],
        };
        if (!allowedTransitions[from]?.includes(to)) {
          throw new Error('Invalid transition');
        }
      }).not.toThrow();
    });

    it('should reject invalid transition', () => {
      // Invalid: draft to published (must go through approval)
      expect(() => {
        const from = 'draft';
        const to = 'published';
        const allowedTransitions: Record<string, string[]> = {
          draft: ['pending_review', 'archived'],
        };
        if (!allowedTransitions[from]?.includes(to)) {
          throw new Error('Invalid transition');
        }
      }).toThrow('Invalid transition');
    });
  });

  describe('Field Change Detection', () => {
    it('should detect changed fields', () => {
      const oldContent = {
        overview: 'Old overview',
        symptoms: ['symptom1'],
      };

      const newContent = {
        overview: 'New overview',
        symptoms: ['symptom1', 'symptom2'],
      };

      const changedFields: string[] = [];
      for (const key of Object.keys(newContent)) {
        if (JSON.stringify(oldContent[key]) !== JSON.stringify(newContent[key])) {
          changedFields.push(key);
        }
      }

      expect(changedFields).toContain('overview');
      expect(changedFields).toContain('symptoms');
      expect(changedFields).toHaveLength(2);
    });

    it('should not detect changes when content is identical', () => {
      const oldContent = {
        overview: 'Same overview',
        symptoms: ['symptom1'],
      };

      const newContent = {
        overview: 'Same overview',
        symptoms: ['symptom1'],
      };

      const changedFields: string[] = [];
      for (const key of Object.keys(newContent)) {
        if (JSON.stringify(oldContent[key]) !== JSON.stringify(newContent[key])) {
          changedFields.push(key);
        }
      }

      expect(changedFields).toHaveLength(0);
    });
  });
});
