import { describe, it, expect } from 'vitest';
import {
  normalize,
  similarityScore,
  extractTags,
  detectMediaTypeFromFolder,
} from '../lib/mediaMatcherUtils';

describe('mediaMatcherUtils', () => {
  describe('normalize', () => {
    it('should lowercase text', () => {
      expect(normalize('HELLO WORLD')).toBe('hello world');
    });

    it('should trim whitespace', () => {
      expect(normalize('  hello  ')).toBe('hello');
    });

    it('should replace underscores with spaces', () => {
      expect(normalize('hello_world')).toBe('hello world');
    });

    it('should replace hyphens with spaces', () => {
      expect(normalize('hello-world')).toBe('hello world');
    });

    it('should remove punctuation', () => {
      expect(normalize('hello, world!')).toBe('hello world');
    });

    it('should collapse multiple spaces', () => {
      expect(normalize('hello   world')).toBe('hello world');
    });

    it('should handle complex medical terms', () => {
      expect(normalize('Atrial_Fibrillation--EKG')).toBe('atrial fibrillation ekg');
    });
  });

  describe('similarityScore', () => {
    it('should return 1 for identical strings', () => {
      expect(similarityScore('atrial fibrillation', 'atrial fibrillation')).toBe(1);
    });

    it('should return 1 for identical normalized strings', () => {
      expect(similarityScore('Atrial_Fibrillation', 'atrial fibrillation')).toBe(1);
    });

    it('should return 0 for empty strings compared with non-empty', () => {
      expect(similarityScore('', 'hello')).toBe(0);
      expect(similarityScore('hello', '')).toBe(0);
    });

    it('should return high score for similar strings', () => {
      const score = similarityScore('atrial fibrillation', 'atrial fibrilation');
      expect(score).toBeGreaterThan(0.85);
    });

    it('should return low score for dissimilar strings', () => {
      const score = similarityScore('atrial fibrillation', 'pneumonia');
      expect(score).toBeLessThan(0.3);
    });

    it('should handle medical condition IDs', () => {
      const score = similarityScore('CV__ecg__atrial_fibrillation', 'atrial_fibrillation_ekg');
      expect(score).toBeGreaterThan(0.4);
    });
  });

  describe('extractTags', () => {
    it('should extract basic tokens', () => {
      const tags = extractTags('atrial_fibrillation_ekg.png');
      expect(tags).toContain('atrial');
      expect(tags).toContain('fibrillation');
      expect(tags).toContain('ekg');
    });

    it('should filter out trivial tokens', () => {
      const tags = extractTags('atrial_fibrillation_v2_final.png');
      expect(tags).not.toContain('v2');
      expect(tags).not.toContain('final');
      expect(tags).not.toContain('png');
    });

    it('should handle hyphens', () => {
      const tags = extractTags('sinus-tachycardia-ekg.jpg');
      expect(tags).toContain('sinus');
      expect(tags).toContain('tachycardia');
      expect(tags).toContain('ekg');
    });

    it('should filter out single character tokens', () => {
      const tags = extractTags('a_b_c_atrial.png');
      expect(tags).not.toContain('a');
      expect(tags).not.toContain('b');
      expect(tags).not.toContain('c');
      expect(tags).toContain('atrial');
    });

    it('should normalize extracted tags', () => {
      const tags = extractTags('AFIB_Rapid_Rate.png');
      expect(tags).toContain('afib');
      expect(tags).toContain('rapid');
      expect(tags).toContain('rate');
    });
  });

  describe('detectMediaTypeFromFolder', () => {
    it('should detect ekg type', () => {
      expect(detectMediaTypeFromFolder('/assets/media/ekg/afib.png')).toBe('ekg');
    });

    it('should detect imaging type', () => {
      expect(detectMediaTypeFromFolder('/assets/media/imaging/chest_xray.png')).toBe('imaging');
    });

    it('should detect labs type', () => {
      expect(detectMediaTypeFromFolder('/assets/media/labs/cbc_results.png')).toBe('labs');
    });

    it('should detect diagram type', () => {
      expect(detectMediaTypeFromFolder('/assets/media/diagrams/heart_anatomy.png')).toBe('diagram');
    });

    it('should default to other for unknown paths', () => {
      expect(detectMediaTypeFromFolder('/assets/media/misc/unknown.png')).toBe('other');
    });

    it('should handle Windows-style paths', () => {
      expect(detectMediaTypeFromFolder('C:\\assets\\media\\ekg\\afib.png')).toBe('ekg');
    });

    it('should be case-insensitive', () => {
      expect(detectMediaTypeFromFolder('/ASSETS/MEDIA/EKG/afib.png')).toBe('ekg');
    });
  });
});
