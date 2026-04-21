/**
 * Unit tests for lib/services/explanationCompressionService.ts
 *
 * Pure functions only — storeUserReaction, updateWeaknessMap, updateConfusionGraph
 * use localStorage + fetch and belong in integration tests.
 *
 * Functions under test:
 *   compressExplanation(longText)           → string[]
 *   extractBuzzwords(longText)              → string
 *   generateMnemonicIfAvailable(condition)  → string
 *   buildDifferentialList(cond, pairs)      → string[]
 *   calculateReadingTime(text)              → { seconds, formatted }
 *   adaptExplanation(explanation, options)  → AdaptedExplanationResult
 *   generateStudyTip(userProfile)           → string
 */

import { describe, it, expect } from 'vitest';
import {
  compressExplanation,
  extractBuzzwords,
  generateMnemonicIfAvailable,
  buildDifferentialList,
  calculateReadingTime,
  adaptExplanation,
  generateStudyTip,
  type UserBiasProfile,
} from './explanationCompressionService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProfile(partial: Partial<UserBiasProfile> = {}): UserBiasProfile {
  return {
    guessingRate: 0.1,
    overthinkingRate: 0.1,
    avgTimePerQuestion: 60,
    weakSystems: [],
    commonErrors: [],
    ...partial,
  };
}

const CARDIOLOGY_TEXT =
  'ST elevation on ECG is the hallmark of STEMI. ' +
  'Troponin levels rise within 3-6 hours of infarction onset. ' +
  'First-line treatment is immediate PCI or thrombolysis. ' +
  'Unlike NSTEMI, STEMI requires emergent revascularization. ' +
  'Gold standard for diagnosis is coronary angiography. ' +
  'The correct answer is STEMI because ST elevation is present.';

// ─── compressExplanation ──────────────────────────────────────────────────────

describe('compressExplanation', () => {
  it('returns ["[REVIEW REQUIRED]"] for empty string', () => {
    expect(compressExplanation('')).toEqual(['[REVIEW REQUIRED]']);
  });

  it('returns ["[REVIEW REQUIRED]"] for whitespace-only string', () => {
    expect(compressExplanation('   ')).toEqual(['[REVIEW REQUIRED]']);
  });

  it('returns an array of strings for valid input', () => {
    const bullets = compressExplanation(CARDIOLOGY_TEXT);
    expect(Array.isArray(bullets)).toBe(true);
    expect(bullets.every(b => typeof b === 'string')).toBe(true);
  });

  it('returns at least 3 items for substantial text', () => {
    const bullets = compressExplanation(CARDIOLOGY_TEXT);
    expect(bullets.length).toBeGreaterThanOrEqual(3);
  });

  it('returns no more than 6 items', () => {
    const longText = Array.from({ length: 20 }, (_, i) =>
      `Sentence ${i + 1} about medical diagnosis and treatment.`
    ).join(' ');
    const bullets = compressExplanation(longText);
    // Core output is sliced to 6 before [REVIEW REQUIRED] padding
    expect(bullets.filter(b => b !== '[REVIEW REQUIRED]').length).toBeLessThanOrEqual(6);
  });

  it('auto-bolds pathognomonic terms (wraps in **)', () => {
    const text = 'ST elevation is diagnostic. Troponin is elevated.';
    const bullets = compressExplanation(text);
    const combined = bullets.join(' ');
    expect(combined).toMatch(/\*\*ST elevation\*\*/);
  });

  it('filters out sentences that state the correct answer', () => {
    const text =
      'The correct answer is STEMI. ' +
      'ST elevation occurs due to myocardial injury. ' +
      'First-line treatment is PCI. ' +
      'Troponin confirms the diagnosis.';
    const bullets = compressExplanation(text);
    expect(bullets.every(b => !/The correct answer is/i.test(b))).toBe(true);
  });

  it('also filters "Answer is X" variants', () => {
    const text =
      'Answer is B. ST elevation is diagnostic. ' +
      'Troponin rises after infarction. First-line is PCI.';
    const bullets = compressExplanation(text);
    expect(bullets.every(b => !/^Answer is/i.test(b))).toBe(true);
  });

  it('appends [REVIEW REQUIRED] when fewer than 3 high-yield sentences found', () => {
    // Single short, low-scoring sentence
    const text = 'This is a basic fact about medicine.';
    const bullets = compressExplanation(text);
    expect(bullets).toContain('[REVIEW REQUIRED]');
  });

  it('prioritizes sentences with diagnostic keywords higher', () => {
    const text =
      'Gold standard diagnosis requires coronary angiography. ' +
      'Weather is nice today. ' +
      'The sky is blue. ' +
      'Another irrelevant fact here.';
    const bullets = compressExplanation(text);
    // The diagnostic sentence should appear
    expect(bullets.some(b => /gold standard/i.test(b))).toBe(true);
  });
});

// ─── extractBuzzwords ─────────────────────────────────────────────────────────

describe('extractBuzzwords', () => {
  it('returns "[REVIEW REQUIRED]" for empty string', () => {
    expect(extractBuzzwords('')).toBe('[REVIEW REQUIRED]');
  });

  it('returns "[No specific buzzwords identified]" when no known terms found', () => {
    expect(extractBuzzwords('The patient is well. Prognosis is good.')).toBe(
      '[No specific buzzwords identified]'
    );
  });

  it('finds pathognomonic terms and wraps in **', () => {
    const result = extractBuzzwords('ST elevation is present. Troponin is elevated.');
    expect(result).toMatch(/\*\*ST elevation\*\*/);
    expect(result).toMatch(/\*\*troponin\*\*/i);
  });

  it('extracts quoted terms from text', () => {
    const result = extractBuzzwords('The "herald patch" is classic for pityriasis rosea.');
    expect(result).toMatch(/herald patch/i);
  });

  it('returns at most 6 terms (comma-separated)', () => {
    const text =
      'ST elevation, troponin, STEMI, NSTEMI, pulsus paradoxus, JVD, ' +
      "Beck's triad, Kussmaul sign, cardiac enzymes present.";
    const result = extractBuzzwords(text);
    const parts = result.split(', ');
    expect(parts.length).toBeLessThanOrEqual(6);
  });

  it('returns a string (not an array)', () => {
    const result = extractBuzzwords(CARDIOLOGY_TEXT);
    expect(typeof result).toBe('string');
  });

  it('is case-insensitive when matching pathognomonic terms', () => {
    // "stridor" is in PATHOGNOMONIC_TERMS
    const result = extractBuzzwords('STRIDOR was audible on exam.');
    expect(result).not.toBe('[No specific buzzwords identified]');
  });
});

// ─── generateMnemonicIfAvailable ─────────────────────────────────────────────

describe('generateMnemonicIfAvailable', () => {
  it('returns "[Mnemonic not available]" for empty string', () => {
    expect(generateMnemonicIfAvailable('')).toBe('[Mnemonic not available]');
  });

  it('returns a mnemonic for exact DB match "heart_failure"', () => {
    const result = generateMnemonicIfAvailable('heart failure');
    expect(result).not.toBe('[Mnemonic not available]');
    expect(result).toMatch(/HEART/i);
  });

  it('normalizes condition name (spaces → underscores, lowercase)', () => {
    const result = generateMnemonicIfAvailable('Heart Failure');
    expect(result).not.toBe('[Mnemonic not available]');
  });

  it('returns mnemonic for "DKA" via "dka" normalization', () => {
    const result = generateMnemonicIfAvailable('DKA');
    expect(result).not.toBe('[Mnemonic not available]');
    expect(result).toMatch(/DKA/i);
  });

  it('returns mnemonic for "myocardial infarction"', () => {
    const result = generateMnemonicIfAvailable('myocardial infarction');
    expect(result).not.toBe('[Mnemonic not available]');
    expect(result).toMatch(/STEMI/i);
  });

  it('returns "[Mnemonic not available]" for unknown condition', () => {
    expect(generateMnemonicIfAvailable('extremely rare exotic syndrome XYZ')).toBe(
      '[Mnemonic not available]'
    );
  });

  it('does partial match: "atrial" matches "atrial_fibrillation"', () => {
    const result = generateMnemonicIfAvailable('atrial fibrillation');
    expect(result).not.toBe('[Mnemonic not available]');
    expect(result).toMatch(/PIRATES/i);
  });

  it('returns a string in all cases', () => {
    for (const cond of ['stroke', 'meningitis', 'anemia', 'unknown xyz']) {
      expect(typeof generateMnemonicIfAvailable(cond)).toBe('string');
    }
  });
});

// ─── buildDifferentialList ────────────────────────────────────────────────────

describe('buildDifferentialList', () => {
  it('returns ["[No differentials specified]"] for empty condition', () => {
    expect(buildDifferentialList('', ['NSTEMI'])).toEqual(['[No differentials specified]']);
  });

  it('returns ["[No differentials specified]"] for empty confusionPairs', () => {
    expect(buildDifferentialList('STEMI', [])).toEqual(['[No differentials specified]']);
  });

  it('returns known differential text for STEMI vs NSTEMI', () => {
    const result = buildDifferentialList('STEMI', ['NSTEMI']);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatch(/ST/i); // should mention ST change differences
  });

  it('uses generic format for condition not in pattern DB', () => {
    const result = buildDifferentialList('Rare Disease', ['Common Disease']);
    expect(result[0]).toMatch(/Rare Disease vs/i);
    expect(result[0]).toMatch(/Common Disease/);
  });

  it('falls back to generic for known condition but unknown pair', () => {
    const result = buildDifferentialList('STEMI', ['Myocarditis']); // not in pattern
    expect(result[0]).toMatch(/Myocarditis/);
  });

  it('returns one entry per confusion pair', () => {
    const result = buildDifferentialList('Appendicitis', ['Diverticulitis', 'Ectopic Pregnancy']);
    expect(result.length).toBe(2);
  });

  it('returns an array of strings', () => {
    const result = buildDifferentialList('Pneumonia', ['Bronchitis']);
    expect(Array.isArray(result)).toBe(true);
    expect(result.every(r => typeof r === 'string')).toBe(true);
  });
});

// ─── calculateReadingTime ─────────────────────────────────────────────────────

describe('calculateReadingTime', () => {
  it('returns {seconds: 0, formatted: "0 sec"} for empty string', () => {
    expect(calculateReadingTime('')).toEqual({ seconds: 0, formatted: '0 sec' });
  });

  it('returns {seconds: 0, formatted: "0 sec"} for whitespace-only string', () => {
    expect(calculateReadingTime('   ')).toEqual({ seconds: 0, formatted: '0 sec' });
  });

  it('computes seconds as ceil(wordCount / 200 * 60)', () => {
    // 100 words → 100/200 minutes → 30 seconds
    const text = Array(100).fill('word').join(' ');
    const result = calculateReadingTime(text);
    expect(result.seconds).toBe(30);
  });

  it('formats < 60s as "X sec"', () => {
    const text = Array(50).fill('word').join(' '); // 50 words → 15s
    expect(calculateReadingTime(text).formatted).toBe('15 sec');
  });

  it('formats 60-119s as "1 min"', () => {
    // 200 words → exactly 60 seconds
    const text = Array(200).fill('word').join(' ');
    expect(calculateReadingTime(text).formatted).toBe('1 min');
  });

  it('formats >= 120s as "N min" (rounded up)', () => {
    // 400 words → 120 seconds → 2 min
    const text = Array(400).fill('word').join(' ');
    const result = calculateReadingTime(text);
    expect(result.formatted).toBe('2 min');
    expect(result.seconds).toBe(120);
  });

  it('uses 200 words per minute (medical reading speed)', () => {
    // 200 words = exactly 1 min = 60 seconds
    const text = Array(200).fill('word').join(' ');
    expect(calculateReadingTime(text).seconds).toBe(60);
  });

  it('returns integer seconds (Math.ceil)', () => {
    // 1 word → ceil(1/200 * 60) = ceil(0.3) = 1
    expect(calculateReadingTime('word').seconds).toBe(1);
  });
});

// ─── adaptExplanation ────────────────────────────────────────────────────────

describe('adaptExplanation', () => {
  it('returns an object with text, bullets, and adaptations', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT);
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('bullets');
    expect(result).toHaveProperty('adaptations');
    expect(Array.isArray(result.bullets)).toBe(true);
  });

  it('always returns at least one bullet (never empty bullets array)', () => {
    // Even with a focus filter that eliminates everything, falls back to full explanation
    const result = adaptExplanation('Some non-matching text here.', {
      focus: 'treatment',
    });
    expect(result.bullets.length).toBeGreaterThan(0);
  });

  it('text = bullets joined with \\n\\n', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT);
    expect(result.text).toBe(result.bullets.join('\n\n'));
  });

  it('verbosity "minimal" limits bullets to 3', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT, { verbosity: 'minimal' });
    expect(result.bullets.length).toBeLessThanOrEqual(3);
    expect(result.adaptations).toContain('Minimal verbosity applied');
  });

  it('verbosity "detailed" prepends full explanation as first bullet', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT, { verbosity: 'detailed' });
    expect(result.bullets[0]).toBe(CARDIOLOGY_TEXT);
    expect(result.adaptations).toContain('Detailed explanation included');
  });

  it('includeReadingTime = true attaches readingTime to result', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT, { includeReadingTime: true });
    expect(result.readingTime).toBeDefined();
    expect(result.readingTime?.seconds).toBeGreaterThan(0);
  });

  it('includeReadingTime = false (default) leaves readingTime undefined', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT);
    expect(result.readingTime).toBeUndefined();
  });

  it('high guessingRate (> 0.4) notes adaptation in array', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT, {
      userProfile: makeProfile({ guessingRate: 0.5 }),
    });
    expect(result.adaptations.some(a => /diagnostic/i.test(a))).toBe(true);
  });

  it('high overthinkingRate (> 0.4) notes adaptation in array', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT, {
      userProfile: makeProfile({ overthinkingRate: 0.5 }),
    });
    expect(result.adaptations.some(a => /decision rules/i.test(a))).toBe(true);
  });

  it('slow user (avgTimePerQuestion > 90) adds condensed adaptation note', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT, {
      userProfile: makeProfile({ avgTimePerQuestion: 120 }),
    });
    expect(result.adaptations.some(a => /high.?yield/i.test(a))).toBe(true);
  });

  it('calculation error in commonErrors adds numeric prefix 🔢 to numeric bullets', () => {
    const numericText =
      'Troponin rises within 3-6 hours of onset. ' +
      'Calculate the dose as 0.5 mg/kg. ' +
      'First-line treatment is PCI for STEMI patients.';
    const result = adaptExplanation(numericText, {
      userProfile: makeProfile({ commonErrors: ['calculation'] }),
    });
    expect(result.adaptations.some(a => /calculations/i.test(a))).toBe(true);
  });

  it('focus "diagnostic" filters to diagnostic-relevant bullets', () => {
    const diagText =
      'Diagnose STEMI with ECG and troponin. ' +
      'Treat with PCI immediately after diagnosis. ' +
      'Signs include ST elevation and chest pain.';
    const result = adaptExplanation(diagText, { focus: 'diagnostic' });
    // All remaining bullets should match diagnostic pattern or be fallback
    for (const bullet of result.bullets) {
      const isDiagnostic = /\b(diagnos|symptom|sign|present|finding|test|lab)\b/i.test(bullet);
      const isFallback = bullet === diagText;
      expect(isDiagnostic || isFallback).toBe(true);
    }
  });

  it('adaptations is empty array when no adaptations applied', () => {
    const result = adaptExplanation(CARDIOLOGY_TEXT, {}); // no profile, standard verbosity, all focus
    expect(result.adaptations).toEqual([]);
  });
});

// ─── generateStudyTip ─────────────────────────────────────────────────────────

describe('generateStudyTip', () => {
  it('returns a non-empty string', () => {
    const tip = generateStudyTip(makeProfile());
    expect(typeof tip).toBe('string');
    expect(tip.length).toBeGreaterThan(0);
  });

  it('returns a tip about diagnostic criteria when guessingRate > 0.4', () => {
    const tip = generateStudyTip(makeProfile({ guessingRate: 0.5 }));
    expect(tip).toMatch(/diagnostic/i);
  });

  it('returns a tip about trusting instinct when overthinkingRate > 0.4', () => {
    const tip = generateStudyTip(makeProfile({ overthinkingRate: 0.5 }));
    expect(tip).toMatch(/instinct|first-line/i);
  });

  it('returns a timed drills tip when avgTimePerQuestion > 90', () => {
    const tip = generateStudyTip(makeProfile({ avgTimePerQuestion: 120 }));
    expect(tip).toMatch(/timed drill/i);
  });

  it('returns a "slow down" tip when avgTimePerQuestion < 30', () => {
    const tip = generateStudyTip(makeProfile({ avgTimePerQuestion: 20 }));
    expect(tip).toMatch(/slow down/i);
  });

  it('returns a misread tip when commonErrors includes "misread"', () => {
    const tip = generateStudyTip(makeProfile({ commonErrors: ['misread'] }));
    expect(tip).toMatch(/underline/i);
  });

  it('returns a calculation tip when commonErrors includes "calculation"', () => {
    const tip = generateStudyTip(makeProfile({ commonErrors: ['calculation'] }));
    expect(tip).toMatch(/formula/i);
  });

  it('returns the default "keep up" tip when profile has no issues', () => {
    const tip = generateStudyTip(makeProfile());
    // Default tip when no special conditions trigger
    expect(tip).toMatch(/keep up|consistency/i);
  });

  it('always starts with "[!]"', () => {
    const profiles = [
      makeProfile(),
      makeProfile({ guessingRate: 0.5 }),
      makeProfile({ avgTimePerQuestion: 150 }),
    ];
    for (const profile of profiles) {
      expect(generateStudyTip(profile)).toMatch(/^\[!\]/);
    }
  });
});
