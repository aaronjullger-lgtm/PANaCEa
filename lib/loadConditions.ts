import conditions from "../conditionContent.generated.json";

export interface ConditionSections {
  [sectionKey: string]: string;
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

export function isMeaningfulContent(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return normalized.toUpperCase() !== PLACEHOLDER_TEXT;
}

export function getConditionById(id: string): ConditionEntry | undefined {
  if (!id || typeof id !== "string") return undefined;
  return normalizeEntry((conditions as Record<string, unknown>)[id], id);
}
