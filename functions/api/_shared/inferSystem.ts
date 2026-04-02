/**
 * Shared system inference utility.
 *
 * Prefers the stored `targetSystem` field on PatientEncounterCase.
 * Falls back to regex-based inference from chief complaint + diagnosis
 * when the stored field is null/empty (legacy cases).
 */

/** Regex-based fallback — used only when targetSystem is not stored on the case. */
export function inferSystemFromText(chiefComplaint: string, correctDiagnosis: string): string {
  const text = `${chiefComplaint} ${correctDiagnosis}`.toLowerCase();
  if (/\b(heart|cardiac|chest pain|acs|mi|coronary|chf|heart failure|decompensated)\b/.test(text)) return 'cardiovascular';
  if (/\b(dvt|deep vein|thrombosis|embol)\b/.test(text)) return 'cardiovascular';
  if (/\b(lung|pulmonary|dyspnea|copd|asthma|pe|wheez)\b/.test(text)) return 'pulmonary';
  if (/\b(gi|abdominal|hepatic|pancreat|appendic)\b/.test(text)) return 'gastrointestinal';
  if (/\b(neuro|stroke|seizure|headache|weakness|slurred|aphasia|tia)\b/.test(text)) return 'neurological';
  if (/\b(renal|kidney|aki|ckd|urosepsis)\b/.test(text)) return 'nephrology';
  if (/\b(infection|sepsis|uti|pneumonia|cellulitis|meningit)\b/.test(text)) return 'infectious_disease';
  if (/\b(diabetes|diabetic|dka|ketoacidosis|hyperglycemi)\b/.test(text)) return 'endocrine';
  if (/\b(ectopic|pregnan|obstetric|gynecolog|ovarian)\b/.test(text)) return 'reproductive';
  if (/\b(psych|depression|anxiety|suicid|bipolar|schizo)\b/.test(text)) return 'psychiatry';
  if (/\b(anemia|leukemia|lymphoma|coagul|thrombocytop)\b/.test(text)) return 'hematology';
  if (/\b(fracture|orthoped|musculoskel|joint|back pain)\b/.test(text)) return 'musculoskeletal';
  if (/\b(dermat|rash|skin|wound|burn)\b/.test(text)) return 'dermatology';
  return 'general';
}

/**
 * Resolve the organ system for a case.
 *
 * @param targetSystem - The stored `PatientEncounterCase.targetSystem` (preferred)
 * @param chiefComplaint - Used for regex fallback
 * @param correctDiagnosis - Used for regex fallback
 */
export function resolveSystem(
  targetSystem: string | null | undefined,
  chiefComplaint: string,
  correctDiagnosis: string,
): string {
  if (targetSystem && targetSystem.trim().length > 0) return targetSystem.trim().toLowerCase();
  return inferSystemFromText(chiefComplaint, correctDiagnosis);
}
