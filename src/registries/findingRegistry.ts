// findingRegistry.ts
/**
 * Physical Exam Finding Registry
 *
 * Bare-bones registry of physical exam findings. AI generates:
 * - Detailed description of finding
 * - How to elicit/assess
 * - Clinical significance
 * - Associated conditions
 * - Differential diagnosis
 */

export interface FindingMeta {
  name: string;
  system: string; // CV, PULM, GI, NEURO, MSK, HEENT, DERM, etc.
}

export const FINDING_REGISTRY: FindingMeta[] = [
  // Cardiovascular
  { name: 'Jugular Venous Distension (JVD)', system: 'CV' },
  { name: 'S3 Gallop', system: 'CV' },
  { name: 'S4 Gallop', system: 'CV' },
  { name: 'Systolic Murmur', system: 'CV' },
  { name: 'Diastolic Murmur', system: 'CV' },
  { name: 'Pericardial Friction Rub', system: 'CV' },
  { name: 'Peripheral Edema', system: 'CV' },
  { name: 'Absent Peripheral Pulses', system: 'CV' },
  { name: 'Carotid Bruit', system: 'CV' },

  // Pulmonary
  { name: 'Crackles/Rales', system: 'PULM' },
  { name: 'Wheezes', system: 'PULM' },
  { name: 'Rhonchi', system: 'PULM' },
  { name: 'Stridor', system: 'PULM' },
  { name: 'Decreased Breath Sounds', system: 'PULM' },
  { name: 'Dullness to Percussion', system: 'PULM' },
  { name: 'Hyperresonance to Percussion', system: 'PULM' },
  { name: 'Tactile Fremitus', system: 'PULM' },
  { name: 'Egophony', system: 'PULM' },

  // Gastrointestinal
  { name: 'Abdominal Distension', system: 'GI' },
  { name: 'Rebound Tenderness', system: 'GI' },
  { name: 'Guarding', system: 'GI' },
  { name: "Murphy's Sign", system: 'GI' },
  { name: "McBurney's Point Tenderness", system: 'GI' },
  { name: 'Hepatomegaly', system: 'GI' },
  { name: 'Splenomegaly', system: 'GI' },
  { name: 'Ascites', system: 'GI' },
  { name: 'Hyperactive Bowel Sounds', system: 'GI' },
  { name: 'Absent Bowel Sounds', system: 'GI' },

  // Neurologic
  { name: 'Babinski Sign', system: 'NEURO' },
  { name: 'Clonus', system: 'NEURO' },
  { name: 'Hyperreflexia', system: 'NEURO' },
  { name: 'Hyporeflexia', system: 'NEURO' },
  { name: 'Muscle Atrophy', system: 'NEURO' },
  { name: 'Fasciculations', system: 'NEURO' },
  { name: 'Pronator Drift', system: 'NEURO' },
  { name: 'Nystagmus', system: 'NEURO' },
  { name: 'Papilledema', system: 'NEURO' },
  { name: 'Cranial Nerve Deficits', system: 'NEURO' },

  // Musculoskeletal
  { name: 'Joint Effusion', system: 'MSK' },
  { name: 'Crepitus', system: 'MSK' },
  { name: 'Limited Range of Motion', system: 'MSK' },
  { name: 'Muscle Spasm', system: 'MSK' },
  { name: 'Point Tenderness', system: 'MSK' },
  { name: 'Swelling/Edema (Localized)', system: 'MSK' },
  { name: 'Erythema', system: 'MSK' },
  { name: 'Warmth', system: 'MSK' },

  // HEENT
  { name: 'Exophthalmos', system: 'HEENT' },
  { name: 'Conjunctival Injection', system: 'HEENT' },
  { name: 'Pharyngeal Erythema', system: 'HEENT' },
  { name: 'Tonsillar Exudate', system: 'HEENT' },
  { name: 'Lymphadenopathy', system: 'HEENT' },
  { name: 'Thyromegaly', system: 'HEENT' },
  { name: 'Tympanic Membrane Erythema', system: 'HEENT' },
  { name: 'Nasal Polyps', system: 'HEENT' },

  // Dermatologic
  { name: 'Macular Rash', system: 'DERM' },
  { name: 'Papular Rash', system: 'DERM' },
  { name: 'Vesicular Rash', system: 'DERM' },
  { name: 'Petechiae', system: 'DERM' },
  { name: 'Purpura', system: 'DERM' },
  { name: 'Ecchymosis', system: 'DERM' },
  { name: 'Jaundice', system: 'DERM' },
  { name: 'Cyanosis', system: 'DERM' },
  { name: 'Pallor', system: 'DERM' },
];

export function buildFindingId(finding: FindingMeta): string {
  return finding.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
