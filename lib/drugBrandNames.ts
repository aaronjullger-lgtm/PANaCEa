/**
 * Common brand name mappings for generic drugs.
 * Format: Generic Name (Brand Name)
 */
export const BRAND_NAME_MAP: Record<string, string> = {
  // SNRIs
  "duloxetine": "Cymbalta",
  "venlafaxine": "Effexor",
  "desvenlafaxine": "Pristiq",
  // SSRIs
  "fluoxetine": "Prozac",
  "sertraline": "Zoloft",
  "paroxetine": "Paxil",
  "escitalopram": "Lexapro",
  "citalopram": "Celexa",
  "fluvoxamine": "Luvox",
  // TCAs
  "amitriptyline": "Elavil",
  "nortriptyline": "Pamelor",
  "imipramine": "Tofranil",
  // Antipsychotics
  "quetiapine": "Seroquel",
  "risperidone": "Risperdal",
  "olanzapine": "Zyprexa",
  "aripiprazole": "Abilify",
  "haloperidol": "Haldol",
  // Benzodiazepines
  "alprazolam": "Xanax",
  "diazepam": "Valium",
  "lorazepam": "Ativan",
  "clonazepam": "Klonopin",
  // Opioids
  "oxycodone": "OxyContin",
  "hydrocodone": "Vicodin",
  "morphine": "MS Contin",
  "fentanyl": "Duragesic",
  "tramadol": "Ultram",
  // Beta-blockers
  "metoprolol": "Lopressor",
  "atenolol": "Tenormin",
  "propranolol": "Inderal",
  "carvedilol": "Coreg",
  // ACE Inhibitors
  "lisinopril": "Zestril",
  "enalapril": "Vasotec",
  "captopril": "Capoten",
  "ramipril": "Altace",
  // ARBs
  "losartan": "Cozaar",
  "valsartan": "Diovan",
  "irbesartan": "Avapro",
  // Calcium Channel Blockers
  "amlodipine": "Norvasc",
  "diltiazem": "Cardizem",
  "verapamil": "Calan",
  "nifedipine": "Procardia",
  // Diuretics
  "furosemide": "Lasix",
  "hydrochlorothiazide": "Microzide",
  "spironolactone": "Aldactone",
  // Statins
  "atorvastatin": "Lipitor",
  "simvastatin": "Zocor",
  "rosuvastatin": "Crestor",
  "pravastatin": "Pravachol",
  // Diabetes
  "metformin": "Glucophage",
  "glipizide": "Glucotrol",
  "glyburide": "DiaBeta",
  "sitagliptin": "Januvia",
  "liraglutide": "Victoza",
  "empagliflozin": "Jardiance",
  // PPIs
  "omeprazole": "Prilosec",
  "esomeprazole": "Nexium",
  "pantoprazole": "Protonix",
  "lansoprazole": "Prevacid",
  // Antibiotics
  "amoxicillin": "Amoxil",
  "azithromycin": "Zithromax",
  "ciprofloxacin": "Cipro",
  "levofloxacin": "Levaquin",
  "doxycycline": "Vibramycin",
  "metronidazole": "Flagyl",
  // Antivirals
  "acyclovir": "Zovirax",
  "valacyclovir": "Valtrex",
  "oseltamivir": "Tamiflu",
  // Antihistamines
  "cetirizine": "Zyrtec",
  "loratadine": "Claritin",
  "diphenhydramine": "Benadryl",
  "fexofenadine": "Allegra",
  // Corticosteroids
  "prednisone": "Deltasone",
  "methylprednisolone": "Medrol",
  "dexamethasone": "Decadron",
  // Thyroid
  "levothyroxine": "Synthroid",
  "liothyronine": "Cytomel",
  // Pain/Anti-inflammatory
  "ibuprofen": "Motrin",
  "naproxen": "Aleve",
  "acetaminophen": "Tylenol",
  "celecoxib": "Celebrex",
  // Anticonvulsants
  "gabapentin": "Neurontin",
  "pregabalin": "Lyrica",
  "levetiracetam": "Keppra",
  "valproate": "Depakote",
  "carbamazepine": "Tegretol",
  "phenytoin": "Dilantin",
  "lamotrigine": "Lamictal",
  "topiramate": "Topamax",
  // Muscle Relaxants
  "cyclobenzaprine": "Flexeril",
  "baclofen": "Lioresal",
  "tizanidine": "Zanaflex",
  // Anticoagulants
  "warfarin": "Coumadin",
  "rivaroxaban": "Xarelto",
  "apixaban": "Eliquis",
  "dabigatran": "Pradaxa",
  "enoxaparin": "Lovenox",
  // Sleep
  "zolpidem": "Ambien",
  "eszopiclone": "Lunesta",
  "trazodone": "Desyrel",
  // ADHD
  "methylphenidate": "Ritalin",
  "amphetamine": "Adderall",
  "lisdexamfetamine": "Vyvanse",
  "atomoxetine": "Strattera",
  // Respiratory
  "albuterol": "Ventolin",
  "fluticasone": "Flovent",
  "montelukast": "Singulair",
  "tiotropium": "Spiriva",
  // GI
  "ondansetron": "Zofran",
  "promethazine": "Phenergan",
  "sucralfate": "Carafate",
  // Other
  "sildenafil": "Viagra",
  "tadalafil": "Cialis",
  "finasteride": "Proscar",
  "tamsulosin": "Flomax",
  "memantine": "Namenda",
  "donepezil": "Aricept",
};

/**
 * Get brand name for a generic drug name
 */
export function getBrandName(genericName: string): string | null {
  const normalized = genericName.toLowerCase().trim();
  return BRAND_NAME_MAP[normalized] || null;
}

/**
 * Format drug name for display: Generic Name (Brand Name) or just Generic Name
 * Always capitalizes the first letter of the generic name
 */
export function formatDrugName(genericName: string): string {
  if (!genericName) return "";
  
  // Capitalize first letter
  const formattedGeneric = genericName.charAt(0).toUpperCase() + genericName.slice(1).toLowerCase();
  
  // Get brand name
  const brandName = getBrandName(genericName);
  
  // Return formatted name
  return brandName ? `${formattedGeneric} (${brandName})` : formattedGeneric;
}
