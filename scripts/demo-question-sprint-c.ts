/**
 * Demo: Question Generation Sprint C Utilities
 *
 * Demonstrates:
 * - Step 6: FSRS Question Linking
 * - Step 7: Distractor Validation
 * - Step 8: Question Versioning (mock - requires schema migration)
 */

// Step 6: FSRS Question Linking
import {
  recordQuestionWithFSRS,
  getQuestionHistoryForCondition,
  getQuestionUsageStats,
  findHighRepetitionConditions,
} from '../lib/fsrsQuestionLinking';

// Step 7: Distractor Validation
import {
  validateDistractors,
  validateDistractorsBatch,
  generateValidationReport,
  getQuestionsNeedingAttention,
} from '../lib/distractorValidation';

// Step 8: Question Versioning (utilities exist, but require schema migration)
import {
  createQuestionVersion,
  getQuestionVersions,
  compareVersions,
  getVersionHistorySummary,
} from '../lib/questionVersioning';

async function main() {
  console.log('🎯 Question Generation Sprint C Demo\n');
  console.log('═'.repeat(70));

  // ========================================================================
  // STEP 6: FSRS QUESTION LINKING
  // ========================================================================
  console.log('\n📎 STEP 6: FSRS Question Linking');
  console.log('─'.repeat(70));

  console.log(`
Step 6 demonstrates linking questions to FSRS cards for:
- Question-specific review scheduling
- Understanding which questions contributed to card stability
- Better analytics on question effectiveness

Key Features:
- recordQuestionWithFSRS(): Links question attempts to FSRS updates
- Tracks questionHistory (last 10 questions per condition)
- Tracks lastQuestionId and totalQuestionsAnswered
- Identifies high-repetition conditions (same questions repeated)

Usage Pattern:
  await recordQuestionWithFSRS(
    prisma,
    userId,
    'CV__ecg__atrial_fibrillation',
    'question_123',
    true, // wasCorrect
    45000, // timeSpentMs
    3 // fsrsRating (1=again, 2=hard, 3=good, 4=easy)
  );

Benefits:
✓ Know exactly which questions updated each FSRS card
✓ Detect when same questions are being repeated too often
✓ Analytics on question effectiveness per condition
✓ Question-specific spaced repetition scheduling

Note: Requires UserProgress.fsrsCard to be Enhanced with:
  - lastQuestionId: string
  - questionHistory: string[]
  - totalQuestionsAnswered: number

These fields are added to the existing JSON structure (no schema change required).
`);

  // ========================================================================
  // STEP 7: DISTRACTOR VALIDATION
  // ========================================================================
  console.log('\n\n✅ STEP 7: Distractor Validation');
  console.log('─'.repeat(70));

  console.log(`\nDemo 1: Validate Good Question (Expected: 90+ score)\n`);

  const goodQuestion = {
    id: 'q_good_1',
    question:
      'A 55-year-old male with chest pain shows ST-elevation in leads II, III, and aVF. Which coronary artery is most likely affected?',
    options: [
      'Left anterior descending artery',
      'Right coronary artery',
      'Left circumflex artery',
      'Left main coronary artery',
    ],
    correctAnswer: 1, // RCA
  };

  const goodResult = validateDistractors(goodQuestion);
  console.log(`   Question ID: ${goodQuestion.id}`);
  console.log(`   Score: ${goodResult.score}/100`);
  console.log(`   Valid: ${goodResult.isValid ? '✓ Yes' : '✗ No'}`);
  console.log(
    `   Issues: ${goodResult.issues.length === 0 ? 'None' : goodResult.issues.join(', ')}`
  );
  console.log(
    `   Warnings: ${goodResult.warnings.length === 0 ? 'None' : goodResult.warnings.length + ' warnings'}`
  );

  console.log(`\nDemo 2: Validate Poor Question (Expected: Low score)\n`);

  const poorQuestion = {
    id: 'q_poor_1',
    question: 'What is the treatment for diabetes?',
    options: [
      'Insulin, oral hypoglycemics, lifestyle modification, monitoring blood glucose levels regularly', // Too long
      'Metformin',
      'Metformin', // Duplicate!
      'None of the above', // Weak distractor
    ],
    correctAnswer: 0,
  };

  const poorResult = validateDistractors(poorQuestion);
  console.log(`   Question ID: ${poorQuestion.id}`);
  console.log(`   Score: ${poorResult.score}/100`);
  console.log(`   Valid: ${poorResult.isValid ? '✓ Yes' : '✗ No'}`);
  console.log(`   Issues:`);
  for (const issue of poorResult.issues) {
    console.log(`     ❌ ${issue}`);
  }
  console.log(`   Warnings:`);
  for (const warning of poorResult.warnings) {
    console.log(`     ⚠️  ${warning}`);
  }

  console.log(`\nDemo 3: Grammatical Giveaway Detection\n`);

  const grammarQuestion = {
    id: 'q_grammar_1',
    question: 'The first-line treatment for hypertension in a young patient is an:',
    options: [
      'Beta blocker',
      'Calcium channel blocker',
      'ACE inhibitor', // Only option starting with vowel!
      'Diuretic',
    ],
    correctAnswer: 2,
  };

  const grammarResult = validateDistractors(grammarQuestion);
  console.log(`   Question ID: ${grammarQuestion.id}`);
  console.log(`   Score: ${grammarResult.score}/100`);
  console.log(`   Issues:`);
  for (const issue of grammarResult.issues) {
    console.log(`     ❌ ${issue}`);
  }
  console.log(`   Suggestions:`);
  for (const suggestion of grammarResult.suggestions) {
    console.log(`     💡 ${suggestion}`);
  }

  console.log(`\nDemo 4: Batch Validation Report\n`);

  const batchQuestions = [goodQuestion, poorQuestion, grammarQuestion];
  const batchResults = validateDistractorsBatch(batchQuestions);

  console.log(generateValidationReport(batchResults));

  const needsAttention = getQuestionsNeedingAttention(batchResults);
  console.log(`Questions needing attention: ${needsAttention.join(', ')}`);

  // ========================================================================
  // STEP 8: QUESTION VERSIONING
  // ========================================================================
  console.log('\n\n📚 STEP 8: Question Versioning');
  console.log('─'.repeat(70));

  console.log(`
Step 8 provides version control for questions:
- Every edit creates a version snapshot
- Track what changed and why
- Rollback to previous versions
- Full audit trail with editor info

Schema Required (not yet migrated):

  model QuestionVersion {
    id              String   @id @default(cuid())
    questionId      String
    questionType    String   // 'pre_generated' | 'question'
    version         Int
    questionData    Json     // Full snapshot
    changedFields   String[] // What changed
    changeReason    String?  // Why
    changeSummary   String?  // Brief description
    editedBy        String   // User ID
    editedByEmail   String?
    distractorScore Int?     // From validation
    qualityScore    Int?
    createdAt       DateTime
    
    @@unique([questionId, questionType, version])
  }

Key Functions:
- createQuestionVersion(): Create snapshot when editing
- getQuestionVersions(): Get all versions
- rollbackQuestion(): Revert to previous version
- compareVersions(): Show diff between versions
- getVersionHistorySummary(): Display history

Example Usage:

  // Before editing a question
  const oldData = { question: 'Old text', options: [...] };
  const newData = { question: 'New text', options: [...] };
  
  await createQuestionVersion(
    prisma,
    'q_123',
    'pre_generated',
    oldData,
    newData,
    {
      editedBy: userId,
      editedByEmail: 'user@example.com',
      changeReason: 'Improved clarity',
      changeSummary: 'Rephrased question stem',
      distractorScore: 85,
      qualityScore: 90,
    }
  );
  
  // Later: Rollback if needed
  await rollbackQuestion(
    prisma,
    'q_123',
    'pre_generated',
    2, // version number
    userId
  );

Benefits:
✓ Never lose question edits
✓ Understand why changes were made
✓ Rollback bad edits easily
✓ Full audit trail for compliance
✓ Track quality improvement over time

Status: ⚠️ Requires schema migration to add QuestionVersion table
Action: Run migration in lib/questionVersioning.schema.ts
`);

  // ========================================================================
  // INTEGRATION EXAMPLE
  // ========================================================================
  console.log('\n🔗 Integration Example: Complete Question Lifecycle');
  console.log('─'.repeat(70));
  console.log(`
This is how Sprint C utilities integrate into the question system:

1. **Question Generation/Import**
   - Generate or import question
   - Validate distractors (Step 7)
   - If score < 70, flag for review
   - Create initial version (Step 8)

2. **Question Selection**
   - Use Sprint B utilities (deduplication, adaptive difficulty, interleaving)
   - Select appropriate questions for user

3. **Question Attempt**
   - User answers question
   - Record attempt
   - Link to FSRS card (Step 6) ← NEW
   - Track in questionHistory

4. **FSRS Update**
   - Update stability/difficulty
   - Schedule next review
   - Include questionId in reviewHistory (Step 6) ← NEW

5. **Question Editing**
   - Admin/curator edits question
   - Create version snapshot (Step 8) ← NEW
   - Re-validate distractors (Step 7) ← NEW
   - Update quality scores

6. **Quality Monitoring**
   - Check distractor scores (Step 7)
   - Identify high-repetition conditions (Step 6)
   - Track version quality trends (Step 8)
   - Flag questions needing attention

✅ Result: Comprehensive question quality system with:
   - Question-level FSRS tracking
   - Automated quality validation
   - Full version control and audit trail
   - Analytics on question effectiveness
`);

  console.log('\n═'.repeat(70));
  console.log('✅ Sprint C Complete! All utilities created.\n');
  console.log('Status:');
  console.log('  ✅ Step 6 (FSRS Linking): Implementation complete, ready to use');
  console.log('  ✅ Step 7 (Distractor Validation): Working, validated with tests');
  console.log('  ⚠️  Step 8 (Versioning): Utility complete, requires schema migration\n');
  console.log('Next Steps:');
  console.log('  1. Add QuestionVersion table to schema (see lib/questionVersioning.schema.ts)');
  console.log('  2. Run: npx prisma migrate dev --name add-question-versioning');
  console.log('  3. Integrate Sprint C utilities into question service');
  console.log('  4. Add admin UI for version history and rollback\n');
}

main().catch(console.error);
