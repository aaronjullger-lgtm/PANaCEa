// abbreviationRegistry.ts
/**
 * Medical Abbreviation Registry
 * 
 * Bare-bones registry of medical abbreviations. AI generates:
 * - Full term
 * - Context and usage
 * - Common mistakes
 * - Related terms
 * - Clinical examples
 */

export interface AbbreviationMeta {
  abbreviation: string;
  category: string; // Diagnosis, Procedure, Lab, Imaging, Medication, General, etc.
}

export const ABBREVIATION_REGISTRY: AbbreviationMeta[] = [
  // Diagnosis
  { abbreviation: "ACS", category: "Diagnosis" },
  { abbreviation: "MI", category: "Diagnosis" },
  { abbreviation: "STEMI", category: "Diagnosis" },
  { abbreviation: "NSTEMI", category: "Diagnosis" },
  { abbreviation: "CHF", category: "Diagnosis" },
  { abbreviation: "COPD", category: "Diagnosis" },
  { abbreviation: "CAP", category: "Diagnosis" },
  { abbreviation: "UTI", category: "Diagnosis" },
  { abbreviation: "DVT", category: "Diagnosis" },
  { abbreviation: "PE", category: "Diagnosis" },
  { abbreviation: "CVA", category: "Diagnosis" },
  { abbreviation: "TIA", category: "Diagnosis" },
  { abbreviation: "DM", category: "Diagnosis" },
  { abbreviation: "DKA", category: "Diagnosis" },
  { abbreviation: "HHNS", category: "Diagnosis" },
  { abbreviation: "CKD", category: "Diagnosis" },
  { abbreviation: "AKI", category: "Diagnosis" },
  { abbreviation: "ESRD", category: "Diagnosis" },
  { abbreviation: "IBD", category: "Diagnosis" },
  { abbreviation: "GERD", category: "Diagnosis" },
  { abbreviation: "PUD", category: "Diagnosis" },
  
  // Lab Values
  { abbreviation: "CBC", category: "Lab" },
  { abbreviation: "CMP", category: "Lab" },
  { abbreviation: "BMP", category: "Lab" },
  { abbreviation: "LFT", category: "Lab" },
  { abbreviation: "PT/INR", category: "Lab" },
  { abbreviation: "PTT/aPTT", category: "Lab" },
  { abbreviation: "TSH", category: "Lab" },
  { abbreviation: "HbA1c", category: "Lab" },
  { abbreviation: "BNP", category: "Lab" },
  { abbreviation: "Troponin", category: "Lab" },
  { abbreviation: "CRP", category: "Lab" },
  { abbreviation: "ESR", category: "Lab" },
  { abbreviation: "ABG", category: "Lab" },
  { abbreviation: "VBG", category: "Lab" },
  
  // Imaging
  { abbreviation: "CXR", category: "Imaging" },
  { abbreviation: "CT", category: "Imaging" },
  { abbreviation: "MRI", category: "Imaging" },
  { abbreviation: "US", category: "Imaging" },
  { abbreviation: "CTPA", category: "Imaging" },
  { abbreviation: "CTA", category: "Imaging" },
  { abbreviation: "MRA", category: "Imaging" },
  { abbreviation: "KUB", category: "Imaging" },
  { abbreviation: "RUQ US", category: "Imaging" },
  
  // Medications
  { abbreviation: "ASA", category: "Medication" },
  { abbreviation: "NSAID", category: "Medication" },
  { abbreviation: "ACE-I", category: "Medication" },
  { abbreviation: "ARB", category: "Medication" },
  { abbreviation: "BB", category: "Medication" },
  { abbreviation: "CCB", category: "Medication" },
  { abbreviation: "DOAC", category: "Medication" },
  { abbreviation: "GLP-1", category: "Medication" },
  { abbreviation: "SGLT2-I", category: "Medication" },
  { abbreviation: "DPP-4", category: "Medication" },
  { abbreviation: "TZD", category: "Medication" },
  { abbreviation: "PPI", category: "Medication" },
  { abbreviation: "H2RA", category: "Medication" },
  { abbreviation: "SSRI", category: "Medication" },
  { abbreviation: "SNRI", category: "Medication" },
  { abbreviation: "TCA", category: "Medication" },
  
  // Procedures
  { abbreviation: "PCI", category: "Procedure" },
  { abbreviation: "CABG", category: "Procedure" },
  { abbreviation: "ERCP", category: "Procedure" },
  { abbreviation: "EGD", category: "Procedure" },
  { abbreviation: "Colonoscopy", category: "Procedure" },
  { abbreviation: "LP", category: "Procedure" },
  { abbreviation: "Paracentesis", category: "Procedure" },
  { abbreviation: "Thoracentesis", category: "Procedure" },
  { abbreviation: "I&D", category: "Procedure" },
  
  // Cardiology
  { abbreviation: "EKG/ECG", category: "Cardiology" },
  { abbreviation: "Echo", category: "Cardiology" },
  { abbreviation: "TEE", category: "Cardiology" },
  { abbreviation: "TTE", category: "Cardiology" },
  { abbreviation: "Cath", category: "Cardiology" },
  { abbreviation: "EF", category: "Cardiology" },
  { abbreviation: "AF/AFib", category: "Cardiology" },
  { abbreviation: "VT", category: "Cardiology" },
  { abbreviation: "VF", category: "Cardiology" },
  { abbreviation: "SVT", category: "Cardiology" },
  { abbreviation: "PAC", category: "Cardiology" },
  { abbreviation: "PVC", category: "Cardiology" },
  
  // Pulmonary
  { abbreviation: "SOB", category: "Pulmonary" },
  { abbreviation: "DOE", category: "Pulmonary" },
  { abbreviation: "PND", category: "Pulmonary" },
  { abbreviation: "PFT", category: "Pulmonary" },
  { abbreviation: "FEV1", category: "Pulmonary" },
  { abbreviation: "FVC", category: "Pulmonary" },
  { abbreviation: "DLCO", category: "Pulmonary" },
  
  // GI
  { abbreviation: "N/V", category: "GI" },
  { abbreviation: "LLQ", category: "GI" },
  { abbreviation: "RLQ", category: "GI" },
  { abbreviation: "RUQ", category: "GI" },
  { abbreviation: "LUQ", category: "GI" },
  { abbreviation: "BRBPR", category: "GI" },
  
  // Neuro
  { abbreviation: "LOC", category: "Neuro" },
  { abbreviation: "AMS", category: "Neuro" },
  { abbreviation: "HA", category: "Neuro" },
  { abbreviation: "CN", category: "Neuro" },
  { abbreviation: "DTR", category: "Neuro" },
  { abbreviation: "GCS", category: "Neuro" },
  { abbreviation: "NIHSS", category: "Neuro" },
  
  // General Medical
  { abbreviation: "H&P", category: "General" },
  { abbreviation: "HPI", category: "General" },
  { abbreviation: "ROS", category: "General" },
  { abbreviation: "PMH", category: "General" },
  { abbreviation: "PSH", category: "General" },
  { abbreviation: "FH", category: "General" },
  { abbreviation: "SH", category: "General" },
  { abbreviation: "A&O", category: "General" },
  { abbreviation: "NAD", category: "General" },
  { abbreviation: "WNL", category: "General" },
  { abbreviation: "VS", category: "General" },
  { abbreviation: "BP", category: "General" },
  { abbreviation: "HR", category: "General" },
  { abbreviation: "RR", category: "General" },
  { abbreviation: "O2 Sat", category: "General" },
  
  // Emergency/Critical Care
  { abbreviation: "ACLS", category: "Emergency" },
  { abbreviation: "BLS", category: "Emergency" },
  { abbreviation: "CPR", category: "Emergency" },
  { abbreviation: "ICU", category: "Emergency" },
  { abbreviation: "ED", category: "Emergency" },
  { abbreviation: "EMS", category: "Emergency" },
  { abbreviation: "ROSC", category: "Emergency" },
  { abbreviation: "AED", category: "Emergency" },
  
  // Orders
  { abbreviation: "NPO", category: "Orders" },
  { abbreviation: "DNR", category: "Orders" },
  { abbreviation: "DNI", category: "Orders" },
  { abbreviation: "Code Status", category: "Orders" },
  { abbreviation: "D/C", category: "Orders" },
  { abbreviation: "PRN", category: "Orders" },
  { abbreviation: "BID", category: "Orders" },
  { abbreviation: "TID", category: "Orders" },
  { abbreviation: "QID", category: "Orders" },
  { abbreviation: "QHS", category: "Orders" },
  { abbreviation: "PO", category: "Orders" },
  { abbreviation: "IV", category: "Orders" },
  { abbreviation: "IM", category: "Orders" },
  { abbreviation: "SQ/SC", category: "Orders" },
];

export function buildAbbreviationId(abbr: AbbreviationMeta): string {
  return abbr.abbreviation.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
