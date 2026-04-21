/**
 * Unit tests for lib/services/explanationCompression.ts
 *
 * Pure exports tested (no I/O, no async):
 *   extractBuzzwords(text)
 *   compressToBullets(text)
 *   generateMnemonic(condition)
 *   highYieldPackage(explanation, condition)
 *
 * Notes:
 *   extractBuzzwords: detects PATHOGNOMONIC_TERMS (case-insensitive),
 *     wraps matches in <strong>…</strong>, also extracts "quoted terms".
 *   compressToBullets: returns 3-4 bullets scored by medical relevance;
 *     ensures ≥3 bullets by appending '[REVIEW REQUIRED]' if needed.
 *   generateMnemonic: normalizes condition name for MNEMONIC_DATABASE
 *     lookup; returns '[Mnemonic: None]' when not found.
 *   highYieldPackage: bundles all three functions.
 */

import { describe, it, expect } from 'vitest';
import {
  extractBuzzwords,
  compressToBullets,
  generateMnemonic,
  highYieldPackage,
} from './explanationCompression';

// ─── extractBuzzwords ─────────────────────────────────────────────────────────

describe('extractBuzzwords', () => {
  it('empty string → empty buzzwords, formattedText unchanged', () => {
    const result = extractBuzzwords('');
    expect(result.buzzwords).toEqual([]);
    expect(result.formattedText).toBe('');
  });

  it('whitespace-only string → empty buzzwords', () => {
    const result = extractBuzzwords('   ');
    expect(result.buzzwords).toHaveLength(0);
  });

  it('text with no pathognomonic terms → empty buzzwords', () => {
    const result = extractBuzzwords('The patient had a normal exam.');
    expect(result.buzzwords).toHaveLength(0);
    expect(result.formattedText).toBe('The patient had a normal exam.');
  });

  it('detects "strawberry tongue" as a buzzword (case-insensitive)', () => {
    const result = extractBuzzwords('Child presents with Strawberry Tongue and fever.');
    expect(result.buzzwords.some(b => b.toLowerCase() === 'strawberry tongue')).toBe(true);
  });

  it('wraps detected buzzword in <strong> tags', () => {
    const result = extractBuzzwords('Patient has strawberry tongue on exam.');
    expect(result.formattedText).toContain('<strong>');
    expect(result.formattedText).toContain('</strong>');
  });

  it('detects "Babinski sign" from neuro buzzwords', () => {
    const result = extractBuzzwords('The Babinski sign was positive.');
    expect(result.buzzwords.some(b => b.toLowerCase() === 'babinski sign')).toBe(true);
  });

  it('detects "Reed-Sternberg cells" from classic pathognomonic terms', () => {
    const result = extractBuzzwords('Biopsy showed Reed-Sternberg cells, consistent with Hodgkins.');
    expect(result.buzzwords.some(b => b.toLowerCase() === 'reed-sternberg cells')).toBe(true);
  });

  it('detects multiple buzzwords from a rich text', () => {
    const text = 'Findings include strawberry tongue, petechiae, and purpura.';
    const result = extractBuzzwords(text);
    expect(result.buzzwords.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts "quoted terms" as additional buzzwords', () => {
    const result = extractBuzzwords('This is called "high-output failure" by convention.');
    expect(result.buzzwords.some(b => b.includes('high-output failure'))).toBe(true);
  });

  it('does not duplicate a term already found as pathognomonic', () => {
    // Both the pathognomonic scan and the quoted scan should not double-count
    const result = extractBuzzwords('Classic "strawberry tongue" is diagnostic.');
    const strawCount = result.buzzwords.filter(b =>
      b.toLowerCase().includes('strawberry tongue')
    ).length;
    expect(strawCount).toBe(1);
  });
});

// ─── compressToBullets ────────────────────────────────────────────────────────

describe('compressToBullets', () => {
  it('empty string → ["[REVIEW REQUIRED]"]', () => {
    expect(compressToBullets('')).toEqual(['[REVIEW REQUIRED]']);
  });

  it('whitespace-only → ["[REVIEW REQUIRED]"]', () => {
    expect(compressToBullets('   ')).toEqual(['[REVIEW REQUIRED]']);
  });

  it('returns 3-4 bullets from rich text', () => {
    const text = [
      'Heart failure is diagnosed by clinical criteria and BNP levels.',
      'The gold standard for diagnosis is echocardiography.',
      'First-line treatment includes diuretics and ACE inhibitors.',
      'Unlike systolic heart failure, diastolic heart failure has preserved EF.',
      'The patient was managed with furosemide because of volume overload.',
    ].join(' ');
    const bullets = compressToBullets(text);
    expect(bullets.length).toBeGreaterThanOrEqual(3);
    expect(bullets.length).toBeLessThanOrEqual(4);
  });

  it('always returns at least 3 bullets (pads with [REVIEW REQUIRED])', () => {
    // Provide only 2 scoreable sentences
    const text = 'This is the first sentence. This is the second sentence.';
    const bullets = compressToBullets(text);
    expect(bullets.length).toBeGreaterThanOrEqual(3);
    expect(bullets.some(b => b.includes('[REVIEW REQUIRED]'))).toBe(true);
  });

  it('filters out "The correct answer is..." sentences', () => {
    const text = [
      'The correct answer is B.',
      'Gram-negative bacteria are treated with broad-spectrum antibiotics.',
      'First-line therapy involves amoxicillin.',
      'The gold standard test is culture and sensitivity.',
    ].join(' ');
    const bullets = compressToBullets(text);
    expect(bullets.some(b => /the correct answer is/i.test(b))).toBe(false);
  });

  it('high-yield sentences (with diagnostic keywords) score higher', () => {
    // Text with a clear "gold standard" sentence and filler sentences
    const text = [
      'The patient presented to the clinic.',
      'Gold standard diagnosis is confirmed by bone marrow biopsy.',
      'The weather today is nice.',
      'First-line treatment includes anthracyclines because of their efficacy.',
    ].join(' ');
    const bullets = compressToBullets(text);
    // At least one of the high-yield sentences should appear
    const hasHighYield = bullets.some(b =>
      /gold standard|first.line/i.test(b)
    );
    expect(hasHighYield).toBe(true);
  });

  it('strips HTML tags before processing', () => {
    const text = '<p>First-line treatment is <strong>metformin</strong>.</p>';
    const bullets = compressToBullets(text);
    expect(Array.isArray(bullets)).toBe(true);
    expect(bullets.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── generateMnemonic ─────────────────────────────────────────────────────────

describe('generateMnemonic', () => {
  it('empty condition → "[Mnemonic: None]"', () => {
    expect(generateMnemonic('')).toBe('[Mnemonic: None]');
  });

  it('unknown condition → "[Mnemonic: None]"', () => {
    expect(generateMnemonic('Fictional Disease XYZ')).toBe('[Mnemonic: None]');
  });

  it('heart_failure (exact key) → returns HEART FAILURE mnemonic', () => {
    const result = generateMnemonic('heart_failure');
    expect(result).toContain('HEART FAILURE');
    expect(result).not.toBe('[Mnemonic: None]');
  });

  it('Heart Failure (with spaces/caps) normalizes to heart_failure', () => {
    const result = generateMnemonic('Heart Failure');
    expect(result).toContain('HEART FAILURE');
  });

  it('COPD → returns COPD mnemonic', () => {
    const result = generateMnemonic('COPD');
    expect(result).not.toBe('[Mnemonic: None]');
    expect(result.length).toBeGreaterThan(10);
  });

  it('dka (exact) → returns DKA mnemonic', () => {
    const result = generateMnemonic('dka');
    expect(result).toContain('DKA');
  });

  it('stroke → returns BE FAST mnemonic', () => {
    const result = generateMnemonic('stroke');
    expect(result).toContain('BE FAST');
  });

  it('pancreatitis → returns I GET SMASHED mnemonic', () => {
    const result = generateMnemonic('pancreatitis');
    expect(result).toContain('I GET SMASHED');
  });

  it('Normalizes special chars to underscores (dots, dashes)', () => {
    // 'atrial-fibrillation' normalizes to 'atrial_fibrillation'
    const result = generateMnemonic('atrial-fibrillation');
    expect(result).not.toBe('[Mnemonic: None]');
    expect(result).toContain('PIRATES');
  });
});

// ─── highYieldPackage ─────────────────────────────────────────────────────────

describe('highYieldPackage', () => {
  it('returns object with bullets, buzzwords, formattedHtml, mnemonic', () => {
    const pkg = highYieldPackage('Simple explanation.', 'unknown_condition');
    expect(pkg).toHaveProperty('bullets');
    expect(pkg).toHaveProperty('buzzwords');
    expect(pkg).toHaveProperty('formattedHtml');
    expect(pkg).toHaveProperty('mnemonic');
  });

  it('bullets come from compressToBullets', () => {
    const pkg = highYieldPackage('', 'unknown');
    expect(pkg.bullets).toEqual(['[REVIEW REQUIRED]']);
  });

  it('mnemonic comes from generateMnemonic', () => {
    const pkg = highYieldPackage('text', 'heart_failure');
    expect(pkg.mnemonic).toContain('HEART FAILURE');
  });

  it('formattedHtml comes from extractBuzzwords (contains <strong> for buzzwords)', () => {
    const pkg = highYieldPackage('Patient has strawberry tongue and fever.', 'unknown');
    expect(pkg.formattedHtml).toContain('<strong>');
    expect(pkg.buzzwords.some(b => b.toLowerCase().includes('strawberry tongue'))).toBe(true);
  });

  it('buzwords in package match extractBuzzwords output', () => {
    const text = 'The Babinski sign and Kernig sign were both positive.';
    const { buzzwords: pkgWords } = highYieldPackage(text, 'meningitis');
    const { buzzwords: directWords } = extractBuzzwords(text);
    expect(pkgWords).toEqual(directWords);
  });

  it('mnemonic is "[Mnemonic: None]" for unknown condition', () => {
    const pkg = highYieldPackage('Some text.', 'nonexistent_rare_disease_xyz');
    expect(pkg.mnemonic).toBe('[Mnemonic: None]');
  });
});
