// src/conditionContent.generated.ts
// This file MUST NOT import @google/genai or any server SDK.
// It only loads the pre-generated JSON created by the generator script.

export interface ConditionContent {
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
  mediaIds?: string[];
  diagnostics?: { notes?: string };
  etiologyPathophysiology?: string;
  epidemiology?: string;
  riskFactors?: string[];
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis?: string;
  aliases?: string[];
}

// Lazy-load condition content to improve initial bundle size
let conditionContentCache: Record<string, ConditionContent> | null = null;

type ConditionContentPatch =
  | ConditionContent
  | string
  | undefined
  | null;

function mergeConditionContent(
  base: Record<string, ConditionContent>,
  patch: Record<string, ConditionContentPatch>
): Record<string, ConditionContent> {
  const merged: Record<string, ConditionContent> = { ...base };

  for (const [id, override] of Object.entries(patch)) {
    if (!override) continue;

    const baseEntry = merged[id] ?? {};

    if (typeof override === "string") {
      merged[id] = { ...baseEntry, overview: override };
    } else {
      merged[id] = { ...baseEntry, ...override };
    }
  }

  return merged;
}

/**
 * Lazily load and merge condition content
 */
export async function loadConditionContent(): Promise<Record<string, ConditionContent>> {
  if (conditionContentCache) {
    return conditionContentCache;
  }

  try {
    const [baseModule, updatedModule] = await Promise.all([
      import("./conditionContent.generated.json"),
      import("../conditionContent.generated.json")
    ]);

    conditionContentCache = mergeConditionContent(
      baseModule.default as Record<string, ConditionContent>,
      updatedModule.default as Record<string, ConditionContentPatch>
    );

    return conditionContentCache;
  } catch (error) {
    console.error('Failed to load condition content:', error);
    return {};
  }
}

// Legacy export for backward compatibility - will be empty until loaded
export const CONDITION_CONTENT: Record<string, ConditionContent> = {};
