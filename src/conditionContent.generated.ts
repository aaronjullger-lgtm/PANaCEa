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

import baseContent from "./conditionContent.generated.json";
import updatedContent from "../conditionContent.generated.json";

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

export const CONDITION_CONTENT = mergeConditionContent(
  baseContent as Record<string, ConditionContent>,
  updatedContent as Record<string, ConditionContentPatch>
);
