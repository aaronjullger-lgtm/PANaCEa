// Lazy load conditions to improve initial bundle size
let conditionsCache: Record<string, unknown> | null = null;

async function getConditions(): Promise<Record<string, unknown>> {
  if (conditionsCache) {
    return conditionsCache;
  }
  
  const apiUrl =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
    process.env.VITE_API_URL ||
    "http://localhost:3001";

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/content/all`);
    if (response.ok) {
      conditionsCache = await response.json();
      return conditionsCache;
    }
  } catch (error) {
    console.warn(
      `Failed to load conditions from database API at ${apiUrl.replace(/\/$/, "")}/api/content/all, falling back to static file:`,
      error
    );
  }

  try {
    const module = await import("../conditionContent.final.json");
    conditionsCache = module.default;
    return conditionsCache;
  } catch (error) {
    console.error('Failed to load condition content fallback file:', error);
  }

  return {};
}

export type ConditionContent = string | string[] | Record<string, unknown> | null;

export interface ConditionSections {
  [sectionKey: string]: ConditionContent;
}

export interface ConditionEntry {
  condition: string;
  sections: ConditionSections;
}

const PLACEHOLDER_TEXT = "[NO CONTENT PROVIDED]";

export function normalizeConditionContent(
  value?: ConditionContent
): string | null {
  if (value == null) return null;

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) =>
        typeof item === "string"
          ? item
          : item != null
            ? String(item)
            : ""
      )
      .filter(Boolean);

    return parts.length ? parts.join("\n") : null;
  }

  if (typeof value === "object") {
    // Handle objects with notes, imaging, labs, or other keys
    const entries = Object.entries(value);
    const allParts: string[] = [];
    
    for (const [, val] of entries) {
      if (typeof val === "string") {
        allParts.push(val);
      } else if (Array.isArray(val)) {
        const arrayParts = val
          .map((item) =>
            typeof item === "string"
              ? item
              : item != null
                ? String(item)
                : ""
          )
          .filter(Boolean);
        allParts.push(...arrayParts);
      }
    }
    
    return allParts.length ? allParts.join("\n") : null;
  }

  return null;
}

function normalizeEntry(raw: unknown, id: string): ConditionEntry | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const entry = raw as Record<string, unknown>;

  // Check if this is the new format (sections directly) or old format (with condition/sections wrapper)
  const hasConditionKey = "condition" in entry && typeof entry.condition === "string";
  const hasSectionsKey = "sections" in entry && entry.sections !== null && typeof entry.sections === "object";
  
  let conditionId: string;
  let rawSections: Record<string, unknown>;
  
  if (hasSectionsKey) {
    // Old format: { condition: "...", sections: { ... } }
    conditionId = hasConditionKey && (entry.condition as string).trim().length > 0
      ? (entry.condition as string)
      : id;
    rawSections = entry.sections as Record<string, unknown>;
  } else {
    // New format: sections are directly on the object
    conditionId = id;
    rawSections = entry;
  }

  const sections: ConditionSections = {};

  if (rawSections && typeof rawSections === "object") {
    for (const [key, val] of Object.entries(rawSections)) {
      // Skip the "condition" key if it exists in the new format
      if (key === "condition") continue;
      
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
    Object.entries(conditions).map(([id, raw]) => [
      id,
      normalizeEntry(raw, id),
    ])
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

export function isMeaningfulContent(value?: unknown): boolean {
  if (typeof value !== "string") return false;

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  return normalized.toUpperCase() !== PLACEHOLDER_TEXT;
}

export async function getConditionById(id: string): Promise<ConditionEntry | undefined> {
  if (!id || typeof id !== "string") return undefined;
  const conditions = await getConditions();
  return normalizeEntry(conditions[id], id);
}

// Synchronous version for backward compatibility (may return undefined if not loaded)
export function getConditionByIdSync(id: string): ConditionEntry | undefined {
  if (!id || typeof id !== "string" || !conditionsCache) return undefined;
  return normalizeEntry(conditionsCache[id], id);
}
