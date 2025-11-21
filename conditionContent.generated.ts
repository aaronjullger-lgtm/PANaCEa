// src/conditionContent.generated.ts
// AUTO-GENERATED CONTENT WRAPPER
// The actual data lives in conditionContent.generated.json,
// which is created/updated by scripts/generateConditionContent.ts.

export interface ConditionContent {
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
}

// If your tsconfig doesn't support JSON imports, enable `resolveJsonModule`
// OR change this to a manual require(...) in JS-land.
import raw from "./conditionContent.generated.json";

export const CONDITION_CONTENT = raw as Record<string, ConditionContent>;
