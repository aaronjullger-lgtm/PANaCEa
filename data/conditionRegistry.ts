// ---- System codes (PANCE-style) ----
export type SystemCode =
  | "CV"
  | "DERM"
  | "ENDO"
  | "HEENT"
  | "GI"
  | "GU"
  | "HEME"
  | "ID"
  | "MSK"
  | "NEURO"
  | "PSYCH"
  | "PULM"
  | "RENAL"
  | "REPRO"
  | "PRO"
  | "OTHER"; // for edge/uncategorized things, not shown on heatmap

export interface ConditionDefinition {
  system: SystemCode;     // e.g. "PULM"
  subcategory: string;    // e.g. "Obstructive"
  condition: string;      // e.g. "Asthma"
}

// Optional: if you still have old unit names like "Pulmonary", "Cardiovascular", etc.
export const UNIT_TO_SYSTEM: Record<string, SystemCode> = {
  Pulmonary: "PULM",
  Cardiovascular: "CV",
  Gastrointestinal: "GI",
  "GU/Renal": "RENAL", // we’ll split GU vs RENAL later based on condition
  "Female Reproductive": "REPRO",
  HEENT: "HEENT",
  Hematology: "HEME",
  Oncology: "HEME", // solid tumors will be reassigned per condition
  "Infectious Disease": "ID",
  Dermatology: "DERM",
  Psychiatric: "PSYCH",
  Endocrine: "ENDO",
  Neurologic: "NEURO",
  Musculoskeletal: "MSK",
};
