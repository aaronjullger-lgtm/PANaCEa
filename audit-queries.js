const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runQueries() {
  try {
    console.log('=== PANACEA DATABASE AUDIT ===\n');

    // 1. Question counts by validationStatus
    console.log('1. Questions by validation status:');
    const q1 = await prisma.$queryRaw`
      SELECT "validationStatus", COUNT(*) as count FROM "PreGeneratedQuestion" GROUP BY "validationStatus"
    `;
    console.log(q1);
    console.log();

    // 2. Questions by system (organSystem)
    console.log('2. Questions by organ system:');
    const q2 = await prisma.$queryRaw`
      SELECT "system", COUNT(*) as count FROM "PreGeneratedQuestion" WHERE "system" IS NOT NULL GROUP BY "system" ORDER BY COUNT(*) DESC
    `;
    console.log(q2);
    console.log();

    // 3. Total conditions with questions
    console.log('3. Total conditions with questions:');
    const q3 = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "conditionId") as conditions_with_questions FROM "PreGeneratedQuestion" WHERE "conditionId" IS NOT NULL
    `;
    console.log(q3);
    console.log();

    // 4. Total conditions in database
    console.log('4. Total conditions in database:');
    const q4 = await prisma.$queryRaw`
      SELECT COUNT(*) as total_conditions FROM "Condition"
    `;
    console.log(q4);
    console.log();

    // 5. UserProgress records (FSRS data)
    console.log('5. UserProgress records (FSRS data):');
    const q5 = await prisma.$queryRaw`
      SELECT COUNT(*) as total_progress, COUNT(CASE WHEN "nextReview" IS NOT NULL THEN 1 END) as with_next_review FROM "UserProgress"
    `;
    console.log(q5);
    console.log();

    // 6. ReviewLog entries
    console.log('6. ReviewLog entries:');
    const q6 = await prisma.$queryRaw`
      SELECT COUNT(*) as total_reviews, MIN("createdAt") as first_review, MAX("createdAt") as last_review FROM "ReviewLog"
    `;
    console.log(q6);
    console.log();

    // 7. QuestionAttempt data
    console.log('7. QuestionAttempt data:');
    const q7 = await prisma.$queryRaw`
      SELECT COUNT(*) as total_attempts, COUNT(CASE WHEN "isCorrect" = true THEN 1 END) as correct FROM "QuestionAttempt"
    `;
    console.log(q7);
    console.log();

    // 8. Drug count
    console.log('8. Drug count:');
    const q8 = await prisma.$queryRaw`
      SELECT COUNT(*) as total_drugs FROM "Drug"
    `;
    console.log(q8);
    console.log();

    // 9. Questions with no condition link
    console.log('9. Questions with no condition link:');
    const q9 = await prisma.$queryRaw`
      SELECT COUNT(*) as orphaned_questions FROM "PreGeneratedQuestion" WHERE "conditionId" IS NULL
    `;
    console.log(q9);
    console.log();

    // 10. Content by difficulty
    console.log('10. Content by difficulty:');
    const q10 = await prisma.$queryRaw`
      SELECT "difficulty", COUNT(*) as count FROM "PreGeneratedQuestion" GROUP BY "difficulty" ORDER BY COUNT(*) DESC
    `;
    console.log(q10);
    console.log();

    // 11. Questions with empty/null question data
    console.log('11. Questions with empty/null data:');
    const q11 = await prisma.$queryRaw`
      SELECT COUNT(*) as empty_questions FROM "PreGeneratedQuestion" WHERE "questionData" IS NULL OR "questionData"::text = '{}' OR "questionData"::text = 'null'
    `;
    console.log(q11);
    console.log();

    // 12. FSRS parameters
    console.log('12. FSRS parameters (personalized weights):');
    const q12 = await prisma.$queryRaw`
      SELECT COUNT(*) as fsrs_params FROM "FSRSParameters"
    `;
    console.log(q12);
    console.log();

    // Bonus: SessionType distribution in ReviewLog
    console.log('13. ReviewLog distribution by sessionType:');
    const q13 = await prisma.$queryRaw`
      SELECT "sessionType", COUNT(*) as count FROM "ReviewLog" GROUP BY "sessionType" ORDER BY COUNT(*) DESC
    `;
    console.log(q13);
    console.log();

    // Bonus: Drill type distribution
    console.log('14. Questions by type:');
    const q14 = await prisma.$queryRaw`
      SELECT "questionType", COUNT(*) as count FROM "PreGeneratedQuestion" GROUP BY "questionType" ORDER BY COUNT(*) DESC
    `;
    console.log(q14);
    console.log();

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runQueries();
