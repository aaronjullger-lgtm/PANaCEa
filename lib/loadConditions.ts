import conditions from "../conditionContent.generated.json";

export type ConditionContent = string | string[] | { notes?: string } | null;

export interface ConditionSections {
  [sectionKey: string]: ConditionContent;
}

export interface ConditionEntry {
  condition: string;
  sections: ConditionSections;
}

const PLACEHOLDER_TEXT = "[NO CONTENT PROVIDED]";

function normalizeEntry(raw: unknown, id: string): ConditionEntry | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const entry = raw as { condition?: unknown; sections?: unknown };

  const conditionId =
    typeof entry.condition === "string" && entry.condition.trim().length > 0
      ? entry.condition
      : id;

  const rawSections = entry.sections;
  const sections: ConditionSections =
    rawSections && typeof rawSections === "object"
      ? (rawSections as ConditionSections)
      : {};

  return { condition: conditionId, sections };
}

export const CONDITIONS = Object.fromEntries(
  Object.entries(conditions as Record<string, unknown>).map(([id, raw]) => [
    id,
    normalizeEntry(raw, id),
  ])
) as Record<string, ConditionEntry | undefined>;

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

  if (typeof value === "object" && "notes" in value) {
    const notes = (value as { notes?: unknown }).notes;
    return typeof notes === "string" ? notes : null;
  }

  return null;
}

export function isMeaningfulContent(value?: ConditionContent): boolean {
  const normalizedValue = normalizeConditionContent(value);
  if (!normalizedValue) return false;

  const normalized = normalizedValue.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return normalized.toUpperCase() !== PLACEHOLDER_TEXT;
}

export function getConditionById(id: string): ConditionEntry | undefined {
  if (!id || typeof id !== "string") return undefined;
  return normalizeEntry((conditions as Record<string, unknown>)[id], id);
}
