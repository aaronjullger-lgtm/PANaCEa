
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

// An array of abbreviations in the specific order for the Knowledge Map
export const PANCE_TOPIC_ABBREVIATIONS = [
    'CV', 'DERM', 'ENDO', 'HEENT', 'GI',
    'GU', 'HEME', 'ID', 'MSK', 'NEURO',
    'PSYCH', 'PULM', 'RENAL', 'REPRO', 'PRO'
];

// A 100-card "deck" of topics based on the PANCE Content blueprint percentages.
export const PANCE_DECK: string[] = [
    "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV", "CV", // 11%
    "PULM", "PULM", "PULM", "PULM", "PULM", "PULM", "PULM", "PULM", "PULM", // 9%
    "GI", "GI", "GI", "GI", "GI", "GI", "GI", "GI", // 8%
    "MSK", "MSK", "MSK", "MSK", "MSK", "MSK", "MSK", "MSK", // 8%
    "ID", "ID", "ID", "ID", "ID", "ID", "ID", // 7%
    "NEURO", "NEURO", "NEURO", "NEURO", "NEURO", "NEURO", "NEURO", // 7%
    "PSYCH", "PSYCH", "PSYCH", "PSYCH", "PSYCH", "PSYCH", "PSYCH", // 7%
    "REPRO", "REPRO", "REPRO", "REPRO", "REPRO", "REPRO", "REPRO", // 7%
    "ENDO", "ENDO", "ENDO", "ENDO", "ENDO", "ENDO", // 6%
    "HEENT", "HEENT", "HEENT", "HEENT", "HEENT", "HEENT", // 6%
    "PRO", "PRO", "PRO", "PRO", "PRO", "PRO", // 6%
    "HEME", "HEME", "HEME", "HEME", "HEME", // 5%
    "RENAL", "RENAL", "RENAL", "RENAL", "RENAL", // 5%
    "DERM", "DERM", "DERM", "DERM", // 4%
    "GU", "GU", "GU", "GU" // 4%
];

// A 94-card "deck" of tasks for the 94% of the exam that is medical content.
export const TASK_DECK: string[] = [
    // 18% Formulating Diagnosis
    "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis", "Formulating Diagnosis",
    // 16% History Taking/PE
    "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE", "History Taking/PE",
    // 16% Clinical Intervention
    "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention", "Clinical Intervention",
    // 15% Pharmaceutical Therapeutics
    "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics", "Pharmaceutical Therapeutics",
    // 11% Health Maintenance
    "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance", "Health Maintenance",
    // 10% Using Diagnostic/Lab Studies
    "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies", "Using Diagnostic/Lab Studies",
    // 8% Applying Foundational Scientific Concepts
    "Applying Foundational Scientific Concepts", "Applying Foundational Scientific Concepts", "Applying Foundational Scientific Concepts", "Applying Foundational Scientific Concepts", "Applying Foundational Scientific Concepts", "Applying Foundational Scientific Concepts", "Applying Foundational Scientific Concepts", "Applying Foundational Scientific Concepts"
];
