#!/usr/bin/env npx tsx
/**
 * Curated Medical Image Sources - v2
 * 
 * IMPORTANT: For Photo Drill mode, we need TWO types of images:
 * 
 * 1. QUIZ images (isAnnotated: false, usageType: 'quiz')
 *    - Clean, un-annotated images
 *    - Student must identify findings themselves
 *    - No arrows, labels, circles
 * 
 * 2. REFERENCE images (isAnnotated: true, usageType: 'reference')  
 *    - Annotated images with teaching labels
 *    - Shown AFTER student answers
 *    - Helps them learn what to look for
 * 
 * Sources:
 * - PhysioNet (ECG) - Clean raw recordings
 * - ECG Wave-Maven (Harvard) - Clean teaching ECGs
 * - Radiopaedia - Clean radiology + annotated versions
 * - DermNet NZ - Clean dermatology photos
 * - LITFL - Annotated ECGs (reference only)
 */

export interface CuratedImage {
  url: string;
  title: string;
  modality: string;
  source: string;
  license: string;
  visualFindings: string;       // What to look for (shown after answer)
  isAnnotated: boolean;         // Has arrows/labels?
  usageType: 'quiz' | 'reference' | 'both';
  verificationNotes?: string;   // How we verified it's clean
}

export interface CuratedCondition {
  conditionId: string;
  images: CuratedImage[];
}

// =============================================================================
// ECG CONDITIONS - Need CLEAN images for quiz mode
// =============================================================================

/**
 * ECG Wave-Maven (Harvard) - These are CLEAN teaching ECGs
 * Most don't have annotations on the actual strip
 */
export const ECG_CLEAN_IMAGES: CuratedCondition[] = [
  {
    conditionId: "CV__ecg__atrial_fibrillation",
    images: [
      {
        url: "https://ecg.bidmc.harvard.edu/maven/case_images/case001.gif",
        title: "Atrial Fibrillation - Clean ECG Strip",
        modality: "ecg",
        source: "ECG Wave-Maven, Harvard",
        license: "Educational Use",
        visualFindings: "Look for: (1) Irregularly irregular R-R intervals, (2) Absence of P waves, (3) Fibrillatory baseline. Rate may be rapid or controlled.",
        isAnnotated: false,
        usageType: "quiz",
        verificationNotes: "Verified clean - no arrows or labels on strip"
      }
    ]
  },
  {
    conditionId: "CV__ecg__atrial_flutter",
    images: [
      {
        url: "https://ecg.bidmc.harvard.edu/maven/case_images/case002.gif",
        title: "Atrial Flutter - Clean ECG Strip", 
        modality: "ecg",
        source: "ECG Wave-Maven, Harvard",
        license: "Educational Use",
        visualFindings: "Look for: (1) 'Sawtooth' flutter waves, especially in II, III, aVF, (2) Regular atrial rate ~300, (3) Fixed AV block ratio (2:1, 3:1, 4:1)",
        isAnnotated: false,
        usageType: "quiz"
      }
    ]
  }
];

/**
 * LITFL ECG Library - Most have annotations, use for REFERENCE only
 */
export const ECG_REFERENCE_IMAGES: CuratedCondition[] = [
  {
    conditionId: "CV__ecg__atrial_fibrillation",
    images: [
      {
        url: "https://litfl.com/wp-content/uploads/2018/08/ECG-Atrial-Fibrillation-AF-2.jpg",
        title: "Atrial Fibrillation - Annotated Reference",
        modality: "ecg",
        source: "LITFL ECG Library",
        license: "CC BY-NC-SA",
        visualFindings: "Note the irregularly irregular R-R intervals, absence of P waves, and chaotic fibrillatory baseline.",
        isAnnotated: true,
        usageType: "reference"
      }
    ]
  },
  {
    conditionId: "CV__ecg__stemi",
    images: [
      {
        url: "https://litfl.com/wp-content/uploads/2018/08/STEMI-inferior-ST-elevation.jpg",
        title: "Inferior STEMI - Annotated Reference",
        modality: "ecg",
        source: "LITFL ECG Library",
        license: "CC BY-NC-SA",
        visualFindings: "ST elevation in II, III, aVF with reciprocal ST depression in aVL.",
        isAnnotated: true,
        usageType: "reference"
      }
    ]
  },
  {
    conditionId: "CV__ecg__wpw_wolff_parkinson_white",
    images: [
      {
        url: "https://litfl.com/wp-content/uploads/2018/08/WPW-Wolff-Parkinson-White-syndrome-ECG.jpg",
        title: "WPW Pattern - Annotated Reference",
        modality: "ecg",
        source: "LITFL ECG Library",
        license: "CC BY-NC-SA",
        visualFindings: "Classic triad: Short PR, delta wave, wide QRS.",
        isAnnotated: true,
        usageType: "reference"
      }
    ]
  }
];

// =============================================================================
// DERMATOLOGY - DermNet NZ has mostly CLEAN clinical photos
// =============================================================================

export const DERMATOLOGY_IMAGES: CuratedCondition[] = [
  {
    conditionId: "DERM__infectious__herpes_zoster",
    images: [
      {
        url: "https://dermnetnz.org/assets/Uploads/topics/herpes-zoster-010-S__JPG.webp",
        title: "Herpes Zoster - Dermatomal Distribution",
        modality: "clinical_photo",
        source: "DermNet NZ",
        license: "CC BY-NC-ND",
        visualFindings: "Look for: (1) Vesicular rash, (2) Dermatomal distribution (doesn't cross midline), (3) Grouped vesicles on erythematous base",
        isAnnotated: false,
        usageType: "quiz",
        verificationNotes: "Clean clinical photo without annotations"
      }
    ]
  },
  {
    conditionId: "DERM__neoplastic__melanoma",
    images: [
      {
        url: "https://dermnetnz.org/assets/Uploads/topics/melanoma-insitu-01__JPG.webp",
        title: "Melanoma in situ",
        modality: "clinical_photo",
        source: "DermNet NZ",
        license: "CC BY-NC-ND",
        visualFindings: "Apply ABCDE: (A) Asymmetry, (B) Border irregularity, (C) Color variation, (D) Diameter >6mm, (E) Evolution/change",
        isAnnotated: false,
        usageType: "quiz"
      }
    ]
  },
  {
    conditionId: "DERM__infectious__cellulitis",
    images: [
      {
        url: "https://dermnetnz.org/assets/Uploads/topics/cellulitis-3__JPG.webp",
        title: "Cellulitis of Lower Leg",
        modality: "clinical_photo",
        source: "DermNet NZ",
        license: "CC BY-NC-ND",
        visualFindings: "Look for: (1) Erythema with poorly demarcated borders, (2) Warmth/swelling, (3) Spreading pattern, (4) May have portal of entry",
        isAnnotated: false,
        usageType: "quiz"
      }
    ]
  },
  {
    conditionId: "DERM__inflammatory__psoriasis",
    images: [
      {
        url: "https://dermnetnz.org/assets/Uploads/topics/plaque-psoriasis-02-S__JPG.webp",
        title: "Plaque Psoriasis",
        modality: "clinical_photo",
        source: "DermNet NZ",
        license: "CC BY-NC-ND",
        visualFindings: "Look for: (1) Well-demarcated erythematous plaques, (2) Silvery scale, (3) Typical distribution (extensor surfaces, scalp)",
        isAnnotated: false,
        usageType: "quiz"
      }
    ]
  },
  {
    conditionId: "DERM__inflammatory__eczema_atopic_dermatitis",
    images: [
      {
        url: "https://dermnetnz.org/assets/Uploads/topics/atopic-childhood-004-s__JPG.webp",
        title: "Atopic Dermatitis - Flexural",
        modality: "clinical_photo",
        source: "DermNet NZ",
        license: "CC BY-NC-ND",
        visualFindings: "Look for: (1) Flexural distribution (antecubital, popliteal), (2) Lichenification, (3) Excoriations from scratching, (4) Dry skin",
        isAnnotated: false,
        usageType: "quiz"
      }
    ]
  }
];

// =============================================================================
// RADIOLOGY - Need to find clean pre-annotation versions
// =============================================================================

export const RADIOLOGY_CLEAN_IMAGES: CuratedCondition[] = [
  {
    conditionId: "PULM__infectious__pneumonia",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Pneumonia_x-ray.jpg",
        title: "Lobar Pneumonia - Clean CXR",
        modality: "xray",
        source: "Wikimedia Commons",
        license: "Public Domain",
        visualFindings: "Look for: (1) Consolidation (air bronchograms), (2) Lobar distribution, (3) Silhouette sign if adjacent to heart/diaphragm",
        isAnnotated: false,
        usageType: "quiz",
        verificationNotes: "Verified - original radiology image without markup"
      }
    ]
  },
  {
    conditionId: "PULM__structural__pneumothorax",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Pneumothorax_CXR.jpg",
        title: "Pneumothorax - Clean CXR",
        modality: "xray",
        source: "Wikimedia Commons",
        license: "CC BY-SA 3.0",
        visualFindings: "Look for: (1) Visible visceral pleural line, (2) Absence of lung markings beyond line, (3) Tracheal deviation if tension",
        isAnnotated: false,
        usageType: "quiz"
      }
    ]
  },
  {
    conditionId: "CV__structural__cardiomegaly",
    images: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Chest_x-ray_-_cardiomegaly.jpg",
        title: "Cardiomegaly - Clean CXR",
        modality: "xray",
        source: "Wikimedia Commons",
        license: "Public Domain",
        visualFindings: "Look for: (1) Cardiothoracic ratio >0.5, (2) Heart borders extending beyond expected margins, (3) May see pulmonary congestion",
        isAnnotated: false,
        usageType: "quiz"
      }
    ]
  }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all curated images for a condition, optionally filtered by usage type
 */
export function getCuratedImages(
  conditionId: string, 
  usageType?: 'quiz' | 'reference' | 'both'
): CuratedImage[] {
  const allSources = [
    ...ECG_CLEAN_IMAGES,
    ...ECG_REFERENCE_IMAGES,
    ...DERMATOLOGY_IMAGES,
    ...RADIOLOGY_CLEAN_IMAGES
  ];
  
  const condition = allSources.find(c => c.conditionId === conditionId);
  if (!condition) return [];
  
  if (usageType) {
    return condition.images.filter(img => 
      img.usageType === usageType || img.usageType === 'both'
    );
  }
  
  return condition.images;
}

/**
 * Get QUIZ-suitable images only (clean, un-annotated)
 */
export function getQuizImages(conditionId: string): CuratedImage[] {
  return getCuratedImages(conditionId, 'quiz');
}

/**
 * Get REFERENCE images only (can be annotated)
 */
export function getReferenceImages(conditionId: string): CuratedImage[] {
  return getCuratedImages(conditionId, 'reference');
}

/**
 * Check if condition has quiz-suitable (clean) images
 */
export function hasQuizImages(conditionId: string): boolean {
  return getQuizImages(conditionId).length > 0;
}

/**
 * Get all conditions that have curated images
 */
export function getAllCuratedConditionIds(): string[] {
  const allSources = [
    ...ECG_CLEAN_IMAGES,
    ...ECG_REFERENCE_IMAGES,
    ...DERMATOLOGY_IMAGES,
    ...RADIOLOGY_CLEAN_IMAGES
  ];
  
  return [...new Set(allSources.map(c => c.conditionId))];
}

/**
 * Get conditions that are MISSING quiz images (have reference but no clean)
 */
export function getConditionsMissingQuizImages(): string[] {
  const allSources = [
    ...ECG_CLEAN_IMAGES,
    ...ECG_REFERENCE_IMAGES,
    ...DERMATOLOGY_IMAGES,
    ...RADIOLOGY_CLEAN_IMAGES
  ];
  
  const conditionMap = new Map<string, { hasQuiz: boolean; hasReference: boolean }>();
  
  for (const source of allSources) {
    const existing = conditionMap.get(source.conditionId) || { hasQuiz: false, hasReference: false };
    
    for (const img of source.images) {
      if (img.usageType === 'quiz' || img.usageType === 'both') {
        existing.hasQuiz = true;
      }
      if (img.usageType === 'reference' || img.usageType === 'both') {
        existing.hasReference = true;
      }
    }
    
    conditionMap.set(source.conditionId, existing);
  }
  
  return Array.from(conditionMap.entries())
    .filter(([_, v]) => v.hasReference && !v.hasQuiz)
    .map(([k, _]) => k);
}

// =============================================================================
// MAIN - Show status
// =============================================================================

if (require.main === module) {
  console.log('=== Curated Image Sources Status ===\n');
  
  const allIds = getAllCuratedConditionIds();
  const withQuiz = allIds.filter(hasQuizImages);
  const missingQuiz = getConditionsMissingQuizImages();
  
  console.log(`Total conditions with any images: ${allIds.length}`);
  console.log(`Conditions with QUIZ images: ${withQuiz.length}`);
  console.log(`Conditions with ONLY reference (need quiz): ${missingQuiz.length}`);
  
  if (missingQuiz.length > 0) {
    console.log('\nConditions needing quiz images:');
    missingQuiz.forEach(id => console.log(`  - ${id}`));
  }
  
  console.log('\n=== By Category ===');
  console.log(`ECG Clean: ${ECG_CLEAN_IMAGES.length} conditions`);
  console.log(`ECG Reference: ${ECG_REFERENCE_IMAGES.length} conditions`);
  console.log(`Dermatology: ${DERMATOLOGY_IMAGES.length} conditions`);
  console.log(`Radiology: ${RADIOLOGY_CLEAN_IMAGES.length} conditions`);
}
