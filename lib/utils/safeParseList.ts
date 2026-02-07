/**
 * safeParseList - Robust parser for "dirty data" from the database
 *
 * Handles the mix of:
 * - Raw strings: "chest pain, shortness of breath"
 * - JSON arrays: ["chest pain", "shortness of breath"]
 * - Stringified JSON: '["chest pain", "shortness of breath"]'
 * - Malformed JSON: '["chest pain", "shortness of breath'
 * - Empty values: null, undefined, "", []
 * - Single values: "chest pain"
 * - Numbered lists: "1. chest pain 2. shortness of breath"
 * - Bullet lists: "• chest pain • shortness of breath"
 *
 * This prevents SyntaxError crashes when parsing database content.
 */

/**
 * Check if a string looks like JSON
 */
function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('[') && trimmed.includes(']')) ||
    (trimmed.startsWith('{') && trimmed.includes('}'))
  );
}

/**
 * Try to parse JSON with fallback
 */
function tryParseJson(value: string): string[] | null {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item != null)
        .map((item) => String(item).trim())
        .filter(Boolean);
    }
    if (typeof parsed === 'string') {
      return [parsed.trim()].filter(Boolean);
    }
    return null;
  } catch {
    // Try to recover from malformed JSON
    return tryRecoverMalformedJson(value);
  }
}

/**
 * Attempt to recover array items from malformed JSON
 */
function tryRecoverMalformedJson(value: string): string[] | null {
  // Pattern: looks like ["item1", "item2"...] but may be truncated
  const match = value.match(/\[([^\]]*)/);
  if (match) {
    const inner = match[1];
    if (inner === undefined) return null;
    // Try to extract quoted strings
    const quotedItems = inner.match(/["']([^"']+)["']/g);
    if (quotedItems && quotedItems.length > 0) {
      return quotedItems.map((item) => item.replace(/["']/g, '').trim()).filter(Boolean);
    }
    // Try comma-separated without quotes
    const commaItems = inner
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (commaItems.length > 0) {
      return commaItems;
    }
  }
  return null;
}

/**
 * Split text by common list separators
 */
function splitByCommonSeparators(text: string): string[] {
  // Numbered list patterns: "1. item 2. item" or "1) item 2) item"
  const numberedMatch = text.match(/\d+[.)]\s+/g);
  if (numberedMatch && numberedMatch.length >= 2) {
    return text
      .split(/\d+[.)]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Bullet patterns: "• item • item" or "- item - item" or "* item * item"
  const bulletMatch = text.match(/[•\-*]\s+/g);
  if (bulletMatch && bulletMatch.length >= 2) {
    return text
      .split(/[•\-*]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Semicolon separated
  if (text.includes(';')) {
    const items = text
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length >= 2) return items;
  }

  // Comma separated (but be careful with commas in sentences)
  if (text.includes(',')) {
    const items = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Only treat as list if items are reasonably short (likely keywords)
    const avgLength = items.reduce((sum, item) => sum + item.length, 0) / items.length;
    if (items.length >= 2 && avgLength < 50) {
      return items;
    }
  }

  // Newline separated
  if (text.includes('\n')) {
    const items = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length >= 2) return items;
  }

  // Return as single-item array
  return [text.trim()].filter(Boolean);
}

/**
 * Clean up list items
 */
function cleanListItems(items: string[]): string[] {
  return items
    .map((item) => {
      // Remove leading numbers, bullets, dashes
      return item
        .replace(/^[\d]+[.)]\s*/, '')
        .replace(/^[•\-*]\s*/, '')
        .trim();
    })
    .filter((item) => item.length > 0 && item.length < 500); // Filter out empty or overly long items
}

/**
 * Safely parse a database field that might be a list
 *
 * @param value - Raw value from database (string, array, null, etc.)
 * @param options - Parsing options
 * @returns Array of strings (empty array if nothing to parse)
 */
export function safeParseList(
  value: unknown,
  options: {
    /** Maximum number of items to return */
    maxItems?: number;
    /** Remove duplicates */
    dedupe?: boolean;
    /** Lowercase all items */
    lowercase?: boolean;
    /** Filter out items shorter than this */
    minLength?: number;
    /** Filter out items longer than this */
    maxLength?: number;
  } = {}
): string[] {
  const {
    maxItems = 100,
    dedupe = true,
    lowercase = false,
    minLength = 1,
    maxLength = 500,
  } = options;

  // Handle null/undefined
  if (value == null) {
    return [];
  }

  // Handle array input
  if (Array.isArray(value)) {
    let items = value
      .filter((item) => item != null)
      .map((item) => String(item).trim())
      .filter(Boolean);

    items = cleanListItems(items);

    if (lowercase) items = items.map((s) => s.toLowerCase());
    if (dedupe) items = [...new Set(items)];

    return items
      .filter((item) => item.length >= minLength && item.length <= maxLength)
      .slice(0, maxItems);
  }

  // Handle string input
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    let items: string[] = [];

    // Try JSON parsing if it looks like JSON
    if (looksLikeJson(trimmed)) {
      const jsonItems = tryParseJson(trimmed);
      if (jsonItems) {
        items = jsonItems;
      } else {
        // Fall back to text splitting
        items = splitByCommonSeparators(trimmed);
      }
    } else {
      // Plain text - try to split
      items = splitByCommonSeparators(trimmed);
    }

    items = cleanListItems(items);

    if (lowercase) items = items.map((s) => s.toLowerCase());
    if (dedupe) items = [...new Set(items)];

    return items
      .filter((item) => item.length >= minLength && item.length <= maxLength)
      .slice(0, maxItems);
  }

  // Handle other types (numbers, objects, etc.)
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }

  if (typeof value === 'object') {
    // Try to stringify object
    try {
      const str = JSON.stringify(value);
      if (str !== '{}' && str !== 'null') {
        return [str];
      }
    } catch {
      // Ignore
    }
  }

  return [];
}

/**
 * Safely parse a single text field
 *
 * @param value - Raw value from database
 * @returns Cleaned string or empty string
 */
export function safeParseText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = safeParseList(value);
    return items.join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Extract first N items for preview (e.g., "top 3 buzzwords")
 */
export function safeParsePreview(value: unknown, count: number = 3): string[] {
  return safeParseList(value, { maxItems: count, dedupe: true });
}

export default safeParseList;
