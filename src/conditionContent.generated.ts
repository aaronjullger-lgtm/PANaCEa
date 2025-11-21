// src/conditionContent.generated.ts
// This file MUST NOT import @google/genai or any server SDK.
// It only loads the pre-generated JSON created by the generator script.

export interface ConditionContent {
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
}

import data from "./conditionContent.generated.json";

export const CONDITION_CONTENT = data as Record<string, ConditionContent>;
