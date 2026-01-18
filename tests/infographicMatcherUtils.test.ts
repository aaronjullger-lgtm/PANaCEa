/**
 * Tests for Infographic Matching Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parseBracketTags,
  normalizeForMatch,
  substringScore,
  extractBaseName,
  computeMatchScore,
} from '../lib/infographicMatcherUtils';

describe('Infographic Matcher Utils', () => {
  describe('parseBracketTags', () => {
    it('should extract tags from brackets with hyphens', () => {
      const tags = parseBracketTags('CHF[echo-edema].png');
      expect(tags).toContain('echo');
      expect(tags).toContain('edema');
      expect(tags).toHaveLength(2);
    });

    it('should extract tags from brackets with underscores', () => {
      const tags = parseBracketTags('afib[rate_control].svg');
      expect(tags).toContain('rate');
      expect(tags).toContain('control');
    });

    it('should handle multiple bracket sections', () => {
      const tags = parseBracketTags('condition[tag1][tag2-tag3].png');
      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
      expect(tags).toContain('tag3');
    });

    it('should return empty array when no brackets present', () => {
      const tags = parseBracketTags('simple_filename.png');
      expect(tags).toHaveLength(0);
    });

    it('should handle empty brackets', () => {
      const tags = parseBracketTags('file[].png');
      expect(tags).toHaveLength(0);
    });
  });

  describe('normalizeForMatch', () => {
    it('should convert to lowercase', () => {
      expect(normalizeForMatch('UPPERCASE')).toBe('uppercase');
    });

    it('should remove spaces', () => {
      expect(normalizeForMatch('Atrial Fibrillation')).toBe('atrialfibrillation');
    });

    it('should remove special characters', () => {
      expect(normalizeForMatch('test-case_name.txt')).toBe('testcasenametxt');
    });

    it('should handle empty string', () => {
      expect(normalizeForMatch('')).toBe('');
    });

    it('should remove punctuation', () => {
      expect(normalizeForMatch('Hello, World!')).toBe('helloworld');
    });
  });

  describe('substringScore', () => {
    it('should return 0 for no match', () => {
      const score = substringScore('abc', 'xyz');
      expect(score).toBe(0);
    });

    it('should return positive score for substring containment', () => {
      const score = substringScore('atrial_fibrillation', 'atrial');
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(0.9);
    });

    it('should return higher score for larger coverage', () => {
      const smallScore = substringScore('atrialfibrillation', 'a');
      const largeScore = substringScore('atrialfibrillation', 'atrial');
      expect(largeScore).toBeGreaterThan(smallScore);
    });

    it('should handle empty strings', () => {
      expect(substringScore('', 'test')).toBe(0);
      expect(substringScore('test', '')).toBe(0);
    });

    it('should handle reverse containment', () => {
      // When haystack is shorter but contained within needle
      const score = substringScore('atrial', 'atrial_fibrillation');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('extractBaseName', () => {
    it('should remove file extension', () => {
      expect(extractBaseName('condition.png')).toBe('condition');
    });

    it('should remove bracket content', () => {
      expect(extractBaseName('CHF[echo-edema].png')).toBe('CHF');
    });

    it('should handle multiple brackets', () => {
      expect(extractBaseName('file[tag1][tag2].svg')).toBe('file');
    });

    it('should clean trailing dashes and underscores', () => {
      expect(extractBaseName('condition-[tags].png')).toBe('condition');
      expect(extractBaseName('condition_[tags].png')).toBe('condition');
    });

    it('should preserve base name without modifications', () => {
      expect(extractBaseName('atrial_fibrillation.png')).toBe('atrial_fibrillation');
    });
  });

  describe('computeMatchScore', () => {
    it('should return 1.0 for exact ID match', () => {
      const score = computeMatchScore(
        'atrial_fibrillation.png',
        'atrial_fibrillation',
        'Atrial Fibrillation'
      );
      expect(score).toBe(1.0);
    });

    it('should return 1.0 for exact normalized name match', () => {
      const score = computeMatchScore('atrialfibrillation.png', 'afib', 'Atrial Fibrillation');
      expect(score).toBe(1.0);
    });

    it('should return lower score for partial matches', () => {
      const score = computeMatchScore('atrial.png', 'atrial_fibrillation', 'Atrial Fibrillation');
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThan(0);
    });

    it('should handle bracket tags in filename', () => {
      const score = computeMatchScore('CHF[echo].png', 'CHF', 'Congestive Heart Failure');
      expect(score).toBe(1.0);
    });
  });
});
