/**
 * Code Blue Question Seeding Script
 *
 * Seeds the ACLSQuestion table with ACLS/PALS/BLS rapid-fire questions
 * for the Code Blue Speed Mode.
 *
 * Usage:
 *   npx ts-node scripts/seed-code-blue.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface CodeBlueQuestionSeed {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: 'ACLS' | 'PALS' | 'BLS' | 'Critical Care';
}

const CODE_BLUE_QUESTIONS: CodeBlueQuestionSeed[] = [
  {
    question: 'First medication in cardiac arrest with shockable rhythm?',
    options: ['Amiodarone', 'Epinephrine', 'Atropine', 'Lidocaine'],
    correctIndex: 1,
    explanation:
      'Epinephrine 1mg IV/IO every 3-5 minutes is the first medication in cardiac arrest.',
    category: 'ACLS',
  },
  {
    question: 'Initial joules for adult defibrillation (biphasic)?',
    options: ['50J', '100J', '120-200J', '360J'],
    correctIndex: 2,
    explanation: 'Biphasic defibrillators: 120-200J initially. Monophasic: 360J.',
    category: 'ACLS',
  },
  {
    question: 'Compression-to-ventilation ratio for pediatric 2-rescuer CPR?',
    options: ['30:2', '15:2', '5:1', '3:1'],
    correctIndex: 1,
    explanation: '15:2 for 2-rescuer pediatric CPR. 30:2 for single rescuer.',
    category: 'PALS',
  },
  {
    question: 'Target EtCO2 during CPR?',
    options: ['<10 mmHg', '10-20 mmHg', '35-40 mmHg', '>45 mmHg'],
    correctIndex: 1,
    explanation:
      'EtCO2 >10 mmHg indicates adequate chest compressions. <10 mmHg suggests poor perfusion.',
    category: 'ACLS',
  },
  {
    question: 'Pediatric defibrillation dose (J/kg)?',
    options: ['1 J/kg', '2 J/kg', '4 J/kg', '10 J/kg'],
    correctIndex: 1,
    explanation: 'Initial: 2 J/kg. Subsequent: 4 J/kg (max 10 J/kg or adult dose).',
    category: 'PALS',
  },
  {
    question: 'Amiodarone dose in cardiac arrest?',
    options: ['150mg', '300mg', '500mg', '1g'],
    correctIndex: 1,
    explanation: 'First dose: 300mg IV/IO. Second dose: 150mg IV/IO.',
    category: 'ACLS',
  },
  {
    question: 'Minimum depth for adult chest compressions?',
    options: ['1 inch', '1.5 inches', '2 inches', '3 inches'],
    correctIndex: 2,
    explanation: 'At least 2 inches (5cm), no more than 2.4 inches (6cm).',
    category: 'ACLS',
  },
  {
    question: 'Pediatric epinephrine dose in cardiac arrest?',
    options: ['0.01 mg/kg IV', '0.1 mg/kg IV', '1 mg/kg IV', '0.01 mg/kg ET'],
    correctIndex: 0,
    explanation: '0.01 mg/kg IV/IO (1:10,000). Max single dose: 1mg.',
    category: 'PALS',
  },
  {
    question: 'Rate of chest compressions (all ages)?',
    options: ['60-80/min', '80-100/min', '100-120/min', '120-140/min'],
    correctIndex: 2,
    explanation: '100-120 compressions per minute for all ages.',
    category: 'ACLS',
  },
  {
    question: 'Post-cardiac arrest targeted temperature?',
    options: ['32-34°C', '36°C', '37.5°C', '39°C'],
    correctIndex: 0,
    explanation: 'Targeted temperature management: 32-36°C for at least 24 hours.',
    category: 'Critical Care',
  },
  {
    question: 'Atropine dose for bradycardia?',
    options: ['0.5mg IV', '1mg IV', '3mg IV', '6mg IV'],
    correctIndex: 0,
    explanation: 'Atropine 0.5mg IV bolus, repeat every 3-5 minutes (max 3mg total).',
    category: 'ACLS',
  },
  {
    question: 'Infant CPR compression depth?',
    options: ['1 inch', '1.5 inches', '2 inches', '2.5 inches'],
    correctIndex: 1,
    explanation: 'For infants: 1.5 inches (4cm). For children: 2 inches (5cm).',
    category: 'PALS',
  },
  {
    question: 'Adenosine initial dose for SVT (adult)?',
    options: ['3mg', '6mg', '12mg', '18mg'],
    correctIndex: 1,
    explanation: '6mg rapid IV push, followed by 12mg if no response. Push fast with saline flush.',
    category: 'ACLS',
  },
  {
    question: 'Shock energy for cardioversion of stable VTach?',
    options: ['50J', '100J', '200J', '360J'],
    correctIndex: 1,
    explanation: 'Synchronized cardioversion for stable VTach: 100J initially.',
    category: 'ACLS',
  },
  {
    question: 'Correct hand position for infant CPR (1 rescuer)?',
    options: [
      'One hand on forehead',
      'Two fingers on lower sternum',
      'Heel of one hand',
      'Two hands overlapped',
    ],
    correctIndex: 1,
    explanation:
      'Single rescuer infant CPR: two fingers on lower half of sternum, just below nipple line.',
    category: 'BLS',
  },
  {
    question: 'When to check pulse during CPR?',
    options: ['Every 30 seconds', 'Every minute', 'Every 2 minutes', 'After every shock'],
    correctIndex: 2,
    explanation: 'Check rhythm and pulse every 2 minutes (after 5 cycles of CPR).',
    category: 'ACLS',
  },
  {
    question: 'Calcium chloride indication in cardiac arrest?',
    options: ['Asystole', 'Hyperkalemia', 'VFib', 'PEA with normal K+'],
    correctIndex: 1,
    explanation: 'Calcium for hyperkalemia, hypocalcemia, or calcium channel blocker overdose.',
    category: 'ACLS',
  },
  {
    question: 'Pediatric epinephrine for anaphylaxis (IM)?',
    options: ['0.01 mg/kg', '0.15mg', '0.3mg', '0.5mg'],
    correctIndex: 0,
    explanation: '0.01 mg/kg IM (1:1,000), max 0.3mg for children, 0.5mg for adults.',
    category: 'PALS',
  },
  {
    question: 'Magnesium sulfate dose for Torsades de Pointes?',
    options: ['1-2g', '4-6g', '10g', '20g'],
    correctIndex: 0,
    explanation: '1-2g IV over 5-20 minutes for Torsades or refractory VFib.',
    category: 'ACLS',
  },
  {
    question: 'Correct ratio of chest compressions to breaths (adult)?',
    options: ['15:2', '30:2', '100:2', 'Continuous'],
    correctIndex: 1,
    explanation: '30 compressions to 2 breaths for adult CPR (1 or 2 rescuers).',
    category: 'BLS',
  },
];

async function seedCodeBlueQuestions() {
  console.log('🚨 Starting Code Blue question seeding...\n');

  try {
    // Check if questions already exist (use tags to filter ACLS)
    const existingCount = await prisma.question.count({
      where: { source: 'ACLS' },
    });

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing questions.`);
      console.log('❓ Delete and reseed? (This will remove all existing questions)');
      console.log('   To proceed: Run with --force flag\n');

      // Check for --force flag
      if (!process.argv.includes('--force')) {
        console.log('Seeding cancelled. Use --force to overwrite existing data.');
        return;
      }

      console.log('🗑️  Deleting existing questions...');
      await prisma.question.deleteMany({
        where: { source: 'ACLS' },
      });
      console.log('✅ Deleted.\n');
    }

    // Insert questions
    console.log(`📝 Inserting ${CODE_BLUE_QUESTIONS.length} questions...\n`);

    let insertedCount = 0;
    const categoryStats: Record<string, number> = {};

    for (const q of CODE_BLUE_QUESTIONS) {
      await prisma.question.create({
        data: {

          id: uuidv4(),


          question: q.question,
          vignette: '',
          options: q.options as any,
          correctAnswer: String(q.correctIndex),
          explanation: q.explanation,
          system: 'Emergency',
          source: 'ACLS',
          difficulty: 'medium',
          tags: { category: q.category } as any,
        },
      });

      insertedCount++;
      categoryStats[q.category] = (categoryStats[q.category] || 0) + 1;

      // Progress indicator
      if (insertedCount % 5 === 0) {
        console.log(`   ✓ ${insertedCount}/${CODE_BLUE_QUESTIONS.length} questions inserted...`);
      }
    }

    console.log(`\n✅ Successfully seeded ${insertedCount} Code Blue questions!\n`);
    console.log('📊 Breakdown by category:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} questions`);
    });

    console.log('\n🎯 Next steps:');
    console.log('   1. Code Blue Speed Mode will now use database questions');
    console.log('   2. To add more questions, edit this script and run with --force');
    console.log('   3. Questions are randomly shuffled each game session\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedCodeBlueQuestions()
  .then(() => {
    console.log('🏁 Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
