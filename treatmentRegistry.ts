// treatmentRegistry.ts
/**
 * Treatment/Intervention Registry
 * 
 * Bare-bones registry of non-surgical treatments and interventions. AI generates:
 * - Detailed description
 * - Indications
 * - Contraindications
 * - Procedure details
 * - Expected outcomes
 * - Complications
 */

export interface TreatmentMeta {
  name: string;
  category: string; // Procedure, Therapy, Device, Lifestyle, etc.
}

export const TREATMENT_REGISTRY: TreatmentMeta[] = [
  // Procedures/Interventions
  { name: "Cardioversion", category: "Procedure" },
  { name: "Central Line Placement", category: "Procedure" },
  { name: "Chest Tube Insertion", category: "Procedure" },
  { name: "Lumbar Puncture", category: "Procedure" },
  { name: "Paracentesis", category: "Procedure" },
  { name: "Thoracentesis", category: "Procedure" },
  { name: "Arthrocentesis", category: "Procedure" },
  { name: "Incision and Drainage (I&D)", category: "Procedure" },
  { name: "Nasogastric Tube Placement", category: "Procedure" },
  { name: "Urinary Catheterization", category: "Procedure" },
  { name: "Endotracheal Intubation", category: "Procedure" },
  { name: "Mechanical Ventilation", category: "Procedure" },
  { name: "Hemodialysis", category: "Procedure" },
  { name: "Peritoneal Dialysis", category: "Procedure" },
  { name: "Blood Transfusion", category: "Procedure" },
  { name: "Platelet Transfusion", category: "Procedure" },
  { name: "FFP (Fresh Frozen Plasma) Transfusion", category: "Procedure" },
  
  // Cardiac Interventions
  { name: "Percutaneous Coronary Intervention (PCI)", category: "Cardiac Intervention" },
  { name: "Cardiac Catheterization", category: "Cardiac Intervention" },
  { name: "Coronary Angiography", category: "Cardiac Intervention" },
  { name: "Stent Placement", category: "Cardiac Intervention" },
  { name: "IABP (Intra-Aortic Balloon Pump)", category: "Cardiac Intervention" },
  
  // Oxygen Therapy
  { name: "Supplemental Oxygen (Nasal Cannula)", category: "Respiratory Support" },
  { name: "Non-Rebreather Mask", category: "Respiratory Support" },
  { name: "BiPAP/CPAP", category: "Respiratory Support" },
  { name: "High-Flow Nasal Cannula", category: "Respiratory Support" },
  
  // Physical Therapy
  { name: "Physical Therapy", category: "Rehabilitation" },
  { name: "Occupational Therapy", category: "Rehabilitation" },
  { name: "Speech Therapy", category: "Rehabilitation" },
  { name: "Cardiac Rehabilitation", category: "Rehabilitation" },
  { name: "Pulmonary Rehabilitation", category: "Rehabilitation" },
  
  // Mental Health
  { name: "Cognitive Behavioral Therapy (CBT)", category: "Psychotherapy" },
  { name: "Electroconvulsive Therapy (ECT)", category: "Psychiatric" },
  { name: "Transcranial Magnetic Stimulation (TMS)", category: "Psychiatric" },
  
  // Wound Care
  { name: "Negative Pressure Wound Therapy (VAC)", category: "Wound Care" },
  { name: "Debridement", category: "Wound Care" },
  { name: "Wound Irrigation", category: "Wound Care" },
  
  // Radiation/Chemotherapy
  { name: "External Beam Radiation Therapy", category: "Oncology" },
  { name: "Brachytherapy", category: "Oncology" },
  { name: "Chemotherapy", category: "Oncology" },
  { name: "Immunotherapy", category: "Oncology" },
  { name: "Targeted Therapy", category: "Oncology" },
  
  // Lifestyle Modifications
  { name: "Smoking Cessation", category: "Lifestyle" },
  { name: "Weight Loss", category: "Lifestyle" },
  { name: "Exercise Program", category: "Lifestyle" },
  { name: "Dietary Modification", category: "Lifestyle" },
  { name: "Stress Management", category: "Lifestyle" },
  { name: "Sleep Hygiene", category: "Lifestyle" },
];

export function buildTreatmentId(treatment: TreatmentMeta): string {
  return treatment.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
