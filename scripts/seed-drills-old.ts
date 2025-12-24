#!/usr/bin/env ts-node
/**
 * Seed Drill Questions
 * 
 * Populates the database with questions for:
 * - Ventilator Management drill
 * - Physiology Review drill  
 * - Anatomy Review drill
 * 
 * Run: npx ts-node scripts/seed-drills.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// VENTILATOR MANAGEMENT SCENARIOS
// ============================================================================

const VENTILATOR_SCENARIOS = [
  {
    vignette: '65yo M, Day 2 of ARDS from COVID-19 pneumonia. Indication: Acute hypoxemic respiratory failure. Physical exam: Bilateral crackles, tachypneic, accessory muscle use.',
    question: JSON.stringify({
      currentSettings: {
        mode: 'AC',
        tidalVolume: 400,
        respiratoryRate: 16,
        peep: 5,
        fio2: 60,
      },
      abg: {
        pH: 7.38,
        paCO2: 42,
        paO2: 55,
        hco3: 24,
        sao2: 88,
      },
      prompt: 'What is the most appropriate ventilator adjustment?',
    }),
    options: JSON.stringify([
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
    ]),
    correctAnswer: 'Increase PEEP',
    explanation: 'Low PaO2 (55) despite FiO2 60% indicates refractory hypoxemia. Increasing PEEP improves oxygenation by recruiting alveoli and maintaining them open, characteristic need in ARDS.',
    system: 'PULM',
    difficulty: 'medium',
    source: 'manual',
    tags: JSON.stringify(['ventilator', 'ARDS', 'hypoxemia', 'PEEP']),
  },
  {
    category: 'ventilator',
    subcategory: 'hypercapnia',
    question: JSON.stringify({
      patientInfo: '58yo F with COPD exacerbation, intubated for respiratory fatigue',
      indication: 'Hypercapnic respiratory failure',
      currentSettings: {
        mode: 'SIMV',
        tidalVolume: 350,
        respiratoryRate: 10,
        peep: 5,
        fio2: 35,
      },
      abg: {
        pH: 7.25,
        paCO2: 65,
        paO2: 75,
        hco3: 28,
        sao2: 94,
      },
      physicalExam: 'Wheezing bilaterally, prolonged expiratory phase',
      actions: [
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
      ],
    }),
    correctAnswer: 'Increase respiratory rate',
    explanation: 'Respiratory acidosis (pH 7.25, pCO2 65) indicates inadequate minute ventilation. Increasing respiratory rate will increase CO2 elimination. Avoid increasing TV in COPD to prevent barotrauma.',
    difficulty: 'medium',
    tags: ['ventilator', 'COPD', 'hypercapnia', 'minute ventilation'],
  },
  {
    category: 'ventilator',
    subcategory: 'alkalosis',
    question: JSON.stringify({
      patientInfo: '42yo M, Day 3 post-op abdominal surgery',
      indication: 'Post-operative mechanical ventilation',
      currentSettings: {
        mode: 'AC',
        tidalVolume: 500,
        respiratoryRate: 18,
        peep: 5,
        fio2: 40,
      },
      abg: {
        pH: 7.52,
        paCO2: 28,
        paO2: 110,
        hco3: 23,
        sao2: 99,
      },
      physicalExam: 'Clear lung fields, comfortable on ventilator',
      actions: [
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
      ],
    }),
    correctAnswer: 'Decrease respiratory rate',
    explanation: 'Respiratory alkalosis (pH 7.52, pCO2 28) from over-ventilation. Decrease respiratory rate to allow CO2 to normalize. Patient is well-oxygenated.',
    difficulty: 'easy',
    tags: ['ventilator', 'alkalosis', 'over-ventilation'],
  },
  {
    category: 'ventilator',
    subcategory: 'weaning',
    question: JSON.stringify({
      patientInfo: '55yo F, Day 5 of pneumonia, improving clinically',
      indication: 'Community-acquired pneumonia',
      currentSettings: {
        mode: 'SIMV',
        tidalVolume: 400,
        respiratoryRate: 8,
        peep: 5,
        fio2: 35,
        pressureSupport: 10,
      },
      abg: {
        pH: 7.42,
        paCO2: 38,
        paO2: 95,
        hco3: 24,
        sao2: 97,
      },
      physicalExam: 'Improved breath sounds, minimal crackles, awake and following commands',
      actions: [
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
      ],
    }),
    correctAnswer: 'Initiate weaning',
    explanation: 'Excellent ABG on minimal support (FiO2 35%, low SIMV rate with PS). Patient meets weaning criteria: adequate oxygenation, normal pH/pCO2, awake and cooperative. Consider spontaneous breathing trial.',
    difficulty: 'easy',
    tags: ['ventilator', 'weaning', 'SBT', 'extubation readiness'],
  },
  {
    category: 'ventilator',
    subcategory: 'volutrauma',
    question: JSON.stringify({
      patientInfo: '70yo M with ARDS, plateau pressure 32 cmH2O',
      indication: 'Acute respiratory distress syndrome',
      currentSettings: {
        mode: 'AC',
        tidalVolume: 600,
        respiratoryRate: 14,
        peep: 10,
        fio2: 70,
      },
      abg: {
        pH: 7.36,
        paCO2: 45,
        paO2: 70,
        hco3: 25,
        sao2: 92,
      },
      physicalExam: 'Bilateral infiltrates, high airway pressures',
      actions: [
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
      ],
    }),
    correctAnswer: 'Decrease tidal volume',
    explanation: 'Tidal volume of 600mL is too high for ARDS (not lung-protective). Target 4-6 mL/kg IBW (~400mL for average patient). High plateau pressure confirms volutrauma risk. Accept permissive hypercapnia.',
    difficulty: 'hard',
    tags: ['ventilator', 'ARDS', 'volutrauma', 'lung-protective ventilation'],
  },
  {
    category: 'ventilator',
    subcategory: 'hypoxemia',
    question: JSON.stringify({
      patientInfo: '48yo F with pulmonary embolism, hypotensive',
      indication: 'Hypoxemic respiratory failure',
      currentSettings: {
        mode: 'AC',
        tidalVolume: 450,
        respiratoryRate: 16,
        peep: 5,
        fio2: 40,
      },
      abg: {
        pH: 7.40,
        paCO2: 38,
        paO2: 58,
        hco3: 23,
        sao2: 89,
      },
      physicalExam: 'Tachycardic, clear lung sounds, JVD present',
      actions: [
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
      ],
    }),
    correctAnswer: 'Increase FiO2',
    explanation: 'PaO2 of 58 is critically low. First step is to increase FiO2 to improve oxygen delivery. PEEP could worsen hemodynamics in PE with RV strain.',
    difficulty: 'hard',
    tags: ['ventilator', 'pulmonary embolism', 'hypoxemia', 'RV strain'],
  },
  {
    category: 'ventilator',
    subcategory: 'barotrauma',
    question: JSON.stringify({
      patientInfo: '62yo M with emphysema, developing subcutaneous emphysema',
      indication: 'COPD exacerbation',
      currentSettings: {
        mode: 'SIMV',
        tidalVolume: 400,
        respiratoryRate: 14,
        peep: 12,
        fio2: 35,
      },
      abg: {
        pH: 7.38,
        paCO2: 52,
        paO2: 72,
        hco3: 30,
        sao2: 94,
      },
      physicalExam: 'Crepitus in neck, decreased breath sounds, hyperinflated',
      actions: [
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
      ],
    }),
    correctAnswer: 'Decrease PEEP',
    explanation: 'High PEEP (12) in COPD with auto-PEEP and air trapping causes barotrauma (subcutaneous emphysema). Reduce PEEP to 5 cmH2O. Oxygenation is adequate.',
    difficulty: 'medium',
    tags: ['ventilator', 'COPD', 'barotrauma', 'auto-PEEP'],
  },
  {
    category: 'ventilator',
    subcategory: 'pressure_support',
    question: JSON.stringify({
      patientInfo: '51yo F on PS mode, increasing work of breathing',
      indication: 'Weaning trial',
      currentSettings: {
        mode: 'PS',
        peep: 5,
        fio2: 40,
        pressureSupport: 5,
      },
      abg: {
        pH: 7.34,
        paCO2: 48,
        paO2: 80,
        hco3: 25,
        sao2: 95,
      },
      physicalExam: 'Tachypneic (RR 28), accessory muscle use, diaphoretic',
      actions: [
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
      ],
    }),
    correctAnswer: 'Increase pressure support',
    explanation: 'Low PS (5 cmH2O) causing respiratory distress and mild hypercapnia. Increase PS to 8-10 to reduce work of breathing while maintaining spontaneous breathing.',
    difficulty: 'medium',
    tags: ['ventilator', 'pressure support', 'weaning failure', 'work of breathing'],
  },
];

// ============================================================================
// PHYSIOLOGY QUESTIONS
// ============================================================================

const PHYSIOLOGY_QUESTIONS = [
  {
    category: 'physiology',
    subcategory: 'cardiovascular',
    question: 'What is the primary determinant of myocardial oxygen consumption?',
    options: JSON.stringify(['Heart rate', 'Stroke volume', 'Contractility × Heart rate', 'Preload']),
    correctAnswer: 'Contractility × Heart rate',
    explanation: 'MVO2 is primarily determined by contractility and heart rate (tension-time index). Wall stress and contractility are the major factors.',
    difficulty: 'medium',
    tags: ['physiology', 'cardiovascular', 'myocardial oxygen consumption'],
  },
  {
    category: 'physiology',
    subcategory: 'respiratory',
    question: 'What is the most important stimulus for ventilation under normal conditions?',
    options: JSON.stringify(['PaO2', 'PaCO2', 'pH', 'Serum bicarbonate']),
    correctAnswer: 'PaCO2',
    explanation: 'Central chemoreceptors in the medulla respond to changes in CSF pH driven by PaCO2. This is the primary ventilatory drive in healthy individuals. Hypoxic drive (PaO2) is secondary.',
    difficulty: 'easy',
    tags: ['physiology', 'respiratory', 'ventilatory drive', 'chemoreceptors'],
  },
  {
    category: 'physiology',
    subcategory: 'renal',
    question: 'Where does the majority of sodium reabsorption occur in the nephron?',
    options: JSON.stringify(['Proximal convoluted tubule', 'Loop of Henle', 'Distal convoluted tubule', 'Collecting duct']),
    correctAnswer: 'Proximal convoluted tubule',
    explanation: 'The PCT reabsorbs approximately 65-70% of filtered sodium via Na+/K+-ATPase and co-transporters. This is the site of bulk reabsorption.',
    difficulty: 'easy',
    tags: ['physiology', 'renal', 'sodium reabsorption', 'PCT'],
  },
  {
    category: 'physiology',
    subcategory: 'endocrine',
    question: 'Which hormone is the primary regulator of calcium homeostasis?',
    options: JSON.stringify(['Calcitonin', 'Parathyroid hormone', 'Vitamin D', '1,25-dihydroxyvitamin D']),
    correctAnswer: 'Parathyroid hormone',
    explanation: 'PTH is the primary regulator, responding within minutes to hypocalcemia. It increases bone resorption, renal calcium reabsorption, and activates vitamin D.',
    difficulty: 'easy',
    tags: ['physiology', 'endocrine', 'calcium', 'PTH'],
  },
  {
    category: 'physiology',
    subcategory: 'neurological',
    question: 'What ion is primarily responsible for the rapid depolarization phase of the cardiac action potential?',
    options: JSON.stringify(['Sodium', 'Potassium', 'Calcium', 'Chloride']),
    correctAnswer: 'Sodium',
    explanation: 'Phase 0 of the cardiac action potential (rapid depolarization) is caused by rapid sodium influx through voltage-gated Na+ channels. This is true for atrial, ventricular, and Purkinje cells.',
    difficulty: 'medium',
    tags: ['physiology', 'cardiovascular', 'action potential', 'sodium channels'],
  },
];

// ============================================================================
// ANATOMY QUESTIONS
// ============================================================================

const ANATOMY_QUESTIONS = [
  {
    category: 'anatomy',
    subcategory: 'upper_extremity',
    question: 'A patient presents with wrist drop and inability to extend the fingers. Which nerve is most likely injured?',
    options: JSON.stringify(['Median nerve', 'Ulnar nerve', 'Radial nerve', 'Musculocutaneous nerve']),
    correctAnswer: 'Radial nerve',
    explanation: 'The radial nerve innervates the wrist and finger extensors (extensor carpi radialis, extensor digitorum). Injury causes wrist drop and loss of finger extension. Commonly injured in mid-shaft humeral fractures.',
    difficulty: 'easy',
    tags: ['anatomy', 'upper extremity', 'radial nerve', 'wrist drop'],
  },
  {
    category: 'anatomy',
    subcategory: 'head_neck',
    question: 'The middle meningeal artery passes through which foramen?',
    options: JSON.stringify(['Foramen ovale', 'Foramen spinosum', 'Foramen rotundum', 'Foramen lacerum']),
    correctAnswer: 'Foramen spinosum',
    explanation: 'The middle meningeal artery (branch of maxillary artery) enters the skull through the foramen spinosum. Trauma can cause epidural hematoma (lens-shaped) between skull and dura.',
    difficulty: 'medium',
    tags: ['anatomy', 'head and neck', 'middle meningeal artery', 'epidural hematoma'],
  },
  {
    category: 'anatomy',
    subcategory: 'abdomen',
    question: 'At what vertebral level does the abdominal aorta bifurcate into the common iliac arteries?',
    options: JSON.stringify(['L2', 'L3', 'L4', 'L5']),
    correctAnswer: 'L4',
    explanation: 'The aortic bifurcation occurs at the L4 vertebral level (at the umbilicus). This is a common site for atherosclerotic disease (Leriche syndrome: claudication, impotence, absent femoral pulses).',
    difficulty: 'medium',
    tags: ['anatomy', 'abdomen', 'aortic bifurcation', 'L4'],
  },
  {
    category: 'anatomy',
    subcategory: 'thorax',
    question: 'Which structure passes through the aortic hiatus of the diaphragm?',
    options: JSON.stringify(['Aorta only', 'Aorta and azygos vein', 'Aorta and thoracic duct', 'Aorta, azygos vein, and thoracic duct']),
    correctAnswer: 'Aorta, azygos vein, and thoracic duct',
    explanation: 'The aortic hiatus (T12) transmits the aorta, azygos vein, and thoracic duct. It is a posterior opening in the diaphragm (not susceptible to hernias unlike esophageal hiatus).',
    difficulty: 'hard',
    tags: ['anatomy', 'thorax', 'diaphragm', 'aortic hiatus'],
  },
  {
    category: 'anatomy',
    subcategory: 'lower_extremity',
    question: 'Which nerve is at risk during a posterior hip dislocation?',
    options: JSON.stringify(['Femoral nerve', 'Obturator nerve', 'Sciatic nerve', 'Superior gluteal nerve']),
    correctAnswer: 'Sciatic nerve',
    explanation: 'The sciatic nerve exits the pelvis through the greater sciatic foramen inferior to piriformis. Posterior hip dislocations (dashboard injury) stretch/compress the nerve, causing foot drop and sensory loss.',
    difficulty: 'medium',
    tags: ['anatomy', 'lower extremity', 'sciatic nerve', 'hip dislocation'],
  },
];

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 Starting drill questions seeding...\n');

  let ventCount = 0;
  let physCount = 0;
  let anatCount = 0;

  try {
    // Seed Ventilator scenarios
    console.log('📊 Seeding Ventilator Management scenarios...');
    for (const scenario of VENTILATOR_SCENARIOS) {
      await prisma.question.upsert({
        where: {
          category_subcategory_question: {
            category: scenario.category,
            subcategory: scenario.subcategory || '',
            question: scenario.question,
          },
        },
        update: {
          correctAnswer: scenario.correctAnswer,
          explanation: scenario.explanation,
          difficulty: scenario.difficulty,
          tags: scenario.tags,
        },
        create: scenario,
      });
      ventCount++;
    }
    console.log(`  ✓ Seeded ${ventCount} ventilator scenarios\n`);

    // Seed Physiology questions
    console.log('🧬 Seeding Physiology Review questions...');
    for (const question of PHYSIOLOGY_QUESTIONS) {
      await prisma.question.upsert({
        where: {
          category_subcategory_question: {
            category: question.category,
            subcategory: question.subcategory || '',
            question: question.question,
          },
        },
        update: {
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
          tags: question.tags,
        },
        create: question,
      });
      physCount++;
    }
    console.log(`  ✓ Seeded ${physCount} physiology questions\n`);

    // Seed Anatomy questions
    console.log('🦴 Seeding Anatomy Review questions...');
    for (const question of ANATOMY_QUESTIONS) {
      await prisma.question.upsert({
        where: {
          category_subcategory_question: {
            category: question.category,
            subcategory: question.subcategory || '',
            question: question.question,
          },
        },
        update: {
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
          tags: question.tags,
        },
        create: question,
      });
      anatCount++;
    }
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
