/**
 * PANCE Entry Gap Analysis
 *
 * Analyzes each medical content table against PANCE blueprint requirements
 * to identify MISSING ENTRIES (rows) - not just missing fields.
 *
 * This helps ensure comprehensive coverage of PANCE exam content.
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// PANCE Blueprint Categories with percentages
const PANCE_BLUEPRINT = {
  Cardiovascular: 16,
  Pulmonary: 12,
  Gastrointestinal: 10,
  Musculoskeletal: 10,
  'Infectious Disease': 9,
  Endocrine: 9,
  EENT: 9,
  Reproductive: 8,
  Neurologic: 6,
  Psychiatry: 6,
  'Renal/Genitourinary': 6,
  Dermatology: 5,
  Hematology: 5,
};

// ==================== LABTEST ANALYSIS ====================
async function analyzeLabTestGaps() {
  console.log('\n📊 Analyzing LabTest entries...');

  const existingTests = await prisma.labTest.findMany({
    select: { name: true, category: true },
  });

  const existingNames = new Set(existingTests.map((t) => t.name.toLowerCase()));

  // Essential PANCE lab tests by category
  const essentialLabTests = {
    Hematology: [
      'CBC with differential',
      'Hemoglobin A1c',
      'Reticulocyte count',
      'Iron studies',
      'Ferritin',
      'TIBC',
      'Vitamin B12',
      'Folate',
      'Peripheral blood smear',
      'Coombs test (direct)',
      'Coombs test (indirect)',
      'Haptoglobin',
      'LDH',
      'Sickle cell screen',
      'G6PD',
      'Hemoglobin electrophoresis',
    ],
    Coagulation: [
      'PT/INR',
      'PTT',
      'Fibrinogen',
      'D-dimer',
      'Factor V Leiden',
      'Protein C',
      'Protein S',
      'Antithrombin III',
      'Lupus anticoagulant',
      'Anti-cardiolipin antibodies',
      'Mixing study',
      'Thrombin time',
      'Bleeding time',
    ],
    Chemistry: [
      'BMP',
      'CMP',
      'Glucose (fasting)',
      'Glucose (random)',
      'Creatinine',
      'BUN',
      'eGFR',
      'Sodium',
      'Potassium',
      'Chloride',
      'Bicarbonate',
      'Calcium (total)',
      'Calcium (ionized)',
      'Magnesium',
      'Phosphorus',
      'Uric acid',
      'Albumin',
      'Total protein',
      'Anion gap',
      'Osmolality (serum)',
      'Osmolality (urine)',
      'Lactate',
      'Ammonia',
    ],
    Liver: [
      'AST',
      'ALT',
      'ALP',
      'GGT',
      'Total bilirubin',
      'Direct bilirubin',
      'Indirect bilirubin',
      'Hepatitis A antibody',
      'Hepatitis B surface antigen',
      'Hepatitis B surface antibody',
      'Hepatitis B core antibody',
      'Hepatitis C antibody',
      'Hepatitis B DNA',
      'Hepatitis C RNA',
      'Ceruloplasmin',
      'Alpha-1 antitrypsin',
      'Anti-smooth muscle antibody',
      'Anti-mitochondrial antibody',
    ],
    Cardiac: [
      'Troponin I',
      'Troponin T',
      'BNP',
      'NT-proBNP',
      'CK-MB',
      'Myoglobin',
      'Lipid panel',
      'Total cholesterol',
      'LDL',
      'HDL',
      'Triglycerides',
      'Lipoprotein(a)',
      'Apolipoprotein B',
      'hs-CRP',
    ],
    Thyroid: [
      'TSH',
      'Free T4',
      'Free T3',
      'Total T4',
      'Total T3',
      'Thyroid peroxidase antibody',
      'Thyroglobulin antibody',
      'TSH receptor antibody',
      'Thyroglobulin',
      'Reverse T3',
      'T3 resin uptake',
    ],
    Endocrine: [
      'Cortisol (morning)',
      'Cortisol (evening)',
      'ACTH',
      '24-hour urine cortisol',
      'Dexamethasone suppression test',
      'DHEA-S',
      'Aldosterone',
      'Renin',
      'PTH',
      'Vitamin D 25-OH',
      'Vitamin D 1,25-OH',
      'IGF-1',
      'Growth hormone',
      'Prolactin',
      'FSH',
      'LH',
      'Estradiol',
      'Testosterone (total)',
      'Testosterone (free)',
      'SHBG',
      'Insulin',
      'C-peptide',
      'Glucagon',
    ],
    'Tumor Markers': [
      'PSA',
      'CA-125',
      'CA 19-9',
      'CEA',
      'AFP',
      'Beta-hCG',
      'LDH (tumor marker)',
      'Calcitonin',
      'Chromogranin A',
      'NSE',
      'CYFRA 21-1',
    ],
    Autoimmune: [
      'ANA',
      'Anti-dsDNA',
      'Anti-Smith',
      'Anti-Ro (SSA)',
      'Anti-La (SSB)',
      'Anti-centromere',
      'Anti-Scl-70',
      'Anti-Jo-1',
      'Rheumatoid factor',
      'Anti-CCP',
      'C3',
      'C4',
      'ESR',
      'CRP',
      'Anti-histone antibody',
      'cANCA',
      'pANCA',
      'Anti-GBM',
      'HLA-B27',
    ],
    Urinalysis: [
      'Urinalysis (complete)',
      'Urine specific gravity',
      'Urine pH',
      'Urine protein',
      'Urine glucose',
      'Urine ketones',
      'Urine blood',
      'Urine leukocyte esterase',
      'Urine nitrites',
      'Urine bilirubin',
      'Urine urobilinogen',
      'Urine microscopy',
      'Urine protein/creatinine ratio',
      'Urine albumin/creatinine ratio',
      '24-hour urine protein',
      'Urine osmolality',
      'Urine sodium',
      'Urine creatinine',
      'FENa',
    ],
    Infectious: [
      'Blood culture',
      'Urine culture',
      'Wound culture',
      'Sputum culture',
      'CSF culture',
      'Gram stain',
      'AFB smear',
      'AFB culture',
      'Fungal culture',
      'HIV antibody/antigen',
      'HIV viral load',
      'CD4 count',
      'RPR',
      'VDRL',
      'FTA-ABS',
      'Monospot',
      'EBV panel',
      'CMV IgG/IgM',
      'Lyme antibody',
      'Lyme Western blot',
      'Procalcitonin',
      'Strep screen',
    ],
    'ABG/Pulmonary': [
      'ABG',
      'Arterial pH',
      'PaCO2',
      'PaO2',
      'HCO3',
      'Base excess',
      'A-a gradient',
      'Oxygen saturation',
      'VBG',
    ],
    CSF: [
      'CSF analysis',
      'CSF glucose',
      'CSF protein',
      'CSF cell count',
      'CSF Gram stain',
      'CSF culture',
      'Opening pressure',
      'CSF oligoclonal bands',
      'CSF cytology',
      'CSF VDRL',
      'CSF cryptococcal antigen',
    ],
    Other: [
      'Serum osmolality',
      'Serum ketones',
      'Beta-hydroxybutyrate',
      'Serum lipase',
      'Serum amylase',
      'Fecal occult blood',
      'Fecal calprotectin',
      'Stool culture',
      'C. diff toxin',
      'Ova and parasites',
      'H. pylori testing',
      'Lead level',
      'Carboxyhemoglobin',
      'Methemoglobin',
      'Ethanol level',
      'Acetaminophen level',
      'Salicylate level',
      'Digoxin level',
      'Lithium level',
      'Vancomycin level',
      'Aminoglycoside level',
      'Phenytoin level',
      'Valproic acid level',
      'Theophylline level',
      'Drug screen (urine)',
      'Pregnancy test (urine/serum)',
    ],
  };

  const missing: string[] = [];

  for (const [category, tests] of Object.entries(essentialLabTests)) {
    for (const test of tests) {
      const testLower = test.toLowerCase();
      const found = [...existingNames].some(
        (name) =>
          name.includes(testLower) ||
          testLower.includes(name) ||
          name.replace(/[^a-z0-9]/g, '') === testLower.replace(/[^a-z0-9]/g, '')
      );
      if (!found) {
        missing.push(`${test} (${category})`);
      }
    }
  }

  console.log(`  Existing: ${existingTests.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing tests:');
    missing.slice(0, 30).forEach((t) => console.log(`    - ${t}`));
    if (missing.length > 30) console.log(`    ... and ${missing.length - 30} more`);
  }

  return { table: 'LabTest', existing: existingTests.length, missing };
}

// ==================== DRUG ANALYSIS ====================
async function analyzeDrugGaps() {
  console.log('\n💊 Analyzing Drug entries...');

  const existingDrugs = await prisma.drug.findMany({
    select: { genericName: true, aliases: true, drugClass: true },
  });

  const existingNames = new Set(existingDrugs.map((d) => d.genericName.toLowerCase()));
  existingDrugs.forEach((d) => d.aliases?.forEach((a) => existingNames.add(a.toLowerCase())));

  // Check a subset of high-yield drugs
  const essentialDrugs = [
    // Cardiovascular
    'lisinopril',
    'enalapril',
    'losartan',
    'valsartan',
    'amlodipine',
    'metoprolol',
    'carvedilol',
    'atenolol',
    'furosemide',
    'spironolactone',
    'digoxin',
    'warfarin',
    'apixaban',
    'rivaroxaban',
    'clopidogrel',
    'ticagrelor',
    'atorvastatin',
    'rosuvastatin',
    'nitroglycerin',
    'isosorbide',
    'hydralazine',
    'amiodarone',
    'diltiazem',
    'verapamil',
    'sacubitril-valsartan',
    'empagliflozin',
    // Pulmonary
    'albuterol',
    'ipratropium',
    'tiotropium',
    'fluticasone',
    'budesonide',
    'salmeterol',
    'formoterol',
    'montelukast',
    'prednisone',
    'theophylline',
    // GI
    'omeprazole',
    'pantoprazole',
    'famotidine',
    'metoclopramide',
    'ondansetron',
    'mesalamine',
    'sulfasalazine',
    'lactulose',
    'polyethylene glycol',
    'loperamide',
    // Endocrine
    'metformin',
    'glipizide',
    'sitagliptin',
    'liraglutide',
    'semaglutide',
    'insulin lispro',
    'insulin glargine',
    'levothyroxine',
    'methimazole',
    // Neurologic
    'levetiracetam',
    'phenytoin',
    'carbamazepine',
    'valproic acid',
    'gabapentin',
    'sumatriptan',
    'carbidopa-levodopa',
    'pramipexole',
    'donepezil',
    'memantine',
    // Psychiatry
    'sertraline',
    'fluoxetine',
    'escitalopram',
    'venlafaxine',
    'duloxetine',
    'bupropion',
    'lithium',
    'quetiapine',
    'risperidone',
    'aripiprazole',
    'methylphenidate',
    'alprazolam',
    'lorazepam',
    'buspirone',
    'trazodone',
    // Antibiotics
    'amoxicillin',
    'amoxicillin-clavulanate',
    'azithromycin',
    'doxycycline',
    'cephalexin',
    'ceftriaxone',
    'ciprofloxacin',
    'levofloxacin',
    'metronidazole',
    'trimethoprim-sulfamethoxazole',
    'nitrofurantoin',
    'vancomycin',
    'clindamycin',
    // Pain/MSK
    'ibuprofen',
    'naproxen',
    'celecoxib',
    'acetaminophen',
    'tramadol',
    'morphine',
    'hydrocodone',
    'oxycodone',
    'fentanyl',
    'colchicine',
    'allopurinol',
    'methotrexate',
    'hydroxychloroquine',
    'prednisone',
  ];

  const missing: string[] = [];
  for (const drug of essentialDrugs) {
    const found = [...existingNames].some(
      (name) => name.includes(drug.toLowerCase()) || drug.toLowerCase().includes(name)
    );
    if (!found) missing.push(drug);
  }

  console.log(`  Existing: ${existingDrugs.length}`);
  console.log(`  High-yield drugs missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing drugs:', missing.join(', '));
  }

  return { table: 'Drug', existing: existingDrugs.length, missing };
}

// ==================== PHYSICAL EXAM FINDINGS ====================
async function analyzePhysicalExamGaps() {
  console.log('\n🩺 Analyzing PhysicalExamFinding entries...');

  const existing = await prisma.physicalExamFinding.findMany({
    select: { name: true, aliases: true, system: true },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  existing.forEach((e) => e.aliases?.forEach((a) => existingNames.add(a.toLowerCase())));

  const essentialFindings = {
    Cardiovascular: [
      'S3 gallop',
      'S4 gallop',
      'Systolic murmur',
      'Diastolic murmur',
      'Pericardial friction rub',
      'JVD',
      'Pitting edema',
      'Hepatojugular reflux',
      'Carotid bruit',
      'Peripheral pulse deficit',
      'Capillary refill',
      'Splinter hemorrhages',
      'Janeway lesions',
      'Osler nodes',
      'Pulsus paradoxus',
      'Pulsus alternans',
      'Korotkoff sounds',
      'Kussmaul sign',
      'Beck triad',
    ],
    Pulmonary: [
      'Wheezes',
      'Rhonchi',
      'Crackles',
      'Stridor',
      'Decreased breath sounds',
      'Bronchial breath sounds',
      'Egophony',
      'Whispered pectoriloquy',
      'Tactile fremitus',
      'Dullness to percussion',
      'Hyperresonance',
      'Tracheal deviation',
      'Accessory muscle use',
      'Tripod positioning',
      'Barrel chest',
      'Clubbing',
    ],
    Abdominal: [
      'Hepatomegaly',
      'Splenomegaly',
      'Ascites',
      'Shifting dullness',
      'Fluid wave',
      'Murphy sign',
      'McBurney point tenderness',
      'Rovsing sign',
      'Psoas sign',
      'Obturator sign',
      'Rebound tenderness',
      'Guarding',
      'Rigidity',
      'Bowel sounds (hyperactive)',
      'Bowel sounds (absent)',
      'Cullen sign',
      'Grey Turner sign',
      'Caput medusae',
      'Spider angiomas',
    ],
    Neurologic: [
      'Babinski sign',
      'Hoffmann sign',
      'Clonus',
      'Hyperreflexia',
      'Hyporeflexia',
      'Romberg sign',
      'Pronator drift',
      'Finger-to-nose ataxia',
      'Heel-to-shin ataxia',
      'Dysdiadochokinesia',
      'Nystagmus',
      'Pupillary light reflex',
      'PERRLA',
      'Kernig sign',
      'Brudzinski sign',
      'Nuchal rigidity',
      'Battle sign',
      'Raccoon eyes',
      'Papilledema',
      'Facial droop',
      'Tongue deviation',
      'Uvula deviation',
    ],
    Musculoskeletal: [
      'Joint effusion',
      'Joint warmth',
      'Crepitus',
      'Range of motion limitation',
      'Muscle atrophy',
      'Muscle hypertrophy',
      'Trigger points',
      'Bone tenderness',
      'Heberden nodes',
      'Bouchard nodes',
      'Swan neck deformity',
      'Boutonniere deformity',
      'Ulnar deviation',
      'Kyphosis',
      'Scoliosis',
      'Lordosis',
      'Genu valgum',
      'Genu varum',
    ],
    Dermatologic: [
      'Macular rash',
      'Papular rash',
      'Vesicular rash',
      'Bullous lesions',
      'Petechiae',
      'Purpura',
      'Ecchymosis',
      'Erythema',
      'Pallor',
      'Cyanosis',
      'Jaundice',
      'Koilonychia',
      'Terry nails',
      'Beau lines',
      'Alopecia',
      'Hyperpigmentation',
      'Hypopigmentation',
      'Livedo reticularis',
      'Target lesions',
      'Nikolsky sign',
    ],
    HEENT: [
      'Lymphadenopathy',
      'Thyromegaly',
      'Thyroid nodule',
      'Exophthalmos',
      'Lid lag',
      'Papilledema',
      'Cotton wool spots',
      'Flame hemorrhages',
      'AV nicking',
      'Tympanic membrane perforation',
      'Bulging tympanic membrane',
      'Light reflex',
      'Tonsillar exudate',
      'Cobblestoning',
      'Nasal polyps',
      'Septal deviation',
    ],
  };

  const missing: string[] = [];
  for (const [system, findings] of Object.entries(essentialFindings)) {
    for (const finding of findings) {
      const findingLower = finding.toLowerCase();
      const found = [...existingNames].some(
        (name) => name.includes(findingLower) || findingLower.includes(name)
      );
      if (!found) missing.push(`${finding} (${system})`);
    }
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing findings:');
    missing.slice(0, 20).forEach((f) => console.log(`    - ${f}`));
    if (missing.length > 20) console.log(`    ... and ${missing.length - 20} more`);
  }

  return { table: 'PhysicalExamFinding', existing: existing.length, missing };
}

// ==================== SPECIAL TEST ANALYSIS ====================
async function analyzeSpecialTestGaps() {
  console.log('\n🧪 Analyzing SpecialTest entries...');

  const existing = await prisma.specialTest.findMany({
    select: { name: true, aliases: true, region: true },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  existing.forEach((e) => e.aliases?.forEach((a) => existingNames.add(a.toLowerCase())));

  const essentialTests = {
    Shoulder: [
      'Hawkins-Kennedy test',
      'Neer impingement test',
      'Empty can test',
      'Drop arm test',
      'Speed test',
      'Yergason test',
      'Apprehension test',
      'Relocation test',
      "O'Brien test",
      'Cross-body adduction test',
      'Lift-off test',
      'Belly press test',
    ],
    Elbow: [
      'Cozen test',
      'Mill test',
      'Valgus stress test',
      'Varus stress test',
      'Tinel sign at elbow',
      'Elbow flexion test',
    ],
    'Wrist/Hand': [
      'Phalen test',
      'Reverse Phalen test',
      'Tinel sign at wrist',
      'Finkelstein test',
      'Allen test',
      'Watson test',
      'Froment sign',
      'Thumb grind test',
    ],
    Hip: [
      'FABER test',
      'FADIR test',
      'Thomas test',
      'Ober test',
      'Trendelenburg test',
      'Piriformis test',
      'Log roll test',
      'Anvil test',
      'Ely test',
    ],
    Knee: [
      'Anterior drawer test',
      'Posterior drawer test',
      'Lachman test',
      'Pivot shift test',
      'McMurray test',
      'Apley compression test',
      'Apley distraction test',
      'Valgus stress test knee',
      'Varus stress test knee',
      'Patellar apprehension test',
      'Patellar grind test',
      'J sign',
      'Thessaly test',
      'Noble compression test',
    ],
    'Ankle/Foot': [
      'Anterior drawer test ankle',
      'Talar tilt test',
      'Thompson test',
      'Squeeze test',
      'Mulder sign',
      'Tinel sign at ankle',
      'Windlass test',
      'Silfverskiold test',
    ],
    Spine: [
      'Straight leg raise',
      'Crossed straight leg raise',
      'Slump test',
      'Femoral nerve stretch',
      'Spurling test',
      'Distraction test',
      'Compression test',
      'Valsalva test',
      'FABER for SI joint',
      'Gaenslen test',
      'Patrick test',
      'Sacroiliac compression',
      'Schober test',
      'Adam forward bend test',
    ],
    Neurologic: [
      'Romberg test',
      'Tandem gait',
      'Finger-to-nose test',
      'Heel-to-shin test',
      'Rapid alternating movements',
      'Pronator drift test',
      'Coordination tests',
    ],
  };

  const missing: string[] = [];
  for (const [region, tests] of Object.entries(essentialTests)) {
    for (const test of tests) {
      const testLower = test.toLowerCase();
      const found = [...existingNames].some(
        (name) => name.includes(testLower) || testLower.includes(name)
      );
      if (!found) missing.push(`${test} (${region})`);
    }
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing tests:');
    missing.slice(0, 15).forEach((t) => console.log(`    - ${t}`));
    if (missing.length > 15) console.log(`    ... and ${missing.length - 15} more`);
  }

  return { table: 'SpecialTest', existing: existing.length, missing };
}

// ==================== IMAGING STUDY ANALYSIS ====================
async function analyzeImagingGaps() {
  console.log('\n📷 Analyzing ImagingStudy entries...');

  const existing = await prisma.imagingStudy.findMany({
    select: { name: true, modality: true },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

  const essentialImaging = [
    // X-ray
    'Chest X-ray',
    'Abdominal X-ray',
    'KUB',
    'Cervical spine X-ray',
    'Lumbar spine X-ray',
    'Hand X-ray',
    'Foot X-ray',
    'Shoulder X-ray',
    'Knee X-ray',
    'Hip X-ray',
    // CT
    'CT Head',
    'CT Chest',
    'CT Abdomen/Pelvis',
    'CT Angiography',
    'CT Pulmonary Angiogram',
    'CT Coronary Angiogram',
    'CT Spine',
    'CT Enterography',
    'High-resolution CT chest',
    // MRI
    'MRI Brain',
    'MRI Spine',
    'MRI Knee',
    'MRI Shoulder',
    'MRI Pelvis',
    'MRA',
    'MRCP',
    'Cardiac MRI',
    // Ultrasound
    'Abdominal ultrasound',
    'Pelvic ultrasound',
    'Transvaginal ultrasound',
    'Renal ultrasound',
    'Thyroid ultrasound',
    'Carotid ultrasound',
    'Echocardiogram',
    'FAST exam',
    'Lower extremity venous duplex',
    'Testicular ultrasound',
    // Nuclear
    'V/Q scan',
    'Bone scan',
    'PET scan',
    'Thyroid uptake scan',
    'HIDA scan',
    'MUGA scan',
    'Stress test (nuclear)',
    // Other
    'Fluoroscopy',
    'Mammogram',
    'DEXA scan',
    'Angiography',
    'Venography',
  ];

  const missing: string[] = [];
  for (const study of essentialImaging) {
    const studyLower = study.toLowerCase();
    const found = [...existingNames].some(
      (name) => name.includes(studyLower) || studyLower.includes(name)
    );
    if (!found) missing.push(study);
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing studies:', missing.join(', '));
  }

  return { table: 'ImagingStudy', existing: existing.length, missing };
}

// ==================== PROCEDURE ANALYSIS ====================
async function analyzeProcedureGaps() {
  console.log('\n🔧 Analyzing Procedure entries...');

  const existing = await prisma.procedure.findMany({
    select: { name: true, aliases: true, category: true },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  existing.forEach((e) => e.aliases?.forEach((a) => existingNames.add(a.toLowerCase())));

  const essentialProcedures = [
    // Emergency
    'CPR',
    'BLS',
    'ACLS',
    'Defibrillation',
    'Cardioversion',
    'Intubation',
    'Bag-valve mask ventilation',
    'Chest compressions',
    'Heimlich maneuver',
    // Airway
    'Endotracheal intubation',
    'Nasopharyngeal airway',
    'Oropharyngeal airway',
    'Laryngeal mask airway',
    'Cricothyrotomy',
    'Tracheostomy',
    // Vascular access
    'Peripheral IV',
    'Central line placement',
    'Arterial line',
    'IO access',
    'PICC line',
    'Midline catheter',
    'Phlebotomy',
    // Cardiac
    'Pericardiocentesis',
    'Temporary pacing',
    'Synchronized cardioversion',
    // Pulmonary
    'Thoracentesis',
    'Chest tube placement',
    'Needle decompression',
    'Pulmonary function test',
    'Peak flow measurement',
    // GI
    'Nasogastric tube placement',
    'Paracentesis',
    'Abdominal tap',
    'Digital rectal exam',
    'Fecal disimpaction',
    'Anoscopy',
    // GU
    'Foley catheter placement',
    'Suprapubic catheter',
    'Bladder scan',
    // Orthopedic
    'Splinting',
    'Casting',
    'Joint aspiration',
    'Joint injection',
    'Closed reduction',
    'Dislocation reduction',
    'Trigger point injection',
    // Wound care
    'Wound closure (sutures)',
    'Wound closure (staples)',
    'Wound irrigation',
    'Debridement',
    'Abscess I&D',
    'Foreign body removal',
    // Other
    'Lumbar puncture',
    'Arthrocentesis',
    'Skin biopsy',
    'Punch biopsy',
    'Shave biopsy',
    'Excisional biopsy',
    'Nail removal',
    'Cryotherapy',
    'Electrocautery',
    'Laceration repair',
    'Epistaxis management',
    'Ear lavage',
    'Foreign body removal (ear/nose)',
    'Eye irrigation',
  ];

  const missing: string[] = [];
  for (const proc of essentialProcedures) {
    const procLower = proc.toLowerCase();
    const found = [...existingNames].some(
      (name) => name.includes(procLower) || procLower.includes(name)
    );
    if (!found) missing.push(proc);
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing procedures:');
    missing.slice(0, 20).forEach((p) => console.log(`    - ${p}`));
    if (missing.length > 20) console.log(`    ... and ${missing.length - 20} more`);
  }

  return { table: 'Procedure', existing: existing.length, missing };
}

// ==================== ECG PATTERN ANALYSIS ====================
async function analyzeECGPatternGaps() {
  console.log('\n💓 Analyzing ECGPattern entries...');

  const existing = await prisma.eCGPattern.findMany({
    select: { name: true, aliases: true, category: true },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  existing.forEach((e) => e.aliases?.forEach((a) => existingNames.add(a.toLowerCase())));

  const essentialECGPatterns = [
    // Arrhythmias
    'Sinus rhythm',
    'Sinus bradycardia',
    'Sinus tachycardia',
    'Sinus arrhythmia',
    'Atrial fibrillation',
    'Atrial flutter',
    'SVT',
    'AVNRT',
    'AVRT',
    'WPW',
    'Ventricular tachycardia',
    'Ventricular fibrillation',
    'Torsades de pointes',
    'PVCs',
    'PACs',
    'Multifocal atrial tachycardia',
    'Wandering atrial pacemaker',
    'Junctional rhythm',
    'Accelerated junctional rhythm',
    'Idioventricular rhythm',
    // Blocks
    'First degree AV block',
    'Second degree AV block Type I',
    'Second degree AV block Type II',
    'Third degree AV block',
    'RBBB',
    'LBBB',
    'Left anterior fascicular block',
    'Left posterior fascicular block',
    'Bifascicular block',
    'Trifascicular block',
    // Ischemia/Infarction
    'ST elevation (STEMI)',
    'ST depression',
    'T wave inversion',
    'Q waves',
    'Anterior MI',
    'Inferior MI',
    'Lateral MI',
    'Posterior MI',
    'Right ventricular MI',
    'Wellens syndrome',
    'de Winter T waves',
    'Sgarbossa criteria',
    // Hypertrophy
    'LVH',
    'RVH',
    'Left atrial enlargement',
    'Right atrial enlargement',
    // Electrolyte abnormalities
    'Hyperkalemia',
    'Hypokalemia',
    'Hypercalcemia',
    'Hypocalcemia',
    'Hypomagnesemia',
    'Digoxin toxicity',
    'Digoxin effect',
    // Other
    'Pericarditis',
    'Pericardial effusion',
    'Brugada syndrome',
    'Long QT syndrome',
    'Short QT syndrome',
    'Early repolarization',
    'J wave (Osborn wave)',
    'Pulmonary embolism',
    'Right heart strain',
    'Delta wave',
    'Epsilon wave',
    'U wave',
    'Pacemaker rhythm',
    'Electrical alternans',
  ];

  const missing: string[] = [];
  for (const pattern of essentialECGPatterns) {
    const patternLower = pattern.toLowerCase();
    const found = [...existingNames].some(
      (name) => name.includes(patternLower) || patternLower.includes(name)
    );
    if (!found) missing.push(pattern);
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing patterns:');
    missing.slice(0, 20).forEach((p) => console.log(`    - ${p}`));
    if (missing.length > 20) console.log(`    ... and ${missing.length - 20} more`);
  }

  return { table: 'ECGPattern', existing: existing.length, missing };
}

// ==================== SCORING SYSTEM ANALYSIS ====================
async function analyzeScoringSystemGaps() {
  console.log('\n📊 Analyzing ScoringSystem entries...');

  const existing = await prisma.scoringSystem.findMany({
    select: { name: true, aliases: true },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  existing.forEach((e) => e.aliases?.forEach((a) => existingNames.add(a.toLowerCase())));

  const essentialScoringSystems = [
    // Cardiovascular
    'CHADS2-VASc',
    'HAS-BLED',
    'HEART score',
    'TIMI score',
    'Wells criteria DVT',
    'Wells criteria PE',
    'Geneva score',
    'Framingham Risk Score',
    'ASCVD risk calculator',
    // Neurologic
    'Glasgow Coma Scale',
    'NIH Stroke Scale',
    'Hunt and Hess',
    'Fisher grade',
    'ABCD2 score',
    'Cincinnati Stroke Scale',
    // Respiratory
    'CURB-65',
    'PSI (Pneumonia Severity Index)',
    'APACHE II',
    'SOFA score',
    'qSOFA',
    'Berlin criteria (ARDS)',
    'Light criteria (pleural effusion)',
    // GI/Hepatic
    'Child-Pugh score',
    'MELD score',
    'Ranson criteria',
    'Glasgow-Imrie criteria',
    'Rockall score',
    'Glasgow-Blatchford score',
    'Alvarado score (appendicitis)',
    // Orthopedic
    'Ottawa Ankle Rules',
    'Ottawa Knee Rules',
    'Pittsburgh Knee Rules',
    'Canadian C-spine Rules',
    'NEXUS criteria',
    // Psychiatric
    'PHQ-9',
    'GAD-7',
    'CAGE questionnaire',
    'AUDIT-C',
    'Columbia Suicide Severity Rating',
    'Edinburgh Postnatal Depression Scale',
    'Mini-Mental State Exam (MMSE)',
    'Montreal Cognitive Assessment (MoCA)',
    // Other
    'APGAR score',
    'Bishop score',
    'Centor criteria',
    'McIsaac score',
    'PECARN head injury',
    'Killip classification',
    'NYHA classification',
    'CHA2DS2-VASc',
    'Caprini score',
    'Padua score',
    'Geneva DVT score',
  ];

  const missing: string[] = [];
  for (const system of essentialScoringSystems) {
    const systemLower = system.toLowerCase();
    const found = [...existingNames].some(
      (name) => name.includes(systemLower) || systemLower.includes(name)
    );
    if (!found) missing.push(system);
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing scoring systems:');
    missing.forEach((s) => console.log(`    - ${s}`));
  }

  return { table: 'ScoringSystem', existing: existing.length, missing };
}

// ==================== PHYSIOLOGY CONCEPT ANALYSIS ====================
async function analyzePhysiologyConceptGaps() {
  console.log('\n🧬 Analyzing PhysiologyConcept entries...');

  const existing = await prisma.physiologyConcept.findMany({
    select: { name: true, aliases: true, system: true },
  });

  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
  existing.forEach((e) => e.aliases?.forEach((a) => existingNames.add(a.toLowerCase())));

  const essentialConcepts = {
    Cardiovascular: [
      'Cardiac cycle',
      'Cardiac output',
      'Stroke volume',
      'Preload',
      'Afterload',
      'Frank-Starling mechanism',
      'Ejection fraction',
      'Blood pressure regulation',
      'Baroreceptor reflex',
      'Renin-angiotensin-aldosterone system',
      'Starling forces',
      'Cardiac action potential',
      'Automaticity',
      'Coronary circulation',
    ],
    Pulmonary: [
      'Ventilation',
      'Perfusion',
      'V/Q ratio',
      'Gas exchange',
      'Oxygen-hemoglobin dissociation',
      'Bohr effect',
      'Haldane effect',
      'Lung compliance',
      'Surfactant',
      'Dead space',
      'Respiratory drive',
      'Hypoxic pulmonary vasoconstriction',
    ],
    Renal: [
      'Glomerular filtration',
      'GFR',
      'Tubular reabsorption',
      'Tubular secretion',
      'Countercurrent mechanism',
      'ADH',
      'Aldosterone',
      'Renin',
      'Acid-base regulation',
      'Potassium homeostasis',
      'Sodium balance',
      'Water balance',
    ],
    Endocrine: [
      'Hypothalamic-pituitary axis',
      'Thyroid hormone regulation',
      'Cortisol regulation',
      'Insulin secretion',
      'Glucagon',
      'Calcium homeostasis',
      'PTH',
      'Vitamin D metabolism',
      'Growth hormone',
      'Prolactin',
      'Adrenal hormones',
    ],
    GI: [
      'Gastric acid secretion',
      'Bile production',
      'Pancreatic enzymes',
      'Intestinal absorption',
      'Hepatic first-pass metabolism',
      'Enterohepatic circulation',
      'GI motility',
      'Peristalsis',
    ],
    Neurologic: [
      'Action potential',
      'Synaptic transmission',
      'Neurotransmitters',
      'Blood-brain barrier',
      'CSF circulation',
      'Cerebral blood flow',
      'Intracranial pressure',
      'Pain pathways',
      'Motor pathways',
      'Sensory pathways',
      'Autonomic nervous system',
    ],
    Hematology: [
      'Hemostasis',
      'Coagulation cascade',
      'Platelet function',
      'Fibrinolysis',
      'Hematopoiesis',
      'Erythropoiesis',
      'Iron metabolism',
      'Oxygen transport',
    ],
  };

  const missing: string[] = [];
  for (const [system, concepts] of Object.entries(essentialConcepts)) {
    for (const concept of concepts) {
      const conceptLower = concept.toLowerCase();
      const found = [...existingNames].some(
        (name) => name.includes(conceptLower) || conceptLower.includes(name)
      );
      if (!found) missing.push(`${concept} (${system})`);
    }
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing concepts:');
    missing.slice(0, 20).forEach((c) => console.log(`    - ${c}`));
    if (missing.length > 20) console.log(`    ... and ${missing.length - 20} more`);
  }

  return { table: 'PhysiologyConcept', existing: existing.length, missing };
}

// ==================== DIFFERENTIAL DIAGNOSIS ANALYSIS ====================
async function analyzeDifferentialDiagnosisGaps() {
  console.log('\n🔍 Analyzing DifferentialDiagnosis entries...');

  const existing = await prisma.differentialDiagnosis.findMany({
    select: { presentingComplaint: true, category: true },
  });

  const existingNames = new Set(existing.map((e) => e.presentingComplaint.toLowerCase()));

  const essentialDifferentials = [
    // Presenting symptoms
    'Chest pain',
    'Dyspnea',
    'Abdominal pain',
    'Headache',
    'Dizziness',
    'Syncope',
    'Palpitations',
    'Cough',
    'Hemoptysis',
    'Back pain',
    'Joint pain',
    'Fatigue',
    'Weight loss',
    'Fever',
    'Edema',
    'Altered mental status',
    'Seizure',
    'Weakness',
    'Numbness',
    'Vision changes',
    // Emergency differentials
    'Acute coronary syndrome',
    'Pulmonary embolism',
    'Aortic dissection',
    'Tension pneumothorax',
    'Cardiac tamponade',
    'Ectopic pregnancy',
    'Meningitis',
    'Stroke',
    'Status epilepticus',
    'DKA',
    'Sepsis',
    // Common conditions
    'GERD vs PUD',
    'UTI vs pyelonephritis',
    'Cellulitis vs DVT',
    'Asthma vs COPD',
    'Heart failure exacerbation',
  ];

  const missing: string[] = [];
  for (const dx of essentialDifferentials) {
    const dxLower = dx.toLowerCase();
    const found = [...existingNames].some(
      (name) => name.includes(dxLower) || dxLower.includes(name)
    );
    if (!found) missing.push(dx);
  }

  console.log(`  Existing: ${existing.length}`);
  console.log(`  Potentially Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing differentials:', missing.slice(0, 15).join(', '));
  }

  return { table: 'DifferentialDiagnosis', existing: existing.length, missing };
}

// ==================== MAIN ANALYSIS ====================
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          PANCE ENTRY GAP ANALYSIS - Missing Rows Check           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const results: Array<{ table: string; existing: number; missing: string[] }> = [];

  try {
    results.push(await analyzeLabTestGaps());
    results.push(await analyzeDrugGaps());
    results.push(await analyzePhysicalExamGaps());
    results.push(await analyzeSpecialTestGaps());
    results.push(await analyzeImagingGaps());
    results.push(await analyzeProcedureGaps());
    results.push(await analyzeECGPatternGaps());
    results.push(await analyzeScoringSystemGaps());
    results.push(await analyzePhysiologyConceptGaps());
    results.push(await analyzeDifferentialDiagnosisGaps());

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                         SUMMARY                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    let totalExisting = 0;
    let totalMissing = 0;

    for (const result of results) {
      const missingCount = result.missing.length;
      totalExisting += result.existing;
      totalMissing += missingCount;
      const status = missingCount === 0 ? '✅' : missingCount < 10 ? '🟡' : '🔴';
      console.log(
        `${status} ${result.table.padEnd(25)} Existing: ${result.existing.toString().padStart(4)}  Missing: ${missingCount.toString().padStart(3)}`
      );
    }

    console.log('─'.repeat(70));
    console.log(`📊 Total entries across tables: ${totalExisting}`);
    console.log(`🔍 Total potential gaps: ${totalMissing}`);

    // Write missing entries to file for reference
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = `/tmp/pance-entry-gaps-${timestamp}.json`;
    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Full results saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
