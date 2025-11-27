import conditions from "../conditionContent.generated.json";

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

// ===== Top-level export (must be outside of the function) =====
export const CONDITIONS = Object.fromEntries(
  Object.entries(conditions as Record<string, unknown>).map(([id, raw]) => [
    id,
    normalizeEntry(raw, id),
  ])
) as Record<string, ConditionEntry | undefined>;

export function isMeaningfulContent(value?: unknown): boolean {
  if (typeof value !== "string") return false;

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  return normalized.toUpperCase() !== PLACEHOLDER_TEXT;
}

export function getConditionById(id: string): ConditionEntry | undefined {
  if (!id || typeof id !== "string") return undefined;
  return normalizeEntry((conditions as Record<string, unknown>)[id], id);
}
