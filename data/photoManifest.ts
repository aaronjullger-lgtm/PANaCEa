/**
 * Photo Drill Manifest
 * 
 * This file maps medical conditions to their image files.
 * Images should be uploaded to the /public/images/photo-drill/ directory.
 * 
 * The structure auto-matches image files to conditions by name.
 * Place images in the appropriate category folder:
 *   - /public/images/photo-drill/ecg/       - ECG images
 *   - /public/images/photo-drill/derm/      - Dermatology images
 *   - /public/images/photo-drill/radiology/ - X-ray/imaging images
 * 
 * File naming convention:
 *   - Use the condition name in lowercase with hyphens
 *   - Example: "atrial-fibrillation.jpg", "pneumothorax.jpg"
 *   - Multiple images: "atrial-fibrillation-1.jpg", "atrial-fibrillation-2.jpg"
 */

export type PhotoCategory = 'ecg' | 'derm' | 'radiology';

export interface PhotoManifestEntry {
  /** The condition name (should match exactly with drill data) */
  condition: string;
  /** Category of the image */
  category: PhotoCategory;
  /** Relative path to the image file(s) */
  images: string[];
  /** Educational caption shown after answering */
  educationalCaption: string;
  /** Key findings to identify this condition */
  keyFindings: string[];
}

/**
 * ECG Conditions Manifest
 */
export const ECG_MANIFEST: PhotoManifestEntry[] = [
  {
    condition: 'Atrial Fibrillation',
    category: 'ecg',
    images: ['atrial-fibrillation.jpg'],
    educationalCaption: 'Irregularly irregular rhythm with absent P waves. Note the fibrillatory baseline and variable R-R intervals.',
    keyFindings: [
      'Irregularly irregular rhythm',
      'Absent P waves',
      'Fibrillatory baseline',
      'Variable R-R intervals',
    ],
  },
  {
    condition: 'Atrial Flutter',
    category: 'ecg',
    images: ['atrial-flutter.jpg'],
    educationalCaption: 'Sawtooth flutter waves (F waves) best seen in leads II, III, and aVF. Often has a fixed conduction ratio (e.g., 2:1, 3:1).',
    keyFindings: [
      'Sawtooth flutter waves',
      'Regular atrial rate ~300 bpm',
      'Usually 2:1 or 4:1 AV block',
      'Regular ventricular rate',
    ],
  },
  {
    condition: 'Ventricular Tachycardia',
    category: 'ecg',
    images: [], // Add: ['ventricular-tachycardia.jpg']
    educationalCaption: 'Wide complex tachycardia with rate >100 bpm. AV dissociation is a key diagnostic feature.',
    keyFindings: [
      'Wide QRS complex (>120ms)',
      'Rate >100 bpm',
      'AV dissociation',
      'Fusion/capture beats',
    ],
  },
  {
    condition: 'STEMI',
    category: 'ecg',
    images: [], // Add: ['stemi.jpg']
    educationalCaption: 'ST segment elevation in contiguous leads with reciprocal changes. Indicates acute myocardial infarction requiring emergent intervention.',
    keyFindings: [
      'ST elevation ≥1mm in limb leads',
      'ST elevation ≥2mm in precordial leads',
      'Reciprocal ST depression',
      'Q waves may develop',
    ],
  },
  {
    condition: 'NSTEMI',
    category: 'ecg',
    images: [], // Add: ['nstemi.jpg']
    educationalCaption: 'ST depression or T wave inversions without ST elevation. Requires troponin elevation for diagnosis.',
    keyFindings: [
      'ST depression',
      'T wave inversions',
      'No ST elevation',
      'Elevated troponin required',
    ],
  },
  {
    condition: 'Pericarditis',
    category: 'ecg',
    images: [], // Add: ['pericarditis.jpg']
    educationalCaption: 'Diffuse ST elevation with PR depression. PR elevation in aVR is highly specific.',
    keyFindings: [
      'Diffuse ST elevation',
      'PR depression',
      'PR elevation in aVR',
      'No reciprocal changes',
    ],
  },
  {
    condition: 'Sinus Bradycardia',
    category: 'ecg',
    images: [], // Add: ['sinus-bradycardia.jpg']
    educationalCaption: 'Normal sinus rhythm with rate <60 bpm. May be normal in athletes or during sleep.',
    keyFindings: [
      'Regular P waves before QRS',
      'Rate <60 bpm',
      'Normal PR interval',
      'Normal QRS complex',
    ],
  },
  {
    condition: 'Heart Block',
    category: 'ecg',
    images: [], // Add: ['heart-block.jpg']
    educationalCaption: 'Varying degrees of AV conduction delay. Third degree shows complete dissociation between P waves and QRS complexes.',
    keyFindings: [
      'Prolonged PR interval (1st degree)',
      'Progressive PR lengthening (2nd degree Mobitz I)',
      'Dropped beats (2nd degree)',
      'Complete AV dissociation (3rd degree)',
    ],
  },
  {
    condition: 'Hyperkalemia',
    category: 'ecg',
    images: [], // Add: ['hyperkalemia.jpg']
    educationalCaption: 'Peaked T waves, prolonged PR, widened QRS. Severe cases show sine wave pattern - a medical emergency.',
    keyFindings: [
      'Peaked T waves',
      'Prolonged PR interval',
      'Widened QRS complex',
      'Absent P waves in severe cases',
    ],
  },
  {
    condition: 'Wolff-Parkinson-White Syndrome',
    category: 'ecg',
    images: [], // Add: ['wpw.jpg']
    educationalCaption: 'Short PR interval with delta wave (slurred upstroke of QRS). Caused by accessory pathway.',
    keyFindings: [
      'Short PR interval (<120ms)',
      'Delta wave',
      'Wide QRS complex',
      'Secondary ST-T changes',
    ],
  },
];

/**
 * Dermatology Conditions Manifest
 */
export const DERM_MANIFEST: PhotoManifestEntry[] = [
  {
    condition: 'Psoriasis',
    category: 'derm',
    images: [], // Add: ['psoriasis.jpg']
    educationalCaption: 'Well-demarcated erythematous plaques with silvery scales, classically on extensor surfaces. Auspitz sign positive.',
    keyFindings: [
      'Well-demarcated plaques',
      'Silvery scales',
      'Extensor surfaces',
      'Auspitz sign (pinpoint bleeding)',
    ],
  },
  {
    condition: 'Eczema',
    category: 'derm',
    images: [], // Add: ['eczema.jpg']
    educationalCaption: 'Pruritic, erythematous patches with vesicles in acute phase. Chronic lesions show lichenification.',
    keyFindings: [
      'Pruritic lesions',
      'Erythematous patches',
      'Vesicles (acute)',
      'Lichenification (chronic)',
    ],
  },
  {
    condition: 'Shingles',
    category: 'derm',
    images: [], // Add: ['shingles.jpg']
    educationalCaption: 'Unilateral dermatomal distribution of grouped vesicles on erythematous base. Pain often precedes rash.',
    keyFindings: [
      'Unilateral distribution',
      'Dermatomal pattern',
      'Grouped vesicles',
      'Erythematous base',
    ],
  },
  {
    condition: 'Contact Dermatitis',
    category: 'derm',
    images: [], // Add: ['contact-dermatitis.jpg']
    educationalCaption: 'Pruritic, erythematous patches with vesicles in pattern of allergen contact. Linear lesions suggest plant exposure.',
    keyFindings: [
      'Well-demarcated borders',
      'Pattern matches exposure',
      'Vesicles and weeping',
      'Intense pruritus',
    ],
  },
  {
    condition: 'Cellulitis',
    category: 'derm',
    images: [], // Add: ['cellulitis.jpg']
    educationalCaption: 'Warm, erythematous, tender plaque with indistinct borders. Often unilateral lower extremity.',
    keyFindings: [
      'Warmth and tenderness',
      'Erythema with indistinct borders',
      'Swelling',
      'Systemic symptoms possible',
    ],
  },
  {
    condition: 'Melanoma',
    category: 'derm',
    images: [], // Add: ['melanoma.jpg']
    educationalCaption: 'Asymmetric pigmented lesion with irregular borders, color variation, diameter >6mm, and evolution over time (ABCDEs).',
    keyFindings: [
      'Asymmetry',
      'Border irregularity',
      'Color variation',
      'Diameter >6mm',
    ],
  },
  {
    condition: 'Basal Cell Carcinoma',
    category: 'derm',
    images: [], // Add: ['basal-cell-carcinoma.jpg']
    educationalCaption: 'Pearly, translucent papule or nodule with telangiectasias. Rolled borders with central ulceration (rodent ulcer).',
    keyFindings: [
      'Pearly appearance',
      'Telangiectasias',
      'Rolled borders',
      'Central ulceration',
    ],
  },
  {
    condition: 'Impetigo',
    category: 'derm',
    images: [], // Add: ['impetigo.jpg']
    educationalCaption: 'Honey-crusted lesions, typically on face. Common in children. Caused by S. aureus or Group A Strep.',
    keyFindings: [
      'Honey-colored crusts',
      'Superficial erosions',
      'Clustered vesicles/pustules',
      'Common on face',
    ],
  },
];

/**
 * Radiology Conditions Manifest
 */
export const RADIOLOGY_MANIFEST: PhotoManifestEntry[] = [
  {
    condition: 'Pneumothorax',
    category: 'radiology',
    images: [], // Add: ['pneumothorax.jpg']
    educationalCaption: 'Absence of lung markings peripherally with visible visceral pleural line. Look for mediastinal shift in tension pneumothorax.',
    keyFindings: [
      'Absent lung markings peripherally',
      'Visible pleural line',
      'Lung collapse',
      'Mediastinal shift (tension)',
    ],
  },
  {
    condition: 'Pneumonia',
    category: 'radiology',
    images: [], // Add: ['pneumonia.jpg']
    educationalCaption: 'Consolidation with air bronchograms. Lobar pattern suggests bacterial etiology. Interstitial pattern suggests viral/atypical.',
    keyFindings: [
      'Consolidation',
      'Air bronchograms',
      'Silhouette sign',
      'Lobar or interstitial pattern',
    ],
  },
  {
    condition: 'Pulmonary Embolism',
    category: 'radiology',
    images: [], // Add: ['pulmonary-embolism.jpg']
    educationalCaption: 'CXR often normal or shows non-specific findings. Hampton hump (wedge-shaped opacity) or Westermark sign (oligemia) are classic but rare.',
    keyFindings: [
      'Often normal CXR',
      'Hampton hump (rare)',
      'Westermark sign (rare)',
      'CT angiogram is gold standard',
    ],
  },
  {
    condition: 'Pleural Effusion',
    category: 'radiology',
    images: [], // Add: ['pleural-effusion.jpg']
    educationalCaption: 'Blunting of costophrenic angle. Large effusions show homogeneous opacity with meniscus sign.',
    keyFindings: [
      'Blunted costophrenic angle',
      'Meniscus sign',
      'Homogeneous opacity',
      'Mediastinal shift (large)',
    ],
  },
  {
    condition: 'Cardiomegaly',
    category: 'radiology',
    images: [], // Add: ['cardiomegaly.jpg']
    educationalCaption: 'Cardiothoracic ratio >0.5 on PA film. Evaluate for pulmonary vascular congestion and Kerley B lines.',
    keyFindings: [
      'Cardiothoracic ratio >0.5',
      'Enlarged cardiac silhouette',
      'May have pulmonary congestion',
      'Boot-shaped heart in some conditions',
    ],
  },
  {
    condition: 'Rib Fracture',
    category: 'radiology',
    images: [], // Add: ['rib-fracture.jpg']
    educationalCaption: 'Cortical disruption of rib. Watch for associated pneumothorax or hemothorax, especially with multiple fractures.',
    keyFindings: [
      'Cortical disruption',
      'Step-off deformity',
      'May be subtle',
      'Check for associated injuries',
    ],
  },
  {
    condition: 'Gout',
    category: 'radiology',
    images: [], // Add: ['gout.jpg']
    educationalCaption: 'Punched-out erosions with overhanging edges (rat bite erosions). Preserved joint space initially. Tophi may be visible.',
    keyFindings: [
      'Punched-out erosions',
      'Overhanging edges',
      'Preserved joint space',
      'Soft tissue swelling',
    ],
  },
  {
    condition: 'Rheumatoid Arthritis',
    category: 'radiology',
    images: [], // Add: ['rheumatoid-arthritis.jpg']
    educationalCaption: 'Symmetric polyarthritis with periarticular osteopenia, joint space narrowing, and marginal erosions. MCP and PIP joints commonly affected.',
    keyFindings: [
      'Periarticular osteopenia',
      'Symmetric involvement',
      'Marginal erosions',
      'Joint space narrowing',
    ],
  },
];

/**
 * Get all manifest entries
 */
export function getAllPhotoManifest(): PhotoManifestEntry[] {
  return [...ECG_MANIFEST, ...DERM_MANIFEST, ...RADIOLOGY_MANIFEST];
}

/**
 * Get manifest entries by category
 */
export function getManifestByCategory(category: PhotoCategory): PhotoManifestEntry[] {
  switch (category) {
    case 'ecg':
      return ECG_MANIFEST;
    case 'derm':
      return DERM_MANIFEST;
    case 'radiology':
      return RADIOLOGY_MANIFEST;
    default:
      return [];
  }
}

/**
 * Find manifest entry by condition name
 */
export function findManifestEntry(condition: string): PhotoManifestEntry | undefined {
  return getAllPhotoManifest().find(
    entry => entry.condition.toLowerCase() === condition.toLowerCase()
  );
}

/**
 * Get image path for a condition
 * @param condition - The condition name
 * @param index - Index of the image (for conditions with multiple images)
 * @returns The full image path or a placeholder URL
 */
export function getImagePath(condition: string, index: number = 0): string {
  const entry = findManifestEntry(condition);
  
  if (!entry || entry.images.length === 0) {
    // Return placeholder if no image is available
    const categoryColors: Record<PhotoCategory, string> = {
      ecg: '1e293b',
      derm: '8b5cf6',
      radiology: '0ea5e9',
    };
    const color = entry ? categoryColors[entry.category] : '64748b';
    return `https://placehold.co/600x400/${color}/FFF?text=${encodeURIComponent(condition)}`;
  }
  
  const imageFile = entry.images[index] ?? entry.images[0];
  return `/images/photo-drill/${entry.category}/${imageFile}`;
}

/**
 * Check if a condition has real images (not placeholders)
 */
export function hasRealImages(condition: string): boolean {
  const entry = findManifestEntry(condition);
  return entry !== undefined && entry.images.length > 0;
}

export default {
  ECG_MANIFEST,
  DERM_MANIFEST,
  RADIOLOGY_MANIFEST,
  getAllPhotoManifest,
  getManifestByCategory,
  findManifestEntry,
  getImagePath,
  hasRealImages,
};
