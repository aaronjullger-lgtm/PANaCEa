// symptomRegistry.ts
/**
 * Symptom Registry - Source of Truth for Clinical Symptoms
 * 
 * Bare-bones registry of symptoms. AI generates:
 * - Detailed description
 * - Associated conditions
 * - Red flag features
 * - Initial workup
 * - Differential diagnosis approach
 */

export interface SymptomMeta {
  name: string;
  category: string; // Constitutional, Cardiopulmonary, GI, Neurologic, MSK, Dermatologic, etc.
}

export const SYMPTOM_REGISTRY: SymptomMeta[] = [
  // Constitutional
  { name: "Fever", category: "Constitutional" },
  { name: "Chills", category: "Constitutional" },
  { name: "Night Sweats", category: "Constitutional" },
  { name: "Weight Loss", category: "Constitutional" },
  { name: "Weight Gain", category: "Constitutional" },
  { name: "Fatigue", category: "Constitutional" },
  { name: "Malaise", category: "Constitutional" },
  
  // Cardiopulmonary
  { name: "Chest Pain", category: "Cardiopulmonary" },
  { name: "Dyspnea", category: "Cardiopulmonary" },
  { name: "Palpitations", category: "Cardiopulmonary" },
  { name: "Orthopnea", category: "Cardiopulmonary" },
  { name: "Paroxysmal Nocturnal Dyspnea", category: "Cardiopulmonary" },
  { name: "Cough", category: "Cardiopulmonary" },
  { name: "Hemoptysis", category: "Cardiopulmonary" },
  { name: "Wheezing", category: "Cardiopulmonary" },
  { name: "Syncope", category: "Cardiopulmonary" },
  { name: "Pre-syncope/Lightheadedness", category: "Cardiopulmonary" },
  
  // Gastrointestinal
  { name: "Abdominal Pain", category: "Gastrointestinal" },
  { name: "Nausea", category: "Gastrointestinal" },
  { name: "Vomiting", category: "Gastrointestinal" },
  { name: "Diarrhea", category: "Gastrointestinal" },
  { name: "Constipation", category: "Gastrointestinal" },
  { name: "Hematemesis", category: "Gastrointestinal" },
  { name: "Hematochezia", category: "Gastrointestinal" },
  { name: "Melena", category: "Gastrointestinal" },
  { name: "Dysphagia", category: "Gastrointestinal" },
  { name: "Odynophagia", category: "Gastrointestinal" },
  { name: "Heartburn", category: "Gastrointestinal" },
  { name: "Jaundice", category: "Gastrointestinal" },
  
  // Neurologic
  { name: "Headache", category: "Neurologic" },
  { name: "Dizziness/Vertigo", category: "Neurologic" },
  { name: "Seizure", category: "Neurologic" },
  { name: "Weakness", category: "Neurologic" },
  { name: "Numbness/Tingling", category: "Neurologic" },
  { name: "Vision Changes", category: "Neurologic" },
  { name: "Hearing Loss", category: "Neurologic" },
  { name: "Tinnitus", category: "Neurologic" },
  { name: "Confusion", category: "Neurologic" },
  { name: "Memory Loss", category: "Neurologic" },
  { name: "Tremor", category: "Neurologic" },
  
  // Musculoskeletal
  { name: "Joint Pain", category: "Musculoskeletal" },
  { name: "Joint Swelling", category: "Musculoskeletal" },
  { name: "Back Pain", category: "Musculoskeletal" },
  { name: "Neck Pain", category: "Musculoskeletal" },
  { name: "Muscle Pain (Myalgia)", category: "Musculoskeletal" },
  { name: "Muscle Weakness", category: "Musculoskeletal" },
  
  // Genitourinary
  { name: "Dysuria", category: "Genitourinary" },
  { name: "Hematuria", category: "Genitourinary" },
  { name: "Urinary Frequency", category: "Genitourinary" },
  { name: "Urinary Urgency", category: "Genitourinary" },
  { name: "Urinary Incontinence", category: "Genitourinary" },
  { name: "Flank Pain", category: "Genitourinary" },
  { name: "Scrotal Pain", category: "Genitourinary" },
  { name: "Vaginal Bleeding", category: "Genitourinary" },
  { name: "Vaginal Discharge", category: "Genitourinary" },
  { name: "Pelvic Pain", category: "Genitourinary" },
  
  // Dermatologic
  { name: "Rash", category: "Dermatologic" },
  { name: "Pruritus (Itching)", category: "Dermatologic" },
  { name: "Skin Lesion", category: "Dermatologic" },
  { name: "Hair Loss", category: "Dermatologic" },
  
  // HEENT
  { name: "Sore Throat", category: "HEENT" },
  { name: "Nasal Congestion", category: "HEENT" },
  { name: "Rhinorrhea", category: "HEENT" },
  { name: "Epistaxis", category: "HEENT" },
  { name: "Ear Pain", category: "HEENT" },
  { name: "Eye Pain", category: "HEENT" },
  { name: "Red Eye", category: "HEENT" },
  
  // Psychiatric
  { name: "Anxiety", category: "Psychiatric" },
  { name: "Depression", category: "Psychiatric" },
  { name: "Insomnia", category: "Psychiatric" },
  { name: "Suicidal Ideation", category: "Psychiatric" },
  { name: "Hallucinations", category: "Psychiatric" },
  { name: "Delusions", category: "Psychiatric" },
];

export function buildSymptomId(symptom: SymptomMeta): string {
  return symptom.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
