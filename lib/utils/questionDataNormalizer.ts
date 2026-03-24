/**
 * Utility functions for normalizing question data formats
 */

import { logger } from '@/lib/logger';

/**
 * Normalize question options to a string array format.
 * Handles multiple formats:
 * - Array format: ["Option A", "Option B", "Option C", "Option D"]
 * - Object format: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" }
 * - String format: Parses JSON if possible
 *
 * @param options - The options in any supported format
 * @returns Array of option strings, sorted by key if object format
 */
export function normalizeOptionsToArray(options: unknown): string[] {
  // Already an array
  if (Array.isArray(options)) {
    return options.filter((opt): opt is string => typeof opt === 'string');
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
      logger.warn('questionDataNormalizer', 'Failed to parse options string as JSON — returning empty array', {
        options: options.slice(0, 200),
        err,
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
