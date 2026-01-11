/**
 * JSON Parser Utilities
 * 
 * Safe parsing functions for handling JSONB fields from the database.
 * Prevents crashes from malformed JSON and provides sensible fallbacks.
 */

/**
 * Safely parses a JSON value with a fallback
 * 
 * @param value - The value to parse (can be string, object, or null)
 * @param fallback - The fallback value if parsing fails
 * @returns Parsed value or fallback
 * 
 * @example
 * const pearls = safeParseJson(row.clinical_pearls, []);
 * const demographic = safeParseJson(row.age_demographic, null);
 */
export function safeParseJson<T>(value: unknown, fallback: T): T {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }

  // If already the correct type, return as-is
  if (typeof value === 'object') {
    return value as T;
  }

  // Try to parse string as JSON
  if (typeof value === 'string') {
    // Empty string should return fallback
    if (value.trim() === '') {
      return fallback;
    }

    try {
      const parsed = JSON.parse(value);
      return parsed as T;
    } catch (error) {
      console.warn('[jsonParser] Failed to parse JSON:', { value, error });
      return fallback;
    }
  }

  // For any other type, return fallback
  return fallback;
}

/**
 * Normalizes various input formats to a string array
 * 
 * Handles:
 * - Already an array of strings → return as-is
 * - Single string → wrap in array
 * - String with newlines → split by newlines
 * - Object with values → extract values as strings
 * - Null/undefined → return empty array
 * 
 * @param value - The value to normalize
 * @returns Array of strings
 * 
 * @example
 * normalizeToStringArray(['item1', 'item2']) // ['item1', 'item2']
 * normalizeToStringArray('single item')      // ['single item']
 * normalizeToStringArray('line1\nline2')     // ['line1', 'line2']
 * normalizeToStringArray({ a: 'val1', b: 'val2' }) // ['val1', 'val2']
 */
export function normalizeToStringArray(value: unknown): string[] {
  // Handle null/undefined
  if (!value) {
    return [];
  }

  // Already a string array
  if (Array.isArray(value)) {
    return value
      .filter(item => item != null) // Remove null/undefined
      .map(item => String(item))    // Convert all to strings
      .filter(item => item.trim() !== ''); // Remove empty strings
  }

  // Single string
  if (typeof value === 'string') {
    // Check if it contains newlines (multiline string)
    if (value.includes('\n')) {
      return value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
    }
    
    // Single line string
    return value.trim() !== '' ? [value.trim()] : [];
  }

  // Object → extract values
  if (typeof value === 'object' && value !== null) {
    return Object.values(value)
      .filter(val => val != null)
      .map(val => String(val))
      .filter(val => val.trim() !== '');
  }

  // Fallback: empty array
  return [];
}

/**
 * Safely extracts a nested property from a JSONB object
 * 
 * @param obj - The object to extract from
 * @param path - Dot-separated path (e.g., 'diagnosis.gold_standard')
 * @param fallback - Fallback value if path doesn't exist
 * @returns The value at the path or fallback
 * 
 * @example
 * const goldStandard = safeExtractPath(content, 'diagnosis.gold_standard', '');
 * const firstLine = safeExtractPath(content, 'treatment.first_line', 'Unknown');
 */
export function safeExtractPath<T>(
  obj: unknown,
  path: string,
  fallback: T
): T {
  if (!obj || typeof obj !== 'object') {
    return fallback;
  }

  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return fallback;
    }
  }

  return current === undefined || current === null ? fallback : (current as T);
}

/**
 * Checks if a JSONB field is effectively empty
 * 
 * @param value - The value to check
 * @returns True if empty, false otherwise
 * 
 * @example
 * isEmptyJsonbField(null)           // true
 * isEmptyJsonbField([])             // true
 * isEmptyJsonbField({})             // true
 * isEmptyJsonbField(['item'])       // false
 * isEmptyJsonbField({ key: 'val' }) // false
 */
export function isEmptyJsonbField(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/**
 * Parses and validates an age demographic object
 * 
 * @param value - The age demographic value from database
 * @returns Parsed age demographic or null
 */
export function parseAgeDemographic(value: unknown): {
  min?: number;
  max?: number;
  notes?: string;
  peak?: string;
} | null {
  const parsed = safeParseJson<Record<string, unknown>>(value, {});
  
  if (isEmptyJsonbField(parsed)) {
    return null;
  }

  return {
    min: typeof parsed.min === 'number' ? parsed.min : undefined,
    max: typeof parsed.max === 'number' ? parsed.max : undefined,
    notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
    peak: typeof parsed.peak === 'string' ? parsed.peak : undefined,
  };
}

export default {
  safeParseJson,
  normalizeToStringArray,
  safeExtractPath,
  isEmptyJsonbField,
  parseAgeDemographic,
};
