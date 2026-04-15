/**
 * Utility functions for normalizing question data formats
 */

import { logger } from '@/lib/logger';

const normalizerLogger = logger.scope('questionDataNormalizer');

/**
 * Normalize question options to a string array format.
 * Handles multiple formats:
 * - String array: ["Option A", "Option B", "Option C", "Option D"]
 * - Object array: [{ value: "Option A", text?: "..." }, ...] (Anki / structured imports)
 * - Key-value object: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" }
 * - String format: Parses JSON if possible
 *
 * @param options - The options in any supported format
 * @returns Array of option strings, sorted by key if object format
 */
export function normalizeOptionsToArray(options: unknown): string[] {
  // Array: may contain plain strings OR objects with value/text/label (Anki, structured imports)
  if (Array.isArray(options)) {
    return options
      .map((opt): string => {
        if (typeof opt === 'string') return opt;
        if (typeof opt === 'object' && opt !== null) {
          // Priority: value → text → label (matches resolution order in due-siblings and ensureDueVariant)
          const o = opt as { value?: unknown; text?: unknown; label?: unknown };
          const extracted = o.value ?? o.text ?? o.label;
          if (typeof extracted === 'string') return extracted;
          if (extracted != null) return String(extracted);
        }
        return String(opt);
      })
      .filter((s) => s.trim().length > 0);
  }

  // Object format { A: "text", B: "text", ... }
  if (typeof options === 'object' && options !== null) {
    const optionsObj = options as Record<string, string>;
    const sortedKeys = Object.keys(optionsObj).sort((a, b) => a.localeCompare(b)); // A, B, C, D, E
    return sortedKeys
      .map((key) => optionsObj[key])
      .filter((val): val is string => typeof val === 'string');
  }

  // String format - try to parse as JSON
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return normalizeOptionsToArray(parsed);
    } catch (err) {
      normalizerLogger.warn('Failed to parse options string as JSON — returning empty array', {
        options: options.slice(0, 200),
        error: err,
      });
      return [];
    }
  }

  return [];
}

/**
 * Check if a question has valid options
 *
 * @param options - The options in any supported format
 * @returns True if the question has at least 2 valid options
 */
export function hasValidOptions(options: unknown): boolean {
  return normalizeOptionsToArray(options).length >= 2;
}
