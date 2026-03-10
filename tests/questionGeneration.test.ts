/**
 * Sprint 7: Unit tests for question generation output shape.
 * Asserts: rationale is object with whyIncorrectA/B/C/D when structured;
 * vignette does not contain condition name.
 */

import { describe, it, expect } from 'vitest';

/** Structured rationale shape expected from PANCE-style generation (sessionService / generate-enhanced). */
interface StructuredRationale {
  bottomLine?: string;
  whyCorrect: string;
  whyIncorrectA?: string;
  whyIncorrectB?: string;
  whyIncorrectC?: string;
  whyIncorrectD?: string;
  whyIncorrectE?: string;
  clinicalPearl?: string;
  highYieldImageOrTable?: string;
}

function isStructuredRationale(r: unknown): r is StructuredRationale {
  return (
    typeof r === 'object' &&
    r !== null &&
    'whyCorrect' in r &&
    typeof (r as StructuredRationale).whyCorrect === 'string'
  );
}

function hasPerDistractorRationale(r: StructuredRationale): boolean {
  const keys = ['whyIncorrectA', 'whyIncorrectB', 'whyIncorrectC', 'whyIncorrectD'] as const;
  let count = 0;
  for (const k of keys) {
    if (r[k] && typeof r[k] === 'string') count++;
  }
  return count >= 2;
}

/**
 * Vignette must not give away the diagnosis/condition name (raw patient data only).
 * Heuristic: "with [condition]" or "patient with [X] presents" often leaks diagnosis.
 */
function vignetteDoesNotContainConditionName(
  vignette: string | undefined,
  conditionName?: string
): boolean {
  if (!vignette?.trim()) return true;
  const lower = vignette.toLowerCase();
  // Common leak patterns
  if (/\bwith\s+(iron\s+deficiency\s+anemia|pneumonia|hypertension|diabetes|copd|asthma)\b/i.test(lower))
    return false;
  if (conditionName && lower.includes(conditionName.toLowerCase())) return false;
  return true;
}

describe('Question generation output shape', () => {
  describe('structured rationale', () => {
    it('identifies structured rationale when object has whyCorrect', () => {
      const obj = {
        bottomLine: 'Diagnosis is X.',
        whyCorrect: 'Vignette supports X.',
        whyIncorrectA: 'A is wrong because...',
        whyIncorrectB: 'B is wrong because...',
      };
      expect(isStructuredRationale(obj)).toBe(true);
      expect(hasPerDistractorRationale(obj)).toBe(true);
    });

    it('rejects plain string rationale', () => {
      expect(isStructuredRationale('Just a string')).toBe(false);
    });

    it('rejects object without whyCorrect', () => {
      expect(isStructuredRationale({ whyIncorrectA: 'A' })).toBe(false);
    });

    it('requires at least 2 whyIncorrect fields for per-distractor rationale', () => {
      const oneOnly = { whyCorrect: 'Y', whyIncorrectA: 'A' };
      expect(isStructuredRationale(oneOnly)).toBe(true);
      expect(hasPerDistractorRationale(oneOnly)).toBe(false);

      const two = { whyCorrect: 'Y', whyIncorrectA: 'A', whyIncorrectB: 'B' };
      expect(hasPerDistractorRationale(two)).toBe(true);
    });
  });

  describe('vignette does not contain condition name', () => {
    it('passes when vignette has only raw data', () => {
      const vignette =
        'A 45-year-old male with fatigue. Labs: Hgb 9.2 g/dL, MCV 72 fL, ferritin 10 ng/mL.';
      expect(vignetteDoesNotContainConditionName(vignette)).toBe(true);
    });

    it('fails when vignette states condition explicitly', () => {
      expect(
        vignetteDoesNotContainConditionName(
          'A patient with iron deficiency anemia presents with fatigue.'
        )
      ).toBe(false);
      expect(
        vignetteDoesNotContainConditionName('A patient with pneumonia presents with cough.')
      ).toBe(false);
    });

    it('fails when conditionName is passed and appears in vignette', () => {
      expect(
        vignetteDoesNotContainConditionName(
          'A 50-year-old with hypertension and diabetes.',
          'hypertension'
        )
      ).toBe(false);
    });

    it('treats undefined/empty vignette as valid', () => {
      expect(vignetteDoesNotContainConditionName(undefined)).toBe(true);
      expect(vignetteDoesNotContainConditionName('')).toBe(true);
    });
  });

  describe('full question shape (integration-style)', () => {
    it('accepts question with structured rationale and safe vignette', () => {
      const question = {
        id: 'q1',
        question: 'What is the most appropriate next step?',
        vignette:
          'A 58-year-old woman presents with chest pain. Vital signs: BP 160/95, HR 110. ECG shows ST-elevation in V1-V4.',
        options: ['A', 'B', 'C', 'D'],
        correctAnswerIndex: 0,
        rationale: {
          whyCorrect: 'STEMI; next step is PCI.',
          whyIncorrectA: 'A wrong because...',
          whyIncorrectB: 'B wrong because...',
          whyIncorrectC: 'C wrong because...',
          whyIncorrectD: 'D wrong because...',
        },
      };
      expect(isStructuredRationale(question.rationale)).toBe(true);
      expect(hasPerDistractorRationale(question.rationale as StructuredRationale)).toBe(true);
      expect(vignetteDoesNotContainConditionName(question.vignette)).toBe(true);
    });
  });
});
