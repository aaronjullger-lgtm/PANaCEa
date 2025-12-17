// drugRegistry.ts
/**
 * Drug Registry - Source of Truth for Pharmacology
 * 
 * This registry defines all drugs that should exist in the system.
 * Add drugs here, then run `npm run sync:drugs` to populate the Drug table.
 * Automation will then generate detailed content (mechanisms, interactions, etc.)
 */

export interface DrugMeta {
  genericName: string;
  brandName?: string;
  displayName?: string; // Clean display name (defaults to genericName)
  aliases?: string[]; // Alternative names for search
  drugClass: string[]; // e.g., ["Antibiotic", "Beta-Lactam", "Penicillin"]
  isHighYield: boolean; // Should this be emphasized in study materials?
  
  // Optional: Basic info that can be filled in manually
  mechanismOfAction?: string;
  indications?: string[];
  contraindications?: string[];
  commonSideEffects?: string[];
  
  // FDA/Regulatory
  fdaApproved?: boolean;
  blackBoxWarning?: boolean;
  pregnancyCategory?: string; // A, B, C, D, X
}

// =============================================================================
// ANTIBIOTICS
// =============================================================================

export const DRUG_REGISTRY_ANTIBIOTICS: DrugMeta[] = [
  // Beta-Lactams - Penicillins
  {
    genericName: "Amoxicillin",
    brandName: "Amoxil",
    drugClass: ["Antibiotic", "Beta-Lactam", "Aminopenicillin"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Amoxicillin-Clavulanate",
    brandName: "Augmentin",
    drugClass: ["Antibiotic", "Beta-Lactam", "Aminopenicillin", "Beta-Lactamase Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Penicillin G",
    drugClass: ["Antibiotic", "Beta-Lactam", "Natural Penicillin"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Penicillin V",
    drugClass: ["Antibiotic", "Beta-Lactam", "Natural Penicillin"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Nafcillin",
    drugClass: ["Antibiotic", "Beta-Lactam", "Penicillinase-Resistant Penicillin"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Piperacillin-Tazobactam",
    brandName: "Zosyn",
    drugClass: ["Antibiotic", "Beta-Lactam", "Extended-Spectrum Penicillin", "Beta-Lactamase Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Cephalosporins
  {
    genericName: "Cefazolin",
    brandName: "Ancef",
    drugClass: ["Antibiotic", "Beta-Lactam", "Cephalosporin", "First-Generation"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Cefuroxime",
    brandName: "Ceftin",
    drugClass: ["Antibiotic", "Beta-Lactam", "Cephalosporin", "Second-Generation"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Ceftriaxone",
    brandName: "Rocephin",
    drugClass: ["Antibiotic", "Beta-Lactam", "Cephalosporin", "Third-Generation"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Cefepime",
    brandName: "Maxipime",
    drugClass: ["Antibiotic", "Beta-Lactam", "Cephalosporin", "Fourth-Generation"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Ceftaroline",
    brandName: "Teflaro",
    drugClass: ["Antibiotic", "Beta-Lactam", "Cephalosporin", "Fifth-Generation"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Carbapenems
  {
    genericName: "Meropenem",
    brandName: "Merrem",
    drugClass: ["Antibiotic", "Beta-Lactam", "Carbapenem"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Imipenem-Cilastatin",
    brandName: "Primaxin",
    drugClass: ["Antibiotic", "Beta-Lactam", "Carbapenem"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Ertapenem",
    brandName: "Invanz",
    drugClass: ["Antibiotic", "Beta-Lactam", "Carbapenem"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Monobactams
  {
    genericName: "Aztreonam",
    brandName: "Azactam",
    drugClass: ["Antibiotic", "Beta-Lactam", "Monobactam"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Fluoroquinolones
  {
    genericName: "Ciprofloxacin",
    brandName: "Cipro",
    drugClass: ["Antibiotic", "Fluoroquinolone"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Levofloxacin",
    brandName: "Levaquin",
    drugClass: ["Antibiotic", "Fluoroquinolone"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Moxifloxacin",
    brandName: "Avelox",
    drugClass: ["Antibiotic", "Fluoroquinolone"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // Macrolides
  {
    genericName: "Azithromycin",
    brandName: "Zithromax",
    drugClass: ["Antibiotic", "Macrolide"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Clarithromycin",
    brandName: "Biaxin",
    drugClass: ["Antibiotic", "Macrolide"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Erythromycin",
    drugClass: ["Antibiotic", "Macrolide"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Tetracyclines
  {
    genericName: "Doxycycline",
    brandName: "Vibramycin",
    drugClass: ["Antibiotic", "Tetracycline"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Minocycline",
    brandName: "Minocin",
    drugClass: ["Antibiotic", "Tetracycline"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Aminoglycosides
  {
    genericName: "Gentamicin",
    drugClass: ["Antibiotic", "Aminoglycoside"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Tobramycin",
    drugClass: ["Antibiotic", "Aminoglycoside"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Amikacin",
    drugClass: ["Antibiotic", "Aminoglycoside"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // Glycopeptides
  {
    genericName: "Vancomycin",
    brandName: "Vancocin",
    drugClass: ["Antibiotic", "Glycopeptide"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Sulfonamides
  {
    genericName: "Trimethoprim-Sulfamethoxazole",
    brandName: "Bactrim",
    drugClass: ["Antibiotic", "Sulfonamide", "Folate Antagonist"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Nitroimidazoles
  {
    genericName: "Metronidazole",
    brandName: "Flagyl",
    drugClass: ["Antibiotic", "Nitroimidazole", "Antiparasitic"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Oxazolidinones
  {
    genericName: "Linezolid",
    brandName: "Zyvox",
    drugClass: ["Antibiotic", "Oxazolidinone"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Lipopeptides
  {
    genericName: "Daptomycin",
    brandName: "Cubicin",
    drugClass: ["Antibiotic", "Lipopeptide"],
    isHighYield: true,
    fdaApproved: true,
  },
];

// =============================================================================
// CARDIOVASCULAR
// =============================================================================

export const DRUG_REGISTRY_CARDIOVASCULAR: DrugMeta[] = [
  // ACE Inhibitors
  {
    genericName: "Lisinopril",
    brandName: "Prinivil",
    drugClass: ["Cardiovascular", "ACE Inhibitor", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true, // Pregnancy
  },
  {
    genericName: "Enalapril",
    brandName: "Vasotec",
    drugClass: ["Cardiovascular", "ACE Inhibitor", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Ramipril",
    brandName: "Altace",
    drugClass: ["Cardiovascular", "ACE Inhibitor", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // ARBs
  {
    genericName: "Losartan",
    brandName: "Cozaar",
    drugClass: ["Cardiovascular", "ARB", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Valsartan",
    brandName: "Diovan",
    drugClass: ["Cardiovascular", "ARB", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // Beta Blockers
  {
    genericName: "Metoprolol",
    brandName: "Lopressor",
    drugClass: ["Cardiovascular", "Beta Blocker", "Antihypertensive", "Antiarrhythmic"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Atenolol",
    brandName: "Tenormin",
    drugClass: ["Cardiovascular", "Beta Blocker", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Carvedilol",
    brandName: "Coreg",
    drugClass: ["Cardiovascular", "Beta Blocker", "Alpha Blocker", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Calcium Channel Blockers
  {
    genericName: "Amlodipine",
    brandName: "Norvasc",
    drugClass: ["Cardiovascular", "Calcium Channel Blocker", "Dihydropyridine", "Antihypertensive"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Diltiazem",
    brandName: "Cardizem",
    drugClass: ["Cardiovascular", "Calcium Channel Blocker", "Non-Dihydropyridine", "Antiarrhythmic"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Verapamil",
    brandName: "Calan",
    drugClass: ["Cardiovascular", "Calcium Channel Blocker", "Non-Dihydropyridine", "Antiarrhythmic"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Diuretics
  {
    genericName: "Furosemide",
    brandName: "Lasix",
    drugClass: ["Cardiovascular", "Diuretic", "Loop Diuretic"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Hydrochlorothiazide",
    brandName: "Microzide",
    drugClass: ["Cardiovascular", "Diuretic", "Thiazide Diuretic"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Spironolactone",
    brandName: "Aldactone",
    drugClass: ["Cardiovascular", "Diuretic", "Potassium-Sparing Diuretic", "Aldosterone Antagonist"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Statins
  {
    genericName: "Atorvastatin",
    brandName: "Lipitor",
    drugClass: ["Cardiovascular", "Statin", "HMG-CoA Reductase Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Simvastatin",
    brandName: "Zocor",
    drugClass: ["Cardiovascular", "Statin", "HMG-CoA Reductase Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Rosuvastatin",
    brandName: "Crestor",
    drugClass: ["Cardiovascular", "Statin", "HMG-CoA Reductase Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Anticoagulants
  {
    genericName: "Warfarin",
    brandName: "Coumadin",
    drugClass: ["Cardiovascular", "Anticoagulant", "Vitamin K Antagonist"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Apixaban",
    brandName: "Eliquis",
    drugClass: ["Cardiovascular", "Anticoagulant", "Direct Factor Xa Inhibitor", "DOAC"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Rivaroxaban",
    brandName: "Xarelto",
    drugClass: ["Cardiovascular", "Anticoagulant", "Direct Factor Xa Inhibitor", "DOAC"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Dabigatran",
    brandName: "Pradaxa",
    drugClass: ["Cardiovascular", "Anticoagulant", "Direct Thrombin Inhibitor", "DOAC"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // Antiplatelets
  {
    genericName: "Aspirin",
    drugClass: ["Cardiovascular", "Antiplatelet", "NSAID", "COX Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Clopidogrel",
    brandName: "Plavix",
    drugClass: ["Cardiovascular", "Antiplatelet", "P2Y12 Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // Antiarrhythmics
  {
    genericName: "Amiodarone",
    brandName: "Cordarone",
    drugClass: ["Cardiovascular", "Antiarrhythmic", "Class III"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Adenosine",
    brandName: "Adenocard",
    drugClass: ["Cardiovascular", "Antiarrhythmic"],
    isHighYield: true,
    fdaApproved: true,
  },
];

// =============================================================================
// ENDOCRINE / DIABETES
// =============================================================================

export const DRUG_REGISTRY_ENDOCRINE: DrugMeta[] = [
  // Insulin
  {
    genericName: "Insulin Lispro",
    brandName: "Humalog",
    drugClass: ["Endocrine", "Insulin", "Rapid-Acting"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Insulin Aspart",
    brandName: "NovoLog",
    drugClass: ["Endocrine", "Insulin", "Rapid-Acting"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Insulin Regular",
    brandName: "Humulin R",
    drugClass: ["Endocrine", "Insulin", "Short-Acting"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Insulin NPH",
    brandName: "Humulin N",
    drugClass: ["Endocrine", "Insulin", "Intermediate-Acting"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Insulin Glargine",
    brandName: "Lantus",
    drugClass: ["Endocrine", "Insulin", "Long-Acting"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Insulin Detemir",
    brandName: "Levemir",
    drugClass: ["Endocrine", "Insulin", "Long-Acting"],
    isHighYield: true,
    fdaApproved: true,
  },

  // Oral Hypoglycemics
  {
    genericName: "Metformin",
    brandName: "Glucophage",
    drugClass: ["Endocrine", "Antidiabetic", "Biguanide"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Glipizide",
    brandName: "Glucotrol",
    drugClass: ["Endocrine", "Antidiabetic", "Sulfonylurea"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Glyburide",
    brandName: "DiaBeta",
    drugClass: ["Endocrine", "Antidiabetic", "Sulfonylurea"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Pioglitazone",
    brandName: "Actos",
    drugClass: ["Endocrine", "Antidiabetic", "Thiazolidinedione", "TZD"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Sitagliptin",
    brandName: "Januvia",
    drugClass: ["Endocrine", "Antidiabetic", "DPP-4 Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },

  // GLP-1 Agonists
  {
    genericName: "Semaglutide",
    brandName: "Ozempic",
    drugClass: ["Endocrine", "Antidiabetic", "GLP-1 Agonist"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
  {
    genericName: "Liraglutide",
    brandName: "Victoza",
    drugClass: ["Endocrine", "Antidiabetic", "GLP-1 Agonist"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // SGLT2 Inhibitors
  {
    genericName: "Empagliflozin",
    brandName: "Jardiance",
    drugClass: ["Endocrine", "Antidiabetic", "SGLT2 Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Canagliflozin",
    brandName: "Invokana",
    drugClass: ["Endocrine", "Antidiabetic", "SGLT2 Inhibitor"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },

  // Thyroid
  {
    genericName: "Levothyroxine",
    brandName: "Synthroid",
    drugClass: ["Endocrine", "Thyroid Hormone Replacement"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Methimazole",
    brandName: "Tapazole",
    drugClass: ["Endocrine", "Antithyroid"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Propylthiouracil",
    drugClass: ["Endocrine", "Antithyroid"],
    isHighYield: true,
    fdaApproved: true,
    blackBoxWarning: true,
  },
];

// =============================================================================
// ANALGESICS / ANTI-INFLAMMATORY
// =============================================================================

export const DRUG_REGISTRY_ANALGESICS: DrugMeta[] = [
  {
    genericName: "Acetaminophen",
    brandName: "Tylenol",
    aliases: ["Paracetamol"],
    drugClass: ["Analgesic", "Antipyretic"],
    isHighYield: true,
    fdaApproved: true,
  },
];

// =============================================================================
// PSYCHIATRY
// =============================================================================

export const DRUG_REGISTRY_PSYCHIATRY: DrugMeta[] = [
  {
    genericName: "Sertraline",
    brandName: "Zoloft",
    drugClass: ["Antidepressant", "SSRI"],
    isHighYield: true,
    fdaApproved: true,
  },
  {
    genericName: "Fluoxetine",
    brandName: "Prozac",
    drugClass: ["Antidepressant", "SSRI"],
    isHighYield: true,
    fdaApproved: true,
  },
];

// =============================================================================
// EXPORT ALL DRUGS
// =============================================================================

export const DRUG_REGISTRY: DrugMeta[] = [
  ...DRUG_REGISTRY_ANTIBIOTICS,
  ...DRUG_REGISTRY_CARDIOVASCULAR,
  ...DRUG_REGISTRY_ENDOCRINE,
  ...DRUG_REGISTRY_ANALGESICS,
  ...DRUG_REGISTRY_PSYCHIATRY,
];

export function buildDrugId(drug: DrugMeta): string {
  return drug.genericName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Get all drugs from the registry
 * @returns Array of all drug metadata
 */
export function getAllDrugs(): DrugMeta[] {
  return DRUG_REGISTRY;
}
