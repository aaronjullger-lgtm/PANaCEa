import { describe, it, expect } from 'vitest';
import {
  extractBuzzwords,
  compressToBullets,
  generateMnemonic,
  highYieldPackage,
} from '../lib/services/explanationCompression';

describe('explanationCompression', () => {
  describe('extractBuzzwords', () => {
    it('should return empty buzzwords for empty text', () => {
      const result = extractBuzzwords('');
      expect(result.buzzwords).toEqual([]);
      expect(result.formattedText).toBe('');
    });

    it('should identify pathognomonic terms', () => {
      const text = "Patient presents with Murphy's sign and rebound tenderness.";
      const result = extractBuzzwords(text);
      
      expect(result.buzzwords).toContain("Murphy's sign");
      expect(result.buzzwords).toContain('rebound tenderness');
    });

    it('should bold buzzwords in formatted text', () => {
      const text = "Classic finding is Babinski sign.";
      const result = extractBuzzwords(text);
      
      expect(result.formattedText).toContain('<strong>Babinski sign</strong>');
    });

    it('should identify owl eye inclusion as buzzword', () => {
      const text = "Histology shows owl's eye inclusion bodies typical of CMV.";
      const result = extractBuzzwords(text);
      
      expect(result.buzzwords.some(b => b.toLowerCase().includes("owl"))).toBe(true);
    });

    it('should extract quoted terms as buzzwords', () => {
      const text = 'The classic "strawberry cervix" finding indicates Trichomonas.';
      const result = extractBuzzwords(text);
      
      expect(result.buzzwords).toContain('strawberry cervix');
    });

    it('should handle multiple buzzwords in one text', () => {
      const text = "Patient has JVD, crackles on auscultation, and peripheral edema.";
      const result = extractBuzzwords(text);
      
      expect(result.buzzwords.length).toBeGreaterThanOrEqual(2);
      expect(result.buzzwords).toContain('JVD');
      expect(result.buzzwords).toContain('crackles');
    });
  });

  describe('compressToBullets', () => {
    it('should return REVIEW REQUIRED for empty text', () => {
      const result = compressToBullets('');
      expect(result).toContain('[REVIEW REQUIRED]');
    });

    it('should extract 3-4 bullet points from explanation', () => {
      const longText = `
        This patient presents with classic signs of appendicitis. 
        The diagnosis is confirmed by CT scan showing appendiceal inflammation.
        Treatment involves surgical appendectomy within 24 hours.
        Unlike diverticulitis, appendicitis typically affects younger patients.
        The gold standard for diagnosis is clinical presentation plus imaging.
        Antibiotics alone may be considered in uncomplicated cases.
      `;
      
      const result = compressToBullets(longText);
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.length).toBeLessThanOrEqual(4);
    });

    it('should prioritize sentences with diagnostic terms', () => {
      const text = `
        The patient felt unwell. 
        The gold standard for diagnosis is echocardiogram.
        Weather was nice that day.
        First-line treatment includes beta blockers.
      `;
      
      const result = compressToBullets(text);
      expect(result.some(b => b.includes('gold standard'))).toBe(true);
      expect(result.some(b => b.includes('First-line'))).toBe(true);
    });

    it('should prioritize sentences with pathognomonic terms', () => {
      const text = `
        The patient walked into the clinic.
        Physical exam revealed Babinski sign and clonus.
        The doctor took notes.
        Labs showed elevated troponin levels.
      `;
      
      const result = compressToBullets(text);
      expect(result.some(b => b.includes('Babinski sign') || b.includes('troponin'))).toBe(true);
    });

    it('should bold pathognomonic terms in bullets', () => {
      const text = "ST elevation on ECG confirms the diagnosis of STEMI.";
      const result = compressToBullets(text);
      
      expect(result.some(b => b.includes('<strong>ST elevation</strong>'))).toBe(true);
    });
  });

  describe('generateMnemonic', () => {
    it('should return mnemonic for known condition', () => {
      const result = generateMnemonic('heart_failure');
      expect(result).toContain('HEART FAILURE');
    });

    it('should return [Mnemonic: None] for unknown condition', () => {
      const result = generateMnemonic('unknown_rare_condition');
      expect(result).toBe('[Mnemonic: None]');
    });

    it('should handle condition names with spaces', () => {
      const result = generateMnemonic('Heart Failure');
      expect(result).toContain('HEART FAILURE');
    });

    it('should return mnemonic for pneumonia', () => {
      const result = generateMnemonic('pneumonia');
      expect(result).toContain('CURB-65');
    });

    it('should return mnemonic for stroke', () => {
      const result = generateMnemonic('stroke');
      expect(result).toContain('BE FAST');
    });

    it('should return [Mnemonic: None] for empty condition', () => {
      const result = generateMnemonic('');
      expect(result).toBe('[Mnemonic: None]');
    });

    it('should find partial matches', () => {
      // "myocardial infarction" should match "myocardial_infarction"
      const result = generateMnemonic('myocardial infarction');
      expect(result).toContain('STEMI');
    });
  });

  describe('highYieldPackage', () => {
    it('should return a complete package with all fields', () => {
      const explanation = "Patient has ST elevation on ECG with elevated troponin. This confirms STEMI diagnosis.";
      const condition = "myocardial_infarction";
      
      const result = highYieldPackage(explanation, condition);
      
      expect(result).toHaveProperty('bullets');
      expect(result).toHaveProperty('buzzwords');
      expect(result).toHaveProperty('formattedHtml');
      expect(result).toHaveProperty('mnemonic');
    });

    it('should include buzzwords in package', () => {
      const explanation = "Murphy's sign is positive with rebound tenderness.";
      const condition = "cholecystitis";
      
      const result = highYieldPackage(explanation, condition);
      
      expect(result.buzzwords.length).toBeGreaterThan(0);
    });

    it('should include mnemonic when available', () => {
      const explanation = "Patient presents with confusion and respiratory distress.";
      const condition = "pneumonia";
      
      const result = highYieldPackage(explanation, condition);
      
      expect(result.mnemonic).toContain('CURB-65');
    });

    it('should include bullets in package', () => {
      const explanation = `
        The diagnosis is confirmed by CT scan.
        Treatment involves surgical intervention.
        First-line medication is antibiotics.
      `;
      const condition = "appendicitis";
      
      const result = highYieldPackage(explanation, condition);
      
      expect(result.bullets.length).toBeGreaterThanOrEqual(1);
    });

    it('should format HTML with bolded buzzwords', () => {
      const explanation = "Classic finding includes Babinski sign.";
      const condition = "stroke";
      
      const result = highYieldPackage(explanation, condition);
      
      expect(result.formattedHtml).toContain('<strong>');
    });
  });
});
