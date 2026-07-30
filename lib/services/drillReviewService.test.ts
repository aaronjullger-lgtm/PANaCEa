/**
 * Unit tests for lib/services/drillReviewService.ts
 *
 * Coverage targets:
 *   1. Pure functions: findSelectedOption, resolveCorrectAnswer, isSelectedAnswerCorrect
 *   2. These are the correctness gatekeepers — bugs here corrupt every review.
 *
 * Phase 2 (future): integration tests with mocked Prisma for submitDrillReview.
 */

import { describe, it, expect } from 'vitest';
import {
  findSelectedOption,
  resolveCorrectAnswer,
  isSelectedAnswerCorrect,
  type QuestionData,
} from './drillReviewService';

// ─── findSelectedOption ────────────────────────────────────────────────────────

describe('findSelectedOption', () => {
  it('returns null for undefined pool', () => {
    expect(findSelectedOption(undefined, 'A')).toBeNull();
  });

  it('returns null for non-array pool', () => {
    expect(findSelectedOption('not-an-array' as any, 'A')).toBeNull();
  });

  it('returns null when selectedAnswer is not in pool', () => {
    expect(findSelectedOption(['A', 'B', 'C'], 'D')).toBeNull();
  });

  // ── String array pool ──

  it('matches a string array entry', () => {
    const result = findSelectedOption(['A', 'B', 'C'], 'B');
    expect(result).toEqual({ label: 'B' });
  });

  it('matches the first string array entry', () => {
    const result = findSelectedOption(['A', 'B', 'C'], 'A');
    expect(result).toEqual({ label: 'A' });
  });

  // ── Object pool with value/text/label ──

  it('matches by value property', () => {
    const pool = [{ value: 'Penicillin' }, { value: 'Vancomycin' }];
    const result = findSelectedOption(pool, 'Vancomycin');
    expect(result?.label).toBe('Vancomycin');
  });

  it('matches by text property', () => {
    const pool = [{ text: 'Penicillin' }, { text: 'Vancomycin' }];
    const result = findSelectedOption(pool, 'Vancomycin');
    expect(result?.label).toBe('Vancomycin');
  });

  it('matches by label property', () => {
    const pool = [{ label: 'Penicillin' }, { label: 'Vancomycin' }];
    const result = findSelectedOption(pool, 'Vancomycin');
    expect(result?.label).toBe('Vancomycin');
  });

  // ── Condition linkage ──

  it('extracts conditionId from matched option', () => {
    const pool = [
      { value: 'CHF', conditionId: 'cond-123' },
      { value: 'COPD', conditionId: 'cond-456' },
    ];
    const result = findSelectedOption(pool, 'COPD');
    expect(result).toEqual({ label: 'COPD', conditionId: 'cond-456', conditionName: 'COPD' });
  });

  it('extracts condition_id (snake_case) as conditionId', () => {
    const pool = [{ value: 'MI', condition_id: 'cond-789' }];
    const result = findSelectedOption(pool, 'MI');
    expect(result?.conditionId).toBe('cond-789');
  });

  it('extracts conditionRef as conditionId', () => {
    const pool = [{ value: 'Sepsis', conditionRef: 'ref-001' }];
    const result = findSelectedOption(pool, 'Sepsis');
    expect(result?.conditionId).toBe('ref-001');
  });

  it('extracts medicalContentId as conditionId', () => {
    const pool = [{ value: 'Pneumonia', medicalContentId: 'mc-001' }];
    const result = findSelectedOption(pool, 'Pneumonia');
    expect(result?.conditionId).toBe('mc-001');
  });

  it('falls back to option.id for conditionId when no explicit condition field', () => {
    const pool = [{ value: 'Asthma', id: 'opt-1' }];
    const result = findSelectedOption(pool, 'Asthma');
    expect(result?.conditionId).toBe('opt-1');
  });

  it('uses conditionName for conditionName when present', () => {
    const pool = [{ value: 'T2DM', conditionName: 'Type 2 Diabetes Mellitus' }];
    const result = findSelectedOption(pool, 'T2DM');
    expect(result?.conditionName).toBe('Type 2 Diabetes Mellitus');
  });

  it('falls back to condition field for conditionName', () => {
    const pool = [{ value: 'T2DM', condition: 'Type 2 Diabetes' }];
    const result = findSelectedOption(pool, 'T2DM');
    expect(result?.conditionName).toBe('Type 2 Diabetes');
  });

  it('falls back to label for conditionName when no condition fields', () => {
    const pool = [{ value: 'CKD' }];
    const result = findSelectedOption(pool, 'CKD');
    expect(result?.conditionName).toBe('CKD');
  });

  // ── Mixed pool ──

  it('handles mixed string and object pool', () => {
    const pool = ['A', { value: 'B' }, { text: 'C' }];
    expect(findSelectedOption(pool, 'A')?.label).toBe('A');
    expect(findSelectedOption(pool, 'B')?.label).toBe('B');
    expect(findSelectedOption(pool, 'C')?.label).toBe('C');
  });
});

// ─── resolveCorrectAnswer ─────────────────────────────────────────────────────

describe('resolveCorrectAnswer', () => {
  it('returns null for empty question data', () => {
    expect(resolveCorrectAnswer({})).toBeNull();
  });

  // ── Index-based resolution ──

  it('resolves from correctAnswerIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 1,
    };
    expect(resolveCorrectAnswer(qd)).toBe('B');
  });

  it('resolves from correctIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctIndex: 2,
    };
    expect(resolveCorrectAnswer(qd)).toBe('C');
  });

  it('prefers correctAnswerIndex over correctIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 0,
      correctIndex: 2,
    };
    expect(resolveCorrectAnswer(qd)).toBe('A');
  });

  it('returns null when correctAnswerIndex is out of bounds', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: 5,
    };
    // Falls through to correctAnswer string check, which is null
    expect(resolveCorrectAnswer(qd)).toBeNull();
  });

  it('returns null when correctAnswerIndex is negative', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: -1,
    };
    expect(resolveCorrectAnswer(qd)).toBeNull();
  });

  it('returns null when correctAnswerIndex is not an integer', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: 1.5,
    };
    expect(resolveCorrectAnswer(qd)).toBeNull();
  });

  // ── String-based resolution ──

  it('resolves from correctAnswer string', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin', 'Ceftriaxone'],
      correctAnswer: 'Vancomycin',
    };
    expect(resolveCorrectAnswer(qd)).toBe('Vancomycin');
  });

  it('resolves from answer string', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      answer: 'B',
    };
    expect(resolveCorrectAnswer(qd)).toBe('B');
  });

  it('resolves from correct_option string', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correct_option: 'A',
    };
    expect(resolveCorrectAnswer(qd)).toBe('A');
  });

  it('resolves from correctChoice string', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctChoice: 'B',
    };
    expect(resolveCorrectAnswer(qd)).toBe('B');
  });

  // ── Options as objects ──

  it('resolves from object options by value', () => {
    const qd: QuestionData = {
      options: [{ value: 'Lisinopril' }, { value: 'Losartan' }],
      correctAnswerIndex: 0,
    };
    expect(resolveCorrectAnswer(qd)).toBe('Lisinopril');
  });

  it('resolves from object options by text', () => {
    const qd: QuestionData = {
      options: [{ text: 'Lisinopril' }, { text: 'Losartan' }],
      correctAnswerIndex: 1,
    };
    expect(resolveCorrectAnswer(qd)).toBe('Losartan');
  });

  it('resolves from object options by label', () => {
    const qd: QuestionData = {
      options: [{ label: 'Lisinopril' }, { label: 'Losartan' }],
      correctAnswerIndex: 0,
    };
    expect(resolveCorrectAnswer(qd)).toBe('Lisinopril');
  });

  // ── Choices array ──

  it('works with choices instead of options', () => {
    const qd: QuestionData = {
      choices: ['A', 'B', 'C'],
      correctAnswerIndex: 2,
    };
    expect(resolveCorrectAnswer(qd)).toBe('C');
  });

  it('returns correctAnswer directly when no options provided', () => {
    const qd: QuestionData = {
      correctAnswer: 'Metoprolol',
    };
    expect(resolveCorrectAnswer(qd)).toBe('Metoprolol');
  });
});

// ─── isSelectedAnswerCorrect ──────────────────────────────────────────────────

describe('isSelectedAnswerCorrect', () => {
  // ── Index-based comparison ──

  it('returns true when selected matches correctAnswerIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 1,
    };
    expect(isSelectedAnswerCorrect(qd, 'B')).toBe(true);
  });

  it('returns false when selected does not match correctAnswerIndex', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C'],
      correctAnswerIndex: 1,
    };
    expect(isSelectedAnswerCorrect(qd, 'A')).toBe(false);
  });

  // ── String-based comparison ──

  it('returns true when selected matches correctAnswer string (exact)', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, 'Vancomycin')).toBe(true);
  });

  it('returns true when selected matches correctAnswer string (case-insensitive)', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, 'vancomycin')).toBe(true);
  });

  it('returns true when selected matches correctAnswer string (whitespace-trimmed)', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, '  Vancomycin  ')).toBe(true);
  });

  it('returns false when selected does not match correctAnswer string', () => {
    const qd: QuestionData = {
      options: ['Penicillin', 'Vancomycin'],
      correctAnswer: 'Vancomycin',
    };
    expect(isSelectedAnswerCorrect(qd, 'Penicillin')).toBe(false);
  });

  // ── Edge cases ──

  it('returns false when no correct answer can be resolved', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
    };
    expect(isSelectedAnswerCorrect(qd, 'A')).toBe(false);
  });

  it('returns false for empty selected answer', () => {
    const qd: QuestionData = {
      options: ['A', 'B'],
      correctAnswerIndex: 0,
    };
    expect(isSelectedAnswerCorrect(qd, '')).toBe(false);
  });

  it('returns false when correctAnswerIndex and selected resolve to different indices', () => {
    const qd: QuestionData = {
      options: ['A', 'B', 'C', 'D'],
      correctAnswerIndex: 3,
    };
    expect(isSelectedAnswerCorrect(qd, 'A')).toBe(false);
  });

  // ── Object options ──

  it('works with object options and index', () => {
    const qd: QuestionData = {
      options: [{ value: 'Option A' }, { value: 'Option B' }],
      correctAnswerIndex: 1,
    };
    expect(isSelectedAnswerCorrect(qd, 'Option B')).toBe(true);
    expect(isSelectedAnswerCorrect(qd, 'Option A')).toBe(false);
  });

  // ── Letter-grade style answers ──

  it('resolves letter answer via answerLetterMap', () => {
    const qd: QuestionData = {
      options: ['First option', 'Second option', 'Third option'],
      correctAnswer: 'B',
    };
    // resolveAnswerIndexFromValue maps 'B' → index 1
    expect(isSelectedAnswerCorrect(qd, 'B')).toBe(true);
    expect(isSelectedAnswerCorrect(qd, 'Second option')).toBe(true);
  });
});
