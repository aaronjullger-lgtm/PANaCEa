// scoringSystemRegistry.ts
/**
 * Clinical Scoring System Registry
 * 
 * Bare-bones registry of clinical scoring systems and risk calculators. AI generates:
 * - How to calculate score
 * - Interpretation
 * - Clinical application
 * - Limitations
 * - Evidence base
 */

export interface ScoringSystemMeta {
  name: string;
  category: string; // Risk Stratification, Prognosis, Severity, Diagnosis
  clinicalUse: string; // Brief description of what it's used for
}

export const SCORING_SYSTEM_REGISTRY: ScoringSystemMeta[] = [
  // Cardiovascular
  { name: "CHADS2 Score", category: "Risk Stratification", clinicalUse: "Stroke risk in atrial fibrillation" },
  { name: "CHA2DS2-VASc Score", category: "Risk Stratification", clinicalUse: "Stroke risk in atrial fibrillation (more sensitive)" },
  { name: "HAS-BLED Score", category: "Risk Stratification", clinicalUse: "Bleeding risk on anticoagulation" },
  { name: "TIMI Risk Score (STEMI)", category: "Risk Stratification", clinicalUse: "Mortality risk in STEMI" },
  { name: "TIMI Risk Score (NSTE-ACS)", category: "Risk Stratification", clinicalUse: "Risk in unstable angina/NSTEMI" },
  { name: "GRACE Score", category: "Risk Stratification", clinicalUse: "Mortality in acute coronary syndrome" },
  { name: "Framingham Risk Score", category: "Risk Stratification", clinicalUse: "10-year cardiovascular disease risk" },
  { name: "ASCVD Risk Calculator", category: "Risk Stratification", clinicalUse: "10-year ASCVD risk" },
  { name: "Wells Score (DVT)", category: "Risk Stratification", clinicalUse: "Pretest probability of DVT" },
  { name: "Wells Score (PE)", category: "Risk Stratification", clinicalUse: "Pretest probability of pulmonary embolism" },
  { name: "PERC Rule", category: "Risk Stratification", clinicalUse: "Rule out PE without testing" },
  { name: "PESI Score", category: "Risk Stratification", clinicalUse: "Mortality risk in PE" },
  { name: "sPESI (Simplified)", category: "Risk Stratification", clinicalUse: "Simplified PE severity" },
  
  // Pulmonary
  { name: "CURB-65", category: "Severity", clinicalUse: "Pneumonia severity and mortality" },
  { name: "PSI/PORT Score", category: "Severity", clinicalUse: "Pneumonia severity index" },
  { name: "APACHE II", category: "Severity", clinicalUse: "ICU mortality prediction" },
  { name: "SOFA Score", category: "Severity", clinicalUse: "Sepsis organ dysfunction" },
  { name: "qSOFA", category: "Risk Stratification", clinicalUse: "Quick sepsis screening" },
  
  // Hepatology
  { name: "Child-Pugh Score", category: "Prognosis", clinicalUse: "Cirrhosis severity and prognosis" },
  { name: "MELD Score", category: "Prognosis", clinicalUse: "Liver disease severity and transplant priority" },
  { name: "MELD-Na", category: "Prognosis", clinicalUse: "MELD with sodium correction" },
  { name: "FIB-4 Index", category: "Diagnosis", clinicalUse: "Hepatic fibrosis screening" },
  
  // Gastroenterology
  { name: "Glasgow-Blatchford Score", category: "Risk Stratification", clinicalUse: "Upper GI bleed risk" },
  { name: "Rockall Score", category: "Risk Stratification", clinicalUse: "Upper GI bleed mortality" },
  { name: "Ranson Criteria", category: "Prognosis", clinicalUse: "Pancreatitis severity" },
  { name: "BISAP Score", category: "Severity", clinicalUse: "Pancreatitis mortality risk" },
  { name: "Alvarado Score", category: "Diagnosis", clinicalUse: "Appendicitis probability" },
  
  // Neurology
  { name: "NIH Stroke Scale (NIHSS)", category: "Severity", clinicalUse: "Stroke severity assessment" },
  { name: "Glasgow Coma Scale (GCS)", category: "Severity", clinicalUse: "Level of consciousness" },
  { name: "ABCD2 Score", category: "Risk Stratification", clinicalUse: "Stroke risk after TIA" },
  { name: "Canadian CT Head Rule", category: "Risk Stratification", clinicalUse: "Need for head CT after trauma" },
  { name: "New Orleans Criteria", category: "Risk Stratification", clinicalUse: "Head CT after minor head injury" },
  { name: "Hunt and Hess Scale", category: "Severity", clinicalUse: "Subarachnoid hemorrhage severity" },
  
  // Obstetrics
  { name: "Bishop Score", category: "Prognosis", clinicalUse: "Cervical favorability for induction" },
  { name: "APGAR Score", category: "Assessment", clinicalUse: "Newborn condition at birth" },
  
  // Orthopedics
  { name: "Ottawa Ankle Rules", category: "Risk Stratification", clinicalUse: "Need for ankle X-ray" },
  { name: "Ottawa Knee Rules", category: "Risk Stratification", clinicalUse: "Need for knee X-ray" },
  { name: "Canadian C-Spine Rule", category: "Risk Stratification", clinicalUse: "Need for c-spine imaging" },
  { name: "NEXUS Criteria", category: "Risk Stratification", clinicalUse: "C-spine clearance" },
  
  // Renal
  { name: "Cockcroft-Gault Equation", category: "Calculation", clinicalUse: "Creatinine clearance estimation" },
  { name: "MDRD Equation", category: "Calculation", clinicalUse: "GFR estimation" },
  { name: "CKD-EPI Equation", category: "Calculation", clinicalUse: "GFR estimation (preferred)" },
  
  // Endocrine
  { name: "HbA1c Targets", category: "Treatment Goal", clinicalUse: "Diabetes control goals" },
  
  // Hematology
  { name: "HAS Score", category: "Diagnosis", clinicalUse: "Heparin-induced thrombocytopenia probability" },
  { name: "DIC Score (ISTH)", category: "Diagnosis", clinicalUse: "Disseminated intravascular coagulation" },
  
  // Emergency Medicine
  { name: "Centor Criteria", category: "Diagnosis", clinicalUse: "Strep pharyngitis probability" },
  { name: "Modified Centor Score", category: "Diagnosis", clinicalUse: "Strep pharyngitis with age factor" },
  { name: "FAST Exam", category: "Diagnosis", clinicalUse: "Trauma ultrasound protocol" },
  
  // Pain Assessment
  { name: "Visual Analog Scale (VAS)", category: "Assessment", clinicalUse: "Pain intensity measurement" },
  { name: "Numeric Rating Scale (NRS)", category: "Assessment", clinicalUse: "Pain intensity 0-10" },
  
  // Functional Status
  { name: "Karnofsky Performance Status", category: "Assessment", clinicalUse: "Functional status in cancer" },
  { name: "ECOG Performance Status", category: "Assessment", clinicalUse: "Functional status (0-5 scale)" },
  
  // Mental Health
  { name: "PHQ-9", category: "Diagnosis", clinicalUse: "Depression severity" },
  { name: "GAD-7", category: "Diagnosis", clinicalUse: "Anxiety severity" },
  { name: "MMSE", category: "Diagnosis", clinicalUse: "Cognitive impairment screening" },
  { name: "Montreal Cognitive Assessment (MoCA)", category: "Diagnosis", clinicalUse: "Cognitive screening" },
];

export function buildScoringSystemId(score: ScoringSystemMeta): string {
  return score.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
