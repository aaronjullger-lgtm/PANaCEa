/**
 * Grand Rounds grading: normalize Question.correctAnswer (String) to 0-based index
 * for comparison with client-submitted answerIndex.
 * Used by grand-rounds submit and review APIs.
 */

/**
 * Normalize Question.correctAnswer (String: "A"/"B"/"C"/"D" or "0"/"1"/"2"/"3") to 0-based index.
 */
export function correctAnswerToIndex(correctAnswer: string, optionsLength: number): number {
  const s = String(correctAnswer).trim().toUpperCase();
  if (s >= 'A' && s <= 'Z') {
    const idx = s.charCodeAt(0) - 'A'.charCodeAt(0);
    return idx >= 0 && idx < optionsLength ? idx : 0;
  }
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 0 && n < optionsLength) return n;
  return 0;
}
