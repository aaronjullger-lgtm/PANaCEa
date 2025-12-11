// imagingRegistry.ts
/**
 * Imaging Registry - Source of Truth for Radiology & Imaging Modalities
 * 
 * This registry defines all imaging studies with BARE MINIMUM metadata.
 * All detailed content (indications, technique, interpretation, findings)
 * is AI-generated during sync using Gemini API.
 * 
 * Add imaging studies here, then run `npm run sync:imaging` to populate the database.
 */

export interface ImagingMeta {
  name: string;
  modality: string; // X-Ray, CT, MRI, Ultrasound, Nuclear Medicine, etc.
  bodyRegion?: string; // Chest, Abdomen, Head, MSK, etc.
  
  // Optional: Very basic info
  usesContrast?: boolean;
  usesRadiation?: boolean;
}

// =============================================================================
// X-RAY (PLAIN FILM)
// =============================================================================

export const IMAGING_REGISTRY_XRAY: ImagingMeta[] = [
  { name: "Chest X-Ray (CXR)", modality: "X-Ray", bodyRegion: "Chest", usesRadiation: true },
  { name: "Abdominal X-Ray (KUB)", modality: "X-Ray", bodyRegion: "Abdomen", usesRadiation: true },
  { name: "Cervical Spine X-Ray", modality: "X-Ray", bodyRegion: "Spine", usesRadiation: true },
  { name: "Lumbar Spine X-Ray", modality: "X-Ray", bodyRegion: "Spine", usesRadiation: true },
  { name: "Thoracic Spine X-Ray", modality: "X-Ray", bodyRegion: "Spine", usesRadiation: true },
  { name: "Shoulder X-Ray", modality: "X-Ray", bodyRegion: "Shoulder", usesRadiation: true },
  { name: "Elbow X-Ray", modality: "X-Ray", bodyRegion: "Elbow", usesRadiation: true },
  { name: "Wrist X-Ray", modality: "X-Ray", bodyRegion: "Wrist", usesRadiation: true },
  { name: "Hand X-Ray", modality: "X-Ray", bodyRegion: "Hand", usesRadiation: true },
  { name: "Hip X-Ray", modality: "X-Ray", bodyRegion: "Hip", usesRadiation: true },
  { name: "Knee X-Ray", modality: "X-Ray", bodyRegion: "Knee", usesRadiation: true },
  { name: "Ankle X-Ray", modality: "X-Ray", bodyRegion: "Ankle", usesRadiation: true },
  { name: "Foot X-Ray", modality: "X-Ray", bodyRegion: "Foot", usesRadiation: true },
  { name: "Skull X-Ray", modality: "X-Ray", bodyRegion: "Head", usesRadiation: true },
  { name: "Pelvis X-Ray", modality: "X-Ray", bodyRegion: "Pelvis", usesRadiation: true },
];

// =============================================================================
// COMPUTED TOMOGRAPHY (CT)
// =============================================================================

export const IMAGING_REGISTRY_CT: ImagingMeta[] = [
  { name: "CT Head (Non-Contrast)", modality: "CT", bodyRegion: "Head", usesRadiation: true },
  { name: "CT Head (With Contrast)", modality: "CT", bodyRegion: "Head", usesRadiation: true, usesContrast: true },
  { name: "CT Chest", modality: "CT", bodyRegion: "Chest", usesRadiation: true },
  { name: "CT Chest with IV Contrast", modality: "CT", bodyRegion: "Chest", usesRadiation: true, usesContrast: true },
  { name: "CT Pulmonary Angiogram (CTPA)", modality: "CT", bodyRegion: "Chest", usesRadiation: true, usesContrast: true },
  { name: "CT Abdomen/Pelvis", modality: "CT", bodyRegion: "Abdomen", usesRadiation: true },
  { name: "CT Abdomen/Pelvis with Contrast", modality: "CT", bodyRegion: "Abdomen", usesRadiation: true, usesContrast: true },
  { name: "CT Angiography (CTA) - Various", modality: "CT", usesRadiation: true, usesContrast: true },
  { name: "CT Cervical Spine", modality: "CT", bodyRegion: "Spine", usesRadiation: true },
  { name: "CT Lumbar Spine", modality: "CT", bodyRegion: "Spine", usesRadiation: true },
  { name: "CT Sinus", modality: "CT", bodyRegion: "Head", usesRadiation: true },
];

// =============================================================================
// MAGNETIC RESONANCE IMAGING (MRI)
// =============================================================================

export const IMAGING_REGISTRY_MRI: ImagingMeta[] = [
  { name: "MRI Brain (Non-Contrast)", modality: "MRI", bodyRegion: "Head", usesRadiation: false },
  { name: "MRI Brain (With Gadolinium)", modality: "MRI", bodyRegion: "Head", usesRadiation: false, usesContrast: true },
  { name: "MRI Cervical Spine", modality: "MRI", bodyRegion: "Spine", usesRadiation: false },
  { name: "MRI Thoracic Spine", modality: "MRI", bodyRegion: "Spine", usesRadiation: false },
  { name: "MRI Lumbar Spine", modality: "MRI", bodyRegion: "Spine", usesRadiation: false },
  { name: "MRI Shoulder", modality: "MRI", bodyRegion: "Shoulder", usesRadiation: false },
  { name: "MRI Knee", modality: "MRI", bodyRegion: "Knee", usesRadiation: false },
  { name: "MRI Hip", modality: "MRI", bodyRegion: "Hip", usesRadiation: false },
  { name: "MRI Abdomen/Pelvis", modality: "MRI", bodyRegion: "Abdomen", usesRadiation: false },
  { name: "MRCP (MR Cholangiopancreatography)", modality: "MRI", bodyRegion: "Abdomen", usesRadiation: false },
  { name: "MR Angiography (MRA) - Various", modality: "MRI", usesRadiation: false },
  { name: "Cardiac MRI", modality: "MRI", bodyRegion: "Chest", usesRadiation: false },
];

// =============================================================================
// ULTRASOUND
// =============================================================================

export const IMAGING_REGISTRY_US: ImagingMeta[] = [
  { name: "Abdominal Ultrasound", modality: "Ultrasound", bodyRegion: "Abdomen", usesRadiation: false },
  { name: "Right Upper Quadrant (RUQ) Ultrasound", modality: "Ultrasound", bodyRegion: "Abdomen", usesRadiation: false },
  { name: "Renal Ultrasound", modality: "Ultrasound", bodyRegion: "Abdomen", usesRadiation: false },
  { name: "Pelvic Ultrasound", modality: "Ultrasound", bodyRegion: "Pelvis", usesRadiation: false },
  { name: "Transvaginal Ultrasound", modality: "Ultrasound", bodyRegion: "Pelvis", usesRadiation: false },
  { name: "Obstetric Ultrasound", modality: "Ultrasound", bodyRegion: "Pelvis", usesRadiation: false },
  { name: "Thyroid Ultrasound", modality: "Ultrasound", bodyRegion: "Neck", usesRadiation: false },
  { name: "Carotid Doppler Ultrasound", modality: "Ultrasound", bodyRegion: "Neck", usesRadiation: false },
  { name: "Lower Extremity Venous Doppler", modality: "Ultrasound", bodyRegion: "Leg", usesRadiation: false },
  { name: "Echocardiogram (Transthoracic)", modality: "Ultrasound", bodyRegion: "Chest", usesRadiation: false },
  { name: "Transesophageal Echocardiogram (TEE)", modality: "Ultrasound", bodyRegion: "Chest", usesRadiation: false },
  { name: "FAST Exam (Focused Assessment with Sonography for Trauma)", modality: "Ultrasound", bodyRegion: "Abdomen", usesRadiation: false },
  { name: "Scrotal Ultrasound", modality: "Ultrasound", bodyRegion: "Pelvis", usesRadiation: false },
  { name: "Breast Ultrasound", modality: "Ultrasound", bodyRegion: "Breast", usesRadiation: false },
];

// =============================================================================
// NUCLEAR MEDICINE
// =============================================================================

export const IMAGING_REGISTRY_NUCLEAR: ImagingMeta[] = [
  { name: "V/Q Scan (Ventilation-Perfusion Scan)", modality: "Nuclear Medicine", bodyRegion: "Chest", usesRadiation: true },
  { name: "Bone Scan (Skeletal Scintigraphy)", modality: "Nuclear Medicine", usesRadiation: true },
  { name: "Thyroid Scan (I-123 or Tc-99m)", modality: "Nuclear Medicine", bodyRegion: "Neck", usesRadiation: true },
  { name: "HIDA Scan (Hepatobiliary Scan)", modality: "Nuclear Medicine", bodyRegion: "Abdomen", usesRadiation: true },
  { name: "Cardiac Stress Test (Nuclear)", modality: "Nuclear Medicine", bodyRegion: "Chest", usesRadiation: true },
  { name: "PET Scan (Positron Emission Tomography)", modality: "Nuclear Medicine", usesRadiation: true },
  { name: "PET/CT", modality: "Nuclear Medicine", usesRadiation: true },
  { name: "Renal Scan (DMSA or MAG3)", modality: "Nuclear Medicine", bodyRegion: "Abdomen", usesRadiation: true },
];

// =============================================================================
// FLUOROSCOPY & CONTRAST STUDIES
// =============================================================================

export const IMAGING_REGISTRY_FLUORO: ImagingMeta[] = [
  { name: "Upper GI Series (Barium Swallow)", modality: "Fluoroscopy", bodyRegion: "GI", usesRadiation: true, usesContrast: true },
  { name: "Small Bowel Follow-Through", modality: "Fluoroscopy", bodyRegion: "GI", usesRadiation: true, usesContrast: true },
  { name: "Barium Enema", modality: "Fluoroscopy", bodyRegion: "GI", usesRadiation: true, usesContrast: true },
  { name: "ERCP (Endoscopic Retrograde Cholangiopancreatography)", modality: "Fluoroscopy", bodyRegion: "GI", usesRadiation: true, usesContrast: true },
  { name: "Hysterosalpingogram (HSG)", modality: "Fluoroscopy", bodyRegion: "Pelvis", usesRadiation: true, usesContrast: true },
  { name: "Voiding Cystourethrogram (VCUG)", modality: "Fluoroscopy", bodyRegion: "Pelvis", usesRadiation: true, usesContrast: true },
];

// =============================================================================
// MAMMOGRAPHY
// =============================================================================

export const IMAGING_REGISTRY_MAMMO: ImagingMeta[] = [
  { name: "Screening Mammogram", modality: "Mammography", bodyRegion: "Breast", usesRadiation: true },
  { name: "Diagnostic Mammogram", modality: "Mammography", bodyRegion: "Breast", usesRadiation: true },
  { name: "Breast MRI", modality: "MRI", bodyRegion: "Breast", usesRadiation: false },
];

// =============================================================================
// EXPORT ALL IMAGING STUDIES
// =============================================================================

export const IMAGING_REGISTRY: ImagingMeta[] = [
  ...IMAGING_REGISTRY_XRAY,
  ...IMAGING_REGISTRY_CT,
  ...IMAGING_REGISTRY_MRI,
  ...IMAGING_REGISTRY_US,
  ...IMAGING_REGISTRY_NUCLEAR,
  ...IMAGING_REGISTRY_FLUORO,
  ...IMAGING_REGISTRY_MAMMO,
];

export function buildImagingId(imaging: ImagingMeta): string {
  return imaging.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
