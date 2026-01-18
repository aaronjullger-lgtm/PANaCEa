/**
 * Age Formatter Utility
 *
 * Handles various age formats for patient encounters including:
 * - Numeric years: 45 → "45-year-old"
 * - String with units: "3 months" → "3-month-old"
 * - Pediatric: "14 days" → "14-day-old"
 * - Already formatted: "6-month-old" → "6-month-old"
 */

export interface ParsedAge {
  value: number;
  unit: 'years' | 'months' | 'weeks' | 'days' | 'hours';
  displayString: string;
  shortDisplay: string;
  isPediatric: boolean;
  isNeonate: boolean;
  isInfant: boolean;
}

/**
 * Parse age from various formats and return standardized display strings
 */
export function parsePatientAge(age: number | string | null | undefined): ParsedAge {
  // Default for missing/invalid age
  if (age === null || age === undefined || age === '') {
    return {
      value: 0,
      unit: 'years',
      displayString: 'Unknown age',
      shortDisplay: 'Unknown',
      isPediatric: false,
      isNeonate: false,
      isInfant: false,
    };
  }

  // If it's a number, assume years
  if (typeof age === 'number') {
    const isPediatric = age < 18;
    const isNeonate = age < 1; // Will be 0 for neonates represented as years
    const isInfant = age < 2;

    return {
      value: age,
      unit: 'years',
      displayString: `${age}-year-old`,
      shortDisplay: `${age}yo`,
      isPediatric,
      isNeonate,
      isInfant,
    };
  }

  // Handle string formats
  const ageStr = String(age).toLowerCase().trim();

  // Already formatted pattern: "45-year-old", "3-month-old"
  const alreadyFormattedMatch = ageStr.match(/^(\d+)-?(year|month|week|day|hour)s?-old$/i);
  if (alreadyFormattedMatch) {
    const value = parseInt(alreadyFormattedMatch[1], 10);
    const unit = normalizeUnit(alreadyFormattedMatch[2]);
    return buildParsedAge(value, unit);
  }

  // Pattern: "45 years", "3 months", "14 days", "6 weeks", "12 hours"
  const withUnitMatch = ageStr.match(/^(\d+)\s*(year|month|week|day|hour)s?$/i);
  if (withUnitMatch) {
    const value = parseInt(withUnitMatch[1], 10);
    const unit = normalizeUnit(withUnitMatch[2]);
    return buildParsedAge(value, unit);
  }

  // Pattern: "45yo", "3mo", "14d", "6w", "12h"
  const abbreviatedMatch = ageStr.match(/^(\d+)\s*(yo|y|mo|m|wk|w|d|h)$/i);
  if (abbreviatedMatch) {
    const value = parseInt(abbreviatedMatch[1], 10);
    const abbrev = abbreviatedMatch[2].toLowerCase();
    let unit: ParsedAge['unit'] = 'years';

    switch (abbrev) {
      case 'yo':
      case 'y':
        unit = 'years';
        break;
      case 'mo':
      case 'm':
        unit = 'months';
        break;
      case 'wk':
      case 'w':
        unit = 'weeks';
        break;
      case 'd':
        unit = 'days';
        break;
      case 'h':
        unit = 'hours';
        break;
    }

    return buildParsedAge(value, unit);
  }

  // Plain number as string
  const plainNumberMatch = ageStr.match(/^(\d+)$/);
  if (plainNumberMatch) {
    const value = parseInt(plainNumberMatch[1], 10);
    return buildParsedAge(value, 'years');
  }

  // Fallback: try to extract any number
  const anyNumberMatch = ageStr.match(/(\d+)/);
  if (anyNumberMatch) {
    const value = parseInt(anyNumberMatch[1], 10);
    // Try to detect unit from context
    if (ageStr.includes('month')) return buildParsedAge(value, 'months');
    if (ageStr.includes('week')) return buildParsedAge(value, 'weeks');
    if (ageStr.includes('day')) return buildParsedAge(value, 'days');
    if (ageStr.includes('hour')) return buildParsedAge(value, 'hours');
    return buildParsedAge(value, 'years');
  }

  // Complete fallback
  return {
    value: 0,
    unit: 'years',
    displayString: String(age),
    shortDisplay: String(age),
    isPediatric: false,
    isNeonate: false,
    isInfant: false,
  };
}

/**
 * Normalize unit string to standard format
 */
function normalizeUnit(unit: string): ParsedAge['unit'] {
  const lower = unit.toLowerCase();
  if (lower.startsWith('year') || lower === 'y') return 'years';
  if (lower.startsWith('month') || lower === 'mo' || lower === 'm') return 'months';
  if (lower.startsWith('week') || lower === 'wk' || lower === 'w') return 'weeks';
  if (lower.startsWith('day') || lower === 'd') return 'days';
  if (lower.startsWith('hour') || lower === 'h') return 'hours';
  return 'years';
}

/**
 * Build ParsedAge object from value and unit
 */
function buildParsedAge(value: number, unit: ParsedAge['unit']): ParsedAge {
  // Calculate age in months for pediatric determination
  let ageInMonths = 0;
  switch (unit) {
    case 'years':
      ageInMonths = value * 12;
      break;
    case 'months':
      ageInMonths = value;
      break;
    case 'weeks':
      ageInMonths = value / 4.33;
      break;
    case 'days':
      ageInMonths = value / 30.44;
      break;
    case 'hours':
      ageInMonths = value / (30.44 * 24);
      break;
  }

  const isPediatric = ageInMonths < 216; // < 18 years
  const isNeonate = ageInMonths < 1; // < 1 month
  const isInfant = ageInMonths < 12; // < 1 year

  // Build display strings
  const unitSingular = unit.slice(0, -1); // Remove trailing 's'
  const displayString =
    value === 1 ? `${value}-${unitSingular}-old` : `${value}-${unitSingular}-old`;

  // Short display
  let shortDisplay = '';
  switch (unit) {
    case 'years':
      shortDisplay = `${value}yo`;
      break;
    case 'months':
      shortDisplay = `${value}mo`;
      break;
    case 'weeks':
      shortDisplay = `${value}wk`;
      break;
    case 'days':
      shortDisplay = `${value}d`;
      break;
    case 'hours':
      shortDisplay = `${value}h`;
      break;
  }

  return {
    value,
    unit,
    displayString,
    shortDisplay,
    isPediatric,
    isNeonate,
    isInfant,
  };
}

/**
 * Simple formatter for display in UI
 * @param age - Age value (number or string with unit)
 * @returns Formatted string like "45-year-old" or "3-month-old"
 */
export function formatPatientAge(age: number | string | null | undefined): string {
  return parsePatientAge(age).displayString;
}

/**
 * Short formatter for compact display
 * @param age - Age value (number or string with unit)
 * @returns Compact string like "45yo" or "3mo"
 */
export function formatPatientAgeShort(age: number | string | null | undefined): string {
  return parsePatientAge(age).shortDisplay;
}

/**
 * Get demographic string for patient
 * @param age - Age value
 * @param sex - Sex/gender of patient
 * @returns String like "45-year-old male" or "3-month-old female"
 */
export function formatPatientDemographics(
  age: number | string | null | undefined,
  sex: string | null | undefined
): string {
  const parsedAge = parsePatientAge(age);
  const normalizedSex = (sex || 'person').toLowerCase();
  return `${parsedAge.displayString} ${normalizedSex}`;
}
