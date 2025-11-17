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
// -----------------------------
// FULL CONDITION REGISTRY
// -----------------------------
export const CONDITION_REGISTRY: ConditionDefinition[] = [
  // ---------------------
  // PULMONARY (PULM)
  // ---------------------

  // Obstructive
  { system: "PULM", subcategory: "Obstructive", condition: "Asthma" },
  { system: "PULM", subcategory: "Obstructive", condition: "Bronchiectasis" },
  { system: "PULM", subcategory: "Obstructive", condition: "Chronic Bronchitis" },
  { system: "PULM", subcategory: "Obstructive", condition: "Emphysema" },
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Chronic Obstructive Pulmonary Disease (COPD)",
  },
  { system: "PULM", subcategory: "Obstructive", condition: "Cystic Fibrosis" },

  // Pulmonary circulation
  {
    system: "PULM",
    subcategory: "Pulmonary Circulation",
    condition: "Pulmonary Embolism",
  },
  {
    system: "PULM",
    subcategory: "Pulmonary Circulation",
    condition: "Deep Vein Thrombosis (DVT)",
  },
  {
    system: "PULM",
    subcategory: "Pulmonary Circulation",
    condition: "Pulmonary Hypertension",
  },
  { system: "PULM", subcategory: "Pulmonary Circulation", condition: "Cor Pulmonale" },

  // Infectious
  { system: "PULM", subcategory: "Infectious", condition: "Acute Bronchitis" },
  { system: "PULM", subcategory: "Infectious", condition: "Pneumonia – Bacterial" },
  { system: "PULM", subcategory: "Infectious", condition: "Pneumonia – Viral" },
  { system: "PULM", subcategory: "Infectious", condition: "Pneumonia – Fungal" },
  { system: "PULM", subcategory: "Infectious", condition: "Pneumonia – HIV-Related" },
  { system: "PULM", subcategory: "Infectious", condition: "Tuberculosis" },

  // Neoplastic
  {
    system: "PULM",
    subcategory: "Neoplastic",
    condition: "Lung Cancer – Small Cell",
  },
  {
    system: "PULM",
    subcategory: "Neoplastic",
    condition: "Lung Cancer – Non-Small Cell",
  },
  {
    system: "PULM",
    subcategory: "Neoplastic",
    condition: "Lung Cancer – Squamous Cell Carcinoma",
  },
  {
    system: "PULM",
    subcategory: "Neoplastic",
    condition: "Lung Cancer – Adenocarcinoma",
  },
  {
    system: "PULM",
    subcategory: "Neoplastic",
    condition: "Lung Cancer – Large Cell Carcinoma",
  },
  { system: "PULM", subcategory: "Neoplastic", condition: "Carcinoid Tumor" },

  // Pleural diseases
  { system: "PULM", subcategory: "Pleural Diseases", condition: "Pleural Effusion" },
  { system: "PULM", subcategory: "Pleural Diseases", condition: "Empyema" },
  {
    system: "PULM",
    subcategory: "Pleural Diseases",
    condition: "Transudative Pleural Effusion",
  },
  {
    system: "PULM",
    subcategory: "Pleural Diseases",
    condition: "Exudative Pleural Effusion",
  },
  {
    system: "PULM",
    subcategory: "Pleural Diseases",
    condition: "Pneumothorax – Spontaneous",
  },
  {
    system: "PULM",
    subcategory: "Pleural Diseases",
    condition: "Pneumothorax – Traumatic",
  },
  {
    system: "PULM",
    subcategory: "Pleural Diseases",
    condition: "Pneumothorax – Tension",
  },
  { system: "PULM", subcategory: "Pleural Diseases", condition: "Pleurisy" },

  // Restrictive
  {
    system: "PULM",
    subcategory: "Restrictive",
    condition: "Idiopathic Pulmonary Fibrosis",
  },
  {
    system: "PULM",
    subcategory: "Restrictive",
    condition: "Pneumoconiosis – Coal Workers’",
  },
  { system: "PULM", subcategory: "Restrictive", condition: "Pneumoconiosis – Silicosis" },
  { system: "PULM", subcategory: "Restrictive", condition: "Pneumoconiosis – Asbestosis" },
  {
    system: "PULM",
    subcategory: "Restrictive",
    condition: "Asbestos-Related Diseases",
  },
  { system: "PULM", subcategory: "Restrictive", condition: "Sarcoidosis" },
  { system: "PULM", subcategory: "Restrictive", condition: "Kyphoscoliosis" },

  // Interstitial Lung Disease
  {
    system: "PULM",
    subcategory: "Interstitial Lung Disease",
    condition: "Granuloma",
  },
  {
    system: "PULM",
    subcategory: "Interstitial Lung Disease",
    condition: "Connective Tissue Disorder–Related ILD",
  },
  {
    system: "PULM",
    subcategory: "Interstitial Lung Disease",
    condition: "Drug-Induced Interstitial Disease",
  },
  {
    system: "PULM",
    subcategory: "Interstitial Lung Disease",
    condition: "Pulmonary Vasculitis",
  },
  {
    system: "PULM",
    subcategory: "Interstitial Lung Disease",
    condition: "Hypersensitivity Pneumonitis",
  },
  {
    system: "PULM",
    subcategory: "Interstitial Lung Disease",
    condition: "Allergic Bronchopulmonary Aspergillosis",
  },

  // Pediatric pulmonary disease
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Viral URI (Common Cold)",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Acute Bronchiolitis",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Epiglottitis",
  },
  { system: "PULM", subcategory: "Pediatric Pulmonary Disease", condition: "Croup" },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Influenza",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Pertussis",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "RSV",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Foreign Body Aspiration",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Bacterial Tracheitis",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Laryngomalacia",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Meconium Aspiration",
  },
  {
    system: "PULM",
    subcategory: "Pediatric Pulmonary Disease",
    condition: "Neonatal Respiratory Distress Syndrome",
  },

  // Other pulmonary disease
  {
    system: "PULM",
    subcategory: "Other Pulmonary Disease",
    condition: "Obstructive Sleep Apnea (OSA)",
  },
  {
    system: "PULM",
    subcategory: "Other Pulmonary Disease",
    condition: "Acute Respiratory Distress Syndrome (ARDS)",
  },
  {
    system: "PULM",
    subcategory: "Other Pulmonary Disease",
    condition: "Foreign Body Aspiration",
  },
  // ---------------------
  // CARDIOVASCULAR (CV)
  // ---------------------

  // ECG
  { system: "CV", subcategory: "ECG", condition: "Normal Sinus Rhythm (NSR)" },
  { system: "CV", subcategory: "ECG", condition: "Sinus Arrhythmia" },
  { system: "CV", subcategory: "ECG", condition: "Sinus Bradycardia" },
  { system: "CV", subcategory: "ECG", condition: "Sinus Tachycardia" },
  { system: "CV", subcategory: "ECG", condition: "Premature Atrial Contractions (PACs)" },
  { system: "CV", subcategory: "ECG", condition: "Atrial Tachycardia" },
  { system: "CV", subcategory: "ECG", condition: "Atrial Flutter" },
  { system: "CV", subcategory: "ECG", condition: "Atrial Fibrillation" },
  { system: "CV", subcategory: "ECG", condition: "Paroxysmal Supraventricular Tachycardia (PSVT)" },
  { system: "CV", subcategory: "ECG", condition: "Premature Ventricular Contractions (PVCs)" },
  { system: "CV", subcategory: "ECG", condition: "Ventricular Tachycardia (VT)" },
  { system: "CV", subcategory: "ECG", condition: "Ventricular Fibrillation (VF)/Flutter" },
  { system: "CV", subcategory: "ECG", condition: "Ventricular Escape Rhythm" },
  { system: "CV", subcategory: "ECG", condition: "Ventricular Asystole" },
  { system: "CV", subcategory: "ECG", condition: "First-Degree AV Block" },
  { system: "CV", subcategory: "ECG", condition: "Second-Degree AV Block Type I (Mobitz I)" },
  { system: "CV", subcategory: "ECG", condition: "Second-Degree AV Block Type II (Mobitz II)" },
  { system: "CV", subcategory: "ECG", condition: "Third-Degree (Complete) AV Block" },
  { system: "CV", subcategory: "ECG", condition: "Pacemaker Rhythm" },
  { system: "CV", subcategory: "ECG", condition: "Right Bundle Branch Block" },
  { system: "CV", subcategory: "ECG", condition: "Left Bundle Branch Block" },
  { system: "CV", subcategory: "ECG", condition: "Right Atrial Enlargement" },
  { system: "CV", subcategory: "ECG", condition: "Left Atrial Enlargement" },
  { system: "CV", subcategory: "ECG", condition: "Right Ventricular Hypertrophy" },
  { system: "CV", subcategory: "ECG", condition: "Left Ventricular Hypertrophy" },

  // Ischemic Heart Disease
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "Ischemic Heart Disease" },
  {
    system: "CV",
    subcategory: "Ischemic Heart Disease",
    condition: "Anterior Myocardial Infarction",
  },
  {
    system: "CV",
    subcategory: "Ischemic Heart Disease",
    condition: "Lateral Myocardial Infarction",
  },
  {
    system: "CV",
    subcategory: "Ischemic Heart Disease",
    condition: "Inferior Myocardial Infarction",
  },
  {
    system: "CV",
    subcategory: "Ischemic Heart Disease",
    condition: "Posterior Myocardial Infarction",
  },
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "Stable Angina" },
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "Unstable Angina" },
  {
    system: "CV",
    subcategory: "Ischemic Heart Disease",
    condition: "Variant (Prinzmetal's) Angina",
  },

  // Blood Pressure
  { system: "CV", subcategory: "Blood Pressure", condition: "Essential Hypertension" },
  { system: "CV", subcategory: "Blood Pressure", condition: "Secondary Hypertension" },
  { system: "CV", subcategory: "Blood Pressure", condition: "Malignant Hypertension" },
  { system: "CV", subcategory: "Blood Pressure", condition: "Orthostatic Hypotension" },

  // Valvular Disease
  { system: "CV", subcategory: "Valvular Disease", condition: "Aortic Stenosis" },
  {
    system: "CV",
    subcategory: "Valvular Disease",
    condition: "Aortic Insufficiency/Regurgitation",
  },
  { system: "CV", subcategory: "Valvular Disease", condition: "Mitral Stenosis" },
  {
    system: "CV",
    subcategory: "Valvular Disease",
    condition: "Mitral Insufficiency/Regurgitation",
  },
  { system: "CV", subcategory: "Valvular Disease", condition: "Mitral Valve Prolapse" },

  // Carditis
  { system: "CV", subcategory: "Carditis", condition: "Endocarditis" },
  { system: "CV", subcategory: "Carditis", condition: "Myocarditis" },
  { system: "CV", subcategory: "Carditis", condition: "Pericarditis" },

  // Vascular Disease
  { system: "CV", subcategory: "Vascular Disease", condition: "Venous Vascular Disease" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Arterial Vascular Disease" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Superficial Venous Thrombosis (SVT)" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Deep Venous Thrombosis (DVT)" },
  {
    system: "CV",
    subcategory: "Vascular Disease",
    condition: "Chronic Arterial Occlusive Disease",
  },
  {
    system: "CV",
    subcategory: "Vascular Disease",
    condition: "Acute Arterial Occlusive Disease",
  },
  { system: "CV", subcategory: "Vascular Disease", condition: "Phlebitis/Thrombophlebitis" },
  {
    system: "CV",
    subcategory: "Vascular Disease",
    condition: "Chronic Venous Insufficiency",
  },
  { system: "CV", subcategory: "Vascular Disease", condition: "Varicose Veins" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Venous Ulceration" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Raynaud's Disease" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Giant Cell Arteritis" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Temporal Arteritis" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Aortic Aneurysm" },

  // Heart Failure
  { system: "CV", subcategory: "Heart Failure", condition: "Right-Sided Heart Failure" },
  { system: "CV", subcategory: "Heart Failure", condition: "Left-Sided Heart Failure" },
  { system: "CV", subcategory: "Heart Failure", condition: "Biventricular Heart Failure" },

  // Cardiomyopathy
  { system: "CV", subcategory: "Cardiomyopathy", condition: "Dilated Cardiomyopathy" },
  { system: "CV", subcategory: "Cardiomyopathy", condition: "Hypertrophic Cardiomyopathy" },
  { system: "CV", subcategory: "Cardiomyopathy", condition: "Restrictive Cardiomyopathy" },

  // Syncope
  { system: "CV", subcategory: "Syncope", condition: "Orthostatic Hypotension" },
  { system: "CV", subcategory: "Syncope", condition: "Postural Tachycardia Syndrome (POTS)" },
  { system: "CV", subcategory: "Syncope", condition: "Cardiac Causes of Syncope" },
  { system: "CV", subcategory: "Syncope", condition: "Reflex Syncope" },

  // Pediatric cardiology
  {
    system: "CV",
    subcategory: "Pediatric Cardiology",
    condition: "Atrial Septal Defect (ASD)",
  },
  {
    system: "CV",
    subcategory: "Pediatric Cardiology",
    condition: "Coarctation of the Aorta",
  },
  {
    system: "CV",
    subcategory: "Pediatric Cardiology",
    condition: "Hypoplastic Left Heart",
  },
  {
    system: "CV",
    subcategory: "Pediatric Cardiology",
    condition: "Patent Ductus Arteriosus",
  },
  {
    system: "CV",
    subcategory: "Pediatric Cardiology",
    condition: "Persistent Fetal Circulation",
  },
  {
    system: "CV",
    subcategory: "Pediatric Cardiology",
    condition: "Tetralogy of Fallot",
  },
  {
    system: "CV",
    subcategory: "Pediatric Cardiology",
    condition: "Ventricular Septal Defect (VSD)",
  },
];
