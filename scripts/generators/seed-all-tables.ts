/**
 * Seed All Tables - Initial population of new tables with 10 examples each
 * Run this FIRST to validate schema before bulk generation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============= PROCEDURES (10 High-Yield) =============
const PROCEDURES = [
  {
    name: 'Lumbar Puncture',
    category: 'Diagnostic',
    system: 'NEURO',
    panceYield: 3,
    isHighYield: true,
    indications: ['Suspected meningitis', 'SAH workup', 'Pseudotumor cerebri'],
    absoluteContraindications: ['Increased ICP with mass effect', 'Skin infection at site'],
    technique: 'Patient in lateral decubitus or seated position. Identify L3-L4 or L4-L5 interspace. Use aseptic technique. Advance needle with stylet until CSF return.',
    complications: ['Post-LP headache', 'Infection', 'Bleeding', 'Herniation'],
    clinicalPearls: ['Opening pressure normal: 10-20 cmH2O', 'Send tube 1 for cell count, tube 4 for cell count to differentiate traumatic tap'],
  },
  {
    name: 'Paracentesis',
    category: 'Diagnostic',
    system: 'GI',
    panceYield: 3,
    isHighYield: true,
    indications: ['New ascites', 'Suspected SBP', 'Tense ascites causing respiratory distress'],
    absoluteContraindications: ['DIC', 'Fibrinolysis'],
    technique: 'Left or right lower quadrant, lateral to rectus. Use Z-track technique. Aspirate fluid.',
    complications: ['Bleeding', 'Bowel perforation', 'Infection'],
    clinicalPearls: ['SAAG >1.1 = portal hypertension', 'PMN >250 = SBP, treat empirically'],
  },
  {
    name: 'Thoracentesis',
    category: 'Diagnostic',
    system: 'PULM',
    panceYield: 3,
    isHighYield: true,
    indications: ['Pleural effusion workup', 'Symptomatic relief'],
    absoluteContraindications: ['Uncooperative patient', 'Skin infection at site'],
    technique: 'Sitting position, leaning forward. Insert needle above rib to avoid neurovascular bundle. Aspirate fluid.',
    complications: ['Pneumothorax', 'Bleeding', 'Re-expansion pulmonary edema'],
    clinicalPearls: ['Light criteria: Exudate if protein >0.5, LDH >0.6, or LDH >2/3 upper limit'],
  },
  {
    name: 'Central Line Placement',
    category: 'Therapeutic',
    system: 'CV',
    panceYield: 2,
    isHighYield: true,
    indications: ['Vasopressor administration', 'TPN', 'Poor peripheral access'],
    absoluteContraindications: ['Infection at insertion site'],
    technique: 'Sterile technique. Use ultrasound guidance. Seldinger technique with guidewire.',
    complications: ['Pneumothorax', 'Arterial puncture', 'CLABSI', 'Air embolism'],
    clinicalPearls: ['IJ preferred for emergent access', 'Confirm placement with CXR'],
  },
  {
    name: 'Incision and Drainage',
    category: 'Therapeutic',
    system: 'DERM',
    panceYield: 3,
    isHighYield: true,
    indications: ['Fluctuant abscess'],
    absoluteContraindications: ['Cellulitis without abscess (relative)'],
    technique: 'Local anesthesia. Linear incision over fluctuant area. Break up loculations. Pack wound.',
    complications: ['Bleeding', 'Incomplete drainage', 'Recurrence'],
    clinicalPearls: ['Antibiotics alone insufficient for abscess', 'Pack loosely, remove in 24-48h'],
  },
  {
    name: 'Joint Aspiration',
    category: 'Diagnostic',
    system: 'MSK',
    panceYield: 3,
    isHighYield: true,
    indications: ['Suspected septic arthritis', 'Crystal arthropathy', 'Effusion'],
    absoluteContraindications: ['Bacteremia (relative)', 'Skin infection overlying joint'],
    technique: 'Sterile technique. Approach varies by joint. Aspirate synovial fluid.',
    complications: ['Infection', 'Bleeding'],
    clinicalPearls: ['WBC >50,000 with >75% PMNs = septic until proven otherwise', 'Negatively birefringent = gout'],
  },
  {
    name: 'Endotracheal Intubation',
    category: 'Therapeutic',
    system: 'PULM',
    panceYield: 3,
    isHighYield: true,
    indications: ['Airway protection', 'Respiratory failure', 'Anticipated deterioration'],
    absoluteContraindications: ['Complete upper airway obstruction (surgical airway needed)'],
    technique: 'Pre-oxygenate. RSI with induction + paralytic. Direct or video laryngoscopy. Confirm with ETCO2.',
    complications: ['Esophageal intubation', 'Dental trauma', 'Aspiration'],
    clinicalPearls: ['ETCO2 is gold standard for confirmation', 'Tube at 21-23cm at teeth for adults'],
  },
  {
    name: 'Chest Tube Insertion',
    category: 'Therapeutic',
    system: 'PULM',
    panceYield: 2,
    isHighYield: true,
    indications: ['Pneumothorax', 'Hemothorax', 'Empyema'],
    absoluteContraindications: ['None absolute in emergency'],
    technique: '4th-5th intercostal space, anterior axillary line. Blunt dissection above rib. Insert tube posteriorly and superiorly.',
    complications: ['Lung laceration', 'Bleeding', 'Infection', 'Tube malposition'],
    clinicalPearls: ['Triangle of safety: lat border pec major, ant border lat dorsi, line of nipple'],
  },
  {
    name: 'Cardioversion',
    category: 'Therapeutic',
    system: 'CV',
    panceYield: 3,
    isHighYield: true,
    indications: ['Unstable tachyarrhythmia', 'Elective for AFib/Flutter'],
    absoluteContraindications: ['Digitalis toxicity (relative)'],
    technique: 'Synchronized shock. Start 100-200J biphasic for AFib, 50-100J for flutter.',
    complications: ['Skin burns', 'Arrhythmia', 'Thromboembolism'],
    clinicalPearls: ['Sync mode for organized rhythms', 'Anticoagulate 3+ weeks or TEE before elective'],
  },
  {
    name: 'Foley Catheter Insertion',
    category: 'Therapeutic',
    system: 'GU',
    panceYield: 2,
    isHighYield: true,
    indications: ['Urinary retention', 'Accurate I/O monitoring', 'Surgery'],
    absoluteContraindications: ['Suspected urethral injury (blood at meatus)'],
    technique: 'Sterile technique. Lubricate catheter. Insert until urine return, advance 2 more inches, inflate balloon.',
    complications: ['UTI', 'Urethral trauma', 'False passage'],
    clinicalPearls: ['CAUTI prevention: Remove ASAP', 'If resistance, do NOT force - urology consult'],
  },
];

// ============= VITAL SIGN RANGES =============
const VITAL_SIGNS = [
  { vitalSign: 'Heart Rate', category: 'Cardiovascular', units: 'bpm', normalRange: '60-100' },
  { vitalSign: 'Blood Pressure', category: 'Cardiovascular', units: 'mmHg', normalRange: '<120/80' },
  { vitalSign: 'Respiratory Rate', category: 'Respiratory', units: 'breaths/min', normalRange: '12-20' },
  { vitalSign: 'Temperature', category: 'Metabolic', units: '°F', normalRange: '97.8-99.1' },
  { vitalSign: 'Oxygen Saturation', category: 'Respiratory', units: '%', normalRange: '95-100' },
];

// ============= HISTORY COMPONENTS =============
const HISTORY_COMPONENTS = [
  {
    name: 'OLDCARTS',
    category: 'HPI',
    frameworkName: 'OLDCARTS',
    description: 'Mnemonic for characterizing chief complaint',
    elements: ['Onset', 'Location', 'Duration', 'Character', 'Aggravating factors', 'Relieving factors', 'Timing', 'Severity'],
    panceYield: 3,
    isHighYield: true,
  },
  {
    name: 'Chest Pain History',
    category: 'HPI',
    system: 'CV',
    requiredFor: ['Chest Pain', 'ACS', 'Angina'],
    elements: ['Onset', 'Quality (pressure, sharp, tearing)', 'Radiation', 'Associated symptoms', 'Exertional', 'Duration', 'Similar episodes'],
    panceYield: 3,
    isHighYield: true,
    clinicalPearls: ['Tearing pain radiating to back = think aortic dissection', 'Pressure with radiation to jaw/arm = think ACS'],
  },
];

async function seedAllTables() {
  console.log('=== Seeding All Tables ===\n');

  // Procedures
  console.log('Seeding Procedures...');
  for (const proc of PROCEDURES) {
    try {
      await prisma.procedure.upsert({
        where: { name: proc.name },
        update: proc,
        create: {
          ...proc,
          id: crypto.randomUUID(),
          updatedAt: new Date(),
        },
      });
      console.log(`  ✓ ${proc.name}`);
    } catch (e) {
      console.log(`  ✗ ${proc.name}: ${e}`);
    }
  }

  // Vital Signs
  console.log('\nSeeding Vital Sign Ranges...');
  for (const vital of VITAL_SIGNS) {
    try {
      await prisma.vitalSignRange.upsert({
        where: { vitalSign: vital.vitalSign },
        update: vital,
        create: {
          ...vital,
          id: crypto.randomUUID(),
          updatedAt: new Date(),
        },
      });
      console.log(`  ✓ ${vital.vitalSign}`);
    } catch (e) {
      console.log(`  ✗ ${vital.vitalSign}: ${e}`);
    }
  }

  // History Components
  console.log('\nSeeding History Components...');
  for (const hist of HISTORY_COMPONENTS) {
    try {
      await prisma.historyComponent.upsert({
        where: { name: hist.name },
        update: hist,
        create: {
          ...hist,
          id: crypto.randomUUID(),
          updatedAt: new Date(),
        },
      });
      console.log(`  ✓ ${hist.name}`);
    } catch (e) {
      console.log(`  ✗ ${hist.name}: ${e}`);
    }
  }

  console.log('\n=== Seeding Complete ===');
  await prisma.$disconnect();
}

seedAllTables();
