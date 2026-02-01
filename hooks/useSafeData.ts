/**
 * useSafeData - Defensive Data Hook
 *
 * Purpose: Provide safe access to potentially undefined/null data with
 * configurable fallbacks to prevent runtime errors in React components.
 *
 * Use cases:
 * - API responses that may be incomplete
 * - User data that may not be loaded yet
 * - Chart data that may contain NaN/undefined values
 * - Form data with optional fields
 *
 * @example
 * const { safeValue, isLoading, hasValue } = useSafeData(apiResponse?.user, defaultUser);
 * const { safeArray, isEmpty } = useSafeArray(chartData, []);
 * const { safeNumber, isValid } = useSafeNumber(rawValue, 0);
 */

import { useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface SafeDataResult<T> {
  /** The safe value (either the actual value or the fallback) */
  safeValue: T;
  /** Whether the original value was null or undefined */
  isNullish: boolean;
  /** Whether we have a valid (non-nullish) value */
  hasValue: boolean;
  /** The original value (may be null/undefined) */
  originalValue: T | null | undefined;
}

export interface SafeArrayResult<T> {
  /** The safe array (never null/undefined) */
  safeArray: T[];
  /** Whether the array is empty */
  isEmpty: boolean;
  /** The length of the array */
  length: number;
  /** Whether the original value was null/undefined/not-array */
  wasInvalid: boolean;
}

export interface SafeNumberResult {
  /** The safe number (never NaN/Infinity) */
  safeNumber: number;
  /** Whether the original value was a valid finite number */
  isValid: boolean;
  /** The original value before sanitization */
  originalValue: unknown;
}

export interface SafeStringResult {
  /** The safe string (never null/undefined) */
  safeString: string;
  /** Whether the string is empty after trimming */
  isEmpty: boolean;
  /** The trimmed string */
  trimmed: string;
  /** Whether the original value was null/undefined */
  wasNullish: boolean;
}

// ============================================================================
// MAIN HOOKS
// ============================================================================

/**
 * Safe access to any value with a fallback
 */
export function useSafeData<T>(value: T | null | undefined, fallback: T): SafeDataResult<T> {
  return useMemo(() => {
    const isNullish = value === null || value === undefined;
    return {
      safeValue: isNullish ? fallback : value,
      isNullish,
      hasValue: !isNullish,
      originalValue: value,
    };
  }, [value, fallback]);
}

/**
 * Safe access to arrays - ensures always an array, filters invalid items
 */
export function useSafeArray<T>(
  value: T[] | null | undefined,
  fallback: T[] = [],
  options: {
    filterNullish?: boolean;
    filterFalsy?: boolean;
  } = {}
): SafeArrayResult<T> {
  return useMemo(() => {
    const wasInvalid = !Array.isArray(value);
    let safeArray = wasInvalid ? fallback : value;

    // Apply filters if requested
    if (options.filterNullish) {
      safeArray = safeArray.filter((item) => item !== null && item !== undefined);
    }
    if (options.filterFalsy) {
      safeArray = safeArray.filter(Boolean);
    }

    return {
      safeArray,
      isEmpty: safeArray.length === 0,
      length: safeArray.length,
      wasInvalid,
    };
  }, [value, fallback, options.filterNullish, options.filterFalsy]);
}

/**
 * Safe access to numbers - handles NaN, Infinity, type coercion
 */
export function useSafeNumber(
  value: unknown,
  fallback: number = 0,
  options: {
    min?: number;
    max?: number;
    round?: boolean;
    decimals?: number;
  } = {}
): SafeNumberResult {
  return useMemo(() => {
    const parsed = typeof value === 'number' ? value : Number(value);
    const isValid = Number.isFinite(parsed);

    let safeNumber = isValid ? parsed : fallback;

    // Apply constraints
    if (options.min !== undefined && safeNumber < options.min) {
      safeNumber = options.min;
    }
    if (options.max !== undefined && safeNumber > options.max) {
      safeNumber = options.max;
    }
    if (options.round) {
      safeNumber = Math.round(safeNumber);
    }
    if (options.decimals !== undefined) {
      safeNumber = Number(safeNumber.toFixed(options.decimals));
    }

    return {
      safeNumber,
      isValid,
      originalValue: value,
    };
  }, [value, fallback, options.min, options.max, options.round, options.decimals]);
}

/**
 * Safe access to strings - handles null, undefined, non-strings
 */
export function useSafeString(value: unknown, fallback: string = ''): SafeStringResult {
  return useMemo(() => {
    const wasNullish = value === null || value === undefined;
    const safeString = wasNullish ? fallback : String(value);
    const trimmed = safeString.trim();

    return {
      safeString,
      isEmpty: trimmed.length === 0,
      trimmed,
      wasNullish,
    };
  }, [value, fallback]);
}

// ============================================================================
// UTILITY FUNCTIONS (non-hook versions for use outside components)
// ============================================================================

/**
 * Non-hook version: safe value with fallback
 */
export function safeValue<T>(value: T | null | undefined, fallback: T): T {
  return value === null || value === undefined ? fallback : value;
}

/**
 * Non-hook version: safe array
 */
export function safeArray<T>(value: T[] | null | undefined, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

/**
 * Non-hook version: safe number (finite, not NaN)
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Non-hook version: safe string
 */
export function safeString(value: unknown, fallback: string = ''): string {
  return value === null || value === undefined ? fallback : String(value);
}

/**
 * Non-hook version: safely parse JSON with fallback
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Non-hook version: safe object property access
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  fallback: T[K]
): T[K] {
  if (obj === null || obj === undefined) return fallback;
  const value = obj[key];
  return value === undefined ? fallback : value;
}

/**
 * Non-hook version: safe deep property access
 */
export function safeDeepGet<T>(obj: unknown, path: string, fallback: T): T {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return fallback;
    }
    if (typeof current !== 'object') {
      return fallback;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current === undefined || current === null ? fallback : (current as T);
}

// ============================================================================
// SPECIALIZED HELPERS
// ============================================================================

/**
 * Safe percentage calculation (prevents NaN from division by zero)
 */
export function safePercentage(value: number, total: number, decimals: number = 1): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) {
    return 0;
  }
  const percentage = (value / total) * 100;
  return Number(percentage.toFixed(decimals));
}

/**
 * Safe array of numbers for charts (filters out invalid values)
 */
export function safeChartData(
  data: unknown[] | null | undefined,
  defaultValue: number = 0
): number[] {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item;
    }
    const parsed = Number(item);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  });
}

/**
 * Safe date parsing (returns null for invalid dates)
 */
export function safeDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Safe date with fallback
 */
export function safeDateWithFallback(value: unknown, fallback: Date = new Date()): Date {
  return safeDate(value) ?? fallback;
}
