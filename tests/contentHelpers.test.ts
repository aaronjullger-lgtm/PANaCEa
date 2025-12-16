import { describe, it, expect } from 'vitest';
import {
  hasCompleteContent,
  buildDatabaseContext,
  calculateRelevanceScore
} from '../lib/contentHelpers';
import type { LoadedConditionData } from '../services/conditionDataLoader';

describe('Content Helpers', () => {
  describe('hasCompleteContent', () => {
    it('should return true for complete content', () => {
      const data: LoadedConditionData = {
        conditionId: 'CV__ecg__atrial_fibrillation',
        name: 'Atrial Fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        meta: {
          system: 'CV',
          subcategory: 'ECG',
          condition: 'Atrial Fibrillation',
        },
        content: {
          overview: 'This is a detailed overview that is longer than 50 characters.',
          diagnostics: {
            notes: 'ECG findings include irregularly irregular rhythm',
          },
          treatment: ['Rate control', 'Rhythm control', 'Anticoagulation'],
        },
      };

      expect(hasCompleteContent(data)).toBe(true);
    });

    it('should return false when overview is too short', () => {
      const data: LoadedConditionData = {
        conditionId: 'CV__ecg__atrial_fibrillation',
        name: 'Atrial Fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        meta: {
          system: 'CV',
          subcategory: 'ECG',
          condition: 'Atrial Fibrillation',
        },
        content: {
          overview: 'Short',
          diagnostics: {
            notes: 'ECG findings',
          },
          treatment: ['Rate control'],
        },
      };

      expect(hasCompleteContent(data)).toBe(false);
    });

    it('should return false when treatment is missing', () => {
      const data: LoadedConditionData = {
        conditionId: 'CV__ecg__atrial_fibrillation',
        name: 'Atrial Fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        meta: {
          system: 'CV',
          subcategory: 'ECG',
          condition: 'Atrial Fibrillation',
        },
        content: {
          overview: 'This is a detailed overview that is longer than 50 characters.',
          diagnostics: {
            notes: 'ECG findings',
          },
        },
      };

      expect(hasCompleteContent(data)).toBe(false);
    });

    it('should return false when diagnostics is missing', () => {
      const data: LoadedConditionData = {
        conditionId: 'CV__ecg__atrial_fibrillation',
        name: 'Atrial Fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        meta: {
          system: 'CV',
          subcategory: 'ECG',
          condition: 'Atrial Fibrillation',
        },
        content: {
          overview: 'This is a detailed overview that is longer than 50 characters.',
          treatment: ['Rate control'],
        },
      };

      expect(hasCompleteContent(data)).toBe(false);
    });
  });

  describe('buildDatabaseContext', () => {
    it('should build complete context string', () => {
      const data: LoadedConditionData = {
        conditionId: 'CV__ecg__atrial_fibrillation',
        name: 'Atrial Fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        meta: {
          system: 'CV',
          subcategory: 'ECG',
          condition: 'Atrial Fibrillation',
        },
        content: {
          overview: 'Irregular heart rhythm',
          etiologyPathophysiology: 'Caused by abnormal electrical conduction',
          symptoms: ['Palpitations', 'Dyspnea', 'Fatigue'],
          diagnostics: {
            notes: 'ECG shows irregularly irregular rhythm',
          },
          treatment: ['Rate control', 'Rhythm control', 'Anticoagulation'],
          complications: ['Stroke', 'Heart failure'],
        },
      };

      const context = buildDatabaseContext(data);

      expect(context).toContain('Condition: Atrial Fibrillation');
      expect(context).toContain('System: CV');
      expect(context).toContain('Subcategory: ECG');
      expect(context).toContain('Overview: Irregular heart rhythm');
      expect(context).toContain('Etiology/Pathophysiology: Caused by abnormal electrical conduction');
      expect(context).toContain('Key Symptoms: Palpitations, Dyspnea, Fatigue');
      expect(context).toContain('Diagnostics: ECG shows irregularly irregular rhythm');
      expect(context).toContain('Treatment: Rate control; Rhythm control; Anticoagulation');
      expect(context).toContain('Complications: Stroke, Heart failure');
    });

    it('should handle minimal data gracefully', () => {
      const data: LoadedConditionData = {
        conditionId: 'CV__ecg__atrial_fibrillation',
        name: 'Atrial Fibrillation',
        system: 'CV',
        subcategory: 'ECG',
        meta: {
          system: 'CV',
          subcategory: 'ECG',
          condition: 'Atrial Fibrillation',
        },
        content: {},
      };

      const context = buildDatabaseContext(data);

      expect(context).toContain('Condition: Atrial Fibrillation');
      expect(context).toContain('System: CV');
      expect(context).toContain('Subcategory: ECG');
      expect(context).not.toContain('Overview:');
      expect(context).not.toContain('Treatment:');
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should give highest score for exact match', () => {
      const score = calculateRelevanceScore('atrial fibrillation', 'atrial fibrillation');
      expect(score).toBe(3.0);
    });

    it('should give high score for starts with', () => {
      const score = calculateRelevanceScore('atrial', 'atrial fibrillation');
      expect(score).toBe(2.5);
    });

    it('should give good score for contains', () => {
      const score = calculateRelevanceScore('fibrillation', 'atrial fibrillation');
      expect(score).toBe(2.0);
    });

    it('should be case insensitive', () => {
      const score1 = calculateRelevanceScore('ATRIAL', 'atrial fibrillation');
      const score2 = calculateRelevanceScore('atrial', 'ATRIAL FIBRILLATION');
      expect(score1).toBe(2.5);
      expect(score2).toBe(2.5);
    });

    it('should use Levenshtein distance for fuzzy matching', () => {
      const score = calculateRelevanceScore('fibrilation', 'fibrillation');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('should return lower score for very different strings', () => {
      const score = calculateRelevanceScore('hypertension', 'diabetes');
      expect(score).toBeLessThan(0.5);
    });
  });
});
