// conditionRegistry.ts

import type { ConditionDefinition, SystemCode } from "./types.ts";

export interface ConditionMeta {
  system: SystemCode;
  /** Secondary systems this condition is relevant for (cross-listed) */
  relatedSystems?: SystemCode[];
  subcategory: string;
  condition: string;
  aliases?: string[];
  mediaIds?: string[];

  overview?: string;          // 1–3 sentence summary
  keyPoints?: string[];       // buzzword bullets
  redFlags?: string[];        // “do not miss” findings
  treatmentPearls?: string[]; // high-yield management bullets
}

// --------------------------------------------
// CARDIOVASCULAR REGISTRY (76 entries)
// --------------------------------------------
export const CONDITION_REGISTRY_CV: ConditionMeta[] = [

  // -------------------------
  // ECG
  // -------------------------
  { system: "CV", subcategory: "ECG", condition: "Normal Sinus Rhythm (NSR)" },
  { system: "CV", subcategory: "ECG", condition: "Sinus Bradycardia" },
  { system: "CV", subcategory: "ECG", condition: "Sinus Tachycardia" },
  { system: "CV", subcategory: "ECG", condition: "Premature Atrial Complexes (PACs)" },
  { system: "CV", subcategory: "ECG", condition: "Premature Ventricular Complexes (PVCs)" },
  { system: "CV", subcategory: "ECG", condition: "Atrial Fibrillation", aliases: ["AFib", "AF", "A-Fib"] },
  { system: "CV", subcategory: "ECG", condition: "Atrial Flutter", aliases: ["AFL", "A-Flutter"] },
  { system: "CV", subcategory: "ECG", condition: "AV Nodal Re-entry Tachycardia (AVNRT)" },
  { system: "CV", subcategory: "ECG", condition: "Ventricular Tachycardia", aliases: ["VT", "V-Tach"] },
  { system: "CV", subcategory: "ECG", condition: "Ventricular Fibrillation", aliases: ["VF", "V-Fib"] },

  // -------------------------
  // Ischemic Heart Disease
  // -------------------------
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "Acute Coronary Syndrome (ACS)", aliases: ["ACS", "Heart Attack"] },
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "Stable Angina", aliases: ["Angina Pectoris", "Exertional Angina"] },
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "Prinzmetal (Variant) Angina", aliases: ["Variant Angina", "Vasospastic Angina"] },
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "Silent Ischemia" },
  { system: "CV", subcategory: "Ischemic Heart Disease", condition: "STEMI" },

  // -------------------------
  // Blood Pressure Disorders
  // -------------------------
  { system: "CV", subcategory: "Blood Pressure", condition: "Essential Hypertension", aliases: ["Primary Hypertension", "High Blood Pressure"] },
  { system: "CV", subcategory: "Blood Pressure", condition: "Secondary Hypertension" },
  { system: "CV", subcategory: "Blood Pressure", condition: "Malignant Hypertension" },
  { system: "CV", subcategory: "Blood Pressure", condition: "Orthostatic Hypotension" },

  // -------------------------
  // Heart Failure
  // -------------------------
  { system: "CV", subcategory: "Heart Failure", condition: "Left-Sided Heart Failure" },
  { system: "CV", subcategory: "Heart Failure", condition: "Right-Sided Heart Failure" },
  { system: "CV", subcategory: "Heart Failure", condition: "Biventricular Heart Failure" },
  { system: "CV", subcategory: "Heart Failure", condition: "High-Output Heart Failure" },

  // -------------------------
  // Valvular Disease
  // -------------------------
  { system: "CV", subcategory: "Valvular Disease", condition: "Aortic Stenosis", aliases: ["AS", "Aortic Valve Stenosis"] },
  { system: "CV", subcategory: "Valvular Disease", condition: "Aortic Regurgitation", aliases: ["AR", "Aortic Insufficiency"] },
  { system: "CV", subcategory: "Valvular Disease", condition: "Mitral Stenosis", aliases: ["MS", "Mitral Valve Stenosis"] },
  { system: "CV", subcategory: "Valvular Disease", condition: "Mitral Regurgitation", aliases: ["MR", "Mitral Insufficiency"] },
  { system: "CV", subcategory: "Valvular Disease", condition: "Mitral Valve Prolapse" },
  { system: "CV", subcategory: "Valvular Disease", condition: "Tricuspid Regurgitation" },
  { system: "CV", subcategory: "Valvular Disease", condition: "Pulmonic Stenosis" },

  // -------------------------
  // Cardiomyopathies
  // -------------------------
  { system: "CV", subcategory: "Cardiomyopathy", condition: "Dilated Cardiomyopathy" },
  { system: "CV", subcategory: "Cardiomyopathy", condition: "Hypertrophic Cardiomyopathy" },
  { system: "CV", subcategory: "Cardiomyopathy", condition: "Restrictive Cardiomyopathy" },

  // -------------------------
  // Carditis
  // -------------------------
  { system: "CV", subcategory: "Carditis", condition: "Endocarditis" },
  { system: "CV", subcategory: "Carditis", condition: "Myocarditis" },
  { system: "CV", subcategory: "Carditis", condition: "Pericarditis", aliases: ["Pericardial Inflammation"] },
  { system: "CV", subcategory: "Carditis", condition: "Cardiac Tamponade" },
  { system: "CV", subcategory: "Carditis", condition: "Constrictive Pericarditis" },

  // -------------------------
  // Arrhythmias / Conduction Disorders
  // -------------------------
  { system: "CV", subcategory: "Conduction Disorders", condition: "Sick Sinus Syndrome (SSS)" },
  { system: "CV", subcategory: "Conduction Disorders", condition: "First-Degree AV Block" },
  { system: "CV", subcategory: "Conduction Disorders", condition: "Second-Degree AV Block (Mobitz I)" },
  { system: "CV", subcategory: "Conduction Disorders", condition: "Second-Degree AV Block (Mobitz II)" },
  { system: "CV", subcategory: "Conduction Disorders", condition: "Third-Degree AV Block" },
  { system: "CV", subcategory: "Conduction Disorders", condition: "Wolff-Parkinson-White Syndrome", aliases: ["WPW"] },
  { system: "CV", subcategory: "Arrhythmia", condition: "Premature Ventricular Contraction (PVC)" },
  { system: "CV", subcategory: "Congenital", condition: "Transposition of the Great Arteries" },
  { system: "CV", subcategory: "Vascular", condition: "Acute Arterial Occlusion", aliases: ["Limb Ischemia"] },

  // -------------------------
  // Peripheral Vascular Disease
  // -------------------------
  { system: "CV", subcategory: "Vascular Disease", condition: "Peripheral Arterial Disease (PAD)" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Peripheral Venous Disease" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Superficial Venous Thrombosis (SVT)" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Deep Venous Thrombosis (DVT)", aliases: ["DVT", "Deep Vein Thrombosis"] },
  { system: "CV", subcategory: "Vascular Disease", condition: "Chronic Arterial Occlusive Disease" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Acute Arterial Occlusive Disease" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Raynaud’s Disease" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Chronic Venous Insufficiency" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Varicose Veins" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Venous Ulceration" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Giant Cell Arteritis (Temporal Arteritis)" },
  { system: "CV", subcategory: "Vascular Disease", condition: "Aortic Aneurysm", aliases: ["AAA", "Abdominal Aortic Aneurysm"] },
  { system: "CV", subcategory: "Vascular Disease", condition: "Aortic Dissection" },

  // -------------------------
  // Pediatric & Congenital Cardiology
  // -------------------------
  { system: "CV", subcategory: "Congenital Heart Disease", condition: "Atrial Septal Defect (ASD)" },
  { system: "CV", subcategory: "Congenital Heart Disease", condition: "Ventricular Septal Defect (VSD)" },
  { system: "CV", subcategory: "Congenital Heart Disease", condition: "Patent Ductus Arteriosus (PDA)" },
  { system: "CV", subcategory: "Congenital Heart Disease", condition: "Tetralogy of Fallot" },
  { system: "CV", subcategory: "Congenital Heart Disease", condition: "Coarctation of the Aorta" },
  { system: "CV", subcategory: "Congenital Heart Disease", condition: "Transposition of the Great Arteries" },
  // -------------------------
  // Environmental / Other
  // -------------------------
  { system: "CV", subcategory: "Environmental", condition: "Hypothermia" },
];

// ---------------------------------------------------------------
// PULMONARY REGISTRY
// ---------------------------------------------------------------

export const CONDITION_REGISTRY_PULM: ConditionMeta[] = [

  // Obstructive Lung Disease
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Asthma",
  },
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Chronic Bronchitis",
  },
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Emphysema",
  },
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Chronic Obstructive Pulmonary Disease (COPD)",
  },
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Bronchiectasis",
  },
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Aspirin Exacerbated Respiratory Disease (AERD)",
  },
  {
    system: "PULM",
    subcategory: "Obstructive",
    condition: "Cystic Fibrosis",
  },

  // Pulmonary Circulation
  {
    system: "PULM",
    subcategory: "Pulmonary Circulation",
    condition: "Pulmonary Embolism",
  },
  {
    system: "PULM",
    subcategory: "Pulmonary Circulation",
    condition: "Pulmonary Hypertension",
  },
  {
    system: "PULM",
    subcategory: "Pulmonary Circulation",
    condition: "Cor Pulmonale",
  },

  // Infectious
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Community-Acquired Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Hospital-Acquired Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Atypical Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Viral Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Aspiration Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Klebsiella Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Streptococcal Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Pseudomonas Pneumonia",
  },
  {
    system: "PULM",
    subcategory: "Infectious",
    condition: "Tuberculosis",
  },

  // Pleural Disease
  {
    system: "PULM",
    subcategory: "Pleural Disease",
    condition: "Pleural Effusion",
  },
  {
    system: "PULM",
    subcategory: "Pleural Disease",
    condition: "Pneumothorax",
  },
  {
    system: "PULM",
    subcategory: "Pleural Disease",
    condition: "Hemothorax",
  },
  {
    system: "PULM",
    subcategory: "Pleural Disease",
    condition: "Empyema",
  },

  // Interstitial / Restrictive
  {
    system: "PULM",
    subcategory: "Interstitial",
    condition: "Idiopathic Pulmonary Fibrosis",
  },
  {
    system: "PULM",
    subcategory: "Interstitial",
    condition: "Sarcoidosis",
    relatedSystems: ["DERM", "HEENT", "CV"],
  },

  // Neoplastic
  {
    system: "PULM",
    subcategory: "Oncology",
    condition: "Small Cell Lung Cancer",
  },
  {
    system: "PULM",
    subcategory: "Oncology",
    condition: "Non–Small Cell Lung Cancer",
  },
  {
    system: "PULM",
    subcategory: "Oncology",
    condition: "Carcinoid Tumor",
  },

  // Others
  {
    system: "PULM",
    subcategory: "Toxic/Environmental",
    condition: "Silicosis",
  },
  {
    system: "PULM",
    subcategory: "Toxic/Environmental",
    condition: "Asbestosis",
  },
  {
    system: "PULM",
    subcategory: "Toxic/Environmental",
    condition: "Smoke Inhalation Injury",
  },
  {
    system: "PULM",
    subcategory: "Toxic/Environmental",
    condition: "Occupational Lung Disease",
  },
  // Critical Care / Other
  { system: "PULM", subcategory: "Critical Care", condition: "Acute Respiratory Distress Syndrome (ARDS)" },
  { system: "PULM", subcategory: "Other", condition: "Foreign Body Aspiration" },
];
// ---------------------------------------------------------------
// GASTROINTESTINAL / NUTRITION REGISTRY
// ---------------------------------------------------------------

export const CONDITION_REGISTRY_GI: ConditionMeta[] = [

  // Esophagus
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Gastroesophageal Reflux Disease (GERD)",
  },
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Esophagitis",
  },
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Achalasia",
  },
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Diffuse Esophageal Spasm",
  },
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Esophageal Stricture",
  },
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Esophageal Varices",
  },
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Mallory-Weiss Tear",
  },
  {
    system: "GI",
    subcategory: "Esophagus",
    condition: "Boerhaave Syndrome",
  },

  // Stomach
  {
    system: "GI",
    subcategory: "Stomach",
    condition: "Gastritis",
  },
  {
    system: "GI",
    subcategory: "Stomach",
    condition: "Peptic Ulcer Disease",
  },
  {
    system: "GI",
    subcategory: "Stomach",
    condition: "Pyloric Stenosis",
  },
  {
    system: "GI",
    subcategory: "Stomach",
    condition: "H. Pylori Infection",
  },
  {
    system: "GI",
    subcategory: "Stomach",
    condition: "Gastric Cancer",
  },

  // Small Bowel
  {
    system: "GI",
    subcategory: "Small Bowel",
    condition: "Celiac Disease",
  },
  {
    system: "GI",
    subcategory: "Small Bowel",
    condition: "Small Bowel Obstruction",
  },
  {
    system: "GI",
    subcategory: "Small Bowel",
    condition: "Ileus",
  },
  {
    system: "GI",
    subcategory: "Small Bowel",
    condition: "Intussusception",
  },
  {
    system: "GI",
    subcategory: "Small Bowel",
    condition: "Short Bowel Syndrome",
  },

  // Large Bowel / Colon
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Diverticulitis",
  },
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Diverticulosis",
  },
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Ulcerative Colitis",
  },
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Crohn Disease",
  },
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Colorectal Cancer",
  },
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Irritable Bowel Syndrome",
  },
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Volvulus",
  },
  {
    system: "GI",
    subcategory: "Colon",
    condition: "Pseudomembranous Colitis (C. diff)",
  },

  // Hepatobiliary — Liver
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Hepatitis A",
  },
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Hepatitis B",
  },
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Hepatitis C",
  },
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Cirrhosis",
  },
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Hepatic Encephalopathy",
  },
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Wilson Disease",
    relatedSystems: ["NEURO", "PSYCH"],
  },
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Autoimmune Hepatitis",
  },
  {
    system: "GI",
    subcategory: "Liver",
    condition: "Hepatocellular Carcinoma",
  },

  // Hepatobiliary — Gallbladder
  {
    system: "GI",
    subcategory: "Gallbladder",
    condition: "Cholelithiasis",
  },
  {
    system: "GI",
    subcategory: "Gallbladder",
    condition: "Cholecystitis",
  },
  {
    system: "GI",
    subcategory: "Gallbladder",
    condition: "Choledocholithiasis",
  },
  {
    system: "GI",
    subcategory: "Gallbladder",
    condition: "Cholangitis",
  },

  // Pancreas
  {
    system: "GI",
    subcategory: "Pancreas",
    condition: "Acute Pancreatitis",
  },
  {
    system: "GI",
    subcategory: "Pancreas",
    condition: "Chronic Pancreatitis",
  },
  {
    system: "GI",
    subcategory: "Pancreas",
    condition: "Insulinoma",
  },
  {
    system: "GI",
    subcategory: "Pancreas",
    condition: "Pancreatic Cancer",
  },

  // Nutrition / Metabolism
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Malnutrition",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Vitamin B1 (Thiamine) Deficiency",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Vitamin B3 (Niacin) Deficiency (Pellagra)",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Vitamin C Deficiency (Scurvy)",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Vitamin D Deficiency (Rickets)",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Vitamin A Deficiency",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Vitamin Deficiencies",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Electrolyte Abnormalities",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Obesity",
  },
  // Hernias
  { system: "GI", subcategory: "Hernia", condition: "Hiatal Hernia" },
  { system: "GI", subcategory: "Hernia", condition: "Inguinal Hernia" },
  { system: "GI", subcategory: "Hernia", condition: "Umbilical Hernia" },
  { system: "GI", subcategory: "Hernia", condition: "Ventral / Incisional Hernia" },

  // Anorectal
  { system: "GI", subcategory: "Anorectal", condition: "Hemorrhoids" },
  { system: "GI", subcategory: "Anorectal", condition: "Anal Fissure" },
  { system: "GI", subcategory: "Anorectal", condition: "Anorectal Abscess / Fistula" },
  { system: "GI", subcategory: "Anorectal", condition: "Pilonidal Disease" },
  { system: "GI", subcategory: "Anorectal", condition: "Fecal Impaction" },
];

// -------------------------------------------
// MUSCULOSKELETAL REGISTRY (MSK)
// -------------------------------------------

export const CONDITION_REGISTRY_MSK: ConditionMeta[] = [
  // Arthritis & Crystal Disease
  { system: "MSK", subcategory: "Arthritis", condition: "Osteoarthritis", aliases: ["OA", "Degenerative Joint Disease"] },
  { system: "MSK", subcategory: "Arthritis", condition: "Rheumatoid Arthritis", aliases: ["RA"] },
  { system: "MSK", subcategory: "Arthritis", condition: "Juvenile Idiopathic Arthritis" },
  { system: "MSK", subcategory: "Arthritis", condition: "Psoriatic Arthritis", aliases: ["PsA"] },
  { system: "MSK", subcategory: "Arthritis", condition: "Reactive Arthritis (Reiter Syndrome)" },
  { system: "MSK", subcategory: "Crystal Disease", condition: "Gout", aliases: ["Gouty Arthritis", "Crystal Arthropathy"] },
  { system: "MSK", subcategory: "Crystal Disease", condition: "Pseudogout (Calcium Pyrophosphate Deposition)" },
  { system: "MSK", subcategory: "Arthritis", condition: "Septic Arthritis" },
  { system: "MSK", subcategory: "Arthritis", condition: "Lyme Arthritis" },
  { system: "MSK", subcategory: "Seronegative Spondyloarthropathy", condition: "Ankylosing Spondylitis", aliases: ["AS", "Bechterew's Disease"] },
  { system: "MSK", subcategory: "Seronegative Spondyloarthropathy", condition: "Enteropathic Arthritis" },

  // Soft Tissue / Overuse Syndromes
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Rotator Cuff Tendinopathy" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Rotator Cuff Tear", aliases: ["RCT", "Rotator Cuff Injury"] },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Adhesive Capsulitis" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Subacromial Bursitis" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Lateral Epicondylitis (Tennis Elbow)" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Medial Epicondylitis (Golfer Elbow)" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "De Quervain Tenosynovitis" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Achilles Tendon Rupture" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Plantar Fasciitis", aliases: ["Heel Spur Syndrome"] },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Trochanteric Bursitis" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Patellar Tendinopathy (Jumper Knee)" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Iliotibial Band Syndrome" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Carpal Tunnel Syndrome", aliases: ["CTS"] },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Ulnar Neuropathy at the Elbow (Cubital Tunnel)" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Trigger Finger (Stenosing Tenosynovitis)" },
  { system: "MSK", subcategory: "Soft Tissue/Overuse", condition: "Ganglion Cyst" },

  // Soft Tissue / Tendon
  { system: "MSK", subcategory: "Soft Tissue", condition: "De Quervain Tenosynovitis" },
  { system: "MSK", subcategory: "Soft Tissue", condition: "Infectious Tenosynovitis" },
  { system: "MSK", subcategory: "Soft Tissue", condition: "Achilles Tendon Rupture" },

  // Back & Spine
  { system: "MSK", subcategory: "Back & Spine", condition: "Mechanical Low Back Pain" },
  { system: "MSK", subcategory: "Back & Spine", condition: "Lumbar Radiculopathy (Herniated Disc)" },
  { system: "MSK", subcategory: "Back & Spine", condition: "Cauda Equina Syndrome" },
  { system: "MSK", subcategory: "Back & Spine", condition: "Spinal Stenosis", aliases: ["Lumbar Stenosis"] },
  { system: "MSK", subcategory: "Back & Spine", condition: "Compression Vertebral Fracture" },
  { system: "MSK", subcategory: "Back & Spine", condition: "Spondylolisthesis" },
  { system: "MSK", subcategory: "Back & Spine", condition: "Spondylolysis" },
  { system: "MSK", subcategory: "Back & Spine", condition: "Scoliosis" },

  // Trauma & Fractures – Upper Extremity
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Clavicle Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Proximal Humerus Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Anterior Shoulder Dislocation" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Posterior Shoulder Dislocation" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Acromioclavicular (AC) Joint Separation" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Supracondylar Humerus Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Radial Head Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Monteggia Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Galeazzi Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Colles Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Smith Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Scaphoid Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Boxer Fracture (5th Metacarpal Neck)" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Gamekeeper/Skier Thumb (UCL Injury)" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Nursemaid Elbow (Radial Head Subluxation)" },

  // Trauma & Fractures – Lower Extremity
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Hip Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Hip Dislocation" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Femoral Shaft Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Patellar Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Tibial Plateau Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Tibial Shaft Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Ankle Fracture (Bimalleolar/Trimalleolar)" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Maisonneuve Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Jones Fracture" },
  { system: "MSK", subcategory: "Trauma/Fracture", condition: "Stress Fracture (Tibia/Metatarsal)" },

  // Ligamentous / Meniscal Injuries
  { system: "MSK", subcategory: "Ligament Injury", condition: "Anterior Cruciate Ligament (ACL) Tear" },
  { system: "MSK", subcategory: "Ligament Injury", condition: "Posterior Cruciate Ligament (PCL) Injury" },
  { system: "MSK", subcategory: "Ligament Injury", condition: "Medial Collateral Ligament (MCL) Injury" },
  { system: "MSK", subcategory: "Ligament Injury", condition: "Lateral Collateral Ligament (LCL) Injury" },
  { system: "MSK", subcategory: "Meniscal Injury", condition: "Medial Meniscus Tear" },
  { system: "MSK", subcategory: "Meniscal Injury", condition: "Lateral Meniscus Tear" },
  { system: "MSK", subcategory: "Ankle Sprain", condition: "Lateral Ankle Sprain" },
  { system: "MSK", subcategory: "Ankle Sprain", condition: "High Ankle (Syndesmotic) Sprain" },

  // Bone & Metabolic
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Osteoporosis", aliases: ["Bone Loss", "Porous Bones"] },
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Osteopenia" },
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Osteomalacia" },
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Paget Disease of Bone" },
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Osteomyelitis", aliases: ["Bone Infection"] },
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Osteosarcoma" },
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Ewing Sarcoma" },
  { system: "MSK", subcategory: "Metabolic/Bone", condition: "Avascular Necrosis of the Femoral Head" },

  // Rheumatologic / Systemic MSK
  { system: "MSK", subcategory: "Rheumatologic", condition: "Polymyalgia Rheumatica" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Polymyositis" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Dermatomyositis" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Systemic Lupus Erythematosus – MSK Manifestations" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Systemic Sclerosis (Scleroderma)" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Sjogren Syndrome" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Drug-Induced Lupus" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Granulomatosis with Polyangiitis (Wegener)" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Microscopic Polyangiitis" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Polyarteritis Nodosa" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Henoch-Schönlein Purpura" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Kawasaki Disease" },
  { system: "MSK", subcategory: "Rheumatologic", condition: "Fibromyalgia" },

  // Pediatric MSK
  { system: "MSK", subcategory: "Pediatrics", condition: "Developmental Dysplasia of the Hip" },
  { system: "MSK", subcategory: "Pediatrics", condition: "Legg-Calvé-Perthes Disease" },
  { system: "MSK", subcategory: "Pediatrics", condition: "Slipped Capital Femoral Epiphysis" },
  { system: "MSK", subcategory: "Pediatrics", condition: "Osgood–Schlatter Disease" },
  { system: "MSK", subcategory: "Pediatrics", condition: "Nursemaid Elbow (Radial Head Subluxation)" },
  { system: "MSK", subcategory: "Pediatrics", condition: "Osteochondritis Dissecans" },

  // MSK Infections / Misc
  { system: "MSK", subcategory: "Infection", condition: "Septic Bursitis" },
  { system: "MSK", subcategory: "Infection", condition: "Septic Tenosynovitis" },
  { system: "MSK", subcategory: "Infection", condition: "Prosthetic Joint Infection" },
  // Emergency / Other
  { system: "MSK", subcategory: "Emergency", condition: "Compartment Syndrome" },
  { system: "MSK", subcategory: "Chest Wall", condition: "Costochondritis" },
];

// -------------------------------------------
// ENDOCRINE REGISTRY (ENDO)
// -------------------------------------------

export const CONDITION_REGISTRY_ENDO: ConditionMeta[] = [

  // Thyroid Disorders
  { system: "ENDO", subcategory: "Thyroid", condition: "Hypothyroidism (Primary)" },
  { system: "ENDO", subcategory: "Thyroid", condition: "Hyperthyroidism (Graves Disease)" },
  { system: "ENDO", subcategory: "Thyroid", condition: "Subacute Thyroiditis (De Quervain)" },
  { system: "ENDO", subcategory: "Thyroid", condition: "Postpartum Thyroiditis" },
  { system: "ENDO", subcategory: "Thyroid", condition: "Hashimoto Thyroiditis", aliases: ["Hashimoto's Thyroiditis", "Chronic Lymphocytic Thyroiditis"] },
  { system: "ENDO", subcategory: "Thyroid", condition: "Thyroid Nodule", aliases: ["Thyroid Mass"] },
  { system: "ENDO", subcategory: "Thyroid", condition: "Thyroid Cancer" },
  { system: "ENDO", subcategory: "Thyroid", condition: "Myxedema Coma" },
  { system: "ENDO", subcategory: "Thyroid", condition: "Thyroid Storm" },

  // Diabetes Mellitus
  { system: "ENDO", subcategory: "Diabetes", condition: "Type 1 Diabetes Mellitus", aliases: ["T1DM", "Type 1 Diabetes", "Juvenile Diabetes"] },
  { system: "ENDO", subcategory: "Diabetes", condition: "Type 2 Diabetes Mellitus", aliases: ["T2DM", "Type 2 Diabetes", "Adult-Onset Diabetes"] },
  { system: "ENDO", subcategory: "Diabetes", condition: "Gestational Diabetes", aliases: ["GDM"] },
  { system: "ENDO", subcategory: "Diabetes", condition: "Diabetic Ketoacidosis (DKA)" },
  { system: "ENDO", subcategory: "Diabetes", condition: "Hyperosmolar Hyperglycemic State (HHS)" },
  { system: "ENDO", subcategory: "Diabetes", condition: "Diabetic Foot Infection" },
  { system: "ENDO", subcategory: "Diabetes", condition: "Diabetic Neuropathy" },
  { system: "ENDO", subcategory: "Diabetes", condition: "Diabetic Nephropathy" },
  { system: "ENDO", subcategory: "Diabetes", condition: "Diabetic Retinopathy" },

  // Adrenal Disorders
  { system: "ENDO", subcategory: "Adrenal", condition: "Cushing Syndrome", aliases: ["Cushing's Syndrome", "Hypercortisolism"] },
  { system: "ENDO", subcategory: "Adrenal", condition: "Addison Disease (Primary Adrenal Insufficiency)", aliases: ["Addison's Disease", "Primary Adrenal Insufficiency"] },
  { system: "ENDO", subcategory: "Adrenal", condition: "Adrenal Crisis" },
  { system: "ENDO", subcategory: "Adrenal", condition: "Hyperaldosteronism (Conn Syndrome)" },
  { system: "ENDO", subcategory: "Adrenal", condition: "Pheochromocytoma" },

  // Pituitary Disorders
  { system: "ENDO", subcategory: "Pituitary", condition: "Acromegaly" },
  { system: "ENDO", subcategory: "Pituitary", condition: "Gigantism" },
  { system: "ENDO", subcategory: "Pituitary", condition: "Prolactinoma" },
  { system: "ENDO", subcategory: "Pituitary", condition: "Diabetes Insipidus (Central)" },
  { system: "ENDO", subcategory: "Pituitary", condition: "Syndrome of Inappropriate ADH (SIADH)" },
  { system: "ENDO", subcategory: "Pituitary", condition: "Hypopituitarism" },

  // Calcium, Bone, and Metabolic
  { system: "ENDO", subcategory: "Calcium/Parathyroid", condition: "Primary Hyperparathyroidism", aliases: ["Hyperparathyroidism"] },
  { system: "ENDO", subcategory: "Calcium/Parathyroid", condition: "Secondary Hyperparathyroidism" },
  { system: "ENDO", subcategory: "Calcium/Parathyroid", condition: "Hypoparathyroidism", aliases: ["Low Parathyroid"] },
  { system: "ENDO", subcategory: "Calcium/Parathyroid", condition: "Hypercalcemia" },
  { system: "ENDO", subcategory: "Calcium/Parathyroid", condition: "Hypocalcemia" },
  { system: "ENDO", subcategory: "Metabolic/Bone", condition: "Osteoporosis (Endocrine Related)" },
  { system: "ENDO", subcategory: "Metabolic/Bone", condition: "Osteomalacia / Vitamin D Deficiency" },
  { system: "ENDO", subcategory: "Metabolic/Bone", condition: "Paget Disease of Bone (Endocrine)" },

  // Lipids & Metabolic Syndrome
  { system: "ENDO", subcategory: "Metabolic", condition: "Hyperlipidemia" },
  { system: "ENDO", subcategory: "Metabolic", condition: "Metabolic Syndrome" },
  { system: "ENDO", subcategory: "Metabolic", condition: "Obesity" },

  // Reproductive Endocrinology (ENDO side, not REPRO side)
  { system: "ENDO", subcategory: "Reproductive Endocrinology", condition: "Polycystic Ovary Syndrome (PCOS)" },
  { system: "ENDO", subcategory: "Reproductive Endocrinology", condition: "Amenorrhea — Endocrine Causes" },
  { system: "ENDO", subcategory: "Reproductive Endocrinology", condition: "Hypogonadism (Male)" },
  { system: "ENDO", subcategory: "Reproductive Endocrinology", condition: "Hypogonadism (Female)" },
  { system: "ENDO", subcategory: "Reproductive Endocrinology", condition: "Hirsutism" },

  // Pediatric Endocrine
  { system: "ENDO", subcategory: "Pediatrics", condition: "Congenital Hypothyroidism" },
  { system: "ENDO", subcategory: "Pediatrics", condition: "Delayed Puberty" },
  { system: "ENDO", subcategory: "Pediatrics", condition: "Precocious Puberty" },
  { system: "ENDO", subcategory: "Pediatrics", condition: "Growth Hormone Deficiency" },
  { system: "ENDO", subcategory: "Pediatrics", condition: "Turner Syndrome — Endocrine Manifestations" },

  // Endocrine Tumors (Non-Adrenal)
  { system: "ENDO", subcategory: "Endocrine Tumors", condition: "MEN Type 1" },
  { system: "ENDO", subcategory: "Endocrine Tumors", condition: "MEN Type 2A / 2B" },
  { system: "ENDO", subcategory: "Endocrine Tumors", condition: "Thyroid Medullary Carcinoma (MEN-related)" }
];

// -------------------------------------------
// INFECTIOUS DISEASES REGISTRY (ID)
// -------------------------------------------

export const CONDITION_REGISTRY_ID: ConditionMeta[] = [

  // Bacterial Infections
  { system: "ID", subcategory: "Bacterial", condition: "Cellulitis", aliases: ["Skin Infection"] },
  { system: "ID", subcategory: "Bacterial", condition: "Erysipelas" },
  { system: "ID", subcategory: "Bacterial", condition: "Impetigo", aliases: ["School Sores"] },
  { system: "ID", subcategory: "Bacterial", condition: "Folliculitis" },
  { system: "ID", subcategory: "Bacterial", condition: "Abscess (Skin and Soft Tissue)" },
  { system: "ID", subcategory: "Bacterial", condition: "Necrotizing Fasciitis" },
  { system: "ID", subcategory: "Bacterial", condition: "Sepsis / Septic Shock" },
  { system: "ID", subcategory: "Bacterial", condition: "Toxic Shock Syndrome" },

  // Respiratory Bacterial Infections
  { system: "ID", subcategory: "Respiratory", condition: "Community-Acquired Pneumonia" },
  { system: "ID", subcategory: "Respiratory", condition: "Hospital-Acquired Pneumonia" },
  { system: "ID", subcategory: "Respiratory", condition: "Tuberculosis (Active)" },
  { system: "ID", subcategory: "Respiratory", condition: "Latent Tuberculosis" },
  { system: "ID", subcategory: "Respiratory", condition: "Pertussis" },
  { system: "ID", subcategory: "Respiratory", condition: "Diphtheria" },
  { system: "ID", subcategory: "Respiratory", condition: "Epiglottitis (Infectious)" },

  // CNS Infections
  { system: "ID", subcategory: "CNS", condition: "Meningitis (Bacterial)" },
  { system: "ID", subcategory: "CNS", condition: "Viral Meningitis", aliases: ["Aseptic Meningitis"] },
  { system: "ID", subcategory: "CNS", condition: "Encephalitis", aliases: ["Brain Inflammation"] },
  { system: "ID", subcategory: "CNS", condition: "Brain Abscess" },

  // Tick-borne
  { system: "ID", subcategory: "Tick-Borne", condition: "Lyme Disease" },
  { system: "ID", subcategory: "Tick-Borne", condition: "Rocky Mountain Spotted Fever" },
  { system: "ID", subcategory: "Tick-Borne", condition: "Ehrlichiosis" },
  { system: "ID", subcategory: "Tick-Borne", condition: "Anaplasmosis" },
  { system: "ID", subcategory: "Tick-Borne", condition: "Babesiosis" },

  // Sexually Transmitted Infections
  { system: "ID", subcategory: "STI", condition: "Chlamydia" },
  { system: "ID", subcategory: "STI", condition: "Gonorrhea" },
  { system: "ID", subcategory: "STI", condition: "Trichomoniasis" },
  { system: "ID", subcategory: "STI", condition: "Syphilis", relatedSystems: ["NEURO", "DERM"] },
  { system: "ID", subcategory: "STI", condition: "HIV Infection / AIDS" },
  { system: "ID", subcategory: "STI", condition: "Pelvic Inflammatory Disease (PID)" },
  { system: "ID", subcategory: "STI", condition: "Chancroid" },
  { system: "ID", subcategory: "STI", condition: "Genital Herpes (HSV-2)" },
  { system: "ID", subcategory: "STI", condition: "HPV Infection / Genital Warts" },

  // Viral Infections
  { system: "ID", subcategory: "Viral", condition: "Influenza", aliases: ["Flu", "Seasonal Flu"] },
  { system: "ID", subcategory: "Viral", condition: "COVID-19", aliases: ["Coronavirus", "SARS-CoV-2"] },
  { system: "ID", subcategory: "Viral", condition: "Measles" },
  { system: "ID", subcategory: "Viral", condition: "Mumps" },
  { system: "ID", subcategory: "Viral", condition: "Rubella" },
  { system: "ID", subcategory: "Viral", condition: "Roseola" },
  { system: "ID", subcategory: "Viral", condition: "Varicella (Chickenpox)" },
  { system: "ID", subcategory: "Viral", condition: "Herpes Zoster (Shingles)", aliases: ["Shingles", "Zoster"] },
  { system: "ID", subcategory: "Viral", condition: "Rabies" },
  { system: "ID", subcategory: "Viral", condition: "Zika Virus" },
  { system: "ID", subcategory: "Viral", condition: "Ebola Virus" },

  // Parasitic
  { system: "ID", subcategory: "Parasitic", condition: "Malaria" },
  { system: "ID", subcategory: "Parasitic", condition: "Toxoplasmosis" },
  { system: "ID", subcategory: "Parasitic", condition: "Giardiasis" },
  { system: "ID", subcategory: "Parasitic", condition: "Amebiasis" },
  { system: "ID", subcategory: "Parasitic", condition: "Hookworm" },
  { system: "ID", subcategory: "Parasitic", condition: "Pinworm" },
  { system: "ID", subcategory: "Parasitic", condition: "Scabies (Parasitic)" },
  { system: "ID", subcategory: "Parasitic", condition: "Lice (Pediculosis)" },

  // Fungal
  { system: "ID", subcategory: "Fungal", condition: "Candidiasis" },
  { system: "ID", subcategory: "Fungal", condition: "Cryptococcosis" },
  { system: "ID", subcategory: "Fungal", condition: "Histoplasmosis" },
  { system: "ID", subcategory: "Fungal", condition: "Blastomycosis" },
  { system: "ID", subcategory: "Fungal", condition: "Coccidioidomycosis" },
  { system: "ID", subcategory: "Fungal", condition: "Aspergillosis" },
  { system: "ID", subcategory: "Fungal", condition: "Tinea Infections" },

  // Childhood Infectious Exanthems (Peds ID)
  { system: "ID", subcategory: "Pediatrics", condition: "Fifth Disease" },
  { system: "ID", subcategory: "Pediatrics", condition: "Scarlet Fever" },
  { system: "ID", subcategory: "Pediatrics", condition: "Hand-Foot-Mouth Disease" },

  // GI Infectious
  { system: "ID", subcategory: "Gastrointestinal", condition: "C. difficile Infection" },
  { system: "ID", subcategory: "Gastrointestinal", condition: "Salmonella" },
  { system: "ID", subcategory: "Gastrointestinal", condition: "Shigella" },
  { system: "ID", subcategory: "Gastrointestinal", condition: "Campylobacter" },
  { system: "ID", subcategory: "Gastrointestinal", condition: "Vibrio (Cholera / Parahemolyticus)" },
  { system: "ID", subcategory: "Gastrointestinal", condition: "Norovirus" },
  { system: "ID", subcategory: "Gastrointestinal", condition: "Rotavirus" },

  // Vector/Environmental
  { system: "ID", subcategory: "Environmental", condition: "Tetanus" },
  { system: "ID", subcategory: "Environmental", condition: "Botulism" },
  { system: "ID", subcategory: "Environmental", condition: "Anthrax" },
  { system: "ID", subcategory: "Environmental", condition: "Leptospirosis" },

  // Immunocompromised Hosts
  { system: "ID", subcategory: "Immunocompromised", condition: "Pneumocystis jirovecii Pneumonia (PCP)" },
  { system: "ID", subcategory: "Immunocompromised", condition: "Mycobacterium avium complex (MAC)" },
  { system: "ID", subcategory: "Immunocompromised", condition: "CMV Retinitis" },

  // Emergency ID
  { system: "ID", subcategory: "Emergency", condition: "Meningococcemia" },
  { system: "ID", subcategory: "Emergency", condition: "Epiglottitis" },
  { system: "ID", subcategory: "Emergency", condition: "Septic Shock" },
  // Zoonotic / Viral
  { system: "ID", subcategory: "Viral", condition: "Rabies" },
  { system: "ID", subcategory: "Viral", condition: "Zika Virus" },
  { system: "ID", subcategory: "Viral", condition: "Ebola Virus" },
];

// -------------------------------------------
// HEMATOLOGIC SYSTEM REGISTRY (HEME)
// -------------------------------------------

export const CONDITION_REGISTRY_HEME: ConditionMeta[] = [
  // Anemias – Production Problems
  { system: "HEME", subcategory: "Anemia", condition: "Iron Deficiency Anemia", aliases: ["IDA", "Iron Deficiency"] },
  { system: "HEME", subcategory: "Anemia", condition: "Anemia of Chronic Disease" },
  { system: "HEME", subcategory: "Anemia", condition: "Vitamin B12 Deficiency Anemia", aliases: ["B12 Deficiency", "Cobalamin Deficiency"] },
  { system: "HEME", subcategory: "Anemia", condition: "Folate Deficiency Anemia", aliases: ["Folic Acid Deficiency"] },
  { system: "HEME", subcategory: "Anemia", condition: "Aplastic Anemia", aliases: ["Bone Marrow Failure"] },
  { system: "HEME", subcategory: "Anemia", condition: "Lead Poisoning" },
  { system: "HEME", subcategory: "Anemia", condition: "Acute Blood Loss Anemia" },

  // Hemolytic Anemias / Hemoglobinopathies
  { system: "HEME", subcategory: "Hemolytic", condition: "Autoimmune Hemolytic Anemia" },
  { system: "HEME", subcategory: "Hemolytic", condition: "Hereditary Spherocytosis", aliases: ["HS"] },
  { system: "HEME", subcategory: "Hemolytic", condition: "G6PD Deficiency", aliases: ["Glucose-6-Phosphate Dehydrogenase Deficiency", "Favism"] },
  { system: "HEME", subcategory: "Hemoglobinopathy", condition: "Sickle Cell Disease", aliases: ["SCD", "Sickle Cell Anemia"] },
  { system: "HEME", subcategory: "Hemoglobinopathy", condition: "Sickle Cell Trait" },
  { system: "HEME", subcategory: "Hemoglobinopathy", condition: "Alpha Thalassemia" },
  { system: "HEME", subcategory: "Hemoglobinopathy", condition: "Beta Thalassemia" },

  // Polycythemia & Myeloproliferative Disorders
  { system: "HEME", subcategory: "Myeloproliferative", condition: "Polycythemia Vera", aliases: ["PV", "Primary Polycythemia"] },
  { system: "HEME", subcategory: "Myeloproliferative", condition: "Essential Thrombocythemia" },
  { system: "HEME", subcategory: "Myeloproliferative", condition: "Primary Myelofibrosis" },
  { system: "HEME", subcategory: "Myeloproliferative", condition: "Secondary Polycythemia" },

  // Platelet Disorders
  { system: "HEME", subcategory: "Platelet", condition: "Immune Thrombocytopenic Purpura (ITP)" },
  { system: "HEME", subcategory: "Platelet", condition: "Thrombotic Thrombocytopenic Purpura (TTP)" },
  { system: "HEME", subcategory: "Platelet", condition: "Hemolytic Uremic Syndrome (HUS)" },
  { system: "HEME", subcategory: "Platelet", condition: "Heparin-Induced Thrombocytopenia (HIT)" },
  { system: "HEME", subcategory: "Platelet", condition: "Drug-Induced Thrombocytopenia" },

  // Coagulation Disorders
  { system: "HEME", subcategory: "Coagulation", condition: "Hemophilia A" },
  { system: "HEME", subcategory: "Coagulation", condition: "Hemophilia B" },
  { system: "HEME", subcategory: "Coagulation", condition: "von Willebrand Disease" },
  { system: "HEME", subcategory: "Coagulation", condition: "Disseminated Intravascular Coagulation (DIC)" },
  { system: "HEME", subcategory: "Coagulation", condition: "Vitamin K Deficiency Coagulopathy" },
  { system: "HEME", subcategory: "Coagulation", condition: "Liver Disease Coagulopathy" },

  // Thrombophilia / Hypercoagulable States
  { system: "HEME", subcategory: "Thrombosis", condition: "Factor V Leiden Mutation" },
  { system: "HEME", subcategory: "Thrombosis", condition: "Prothrombin Gene Mutation" },
  { system: "HEME", subcategory: "Thrombosis", condition: "Protein C Deficiency" },
  { system: "HEME", subcategory: "Thrombosis", condition: "Protein S Deficiency" },
  { system: "HEME", subcategory: "Thrombosis", condition: "Antithrombin III Deficiency" },
  { system: "HEME", subcategory: "Thrombosis", condition: "Antiphospholipid Antibody Syndrome" },

  // Leukemias
  { system: "HEME", subcategory: "Leukemia", condition: "Acute Lymphoblastic Leukemia (ALL)" },
  { system: "HEME", subcategory: "Leukemia", condition: "Acute Myeloid Leukemia (AML)" },
  { system: "HEME", subcategory: "Leukemia", condition: "Chronic Lymphocytic Leukemia (CLL)" },
  { system: "HEME", subcategory: "Leukemia", condition: "Chronic Myelogenous Leukemia (CML)" },
  { system: "HEME", subcategory: "Leukemia", condition: "Myelodysplastic Syndromes (MDS)" },

  // Lymphomas
  { system: "HEME", subcategory: "Lymphoma", condition: "Hodgkin Lymphoma" },
  { system: "HEME", subcategory: "Lymphoma", condition: "Non-Hodgkin Lymphoma" },
  { system: "HEME", subcategory: "Lymphoma", condition: "Burkitt Lymphoma" },
  { system: "HEME", subcategory: "Lymphoma", condition: "Mantle Cell Lymphoma" },

  // Plasma Cell Dyscrasias
  { system: "HEME", subcategory: "Plasma Cell", condition: "Multiple Myeloma" },
  { system: "HEME", subcategory: "Plasma Cell", condition: "Monoclonal Gammopathy of Undetermined Significance (MGUS)" },
  { system: "HEME", subcategory: "Plasma Cell", condition: "Waldenström Macroglobulinemia" },

  // Other Hematologic Conditions
  { system: "HEME", subcategory: "Other", condition: "Neutropenia" },
  { system: "HEME", subcategory: "Other", condition: "Febrile Neutropenia" },
  { system: "HEME", subcategory: "Other", condition: "Disorders of Spleen (Hypersplenism)" },

  // Transfusion-related
  { system: "HEME", subcategory: "Transfusion", condition: "Acute Hemolytic Transfusion Reaction" },
  { system: "HEME", subcategory: "Transfusion", condition: "Delayed Hemolytic Transfusion Reaction" },
  { system: "HEME", subcategory: "Transfusion", condition: "Febrile Non-Hemolytic Transfusion Reaction" },
  { system: "HEME", subcategory: "Transfusion", condition: "Transfusion-Related Acute Lung Injury (TRALI)" },
  { system: "HEME", subcategory: "Transfusion", condition: "Transfusion-Associated Circulatory Overload (TACO)" },

  // Pediatric Hematology (kept under HEME, not a separate PEDS system)
  { system: "HEME", subcategory: "Pediatrics", condition: "Sickle Cell Pain Crisis (Pediatric)" },
  { system: "HEME", subcategory: "Pediatrics", condition: "Beta Thalassemia Major (Pediatric)" },
  { system: "HEME", subcategory: "Pediatrics", condition: "Physiologic Anemia of Infancy" },
  // Other
  { system: "HEME", subcategory: "Overload", condition: "Hemochromatosis" },
  { system: "HEME", subcategory: "Transfusion", condition: "Transfusion Reactions" },
];

// -------------------------------------------
// NEUROLOGIC SYSTEM REGISTRY (NEURO)
// -------------------------------------------

export const CONDITION_REGISTRY_NEURO: ConditionMeta[] = [
  // Headache Disorders
  { system: "NEURO", subcategory: "Headache", condition: "Tension Headache" },
  { system: "NEURO", subcategory: "Headache", condition: "Migraine Headache" },
  { system: "NEURO", subcategory: "Headache", condition: "Cluster Headache", aliases: ["Histamine Headache"] },
  { system: "NEURO", subcategory: "Headache", condition: "Medication Overuse (Rebound) Headache" },
  { system: "NEURO", subcategory: "Headache", condition: "Idiopathic Intracranial Hypertension (Pseudotumor Cerebri)" },
  { system: "NEURO", subcategory: "Headache", condition: "Temporal (Giant Cell) Arteritis – Neurologic Manifestations" },

  // Cerebrovascular Disease
  { system: "NEURO", subcategory: "Cerebrovascular", condition: "Transient Ischemic Attack (TIA)" },
  { system: "NEURO", subcategory: "Cerebrovascular", condition: "Ischemic Stroke", aliases: ["CVA", "Cerebrovascular Accident"] },
  { system: "NEURO", subcategory: "Cerebrovascular", condition: "Intracerebral Hemorrhage" },
  { system: "NEURO", subcategory: "Cerebrovascular", condition: "Subarachnoid Hemorrhage", aliases: ["SAH"] },
  { system: "NEURO", subcategory: "Cerebrovascular", condition: "Cerebral Venous Sinus Thrombosis" },

  // Seizure Disorders
  { system: "NEURO", subcategory: "Seizure", condition: "Focal (Partial) Seizure" },
  { system: "NEURO", subcategory: "Seizure", condition: "Generalized Tonic-Clonic Seizure" },
  { system: "NEURO", subcategory: "Seizure", condition: "Absence Seizure" },
  { system: "NEURO", subcategory: "Seizure", condition: "Status Epilepticus" },
  { system: "NEURO", subcategory: "Seizure", condition: "Febrile Seizures (Pediatric)" },

  // Demyelinating Disease
  { system: "NEURO", subcategory: "Demyelinating", condition: "Multiple Sclerosis", aliases: ["MS"] },
  { system: "NEURO", subcategory: "Demyelinating", condition: "Acute Disseminated Encephalomyelitis (ADEM)" },

  // Neuromuscular Junction & Motor Neuron
  { system: "NEURO", subcategory: "Neuromuscular Junction", condition: "Myasthenia Gravis" },
  { system: "NEURO", subcategory: "Neuromuscular Junction", condition: "Lambert-Eaton Myasthenic Syndrome" },
  { system: "NEURO", subcategory: "Motor Neuron", condition: "Amyotrophic Lateral Sclerosis (ALS)", aliases: ["ALS", "Lou Gehrig's Disease"] },

  // Neuromuscular & Peripheral Nerve
  { system: "NEURO", subcategory: "Peripheral Neuropathy", condition: "Peripheral Polyneuropathy" },
  { system: "NEURO", subcategory: "Peripheral Neuropathy", condition: "Diabetic Peripheral Neuropathy – Neurologic Manifestations" },
  { system: "NEURO", subcategory: "Peripheral Neuropathy", condition: "Carpal Tunnel Syndrome" },
  { system: "NEURO", subcategory: "Peripheral Neuropathy", condition: "Ulnar Neuropathy" },
  { system: "NEURO", subcategory: "Peripheral Neuropathy", condition: "Meralgia Paresthetica" },
  { system: "NEURO", subcategory: "Peripheral Neuropathy", condition: "Bell Palsy (Idiopathic Facial Nerve Palsy)" },
  { system: "NEURO", subcategory: "Peripheral Neuropathy", condition: "Trigeminal Neuralgia", aliases: ["Tic Douloureux"] },
  { system: "NEURO", subcategory: "Neuromuscular", condition: "Guillain-Barré Syndrome" },
  { system: "NEURO", subcategory: "Neuromuscular", condition: "Chronic Inflammatory Demyelinating Polyneuropathy (CIDP)" },
  { system: "NEURO", subcategory: "Neuromuscular", condition: "Muscular Dystrophy (Duchenne/Becker)" },

  // Movement Disorders
  { system: "NEURO", subcategory: "Movement Disorder", condition: "Parkinson Disease", aliases: ["Parkinson's Disease", "PD"] },
  { system: "NEURO", subcategory: "Movement Disorder", condition: "Essential Tremor" },
  { system: "NEURO", subcategory: "Movement Disorder", condition: "Huntington Disease" },
  { system: "NEURO", subcategory: "Movement Disorder", condition: "Restless Legs Syndrome" },
  { system: "NEURO", subcategory: "Movement Disorder", condition: "Tourette Syndrome" },

  // Spine & Radiculopathy
  { system: "NEURO", subcategory: "Spine", condition: "Cervical Radiculopathy" },
  { system: "NEURO", subcategory: "Spine", condition: "Lumbar Radiculopathy (Sciatica)" },
  { system: "NEURO", subcategory: "Spine", condition: "Cauda Equina Syndrome" },
  { system: "NEURO", subcategory: "Spine", condition: "Spinal Cord Compression" },
  { system: "NEURO", subcategory: "Spine", condition: "Cervical Spondylotic Myelopathy" },
  { system: "NEURO", subcategory: "Spine", condition: "Spinal Stenosis – Neurologic Manifestations" },

  // Neurologic Infections
  { system: "NEURO", subcategory: "Infectious", condition: "Bacterial Meningitis" },
  { system: "NEURO", subcategory: "Infectious", condition: "Viral Meningitis" },
  { system: "NEURO", subcategory: "Infectious", condition: "Encephalitis" },
  { system: "NEURO", subcategory: "Infectious", condition: "Brain Abscess" },

  // Trauma & ICP
  { system: "NEURO", subcategory: "Trauma", condition: "Concussion (Mild Traumatic Brain Injury)" },
  { system: "NEURO", subcategory: "Trauma", condition: "Diffuse Axonal Injury" },
  { system: "NEURO", subcategory: "Trauma", condition: "Epidural Hematoma", aliases: ["EDH"] },
  { system: "NEURO", subcategory: "Trauma", condition: "Subdural Hematoma", aliases: ["SDH"] },
  { system: "NEURO", subcategory: "Trauma", condition: "Increased Intracranial Pressure" },

  // Neurodegenerative / Cognitive
  { system: "NEURO", subcategory: "Neurodegenerative", condition: "Alzheimer Disease", aliases: ["Alzheimer's Disease", "AD"] },
  { system: "NEURO", subcategory: "Neurodegenerative", condition: "Vascular Dementia" },
  { system: "NEURO", subcategory: "Neurodegenerative", condition: "Lewy Body Dementia" },
  { system: "NEURO", subcategory: "Neurodegenerative", condition: "Frontotemporal Dementia" },

  // Pediatric Neurology
  { system: "NEURO", subcategory: "Pediatrics", condition: "Cerebral Palsy" },
  { system: "NEURO", subcategory: "Pediatrics", condition: "Neural Tube Defects (Spina Bifida, Anencephaly)" },
  { system: "NEURO", subcategory: "Pediatrics", condition: "Hydrocephalus (Pediatric)" },

  // Other Neurologic
  { system: "NEURO", subcategory: "Other", condition: "Syncope" },
  // Pain / Other
  { system: "NEURO", subcategory: "Pain", condition: "Complex Regional Pain Syndrome (CRPS)" },
  { system: "NEURO", subcategory: "Pediatrics", condition: "Cerebral Palsy" },
];

// -------------------------------------------
// DERMATOLOGIC SYSTEM REGISTRY (DERM)
// -------------------------------------------

export const CONDITION_REGISTRY_DERM: ConditionMeta[] = [
  // Acneiform Disorders
  { system: "DERM", subcategory: "Acneiform", condition: "Acne Vulgaris", aliases: ["Acne", "Pimples"] },
  { system: "DERM", subcategory: "Acneiform", condition: "Rosacea", aliases: ["Acne Rosacea"] },

  // Bullous Disorders
  { system: "DERM", subcategory: "Bullous", condition: "Bullous Pemphigoid" },
  { system: "DERM", subcategory: "Bullous", condition: "Pemphigus Vulgaris" },

  // Benign Skin Lesions
  { system: "DERM", subcategory: "Benign Lesions", condition: "Lipoma" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Epidermal Inclusion Cyst" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Seborrheic Keratosis" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Cherry Angioma / Hemangioma" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Strawberry Hemangioma (Infantile Hemangioma)" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Acrochordon (Skin Tag)" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Dermatofibroma" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Solar Purpura" },
   { system: "DERM", subcategory: "Benign Lesions", condition: "Common Melanocytic Nevus" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Atypical (Dysplastic) Nevus" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Congenital Nevus" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Port-Wine Stain", aliases: ["Capillary Malformation", "Nevus Flammeus"] },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Telangiectasia" },

  // Pigmentation & Rashes (Papulosquamous / Pigment)
  { system: "DERM", subcategory: "Papulosquamous", condition: "Plaque Psoriasis" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Guttate Psoriasis" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Pustular Psoriasis" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Erythrodermic Psoriasis" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Pityriasis Rosea" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Lichen Planus" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Lichen Simplex Chronicus" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Dermatitis Herpetiformis" },
  { system: "DERM", subcategory: "Connective Tissue / Lupus", condition: "Acute Cutaneous Lupus Erythematosus" },
  { system: "DERM", subcategory: "Connective Tissue / Lupus", condition: "Subacute Cutaneous Lupus Erythematosus" },
  { system: "DERM", subcategory: "Connective Tissue / Lupus", condition: "Discoid Lupus Erythematosus" },
  { system: "DERM", subcategory: "Papulosquamous", condition: "Granuloma Annulare" },

  // Pigmentary Disorders
  { system: "DERM", subcategory: "Pigmentary", condition: "Melasma" },
  { system: "DERM", subcategory: "Pigmentary", condition: "Vitiligo" },
  { system: "DERM", subcategory: "Pigmentary", condition: "Post-Inflammatory Hyperpigmentation / Hypopigmentation" },
  { system: "DERM", subcategory: "Pigmentary", condition: "Acanthosis Nigricans" },

  // Dermatitis & Eczema (DDD core)
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Atopic Dermatitis", aliases: ["Eczema", "Atopic Eczema"] },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Contact Dermatitis (Irritant/Allergic)", aliases: ["Contact Dermatitis", "Allergic Contact Dermatitis"] },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Nummular Dermatitis" },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Seborrheic Dermatitis", aliases: ["Dandruff", "Cradle Cap"] },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Dyshidrotic Eczema (Pompholyx)" },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Perioral Dermatitis" },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Diaper Dermatitis" },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Prurigo Nodularis" },
  { system: "DERM", subcategory: "Dermatitis & Eczema", condition: "Hidradenitis Suppurativa" },

  // Urticaria, Angioedema, and Reactive Skin Disorders
  { system: "DERM", subcategory: "Reactive / Hypersensitivity", condition: "Urticaria", aliases: ["Hives", "Wheals"] },
  { system: "DERM", subcategory: "Reactive / Hypersensitivity", condition: "Angioedema" },
  { system: "DERM", subcategory: "Reactive / Hypersensitivity", condition: "Erythema Multiforme" },
  { system: "DERM", subcategory: "Reactive / Hypersensitivity", condition: "Erythema Nodosum" },
  { system: "DERM", subcategory: "Reactive / Hypersensitivity", condition: "Acute Generalized Exanthematous Pustulosis (AGEP)" },
  { system: "DERM", subcategory: "Reactive / Hypersensitivity", condition: "Henoch-Schönlein Purpura (IgA Vasculitis) – Cutaneous Findings" },

  // Drug Eruptions & SCARs
  { system: "DERM", subcategory: "Drug Eruptions & SCARs", condition: "Simple Exanthematous Drug Eruption" },
  { system: "DERM", subcategory: "Drug Eruptions & SCARs", condition: "Urticarial Drug Eruption" },
  { system: "DERM", subcategory: "Drug Eruptions & SCARs", condition: "Lichenoid Drug Eruption" },
  { system: "DERM", subcategory: "Drug Eruptions & SCARs", condition: "Erythroderma (Exfoliative Dermatitis)" },
  { system: "DERM", subcategory: "Drug Eruptions & SCARs", condition: "Stevens-Johnson Syndrome (SJS)", aliases: ["SJS"] },
  { system: "DERM", subcategory: "Drug Eruptions & SCARs", condition: "Toxic Epidermal Necrolysis (TEN)", aliases: ["TEN", "Lyell Syndrome"] },
  { system: "DERM", subcategory: "Drug Eruptions & SCARs", condition: "Drug Reaction with Eosinophilia and Systemic Symptoms (DRESS/DIHS)" },


  { system: "DERM", subcategory: "Infectious", condition: "Abscess" },
  { system: "DERM", subcategory: "Infectious", condition: "Cellulitis" },
  { system: "DERM", subcategory: "Infectious", condition: "Erysipelas" },
  { system: "DERM", subcategory: "Infectious", condition: "Folliculitis" },
  { system: "DERM", subcategory: "Infectious", condition: "Impetigo" },
  { system: "DERM", subcategory: "Infectious", condition: "Herpes Zoster (Shingles)" },
  { system: "DERM", subcategory: "Infectious", condition: "Varicella (Chickenpox)" },
  { system: "DERM", subcategory: "Infectious", condition: "Tinea Corporis (Ringworm)" },
  { system: "DERM", subcategory: "Infectious", condition: "Tinea Pedis (Athlete's Foot)" },
  { system: "DERM", subcategory: "Infectious", condition: "Tinea Versicolor" },
  { system: "DERM", subcategory: "Infectious", condition: "Scabies" },
  { system: "DERM", subcategory: "Infectious", condition: "Lice (Pediculosis)" },
  { system: "DERM", subcategory: "Infectious", condition: "Molluscum Contagiosum" },
  { system: "DERM", subcategory: "Infectious", condition: "Verruca Vulgaris (Warts)" },
  { system: "DERM", subcategory: "Infectious", condition: "Condyloma Acuminatum (Genital Warts)" },

  // Hair & Nail Disorders
  { system: "DERM", subcategory: "Hair Disorders", condition: "Alopecia Areata" },
  { system: "DERM", subcategory: "Hair Disorders", condition: "Androgenetic Alopecia" },
  { system: "DERM", subcategory: "Hair Disorders", condition: "Hirsutism" },
  { system: "DERM", subcategory: "Nail Disorders", condition: "Onychomycosis" },

  { system: "DERM", subcategory: "Nail Disorders", condition: "Paronychia" },
  // Trauma / Environmental
  { system: "DERM", subcategory: "Trauma", condition: "Burns" },
  { system: "DERM", subcategory: "Trauma", condition: "Pressure Ulcers" },
  { system: "DERM", subcategory: "Environmental", condition: "Spider Bites (Brown Recluse / Black Widow)" },
  
  // Other
  { system: "DERM", subcategory: "Vascular", condition: "Stasis Dermatitis" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Seborrheic Keratosis" },
  { system: "DERM", subcategory: "Pigmentary", condition: "Acanthosis Nigricans" },
  { system: "DERM", subcategory: "Inflammatory", condition: "Hidradenitis Suppurativa" },
  { system: "DERM", subcategory: "Benign Lesions", condition: "Epithelial Inclusion Cyst" },
];

// -------------------------------------------
// RENAL SYSTEM REGISTRY (RENAL)
// -------------------------------------------

export const CONDITION_REGISTRY_RENAL: ConditionMeta[] = [
  // Acute Kidney Injury (AKI) - Consolidated with parent-child structure
  { 
    system: "RENAL", 
    subcategory: "AKI", 
    condition: "Acute Kidney Injury", 
    aliases: ["AKI", "Acute Renal Failure", "ARF"],
    overview: "Parent condition with multiple subtypes (Prerenal, Intrinsic, Postrenal)"
  },
  // Note: Prerenal, Intrinsic, Postrenal are variants that should be tabs/sections within the main AKI page
  { system: "RENAL", subcategory: "AKI", condition: "Acute Tubular Necrosis", aliases: ["ATN"] },
  { system: "RENAL", subcategory: "AKI", condition: "Acute Interstitial Nephritis", aliases: ["AIN"] },
  { system: "RENAL", subcategory: "AKI", condition: "Acute Glomerulonephritis", aliases: ["AGN"] }

  ,
  // Chronic Kidney Disease
  { system: "RENAL", subcategory: "CKD", condition: "Chronic Kidney Disease", aliases: ["CKD", "Chronic Renal Failure"] },
  { system: "RENAL", subcategory: "CKD", condition: "End-Stage Renal Disease" },
  { system: "RENAL", subcategory: "CKD", condition: "Hypertensive Nephrosclerosis" },
  { system: "RENAL", subcategory: "CKD", condition: "Diabetic Nephropathy" },

  // Glomerular Disorders
  { system: "RENAL", subcategory: "Glomerular", condition: "Nephritic Syndrome" },
  { system: "RENAL", subcategory: "Glomerular", condition: "Nephrotic Syndrome" },
  { system: "RENAL", subcategory: "Glomerular", condition: "IgA Nephropathy" },
  { system: "RENAL", subcategory: "Glomerular", condition: "Post-Streptococcal Glomerulonephritis" },
  { system: "RENAL", subcategory: "Glomerular", condition: "Anti-GBM Disease (Goodpasture)" },
  { system: "RENAL", subcategory: "Glomerular", condition: "Membranous Nephropathy" },
  { system: "RENAL", subcategory: "Glomerular", condition: "Minimal Change Disease" },
  { system: "RENAL", subcategory: "Glomerular", condition: "Focal Segmental Glomerulosclerosis (FSGS)" },

  // Tubulointerstitial
  { system: "RENAL", subcategory: "Tubulointerstitial", condition: "Acute Interstitial Nephritis" },
  { system: "RENAL", subcategory: "Tubulointerstitial", condition: "Chronic Interstitial Nephritis" },
  { system: "RENAL", subcategory: "Tubulointerstitial", condition: "Papillary Necrosis" },
  { system: "RENAL", subcategory: "Tubulointerstitial", condition: "Analgesic Nephropathy" },

  // Renal Vascular
  { system: "RENAL", subcategory: "Infectious", condition: "Pyelonephritis" },
  { system: "RENAL", subcategory: "Vascular", condition: "Renal Artery Stenosis" },
  { system: "RENAL", subcategory: "Vascular", condition: "Renal Vein Thrombosis" },
  { system: "RENAL", subcategory: "Vascular", condition: "Hypertensive Emergency with Renal Injury" },
  { system: "RENAL", subcategory: "Vascular", condition: "Thrombotic Microangiopathy (HUS/TTP) – Renal Manifestations" },

  // Infectious Renal
  { system: "RENAL", subcategory: "Infectious", condition: "Acute Pyelonephritis" },
  { system: "RENAL", subcategory: "Infectious", condition: "Chronic Pyelonephritis" },
  { system: "RENAL", subcategory: "Infectious", condition: "Renal Abscess" },
  { system: "RENAL", subcategory: "Infectious", condition: "Xanthogranulomatous Pyelonephritis" },

  // Nephrolithiasis / Urolithiasis (renal portion only)
  { system: "RENAL", subcategory: "Stones", condition: "Calcium Oxalate Stones" },
  { system: "RENAL", subcategory: "Stones", condition: "Uric Acid Stones" },
  { system: "RENAL", subcategory: "Stones", condition: "Struvite Stones" },
  { system: "RENAL", subcategory: "Stones", condition: "Cystine Stones" },
  { system: "RENAL", subcategory: "Stones", condition: "Nephrolithiasis (General Evaluation)" },

  // Cystic & Congenital Renal Diseases
  // Polycystic Kidney Disease - Parent condition with variants
  { 
    system: "RENAL", 
    subcategory: "Congenital", 
    condition: "Polycystic Kidney Disease", 
    aliases: ["PKD"],
    overview: "Parent condition with Autosomal Dominant (ADPKD) and Autosomal Recessive (ARPKD) variants"
  },
  { system: "RENAL", subcategory: "Congenital", condition: "Medullary Sponge Kidney" },
  { system: "RENAL", subcategory: "Congenital", condition: "Horseshoe Kidney" },

  // Acid–Base Disorders (renal-mediated)
  { system: "RENAL", subcategory: "Acid-Base", condition: "Metabolic Acidosis (Renal Causes)" },
  { system: "RENAL", subcategory: "Acid-Base", condition: "Metabolic Alkalosis (Renal Causes)" },
  { system: "RENAL", subcategory: "Acid-Base", condition: "Renal Tubular Acidosis Type I (Distal)" },
  { system: "RENAL", subcategory: "Acid-Base", condition: "Renal Tubular Acidosis Type II (Proximal)" },
  { system: "RENAL", subcategory: "Acid-Base", condition: "Renal Tubular Acidosis Type IV (Hyperkalemic)" },

  // Electrolytes (renal-mediated)
  { system: "RENAL", subcategory: "Electrolytes", condition: "Hyperkalemia (Renal Causes)" },
  { system: "RENAL", subcategory: "Electrolytes", condition: "Hypokalemia (Renal Causes)" },
  { system: "RENAL", subcategory: "Electrolytes", condition: "Hypernatremia (Renal Causes)" },
  { system: "RENAL", subcategory: "Electrolytes", condition: "Hyponatremia (Renal Causes)" },
  { system: "RENAL", subcategory: "Electrolytes", condition: "Hyperphosphatemia (CKD)" },
  { system: "RENAL", subcategory: "Electrolytes", condition: "Hypophosphatemia (Renal Loss)" },

  // Oncology (RENAL portion)
  { system: "RENAL", subcategory: "Oncology", condition: "Renal Cell Carcinoma", aliases: ["RCC", "Kidney Cancer"] },
  { system: "RENAL", subcategory: "Oncology", condition: "Wilms Tumor (Nephroblastoma)" },
  { system: "RENAL", subcategory: "Oncology", condition: "Oncocytoma" },
  { system: "RENAL", subcategory: "Oncology", condition: "Angiomyolipoma" },

  // Trauma / Emergency
  { system: "RENAL", subcategory: "Emergency", condition: "Rhabdomyolysis – Renal Complications" },
  { system: "RENAL", subcategory: "Emergency", condition: "Post-Obstructive Diuresis" },
  { system: "RENAL", subcategory: "Emergency", condition: "Acute Kidney Injury in Shock States" },

  // Pediatrics in Renal
  { system: "RENAL", subcategory: "Pediatrics", condition: "Hemolytic Uremic Syndrome (Pediatric Primary)" },
  { system: "RENAL", subcategory: "Pediatrics", condition: "Minimal Change Disease (Pediatric Predominant)" },
  // Oncology
  { system: "RENAL", subcategory: "Oncology", condition: "Renal Cell Carcinoma" },
  { system: "RENAL", subcategory: "Oncology", condition: "Wilms Tumor" },
];

// -------------------------------------------
// GENITOURINARY SYSTEM REGISTRY (GU)
// -------------------------------------------

export const CONDITION_REGISTRY_GU: ConditionMeta[] = [

  // PROSTATE
  { system: "GU", subcategory: "Prostate", condition: "Benign Prostatic Hyperplasia (BPH)" },
  { system: "GU", subcategory: "Prostate", condition: "Acute Prostatitis", aliases: ["Prostatitis"] },
  { system: "GU", subcategory: "Prostate", condition: "Chronic Prostatitis" },
  { system: "GU", subcategory: "Prostate", condition: "Prostate Cancer" },

  // TESTICULAR / SCROTAL
  { system: "GU", subcategory: "Testicular", condition: "Testicular Torsion", aliases: ["Torsion of Testis"] },
  { system: "GU", subcategory: "Testicular", condition: "Torsion of Appendix Testis" },
  { system: "GU", subcategory: "Testicular", condition: "Epididymitis", aliases: ["Epididymal Infection"] },
  { system: "GU", subcategory: "Testicular", condition: "Orchitis" },
  { system: "GU", subcategory: "Testicular", condition: "Hydrocele", aliases: ["Scrotal Swelling"] },
  { system: "GU", subcategory: "Testicular", condition: "Varicocele", aliases: ["Scrotal Varicose Veins"] },
  { system: "GU", subcategory: "Testicular", condition: "Spermatocele" },
  { system: "GU", subcategory: "Testicular", condition: "Testicular Cancer" },

  // PENILE
  { system: "GU", subcategory: "Penile", condition: "Phimosis" },
  { system: "GU", subcategory: "Penile", condition: "Paraphimosis" },
  { system: "GU", subcategory: "Penile", condition: "Priapism" },
  { system: "GU", subcategory: "Penile", condition: "Peyronie Disease" },
  { system: "GU", subcategory: "Penile", condition: "Penile Cancer" },

  // BLADDER
  { system: "GU", subcategory: "Bladder", condition: "Acute Cystitis" },
  { system: "GU", subcategory: "Bladder", condition: "Hemorrhagic Cystitis" },
  { system: "GU", subcategory: "Bladder", condition: "Interstitial Cystitis" },
  { system: "GU", subcategory: "Bladder", condition: "Bladder Cancer" },
  { system: "GU", subcategory: "Bladder", condition: "Neurogenic Bladder" },

  // URETHRA
  { system: "GU", subcategory: "Urethra", condition: "Urethritis (General)" },
  { system: "GU", subcategory: "Urethra", condition: "Gonococcal Urethritis" },
  { system: "GU", subcategory: "Urethra", condition: "Nongonococcal Urethritis (Chlamydia)" },
  { system: "GU", subcategory: "Urethra", condition: "Urethral Stricture" },

  // INFECTIOUS GU (non-renal)
  { system: "GU", subcategory: "Infectious", condition: "Epididymo-Orchitis" },
  { system: "GU", subcategory: "Infectious", condition: "Prostatitis (Acute and Chronic)" },
  { system: "GU", subcategory: "Infectious", condition: "Urethritis (STI Related)" },

  // INCONTINENCE & PELVIC FLOOR
  { system: "GU", subcategory: "Incontinence", condition: "Stress Incontinence" },
  { system: "GU", subcategory: "Incontinence", condition: "Urge Incontinence" },
  { system: "GU", subcategory: "Incontinence", condition: "Overflow Incontinence" },
  { system: "GU", subcategory: "Incontinence", condition: "Mixed Incontinence" },
  { system: "GU", subcategory: "Pelvic Floor", condition: "Pelvic Organ Prolapse (Cystocele/Rectocele)" },
  { system: "GU", subcategory: "Pelvic Floor", condition: "Pelvic Floor Dysfunction" },

  // FEMALE GU (NON-REPRODUCTIVE)
  // (Repro = uterus/ovaries/pregnancy — this section is ONLY urethra/bladder/pelvic floor)
  { system: "GU", subcategory: "Female-GU", condition: "Urethral Diverticulum" },
  { system: "GU", subcategory: "Female-GU", condition: "Urethral Prolapse" },
  { system: "GU", subcategory: "Female-GU", condition: "Bladder Pain Syndrome" },

  // ONCOLOGY – GU
  { system: "GU", subcategory: "Oncology", condition: "Bladder Cancer" },
  { system: "GU", subcategory: "Oncology", condition: "Prostate Cancer" },
  { system: "GU", subcategory: "Oncology", condition: "Testicular Cancer" },
  { system: "GU", subcategory: "Oncology", condition: "Penile Cancer" },

  // TRAUMA
  { system: "GU", subcategory: "Trauma", condition: "Urethral Injury" },
  { system: "GU", subcategory: "Trauma", condition: "Bladder Rupture" },
  { system: "GU", subcategory: "Trauma", condition: "Testicular Trauma" },
  // Male GU
  { system: "GU", subcategory: "Pediatrics", condition: "Cryptorchidism" },
  { system: "GU", subcategory: "Male Reproductive", condition: "Erectile Dysfunction" },
  { system: "GU", subcategory: "Testicular", condition: "Hydrocele" },
  { system: "GU", subcategory: "Testicular", condition: "Varicocele" },
];

// -------------------------------------------
// REPRODUCTIVE SYSTEM REGISTRY (REPRO)
// -------------------------------------------

export const CONDITION_REGISTRY_REPRO: ConditionMeta[] = [

  // MENSTRUAL & CYCLE DISORDERS
  { system: "REPRO", subcategory: "Menstrual Disorders", condition: "Primary Amenorrhea" },
  { system: "REPRO", subcategory: "Menstrual Disorders", condition: "Secondary Amenorrhea" },
  { system: "REPRO", subcategory: "Menstrual Disorders", condition: "Oligomenorrhea" },
  { system: "REPRO", subcategory: "Menstrual Disorders", condition: "Polymenorrhea" },
  { system: "REPRO", subcategory: "Menstrual Disorders", condition: "Dysmenorrhea" },
  { system: "REPRO", subcategory: "Abnormal Uterine Bleeding", condition: "Abnormal Uterine Bleeding (AUB)" },
  { system: "REPRO", subcategory: "Menstrual Disorders", condition: "Premenstrual Syndrome (PMS)" },
  { system: "REPRO", subcategory: "Menstrual Disorders", condition: "Premenstrual Dysphoric Disorder (PMDD)" },

  // GYNECOLOGY – UTERUS / OVARIES / PELVIS
  { system: "REPRO", subcategory: "Gynecology", condition: "Endometriosis", aliases: ["Endo"] },
  { system: "REPRO", subcategory: "Gynecology", condition: "Adenomyosis" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Uterine Leiomyomas (Fibroids)" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Chronic Pelvic Pain" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Tubo-Ovarian Abscess" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Acute Pelvic Pain – Ovarian Torsion" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Functional Ovarian Cysts" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Polycystic Ovary Syndrome (PCOS)" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Pelvic Inflammatory Disease (PID)" },

  // VULVAR / VAGINAL DISORDERS
  { system: "REPRO", subcategory: "Vulvar Disorders", condition: "Lichen Sclerosus" },
  { system: "REPRO", subcategory: "Vulvar Disorders", condition: "Lichen Simplex Chronicus (Vulvar)" },
  { system: "REPRO", subcategory: "Vulvar Disorders", condition: "Vulvodynia" },
  { system: "REPRO", subcategory: "Vaginal Disorders", condition: "Vulvovaginal Candidiasis" },
  { system: "REPRO", subcategory: "Vaginal Disorders", condition: "Bacterial Vaginosis" },
  { system: "REPRO", subcategory: "Vaginal Disorders", condition: "Trichomoniasis" },
  { system: "REPRO", subcategory: "Cervix / STI", condition: "Chlamydial Cervicitis" },
  { system: "REPRO", subcategory: "Cervix / STI", condition: "Gonococcal Cervicitis" },
  { system: "REPRO", subcategory: "Cervix / STI", condition: "Human Papillomavirus (HPV) – Genital Warts" },
  { system: "REPRO", subcategory: "Cervix / STI", condition: "Cervical Dysplasia (LSIL/HSIL)" },

  // INFERTILITY & REPRODUCTIVE ENDOCRINE
  { system: "REPRO", subcategory: "Infertility", condition: "Female Infertility – Anovulation" },
  { system: "REPRO", subcategory: "Infertility", condition: "Female Infertility – Tubal Factor" },
  { system: "REPRO", subcategory: "Infertility", condition: "Male Factor Infertility" },
  { system: "REPRO", subcategory: "Reproductive Endocrine", condition: "Hyperprolactinemia (Reproductive Effects)" },
  { system: "REPRO", subcategory: "Reproductive Endocrine", condition: "Premature Ovarian Insufficiency" },

  // MALE REPRODUCTIVE (FUNCTIONAL / SEXUAL)
  { system: "REPRO", subcategory: "Male Reproductive", condition: "Erectile Dysfunction" },
  { system: "REPRO", subcategory: "Male Reproductive", condition: "Male Hypogonadism (Reproductive Impact)" },
  { system: "REPRO", subcategory: "Male Reproductive", condition: "Male Infertility (Sperm Abnormalities)" },

  // EARLY PREGNANCY
  { system: "REPRO", subcategory: "Early Pregnancy", condition: "Ectopic Pregnancy", aliases: ["Tubal Pregnancy"] },
  { system: "REPRO", subcategory: "Early Pregnancy", condition: "Threatened Abortion" },
  { system: "REPRO", subcategory: "Early Pregnancy", condition: "Inevitable / Incomplete / Complete Abortion" },
  { system: "REPRO", subcategory: "Early Pregnancy", condition: "Missed Abortion" },
  { system: "REPRO", subcategory: "Early Pregnancy", condition: "Gestational Trophoblastic Disease (Molar Pregnancy)" },

  // ANTEPARTUM – MATERNAL CONDITIONS
  { system: "REPRO", subcategory: "Antepartum", condition: "Gestational Diabetes Mellitus" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Chronic Hypertension in Pregnancy" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Gestational Hypertension" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Preeclampsia", aliases: ["Toxemia", "Pregnancy-Induced Hypertension"] },
  { system: "REPRO", subcategory: "Antepartum", condition: "Severe Preeclampsia" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Eclampsia", aliases: ["Seizures in Pregnancy"] },
  { system: "REPRO", subcategory: "Antepartum", condition: "HELLP Syndrome" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Hyperemesis Gravidarum" },

  // ANTEPARTUM – FETAL GROWTH / PLACENTAL ISSUES
  { system: "REPRO", subcategory: "Antepartum", condition: "Intrauterine Growth Restriction (IUGR)" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Fetal Macrosomia" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Placenta Previa", aliases: ["Low-Lying Placenta"] },
  { system: "REPRO", subcategory: "Antepartum", condition: "Placental Abruption", aliases: ["Abruptio Placentae"] },
  { system: "REPRO", subcategory: "Antepartum", condition: "Placenta Accreta Spectrum" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Multiple Gestation (Twin Pregnancy)" },
  { system: "REPRO", subcategory: "Antepartum", condition: "Post-term Pregnancy" },

  // INTRAPARTUM / LABOR & DELIVERY
  { system: "REPRO", subcategory: "Intrapartum", condition: "Preterm Labor" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Premature Rupture of Membranes (PROM)" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Preterm Premature Rupture of Membranes (PPROM)" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Chorioamnionitis" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Labor Dystocia (Failure to Progress)" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Shoulder Dystocia" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Umbilical Cord Prolapse" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Operative Vaginal Delivery (Forceps/Vacuum)" },
  { system: "REPRO", subcategory: "Intrapartum", condition: "Cesarean Delivery (Indications/Complications)" },

  // POSTPARTUM
  { system: "REPRO", subcategory: "Postpartum", condition: "Postpartum Hemorrhage" },
  { system: "REPRO", subcategory: "Postpartum", condition: "Postpartum Endometritis" },
  { system: "REPRO", subcategory: "Postpartum", condition: "Postpartum Mastitis / Breast Abscess" },
  { system: "REPRO", subcategory: "Postpartum", condition: "Postpartum Blues" },
  { system: "REPRO", subcategory: "Postpartum", condition: "Postpartum Depression" },
  { system: "REPRO", subcategory: "Postpartum", condition: "Postpartum Psychosis" },

  // BREAST DISORDERS
  { system: "REPRO", subcategory: "Breast", condition: "Fibrocystic Breast Changes" },
  { system: "REPRO", subcategory: "Breast", condition: "Breast Fibroadenoma" },
  { system: "REPRO", subcategory: "Breast", condition: "Mastitis", aliases: ["Breast Infection"] },
  { system: "REPRO", subcategory: "Breast", condition: "Breast Abscess" },
  { system: "REPRO", subcategory: "Breast", condition: "Galactorrhea" },
  { system: "REPRO", subcategory: "Breast", condition: "Gynecomastia" },

  // ONCOLOGY – REPRODUCTIVE
  { system: "REPRO", subcategory: "Oncology", condition: "Cervical Cancer" },
  { system: "REPRO", subcategory: "Oncology", condition: "Endometrial (Uterine) Cancer" },
  { system: "REPRO", subcategory: "Oncology", condition: "Ovarian Cancer" },
  { system: "REPRO", subcategory: "Oncology", condition: "Vulvar Cancer" },
  { system: "REPRO", subcategory: "Oncology", condition: "Vaginal Cancer" },
  { system: "REPRO", subcategory: "Oncology", condition: "Gestational Trophoblastic Neoplasia" },
  { system: "REPRO", subcategory: "Oncology", condition: "Breast Cancer" },
  // General Gynecology
  { system: "REPRO", subcategory: "Gynecology", condition: "Menopause" },
  { system: "REPRO", subcategory: "Gynecology", condition: "Contraception Methods" },
  { system: "REPRO", subcategory: "Trauma", condition: "Sexual Assault / Trauma" },
];

// -------------------------------------------
// HEENT REGISTRY (Eyes, Ears, Nose, Throat)
// -------------------------------------------

export const CONDITION_REGISTRY_HEENT: ConditionMeta[] = [
  // EYE – ANTERIOR SEGMENT / LIDS
  { system: "HEENT", subcategory: "Eye – Lids & Lacrimal", condition: "Blepharitis" },
  { system: "HEENT", subcategory: "Eye – Lids & Lacrimal", condition: "Hordeolum (Stye)" },
  { system: "HEENT", subcategory: "Eye – Lids & Lacrimal", condition: "Chalazion" },
  { system: "HEENT", subcategory: "Eye – Lids & Lacrimal", condition: "Entropion" },
  { system: "HEENT", subcategory: "Eye – Lids & Lacrimal", condition: "Ectropion" },
  { system: "HEENT", subcategory: "Eye – Lids & Lacrimal", condition: "Dacryocystitis" },
  { system: "HEENT", subcategory: "Eye – Lids & Lacrimal", condition: "Dacryoadenitis" },

  { system: "HEENT", subcategory: "Eye – Conjunctiva", condition: "Viral Conjunctivitis" },
  { system: "HEENT", subcategory: "Eye – Conjunctiva", condition: "Bacterial Conjunctivitis" },
  { system: "HEENT", subcategory: "Eye – Conjunctiva", condition: "Allergic Conjunctivitis" },
  { system: "HEENT", subcategory: "Eye – Conjunctiva", condition: "Pterygium", aliases: ["Surfer's Eye"] },
  { system: "HEENT", subcategory: "Eye – Conjunctiva", condition: "Pinguecula" },

  { system: "HEENT", subcategory: "Eye – Cornea & Anterior Segment", condition: "Corneal Foreign Body" },
  { system: "HEENT", subcategory: "Eye – Cornea & Anterior Segment", condition: "Keratitis" },
  { system: "HEENT", subcategory: "Eye – Cornea & Anterior Segment", condition: "Corneal Ulcer" },
  { system: "HEENT", subcategory: "Eye – Cornea & Anterior Segment", condition: "Herpes Simplex Keratitis", aliases: ["HSV Keratitis", "Dendritic Ulcer"] },
  { system: "HEENT", subcategory: "Eye – Cornea & Anterior Segment", condition: "Herpes Zoster Ophthalmicus" },
  { system: "HEENT", subcategory: "Eye – Uvea", condition: "Anterior Uveitis / Iritis" },
  { system: "HEENT", subcategory: "Eye – Uvea", condition: "Episcleritis" },
  { system: "HEENT", subcategory: "Eye – Uvea", condition: "Scleritis" },

  // EYE – LENS / GLAUCOMA
  { system: "HEENT", subcategory: "Eye – Lens", condition: "Cataract" },
  { system: "HEENT", subcategory: "Eye – Glaucoma", condition: "Primary Open-Angle Glaucoma" },
  { system: "HEENT", subcategory: "Eye – Glaucoma", condition: "Acute Angle-Closure Glaucoma", aliases: ["Angle Closure Glaucoma", "Closed Angle Glaucoma"] },
  { system: "HEENT", subcategory: "Eye – Glaucoma", condition: "Ocular Hypertension" },

  // EYE – RETINA / OPTIC NERVE
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Age-Related Macular Degeneration – Dry", aliases: ["Dry AMD", "Dry Macular Degeneration"] },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Age-Related Macular Degeneration – Wet", aliases: ["Wet AMD", "Wet Macular Degeneration"] },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Retinal Detachment", aliases: ["Detached Retina"] },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Central Retinal Artery Occlusion (CRAO)" },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Central Retinal Vein Occlusion (CRVO)" },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Diabetic Retinopathy – Nonproliferative" },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Diabetic Retinopathy – Proliferative" },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Hypertensive Retinopathy" },
  { system: "HEENT", subcategory: "Eye – Retina", condition: "Retinitis Pigmentosa" },

  { system: "HEENT", subcategory: "Eye – Optic Nerve", condition: "Optic Neuritis" },
  { system: "HEENT", subcategory: "Eye – Optic Nerve", condition: "Papilledema" },
  { system: "HEENT", subcategory: "Eye – Visual Symptoms", condition: "Amaurosis Fugax" },

  // EYE – PEDIATRIC / STRABISMUS
  { system: "HEENT", subcategory: "Eye – Pediatrics", condition: "Strabismus" },
  { system: "HEENT", subcategory: "Eye – Pediatrics", condition: "Amblyopia" },
  { system: "HEENT", subcategory: "Eye – Pediatrics", condition: "Congenital Cataract" },

  // EYE – ORBIT / CELLULITIS
  { system: "HEENT", subcategory: "Eye – Orbit", condition: "Preseptal (Periorbital) Cellulitis" },
  { system: "HEENT", subcategory: "Eye – Orbit", condition: "Orbital Cellulitis" },
  { system: "HEENT", subcategory: "Eye – Orbit", condition: "Hyphema" },
  { system: "HEENT", subcategory: "Eye – Orbit", condition: "Blunt Ocular Trauma / Globe Injury" },

  // EAR – EXTERNAL
  { system: "HEENT", subcategory: "Ear – External", condition: "Otitis Externa" },
  { system: "HEENT", subcategory: "Ear – External", condition: "Malignant (Necrotizing) Otitis Externa" },
  { system: "HEENT", subcategory: "Ear – External", condition: "Cerumen Impaction" },
  { system: "HEENT", subcategory: "Ear – External", condition: "Foreign Body in External Auditory Canal" },

  // EAR – MIDDLE
  { system: "HEENT", subcategory: "Ear – Middle", condition: "Acute Otitis Media" },
  { system: "HEENT", subcategory: "Ear – Middle", condition: "Recurrent Otitis Media" },
  { system: "HEENT", subcategory: "Ear – Middle", condition: "Otitis Media with Effusion (Serous Otitis)" },
  { system: "HEENT", subcategory: "Ear – Middle", condition: "Chronic Suppurative Otitis Media" },
  { system: "HEENT", subcategory: "Ear – Middle", condition: "Tympanic Membrane Perforation" },
  { system: "HEENT", subcategory: "Ear – Middle", condition: "Mastoiditis" },
  { system: "HEENT", subcategory: "Ear – Middle", condition: "Cholesteatoma" },

  // EAR – INNER / VESTIBULAR
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Labyrinthitis", aliases: ["Vestibular Labyrinthitis"] },
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Vestibular Neuritis", aliases: ["Vestibular Neuronitis"] },
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Ménière Disease" },
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Otosclerosis" },
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Tinnitus" },
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Noise-Induced Hearing Loss" },
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Presbycusis" },
  { system: "HEENT", subcategory: "Ear – Inner / Vestibular", condition: "Acoustic Neuroma (Vestibular Schwannoma)", aliases: ["Vestibular Schwannoma", "Acoustic Neuroma"] },

  // NOSE & SINUSES
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Viral Rhinitis (Common Cold)" },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Allergic Rhinitis", aliases: ["Hay Fever", "Seasonal Allergies"] },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Nonallergic Rhinitis" },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Acute Bacterial Rhinosinusitis", aliases: ["Acute Sinusitis", "Sinus Infection"] },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Chronic Rhinosinusitis", aliases: ["Chronic Sinusitis"] },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Nasal Polyps" },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Deviated Nasal Septum" },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Epistaxis – Anterior" },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Epistaxis – Posterior" },
  { system: "HEENT", subcategory: "Nose & Sinus", condition: "Nasal Foreign Body" },

  // THROAT / PHARYNX / LARYNX
  { system: "HEENT", subcategory: "Throat & Pharynx", condition: "Viral Pharyngitis" },
  { system: "HEENT", subcategory: "Throat & Pharynx", condition: "Group A Streptococcal Pharyngitis" },
  { system: "HEENT", subcategory: "Throat & Pharynx", condition: "Chronic Tonsillitis" },
  { system: "HEENT", subcategory: "Throat & Pharynx", condition: "Peritonsillar Abscess", aliases: ["Quinsy", "PTA"] },
  { system: "HEENT", subcategory: "Throat & Pharynx", condition: "Retropharyngeal Abscess" },
  { system: "HEENT", subcategory: "Throat & Pharynx", condition: "Infectious Mononucleosis (Oropharyngeal Manifestations)" },

  { system: "HEENT", subcategory: "Larynx & Upper Airway", condition: "Acute Laryngitis" },
  { system: "HEENT", subcategory: "Larynx & Upper Airway", condition: "Chronic Laryngitis" },
  { system: "HEENT", subcategory: "Larynx & Upper Airway", condition: "Epiglottitis" },
  { system: "HEENT", subcategory: "Larynx & Upper Airway", condition: "Croup (Laryngotracheobronchitis)" },
  { system: "HEENT", subcategory: "Larynx & Upper Airway", condition: "Vocal Cord Nodules / Polyps" },
  { system: "HEENT", subcategory: "Larynx & Upper Airway", condition: "Laryngopharyngeal Reflux (LPR)" },

  // ORAL CAVITY & SALIVARY GLANDS
  { system: "HEENT", subcategory: "Oral Cavity", condition: "Aphthous Ulcers" },
  { system: "HEENT", subcategory: "Oral Cavity", condition: "Herpes Labialis" },
  { system: "HEENT", subcategory: "Oral Cavity", condition: "Oral Candidiasis (Thrush)", aliases: ["Thrush", "Oral Thrush"] },
  { system: "HEENT", subcategory: "Oral Cavity", condition: "Leukoplakia" },
  { system: "HEENT", subcategory: "Oral Cavity", condition: "Erythroplakia" },
  { system: "HEENT", subcategory: "Oral Cavity", condition: "Temporomandibular Joint Disorder (TMJ)" },
  { system: "HEENT", subcategory: "Oral Cavity", condition: "Dental Abscess" },

  { system: "HEENT", subcategory: "Salivary Glands", condition: "Acute Bacterial Sialadenitis" },
  { system: "HEENT", subcategory: "Salivary Glands", condition: "Chronic Sialadenitis" },
  { system: "HEENT", subcategory: "Salivary Glands", condition: "Sialolithiasis" },
  { system: "HEENT", subcategory: "Salivary Glands", condition: "Parotitis (Non-Mumps)" },

  // SLEEP / AIRWAY (HEENT-FACING)
  { system: "HEENT", subcategory: "Sleep-Disordered Breathing", condition: "Obstructive Sleep Apnea (ENT Perspective)" },

  // ONCOLOGY – HEAD & NECK
  { system: "HEENT", subcategory: "Oncology – Head & Neck", condition: "Oral Cavity Squamous Cell Carcinoma" },
  { system: "HEENT", subcategory: "Oncology – Head & Neck", condition: "Oropharyngeal Carcinoma (Including HPV-Associated)" },
  { system: "HEENT", subcategory: "Oncology – Head & Neck", condition: "Laryngeal Carcinoma" },
  { system: "HEENT", subcategory: "Oncology – Head & Neck", condition: "Nasopharyngeal Carcinoma" },
  { system: "HEENT", subcategory: "Oncology – Head & Neck", condition: "Salivary Gland Tumors" },
  { system: "HEENT", subcategory: "Oncology – Eye", condition: "Retinoblastoma" }
];

// -------------------------------------------
// PSYCH REGISTRY (Psychiatry / Behavioral & Substance Use)
// -------------------------------------------

export const CONDITION_REGISTRY_PSYCH: ConditionMeta[] = [
  // MOOD DISORDERS
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Major Depressive Disorder", aliases: ["MDD", "Clinical Depression", "Unipolar Depression"] },
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Persistent Depressive Disorder (Dysthymia)", aliases: ["Dysthymia", "Chronic Depression"] },
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Bipolar I Disorder", aliases: ["Bipolar I", "Manic Depression"] },
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Bipolar II Disorder", aliases: ["Bipolar II"] },
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Cyclothymic Disorder", aliases: ["Cyclothymia"] },
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Premenstrual Dysphoric Disorder (PMDD)", aliases: ["PMDD"] },
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Depression with Peripartum Onset", aliases: ["Postpartum Depression", "Peripartum Depression"] },

  // ANXIETY DISORDERS
  { system: "PSYCH", subcategory: "Anxiety Disorders", condition: "Generalized Anxiety Disorder", aliases: ["GAD"] },
  { system: "PSYCH", subcategory: "Anxiety Disorders", condition: "Panic Disorder", aliases: ["Panic Attack Disorder"] },
  { system: "PSYCH", subcategory: "Anxiety Disorders", condition: "Agoraphobia" },
  { system: "PSYCH", subcategory: "Anxiety Disorders", condition: "Social Anxiety Disorder (Social Phobia)", aliases: ["Social Phobia", "Social Anxiety"] },
  { system: "PSYCH", subcategory: "Anxiety Disorders", condition: "Specific Phobia", aliases: ["Simple Phobia"] },
  { system: "PSYCH", subcategory: "Anxiety Disorders", condition: "Separation Anxiety Disorder" },
  { system: "PSYCH", subcategory: "Anxiety Disorders", condition: "Selective Mutism" },

  // TRAUMA & STRESSOR-RELATED DISORDERS
  { system: "PSYCH", subcategory: "Trauma- and Stressor-Related Disorders", condition: "Posttraumatic Stress Disorder (PTSD)", aliases: ["PTSD", "Post-Traumatic Stress"] },
  { system: "PSYCH", subcategory: "Trauma- and Stressor-Related Disorders", condition: "Acute Stress Disorder", aliases: ["ASD"] },
  { system: "PSYCH", subcategory: "Trauma- and Stressor-Related Disorders", condition: "Adjustment Disorder", aliases: ["Adjustment Reaction"] },
  { system: "PSYCH", subcategory: "Trauma- and Stressor-Related Disorders", condition: "Reactive Attachment Disorder" },

  // OBSESSIVE-COMPULSIVE & RELATED DISORDERS
  { system: "PSYCH", subcategory: "Obsessive-Compulsive & Related Disorders", condition: "Obsessive-Compulsive Disorder (OCD)", aliases: ["OCD"] },
  { system: "PSYCH", subcategory: "Obsessive-Compulsive & Related Disorders", condition: "Body Dysmorphic Disorder", aliases: ["BDD", "Dysmorphophobia"] },
  { system: "PSYCH", subcategory: "Obsessive-Compulsive & Related Disorders", condition: "Hoarding Disorder" },
  { system: "PSYCH", subcategory: "Obsessive-Compulsive & Related Disorders", condition: "Trichotillomania (Hair-Pulling Disorder)" },
  { system: "PSYCH", subcategory: "Obsessive-Compulsive & Related Disorders", condition: "Excoriation (Skin-Picking) Disorder" },

  // PSYCHOTIC DISORDERS
  { system: "PSYCH", subcategory: "Psychotic Disorders", condition: "Schizophrenia", aliases: ["Paranoid Schizophrenia", "Schizophrenic Disorder"] },
  { system: "PSYCH", subcategory: "Psychotic Disorders", condition: "Schizoaffective Disorder", aliases: ["Schizoaffective"] },
  { system: "PSYCH", subcategory: "Psychotic Disorders", condition: "Schizophreniform Disorder" },
  { system: "PSYCH", subcategory: "Psychotic Disorders", condition: "Brief Psychotic Disorder", aliases: ["Brief Reactive Psychosis"] },
  { system: "PSYCH", subcategory: "Psychotic Disorders", condition: "Delusional Disorder", aliases: ["Paranoid Disorder"] },
  { system: "PSYCH", subcategory: "Psychotic Disorders", condition: "Substance-Induced Psychotic Disorder" },

  // SOMATIC SYMPTOM & RELATED DISORDERS
  { system: "PSYCH", subcategory: "Somatic Symptom & Related Disorders", condition: "Somatic Symptom Disorder", aliases: ["Somatization Disorder"] },
  { system: "PSYCH", subcategory: "Somatic Symptom & Related Disorders", condition: "Illness Anxiety Disorder (Hypochondriasis)", aliases: ["Hypochondriasis", "Health Anxiety"] },
  { system: "PSYCH", subcategory: "Somatic Symptom & Related Disorders", condition: "Conversion Disorder (Functional Neurological Symptom Disorder)", aliases: ["Conversion Disorder", "Functional Neurological Disorder"] },
  { system: "PSYCH", subcategory: "Somatic Symptom & Related Disorders", condition: "Factitious Disorder Imposed on Self", aliases: ["Munchausen Syndrome"] },
  { system: "PSYCH", subcategory: "Somatic Symptom & Related Disorders", condition: "Factitious Disorder Imposed on Another", aliases: ["Munchausen by Proxy"] },
  { system: "PSYCH", subcategory: "Somatic Symptom & Related Disorders", condition: "Malingering" },

  // DISRUPTIVE, IMPULSE-CONTROL, & CONDUCT DISORDERS
  { system: "PSYCH", subcategory: "Disruptive, Impulse-Control, & Conduct Disorders", condition: "Oppositional Defiant Disorder" },
  { system: "PSYCH", subcategory: "Disruptive, Impulse-Control, & Conduct Disorders", condition: "Conduct Disorder" },
  { system: "PSYCH", subcategory: "Disruptive, Impulse-Control, & Conduct Disorders", condition: "Intermittent Explosive Disorder" },
  { system: "PSYCH", subcategory: "Disruptive, Impulse-Control, & Conduct Disorders", condition: "Kleptomania" },
  { system: "PSYCH", subcategory: "Disruptive, Impulse-Control, & Conduct Disorders", condition: "Pyromania" },

  // NEURODEVELOPMENTAL DISORDERS (PSYCH-LEANING)
  { system: "PSYCH", subcategory: "Neurodevelopmental Disorders", condition: "Attention-Deficit/Hyperactivity Disorder (ADHD)", aliases: ["ADHD", "ADD", "Attention Deficit Disorder"] },
  { system: "PSYCH", subcategory: "Neurodevelopmental Disorders", condition: "Autism Spectrum Disorder", aliases: ["ASD", "Autism"] },
  { system: "PSYCH", subcategory: "Neurodevelopmental Disorders", condition: "Intellectual Disability (Intellectual Developmental Disorder)", aliases: ["Mental Retardation", "Intellectual Developmental Disorder"] },
  { system: "PSYCH", subcategory: "Neurodevelopmental Disorders", condition: "Specific Learning Disorder" },
  { system: "PSYCH", subcategory: "Neurodevelopmental Disorders", condition: "Tourette Syndrome" },
  { system: "PSYCH", subcategory: "Neurodevelopmental Disorders", condition: "Persistent (Chronic) Motor or Vocal Tic Disorder" },

  // FEEDING & EATING DISORDERS
  { system: "PSYCH", subcategory: "Feeding & Eating Disorders", condition: "Anorexia Nervosa", aliases: ["Anorexia"] },
  { system: "PSYCH", subcategory: "Feeding & Eating Disorders", condition: "Bulimia Nervosa", aliases: ["Bulimia"] },
  { system: "PSYCH", subcategory: "Feeding & Eating Disorders", condition: "Binge-Eating Disorder", aliases: ["BED"] },
  { system: "PSYCH", subcategory: "Feeding & Eating Disorders", condition: "Avoidant/Restrictive Food Intake Disorder (ARFID)" },

  // PERSONALITY DISORDERS
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Paranoid Personality Disorder", aliases: ["Paranoid PD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Schizoid Personality Disorder", aliases: ["Schizoid PD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Schizotypal Personality Disorder", aliases: ["Schizotypal PD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Antisocial Personality Disorder", aliases: ["ASPD", "Sociopathy"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Borderline Personality Disorder", aliases: ["BPD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Histrionic Personality Disorder", aliases: ["Histrionic PD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Narcissistic Personality Disorder", aliases: ["NPD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Avoidant Personality Disorder", aliases: ["Avoidant PD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Dependent Personality Disorder", aliases: ["Dependent PD"] },
  { system: "PSYCH", subcategory: "Personality Disorders", condition: "Obsessive-Compulsive Personality Disorder", aliases: ["OCPD"] },

  // SLEEP-WAKE DISORDERS (PSYCH-RELATED)
  { system: "PSYCH", subcategory: "Sleep-Wake Disorders", condition: "Insomnia Disorder" },
  { system: "PSYCH", subcategory: "Sleep-Wake Disorders", condition: "Hypersomnolence Disorder" },
  { system: "PSYCH", subcategory: "Sleep-Wake Disorders", condition: "Narcolepsy" },
  { system: "PSYCH", subcategory: "Sleep-Wake Disorders", condition: "Parasomnias (Nightmares, Night Terrors, Sleepwalking)" },

  // SUBSTANCE USE – ALCOHOL
  { system: "PSYCH", subcategory: "Substance Use – Alcohol", condition: "Alcohol Use Disorder", aliases: ["Alcoholism", "Alcohol Dependence"] },
  { system: "PSYCH", subcategory: "Substance Use – Alcohol", condition: "Alcohol Intoxication" },
  { system: "PSYCH", subcategory: "Substance Use – Alcohol", condition: "Alcohol Withdrawal" },
  { system: "PSYCH", subcategory: "Substance Use – Alcohol", condition: "Delirium Tremens", aliases: ["DTs", "Alcohol Withdrawal Delirium"] },
  { system: "PSYCH", subcategory: "Substance Use – Alcohol", condition: "Wernicke–Korsakoff Syndrome" },

  // SUBSTANCE USE – OPIOIDS
  { system: "PSYCH", subcategory: "Substance Use – Opioids", condition: "Opioid Use Disorder", aliases: ["Opioid Addiction", "Opioid Dependence"] },
  { system: "PSYCH", subcategory: "Substance Use – Opioids", condition: "Opioid Intoxication" },
  { system: "PSYCH", subcategory: "Substance Use – Opioids", condition: "Opioid Withdrawal" },

  // SUBSTANCE USE – STIMULANTS
  { system: "PSYCH", subcategory: "Substance Use – Stimulants", condition: "Stimulant Use Disorder (Cocaine, Amphetamines)" },
  { system: "PSYCH", subcategory: "Substance Use – Stimulants", condition: "Stimulant Intoxication" },
  { system: "PSYCH", subcategory: "Substance Use – Stimulants", condition: "Stimulant Withdrawal" },

  // SUBSTANCE USE – SEDATIVE-HYPNOTICS
  { system: "PSYCH", subcategory: "Substance Use – Sedative-Hypnotics", condition: "Sedative-Hypnotic or Anxiolytic Use Disorder" },
  { system: "PSYCH", subcategory: "Substance Use – Sedative-Hypnotics", condition: "Benzodiazepine Intoxication" },
  { system: "PSYCH", subcategory: "Substance Use – Sedative-Hypnotics", condition: "Benzodiazepine Withdrawal" },
  { system: "PSYCH", subcategory: "Substance Use – Sedative-Hypnotics", condition: "Barbiturate Intoxication" },
  { system: "PSYCH", subcategory: "Substance Use – Sedative-Hypnotics", condition: "Barbiturate Withdrawal" },

  // SUBSTANCE USE – CANNABIS & HALLUCINOGENS
  { system: "PSYCH", subcategory: "Substance Use – Cannabis & Hallucinogens", condition: "Cannabis Use Disorder" },
  { system: "PSYCH", subcategory: "Substance Use – Cannabis & Hallucinogens", condition: "Cannabis Intoxication" },
  { system: "PSYCH", subcategory: "Substance Use – Cannabis & Hallucinogens", condition: "Cannabis Withdrawal" },
  { system: "PSYCH", subcategory: "Substance Use – Cannabis & Hallucinogens", condition: "Hallucinogen Use Disorder" },
  { system: "PSYCH", subcategory: "Substance Use – Cannabis & Hallucinogens", condition: "Hallucinogen Intoxication" },
  { system: "PSYCH", subcategory: "Substance Use – Cannabis & Hallucinogens", condition: "Phencyclidine (PCP) Intoxication" },

  // SUBSTANCE USE – TOBACCO
  { system: "PSYCH", subcategory: "Substance Use – Tobacco", condition: "Tobacco Use Disorder", aliases: ["Nicotine Dependence", "Smoking Addiction"] },
  { system: "PSYCH", subcategory: "Substance Use – Tobacco", condition: "Nicotine Withdrawal" },

  // EMERGENCY PSYCHIATRY & SUICIDALITY
  { system: "PSYCH", subcategory: "Emergency Psychiatry & Suicidality", condition: "Non-Suicidal Self-Injury" },
  { system: "PSYCH", subcategory: "Emergency Psychiatry & Suicidality", condition: "Serotonin Syndrome (Psychiatric Perspective)" },
  { system: "PSYCH", subcategory: "Emergency Psychiatry & Suicidality", condition: "Neuroleptic Malignant Syndrome" },
  // Other
  { system: "PSYCH", subcategory: "Trauma", condition: "Abuse and Neglect" },
  { system: "PSYCH", subcategory: "Trauma", condition: "Grief Reaction" },
];

// ============================================
// OTHER (Non-blueprint, uncategorizable items)
// Not shown on heatmap
// ============================================

export const CONDITION_REGISTRY_OTHER: ConditionMeta[] = [
  {
    system: "OTHER",
    subcategory: "General Pediatrics",
    condition: "Trisomy 21",
    aliases: ["Down Syndrome"]
  },
  {
    system: "OTHER",
    subcategory: "General Pediatrics",
    condition: "Turner Syndrome"
  },
  {
    system: "OTHER",
    subcategory: "General Pediatrics",
    condition: "Klinefelter Syndrome"
  },
  {
    system: "OTHER",
    subcategory: "General Pediatrics",
    condition: "Fragile X Syndrome"
  },
  // Dehydration is too general to assign to RENAL; PRO avoids clinical conditions
  {
    system: "OTHER",
    subcategory: "General Medicine",
    condition: "Dehydration"
  },
  // Developmental disorders not explicitly categorized in blueprint systems
  {
    system: "OTHER",
    subcategory: "Developmental",
    condition: "ADHD"
  },
  {
    system: "OTHER",
    subcategory: "Developmental",
    condition: "Autism Spectrum Disorder"
  },
  {
    system: "OTHER",
    subcategory: "Genetic",
    condition: "Edwards Syndrome (Trisomy 18)"
  },
  {
    system: "OTHER",
    subcategory: "Genetic",
    condition: "Osteogenesis Imperfecta"
  },
  {
    system: "OTHER",
    subcategory: "Genetic",
    condition: "Neurofibromatosis Type 1"
  },
  {
    system: "OTHER",
    subcategory: "Genetic",
    condition: "Tuberous Sclerosis"
  },
  {
    system: "OTHER",
    subcategory: "Genetic",
    condition: "Sturge-Weber Syndrome"
  },
  // Genetic, multi-system conditions that the blueprint does not assign
  {
    system: "OTHER",
    subcategory: "Genetic",
    condition: "Marfan Syndrome"
  },
  {
    system: "OTHER",
    subcategory: "Genetic",
    condition: "Ehlers-Danlos Syndrome"
  },
  // Peds conditions not in blueprint systems (not ID, not PULM, not CV, not HEME)
  {
    system: "OTHER",
    subcategory: "Pediatrics",
    condition: "Failure to Thrive"
  },
  // Conditions that appear on some PA school outlines but not the PANCE blueprint
  {
    system: "OTHER",
    subcategory: "General Medicine",
    condition: "Fatigue"
  },
  {
    system: "OTHER",
    subcategory: "General Medicine",
    condition: "Generalized Weakness"
  },
  // --------------------------------------------
// DERMATOLOGY META
// --------------------------------------------
  {
    system: "DERM",
    subcategory: "Other Dermatologic Disorders",
    condition: "Photosensitivity Reactions",
  },
  
  // --------------------------------------------
  // GI / NUTRITION META
  // --------------------------------------------
  {
    system: "GI",
    subcategory: "Metabolic Disorders",
    condition: "Phenylketonuria (PKU)",
  },
  {
    system: "GI",
    subcategory: "Nutrition",
    condition: "Refeeding Syndrome",
  },
  
  // --------------------------------------------
  // PULMONARY META
  // --------------------------------------------
  {
    system: "PULM",
    subcategory: "Sleep-Related Breathing Disorders",
    condition: "Obesity Hypoventilation Syndrome",
  },
  
  // --------------------------------------------
  // NEUROLOGY META
  // --------------------------------------------
  {
    system: "NEURO",
    subcategory: "Movement Disorders",
    condition: "Tardive Dyskinesia",
  },
  
  // --------------------------------------------
  // PSYCHIATRY META
  // --------------------------------------------
  {
    system: "PSYCH",
    subcategory: "Trauma- and Stressor-Related Disorders",
    condition: "Adjustment Disorders",
  },
  {
    system: "PSYCH",
    subcategory: "Somatic Symptom / Conversion",
    condition: "Psychogenic Nonepileptic Seizure",
  },
  
  // --------------------------------------------
  // INFECTIOUS DISEASE META
  // --------------------------------------------
  {
    system: "ID",
    subcategory: "Prion Diseases",
    condition: "Prion Diseases (e.g., Creutzfeldt-Jakob Disease)",
  },
  {
    system: "ID",
    subcategory: "Viral Diseases",
    condition: "Coronavirus Infections",
  },
  {
    system: "ID",
    subcategory: "Perinatal Infections",
    condition: "Perinatal Group B Streptococcus Infection",
  }
];

export const CONDITION_REGISTRY_ADDITIONAL: ConditionMeta[] = [
  // Added from Buzzword Bank (Unique items only)
  { system: "ID", subcategory: "Pediatrics", condition: "Kawasaki Disease" },
  { system: "NEURO", subcategory: "Sensory", condition: "Posterior Column Disease" },
  { system: "MSK", subcategory: "Oncology", condition: "Osteosarcoma" },
  { system: "MSK", subcategory: "Oncology", condition: "Ewing Sarcoma" },
  { system: "CV", subcategory: "ECG", condition: "Long QT Syndrome" },
  { system: "CV", subcategory: "Carditis", condition: "Pericardial Effusion" },
  { system: "PULM", subcategory: "Obstructive", condition: "COPD Exacerbation" },
  { system: "PULM", subcategory: "Infectious", condition: "Healed Primary TB", aliases: ["Ranke Complex"] },
  { system: "GI", subcategory: "Small Bowel", condition: "Intussusception" },
  { system: "GI", subcategory: "Obstruction", condition: "Sigmoid Volvulus" },
  { system: "GI", subcategory: "Vascular", condition: "Ischemic Colitis" },
  { system: "GI", subcategory: "Pediatric", condition: "Duodenal Atresia" },
  { system: "GI", subcategory: "Hepatic", condition: "Portal Hypertension" },
  { system: "GI", subcategory: "Oncology", condition: "GI Malignancy" },
  { system: "GI", subcategory: "Obstruction", condition: "Gastric Outlet Obstruction" },
  { system: "GI", subcategory: "Esophagus", condition: "Esophageal Ring", aliases: ["Schatzki Ring"] },
  { system: "GI", subcategory: "Esophagus", condition: "Diffuse Esophageal Spasm" },
  { system: "NEURO", subcategory: "Trauma", condition: "Basilar Skull Fracture" },
  { system: "NEURO", subcategory: "General", condition: "Upper Motor Neuron Lesion" },
  { system: "NEURO", subcategory: "Peripheral Nerve", condition: "Peroneal Nerve Palsy" },
  { system: "NEURO", subcategory: "Peripheral Nerve", condition: "Radial Nerve Palsy" },
  { system: "NEURO", subcategory: "Peripheral Nerve", condition: "Ulnar Nerve Palsy" },
  { system: "NEURO", subcategory: "Peripheral Nerve", condition: "Median Nerve Palsy" },
  { system: "NEURO", subcategory: "Genetic", condition: "Neurofibromatosis" },
  { system: "NEURO", subcategory: "Genetic", condition: "Tuberous Sclerosis" },
  { system: "HEME", subcategory: "General", condition: "Asplenia" },
  { system: "HEME", subcategory: "Anemia", condition: "Microangiopathic Hemolytic Anemia" },
  { system: "ENDO", subcategory: "Pituitary", condition: "Pituitary Adenoma" },
  { system: "ID", subcategory: "Bacterial", condition: "Typhoid Fever" },
  { system: "GU", subcategory: "Infectious", condition: "UTI (Urease Producers)" },
  { system: "GU", subcategory: "Stones", condition: "Ureteral Stone" },
  { system: "PSYCH", subcategory: "Mood Disorders", condition: "Mania" },
  { system: "PSYCH", subcategory: "Psychotic Disorders", condition: "Catatonia" },
  { system: "REPRO", subcategory: "Pregnancy Complications", condition: "Hydatidiform Mole" },
  { system: "REPRO", subcategory: "Pregnancy Complications", condition: "Anembryonic Pregnancy" },
  { system: "DERM", subcategory: "Oncology", condition: "Basal Cell Carcinoma", aliases: ["BCC"] },
  { system: "DERM", subcategory: "Oncology", condition: "Squamous Cell Carcinoma", aliases: ["SCC"] },
  { system: "DERM", subcategory: "Oncology", condition: "Melanoma", aliases: ["Malignant Melanoma"] },
  { system: "DERM", subcategory: "Oncology", condition: "Kaposi Sarcoma" },
  { system: "DERM", subcategory: "Oncology", condition: "Actinic Keratosis", aliases: ["AK", "Solar Keratosis"] },
  { system: "DERM", subcategory: "Infectious", condition: "Felon", aliases: ["Finger Pulp Infection"] },
  { system: "DERM", subcategory: "Nail Disorders", condition: "Onychocryptosis", aliases: ["Ingrown Toenail"] },
  { system: "DERM", subcategory: "Hair Disorders", condition: "Telogen Effluvium" },
  { system: "HEENT", subcategory: "Emergency", condition: "Ludwig’s Angina" },
  { system: "GU", subcategory: "Emergency", condition: "Fournier Gangrene" },
  { system: "OTHER", subcategory: "Oncology", condition: "Tumor Lysis Syndrome" },
  { system: "CV", subcategory: "ECG", condition: "Torsades de Pointes" },
  { system: "OTHER", subcategory: "Toxicology", condition: "Carbon Monoxide Poisoning" },
  { system: "OTHER", subcategory: "Toxicology", condition: "Acetaminophen Toxicity" },
  { system: "OTHER", subcategory: "Toxicology", condition: "Salicylate Toxicity" },
  { system: "OTHER", subcategory: "Emergency", condition: "Anaphylaxis" },
  { system: "CV", subcategory: "Vascular", condition: "Superior Vena Cava Syndrome" },
  { system: "NEURO", subcategory: "Spine", condition: "Spinal Epidural Abscess" },
  { system: "NEURO", subcategory: "Neuromuscular", condition: "Myasthenic Crisis" },

  // -------------------------
  // INFECTIOUS DISEASE (Specifics)
  // -------------------------
  { system: "ID", subcategory: "Bacterial", condition: "Rheumatic Fever" },
  { system: "ID", subcategory: "Zoonotic", condition: "Bartonella henselae", aliases: ["Cat Scratch Disease"] },
  { system: "ID", subcategory: "Parasitic", condition: "Ascariasis", aliases: ["Roundworm"] },
  { system: "ID", subcategory: "Parasitic", condition: "Cestode Infection", aliases: ["Tapeworm"] },
  { system: "ID", subcategory: "Viral", condition: "Cytomegalovirus (Systemic)", aliases: ["CMV"] },

  // -------------------------
  // MUSCULOSKELETAL (Specifics)
  // -------------------------
  { system: "MSK", subcategory: "Spine", condition: "Torticollis", aliases: ["Wry Neck"] },
  { system: "MSK", subcategory: "Spine", condition: "Kyphosis", aliases: ["Scheuermann Disease"] },
  { system: "MSK", subcategory: "Hand", condition: "Dupuytren Contracture" },
  { system: "MSK", subcategory: "Soft Tissue", condition: "Baker’s Cyst", aliases: ["Popliteal Cyst"] },
  { system: "MSK", subcategory: "Foot", condition: "Morton’s Neuroma" },
  { system: "MSK", subcategory: "Pediatrics", condition: "Sever’s Disease", aliases: ["Calcaneal Apophysitis"] },
  { system: "MSK", subcategory: "Knee", condition: "Chondromalacia Patellae", aliases: ["Patellofemoral Syndrome"] },

  // -------------------------
  // GENITOURINARY / REPRODUCTIVE
  // -------------------------
  { system: "GU", subcategory: "Infectious", condition: "Balanitis" },
  { system: "GU", subcategory: "Congenital", condition: "Hypospadias" },
  { system: "GU", subcategory: "Congenital", condition: "Epispadias" },
  { system: "GU", subcategory: "Congenital", condition: "Vesicoureteral Reflux" },
  { system: "REPRO", subcategory: "Menstrual", condition: "Mittelschmerz" },
  { system: "REPRO", subcategory: "Pregnancy Complications", condition: "Incompetent Cervix", aliases: ["Cervical Insufficiency"] },
  { system: "NEURO", subcategory: "Cognitive", condition: "Delirium" },
  { system: "NEURO", subcategory: "Cognitive", condition: "Normal Pressure Hydrocephalus (NPH)" },
  { system: "OTHER", subcategory: "Genetic", condition: "Noonan Syndrome" },
  { system: "OTHER", subcategory: "Genetic", condition: "Prader-Willi Syndrome" },
  { system: "OTHER", subcategory: "Genetic", condition: "Angelman Syndrome" },
  { system: "OTHER", subcategory: "Genetic", condition: "DiGeorge Syndrome" },
  { system: "OTHER", subcategory: "Neonatal", condition: "Hyaline Membrane Disease", aliases: ["Respiratory Distress Syndrome"] },
  { system: "OTHER", subcategory: "Neonatal", condition: "Meconium Aspiration" },
  { system: "OTHER", subcategory: "Neonatal", condition: "Necrotizing Enterocolitis" },
  { system: "OTHER", subcategory: "Neonatal", condition: "Sudden Infant Death Syndrome (SIDS)" },
  { system: "OTHER", subcategory: "Pediatrics", condition: "Colic" },
  { system: "OTHER", subcategory: "Pediatrics", condition: "Encopresis" },
  { system: "OTHER", subcategory: "Pediatrics", condition: "Hirschsprung’s Disease" },
  { system: "HEENT", subcategory: "Ear", condition: "Barotrauma" },
  { system: "HEENT", subcategory: "Nose", condition: "Rhinitis Medicamentosa" },
  { system: "OTHER", subcategory: "Environmental", condition: "Snake Bites" },
  { system: "OTHER", subcategory: "Environmental", condition: "High Altitude Illness" },
  { system: "OTHER", subcategory: "Environmental", condition: "Electrical Injuries" },
  { system: "OTHER", subcategory: "Environmental", condition: "Heat Stroke / Heat Exhaustion" },
  { system: "OTHER", subcategory: "Environmental", condition: "Drowning / Near Drowning" }
];

export const CONDITION_REGISTRY: ConditionMeta[] = [
  ...CONDITION_REGISTRY_CV,
  ...CONDITION_REGISTRY_PULM,
  ...CONDITION_REGISTRY_GI,
  ...CONDITION_REGISTRY_MSK,
  ...CONDITION_REGISTRY_ENDO,
  ...CONDITION_REGISTRY_ID,
  ...CONDITION_REGISTRY_HEME,
  ...CONDITION_REGISTRY_NEURO,
  ...CONDITION_REGISTRY_DERM,
  ...CONDITION_REGISTRY_RENAL,
  ...CONDITION_REGISTRY_GU,
  ...CONDITION_REGISTRY_REPRO,
  ...CONDITION_REGISTRY_HEENT,
  ...CONDITION_REGISTRY_PSYCH,
  ...CONDITION_REGISTRY_OTHER,
  ...CONDITION_REGISTRY_ADDITIONAL,
];
/**
 * Try to find a condition meta by name or alias coming back from the model.
 * `rawName` can be messy text from the LLM – we normalize and do loose matching.
 */
export function findConditionMeta(
  rawName?: string | null
): ConditionMeta | undefined {
  if (!rawName) return undefined;
  const candidate = rawName.trim().toLowerCase();
  if (!candidate) return undefined;

  const all = CONDITION_REGISTRY;
  const regexCache = new Map<string, RegExp>();
  const matchWord = (needle: string) => {
    let regex = regexCache.get(needle);
    if (!regex) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(`\\b${escaped}\\b`, "i");
      regexCache.set(needle, regex);
    }
    return regex.test(candidate);
  };

  // 1) Direct name match
  const byName = all.find(
    (c) => c.condition.toLowerCase() === candidate
  );
  if (byName) return byName;

  // 2) Alias match
  for (const meta of all) {
    if (!meta.aliases) continue;
    if (meta.aliases.some((a) => a.toLowerCase() === candidate)) {
      return meta;
    }
  }

  // 3) Contains-style match as a fallback (e.g. "severe atrial fibrillation")
  for (const meta of all) {
    if (matchWord(meta.condition)) return meta;
    if (meta.aliases?.some((a) => matchWord(a))) return meta;
  }

  return undefined;
}

/**
 * Build a full ConditionDefinition from a ConditionMeta.
 * This is what gets attached to each Question.
 */
export function buildConditionDefinition(
  meta: ConditionMeta
): ConditionDefinition {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  return {
    id: `${meta.system}__${norm(meta.subcategory)}__${norm(
      meta.condition
    )}`,
    system: meta.system,
    subcategory: meta.subcategory,
    condition: meta.condition,
  };
}

/**
 * Return a random condition for a given PANCE system.
 * Skips "OTHER" because those are not tracked on the heatmap.
 */
export function getRandomConditionForSystem(
  system: SystemCode
): ConditionMeta | undefined {
  if (system === "OTHER") return undefined;
  const pool = CONDITION_REGISTRY.filter(
    (c) => c.system === system || c.relatedSystems?.includes(system)
  );
  if (!pool.length) return undefined;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
