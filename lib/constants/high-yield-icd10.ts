/**
 * High-Yield ICD-10 Codes for PANCE Preparation
 *
 * Curated subset of ICD-10-CM codes covering the most commonly tested
 * conditions across all NCCPA PANCE blueprint organ systems.
 *
 * @see https://www.nccpa.net/pance-content-blueprint
 */

export interface ICD10Entry {
  code: string;
  description: string;
  system: string;
  /** Short clinical context for distractor plausibility */
  category: string;
}

export const HIGH_YIELD_ICD10: ICD10Entry[] = [
  // ── Cardiovascular (11%) ──
  { code: 'I50.9', description: 'Heart failure, unspecified', system: 'Cardiovascular', category: 'heart failure' },
  { code: 'I48.91', description: 'Unspecified atrial fibrillation', system: 'Cardiovascular', category: 'arrhythmia' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris', system: 'Cardiovascular', category: 'coronary artery disease' },
  { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', system: 'Cardiovascular', category: 'acute coronary syndrome' },
  { code: 'I10', description: 'Essential (primary) hypertension', system: 'Cardiovascular', category: 'hypertension' },
  { code: 'I42.9', description: 'Cardiomyopathy, unspecified', system: 'Cardiovascular', category: 'cardiomyopathy' },
  { code: 'I35.0', description: 'Nonrheumatic aortic (valve) stenosis', system: 'Cardiovascular', category: 'valvular disease' },
  { code: 'I34.0', description: 'Nonrheumatic mitral (valve) insufficiency', system: 'Cardiovascular', category: 'valvular disease' },
  { code: 'I71.3', description: 'Abdominal aortic aneurysm, ruptured', system: 'Cardiovascular', category: 'vascular' },
  { code: 'I73.9', description: 'Peripheral vascular disease, unspecified', system: 'Cardiovascular', category: 'peripheral arterial disease' },
  { code: 'I26.99', description: 'Other pulmonary embolism without acute cor pulmonale', system: 'Cardiovascular', category: 'pulmonary embolism' },
  { code: 'I80.10', description: 'Phlebitis and thrombophlebitis of unspecified femoral vein', system: 'Cardiovascular', category: 'deep vein thrombosis' },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', system: 'Cardiovascular', category: 'angina' },

  // ── Pulmonary (9%) ──
  { code: 'J44.1', description: 'Chronic obstructive pulmonary disease with acute exacerbation', system: 'Pulmonary', category: 'COPD' },
  { code: 'J45.40', description: 'Moderate persistent asthma, uncomplicated', system: 'Pulmonary', category: 'asthma' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', system: 'Pulmonary', category: 'pneumonia' },
  { code: 'J93.0', description: 'Spontaneous tension pneumothorax', system: 'Pulmonary', category: 'pneumothorax' },
  { code: 'J90', description: 'Pleural effusion, not elsewhere classified', system: 'Pulmonary', category: 'pleural effusion' },
  { code: 'J84.10', description: 'Pulmonary fibrosis, unspecified', system: 'Pulmonary', category: 'interstitial lung disease' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', system: 'Pulmonary', category: 'URI' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', system: 'Pulmonary', category: 'bronchitis' },
  { code: 'C34.90', description: 'Malignant neoplasm of unspecified part of unspecified bronchus or lung', system: 'Pulmonary', category: 'lung cancer' },
  { code: 'G47.33', description: 'Obstructive sleep apnea (adult) (pediatric)', system: 'Pulmonary', category: 'sleep apnea' },

  // ── Gastrointestinal (9%) ──
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', system: 'Gastrointestinal', category: 'GERD' },
  { code: 'K25.9', description: 'Gastric ulcer, unspecified as acute or chronic, without hemorrhage or perforation', system: 'Gastrointestinal', category: 'peptic ulcer' },
  { code: 'K35.80', description: 'Unspecified acute appendicitis', system: 'Gastrointestinal', category: 'appendicitis' },
  { code: 'K80.20', description: 'Calculus of gallbladder without cholecystitis without obstruction', system: 'Gastrointestinal', category: 'cholelithiasis' },
  { code: 'K50.90', description: 'Crohn\'s disease, unspecified, without complications', system: 'Gastrointestinal', category: 'IBD' },
  { code: 'K51.90', description: 'Ulcerative colitis, unspecified, without complications', system: 'Gastrointestinal', category: 'IBD' },
  { code: 'K57.30', description: 'Diverticulosis of large intestine without perforation or abscess without bleeding', system: 'Gastrointestinal', category: 'diverticular disease' },
  { code: 'K70.30', description: 'Alcoholic cirrhosis of liver without ascites', system: 'Gastrointestinal', category: 'liver disease' },
  { code: 'K85.90', description: 'Acute pancreatitis without necrosis or infection, unspecified', system: 'Gastrointestinal', category: 'pancreatitis' },
  { code: 'K56.60', description: 'Unspecified intestinal obstruction', system: 'Gastrointestinal', category: 'bowel obstruction' },
  { code: 'K76.6', description: 'Portal hypertension', system: 'Gastrointestinal', category: 'liver disease' },
  { code: 'B18.2', description: 'Chronic viral hepatitis C', system: 'Gastrointestinal', category: 'hepatitis' },

  // ── Musculoskeletal (9%) ──
  { code: 'M54.5', description: 'Low back pain', system: 'Musculoskeletal', category: 'spine' },
  { code: 'M17.11', description: 'Primary osteoarthritis, right knee', system: 'Musculoskeletal', category: 'osteoarthritis' },
  { code: 'M10.9', description: 'Gout, unspecified', system: 'Musculoskeletal', category: 'crystal arthropathy' },
  { code: 'M06.9', description: 'Rheumatoid arthritis, unspecified', system: 'Musculoskeletal', category: 'autoimmune' },
  { code: 'M79.3', description: 'Panniculitis, unspecified', system: 'Musculoskeletal', category: 'soft tissue' },
  { code: 'S72.001A', description: 'Fracture of unspecified part of neck of right femur, initial encounter', system: 'Musculoskeletal', category: 'fracture' },
  { code: 'M75.10', description: 'Unspecified rotator cuff tear, unspecified shoulder', system: 'Musculoskeletal', category: 'shoulder' },
  { code: 'M51.16', description: 'Intervertebral disc disorders with radiculopathy, lumbar region', system: 'Musculoskeletal', category: 'spine' },
  { code: 'M80.00XA', description: 'Age-related osteoporosis with current pathological fracture, unspecified site, initial encounter', system: 'Musculoskeletal', category: 'metabolic bone' },
  { code: 'M32.9', description: 'Systemic lupus erythematosus, unspecified', system: 'Musculoskeletal', category: 'autoimmune' },

  // ── HEENT (8%) ──
  { code: 'H66.90', description: 'Otitis media, unspecified, unspecified ear', system: 'HEENT', category: 'ear' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', system: 'HEENT', category: 'throat' },
  { code: 'J01.90', description: 'Acute sinusitis, unspecified', system: 'HEENT', category: 'sinus' },
  { code: 'H10.9', description: 'Unspecified conjunctivitis', system: 'HEENT', category: 'eye' },
  { code: 'H40.10X0', description: 'Unspecified open-angle glaucoma, stage unspecified', system: 'HEENT', category: 'eye' },
  { code: 'J03.90', description: 'Acute tonsillitis, unspecified', system: 'HEENT', category: 'throat' },
  { code: 'H81.10', description: 'Benign paroxysmal vertigo, unspecified ear', system: 'HEENT', category: 'ear' },
  { code: 'J34.2', description: 'Deviated nasal septum', system: 'HEENT', category: 'nose' },

  // ── Reproductive (8%) ──
  { code: 'O80', description: 'Encounter for full-term uncomplicated delivery', system: 'Reproductive', category: 'obstetrics' },
  { code: 'O14.10', description: 'Severe pre-eclampsia, unspecified trimester', system: 'Reproductive', category: 'obstetrics' },
  { code: 'O00.10', description: 'Tubal pregnancy without intrauterine pregnancy', system: 'Reproductive', category: 'obstetrics' },
  { code: 'N80.0', description: 'Endometriosis of uterus', system: 'Reproductive', category: 'gynecology' },
  { code: 'N92.0', description: 'Excessive and frequent menstruation with regular cycle', system: 'Reproductive', category: 'gynecology' },
  { code: 'D25.9', description: 'Leiomyoma of uterus, unspecified', system: 'Reproductive', category: 'gynecology' },
  { code: 'N76.0', description: 'Acute vaginitis', system: 'Reproductive', category: 'gynecology' },
  { code: 'N40.0', description: 'Benign prostatic hyperplasia without lower urinary tract symptoms', system: 'Reproductive', category: 'male' },
  { code: 'C61', description: 'Malignant neoplasm of prostate', system: 'Reproductive', category: 'male' },
  { code: 'N45.1', description: 'Epididymitis', system: 'Reproductive', category: 'male' },

  // ── Neurological (7%) ──
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus', system: 'Neurological', category: 'headache' },
  { code: 'I63.9', description: 'Cerebral infarction, unspecified', system: 'Neurological', category: 'stroke' },
  { code: 'G40.909', description: 'Epilepsy, unspecified, not intractable, without status epilepticus', system: 'Neurological', category: 'seizure' },
  { code: 'G20', description: 'Parkinson\'s disease', system: 'Neurological', category: 'neurodegenerative' },
  { code: 'G35', description: 'Multiple sclerosis', system: 'Neurological', category: 'demyelinating' },
  { code: 'G30.9', description: 'Alzheimer\'s disease, unspecified', system: 'Neurological', category: 'neurodegenerative' },
  { code: 'G61.0', description: 'Guillain-Barré syndrome', system: 'Neurological', category: 'peripheral neuropathy' },
  { code: 'S06.0X0A', description: 'Concussion without loss of consciousness, initial encounter', system: 'Neurological', category: 'trauma' },

  // ── Psychiatry (7%) ──
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', system: 'Psychiatry', category: 'mood' },
  { code: 'F41.1', description: 'Generalized anxiety disorder', system: 'Psychiatry', category: 'anxiety' },
  { code: 'F20.9', description: 'Schizophrenia, unspecified', system: 'Psychiatry', category: 'psychotic' },
  { code: 'F31.9', description: 'Bipolar disorder, unspecified', system: 'Psychiatry', category: 'mood' },
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified', system: 'Psychiatry', category: 'trauma-related' },
  { code: 'F10.20', description: 'Alcohol dependence, uncomplicated', system: 'Psychiatry', category: 'substance use' },
  { code: 'F50.00', description: 'Anorexia nervosa, unspecified', system: 'Psychiatry', category: 'eating disorder' },
  { code: 'F90.9', description: 'Attention-deficit hyperactivity disorder, unspecified type', system: 'Psychiatry', category: 'neurodevelopmental' },

  // ── Endocrine (6%) ──
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', system: 'Endocrine', category: 'diabetes' },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', system: 'Endocrine', category: 'diabetes' },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', system: 'Endocrine', category: 'thyroid' },
  { code: 'E05.90', description: 'Thyrotoxicosis, unspecified without thyrotoxic crisis or storm', system: 'Endocrine', category: 'thyroid' },
  { code: 'E24.9', description: 'Cushing\'s syndrome, unspecified', system: 'Endocrine', category: 'adrenal' },
  { code: 'E27.1', description: 'Primary adrenocortical insufficiency', system: 'Endocrine', category: 'adrenal' },
  { code: 'E21.0', description: 'Primary hyperparathyroidism', system: 'Endocrine', category: 'parathyroid' },
  { code: 'E66.01', description: 'Morbid (severe) obesity due to excess calories', system: 'Endocrine', category: 'metabolic' },

  // ── Dermatology (5%) ──
  { code: 'L40.0', description: 'Psoriasis vulgaris', system: 'Dermatology', category: 'papulosquamous' },
  { code: 'L20.9', description: 'Atopic dermatitis, unspecified', system: 'Dermatology', category: 'eczema' },
  { code: 'L03.90', description: 'Cellulitis, unspecified', system: 'Dermatology', category: 'infection' },
  { code: 'B35.1', description: 'Tinea unguium', system: 'Dermatology', category: 'fungal' },
  { code: 'L50.9', description: 'Urticaria, unspecified', system: 'Dermatology', category: 'hypersensitivity' },
  { code: 'C43.9', description: 'Malignant melanoma of skin, unspecified', system: 'Dermatology', category: 'neoplasm' },
  { code: 'B02.9', description: 'Zoster without complications', system: 'Dermatology', category: 'viral' },

  // ── Genitourinary (5%) ──
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', system: 'Genitourinary', category: 'infection' },
  { code: 'N20.0', description: 'Calculus of kidney', system: 'Genitourinary', category: 'nephrolithiasis' },
  { code: 'N10', description: 'Acute pyelonephritis', system: 'Genitourinary', category: 'infection' },
  { code: 'N18.9', description: 'Chronic kidney disease, unspecified', system: 'Genitourinary', category: 'CKD' },
  { code: 'N13.30', description: 'Unspecified hydronephrosis', system: 'Genitourinary', category: 'obstruction' },

  // ── Hematology (4%) ──
  { code: 'D50.9', description: 'Iron deficiency anemia, unspecified', system: 'Hematology', category: 'anemia' },
  { code: 'D64.9', description: 'Anemia, unspecified', system: 'Hematology', category: 'anemia' },
  { code: 'D57.1', description: 'Sickle-cell disease without crisis', system: 'Hematology', category: 'hemoglobinopathy' },
  { code: 'D68.9', description: 'Coagulation defect, unspecified', system: 'Hematology', category: 'coagulopathy' },
  { code: 'D69.6', description: 'Thrombocytopenia, unspecified', system: 'Hematology', category: 'platelet' },

  // ── Infectious Disease (4%) ──
  { code: 'A41.9', description: 'Sepsis, unspecified organism', system: 'Infectious Disease', category: 'sepsis' },
  { code: 'B20', description: 'Human immunodeficiency virus [HIV] disease', system: 'Infectious Disease', category: 'HIV' },
  { code: 'A69.20', description: 'Lyme disease, unspecified', system: 'Infectious Disease', category: 'tick-borne' },
  { code: 'A15.0', description: 'Tuberculosis of lung', system: 'Infectious Disease', category: 'mycobacterial' },
  { code: 'B37.9', description: 'Candidiasis, unspecified', system: 'Infectious Disease', category: 'fungal' },

  // ── Nephrology (4%) ──
  { code: 'N04.9', description: 'Nephrotic syndrome with unspecified morphologic changes', system: 'Nephrology', category: 'glomerular' },
  { code: 'N17.9', description: 'Acute kidney failure, unspecified', system: 'Nephrology', category: 'AKI' },
  { code: 'E87.1', description: 'Hypo-osmolality and hyponatremia', system: 'Nephrology', category: 'electrolyte' },
  { code: 'E87.6', description: 'Hypokalemia', system: 'Nephrology', category: 'electrolyte' },

  // ── Emergency Medicine (2%) ──
  { code: 'T78.2XXA', description: 'Anaphylactic shock, unspecified, initial encounter', system: 'Emergency Medicine', category: 'allergy' },
  { code: 'T58.01XA', description: 'Toxic effect of carbon monoxide from motor vehicle exhaust, accidental, initial encounter', system: 'Emergency Medicine', category: 'toxicology' },
  { code: 'T39.1X1A', description: 'Poisoning by 4-Aminophenol derivatives, accidental, initial encounter', system: 'Emergency Medicine', category: 'toxicology' },
];

/** Get all codes for a specific organ system */
export function getCodesBySystem(system: string): ICD10Entry[] {
  return HIGH_YIELD_ICD10.filter((e) => e.system === system);
}

/** Get all unique systems */
export function getICD10Systems(): string[] {
  return [...new Set(HIGH_YIELD_ICD10.map((e) => e.system))];
}

/** Pick N random distractors from the same system (excluding the correct code) */
export function pickDistractors(correctCode: string, system: string, count: number = 4): ICD10Entry[] {
  const pool = HIGH_YIELD_ICD10.filter((e) => e.system === system && e.code !== correctCode);
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // If not enough in the same system, pull from same category across systems
  if (pool.length < count) {
    const entry = HIGH_YIELD_ICD10.find((e) => e.code === correctCode);
    if (entry) {
      const crossSystem = HIGH_YIELD_ICD10.filter(
        (e) => e.category === entry.category && e.code !== correctCode && !pool.some((p) => p.code === e.code)
      );
      pool.push(...crossSystem);
    }
  }
  return pool.slice(0, count);
}
