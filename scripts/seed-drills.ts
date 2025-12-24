#!/usr/bin/env ts-node
/**
 * Seed Drill Questions
 * 
 * Populates the Question table with drill content for:
 * - Ventilator Management drill (system: PULM, tags: ventilator)
 * - Physiology Review drill (system: OTHER, tags: physiology)
 * - Anatomy Review drill (system: OTHER, tags: anatomy)
 * 
 * Run: npx ts-node scripts/seed-drills.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to create ventilator question
function createVentQuestion(data: {
  vignette: string;
  settings: any;
  abg: any;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  tags: string[];
}) {
  return {
    vignette: data.vignette,
    question: JSON.stringify({
      currentSettings: data.settings,
      abg: data.abg,
      prompt: 'What is the most appropriate ventilator adjustment?',
    }),
    options: JSON.stringify(data.options),
    correctAnswer: data.correctAnswer,
    explanation: data.explanation,
    system: 'PULM',
    difficulty: data.difficulty,
    source: 'manual' as const,
    tags: JSON.stringify(data.tags),
  };
}

// Standard action options for ventilator questions
const VENT_ACTIONS = [
  'Increase tidal volume',
  'Decrease tidal volume',
  'Increase respiratory rate',
  'Decrease respiratory rate',
  'Increase PEEP',
  'Decrease PEEP',
  'Increase FiO2',
  'Decrease FiO2',
  'Increase pressure support',
  'Initiate weaning',
  'No change needed',
];

async function seedVentilatorQuestions() {
  const questions = [
    createVentQuestion({
      vignette: '65yo M, Day 2 of ARDS from COVID-19 pneumonia. Acute hypoxemic respiratory failure. Physical exam: Bilateral crackles, tachypneic, accessory muscle use.',
      settings: { mode: 'AC', tidalVolume: 400, respiratoryRate: 16, peep: 5, fio2: 60 },
      abg: { pH: 7.38, paCO2: 42, paO2: 55, hco3: 24, sao2: 88 },
      options: VENT_ACTIONS,
      correctAnswer: 'Increase PEEP',
      explanation: 'Low PaO2 (55) despite FiO2 60% indicates refractory hypoxemia. Increasing PEEP improves oxygenation by recruiting alveoli and maintaining them open, characteristic need in ARDS.',
      difficulty: 'medium',
      tags: ['ventilator', 'ARDS', 'hypoxemia', 'PEEP'],
    }),
    createVentQuestion({
      vignette: '58yo F with COPD exacerbation, intubated for respiratory fatigue. Hypercapnic respiratory failure. Physical exam: Wheezing bilaterally, prolonged expiratory phase.',
      settings: { mode: 'SIMV', tidalVolume: 350, respiratoryRate: 10, peep: 5, fio2: 35 },
      abg: { pH: 7.25, paCO2: 65, paO2: 75, hco3: 28, sao2: 94 },
      options: VENT_ACTIONS,
      correctAnswer: 'Increase respiratory rate',
      explanation: 'Respiratory acidosis (pH 7.25, pCO2 65) indicates inadequate minute ventilation. Increasing respiratory rate will increase CO2 elimination. Avoid increasing TV in COPD to prevent barotrauma.',
      difficulty: 'medium',
      tags: ['ventilator', 'COPD', 'hypercapnia', 'minute ventilation'],
    }),
    createVentQuestion({
      vignette: '42yo M, Day 3 post-op abdominal surgery. Post-operative mechanical ventilation. Physical exam: Clear lung fields, comfortable on ventilator.',
      settings: { mode: 'AC', tidalVolume: 500, respiratoryRate: 18, peep: 5, fio2: 40 },
      abg: { pH: 7.52, paCO2: 28, paO2: 110, hco3: 23, sao2: 99 },
      options: VENT_ACTIONS,
      correctAnswer: 'Decrease respiratory rate',
      explanation: 'Respiratory alkalosis (pH 7.52, pCO2 28) from over-ventilation. Decrease respiratory rate to allow CO2 to normalize. Patient is well-oxygenated.',
      difficulty: 'easy',
      tags: ['ventilator', 'alkalosis', 'over-ventilation'],
    }),
    createVentQuestion({
      vignette: '55yo F, Day 5 of pneumonia, improving clinically. Community-acquired pneumonia. Physical exam: Improved breath sounds, minimal crackles, awake and following commands.',
      settings: { mode: 'SIMV', tidalVolume: 400, respiratoryRate: 8, peep: 5, fio2: 35, pressureSupport: 10 },
      abg: { pH: 7.42, paCO2: 38, paO2: 95, hco3: 24, sao2: 97 },
      options: VENT_ACTIONS,
      correctAnswer: 'Initiate weaning',
      explanation: 'Excellent ABG on minimal support (FiO2 35%, low SIMV rate with PS). Patient meets weaning criteria: adequate oxygenation, normal pH/pCO2, awake and cooperative. Consider spontaneous breathing trial.',
      difficulty: 'easy',
      tags: ['ventilator', 'weaning', 'SBT', 'extubation readiness'],
    }),
    createVentQuestion({
      vignette: '70yo M with ARDS, plateau pressure 32 cmH2O. Acute respiratory distress syndrome. Physical exam: Bilateral infiltrates, high airway pressures.',
      settings: { mode: 'AC', tidalVolume: 600, respiratoryRate: 14, peep: 10, fio2: 70 },
      abg: { pH: 7.36, paCO2: 45, paO2: 70, hco3: 25, sao2: 92 },
      options: VENT_ACTIONS,
      correctAnswer: 'Decrease tidal volume',
      explanation: 'Tidal volume of 600mL is too high for ARDS (not lung-protective). Target 4-6 mL/kg IBW (~400mL for average patient). High plateau pressure confirms volutrauma risk. Accept permissive hypercapnia.',
      difficulty: 'hard',
      tags: ['ventilator', 'ARDS', 'volutrauma', 'lung-protective ventilation'],
    }),
    createVentQuestion({
      vignette: '48yo F with pulmonary embolism, hypotensive. Hypoxemic respiratory failure. Physical exam: Tachycardic, clear lung sounds, JVD present.',
      settings: { mode: 'AC', tidalVolume: 450, respiratoryRate: 16, peep: 5, fio2: 40 },
      abg: { pH: 7.40, paCO2: 38, paO2: 58, hco3: 23, sao2: 89 },
      options: VENT_ACTIONS,
      correctAnswer: 'Increase FiO2',
      explanation: 'PaO2 of 58 is critically low. First step is to increase FiO2 to improve oxygen delivery. PEEP could worsen hemodynamics in PE with RV strain.',
      difficulty: 'hard',
      tags: ['ventilator', 'pulmonary embolism', 'hypoxemia', 'RV strain'],
    }),
    createVentQuestion({
      vignette: '62yo M with emphysema, developing subcutaneous emphysema. COPD exacerbation. Physical exam: Crepitus in neck, decreased breath sounds, hyperinflated.',
      settings: { mode: 'SIMV', tidalVolume: 400, respiratoryRate: 14, peep: 12, fio2: 35 },
      abg: { pH: 7.38, paCO2: 52, paO2: 72, hco3: 30, sao2: 94 },
      options: VENT_ACTIONS,
      correctAnswer: 'Decrease PEEP',
      explanation: 'High PEEP (12) in COPD with auto-PEEP and air trapping causes barotrauma (subcutaneous emphysema). Reduce PEEP to 5 cmH2O. Oxygenation is adequate.',
      difficulty: 'medium',
      tags: ['ventilator', 'COPD', 'barotrauma', 'auto-PEEP'],
    }),
    createVentQuestion({
      vignette: '51yo F on PS mode, increasing work of breathing. Weaning trial. Physical exam: Tachypneic (RR 28), accessory muscle use, diaphoretic.',
      settings: { mode: 'PS', peep: 5, fio2: 40, pressureSupport: 5 },
      abg: { pH: 7.34, paCO2: 48, paO2: 80, hco3: 25, sao2: 95 },
      options: VENT_ACTIONS,
      correctAnswer: 'Increase pressure support',
      explanation: 'Low PS (5 cmH2O) causing respiratory distress and mild hypercapnia. Increase PS to 8-10 to reduce work of breathing while maintaining spontaneous breathing.',
      difficulty: 'medium',
      tags: ['ventilator', 'pressure support', 'weaning failure', 'work of breathing'],
    }),
  ];

  let count = 0;
  for (const q of questions) {
    await prisma.question.create({ data: q });
    count++;
  }
  return count;
}

async function seedPhysiologyQuestions() {
  const questions = [
    {
      vignette: 'Understanding myocardial oxygen consumption is critical for managing cardiac patients.',
      question: 'What is the primary determinant of myocardial oxygen consumption?',
      options: JSON.stringify(['Heart rate', 'Stroke volume', 'Contractility × Heart rate', 'Preload']),
      correctAnswer: 'Contractility × Heart rate',
      explanation: 'MVO2 is primarily determined by contractility and heart rate (tension-time index). Wall stress and contractility are the major factors.',
      system: 'OTHER',
      difficulty: 'medium',
      source: 'manual' as const,
      tags: JSON.stringify(['physiology', 'cardiovascular', 'myocardial oxygen consumption']),
    },
    {
      vignette: 'Control of ventilation involves multiple chemoreceptors and feedback mechanisms.',
      question: 'What is the most important stimulus for ventilation under normal conditions?',
      options: JSON.stringify(['PaO2', 'PaCO2', 'pH', 'Serum bicarbonate']),
      correctAnswer: 'PaCO2',
      explanation: 'Central chemoreceptors in the medulla respond to changes in CSF pH driven by PaCO2. This is the primary ventilatory drive in healthy individuals. Hypoxic drive (PaO2) is secondary.',
      system: 'OTHER',
      difficulty: 'easy',
      source: 'manual' as const,
      tags: JSON.stringify(['physiology', 'respiratory', 'ventilatory drive', 'chemoreceptors']),
    },
    {
      vignette: 'The nephron has distinct segments with specialized reabsorption functions.',
      question: 'Where does the majority of sodium reabsorption occur in the nephron?',
      options: JSON.stringify(['Proximal convoluted tubule', 'Loop of Henle', 'Distal convoluted tubule', 'Collecting duct']),
      correctAnswer: 'Proximal convoluted tubule',
      explanation: 'The PCT reabsorbs approximately 65-70% of filtered sodium via Na+/K+-ATPase and co-transporters. This is the site of bulk reabsorption.',
      system: 'OTHER',
      difficulty: 'easy',
      source: 'manual' as const,
      tags: JSON.stringify(['physiology', 'renal', 'sodium reabsorption', 'PCT']),
    },
    {
      vignette: 'Calcium homeostasis is tightly regulated by multiple hormones.',
      question: 'Which hormone is the primary regulator of calcium homeostasis?',
      options: JSON.stringify(['Calcitonin', 'Parathyroid hormone', 'Vitamin D', '1,25-dihydroxyvitamin D']),
      correctAnswer: 'Parathyroid hormone',
      explanation: 'PTH is the primary regulator, responding within minutes to hypocalcemia. It increases bone resorption, renal calcium reabsorption, and activates vitamin D.',
      system: 'OTHER',
      difficulty: 'easy',
      source: 'manual' as const,
      tags: JSON.stringify(['physiology', 'endocrine', 'calcium', 'PTH']),
    },
    {
      vignette: 'Cardiac action potentials differ from typical neuronal action potentials.',
      question: 'What ion is primarily responsible for the rapid depolarization phase of the cardiac action potential?',
      options: JSON.stringify(['Sodium', 'Potassium', 'Calcium', 'Chloride']),
      correctAnswer: 'Sodium',
      explanation: 'Phase 0 of the cardiac action potential (rapid depolarization) is caused by rapid sodium influx through voltage-gated Na+ channels. This is true for atrial, ventricular, and Purkinje cells.',
      system: 'OTHER',
      difficulty: 'medium',
      source: 'manual' as const,
      tags: JSON.stringify(['physiology', 'cardiovascular', 'action potential', 'sodium channels']),
    },
  ];

  let count = 0;
  for (const q of questions) {
    await prisma.question.create({ data: q });
    count++;
  }
  return count;
}

async function seedAnatomyQuestions() {
  const questions = [
    {
      vignette: 'A patient presents with wrist drop and inability to extend the fingers after a humeral fracture.',
      question: 'Which nerve is most likely injured?',
      options: JSON.stringify(['Median nerve', 'Ulnar nerve', 'Radial nerve', 'Musculocutaneous nerve']),
      correctAnswer: 'Radial nerve',
      explanation: 'The radial nerve innervates the wrist and finger extensors (extensor carpi radialis, extensor digitorum). Injury causes wrist drop and loss of finger extension. Commonly injured in mid-shaft humeral fractures.',
      system: 'OTHER',
      difficulty: 'easy',
      source: 'manual' as const,
      tags: JSON.stringify(['anatomy', 'upper extremity', 'radial nerve', 'wrist drop']),
    },
    {
      vignette: 'Understanding skull foramina is critical for recognizing epidural hematoma patterns.',
      question: 'The middle meningeal artery passes through which foramen?',
      options: JSON.stringify(['Foramen ovale', 'Foramen spinosum', 'Foramen rotundum', 'Foramen lacerum']),
      correctAnswer: 'Foramen spinosum',
      explanation: 'The middle meningeal artery (branch of maxillary artery) enters the skull through the foramen spinosum. Trauma can cause epidural hematoma (lens-shaped) between skull and dura.',
      system: 'OTHER',
      difficulty: 'medium',
      source: 'manual' as const,
      tags: JSON.stringify(['anatomy', 'head and neck', 'middle meningeal artery', 'epidural hematoma']),
    },
    {
      vignette: 'Aortic bifurcation level is important for understanding vascular disease patterns.',
      question: 'At what vertebral level does the abdominal aorta bifurcate into the common iliac arteries?',
      options: JSON.stringify(['L2', 'L3', 'L4', 'L5']),
      correctAnswer: 'L4',
      explanation: 'The aortic bifurcation occurs at the L4 vertebral level (at the umbilicus). This is a common site for atherosclerotic disease (Leriche syndrome: claudication, impotence, absent femoral pulses).',
      system: 'OTHER',
      difficulty: 'medium',
      source: 'manual' as const,
      tags: JSON.stringify(['anatomy', 'abdomen', 'aortic bifurcation', 'L4']),
    },
    {
      vignette: 'The diaphragm has three major openings for structures to pass between thorax and abdomen.',
      question: 'Which structure passes through the aortic hiatus of the diaphragm?',
      options: JSON.stringify(['Aorta only', 'Aorta and azygos vein', 'Aorta and thoracic duct', 'Aorta, azygos vein, and thoracic duct']),
      correctAnswer: 'Aorta, azygos vein, and thoracic duct',
      explanation: 'The aortic hiatus (T12) transmits the aorta, azygos vein, and thoracic duct. It is a posterior opening in the diaphragm (not susceptible to hernias unlike esophageal hiatus).',
      system: 'OTHER',
      difficulty: 'hard',
      source: 'manual' as const,
      tags: JSON.stringify(['anatomy', 'thorax', 'diaphragm', 'aortic hiatus']),
    },
    {
      vignette: 'Posterior hip dislocations are common after dashboard injuries in motor vehicle accidents.',
      question: 'Which nerve is at risk during a posterior hip dislocation?',
      options: JSON.stringify(['Femoral nerve', 'Obturator nerve', 'Sciatic nerve', 'Superior gluteal nerve']),
      correctAnswer: 'Sciatic nerve',
      explanation: 'The sciatic nerve exits the pelvis through the greater sciatic foramen inferior to piriformis. Posterior hip dislocations (dashboard injury) stretch/compress the nerve, causing foot drop and sensory loss.',
      system: 'OTHER',
      difficulty: 'medium',
      source: 'manual' as const,
      tags: JSON.stringify(['anatomy', 'lower extremity', 'sciatic nerve', 'hip dislocation']),
    },
  ];

  let count = 0;
  for (const q of questions) {
    await prisma.question.create({ data: q });
    count++;
  }
  return count;
}

async function main() {
  console.log('🌱 Starting drill questions seeding...\n');

  try {
    console.log('📊 Seeding Ventilator Management questions...');
    const ventCount = await seedVentilatorQuestions();
    console.log(`  ✓ Seeded ${ventCount} ventilator questions\n`);

    console.log('🧬 Seeding Physiology Review questions...');
    const physCount = await seedPhysiologyQuestions();
    console.log(`  ✓ Seeded ${physCount} physiology questions\n`);

    console.log('🦴 Seeding Anatomy Review questions...');
    const anatCount = await seedAnatomyQuestions();
    console.log(`  ✓ Seeded ${anatCount} anatomy questions\n`);

    console.log('✅ Seeding complete!');
    console.log(`   Total: ${ventCount + physCount + anatCount} questions added\n`);
  } catch (error) {
    console.error('❌ Error seeding drill questions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
