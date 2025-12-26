// labTestRegistry.ts
/**
 * Lab Test Registry - Source of Truth for Laboratory Tests
 * 
 * This registry defines all lab tests with BARE MINIMUM metadata.
 * All detailed content (normal ranges, interpretation, clinical significance)
 * is AI-generated during sync using Gemini API.
 * 
 * Add tests here, then run `npm run sync:lab-tests` to populate the database.
 */

export interface LabTestMeta {
  name: string;
  category: string; // CBC, CMP, LFT, Cardiac, Thyroid, Coagulation, etc.
  
  // Optional: Very basic info (AI will expand)
  commonlyOrderedWith?: string[]; // Other test names
}

// =============================================================================
// COMPLETE BLOOD COUNT (CBC)
// =============================================================================

export const LAB_TEST_REGISTRY_CBC: LabTestMeta[] = [
  { name: "White Blood Cell Count (WBC)", category: "CBC" },
  { name: "Red Blood Cell Count (RBC)", category: "CBC" },
  { name: "Hemoglobin", category: "CBC" },
  { name: "Hematocrit", category: "CBC" },
  { name: "Mean Corpuscular Volume (MCV)", category: "CBC" },
  { name: "Mean Corpuscular Hemoglobin (MCH)", category: "CBC" },
  { name: "Mean Corpuscular Hemoglobin Concentration (MCHC)", category: "CBC" },
  { name: "Red Cell Distribution Width (RDW)", category: "CBC" },
  { name: "Platelet Count", category: "CBC" },
  { name: "Mean Platelet Volume (MPV)", category: "CBC" },
  { name: "Neutrophils (Absolute)", category: "CBC with Differential" },
  { name: "Lymphocytes (Absolute)", category: "CBC with Differential" },
  { name: "Monocytes (Absolute)", category: "CBC with Differential" },
  { name: "Eosinophils (Absolute)", category: "CBC with Differential" },
  { name: "Basophils (Absolute)", category: "CBC with Differential" },
];

// =============================================================================
// COMPREHENSIVE METABOLIC PANEL (CMP)
// =============================================================================

export const LAB_TEST_REGISTRY_CMP: LabTestMeta[] = [
  { name: "Sodium (Na+)", category: "CMP" },
  { name: "Potassium (K+)", category: "CMP" },
  { name: "Chloride (Cl-)", category: "CMP" },
  { name: "Bicarbonate (HCO3-)", category: "CMP" },
  { name: "Blood Urea Nitrogen (BUN)", category: "CMP" },
  { name: "Creatinine", category: "CMP" },
  { name: "Glucose", category: "CMP" },
  { name: "Calcium", category: "CMP" },
  { name: "Total Protein", category: "CMP" },
  { name: "Albumin", category: "CMP" },
  { name: "Total Bilirubin", category: "CMP" },
  { name: "Alkaline Phosphatase (ALP)", category: "CMP" },
  { name: "Aspartate Aminotransferase (AST)", category: "CMP" },
  { name: "Alanine Aminotransferase (ALT)", category: "CMP" },
];

// =============================================================================
// CARDIAC MARKERS
// =============================================================================

export const LAB_TEST_REGISTRY_CARDIAC: LabTestMeta[] = [
  { name: "Troponin I", category: "Cardiac Markers" },
  { name: "Troponin T", category: "Cardiac Markers" },
  { name: "High-Sensitivity Troponin", category: "Cardiac Markers" },
  { name: "Creatine Kinase-MB (CK-MB)", category: "Cardiac Markers" },
  { name: "B-Type Natriuretic Peptide (BNP)", category: "Cardiac Markers" },
  { name: "N-Terminal Pro-BNP (NT-proBNP)", category: "Cardiac Markers" },
  { name: "D-Dimer", category: "Cardiac Markers", commonlyOrderedWith: ["PT/INR", "aPTT"] },
];

// =============================================================================
// LIPID PANEL
// =============================================================================

export const LAB_TEST_REGISTRY_LIPIDS: LabTestMeta[] = [
  { name: "Total Cholesterol", category: "Lipid Panel" },
  { name: "LDL Cholesterol", category: "Lipid Panel" },
  { name: "HDL Cholesterol", category: "Lipid Panel" },
  { name: "Triglycerides", category: "Lipid Panel" },
  { name: "VLDL Cholesterol", category: "Lipid Panel" },
  { name: "Non-HDL Cholesterol", category: "Lipid Panel" },
];

// =============================================================================
// THYROID FUNCTION TESTS
// =============================================================================

export const LAB_TEST_REGISTRY_THYROID: LabTestMeta[] = [
  { name: "Thyroid Stimulating Hormone (TSH)", category: "Thyroid Function" },
  { name: "Free T4 (Thyroxine)", category: "Thyroid Function" },
  { name: "Free T3 (Triiodothyronine)", category: "Thyroid Function" },
  { name: "Total T4", category: "Thyroid Function" },
  { name: "Total T3", category: "Thyroid Function" },
  { name: "Thyroid Peroxidase Antibody (TPO Ab)", category: "Thyroid Function" },
  { name: "Thyroglobulin Antibody", category: "Thyroid Function" },
];

// =============================================================================
// COAGULATION STUDIES
// =============================================================================

export const LAB_TEST_REGISTRY_COAG: LabTestMeta[] = [
  { name: "Prothrombin Time (PT)", category: "Coagulation" },
  { name: "International Normalized Ratio (INR)", category: "Coagulation" },
  { name: "Activated Partial Thromboplastin Time (aPTT)", category: "Coagulation" },
  { name: "Fibrinogen", category: "Coagulation" },
  { name: "Thrombin Time", category: "Coagulation" },
];

// =============================================================================
// HEMOGLOBIN A1C & DIABETES
// =============================================================================

export const LAB_TEST_REGISTRY_DIABETES: LabTestMeta[] = [
  { name: "Hemoglobin A1C (HbA1c)", category: "Diabetes" },
  { name: "Fasting Glucose", category: "Diabetes" },
  { name: "Oral Glucose Tolerance Test (OGTT)", category: "Diabetes" },
  { name: "C-Peptide", category: "Diabetes" },
  { name: "Insulin Level", category: "Diabetes" },
];

// =============================================================================
// URINALYSIS
// =============================================================================

export const LAB_TEST_REGISTRY_UA: LabTestMeta[] = [
  { name: "Urine pH", category: "Urinalysis" },
  { name: "Urine Specific Gravity", category: "Urinalysis" },
  { name: "Urine Protein", category: "Urinalysis" },
  { name: "Urine Glucose", category: "Urinalysis" },
  { name: "Urine Ketones", category: "Urinalysis" },
  { name: "Urine Blood", category: "Urinalysis" },
  { name: "Urine Leukocyte Esterase", category: "Urinalysis" },
  { name: "Urine Nitrites", category: "Urinalysis" },
  { name: "Urine Bilirubin", category: "Urinalysis" },
  { name: "Urine Urobilinogen", category: "Urinalysis" },
  { name: "Urine Microscopy", category: "Urinalysis" },
];

// =============================================================================
// ARTERIAL BLOOD GAS (ABG)
// =============================================================================

export const LAB_TEST_REGISTRY_ABG: LabTestMeta[] = [
  { name: "pH (Arterial)", category: "Arterial Blood Gas" },
  { name: "PaCO2 (Arterial CO2)", category: "Arterial Blood Gas" },
  { name: "PaO2 (Arterial O2)", category: "Arterial Blood Gas" },
  { name: "HCO3- (Bicarbonate)", category: "Arterial Blood Gas" },
  { name: "Base Excess/Deficit", category: "Arterial Blood Gas" },
  { name: "Oxygen Saturation (SaO2)", category: "Arterial Blood Gas" },
  { name: "Lactate", category: "Arterial Blood Gas" },
];

// =============================================================================
// INFLAMMATORY MARKERS
// =============================================================================

export const LAB_TEST_REGISTRY_INFLAMMATORY: LabTestMeta[] = [
  { name: "C-Reactive Protein (CRP)", category: "Inflammatory Markers" },
  { name: "High-Sensitivity CRP (hs-CRP)", category: "Inflammatory Markers" },
  { name: "Erythrocyte Sedimentation Rate (ESR)", category: "Inflammatory Markers" },
  { name: "Procalcitonin", category: "Inflammatory Markers" },
];

// =============================================================================
// EXPORT ALL LAB TESTS
// =============================================================================

export const LAB_TEST_REGISTRY: LabTestMeta[] = [
  ...LAB_TEST_REGISTRY_CBC,
  ...LAB_TEST_REGISTRY_CMP,
  ...LAB_TEST_REGISTRY_CARDIAC,
  ...LAB_TEST_REGISTRY_LIPIDS,
  ...LAB_TEST_REGISTRY_THYROID,
  ...LAB_TEST_REGISTRY_COAG,
  ...LAB_TEST_REGISTRY_DIABETES,
  ...LAB_TEST_REGISTRY_UA,
  ...LAB_TEST_REGISTRY_ABG,
  ...LAB_TEST_REGISTRY_INFLAMMATORY,
];

export function buildLabTestId(test: LabTestMeta): string {
  return test.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
