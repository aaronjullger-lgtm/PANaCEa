// constants.ts

export const TOPIC_MAP: Record<string, string> = {
  "Cardiovascular System": "CV",
  "Dermatologic System": "DERM",
  "Endocrine System": "ENDO",
  "Eyes, Ears, Nose, and Throat": "HEENT",
  "Gastrointestinal System/Nutrition": "GI",
  "Genitourinary System": "GU",
  "Hematologic System": "HEME",
  "Infectious Diseases": "ID",
  "Musculoskeletal System": "MSK",
  "Neurologic System": "NEURO",
  "Psychiatry/Behavioral Science": "PSYCH",
  "Pulmonary System": "PULM",
  "Renal System": "RENAL",
  "Reproductive System": "REPRO",
  "Professional Practice": "PRO"
};

// PANCE_TOPICS is now derived from the map keys for consistency
export const PANCE_TOPICS = Object.keys(TOPIC_MAP);

// Create a reverse map for easy lookups (abbreviation -> full name)
export const ABBREVIATION_TO_TOPIC_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TOPIC_MAP).map(([key, value]) => [value, key])
);

// An ordered list of abbreviations for the Knowledge Map UI
export const PANCE_TOPIC_ABBREVIATIONS = [
  "CV", "DERM", "ENDO", "HEENT", "GI",
  "GU", "HEME", "ID", "MSK", "NEURO",
  "PSYCH", "PULM", "RENAL", "REPRO", "PRO"
];

// A 100-card "deck" of topics based on the PANCE content blueprint percentages.
export const PANCE_DECK: string[] = [
  // 11% Cardiovascular
  "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV",
  // 9% Pulmonary
  "PULM", "PULM", "PULM", "PULM", "PULM", "PULM", "PULM", "PULM", "PULM",
  // 8% GI/Nutrition
  "GI", "GI", "GI", "GI", "GI", "GI", "GI", "GI",
  // 8% MSK
  "MSK", "MSK", "MSK", "MSK", "MSK", "MSK", "MSK", "MSK",
  // 7% Infectious Disease
  "ID", "ID", "ID", "ID", "ID", "ID", "ID",
  // 7% Neuro
  "NEURO", "NEURO", "NEURO", "NEURO", "NEURO", "NEURO", "NEURO",
  // 7% Psych
  "PSYCH", "PSYCH", "PSYCH", "PSYCH", "PSYCH", "PSYCH", "PSYCH",
  // 7% Repro
  "REPRO", "REPRO", "REPRO", "REPRO", "REPRO", "REPRO", "REPRO",
  // 6% Endo
  "ENDO", "ENDO", "ENDO", "ENDO", "ENDO", "ENDO",
  // 6% HEENT
  "HEENT", "HEENT", "HEENT", "HEENT", "HEENT", "HEENT",
  // 6% Professional Practice
  "PRO", "PRO", "PRO", "PRO", "PRO", "PRO",
  // 5% Heme
  "HEME", "HEME", "HEME", "HEME", "HEME",
  // 5% Renal
  "RENAL", "RENAL", "RENAL", "RENAL", "RENAL",
  // 4% Derm
  "DERM", "DERM", "DERM", "DERM",
  // 4% GU
  "GU", "GU", "GU", "GU"
];

// A 94-card "deck" of tasks for the 94% of the exam that is medical content.
export const TASK_DECK: string[] = [
  // 18% Formulating Diagnosis
  "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis",
  "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis",
  "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis",
  "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis",
  "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis",
  "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis",

  // 16% History Taking/PE
  "History Taking/PE", "History Taking/PE", "History Taking/PE",
  "History Taking/PE", "History Taking/PE", "History Taking/PE",
  "History Taking/PE", "History Taking/PE", "History Taking/PE",
  "History Taking/PE", "History Taking/PE", "History Taking/PE",
  "History Taking/PE", "History Taking/PE", "History Taking/PE",
  "History Taking/PE",

  // 16% Clinical Intervention
  "Clinical Intervention", "Clinical Intervention", "Clinical Intervention",
  "Clinical Intervention", "Clinical Intervention", "Clinical Intervention",
  "Clinical Intervention", "Clinical Intervention", "Clinical Intervention",
  "Clinical Intervention", "Clinical Intervention", "Clinical Intervention",
  "Clinical Intervention", "Clinical Intervention", "Clinical Intervention",
  "Clinical Intervention",

  // 15% Pharmaceutical Therapeutics
  "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
  "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
  "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
  "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
  "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
  "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
  "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
  "Pharmaceutical Therapeutics",

  // 11% Health Maintenance
  "Health Maintenance", "Health Maintenance", "Health Maintenance",
  "Health Maintenance", "Health Maintenance", "Health Maintenance",
  "Health Maintenance", "Health Maintenance", "Health Maintenance",
  "Health Maintenance", "Health Maintenance",

  // 10% Using Diagnostic/Lab Studies
  "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies",
  "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies",
  "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies",
  "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies",
  "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies",

  // 8% Applying Foundational Scientific Concepts
  "Applying Foundational Scientific Concepts",
  "Applying Foundational Scientific Concepts",
  "Applying Foundational Scientific Concepts",
  "Applying Foundational Scientific Concepts",
  "Applying Foundational Scientific Concepts",
  "Applying Foundational Scientific Concepts",
  "Applying Foundational Scientific Concepts",
  "Applying Foundational Scientific Concepts"
];

// Gemini model constants (compatible with Cloudflare proxy URL construction)
// Prefer 2.5 family: flash for lightweight tasks, pro for heavy reasoning.
const GEMINI_FLASH_MODEL_ENV =
  (typeof process !== 'undefined' && process.env.GEMINI_FLASH_MODEL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_FLASH_MODEL);

const GEMINI_PRO_MODEL_ENV =
  (typeof process !== 'undefined' && process.env.GEMINI_PRO_MODEL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_PRO_MODEL);

export const GEMINI_FLASH_MODEL = GEMINI_FLASH_MODEL_ENV || "gemini-2.5-flash";
export const GEMINI_PRO_MODEL   = GEMINI_PRO_MODEL_ENV   || "gemini-2.5-pro";
