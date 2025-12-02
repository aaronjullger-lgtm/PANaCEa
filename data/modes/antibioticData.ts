import type { 
  OrganismInfection, 
  AntibioticDrug, 
  AntibioticDrillQuestion,
  AntibioticDrillType 
} from '@/types/drill-modes';

/**
 * Organism/Infection database
 */
export const ORGANISMS: OrganismInfection[] = [
  { id: 'org-001', name: 'Streptococcus pneumoniae', category: 'gram_positive', description: 'Most common cause of CAP' },
  { id: 'org-002', name: 'Staphylococcus aureus (MSSA)', category: 'gram_positive', description: 'Skin/soft tissue infections' },
  { id: 'org-003', name: 'MRSA', category: 'gram_positive', description: 'Methicillin-resistant S. aureus' },
  { id: 'org-004', name: 'Enterococcus faecalis', category: 'gram_positive', description: 'UTI, endocarditis' },
  { id: 'org-005', name: 'Escherichia coli', category: 'gram_negative', description: 'Most common cause of UTI' },
  { id: 'org-006', name: 'Pseudomonas aeruginosa', category: 'gram_negative', description: 'Nosocomial infections, CF' },
  { id: 'org-007', name: 'Klebsiella pneumoniae', category: 'gram_negative', description: 'CAP in alcoholics, aspiration' },
  { id: 'org-008', name: 'Haemophilus influenzae', category: 'gram_negative', description: 'CAP, otitis media, epiglottitis' },
  { id: 'org-009', name: 'Mycoplasma pneumoniae', category: 'atypical', description: 'Atypical CAP, young adults' },
  { id: 'org-010', name: 'Legionella pneumophila', category: 'atypical', description: 'Atypical CAP, water sources' },
  { id: 'org-011', name: 'Candida albicans', category: 'fungal', description: 'Opportunistic fungal infections' },
  { id: 'org-012', name: 'Neisseria gonorrhoeae', category: 'gram_negative', description: 'STI, pelvic inflammatory disease' }
];

/**
 * Antibiotic drug database
 */
export const ANTIBIOTICS: AntibioticDrug[] = [
  { id: 'abx-001', name: 'Penicillin', class: 'Beta-lactam', description: 'Natural penicillin' },
  { id: 'abx-002', name: 'Amoxicillin', class: 'Beta-lactam', description: 'Aminopenicillin' },
  { id: 'abx-003', name: 'Amoxicillin-Clavulanate', class: 'Beta-lactam + Inhibitor', description: 'Extended spectrum' },
  { id: 'abx-004', name: 'Nafcillin', class: 'Beta-lactam', description: 'Anti-staphylococcal penicillin' },
  { id: 'abx-005', name: 'Piperacillin-Tazobactam', class: 'Beta-lactam + Inhibitor', description: 'Anti-pseudomonal' },
  { id: 'abx-006', name: 'Ceftriaxone', class: 'Cephalosporin (3rd gen)', description: 'Broad spectrum' },
  { id: 'abx-007', name: 'Cefepime', class: 'Cephalosporin (4th gen)', description: 'Anti-pseudomonal' },
  { id: 'abx-008', name: 'Vancomycin', class: 'Glycopeptide', description: 'MRSA coverage' },
  { id: 'abx-009', name: 'Azithromycin', class: 'Macrolide', description: 'Atypical coverage' },
  { id: 'abx-010', name: 'Ciprofloxacin', class: 'Fluoroquinolone', description: 'Gram-negative, atypical' },
  { id: 'abx-011', name: 'Levofloxacin', class: 'Fluoroquinolone', description: 'Respiratory quinolone' },
  { id: 'abx-012', name: 'Doxycycline', class: 'Tetracycline', description: 'Atypical, tick-borne' },
  { id: 'abx-013', name: 'Metronidazole', class: 'Nitroimidazole', description: 'Anaerobic coverage' },
  { id: 'abx-014', name: 'Meropenem', class: 'Carbapenem', description: 'Broad spectrum, last-line' },
  { id: 'abx-015', name: 'Fluconazole', class: 'Azole antifungal', description: 'Candida coverage' }
];

/**
 * Coverage mapping: Organism -> Appropriate Drugs
 */
export const COVERAGE_MAP: Record<string, string[]> = {
  'org-001': ['abx-001', 'abx-002', 'abx-006', 'abx-011'], // S. pneumoniae
  'org-002': ['abx-004', 'abx-006'], // MSSA
  'org-003': ['abx-008'], // MRSA
  'org-004': ['abx-008', 'abx-002'], // Enterococcus
  'org-005': ['abx-002', 'abx-003', 'abx-006', 'abx-010'], // E. coli
  'org-006': ['abx-005', 'abx-007', 'abx-010', 'abx-014'], // Pseudomonas
  'org-007': ['abx-006', 'abx-011'], // Klebsiella
  'org-008': ['abx-002', 'abx-003', 'abx-006'], // H. influenzae
  'org-009': ['abx-009', 'abx-012', 'abx-011'], // Mycoplasma
  'org-010': ['abx-009', 'abx-011'], // Legionella
  'org-011': ['abx-015'], // Candida
  'org-012': ['abx-006', 'abx-007'] // N. gonorrhoeae
};

/**
 * Generate drill questions for different types
 */
export function generateAntibioticDrill(): AntibioticDrillQuestion {
  const types: AntibioticDrillType[] = ['coverage', 'mechanism', 'side_effects', 'empiric_choice'];
  const randomType = types[Math.floor(Math.random() * types.length)];
  
  switch (randomType) {
    case 'coverage':
      return generateCoverageDrill();
    case 'mechanism':
      return generateMechanismDrill();
    case 'side_effects':
      return generateSideEffectDrill();
    case 'empiric_choice':
      return generateEmpiricChoiceDrill();
  }
}

function generateCoverageDrill(): AntibioticDrillQuestion {
  const organism = ORGANISMS[Math.floor(Math.random() * ORGANISMS.length)];
  const correctDrugs = COVERAGE_MAP[organism.id] || [];
  
  return {
    id: `drill-cov-${Date.now()}`,
    type: 'coverage',
    organism,
    correctDrugs,
    explanation: `For ${organism.name}, appropriate antibiotics include coverage that targets ${organism.category} bacteria.`
  };
}

function generateMechanismDrill(): AntibioticDrillQuestion {
  const mechanisms = [
    {
      drug: ANTIBIOTICS[0], // Penicillin
      question: 'What is the mechanism of action of Penicillin?',
      choices: [
        'Inhibits cell wall synthesis by binding PBPs',
        'Inhibits protein synthesis at 30S ribosome',
        'Inhibits DNA gyrase',
        'Inhibits folic acid synthesis'
      ],
      correctIndex: 0,
      explanation: 'Beta-lactams like Penicillin inhibit cell wall synthesis by binding to penicillin-binding proteins (PBPs), preventing peptidoglycan cross-linking.'
    },
    {
      drug: ANTIBIOTICS[7], // Vancomycin
      question: 'What is the mechanism of action of Vancomycin?',
      choices: [
        'Inhibits protein synthesis at 50S ribosome',
        'Inhibits cell wall synthesis by binding D-Ala-D-Ala',
        'Disrupts cell membrane',
        'Inhibits folic acid synthesis'
      ],
      correctIndex: 1,
      explanation: 'Vancomycin inhibits cell wall synthesis by binding to D-Ala-D-Ala terminal of peptidoglycan precursors, preventing cross-linking.'
    },
    {
      drug: ANTIBIOTICS[8], // Azithromycin
      question: 'What is the mechanism of action of Azithromycin?',
      choices: [
        'Inhibits cell wall synthesis',
        'Inhibits protein synthesis at 50S ribosome',
        'Inhibits DNA gyrase',
        'Inhibits folic acid synthesis'
      ],
      correctIndex: 1,
      explanation: 'Macrolides like Azithromycin inhibit protein synthesis by binding to the 50S ribosomal subunit, blocking translocation.'
    }
  ];
  
  const selected = mechanisms[Math.floor(Math.random() * mechanisms.length)];
  
  return {
    id: `drill-mech-${Date.now()}`,
    type: 'mechanism',
    drug: selected.drug,
    mechanismQuestion: selected.question,
    mechanismChoices: selected.choices,
    correctMechanismIndex: selected.correctIndex,
    explanation: selected.explanation
  };
}

function generateSideEffectDrill(): AntibioticDrillQuestion {
  const sideEffects = [
    {
      drug: ANTIBIOTICS[8], // Azithromycin
      question: 'What is a major adverse effect of Azithromycin?',
      choices: [
        'Nephrotoxicity',
        'QT prolongation',
        'Gray baby syndrome',
        'Disulfiram reaction'
      ],
      correctIndex: 1,
      explanation: 'Azithromycin can cause QT prolongation, increasing risk of torsades de pointes, especially in patients with cardiac risk factors.'
    },
    {
      drug: ANTIBIOTICS[7], // Vancomycin
      question: 'What are the major toxicities of Vancomycin?',
      choices: [
        'Hepatotoxicity and pancreatitis',
        'Nephrotoxicity and ototoxicity',
        'Bone marrow suppression',
        'Peripheral neuropathy'
      ],
      correctIndex: 1,
      explanation: 'Vancomycin\'s major toxicities include nephrotoxicity and ototoxicity. "Red man syndrome" from rapid infusion is also notable.'
    },
    {
      drug: ANTIBIOTICS[9], // Ciprofloxacin
      question: 'What is a serious adverse effect of Fluoroquinolones like Ciprofloxacin?',
      choices: [
        'Tendon rupture',
        'Aplastic anemia',
        'Stevens-Johnson syndrome',
        'Hemorrhagic cystitis'
      ],
      correctIndex: 0,
      explanation: 'Fluoroquinolones carry a black box warning for tendon rupture, particularly the Achilles tendon. Risk increases with age >60 and concurrent steroid use.'
    }
  ];
  
  const selected = sideEffects[Math.floor(Math.random() * sideEffects.length)];
  
  return {
    id: `drill-side-${Date.now()}`,
    type: 'side_effects',
    drug: selected.drug,
    sideEffectQuestion: selected.question,
    sideEffectChoices: selected.choices,
    correctSideEffectIndex: selected.correctIndex,
    explanation: selected.explanation
  };
}

function generateEmpiricChoiceDrill(): AntibioticDrillQuestion {
  const scenarios = [
    {
      scenario: 'A 45-year-old presents with acute cystitis. Urine culture pending. What is the first-line empiric treatment?',
      choices: [
        'Ciprofloxacin',
        'Nitrofurantoin or TMP-SMX',
        'Amoxicillin',
        'Vancomycin'
      ],
      correctIndex: 1,
      explanation: 'For uncomplicated UTI, first-line empiric therapy is Nitrofurantoin or TMP-SMX. Fluoroquinolones are reserved for complicated cases.'
    },
    {
      scenario: 'A patient with suspected community-acquired pneumonia and risk factors for MRSA needs admission. What empiric coverage?',
      choices: [
        'Ceftriaxone + Azithromycin only',
        'Vancomycin + Piperacillin-Tazobactam',
        'Ceftriaxone + Azithromycin + Vancomycin',
        'Azithromycin alone'
      ],
      correctIndex: 2,
      explanation: 'CAP with MRSA risk requires typical coverage (Ceftriaxone + Azithromycin) plus MRSA coverage (Vancomycin). Alternative: Linezolid instead of Vancomycin.'
    },
    {
      scenario: 'A patient with hospital-acquired pneumonia and risk for Pseudomonas needs empiric therapy. What do you choose?',
      choices: [
        'Ceftriaxone + Azithromycin',
        'Vancomycin + Cefepime or Piperacillin-Tazobactam',
        'Amoxicillin-Clavulanate',
        'Meropenem alone'
      ],
      correctIndex: 1,
      explanation: 'HAP with Pseudomonas risk requires anti-pseudomonal beta-lactam (Cefepime, Pip-Tazo, or Meropenem) plus MRSA coverage (Vancomycin or Linezolid).'
    }
  ];
  
  const selected = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  return {
    id: `drill-emp-${Date.now()}`,
    type: 'empiric_choice',
    clinicalScenario: selected.scenario,
    empiricChoices: selected.choices,
    correctEmpiricIndex: selected.correctIndex,
    explanation: selected.explanation
  };
}
