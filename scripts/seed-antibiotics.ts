/**
 * Antibiotic Guidelines Seeding Script
 *
 * Seeds the AntibioticGuideline table with organism-antibiotic coverage data
 * for the Bug-Drug Mastery drill mode.
 *
 * Usage:
 *   npx ts-node scripts/seed-antibiotics.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface AntibioticDrug {
  id: string;
  name: string;
  class: string;
}

interface OrganismGuideline {
  organism: string;
  class: string;
  description: string;
  effectiveDrugs: string[]; // Drug names
  resistantDrugs?: string[]; // Drug names
  notes?: string;
}

// All available antibiotics (for reference)
const ANTIBIOTICS: AntibioticDrug[] = [
  { id: 'abx-001', name: 'Penicillin', class: 'Beta-lactam' },
  { id: 'abx-002', name: 'Amoxicillin', class: 'Beta-lactam' },
  { id: 'abx-003', name: 'Amoxicillin-Clavulanate', class: 'Beta-lactam + Inhibitor' },
  { id: 'abx-004', name: 'Nafcillin', class: 'Beta-lactam' },
  { id: 'abx-005', name: 'Piperacillin-Tazobactam', class: 'Beta-lactam + Inhibitor' },
  { id: 'abx-006', name: 'Ceftriaxone', class: 'Cephalosporin (3rd gen)' },
  { id: 'abx-007', name: 'Cefepime', class: 'Cephalosporin (4th gen)' },
  { id: 'abx-008', name: 'Vancomycin', class: 'Glycopeptide' },
  { id: 'abx-009', name: 'Azithromycin', class: 'Macrolide' },
  { id: 'abx-010', name: 'Ciprofloxacin', class: 'Fluoroquinolone' },
  { id: 'abx-011', name: 'Levofloxacin', class: 'Fluoroquinolone' },
  { id: 'abx-012', name: 'Doxycycline', class: 'Tetracycline' },
  { id: 'abx-013', name: 'Metronidazole', class: 'Nitroimidazole' },
  { id: 'abx-014', name: 'Meropenem', class: 'Carbapenem' },
  { id: 'abx-015', name: 'Fluconazole', class: 'Azole antifungal' },
];

// Create drug ID to name mapping
const DRUG_MAP: Record<string, string> = ANTIBIOTICS.reduce(
  (acc, drug) => {
    acc[drug.id] = drug.name;
    return acc;
  },
  {} as Record<string, string>
);

// Organism guidelines with coverage data
const ORGANISM_GUIDELINES: OrganismGuideline[] = [
  {
    organism: 'Streptococcus pneumoniae',
    class: 'Gram Positive',
    description: 'Most common cause of community-acquired pneumonia (CAP)',
    effectiveDrugs: ['Penicillin', 'Amoxicillin', 'Ceftriaxone', 'Levofloxacin', 'Azithromycin'],
    resistantDrugs: ['Metronidazole'],
    notes:
      'Increasing resistance to macrolides in some regions. Fluoroquinolones reserved for penicillin-allergic patients.',
  },
  {
    organism: 'Staphylococcus aureus (MSSA)',
    class: 'Gram Positive',
    description: 'Methicillin-sensitive S. aureus - common cause of skin/soft tissue infections',
    effectiveDrugs: ['Nafcillin', 'Ceftriaxone', 'Amoxicillin-Clavulanate'],
    resistantDrugs: ['Penicillin', 'Amoxicillin', 'Azithromycin'],
    notes:
      'MSSA produces beta-lactamase, making it resistant to penicillin. Use anti-staphylococcal penicillins or cephalosporins.',
  },
  {
    organism: 'MRSA',
    class: 'Gram Positive',
    description: 'Methicillin-resistant Staphylococcus aureus',
    effectiveDrugs: ['Vancomycin'],
    resistantDrugs: ['Nafcillin', 'Ceftriaxone', 'Cefepime', 'Penicillin', 'Amoxicillin'],
    notes:
      'Vancomycin is first-line for severe MRSA infections. Alternatives include Linezolid, Daptomycin, or Ceftaroline.',
  },
  {
    organism: 'Enterococcus faecalis',
    class: 'Gram Positive',
    description: 'Common cause of UTI and endocarditis',
    effectiveDrugs: ['Vancomycin', 'Amoxicillin', 'Piperacillin-Tazobactam'],
    resistantDrugs: ['Ceftriaxone', 'Cefepime'],
    notes:
      'Intrinsically resistant to cephalosporins. Ampicillin or Vancomycin are first-line. For serious infections, consider ampicillin + gentamicin.',
  },
  {
    organism: 'Escherichia coli',
    class: 'Gram Negative',
    description: 'Most common cause of urinary tract infections (UTI)',
    effectiveDrugs: [
      'Amoxicillin',
      'Amoxicillin-Clavulanate',
      'Ceftriaxone',
      'Ciprofloxacin',
      'Levofloxacin',
    ],
    resistantDrugs: ['Penicillin', 'Azithromycin'],
    notes:
      'First-line for uncomplicated UTI: Nitrofurantoin or TMP-SMX. Fluoroquinolone resistance increasing. ESBL strains require carbapenems.',
  },
  {
    organism: 'Pseudomonas aeruginosa',
    class: 'Gram Negative',
    description: 'Opportunistic pathogen causing nosocomial infections, common in CF patients',
    effectiveDrugs: ['Piperacillin-Tazobactam', 'Cefepime', 'Ciprofloxacin', 'Meropenem'],
    resistantDrugs: [
      'Ceftriaxone',
      'Amoxicillin',
      'Amoxicillin-Clavulanate',
      'Vancomycin',
      'Azithromycin',
    ],
    notes:
      'Requires anti-pseudomonal antibiotics. Dual therapy often used for severe infections. Intrinsically resistant to many antibiotics.',
  },
  {
    organism: 'Klebsiella pneumoniae',
    class: 'Gram Negative',
    description: 'CAP in alcoholics, aspiration pneumonia, nosocomial infections',
    effectiveDrugs: ['Ceftriaxone', 'Levofloxacin', 'Piperacillin-Tazobactam', 'Meropenem'],
    resistantDrugs: ['Penicillin', 'Amoxicillin'],
    notes:
      'ESBL-producing strains require carbapenems. Often causes severe necrotizing pneumonia with "currant jelly" sputum.',
  },
  {
    organism: 'Haemophilus influenzae',
    class: 'Gram Negative',
    description: 'CAP, otitis media, epiglottitis, especially in children',
    effectiveDrugs: ['Amoxicillin', 'Amoxicillin-Clavulanate', 'Ceftriaxone', 'Azithromycin'],
    resistantDrugs: ['Penicillin'],
    notes:
      'Many strains produce beta-lactamase. Use amoxicillin-clavulanate for beta-lactamase producers.',
  },
  {
    organism: 'Mycoplasma pneumoniae',
    class: 'Atypical',
    description: 'Atypical CAP, common in young adults ("walking pneumonia")',
    effectiveDrugs: ['Azithromycin', 'Doxycycline', 'Levofloxacin'],
    resistantDrugs: ['Penicillin', 'Amoxicillin', 'Ceftriaxone', 'Vancomycin'],
    notes:
      'No cell wall, so beta-lactams ineffective. Macrolides or tetracyclines are first-line. Associated with cold agglutinins.',
  },
  {
    organism: 'Legionella pneumophila',
    class: 'Atypical',
    description: 'Atypical CAP from water sources (cooling towers, hot tubs)',
    effectiveDrugs: ['Azithromycin', 'Levofloxacin'],
    resistantDrugs: ['Penicillin', 'Amoxicillin', 'Ceftriaxone', 'Vancomycin'],
    notes:
      'Intracellular organism requiring antibiotics with good intracellular penetration. Fluoroquinolones or macrolides. Check urinary antigen.',
  },
  {
    organism: 'Chlamydia pneumoniae',
    class: 'Atypical',
    description: 'Atypical CAP, respiratory infections',
    effectiveDrugs: ['Azithromycin', 'Doxycycline', 'Levofloxacin'],
    resistantDrugs: ['Penicillin', 'Amoxicillin', 'Ceftriaxone', 'Vancomycin'],
    notes: 'Obligate intracellular pathogen. Macrolides or tetracyclines first-line.',
  },
  {
    organism: 'Candida albicans',
    class: 'Fungal',
    description: 'Opportunistic fungal infections (thrush, candidemia, UTI)',
    effectiveDrugs: ['Fluconazole'],
    resistantDrugs: ['Penicillin', 'Vancomycin', 'Ceftriaxone', 'Azithromycin', 'Ciprofloxacin'],
    notes:
      'Fluconazole for most Candida species. Non-albicans species may require echinocandins (e.g., Caspofungin) or Amphotericin B.',
  },
  {
    organism: 'Neisseria gonorrhoeae',
    class: 'Gram Negative',
    description: 'Sexually transmitted infection, pelvic inflammatory disease',
    effectiveDrugs: ['Ceftriaxone', 'Cefepime'],
    resistantDrugs: ['Penicillin', 'Ciprofloxacin'],
    notes:
      'Increasing antibiotic resistance. Current CDC recommendation: Ceftriaxone 500mg IM (single dose). Often co-treat for Chlamydia with Azithromycin.',
  },
  {
    organism: 'Neisseria meningitidis',
    class: 'Gram Negative',
    description: 'Bacterial meningitis, meningococcemia',
    effectiveDrugs: ['Ceftriaxone', 'Penicillin', 'Meropenem'],
    resistantDrugs: ['Vancomycin'],
    notes:
      'Third-generation cephalosporin (Ceftriaxone or Cefotaxime) first-line. Close contacts need prophylaxis with Ciprofloxacin or Rifampin.',
  },
  {
    organism: 'Listeria monocytogenes',
    class: 'Gram Positive',
    description: 'Meningitis in neonates, elderly, immunocompromised',
    effectiveDrugs: ['Amoxicillin', 'Penicillin'],
    resistantDrugs: ['Ceftriaxone', 'Cefepime', 'Vancomycin'],
    notes:
      'Intrinsically resistant to cephalosporins. Ampicillin + Gentamicin is first-line. Add to empiric meningitis coverage in at-risk populations.',
  },
  {
    organism: 'Bacteroides fragilis',
    class: 'Anaerobic',
    description: 'Anaerobic infections (intra-abdominal, aspiration pneumonia)',
    effectiveDrugs: [
      'Metronidazole',
      'Piperacillin-Tazobactam',
      'Meropenem',
      'Amoxicillin-Clavulanate',
    ],
    resistantDrugs: ['Penicillin', 'Ceftriaxone', 'Azithromycin', 'Vancomycin'],
    notes:
      'Most common anaerobic pathogen. Metronidazole is first-line for anaerobic coverage. Often part of polymicrobial infections.',
  },
  {
    organism: 'Clostridium difficile',
    class: 'Anaerobic',
    description: 'Antibiotic-associated colitis, pseudomembranous colitis',
    effectiveDrugs: ['Vancomycin', 'Metronidazole'],
    resistantDrugs: ['Ceftriaxone', 'Ciprofloxacin', 'Amoxicillin'],
    notes:
      'Oral Vancomycin is first-line for severe disease. Fidaxomicin for recurrent disease. IV Metronidazole if oral not possible.',
  },
  {
    organism: 'Streptococcus pyogenes (Group A Strep)',
    class: 'Gram Positive',
    description: 'Pharyngitis, cellulitis, necrotizing fasciitis',
    effectiveDrugs: ['Penicillin', 'Amoxicillin', 'Ceftriaxone', 'Azithromycin'],
    resistantDrugs: ['Metronidazole'],
    notes:
      'Penicillin is first-line (no resistance reported). Macrolides for penicillin-allergic patients. Clindamycin for toxin-mediated disease.',
  },
  {
    organism: 'Streptococcus agalactiae (Group B Strep)',
    class: 'Gram Positive',
    description: 'Neonatal sepsis, postpartum infections',
    effectiveDrugs: ['Penicillin', 'Amoxicillin', 'Ceftriaxone', 'Vancomycin'],
    resistantDrugs: ['Metronidazole'],
    notes:
      'Intrapartum prophylaxis with Penicillin G or Ampicillin to prevent neonatal sepsis. Vancomycin for penicillin-allergic patients.',
  },
  {
    organism: 'Streptococcus viridans',
    class: 'Gram Positive',
    description: 'Subacute bacterial endocarditis, dental procedures',
    effectiveDrugs: ['Penicillin', 'Amoxicillin', 'Ceftriaxone', 'Vancomycin'],
    resistantDrugs: ['Metronidazole'],
    notes:
      'Penicillin or Ceftriaxone first-line. Often requires prolonged therapy for endocarditis. Prophylaxis before dental procedures in high-risk patients.',
  },
];

async function seedAntibioticGuidelines() {
  console.log('💊 Starting Antibiotic Guidelines seeding...\n');

  try {
    // Check if guidelines already exist
    const existingCount = await prisma.antibioticGuideline.count();

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing guidelines.`);
      console.log('❓ Delete and reseed? (This will remove all existing guidelines)');
      console.log('   To proceed: Run with --force flag\n');

      // Check for --force flag
      if (!process.argv.includes('--force')) {
        console.log('Seeding cancelled. Use --force to overwrite existing data.');
        return;
      }

      console.log('🗑️  Deleting existing guidelines...');
      await prisma.antibioticGuideline.deleteMany({});
      console.log('✅ Deleted.\n');
    }

    // Insert guidelines
    console.log(`📝 Inserting ${ORGANISM_GUIDELINES.length} organism guidelines...\n`);

    let insertedCount = 0;
    const classStats: Record<string, number> = {};

    for (const guideline of ORGANISM_GUIDELINES) {
      await prisma.antibioticGuideline.create({
        data: {

          id: uuidv4(),


          organism: guideline.organism,
          class: guideline.class,
          effective: guideline.effectiveDrugs,
          resistant: guideline.resistantDrugs || [],
          notes: guideline.notes,
          description: guideline.description,
        },
      });

      insertedCount++;
      classStats[guideline.class] = (classStats[guideline.class] || 0) + 1;

      // Progress indicator
      if (insertedCount % 5 === 0) {
        console.log(`   ✓ ${insertedCount}/${ORGANISM_GUIDELINES.length} guidelines inserted...`);
      }
    }

    console.log(`\n✅ Successfully seeded ${insertedCount} Antibiotic Guidelines!\n`);
    console.log('📊 Breakdown by class:');
    Object.entries(classStats).forEach(([organismClass, count]) => {
      console.log(`   ${organismClass}: ${count} organisms`);
    });

    console.log('\n🎯 Next steps:');
    console.log('   1. Bug-Drug Mastery mode will now use database guidelines');
    console.log('   2. To add more organisms, edit this script and run with --force');
    console.log('   3. Coverage data is dynamically loaded each session\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedAntibioticGuidelines()
  .then(() => {
    console.log('🏁 Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
