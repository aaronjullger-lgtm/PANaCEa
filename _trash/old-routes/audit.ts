import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Helper to convert BigInt to Number for JSON serialization
const toBigIntSafe = (obj: any): any => {
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(toBigIntSafe);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, toBigIntSafe(v)])
    );
  }
  return obj;
};

router.get('/content-audit', async (req, res) => {
  try {
    const results: Record<string, any> = {};

    // 1. Questions by validation status
    try {
      const data = await prisma.$queryRaw`
        SELECT "validationStatus", COUNT(*) as count FROM "PreGeneratedQuestion" GROUP BY "validationStatus"
      `;
      results.q1_by_status = toBigIntSafe(data);
    } catch (e) {
      results.q1_by_status = { error: String(e).substring(0, 100) };
    }

    // 2. Questions by system
    try {
      const data = await prisma.$queryRaw`
        SELECT "system", COUNT(*) as count FROM "PreGeneratedQuestion" WHERE "system" IS NOT NULL GROUP BY "system" ORDER BY COUNT(*) DESC LIMIT 20
      `;
      results.q2_by_system = toBigIntSafe(data);
    } catch (e) {
      results.q2_by_system = { error: String(e).substring(0, 100) };
    }

    // 3. Total conditions with questions
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT "conditionId") as count FROM "PreGeneratedQuestion" WHERE "conditionId" IS NOT NULL
      `;
      results.q3_conditions_with_questions = toBigIntSafe(data);
    } catch (e) {
      results.q3_conditions_with_questions = { error: String(e).substring(0, 100) };
    }

    // 4. Total conditions in database
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "Condition"
      `;
      results.q4_total_conditions = toBigIntSafe(data);
    } catch (e) {
      results.q4_total_conditions = { error: String(e).substring(0, 100) };
    }

    // 5. UserProgress records
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as total, COUNT(CASE WHEN "nextReviewAt" IS NOT NULL THEN 1 END) as with_next_review FROM "UserProgress"
      `;
      results.q5_user_progress = toBigIntSafe(data);
    } catch (e) {
      results.q5_user_progress = { error: String(e).substring(0, 100) };
    }

    // 6. ReviewLog entries
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as total, MIN("createdAt") as first_review, MAX("createdAt") as last_review FROM "ReviewLog"
      `;
      results.q6_review_log = toBigIntSafe(data);
    } catch (e) {
      results.q6_review_log = { error: String(e).substring(0, 100) };
    }

    // 7. QuestionAttempt data
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as total, COUNT(CASE WHEN "wasCorrect" = true THEN 1 END) as correct FROM "QuestionAttempt"
      `;
      results.q7_attempts = toBigIntSafe(data);
    } catch (e) {
      results.q7_attempts = { error: String(e).substring(0, 100) };
    }

    // 8. Drug count
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "Drug"
      `;
      results.q8_drugs = toBigIntSafe(data);
    } catch (e) {
      results.q8_drugs = { error: String(e).substring(0, 100) };
    }

    // 9. Questions with no condition link
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "PreGeneratedQuestion" WHERE "conditionId" IS NULL
      `;
      results.q9_orphaned = toBigIntSafe(data);
    } catch (e) {
      results.q9_orphaned = { error: String(e).substring(0, 100) };
    }

    // 10. Content by difficulty
    try {
      const data = await prisma.$queryRaw`
        SELECT "difficulty", COUNT(*) as count FROM "PreGeneratedQuestion" GROUP BY "difficulty" ORDER BY COUNT(*) DESC
      `;
      results.q10_by_difficulty = toBigIntSafe(data);
    } catch (e) {
      results.q10_by_difficulty = { error: String(e).substring(0, 100) };
    }

    // 11. Questions with empty/null data
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "PreGeneratedQuestion" WHERE "questionData" IS NULL OR "questionData"::text = '{}' OR "questionData"::text = 'null'
      `;
      results.q11_empty_questions = toBigIntSafe(data);
    } catch (e) {
      results.q11_empty_questions = { error: String(e).substring(0, 100) };
    }

    // 12. FSRS parameters (may not exist)
    try {
      const data = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "FSRSParameters"
      `;
      results.q12_fsrs_params = toBigIntSafe(data);
    } catch (e) {
      results.q12_fsrs_params = { error: 'Table does not exist', code: 'relation_not_exist' };
    }

    // 13. SessionType distribution in ReviewLog
    try {
      const data = await prisma.$queryRaw`
        SELECT "sessionType", COUNT(*) as count FROM "ReviewLog" GROUP BY "sessionType" ORDER BY COUNT(*) DESC
      `;
      results.q13_session_type = toBigIntSafe(data);
    } catch (e) {
      results.q13_session_type = { error: String(e).substring(0, 100) };
    }

    // 14. Question type distribution
    try {
      const data = await prisma.$queryRaw`
        SELECT "questionType", COUNT(*) as count FROM "PreGeneratedQuestion" GROUP BY "questionType" ORDER BY COUNT(*) DESC
      `;
      results.q14_question_types = toBigIntSafe(data);
    } catch (e) {
      results.q14_question_types = { error: String(e).substring(0, 100) };
    }

    res.json(results);
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
