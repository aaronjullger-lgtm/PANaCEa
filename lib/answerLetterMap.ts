/**
 * Canonical letter↔index conversion for answer options.
 *
 * ALL letter-to-index and index-to-letter conversions in the codebase MUST
 * use these functions. Do NOT create inline maps, charCodeAt arithmetic,
 * or LETTERS arrays elsewhere.
 *
 * Supports 5-option questions (A–E) as required by PANCE blueprint.
 *
 * Design decisions:
 * - Returns `null` on invalid input (never silently falls back to 0/"A").
 * - Callers must handle `null` explicitly — either throw, log, or skip.
 * - Case-insensitive for letters.
 */

/** The canonical set of valid answer letters, in index order. */
export const ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Type representing a valid answer letter. */
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

/** Maximum valid option index (0-based). */
export const MAX_OPTION_INDEX = ANSWER_LETTERS.length - 1; // 4

// Pre-built lookup map for O(1) conversion
const LETTER_TO_INDEX: ReadonlyMap<string, number> = new Map(
  ANSWER_LETTERS.map((letter, index) => [letter, index])
);

/**
 * Convert an answer letter ("A"–"E") to a 0-based index (0–4).
 *
 * @param letter - The answer letter to convert (case-insensitive).
 * @returns The 0-based index, or `null` if the letter is invalid.
 *
 * @example
 * letterToIndex('A') // 0
 * letterToIndex('E') // 4
 * letterToIndex('e') // 4
 * letterToIndex('F') // null
 * letterToIndex('')  // null
 */
export function letterToIndex(letter: string): number | null {
  if (typeof letter !== 'string' || letter.length !== 1) return null;
  const idx = LETTER_TO_INDEX.get(letter.toUpperCase());
  return idx !== undefined ? idx : null;
}

/**
 * Convert a 0-based index (0–4) to an answer letter ("A"–"E").
 *
 * @param index - The 0-based option index.
 * @returns The uppercase letter, or `null` if the index is out of range.
 *
 * @example
 * indexToLetter(0) // "A"
 * indexToLetter(4) // "E"
 * indexToLetter(5) // null
 * indexToLetter(-1) // null
 */
export function indexToLetter(index: number): string | null {
  if (typeof index !== 'number' || !Number.isInteger(index)) return null;
  return ANSWER_LETTERS[index] ?? null;
}

/**
 * Strict variant of letterToIndex that throws on invalid input.
 * Use at API boundaries where a malformed answer indicates a data integrity issue.
 *
 * @param letter - The answer letter to convert.
 * @param context - Description for the error message (e.g. question ID).
 * @returns The 0-based index.
 * @throws Error if the letter is not A–E.
 */
export function letterToIndexStrict(letter: string, context?: string): number {
  const idx = letterToIndex(letter);
  if (idx === null) {
    const ctx = context ? ` (${context})` : '';
    throw new Error(
      `Invalid answer letter "${letter}"${ctx}. Expected one of: ${ANSWER_LETTERS.join(', ')}`
    );
  }
  return idx;
}

/**
 * Strict variant of indexToLetter that throws on invalid input.
 *
 * @param index - The 0-based option index.
 * @param context - Description for the error message.
 * @returns The uppercase letter.
 * @throws Error if the index is not 0–4.
 */
export function indexToLetterStrict(index: number, context?: string): string {
  const letter = indexToLetter(index);
  if (letter === null) {
    const ctx = context ? ` (${context})` : '';
    throw new Error(
      `Invalid answer index ${index}${ctx}. Expected 0–${MAX_OPTION_INDEX}`
    );
  }
  return letter;
}

/**
 * Check whether a string is a valid answer letter (A–E, case-insensitive).
 */
export function isValidAnswerLetter(value: string): value is AnswerLetter {
  return typeof value === 'string' && value.length === 1 && LETTER_TO_INDEX.has(value.toUpperCase());
}

/**
 * Resolve a correctAnswer value that may be a letter ("A"–"E"), a numeric string ("0"–"4"),
 * or a full-text option string. Returns the 0-based index or `null`.
 *
 * Priority:
 * 1. Single letter A–E → index via letterToIndex
 * 2. Numeric string "0"–"4" → parsed integer
 * 3. Full-text string → indexOf match in options array
 * 4. Otherwise → null
 *
 * @param correctAnswer - The raw correctAnswer value from the database.
 * @param options - The options array to match against for full-text fallback.
 */
export function resolveCorrectAnswerIndex(
  correctAnswer: string,
  options: readonly string[]
): number | null {
  if (!correctAnswer || typeof correctAnswer !== 'string') return null;

  const trimmed = correctAnswer.trim();
  if (trimmed.length === 0) return null;

  // 1. Single letter A–E
  if (trimmed.length === 1) {
    const letterIdx = letterToIndex(trimmed);
    if (letterIdx !== null && letterIdx < options.length) return letterIdx;
    // Single character but not a valid letter — check if it's a digit
    const digitIdx = parseInt(trimmed, 10);
    if (!Number.isNaN(digitIdx) && digitIdx >= 0 && digitIdx < options.length) return digitIdx;
    return null;
  }

  // 2. Numeric string ("0", "1", etc.)
  const numericIdx = parseInt(trimmed, 10);
  if (!Number.isNaN(numericIdx) && String(numericIdx) === trimmed && numericIdx >= 0 && numericIdx < options.length) {
    return numericIdx;
  }

  // 3. Full-text match against options
  const textIdx = options.findIndex((o) => o === trimmed);
  return textIdx >= 0 ? textIdx : null;
}
