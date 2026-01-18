// surgeryRegistry.ts
/**
 * Surgery/Procedure Registry
 *
 * Bare-bones registry of surgical procedures. AI generates:
 * - Detailed procedure description
 * - Indications
 * - Contraindications
 * - Complications
 * - Post-operative care
 * - Recovery timeline
 */

export interface SurgeryMeta {
  name: string;
  specialty: string; // General Surgery, Orthopedic, Cardiac, Neuro, OB/GYN, Urology, etc.
  isEmergent?: boolean; // Can this be an emergency procedure?
}

export const SURGERY_REGISTRY: SurgeryMeta[] = [
  // General Surgery
  { name: 'Appendectomy', specialty: 'General Surgery', isEmergent: true },
  { name: 'Cholecystectomy', specialty: 'General Surgery', isEmergent: false },
  { name: 'Hernia Repair (Inguinal)', specialty: 'General Surgery' },
  { name: 'Hernia Repair (Umbilical)', specialty: 'General Surgery' },
  { name: 'Colectomy', specialty: 'General Surgery' },
  { name: 'Bowel Resection', specialty: 'General Surgery', isEmergent: true },
  { name: 'Exploratory Laparotomy', specialty: 'General Surgery', isEmergent: true },
  { name: 'Mastectomy', specialty: 'General Surgery' },
  { name: 'Thyroidectomy', specialty: 'General Surgery' },

  // Orthopedic Surgery
  { name: 'Total Hip Arthroplasty (Hip Replacement)', specialty: 'Orthopedic' },
  { name: 'Total Knee Arthroplasty (Knee Replacement)', specialty: 'Orthopedic' },
  { name: 'ACL Reconstruction', specialty: 'Orthopedic' },
  { name: 'Rotator Cuff Repair', specialty: 'Orthopedic' },
  { name: 'Carpal Tunnel Release', specialty: 'Orthopedic' },
  { name: 'Spinal Fusion', specialty: 'Orthopedic' },
  { name: 'Laminectomy', specialty: 'Orthopedic' },
  { name: 'Open Reduction Internal Fixation (ORIF)', specialty: 'Orthopedic', isEmergent: true },
  { name: 'Meniscectomy', specialty: 'Orthopedic' },

  // Cardiac Surgery
  { name: 'Coronary Artery Bypass Graft (CABG)', specialty: 'Cardiac' },
  { name: 'Valve Replacement (Aortic)', specialty: 'Cardiac' },
  { name: 'Valve Replacement (Mitral)', specialty: 'Cardiac' },
  { name: 'Pacemaker Insertion', specialty: 'Cardiac' },
  { name: 'ICD (Implantable Cardioverter-Defibrillator) Placement', specialty: 'Cardiac' },

  // Neurosurgery
  { name: 'Craniotomy', specialty: 'Neurosurgery', isEmergent: true },
  { name: 'Burr Hole Evacuation (Subdural Hematoma)', specialty: 'Neurosurgery', isEmergent: true },
  { name: 'VP Shunt Placement', specialty: 'Neurosurgery' },
  { name: 'Discectomy', specialty: 'Neurosurgery' },

  // OB/GYN
  { name: 'Cesarean Section (C-Section)', specialty: 'OB/GYN', isEmergent: true },
  { name: 'Hysterectomy', specialty: 'OB/GYN' },
  { name: 'Dilation and Curettage (D&C)', specialty: 'OB/GYN' },
  { name: 'Tubal Ligation', specialty: 'OB/GYN' },
  { name: 'Oophorectomy', specialty: 'OB/GYN' },

  // Urology
  { name: 'TURP (Transurethral Resection of Prostate)', specialty: 'Urology' },
  { name: 'Nephrectomy', specialty: 'Urology' },
  { name: 'Cystoscopy', specialty: 'Urology' },
  { name: 'Ureteroscopy with Stone Removal', specialty: 'Urology' },
  { name: 'Vasectomy', specialty: 'Urology' },

  // Vascular Surgery
  { name: 'Carotid Endarterectomy', specialty: 'Vascular' },
  { name: 'Aneurysm Repair (AAA)', specialty: 'Vascular', isEmergent: true },
  { name: 'AV Fistula Creation', specialty: 'Vascular' },
  { name: 'Thrombectomy', specialty: 'Vascular', isEmergent: true },

  // ENT
  { name: 'Tonsillectomy', specialty: 'ENT' },
  { name: 'Adenoidectomy', specialty: 'ENT' },
  { name: 'Tracheostomy', specialty: 'ENT', isEmergent: true },
  { name: 'Septoplasty', specialty: 'ENT' },
  { name: 'Tympanoplasty', specialty: 'ENT' },

  // Ophthalmology
  { name: 'Cataract Surgery', specialty: 'Ophthalmology' },
  { name: 'LASIK', specialty: 'Ophthalmology' },
  { name: 'Vitrectomy', specialty: 'Ophthalmology' },
  { name: 'Glaucoma Surgery', specialty: 'Ophthalmology' },
];

export function buildSurgeryId(surgery: SurgeryMeta): string {
  return surgery.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
