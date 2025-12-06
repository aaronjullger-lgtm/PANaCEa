/**
 * Example Script: Hybrid Content Engine Workflow
 * 
 * This script demonstrates the complete workflow of the Hybrid Content Engine:
 * 1. Generate and stage questions
 * 2. Process staging queue with adequacy checks
 * 3. Fetch questions with no-repeat logic
 * 4. Create and use question seeds
 * 5. Extract and view clinical pearls
 * 
 * Usage: tsx scripts/exampleHybridContentEngine.ts
 */

import { 
  saveToStaging, 
  processStagingQueue, 
  getStagingStats 
} from '../services/stagingQuestionService';

import { 
  getQuestionsWithNoRepeat, 
  recordQuestionSeen, 
  getRepositoryStats 
} from '../services/noRepeatService';

import { 
  createQuestionSeed, 
  assembleQuestionFromSeed, 
  previewSeedPermutations 
} from '../services/questionSeedService';

import { 
  createClinicalPearl, 
  getDailyPearl, 
  getUserPearls,
  getPearlStats 
} from '../services/clinicalPearlService';

// Example user ID for testing
const EXAMPLE_USER_ID = 'demo-user-001';

async function main() {
  console.log('\n🧠 Hybrid Content Engine - Complete Workflow Demo\n');
  console.log('=' .repeat(60));
  
  // ========================================================================
  // TASK 108: Staging Lake Architecture
  // ========================================================================
  console.log('\n📋 TASK 108: Staging Lake Architecture');
  console.log('-'.repeat(60));
  
  // Step 1: Generate and save questions to staging
  console.log('\n1. Generating and staging a question...');
  const sampleQuestion = {
    type: 'mcq',
    question: 'A 55-year-old male with a history of hypertension presents with sudden onset chest pain radiating to the left arm. ECG shows ST-elevation in leads II, III, and aVF. What is the most likely diagnosis?',
    options: [
      'Anterior wall MI',
      'Inferior wall MI',
      'Unstable angina',
      'Pericarditis'
    ],
    correctAnswer: 'Inferior wall MI',
    explanation: {
      rationale: 'ST-elevation in leads II, III, and aVF indicates acute inferior wall myocardial infarction. This pattern suggests occlusion of the right coronary artery or left circumflex artery. Immediate reperfusion therapy with PCI or thrombolytics is indicated. The patient\'s risk factors including hypertension and the classic presentation of chest pain radiating to the arm are consistent with acute coronary syndrome. Early recognition and treatment within the golden hour significantly improves outcomes and reduces mortality.'
    },
    system: 'CV',
    conditionId: 'myocardial-infarction',
    difficulty: 'medium'
  };
  
  const stagedQuestion = await saveToStaging(sampleQuestion);
  console.log(`✅ Question staged with ID: ${stagedQuestion.id}`);
  console.log(`   Explanation length: ${stagedQuestion.explanationLength} words`);
  
  // Step 2: Get staging statistics
  console.log('\n2. Checking staging queue statistics...');
  const stagingStats = await getStagingStats();
  console.log(`   Total in staging: ${stagingStats.total}`);
  console.log(`   Pending review: ${stagingStats.pending}`);
  console.log(`   Passed: ${stagingStats.passed}`);
  console.log(`   Promoted to live: ${stagingStats.promoted}`);
  
  // Step 3: Process staging queue (adequacy checks and auto-promotion)
  console.log('\n3. Processing staging queue...');
  const processResults = await processStagingQueue(5);
  console.log(`   Processed ${processResults.length} questions:`);
  for (const result of processResults) {
    console.log(`   - ${result.id}: ${result.status} (score: ${result.score?.toFixed(2) || 'N/A'})`);
  }
  
  // ========================================================================
  // TASK 109: "Infinite" No-Repeat Logic
  // ========================================================================
  console.log('\n\n📚 TASK 109: "Infinite" No-Repeat Logic');
  console.log('-'.repeat(60));
  
  // Step 1: Get repository statistics (Golden Repository)
  console.log('\n1. Checking Golden Repository...');
  const repoStats = await getRepositoryStats();
  console.log(`   ${repoStats.message}`);
  console.log(`   Total questions: ${repoStats.totalQuestions}`);
  console.log(`   Unused questions: ${repoStats.unseenByAnyUser}`);
  
  // Step 2: Fetch questions with no-repeat logic
  console.log('\n2. Fetching unseen questions for user...');
  const questionResult = await getQuestionsWithNoRepeat(
    EXAMPLE_USER_ID,
    { system: 'CV', difficulty: 'medium' },
    10
  );
  console.log(`   Source: ${questionResult.source}`);
  console.log(`   Questions fetched: ${questionResult.questions.length}`);
  if (questionResult.needsGeneration) {
    console.log(`   ⚠️  Need to generate ${questionResult.generationNeeded} more questions`);
  }
  
  // Step 3: Record questions as seen
  if (questionResult.questions.length > 0) {
    console.log('\n3. Recording questions as seen by user...');
    const firstQuestion = questionResult.questions[0];
    await recordQuestionSeen(EXAMPLE_USER_ID, firstQuestion.id, {
      questionType: firstQuestion.questionType,
      system: firstQuestion.system,
      wasCorrect: true
    });
    console.log(`   ✅ Recorded question ${firstQuestion.id} in user history`);
    console.log(`   → User will never see this question again!`);
  }
  
  // ========================================================================
  // TASK 111: "Vignette Permutation" Storage
  // ========================================================================
  console.log('\n\n🎲 TASK 111: "Vignette Permutation" Storage');
  console.log('-'.repeat(60));
  
  // Step 1: Create a question seed
  console.log('\n1. Creating question seed for Appendicitis...');
  const appendicitisSeed = await createQuestionSeed({
    conditionId: 'appendicitis',
    questionType: 'vignette',
    system: 'GI',
    corePathology: 'Appendicitis',
    variables: {
      Age: [8, 15, 25, 42, 60],
      Sex: ['Male', 'Female'],
      Presentation: ['Classic McBurney\'s point tenderness', 'Retrocecal with flank pain', 'Periumbilical pain migrating to RLQ'],
      Vitals: ['stable vital signs', 'low-grade fever and mild tachycardia', 'high fever and tachycardia suggesting perforation']
    },
    template: 'A {{Age}}-year-old {{Sex}} presents to the emergency department with abdominal pain. Physical exam reveals {{Presentation}}. Vital signs show {{Vitals}}. What is the most appropriate next step in management?',
    correctAnswer: 'Surgical consult for appendectomy',
    explanation: 'Acute appendicitis requires prompt surgical intervention to prevent perforation and peritonitis. The clinical presentation with right lower quadrant pain and physical exam findings are diagnostic. CT imaging can be used for confirmation in atypical cases, but clear clinical presentation warrants immediate surgical consultation.',
    distractors: [
      'Discharge with oral antibiotics',
      'Observe for 24 hours',
      'Upper GI endoscopy'
    ],
    difficulty: 'medium'
  });
  console.log(`✅ Seed created with ID: ${appendicitisSeed.id}`);
  console.log(`   Variables: ${Object.keys(appendicitisSeed.variables as any).join(', ')}`);
  
  // Calculate total permutations
  const vars = appendicitisSeed.variables as Record<string, any[]>;
  const totalPermutations = Object.values(vars).reduce((acc, arr) => acc * arr.length, 1);
  console.log(`   Total possible permutations: ${totalPermutations}`);
  
  // Step 2: Preview permutations
  console.log('\n2. Previewing some permutations...');
  const preview = await previewSeedPermutations(appendicitisSeed.id, 3);
  for (const sample of preview.samples) {
    console.log(`\n   Permutation ${sample.permutationNumber}:`);
    console.log(`   "${sample.questionText}"`);
  }
  
  // Step 3: Assemble unique questions
  console.log('\n3. Assembling unique questions from seed...');
  const assembled1 = await assembleQuestionFromSeed(appendicitisSeed.id);
  const assembled2 = await assembleQuestionFromSeed(appendicitisSeed.id);
  console.log(`   Question 1 ID: ${assembled1.id}`);
  console.log(`   Question 2 ID: ${assembled2.id}`);
  console.log(`   → Both from same seed but with different variables!`);
  
  // ========================================================================
  // TASK 112: The "Pearl" Harvester
  // ========================================================================
  console.log('\n\n💎 TASK 112: The "Pearl" Harvester');
  console.log('-'.repeat(60));
  
  // Step 1: Extract clinical pearl from question explanation
  console.log('\n1. Extracting clinical pearl from explanation...');
  const pearlExplanation = 'Acute appendicitis requires prompt surgical intervention to prevent perforation and peritonitis. The classic presentation includes periumbilical pain that migrates to the right lower quadrant within 12-24 hours. McBurney\'s point tenderness is a hallmark finding. CT imaging has 95% sensitivity and specificity but should not delay surgery in clear clinical presentations. Retrocecal appendicitis may present atypically with flank pain or minimal peritoneal signs.';
  
  const pearl = await createClinicalPearl(
    'example-question-123',
    pearlExplanation,
    {
      conditionId: 'appendicitis',
      system: 'GI',
      difficulty: 'medium'
    }
  );
  console.log(`✅ Pearl extracted and saved: ${pearl.id}`);
  console.log(`   Pearl: "${pearl.pearlText}"`);
  console.log(`   Category: ${pearl.category}`);
  console.log(`   Tags: ${pearl.tags.join(', ')}`);
  
  // Step 2: Get pearl statistics
  console.log('\n2. Checking pearl statistics...');
  const pearlStats = await getPearlStats();
  console.log(`   Total pearls in database: ${pearlStats.total}`);
  if (pearlStats.topPearls.length > 0) {
    console.log(`   Top rated pearl: "${pearlStats.topPearls[0].pearlText}"`);
    console.log(`   Useful votes: ${pearlStats.topPearls[0].usefulVotes}`);
  }
  
  // Step 3: Get daily pearl
  console.log('\n3. Fetching daily pearl...');
  const dailyPearl = await getDailyPearl(EXAMPLE_USER_ID);
  if (dailyPearl) {
    console.log(`   📌 Today's Pearl: "${dailyPearl.pearlText}"`);
    console.log(`   System: ${dailyPearl.system}`);
    console.log(`   Views: ${dailyPearl.viewCount}`);
  }
  
  // Step 4: Get user's pearls (from questions they've taken)
  console.log('\n4. Fetching user\'s pearl collection...');
  const userPearls = await getUserPearls(EXAMPLE_USER_ID, 10);
  console.log(`   User has ${userPearls.length} pearls from answered questions`);
  if (userPearls.length > 0) {
    console.log(`   First pearl: "${userPearls[0].pearlText}"`);
  }
  
  // ========================================================================
  // Summary & Cost Analysis
  // ========================================================================
  console.log('\n\n💰 Cost & Performance Summary');
  console.log('=' .repeat(60));
  console.log('\nWithout Hybrid Content Engine:');
  console.log('  • Every question → AI generation ($0.02 per question)');
  console.log('  • 1000 questions/day × $0.02 = $20/day = $7,300/year');
  console.log('  • Latency: 2-5 seconds per question');
  console.log('  • No quality control');
  
  console.log('\nWith Hybrid Content Engine:');
  console.log('  • 90% questions from database (instant, free)');
  console.log('  • 10% AI generation for new content');
  console.log('  • Cost: ~$730/year (90% savings!)');
  console.log('  • Latency: 50ms (40-100x faster)');
  console.log('  • All questions vetted before reaching users');
  
  console.log('\n✨ Building a valuable asset library that grows every day!');
  console.log('=' .repeat(60));
  console.log('\n');
}

// Run the demo
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Demo completed successfully!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error running demo:', error);
      process.exit(1);
    });
}

export { main };
