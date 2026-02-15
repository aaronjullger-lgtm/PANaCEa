// Lazy load conditions to improve initial bundle size
let conditionsCache: Record<string, unknown> | null = null;
const CONTENT_API_PATH = '/api/content/all';

async function getConditions(): Promise<Record<string, unknown>> {
  if (conditionsCache) {
    return conditionsCache;
  }

  // Import shared API config utility
  const { getApiEndpoint, API_ENDPOINTS } = await import('./utils/apiConfig');
  const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_ALL);

  try {
    const response = await fetch(apiUrl);

    // Check if response is OK and is JSON before parsing
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const json = await response.json();
      const cache =
        json && typeof json === 'object' && !Array.isArray(json)
          ? (json as Record<string, unknown>)
          : {};
      // Index by condition name so getConditionByIdSync(condition.condition) finds entries when UI only has display name
      conditionsCache = { ...cache };
      for (const [id, entry] of Object.entries(cache)) {
        const name = (entry as Record<string, unknown>)?.condition;
        if (typeof name === 'string' && name.trim() && name !== id) {
          (conditionsCache as Record<string, unknown>)[name] = entry;
        }
      }
      console.log(`✓ Loaded ${Object.keys(cache).length} conditions from database`);
      return conditionsCache;
    }

    // Database API returned non-OK response
    console.warn(`Database API returned status ${response.status} for ${apiUrl}`);

    // Try to get error details from response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const errorData = (await response.json()) as { message?: string };
      console.error('API Error:', errorData);

      if (response.status === 503) {
        console.error(`⚠ DATABASE UNAVAILABLE: ${errorData.message || 'Backend cannot connect to database'}
  This is expected if:
  - DATABASE_URL is not configured in .env
  - Database is not running or accessible
  - Running in development without database`);
      }
    } else {
      console.error(`⚠ API returned non-JSON response (likely HTML 404 page)
  Backend server is not running or endpoint does not exist`);
    }

    console.error(`
REQUIRED ACTIONS:
  1. Start backend: npm run dev:server or npm run dev:all
  2. Configure DATABASE_URL in .env
  3. Populate database with content`);
  } catch (error) {
    console.error(`✗ Failed to load conditions from database API (${apiUrl}):`, error);
    console.error('REQUIRED: Ensure backend server is running and DATABASE_URL is configured');
  }

  // Return empty object - application requires database to be properly configured
  // No static fallback to enforce database-first architecture
  console.warn('⚠ Returning empty dataset - application will have limited functionality');
  return {};
}

export type SectionData =
  | string[]
  | { type: 'steps'; items: { title: string; content: string }[] }
  | { type: 'grid'; items: Record<string, string> }
  | null;

export type ConditionContent = string | string[] | Record<string, unknown> | SectionData | null;

export interface ConditionSections {
  [sectionKey: string]: ConditionContent;
}

export interface ConditionEntry {
  condition: string;
  sections: ConditionSections;
}

const PLACEHOLDER_TEXT = '[NO CONTENT PROVIDED]';

export function normalizeConditionContent(value?: ConditionContent): ConditionContent {
  if (value == null) return null;

  // Pass through structured data (Steps/Grid)
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'type' in value &&
    (value.type === 'steps' || value.type === 'grid')
  ) {
    return value as SectionData;
  }

  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : ''))
      .filter(Boolean);

    // Preserve arrays so the renderer can display true bullet lists.
    return parts.length ? parts : null;
  }

  if (typeof value === 'object') {
    // Handle objects with notes, imaging, labs, or other keys
    const entries = Object.entries(value);
    const allParts: string[] = [];

    for (const [, val] of entries) {
      if (typeof val === 'string') {
        allParts.push(val);
      } else if (Array.isArray(val)) {
        const arrayParts = val
          .map((item) => (typeof item === 'string' ? item : item != null ? String(item) : ''))
          .filter(Boolean);
        allParts.push(...arrayParts);
      }
    }

    return allParts.length ? allParts.join('\n') : null;
  }

  return null;
}

function normalizeEntry(raw: unknown, id: string): ConditionEntry | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const entry = raw as Record<string, unknown>;

  // Check if this is the new format (sections directly) or old format (with condition/sections wrapper)
  const hasConditionKey = 'condition' in entry && typeof entry.condition === 'string';
  const hasSectionsKey =
    'sections' in entry && entry.sections !== null && typeof entry.sections === 'object';

  let conditionId: string;
  let rawSections: Record<string, unknown>;

  if (hasSectionsKey) {
    // Old format: { condition: "...", sections: { ... } }
    conditionId =
      hasConditionKey && (entry.condition as string).trim().length > 0
        ? (entry.condition as string)
        : id;
    rawSections = entry.sections as Record<string, unknown>;
  } else {
    // New format: sections are directly on the object
    conditionId =
      hasConditionKey && (entry.condition as string).trim().length > 0
        ? (entry.condition as string)
        : id;
    rawSections = entry;
  }

  const sections: ConditionSections = {};

  const METADATA_KEYS = new Set([
    'condition',
    'conditionId',
    'system',
    'subcategory',
    'relatedSystems',
    'status',
    'createdAt',
    'updatedAt',
  ]);

  if (rawSections && typeof rawSections === 'object') {
    for (const [key, val] of Object.entries(rawSections)) {
      // Skip metadata keys present in DB/API payloads
      if (METADATA_KEYS.has(key)) continue;

      // Normalize all value types (strings, arrays, objects with notes/imaging/labs)
      const normalized = normalizeConditionContent(val as ConditionContent);
      if (normalized !== null) {
        sections[key] = normalized;
      }
    }
  }

  return { condition: conditionId, sections };
}

// ===== Lazy-loaded conditions =====
let CONDITIONS_CACHE: Record<string, ConditionEntry | undefined> | null = null;

export async function loadConditions(): Promise<Record<string, ConditionEntry | undefined>> {
  if (CONDITIONS_CACHE) {
    return CONDITIONS_CACHE;
  }

  const conditions = await getConditions();
  CONDITIONS_CACHE = Object.fromEntries(
    Object.entries(conditions).map(([id, raw]) => [id, normalizeEntry(raw, id)])
  ) as Record<string, ConditionEntry | undefined>;

  return CONDITIONS_CACHE;
}

/**
 * @deprecated Legacy synchronous export for backward compatibility.
 * WARNING: This object is empty until loadConditions() is called.
 *
 * Migration path:
 * - Replace: const data = CONDITIONS;
 * - With: const data = await loadConditions();
 *
 * This synchronous export will be removed in a future version.
 */
export const CONDITIONS: Record<string, ConditionEntry | undefined> = {};

/**
 * Merge multiple ConditionContent values into one (e.g. for consolidated sections).
 * Strings and array items are combined into a single string with paragraph/list separation.
 */
export function mergeConditionContent(
  contents: (ConditionContent | undefined)[]
): ConditionContent {
  const parts: string[] = [];

  for (const content of contents) {
    if (content == null) continue;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (trimmed && trimmed.toUpperCase() !== PLACEHOLDER_TEXT) parts.push(trimmed);
    } else if (Array.isArray(content)) {
      const items = content
        .filter((item): item is string => typeof item === 'string')
        .map((s) => s.trim())
        .filter((s) => s && s.toUpperCase() !== PLACEHOLDER_TEXT);
      if (items.length > 0) parts.push(items.map((s) => `- ${s}`).join('\n'));
    } else if (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      (content as { type: string }).type === 'steps'
    ) {
      const steps = (content as { items: { title: string; content: string }[] }).items;
      if (steps?.length) parts.push(steps.map((s) => `**${s.title}**\n${s.content}`).join('\n\n'));
    } else if (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      (content as { type: string }).type === 'grid'
    ) {
      const grid = (content as { items: Record<string, string> }).items;
      if (grid && typeof grid === 'object')
        parts.push(
          Object.entries(grid)
            .map(([k, v]) => `**${k}:** ${v}`)
            .join('\n')
        );
    }
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n');
}

export function isMeaningfulContent(value?: unknown): boolean {
  if (value == null) return false;

  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return false;
    return normalized.toUpperCase() !== PLACEHOLDER_TEXT;
  }

  if (Array.isArray(value)) {
    return value.some((item) => {
      if (typeof item !== 'string') return item != null;
      const normalized = item.replace(/\s+/g, ' ').trim();
      return normalized.length > 0 && normalized.toUpperCase() !== PLACEHOLDER_TEXT;
    });
  }

  // Structured sections (steps/grid)
  if (typeof value === 'object' && value !== null && 'type' in value) {
    const typed = value as any;
    if (typed.type === 'steps') return Array.isArray(typed.items) && typed.items.length > 0;
    if (typed.type === 'grid')
      return typed.items && typeof typed.items === 'object' && Object.keys(typed.items).length > 0;
  }

  // Any other object: treat as meaningful if it has keys.
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return false;
}

export async function getConditionById(id: string): Promise<ConditionEntry | undefined> {
  if (!id || typeof id !== 'string') return undefined;

  // Fast path: if we've already loaded the full cache (or a prior single fetch), use it.
  if (conditionsCache && conditionsCache[id]) {
    return normalizeEntry(conditionsCache[id], id);
  }

  // Fast path: fetch only this condition so the UI can render without waiting for /api/content/all.
  try {
    const { getApiEndpoint, API_ENDPOINTS } = await import('./utils/apiConfig');
    const apiUrl = getApiEndpoint(API_ENDPOINTS.CONTENT_BY_ID(encodeURIComponent(id)));
    const response = await fetch(apiUrl);

    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const raw = await response.json();
      conditionsCache = conditionsCache ?? {};
      conditionsCache[id] = raw;
      return normalizeEntry(raw, id);
    }

    if (response.status === 404) {
      return undefined;
    }
  } catch {
    // Ignore and fall back to full fetch.
  }

  // Fallback: load everything (legacy behavior)
  const conditions = await getConditions();
  return normalizeEntry(conditions[id], id);
}

// Synchronous version for backward compatibility (may return undefined if not loaded)
export function getConditionByIdSync(id: string): ConditionEntry | undefined {
  if (!id || typeof id !== 'string' || !conditionsCache) return undefined;
  return normalizeEntry(conditionsCache[id], id);
}
