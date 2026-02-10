#!/usr/bin/env npx tsx
/**
 * Phase 1d: Standardize Drug Class Names
 *
 * 1. Remove "N/a" and empty entries
 * 2. Title Case normalization
 * 3. Merge common synonym groups
 * 4. Remove redundant parenthetical expansions when canonical form exists
 *
 * Usage: npx tsx scripts/fixes/phase1d-standardize-drug-classes.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';

const DRY_RUN = process.argv.includes('--dry-run');

// Canonical class name -> alternate names to merge INTO it
const SYNONYM_MAP: Record<string, string[]> = {
  // ACE Inhibitors
  'ACE Inhibitor': ['Angiotensin-converting enzyme (ace) inhibitor', 'Angiotensin-converting enzyme inhibitor', 'Ace inhibitor', 'ACE inhibitors'],
  // ARBs
  'Angiotensin II Receptor Blocker (ARB)': ['Angiotensin ii receptor blocker (arb)', 'Arb', 'ARBs', 'Angiotensin receptor blocker'],
  // Beta Blockers
  'Beta-Adrenergic Blocker': ['Beta-adrenergic blocker', 'Beta blocker', 'Beta-blocker', 'Beta blockers', 'β-blocker', 'Beta-adrenergic antagonist'],
  // CCBs
  'Calcium Channel Blocker': ['Calcium channel blocker', 'Calcium channel blockers', 'CCB'],
  // SSRIs
  'Selective Serotonin Reuptake Inhibitor (SSRI)': ['Selective serotonin reuptake inhibitor (ssri)', 'SSRI', 'SSRIs'],
  // SNRIs
  'Serotonin-Norepinephrine Reuptake Inhibitor (SNRI)': ['Serotonin-norepinephrine reuptake inhibitor (snri)', 'SNRI', 'SNRIs'],
  // PPIs
  'Proton Pump Inhibitor (PPI)': ['Proton pump inhibitor (ppi)', 'PPI', 'PPIs', 'Proton pump inhibitor'],
  // NSAIDs
  'Nonsteroidal Anti-Inflammatory Drug (NSAID)': ['Nonsteroidal anti-inflammatory drug (nsaid)', 'NSAID', 'NSAIDs', 'Non-steroidal anti-inflammatory drug'],
  // Statins
  'HMG-CoA Reductase Inhibitor (Statin)': ['Hmg-coa reductase inhibitor (statin)', 'Statin', 'Statins', 'HMG-CoA reductase inhibitor'],
  // Loop Diuretics
  'Loop Diuretic': ['Loop diuretic', 'Loop diuretics'],
  // Thiazide Diuretics
  'Thiazide Diuretic': ['Thiazide diuretic', 'Thiazide diuretics', 'Thiazide-like diuretic'],
  // Antipsychotics
  'Atypical Antipsychotic': ['Atypical (second-generation)', 'Antipsychotic, atypical (second generation)', 'Second-generation (atypical)', 'Second-generation antipsychotic', 'Atypical antipsychotic'],
  'Typical Antipsychotic': ['First-generation (typical)', 'Typical (first-generation)', 'First-generation antipsychotic', 'Typical antipsychotic'],
  // Antihistamines
  'First-Generation Antihistamine': ['First-generation h1 antagonist', 'First-generation antihistamine', 'H1 antihistamine (first generation)'],
  'Second-Generation Antihistamine': ['Second-generation h1 antagonist', 'Second-generation antihistamine', 'H1 antihistamine (second generation)'],
  // Benzodiazepines
  'Benzodiazepine': ['Benzodiazepine', 'Benzodiazepines'],
  // Opioids
  'Opioid Analgesic': ['Opioid analgesic', 'Opioid', 'Opioids', 'Narcotic analgesic'],
  // Insulin
  'Insulin': ['Insulin', 'Insulins'],
  // GLP-1 Agonists
  'GLP-1 Receptor Agonist': ['Glucagon-like peptide-1 (glp-1) receptor agonist', 'GLP-1 agonist', 'GLP-1 receptor agonist'],
  // SGLT2 Inhibitors
  'SGLT2 Inhibitor': ['Sodium-glucose cotransporter 2 (sglt2) inhibitor', 'SGLT2 inhibitor', 'Sglt2 inhibitor'],
  // DPP-4 Inhibitors
  'DPP-4 Inhibitor': ['Dipeptidyl peptidase-4 (dpp-4) inhibitor', 'DPP-4 inhibitor', 'Dpp-4 inhibitor'],
  // Sulfonylureas
  'Sulfonylurea': ['Sulfonylurea', 'Sulfonylureas'],
  // Antibiotics
  'Fluoroquinolone': ['Fluoroquinolone', 'Fluoroquinolones'],
  'Aminoglycoside': ['Aminoglycoside', 'Aminoglycosides'],
  'Macrolide': ['Macrolide', 'Macrolides'],
  'Tetracycline': ['Tetracycline', 'Tetracyclines'],
  'Cephalosporin': ['Cephalosporin', 'Cephalosporins'],
  'Carbapenem': ['Carbapenem', 'Carbapenems'],
  'Penicillin': ['Penicillin', 'Penicillins'],
  // Anticoagulants
  'Direct Oral Anticoagulant (DOAC)': ['Direct oral anticoagulant (doac)', 'DOAC', 'DOACs', 'Novel oral anticoagulant'],
  'Vitamin K Antagonist': ['Vitamin k antagonist', 'Vitamin K antagonist'],
  // Corticosteroids
  'Glucocorticoid': ['Glucocorticoid', 'Glucocorticoids', 'Corticosteroid', 'Corticosteroids', 'Systemic corticosteroid'],
  // Bronchodilators
  'Short-Acting Beta-2 Agonist (SABA)': ['Short-acting beta-2 agonist (saba)', 'SABA', 'Short-acting beta-agonist'],
  'Long-Acting Beta-2 Agonist (LABA)': ['Long-acting beta-2 agonist (laba)', 'LABA', 'Long-acting beta-agonist'],
  'Long-Acting Muscarinic Antagonist (LAMA)': ['Long-acting muscarinic antagonist (lama)', 'LAMA'],
  // Antiepileptics
  'Anticonvulsant': ['Anticonvulsant', 'Anticonvulsants', 'Antiepileptic', 'Antiepileptics', 'Broad-spectrum anticonvulsant'],
  // DMARDs
  'Disease-Modifying Antirheumatic Drug (DMARD)': ['Disease-modifying antirheumatic drug (dmard)', 'DMARD', 'DMARDs'],
  // PDE5 Inhibitors
  'Phosphodiesterase-5 (PDE5) Inhibitor': ['Phosphodiesterase-5 (pde5) inhibitor', 'PDE5 inhibitor', 'Pde5 inhibitor'],
  // 5-Alpha Reductase Inhibitors
  '5-Alpha Reductase Inhibitor': ['5-alpha reductase inhibitor', '5-alpha reductase inhibitors'],
};

// Build reverse lookup: lowercase alternate -> canonical
function buildReverseLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [canonical, alternates] of Object.entries(SYNONYM_MAP)) {
    for (const alt of alternates) {
      lookup.set(alt.toLowerCase(), canonical);
    }
    // Also map the canonical's lowercase
    lookup.set(canonical.toLowerCase(), canonical);
  }
  return lookup;
}

function toTitleCase(str: string): string {
  // Don't title-case abbreviations or already-correct strings
  if (/^[A-Z]{2,}/.test(str)) return str; // Already uppercase abbreviation
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 1d: Standardize Drug Class Names                   ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  const lookup = buildReverseLookup();

  const drugs = await prisma.drug.findMany({
    select: { id: true, genericName: true, drugClass: true },
  });

  console.log(`\nTotal drugs: ${drugs.length}`);

  let updated = 0;
  let naRemoved = 0;

  for (const drug of drugs) {
    let changed = false;
    const newClasses: string[] = [];

    for (const cls of drug.drugClass) {
      // Remove N/a and empty
      if (!cls || cls.toLowerCase() === 'n/a' || cls.trim() === '') {
        naRemoved++;
        changed = true;
        continue;
      }

      // Check synonym lookup
      const canonical = lookup.get(cls.toLowerCase());
      if (canonical && canonical !== cls) {
        newClasses.push(canonical);
        changed = true;
      } else {
        // Apply title case if it's all lowercase
        if (cls === cls.toLowerCase() && cls.length > 3) {
          const titled = toTitleCase(cls);
          if (titled !== cls) {
            newClasses.push(titled);
            changed = true;
          } else {
            newClasses.push(cls);
          }
        } else {
          newClasses.push(cls);
        }
      }
    }

    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const c of newClasses) {
      const lower = c.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        deduped.push(c);
      } else {
        changed = true; // Duplicate removed
      }
    }

    if (changed) {
      if (!DRY_RUN) {
        await prisma.drug.update({
          where: { id: drug.id },
          data: { drugClass: deduped },
        });
      }
      updated++;
    }
  }

  // Count unique classes after
  if (!DRY_RUN) {
    const drugsAfter = await prisma.drug.findMany({ select: { drugClass: true } });
    const classesAfter = new Set<string>();
    for (const d of drugsAfter) {
      for (const c of d.drugClass) classesAfter.add(c);
    }
    console.log(`\nUnique classes after: ${classesAfter.size}`);
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Drugs updated: ${updated}`);
  console.log(`N/A values removed: ${naRemoved}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
