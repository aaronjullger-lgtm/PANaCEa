/**
 * Explanation Compression Service
 *
 * Provides functions for compressing and extracting high-yield content from
 * question explanations, focusing on actionable learning, buzzwords, and
 * diagnostic clues for post-answer rationale experience.
 */

/**
 * Common pathognomonic medical terms that should be auto-bolded
 * These are classic "buzzwords" that often appear in medical exams
 */
const PATHOGNOMONIC_TERMS: string[] = [
  // Classic pathognomonic findings
  "Owl's eye inclusion",
  "owl's eye",
  'owl eye',
  'Reed-Sternberg cells',
  'auer rods',
  'Heinz bodies',
  'apple core lesion',
  'string sign',
  'double bubble sign',
  'café-au-lait spots',
  'ash leaf spots',
  'port-wine stain',
  'strawberry tongue',
  'target lesion',
  'herald patch',
  'chocolate cyst',
  'codman triangle',
  'sunburst pattern',
  'bamboo spine',
  'pencil-in-cup',
  'soap bubble appearance',
  'ground glass',
  'tree-in-bud',
  'crazy paving',

  // Cardiovascular
  'ST elevation',
  'troponin',
  'STEMI',
  'NSTEMI',
  'pulsus paradoxus',
  'Kussmaul sign',
  "Beck's triad",
  'JVD',
  'water-hammer pulse',
  'opening snap',
  'Austin Flint murmur',

  // Pulmonary
  "Hamman's crunch",
  'egophony',
  'tactile fremitus',
  'dullness to percussion',
  'hyperresonance',
  'wheezing',
  'stridor',
  'crackles',

  // GI
  "Murphy's sign",
  "McBurney's point",
  'rebound tenderness',
  'guarding',
  "Rovsing's sign",
  'obturator sign',
  'psoas sign',
  'coffee-ground emesis',
  'currant jelly stool',
  'rice-water stool',
  'acholic stool',

  // Neuro
  'Babinski sign',
  'clonus',
  'pronator drift',
  'photophobia',
  'Kernig sign',
  'Brudzinski sign',
  'nuchal rigidity',
  'papilledema',
  'Lhermitte sign',
  'Romberg sign',
  'Chvostek sign',
  'Trousseau sign',

  // Derm
  'maculopapular',
  'vesicular',
  'erythematous',
  'Nikolsky sign',
  'Auspitz sign',
  'Koebner phenomenon',

  // Endocrine
  'polyuria',
  'polydipsia',
  'polyphagia',
  'Kussmaul breathing',
  'bronze skin',
  'exophthalmos',
  'pretibial myxedema',

  // Heme/Onc
  'pancytopenia',
  'splenomegaly',
  'lymphadenopathy',
  'petechiae',
  'purpura',
  'ecchymosis',
  'DIC',

  // MSK
  'Boutonniere deformity',
  'swan neck deformity',
  'Heberden nodes',
  'Bouchard nodes',
  'tophi',

  // Psych
  'anhedonia',
  'avolition',
  'alogia',
  'flat affect',
];

/**
 * Map of conditions to their associated mnemonics
 */
const MNEMONIC_DATABASE: Record<string, string> = {
  // Cardiovascular
  heart_failure:
    'HEART FAILURE: H-Hypertension, E-Elevated JVP, A-Activity intolerance, R-Respiratory distress, T-Tachycardia, F-Fatigue, A-Ankle edema, I-Increased weight, L-Lung crackles, U-Urinary frequency at night, R-Reduced EF, E-Exercise intolerance',
  myocardial_infarction:
    'STEMI: S-ST elevation, T-Troponin elevated, E-ECG changes, M-Myocardial damage, I-Immediate intervention needed',
  atrial_fibrillation:
    'PIRATES: P-Pulmonary disease, I-Ischemia, R-Rheumatic heart disease, A-Anemia/Alcohol, T-Thyrotoxicosis, E-Elevated BP, S-Sepsis',

  // Pulmonary
  copd: 'COPD exacerbation triggers: CHEST PAIN - C-Cold air, H-Hyperactive airways, E-Environmental pollutants, S-Smoking, T-Theophylline noncompliance, P-Pneumonia, A-Allergens, I-Influenza, N-Non-adherence to meds',
  pneumonia:
    'CURB-65: C-Confusion, U-Urea >7, R-Respiratory rate ≥30, B-BP systolic <90 or diastolic ≤60, 65-Age ≥65',
  asthma:
    'ASTHMA: A-Airway inflammation, S-Smooth muscle constriction, T-Triggers (allergens), H-Hyperresponsiveness, M-Mucus production, A-Airflow obstruction',
  pulmonary_embolism:
    'PE Risk: THROMBOSIS - T-Trauma, H-Hypercoagulable, R-Replaced hip/knee, O-Oral contraceptives, M-Malignancy, B-Bedrest, O-Obesity, S-Surgery, I-Immobility, S-Stroke',

  // GI
  appendicitis: 'RLQ pain + anorexia + fever = Appendicitis triad',
  pancreatitis:
    'I GET SMASHED: I-Idiopathic, G-Gallstones, E-Ethanol, T-Trauma, S-Steroids, M-Mumps, A-Autoimmune, S-Scorpion stings, H-Hyperlipidemia/Hypercalcemia, E-ERCP, D-Drugs',
  cirrhosis:
    'HEPATICS: H-Hepatomegaly, E-Encephalopathy, P-Portal hypertension, A-Ascites, T-Thrombocytopenia, I-INR elevated, C-Caput medusae, S-Spider angiomas',
  gerd: 'GERD triggers: CHOCOLATE - C-Coffee, H-High fat, O-Orange juice, C-Cigarettes, O-Onions, L-Lying down, A-Alcohol, T-Tomatoes, E-Eating large meals',

  // Neuro
  stroke:
    'BE FAST: B-Balance loss, E-Eyes (vision changes), F-Facial drooping, A-Arm weakness, S-Speech difficulty, T-Time to call 911',
  meningitis: 'Classic triad: Fever + Headache + Nuchal rigidity',
  multiple_sclerosis: 'MS: Scanning speech, Intention tremor, Nystagmus (Charcot triad)',

  // Endocrine
  dka: 'DKA triad: Hyperglycemia + Ketosis + Metabolic acidosis',
  hypothyroidism:
    'SLUGGISH: S-Sleepiness, L-Lethargy, U-Unexplained weight gain, G-Goiter, G-Generalized weakness, I-Intolerance to cold, S-Slow heart rate, H-Hair loss',
  hyperthyroidism:
    'THYROIDISM: T-Tremor, H-Heart rate increased, Y-Yawning (fatigue), R-Restlessness, O-Oligomenorrhea, I-Intolerance to heat, D-Diarrhea, I-Irritability, S-Sweating, M-Muscle wasting',
  cushing: "Cushing's: Buffalo hump, Moon facies, Striae, Hypertension, Hyperglycemia",
  addison: "Addison's: 3 H's - Hypotension, Hyperpigmentation, Hyponatremia",

  // Renal
  aki: 'Pre-renal vs Intrinsic vs Post-renal: FENa <1% = Pre-renal, FENa >2% = Intrinsic',
  uti: 'UTI symptoms: Dysuria, Frequency, Urgency, Suprapubic pain',
  nephrotic_syndrome: 'Nephrotic: Proteinuria (>3.5g/day), Hypoalbuminemia, Edema, Hyperlipidemia',
  nephritic_syndrome: 'Nephritic: Hematuria, RBC casts, Hypertension, Oliguria',

  // Heme
  anemia:
    'MCV approach: Low = Iron deficiency/Thalassemia, Normal = Chronic disease/Renal, High = B12/Folate deficiency',
  dvt: 'Wells criteria: D-DVT previously, V-Vein tenderness, E-Edema, L-Leg swelling, L-Localized tenderness, S-Superficial veins visible',
  sickle_cell:
    'Sickle Cell Crises: HAVES - H-Hand-foot syndrome, A-Aplastic, V-Vaso-occlusive, E-Enlarged spleen (sequestration), S-Stroke',

  // Infectious
  cmv: 'CMV in immunocompromised: Owl eye inclusions on histology',
  ebv: 'EBV (Mono): Fatigue, Fever, Pharyngitis, Lymphadenopathy, Splenomegaly',
};

/**
 * Helper function to escape regex special characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pre-compiled regex patterns for pathognomonic terms (for performance)
 * These are created once at module initialization
 */
const PATHOGNOMONIC_PATTERNS: Map<string, RegExp> = new Map(
  PATHOGNOMONIC_TERMS.map((term) => [term, new RegExp(`(${escapeRegExp(term)})`, 'gi')])
);

/**
 * Extracts and bolds pathognomonic terms (buzzwords) from text.
 * Identifies classic medical buzzwords like "Owl's eye inclusion" and formats them.
 *
 * @param text - The explanation or question text
 * @returns Object containing array of found buzzwords and formatted text with bolded terms
 */
export function extractBuzzwords(text: string): {
  buzzwords: string[];
  formattedText: string;
} {
  if (!text || text.trim().length === 0) {
    return { buzzwords: [], formattedText: text };
  }

  const lowerText = text.toLowerCase();
  const foundBuzzwords: string[] = [];
  let formattedText = text;

  // Find all pathognomonic terms present using pre-compiled patterns
  PATHOGNOMONIC_TERMS.forEach((term) => {
    if (lowerText.includes(term.toLowerCase())) {
      foundBuzzwords.push(term);
      // Bold the term in the formatted text using pre-compiled pattern
      const pattern = PATHOGNOMONIC_PATTERNS.get(term);
      if (pattern) {
        formattedText = formattedText.replace(pattern, '<strong>$1</strong>');
      }
    }
  });

  // Also extract quoted terms as potential buzzwords (supports straight and curly quotes)
  const quotedTerms = text.match(/[""]([^"""]+)[""]|"([^"]+)"/g);
  if (quotedTerms) {
    quotedTerms.forEach((quotedTerm) => {
      const cleaned = quotedTerm.replace(/["""]/g, '');
      if (!foundBuzzwords.some((b) => b.toLowerCase() === cleaned.toLowerCase())) {
        foundBuzzwords.push(cleaned);
        // Bold quoted terms in formatted text
        formattedText = formattedText.replace(quotedTerm, `<strong>${cleaned}</strong>`);
      }
    });
  }

  return {
    buzzwords: foundBuzzwords,
    formattedText,
  };
}

/**
 * Converts explanation text into 3-4 actionable bullet points.
 * Prioritizes high-yield sentences containing diagnostic, treatment, and differentiating info.
 *
 * @param text - The full rationale or explanation text
 * @returns Array of 3-4 compressed, high-yield bullet strings
 */
export function compressToBullets(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return ['[REVIEW REQUIRED]'];
  }

  // Remove HTML tags for processing but preserve for scoring
  const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  // Split into sentences
  const sentences = plainText
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 15);

  if (sentences.length === 0) {
    return ['[REVIEW REQUIRED]'];
  }

  // Score sentences by medical relevance
  const scoredSentences = sentences.map((sentence) => {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();

    // Boost sentences with pathognomonic terms (highest priority)
    PATHOGNOMONIC_TERMS.forEach((term) => {
      if (lowerSentence.includes(term.toLowerCase())) {
        score += 5;
      }
    });

    // Boost sentences with key diagnostic phrases
    if (
      /\b(diagnos|confirm|rule out|first-line|gold standard|most common|classic|typical|pathognomonic)\b/i.test(
        sentence
      )
    ) {
      score += 3;
    }

    // Boost sentences with treatment information
    if (
      /\b(treat|manag|therap|medicat|prescribe|administer|first[\s-]?line|drug of choice)\b/i.test(
        sentence
      )
    ) {
      score += 3;
    }

    // Boost sentences with differentiating information
    if (
      /\b(unlike|versus|vs\.|contrast|distinguish|differentiate|whereas|compared to|differs from)\b/i.test(
        sentence
      )
    ) {
      score += 3;
    }

    // Boost sentences with "because" or "due to" - explains reasoning
    if (/\b(because|due to|caused by|results from|leads to)\b/i.test(sentence)) {
      score += 2;
    }

    // Penalize very long sentences
    if (sentence.length > 200) {
      score -= 1;
    }

    // Penalize very short sentences
    if (sentence.length < 30) {
      score -= 2;
    }

    return { sentence, score };
  });

  // Sort by score and take top 3-4
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((s) => s.sentence.trim());

  // Format as bullets with auto-bolded terms using pre-compiled patterns
  const bullets = topSentences.map((sentence) => {
    let formatted = sentence;

    // Auto-bold pathognomonic terms using pre-compiled patterns
    PATHOGNOMONIC_TERMS.forEach((term) => {
      const pattern = PATHOGNOMONIC_PATTERNS.get(term);
      if (pattern) {
        formatted = formatted.replace(pattern, '<strong>$1</strong>');
      }
    });

    return formatted;
  });

  return bullets.length >= 3 ? bullets : [...bullets, '[REVIEW REQUIRED]'];
}

/**
 * Returns a mnemonic for a condition if available, otherwise "[Mnemonic: None]".
 *
 * @param condition - The condition name or ID
 * @returns The mnemonic string or placeholder
 */
export function generateMnemonic(condition: string): string {
  if (!condition) {
    return '[Mnemonic: None]';
  }

  // Normalize condition name for lookup
  const normalizedCondition = condition
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Direct lookup
  if (MNEMONIC_DATABASE[normalizedCondition]) {
    return MNEMONIC_DATABASE[normalizedCondition];
  }

  // Check for partial matches
  const partialMatch = Object.keys(MNEMONIC_DATABASE).find(
    (key) => normalizedCondition.includes(key) || key.includes(normalizedCondition)
  );

  if (partialMatch) {
    return MNEMONIC_DATABASE[partialMatch] ?? '[Mnemonic: None]';
  }

  return '[Mnemonic: None]';
}

/**
 * High-yield explanation package interface
 */
export interface HighYieldPackage {
  /** Compressed bullet points (3-4 max) */
  bullets: string[];
  /** Array of identified buzzwords */
  buzzwords: string[];
  /** Full explanation text with buzzwords bolded */
  formattedHtml: string;
  /** Mnemonic for the condition if available */
  mnemonic: string;
}

/**
 * Convenience wrapper that bundles all explanation processing into a single package.
 * Combines bullets, buzzwords, formatted HTML, and mnemonic for easy consumption.
 *
 * @param explanation - The full explanation/rationale text
 * @param condition - The condition name for mnemonic lookup
 * @returns HighYieldPackage with all processed content
 */
export function highYieldPackage(explanation: string, condition: string): HighYieldPackage {
  const bullets = compressToBullets(explanation);
  const { buzzwords, formattedText } = extractBuzzwords(explanation);
  const mnemonic = generateMnemonic(condition);

  return {
    bullets,
    buzzwords,
    formattedHtml: formattedText,
    mnemonic,
  };
}

export default {
  extractBuzzwords,
  compressToBullets,
  generateMnemonic,
  highYieldPackage,
};
