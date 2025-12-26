// differentialRegistry.ts
/**
 * Differential Diagnosis Registry
 * 
 * Bare-bones registry of common presenting complaints and their DDx. AI generates:
 * - Complete differential diagnosis list
 * - Must-not-miss diagnoses
 * - Initial workup approach
 * - Key distinguishing features
 * - Evidence-based diagnostic approach
 */

export interface DifferentialMeta {
  presentingComplaint: string;
  category: string; // Acute, Chronic, Emergency, Primary Care
  isEmergency?: boolean; // Life-threatening presentations
}

export const DIFFERENTIAL_REGISTRY: DifferentialMeta[] = [
  // Chest Pain
  { presentingComplaint: "Acute Chest Pain", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Chronic Chest Pain", category: "Chronic" },
  { presentingComplaint: "Pleuritic Chest Pain", category: "Acute" },
  
  // Shortness of Breath
  { presentingComplaint: "Acute Dyspnea", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Chronic Dyspnea", category: "Chronic" },
  { presentingComplaint: "Exertional Dyspnea", category: "Chronic" },
  
  // Abdominal Pain
  { presentingComplaint: "Acute Abdominal Pain", category: "Emergency", isEmergency: true },
  { presentingComplaint: "RUQ Pain", category: "Acute" },
  { presentingComplaint: "RLQ Pain", category: "Emergency", isEmergency: true },
  { presentingComplaint: "LLQ Pain", category: "Acute" },
  { presentingComplaint: "LUQ Pain", category: "Acute" },
  { presentingComplaint: "Epigastric Pain", category: "Acute" },
  { presentingComplaint: "Periumbilical Pain", category: "Acute" },
  { presentingComplaint: "Chronic Abdominal Pain", category: "Chronic" },
  
  // Headache
  { presentingComplaint: "Acute Severe Headache (Thunderclap)", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Chronic Headache", category: "Chronic" },
  { presentingComplaint: "Migraine", category: "Acute" },
  { presentingComplaint: "New Headache in Older Adult", category: "Acute" },
  
  // Neurologic
  { presentingComplaint: "Acute Weakness", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Altered Mental Status", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Dizziness/Vertigo", category: "Acute" },
  { presentingComplaint: "Syncope", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Seizure", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Numbness and Tingling", category: "Acute" },
  { presentingComplaint: "Tremor", category: "Chronic" },
  { presentingComplaint: "Gait Disturbance", category: "Chronic" },
  
  // GI Symptoms
  { presentingComplaint: "Nausea and Vomiting", category: "Acute" },
  { presentingComplaint: "Acute Diarrhea", category: "Acute" },
  { presentingComplaint: "Chronic Diarrhea", category: "Chronic" },
  { presentingComplaint: "Constipation", category: "Chronic" },
  { presentingComplaint: "Hematemesis", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Hematochezia", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Melena", category: "Acute" },
  { presentingComplaint: "Jaundice", category: "Acute" },
  { presentingComplaint: "Dysphagia", category: "Acute" },
  
  // Genitourinary
  { presentingComplaint: "Dysuria", category: "Acute" },
  { presentingComplaint: "Hematuria", category: "Acute" },
  { presentingComplaint: "Acute Urinary Retention", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Flank Pain", category: "Acute" },
  { presentingComplaint: "Scrotal Pain", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Vaginal Bleeding", category: "Acute" },
  { presentingComplaint: "Pelvic Pain", category: "Acute" },
  
  // Musculoskeletal
  { presentingComplaint: "Acute Joint Pain (Monoarticular)", category: "Acute" },
  { presentingComplaint: "Acute Joint Pain (Polyarticular)", category: "Acute" },
  { presentingComplaint: "Chronic Joint Pain", category: "Chronic" },
  { presentingComplaint: "Back Pain (Acute)", category: "Acute" },
  { presentingComplaint: "Back Pain (Chronic)", category: "Chronic" },
  { presentingComplaint: "Back Pain with Red Flags", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Neck Pain", category: "Acute" },
  { presentingComplaint: "Shoulder Pain", category: "Acute" },
  { presentingComplaint: "Knee Pain", category: "Acute" },
  { presentingComplaint: "Ankle Pain", category: "Acute" },
  
  // Dermatologic
  { presentingComplaint: "Acute Rash", category: "Acute" },
  { presentingComplaint: "Chronic Rash", category: "Chronic" },
  { presentingComplaint: "Vesicular Rash", category: "Acute" },
  { presentingComplaint: "Petechiae/Purpura", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Pruritus", category: "Chronic" },
  
  // Constitutional
  { presentingComplaint: "Fever", category: "Acute" },
  { presentingComplaint: "Fever of Unknown Origin", category: "Chronic" },
  { presentingComplaint: "Unintentional Weight Loss", category: "Chronic" },
  { presentingComplaint: "Fatigue", category: "Chronic" },
  { presentingComplaint: "Night Sweats", category: "Chronic" },
  
  // HEENT
  { presentingComplaint: "Sore Throat", category: "Acute" },
  { presentingComplaint: "Red Eye", category: "Acute" },
  { presentingComplaint: "Eye Pain", category: "Acute" },
  { presentingComplaint: "Vision Loss (Acute)", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Hearing Loss", category: "Acute" },
  { presentingComplaint: "Ear Pain", category: "Acute" },
  { presentingComplaint: "Epistaxis", category: "Acute" },
  { presentingComplaint: "Neck Mass", category: "Chronic" },
  
  // Cardiovascular
  { presentingComplaint: "Palpitations", category: "Acute" },
  { presentingComplaint: "Peripheral Edema", category: "Chronic" },
  { presentingComplaint: "Leg Swelling (Unilateral)", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Cyanosis", category: "Emergency", isEmergency: true },
  
  // Psychiatric
  { presentingComplaint: "Depression", category: "Chronic" },
  { presentingComplaint: "Anxiety", category: "Chronic" },
  { presentingComplaint: "Suicidal Ideation", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Psychosis", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Insomnia", category: "Chronic" },
  { presentingComplaint: "Memory Loss", category: "Chronic" },
  
  // Pulmonary
  { presentingComplaint: "Cough (Acute)", category: "Acute" },
  { presentingComplaint: "Cough (Chronic)", category: "Chronic" },
  { presentingComplaint: "Hemoptysis", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Wheezing", category: "Acute" },
  { presentingComplaint: "Stridor", category: "Emergency", isEmergency: true },
  
  // Pediatric Specific
  { presentingComplaint: "Fever in Infant (<3 months)", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Crying/Irritability in Infant", category: "Emergency", isEmergency: true },
  { presentingComplaint: "Failure to Thrive", category: "Chronic" },
  
  // Women's Health
  { presentingComplaint: "Amenorrhea", category: "Chronic" },
  { presentingComplaint: "Menorrhagia", category: "Chronic" },
  { presentingComplaint: "Dysmenorrhea", category: "Chronic" },
  { presentingComplaint: "Breast Mass", category: "Acute" },
  { presentingComplaint: "Nipple Discharge", category: "Acute" },
];

export function buildDifferentialId(diff: DifferentialMeta): string {
  return diff.presentingComplaint.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
