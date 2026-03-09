#!/usr/bin/env npx tsx
/**
 * Validation rules for data quality enhancement.
 * Defines adequacy criteria for all fields in MedicalContent, Drug, and other tables.
 */

/**
 * Fields that should be skipped from validation (primary keys, timestamps, etc.)
 */
const SKIP_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'approvedAt',
  'createdBy',
  'updatedBy',
  'publishedBy',
  'approvedBy',
  'conditionId',
  'medicalContentId',
  'drugId',
  'parentId',
  'normalization_version',
  'search_vector',
  'version',
  'status',
]);

/**
 * Detect placeholder strings (e.g., "TODO", "TBD", "N/A", "?", "to be generated").
 */
export function isPlaceholder(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return true;
  const placeholderPatterns = [
    'todo',
    'tbd',
    'to be determined',
    'to be generated',
    'content needed',
    'n/a',
    'na',
    'none',
    '?',
    '??',
    '???',
    'pending',
    'fill',
    'placeholder',
    'example',
    'sample',
  ];
  return placeholderPatterns.some(pattern => trimmed.includes(pattern));
}

/**
 * Validate URL format (supports http, https, ftp).
 */
export function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ftp:';
  } catch {
    return false;
  }
}

/**
 * Validate date string (ISO 8601 or common formats).
 * Returns true if can be parsed to a valid Date.
 */
export function isDate(value: string): boolean {
  // ISO 8601 regex (simplified)
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (isoRegex.test(value)) return true;
  // Try Date.parse
  const parsed = Date.parse(value);
  return !isNaN(parsed);
}

/**
 * Validate Digital Object Identifier (DOI) pattern.
 * Example: 10.1000/xyz123
 */
export function isDoi(value: string): boolean {
  const doiRegex = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
  return doiRegex.test(value.trim());
}

/**
 * Determine field type based on field name.
 */
export function inferFieldType(fieldName: string): 'string' | 'array' | 'json' | 'date' | 'url' | 'doi' | 'unknown' {
  const lower = fieldName.toLowerCase();
  if (lower.endsWith('url') || lower.endsWith('link') || lower.includes('image') || lower.includes('video')) {
    return 'url';
  }
  if (lower.endsWith('at') || lower.endsWith('date') || lower.endsWith('timestamp')) {
    return 'date';
  }
  if (lower.includes('doi')) {
    return 'doi';
  }
  if (lower.endsWith('json') || lower.endsWith('jsonb')) {
    return 'json';
  }
  // Known JSON fields (Prisma Json type)
  const knownJsonFields = new Set([
    'content',
    'complicationrates',
    'distinguishingfeatures',
    'byacuity',
    'byage',
    'cyp450effects',
    'pharmacokinetics',
    'majorinteractions',
    'doserecommendations',
    'effective',
    'resistant',
    'scoringmap',
    'components',
    'vignettes',
    'score',
    'phasesdata',
    'answers',
    'distinguishers',
    'searchvector',
    'search_vector',
    'options',
    'tags',
    'systembreakdown',
    'payload',
    'result',
    'details',
    'checklist',
    'scoringmap',
    'labs',
    'metadata',
    'phasesdata',
    'phasesData',
    'byAcuity',
    'byAge',
    'cyp450Effects',
    'majorInteractions',
    'doseRecommendations',
    'scoringMap',
    'systemBreakdown',
  ]);
  if (knownJsonFields.has(lower) || knownJsonFields.has(fieldName)) {
    return 'json';
  }
  // Heuristic: field names ending with 's' might be arrays (but not always)
  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    // We'll rely on actual value type
  }
  return 'string';
}

/**
 * Generic adequacy check for any field value.
 * Returns { adequate: boolean, reason?: string }
 */
export function checkFieldAdequacy(fieldName: string, value: unknown): { adequate: boolean; reason?: string } {
  // Skip validation for internal fields
  if (SKIP_FIELDS.has(fieldName)) {
    return { adequate: true };
  }

  // Null/undefined
  if (value === null || value === undefined) {
    return { adequate: false, reason: 'null' };
  }

  // String fields
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { adequate: false, reason: 'empty string' };
    }
    if (isPlaceholder(trimmed)) {
      return { adequate: false, reason: 'placeholder' };
    }

    const fieldType = inferFieldType(fieldName);
    switch (fieldType) {
      case 'url':
        if (!isUrl(trimmed)) {
          return { adequate: false, reason: 'invalid URL' };
        }
        break;
      case 'date':
        if (!isDate(trimmed)) {
          return { adequate: false, reason: 'invalid date format' };
        }
        break;
      case 'doi':
        if (!isDoi(trimmed)) {
          return { adequate: false, reason: 'invalid DOI' };
        }
        break;
      default:
        // Generic string length check (minimum 2 characters)
        if (trimmed.length < 2) {
          return { adequate: false, reason: 'string too short' };
        }
    }
    return { adequate: true };
  }

  // Array fields
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { adequate: false, reason: 'empty array' };
    }
    // Check each element for placeholder strings
    for (const elem of value) {
      if (typeof elem === 'string' && isPlaceholder(elem)) {
        return { adequate: false, reason: 'array contains placeholder' };
      }
    }
    return { adequate: true };
  }

  // Object fields (JSONB) - Prisma returns objects for Json fields
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Check if it's an empty object
    if (Object.keys(value).length === 0) {
      return { adequate: false, reason: 'empty object' };
    }
    // For JSON objects, we could validate deeper but skip for now
    return { adequate: true };
  }

  // Number/boolean are considered adequate
  return { adequate: true };
}

/**
 * Get all fields of a table that are inadequate.
 * Returns array of { field: string, value: any, reason: string }.
 */
export function findInadequateFields(record: Record<string, any>): Array<{ field: string; value: any; reason: string }> {
  const inadequate: Array<{ field: string; value: any; reason: string }> = [];
  for (const [field, value] of Object.entries(record)) {
    const { adequate, reason } = checkFieldAdequacy(field, value);
    if (!adequate) {
      inadequate.push({ field, value, reason: reason || 'inadequate' });
    }
  }
  return inadequate;
}