/**
 * normalization.ts - Universal parser for MedicalContent JSONB fields
 *
 * Handles all edge cases:
 * - JSON arrays/objects stored as strings
 * - Raw text with list structure (newlines, bullets)
 * - "null" strings that should be actual null
 * - Already-parsed arrays/objects from Prisma
 */

import { safeParseJson, handleFakeNull, safeParseList } from './jsonParser';

/**
 * Universal parser for all MedicalContent fields.
 * Handles: arrays, objects, raw text, and "null" strings.
 *
 * @param fieldData - Unknown field value from database
 * @returns Normalized string[], object, string, or null
 */
export function universalParser(
  fieldData: unknown
): string[] | Record<string, unknown> | string | null {
  // Step 1: Handle fake nulls
  const nonFakeNull = handleFakeNull(fieldData, null);
  if (nonFakeNull === null) return null;

  // Step 2: Already correct type
  if (Array.isArray(nonFakeNull)) {
    return nonFakeNull.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof nonFakeNull === 'object' && nonFakeNull !== null) {
    return nonFakeNull as Record<string, unknown>;
  }

  // Step 3: String parsing
  if (typeof nonFakeNull === 'string') {
    const trimmed = nonFakeNull.trim();

    // Empty string = null
    if (!trimmed) return null;

    // JSON Array
    if (trimmed.startsWith('[')) {
      const parsed = safeParseJson<unknown[]>(trimmed, []);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [trimmed];
    }

    // JSON Object (for differentials, diagnosis, etc.)
    if (trimmed.startsWith('{')) {
      return safeParseJson<Record<string, unknown>>(trimmed, {});
    }

    // Raw text with potential list structure
    if (
      trimmed.includes('\n') ||
      trimmed.includes('•') ||
      trimmed.includes('*') ||
      trimmed.includes(',')
    ) {
      return safeParseList(trimmed);
    }

    // Plain single-line text
    return trimmed;
  }

  return null;
}

/**
 * Field-specific helper: Always returns string array
 * Use for: buzzwords, clinical_pearls, symptoms, signs, risk_factors, etc.
 */
export const parseListField = (value: unknown): string[] => {
  const result = universalParser(value);
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'string') return [result];
  return [];
};

/**
 * Field-specific helper: Returns object or null
 * Use for: diagnosis, differentials (structured data)
 */
export const parseObjectField = (value: unknown): Record<string, unknown> | null => {
  const result = universalParser(value);
  return typeof result === 'object' && result !== null && !Array.isArray(result) ? result : null;
};

/**
 * Field-specific helper: Returns string or null
 * Use for: overview, pathophysiology, treatment (long text)
 */
export const parseTextField = (value: unknown): string | null => {
  const result = universalParser(value);
  if (typeof result === 'string') return result;
  if (Array.isArray(result) && result.length > 0) return result.join('\n');
  return null;
};

/**
 * Normalize entire MedicalContent record
 * Apply universalParser to all relevant JSONB fields
 */
export function normalizeMedicalContent<T extends Record<string, unknown>>(rawData: T): T {
  const normalized = { ...rawData };

  // List fields
  const listFields = [
    'buzzwords',
    'clinical_pearls',
    'symptoms',
    'signs',
    'risk_factors',
    'labs_findings',
    'imaging_findings',
    'complications',
    'synonyms',
    'classic_triad',
    'mnemonics',
    'associations',
  ];

  listFields.forEach((field) => {
    if (field in normalized) {
      (normalized as any)[field] = parseListField(normalized[field]);
    }
  });

  // Text fields
  const textFields = [
    'overview',
    'pathophysiology',
    'treatment',
    'etiology',
    'epidemiology',
    'prognosis',
    'prevention',
    'patient_education',
    'classic_patient',
    'physical_exam',
    'monitoring',
    'lifestyle',
    'riskFactors',
  ];

  textFields.forEach((field) => {
    if (field in normalized) {
      (normalized as any)[field] = parseTextField(normalized[field]);
    }
  });

  // Object fields
  const objectFields = ['diagnosis', 'differentials'];

  objectFields.forEach((field) => {
    if (field in normalized) {
      (normalized as any)[field] = parseObjectField(normalized[field]);
    }
  });

  return normalized;
}
