// components/DrugDetailModal.tsx
// Modal component for displaying detailed drug/pharmacology information

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DrugEntry, DrugInteraction } from "../pharm/drugTypes";

interface DrugDetailModalProps {
  drug: DrugEntry;
  onClose: () => void;
  onDrillDrug?: (drug: DrugEntry) => void;
}

/**
 * Convert a string to Title Case for proper drug name display.
 * E.g., "duloxetine" -> "Duloxetine", "acetyl salicylic acid" -> "Acetyl Salicylic Acid"
 */
function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Common brand name mappings for generic drugs.
 * Format: Generic Name (Brand Name)
 */
const BRAND_NAME_MAP: Record<string, string> = {
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
function getBrandName(genericName: string): string | null {
  const normalized = genericName.toLowerCase().trim();
  return BRAND_NAME_MAP[normalized] || null;
}

const DrugDetailModal: React.FC<DrugDetailModalProps> = ({
  drug,
  onClose,
  onDrillDrug,
}) => {
  // Format interaction for display
  const formatInteraction = (interaction: string | DrugInteraction): string => {
    if (typeof interaction === "string") {
      return interaction;
    }
    if (interaction.drug && interaction.effect) {
      return `${toTitleCase(interaction.drug)}: ${interaction.effect}`;
    }
    if (interaction.category && interaction.effect) {
      return `${interaction.category} (${interaction.examples || ""}): ${interaction.effect}`;
    }
    return JSON.stringify(interaction);
  };

  // Title case the drug name for display
  const displayDrugName = toTitleCase(drug.term);
  
  // Get brand name if available
  const brandName = getBrandName(drug.term);
  
  // Format: "Generic Name (Brand Name)" or just "Generic Name"
  const fullDisplayName = brandName 
    ? `${displayDrugName} (${brandName})`
    : displayDrugName;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                {fullDisplayName}
              </h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  {drug.class}
                </span>
                {drug.subclass && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                    {drug.subclass}
                  </span>
                )}
                {drug.type && drug.type !== "N/A" && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                    {drug.type}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content sections with glass card styling */}
          <div className="space-y-5">
            {/* Mechanism of Action */}
            <section className="card-glass p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-3">
                Mechanism of Action
              </h3>
              <p className="text-[var(--color-text-primary)] text-sm leading-loose">
                {drug.MOA}
              </p>
            </section>

            {/* Clinical Notes */}
            {drug.clinicalNotes && (
              <section className="card-glass p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-3">
                  Clinical Notes
                </h3>
                <p className="text-[var(--color-text-primary)] text-sm leading-loose">
                  {drug.clinicalNotes}
                </p>
              </section>
            )}

            {/* Pharmacokinetics */}
            {drug.pharmacokinetics && (
              <section className="card-glass p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-3">
                  Pharmacokinetics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                    <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Metabolism</p>
                    <p className="text-sm text-[var(--color-text-primary)]">{drug.pharmacokinetics.metabolism}</p>
                  </div>
                  <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                    <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Elimination</p>
                    <p className="text-sm text-[var(--color-text-primary)]">{drug.pharmacokinetics.elimination}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Adverse Drug Events */}
            {drug.ADEs && drug.ADEs.length > 0 && (
              <section className="card-glass p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">
                  Adverse Drug Events (ADEs)
                </h3>
                <ul className="list-disc list-inside space-y-2">
                  {drug.ADEs.map((ade, idx) => (
                    <li key={idx} className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                      {ade}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Contraindications */}
            {drug.contraindications && drug.contraindications.length > 0 && (
              <section className="card-glass p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-orange-500 uppercase tracking-wide mb-3">
                  Contraindications
                </h3>
                <ul className="list-disc list-inside space-y-2">
                  {drug.contraindications.map((ci, idx) => (
                    <li key={idx} className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                      {ci}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Drug Interactions */}
            {drug.interactions && drug.interactions.length > 0 && (
              <section className="card-glass p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-yellow-600 uppercase tracking-wide mb-3">
                  Drug Interactions
                </h3>
                <ul className="list-disc list-inside space-y-2">
                  {drug.interactions.map((interaction, idx) => (
                    <li key={idx} className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                      {formatInteraction(interaction)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Antidote */}
            {drug.antidote && drug.antidote !== "N/A" && (
              <section className="card-glass p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-3">
                  Antidote
                </h3>
                <p className="text-[var(--color-text-primary)] text-sm leading-loose">
                  {drug.antidote}
                </p>
              </section>
            )}

            {/* Ingredients/Brand Names */}
            {drug.ingredients && drug.ingredients.length > 0 && (
              <section className="card-glass p-4 rounded-xl">
                <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                  Related Names / Ingredients
                </h3>
                <div className="flex flex-wrap gap-2">
                  {drug.ingredients.map((ingredient, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 text-xs rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                    >
                      {toTitleCase(ingredient)}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Close
            </button>
            {onDrillDrug && (
              <button
                onClick={() => onDrillDrug(drug)}
                className="px-4 py-2 text-sm font-medium btn-glass rounded-lg"
              >
                Practice Questions on {drug.class}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DrugDetailModal;
