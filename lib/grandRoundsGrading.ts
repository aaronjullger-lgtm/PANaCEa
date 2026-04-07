/**
 * Grand Rounds grading: normalize Question.correctAnswer (String) to 0-based index
 * for comparison with client-submitted answerIndex.
 * Used by grand-rounds submit and review APIs.
 */

import { letterToIndex } from './answerLetterMap';

/**
 * Normalize Question.correctAnswer (String: "A"/"B"/"C"/"D"/"E" or "0"/"1"/"2"/"3"/"4") to 0-based index.
 *
 * Returns `null` when the value cannot be resolved — callers must handle this explicitly.
 * Previous implementation silently returned 0 on invalid input, which would mark "A" as correct
 * for any malformed question.
 */
export function correctAnswerToIndex(correctAnswer: string, optionsLength: number): number | null {
  const s = String(correctAnswer).trim().toUpperCase();

  // 1. Single letter A–E
  const letterIdx = letterToIndex(s);
  if (letterIdx !== null) {
    return letterIdx < optionsLength ? letterIdx : null;
  }

  // 2. Numeric string "0"–"4"
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && String(n) === s && n >= 0 && n < optionsLength) return n;

  return null;
}
