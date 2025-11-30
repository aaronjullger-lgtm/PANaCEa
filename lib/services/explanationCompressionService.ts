/**
 * ExplanationCompressionService
 * 
 * Service for compressing and extracting high-yield content from question explanations.
 * Focuses on actionable learning, brevity, buzzwords, and diagnostic clues.
 */

// TODO: Implement adaptive explanations based on user bias
// TODO: Add time-to-read analysis
// TODO: Add optional audio playback support

/**
 * Common medical terms that should be auto-bolded in explanations
 */
const PATHOGNOMONIC_TERMS: string[] = [
  // Cardiovascular
  'ST elevation', 'troponin', 'STEMI', 'NSTEMI', 'cardiac enzymes',
  'pulsus paradoxus', 'Kussmaul sign', 'Beck\'s triad', 'JVD',
  // Pulmonary  
  'Hamman\'s crunch', 'egophony', 'tactile fremitus', 'dullness to percussion',
  'hyperresonance', 'wheezing', 'stridor', 'crackles',
  // GI
  'Murphy\'s sign', 'McBurney\'s point', 'rebound tenderness', 'guarding',
  'Rovsing\'s sign', 'obturator sign', 'psoas sign', 'coffee-ground emesis',
  // Neuro
  'Babinski sign', 'clonus', 'pronator drift', 'photophobia',
  'Kernig sign', 'Brudzinski sign', 'nuchal rigidity', 'papilledema',
  // Derm
  'maculopapular', 'vesicular', 'erythematous', 'target lesion',
  'herald patch', 'Nikolsky sign', 'Auspitz sign',
  // Endocrine
  'polyuria', 'polydipsia', 'polyphagia', 'Kussmaul breathing',
  'bronze skin', 'exophthalmos', 'pretibial myxedema',
  // Heme/Onc
  'pancytopenia', 'splenomegaly', 'lymphadenopathy', 'petechiae',
  'purpura', 'ecchymosis', 'DIC',
  // ID
  'rice-water stool', 'currant jelly stool', 'rose spots',
  // MSK
  'Boutonniere deformity', 'swan neck deformity', 'Heberden nodes',
  // Psych
  'anhedonia', 'avolition', 'alogia', 'flat affect',
];

/**
 * Map of conditions to their associated mnemonics
 */
const MNEMONIC_DATABASE: Record<string, string> = {
  // Cardiovascular
  'heart_failure': 'HEART FAILURE: H-Hypertension, E-Elevated JVP, A-Activity intolerance, R-Respiratory distress, T-Tachycardia, F-Fatigue, A-Ankle edema, I-Increased weight, L-Lung crackles, U-Urinary frequency at night, R-Reduced EF, E-Exercise intolerance',
  'myocardial_infarction': 'STEMI: S-ST elevation, T-Troponin elevated, E-ECG changes, M-Myocardial damage, I-Immediate intervention needed',
  'atrial_fibrillation': 'PIRATES: P-Pulmonary disease, I-Ischemia, R-Rheumatic heart disease, A-Anemia/Alcohol, T-Thyrotoxicosis, E-Elevated BP, S-Sepsis',
  
  // Pulmonary
  'copd': 'COPD exacerbation triggers: CHEST PAIN - C-Cold air, H-Hyperactive airways, E-Environmental pollutants, S-Smoking, T-Theophylline noncompliance, P-Pneumonia, A-Allergens, I-Influenza, N-Non-adherence to meds',
  'pneumonia': 'CURB-65: C-Confusion, U-Urea >7, R-Respiratory rate ≥30, B-BP systolic <90 or diastolic ≤60, 65-Age ≥65',
  'asthma': 'ASTHMA: A-Airway inflammation, S-Smooth muscle constriction, T-Triggers (allergens), H-Hyperresponsiveness, M-Mucus production, A-Airflow obstruction',
  
  // GI
  'appendicitis': 'RLQ pain + anorexia + fever = Appendicitis triad',
  'pancreatitis': 'I GET SMASHED: I-Idiopathic, G-Gallstones, E-Ethanol, T-Trauma, S-Steroids, M-Mumps, A-Autoimmune, S-Scorpion stings, H-Hyperlipidemia/Hypercalcemia, E-ERCP, D-Drugs',
  'cirrhosis': 'HEPATICS: H-Hepatomegaly, E-Encephalopathy, P-Portal hypertension, A-Ascites, T-Thrombocytopenia, I-INR elevated, C-Caput medusae, S-Spider angiomas',
  
  // Neuro
  'stroke': 'BE FAST: B-Balance loss, E-Eyes (vision changes), F-Facial drooping, A-Arm weakness, S-Speech difficulty, T-Time to call 911',
  'meningitis': 'Classic triad: Fever + Headache + Nuchal rigidity',
  
  // Endocrine
  'dka': 'DKA triad: Hyperglycemia + Ketosis + Metabolic acidosis',
  'hypothyroidism': 'SLUGGISH: S-Sleepiness, L-Lethargy, U-Unexplained weight gain, G-Goiter, G-Generalized weakness, I-Intolerance to cold, S-Slow heart rate, H-Hair loss',
  'hyperthyroidism': 'THYROIDISM: T-Tremor, H-Heart rate increased, Y-Yawning (fatigue), R-Restlessness, O-Oligomenorrhea, I-Intolerance to heat, D-Diarrhea, I-Irritability, S-Sweating, M-Muscle wasting',
  
  // Renal
  'aki': 'Pre-renal vs Intrinsic vs Post-renal: FENa <1% = Pre-renal, FENa >2% = Intrinsic',
  'uti': 'UTI symptoms: Dysuria, Frequency, Urgency, Suprapubic pain',
  
  // Heme
  'anemia': 'MCV approach: Low = Iron deficiency/Thalassemia, Normal = Chronic disease/Renal, High = B12/Folate deficiency',
  'dvt': 'Wells criteria: D-DVT previously, V-Vein tenderness, E-Edema, L-Leg swelling, L-Localized tenderness, S-Superficial veins visible',
};

/**
 * Compresses long-form explanation text into concise, high-yield bullet points.
 * 
 * @param longText - The full rationale or explanation text
 * @returns Array of 3-6 compressed, high-yield bullet points
 */
export function compressExplanation(longText: string): string[] {
  if (!longText || longText.trim().length === 0) {
    return ['[REVIEW REQUIRED]'];
  }

  // Split into sentences
  const sentences = longText
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 10);

  if (sentences.length === 0) {
    return ['[REVIEW REQUIRED]'];
  }

  // Score sentences by medical relevance
  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    
    // Boost sentences with pathognomonic terms
    PATHOGNOMONIC_TERMS.forEach(term => {
      if (sentence.toLowerCase().includes(term.toLowerCase())) {
        score += 3;
      }
    });
    
    // Boost sentences with key diagnostic phrases
    if (/\b(diagnos|confirm|rule out|first-line|gold standard|most common|classic|typical)\b/i.test(sentence)) {
      score += 2;
    }
    
    // Boost sentences with treatment information
    if (/\b(treat|manag|therap|medicat|prescribe|administer|dose)\b/i.test(sentence)) {
      score += 2;
    }
    
    // Boost sentences with differentiating information
    if (/\b(unlike|versus|contrast|distinguish|differentiate|whereas)\b/i.test(sentence)) {
      score += 2;
    }

    // Penalize very long sentences
    if (sentence.length > 200) {
      score -= 1;
    }

    return { sentence, score };
  });

  // Sort by score and take top 3-6
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(s => s.sentence);

  // Format as bullets with auto-bolded terms
  const bullets = topSentences.map(sentence => {
    let formatted = sentence.trim();
    
    // Auto-bold pathognomonic terms
    PATHOGNOMONIC_TERMS.forEach(term => {
      const regex = new RegExp(`\\b(${escapeRegExp(term)})\\b`, 'gi');
      formatted = formatted.replace(regex, '**$1**');
    });
    
    return formatted;
  });

  return bullets.length >= 3 ? bullets : [...bullets, '[REVIEW REQUIRED]'];
}

/**
 * Extracts key buzzwords and pathognomonic phrases from text.
 * 
 * @param longText - The explanation or question text
 * @returns 1-2 lines of comma-separated buzzwords/key clues
 */
export function extractBuzzwords(longText: string): string {
  if (!longText || longText.trim().length === 0) {
    return '[REVIEW REQUIRED]';
  }

  const text = longText.toLowerCase();
  const foundTerms: string[] = [];

  // Find all pathognomonic terms present
  PATHOGNOMONIC_TERMS.forEach(term => {
    if (text.includes(term.toLowerCase())) {
      foundTerms.push(`**${term}**`);
    }
  });

  // Also extract quoted terms
  const quotedTerms = longText.match(/"([^"]+)"/g);
  if (quotedTerms) {
    quotedTerms.forEach(term => {
      const cleaned = term.replace(/"/g, '');
      if (!foundTerms.some(t => t.toLowerCase().includes(cleaned.toLowerCase()))) {
        foundTerms.push(`**${cleaned}**`);
      }
    });
  }

  if (foundTerms.length === 0) {
    return '[No specific buzzwords identified]';
  }

  // Limit to most relevant (max 6)
  return foundTerms.slice(0, 6).join(', ');
}

/**
 * Retrieves or generates a mnemonic for a given condition.
 * 
 * @param condition - The condition name or ID
 * @returns The mnemonic if available, or placeholder text
 */
export function generateMnemonicIfAvailable(condition: string): string {
  if (!condition) {
    return '[Mnemonic not available]';
  }

  // Normalize condition name for lookup
  const normalizedCondition = condition
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Check database
  if (MNEMONIC_DATABASE[normalizedCondition]) {
    return MNEMONIC_DATABASE[normalizedCondition];
  }

  // Check for partial matches
  const partialMatch = Object.keys(MNEMONIC_DATABASE).find(key =>
    normalizedCondition.includes(key) || key.includes(normalizedCondition)
  );

  if (partialMatch) {
    return MNEMONIC_DATABASE[partialMatch];
  }

  return '[Mnemonic not available]';
}

/**
 * Builds a list of key differentials explaining why this condition
 * vs similar conditions in the differential diagnosis.
 * 
 * @param condition - The correct condition name
 * @param confusionPairs - Array of commonly confused conditions
 * @returns Array of differential explanation strings
 */
export function buildDifferentialList(
  condition: string,
  confusionPairs: string[]
): string[] {
  if (!condition || !confusionPairs || confusionPairs.length === 0) {
    return ['[No differentials specified]'];
  }

  const differentials: string[] = [];

  // Common differential patterns
  const differentialPatterns: Record<string, Record<string, string>> = {
    'STEMI': {
      'NSTEMI': 'STEMI shows **ST elevation** on ECG; NSTEMI shows **ST depression** or **T-wave changes**',
      'Unstable Angina': 'STEMI has positive **troponins**; UA has negative cardiac biomarkers',
      'Pericarditis': 'STEMI has regional ST changes; pericarditis shows **diffuse ST elevation** with **PR depression**',
    },
    'Appendicitis': {
      'Diverticulitis': 'Appendicitis = **RLQ pain**; Diverticulitis = **LLQ pain** (typically older patients)',
      'Ectopic Pregnancy': 'Always rule out with **β-hCG** in women of childbearing age',
      'Ovarian Torsion': 'Torsion has sudden onset with **nausea/vomiting**; appendicitis has **migration of pain**',
    },
    'Pneumonia': {
      'Bronchitis': 'Pneumonia has **consolidation on CXR**; bronchitis has clear CXR',
      'Pulmonary Embolism': 'PE has **sudden onset dyspnea** with clear lungs; pneumonia has **productive cough**',
      'Heart Failure': 'HF has **bilateral crackles** and **peripheral edema**; pneumonia is often unilateral',
    },
  };

  // Check if we have specific patterns for this condition
  const conditionPatterns = differentialPatterns[condition];
  
  if (conditionPatterns) {
    confusionPairs.forEach(pair => {
      if (conditionPatterns[pair]) {
        differentials.push(conditionPatterns[pair]);
      } else {
        differentials.push(`${condition} vs ${pair}: [Differential details not available]`);
      }
    });
  } else {
    // Generic format
    confusionPairs.forEach(pair => {
      differentials.push(`${condition} vs **${pair}**: Key distinguishing features differ in presentation, labs, or imaging`);
    });
  }

  return differentials.length > 0 ? differentials : ['[No differentials specified]'];
}

/**
 * Stores user reaction for analytics purposes.
 * 
 * @param questionId - The unique question identifier
 * @param reaction - 'helpful' or 'not_helpful'
 * @param userId - Optional user identifier
 */
export function storeUserReaction(
  questionId: string,
  reaction: 'helpful' | 'not_helpful',
  userId?: string
): void {
  // TODO: Implement actual storage when analytics backend is available
  const reactionData = {
    questionId,
    reaction,
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString(),
  };

  // For now, store in localStorage for later sync
  try {
    const existing = JSON.parse(
      localStorage.getItem('panacea_explanation_reactions') || '[]'
    );
    existing.push(reactionData);
    localStorage.setItem('panacea_explanation_reactions', JSON.stringify(existing));
  } catch (error) {
    console.error('Failed to store reaction:', error);
  }
}

/**
 * Updates the weakness map based on question performance.
 * 
 * @param conditionId - The condition identifier
 * @param wasCorrect - Whether the user answered correctly
 */
export function updateWeaknessMap(conditionId: string, wasCorrect: boolean): void {
  // TODO: Implement adaptive tagging when weakness tracking is available
  const weaknessData = {
    conditionId,
    wasCorrect,
    timestamp: new Date().toISOString(),
  };

  try {
    const existing = JSON.parse(
      localStorage.getItem('panacea_weakness_map') || '[]'
    );
    existing.push(weaknessData);
    localStorage.setItem('panacea_weakness_map', JSON.stringify(existing));
  } catch (error) {
    console.error('Failed to update weakness map:', error);
  }
}

/**
 * Updates the confusion graph when a user confuses two conditions.
 * 
 * @param correctCondition - The correct answer condition
 * @param selectedCondition - The condition the user selected
 */
export function updateConfusionGraph(
  correctCondition: string,
  selectedCondition: string
): void {
  // TODO: Implement confusion graph when backend is available
  const confusionData = {
    correctCondition,
    selectedCondition,
    timestamp: new Date().toISOString(),
  };

  try {
    const existing = JSON.parse(
      localStorage.getItem('panacea_confusion_graph') || '[]'
    );
    existing.push(confusionData);
    localStorage.setItem('panacea_confusion_graph', JSON.stringify(existing));
  } catch (error) {
    console.error('Failed to update confusion graph:', error);
  }
}

// Helper function to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  compressExplanation,
  extractBuzzwords,
  generateMnemonicIfAvailable,
  buildDifferentialList,
  storeUserReaction,
  updateWeaknessMap,
  updateConfusionGraph,
};
