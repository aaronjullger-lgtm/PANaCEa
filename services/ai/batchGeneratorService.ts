/**
 * Batch Question Generator
 *
 * Generates questions in batches for the question pool.
 * Called by poolMonitorService when pool levels drop.
 *
 * Routes all generated questions through the staging pipeline
 * (saveToStaging → runAdequacyCheck → promoteToLive) so every
 * question gets quality-checked and canonical-mirrored before
 * reaching learners.
 */

import { prisma } from '../../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  saveToStaging,
  runAdequacyCheck,
  promoteToLive,
} from '../../functions/api/_shared/staging-questions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  system: string;
  conditionId?: string;
  difficulty: string;
  questionType: string;
  tags: string[];
}

/**
 * Generate a batch of questions for a specific system.
 *
 * Each generated question flows through the staging pipeline:
 *   saveToStaging → runAdequacyCheck → promoteToLive (if valid)
 *
 * Questions that fail adequacy checks stay in staging for later
 * review via processStagingQueue / processStagingQueueWithCritic.
 * Questions where the AI check cannot complete stay pending in
 * staging (not discarded).
 */
export async function generateBatchForSystem(
  system: string,
  count: number = 25
): Promise<{ promoted: number; pending: number; failed: number; questions: any[] }> {

  // Get conditions for this system from MedicalContent
  const conditions = await prisma.medicalContent.findMany({
    where: { system },
    select: { id: true, conditionId: true, condition: true, content: true },
    take: Math.min(count * 2, 50), // Get more than needed for variety
  });

  if (conditions.length === 0) {
    return { promoted: 0, pending: 0, failed: 0, questions: [] };
  }

  let promoted = 0;
  let pending = 0;
  let failed = 0;
  const questions: any[] = [];

  // Shuffle conditions for variety
  const shuffled = conditions.sort(() => Math.random() - 0.5);

  for (let i = 0; i < count && i < shuffled.length; i++) {
    const condition = shuffled[i];

    try {
      const question = await generateQuestionForCondition(condition, system);

      if (question) {
        // Transform to staging-compatible format
        const stagingData = buildStagingQuestionData(question, condition, system);

        // Save to staging (validates structure)
        const stagingQuestion = await saveToStaging(prisma, stagingData);

        // Run AI adequacy check
        const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY };
        const checkResult = await runAdequacyCheck(prisma, env, stagingQuestion.id);

        if (checkResult.isValid) {
          // Passed all checks — promote to live pool + canonical mirror
          const liveQuestion = await promoteToLive(prisma, stagingQuestion.id);
          questions.push(liveQuestion);
          promoted++;
        } else if (checkResult.accuracyCheckCompleted) {
          // Failed adequacy check — stays in staging as flagged/rejected
          failed++;
        } else {
          // AI check did not complete — stays pending for later review
          pending++;
        }
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ✗ Failed for ${condition.condition}:`, err);
      failed++;
    }
  }

  return { promoted, pending, failed, questions };
}

/**
 * Transform a GeneratedQuestion into the shape saveToStaging expects.
 * The staging functions resolve correctAnswer from either a string
 * (letter or full text) or a numeric index via correctAnswerIndex/correctIndex.
 */
function buildStagingQuestionData(
  question: GeneratedQuestion,
  condition: { condition: string; conditionId?: string | null },
  system: string
): Record<string, unknown> {
  return {
    vignette: '',
    question: question.question,
    options: question.options,
    correctAnswerIndex: question.correctIndex,
    explanation: question.explanation,
    system,
    difficulty: question.difficulty,
    tags: [
      ...(question.tags || []),
      `conditionId:${condition.conditionId || ''}`,
      `medicalContentId:${condition.conditionId || ''}`,
      `conditionName:${condition.condition}`,
      `questionType:${question.questionType}`,
      `questionOrder:first`,
      `taskCategory:diagnosis`,
      `source:batch_generator`,
    ],
  };
}

/**
 * Generate a single question for a condition
 */
async function generateQuestionForCondition(
  condition: { condition: string; content: any },
  system: string
): Promise<GeneratedQuestion | null> {
  const content = condition.content as any;

  const prompt = `You are a PANCE exam question writer. Create a high-quality MCQ for "${condition.condition}".

Context:
- Overview: ${content?.overview?.slice(0, 500) || 'N/A'}
- Key symptoms: ${JSON.stringify(content?.symptoms?.slice(0, 5)) || 'N/A'}
- Diagnostics: ${content?.diagnostics?.notes?.slice(0, 300) || 'N/A'}

Generate a clinical vignette question. Return ONLY valid JSON:
{
  "question": "A 45-year-old... (clinical scenario with question)",
  "options": ["A. option1", "B. option2", "C. option3", "D. option4", "E. option5"],
  "correctIndex": 0,
  "explanation": "The correct answer is A because...",
  "difficulty": "medium",
  "questionType": "clinical_vignette",
  "tags": ["diagnosis", "treatment"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json\n?|\n?```/g, '')
      .trim();
    const parsed = JSON.parse(text);

    return {
      ...parsed,
      system,
    };
  } catch (err) {
    console.error('Generation error:', err);
    return null;
  }
}

/**
 * Generate questions for all systems below threshold
 */
export async function generateForAllLowSystems(threshold: number = 50): Promise<{
  systemsProcessed: number;
  totalPromoted: number;
  totalPending: number;
  totalFailed: number;
}> {
  // Get pool levels
  const { checkPoolLevels } = await import('./poolMonitorService');
  const poolStatus = await checkPoolLevels();

  const lowSystems = poolStatus.filter((s) => s.unused < threshold);

  let totalPromoted = 0;
  let totalPending = 0;
  let totalFailed = 0;

  for (const systemStatus of lowSystems) {
    const needed = threshold - systemStatus.unused;

    const result = await generateBatchForSystem(systemStatus.system, needed);
    totalPromoted += result.promoted;
    totalPending += result.pending;
    totalFailed += result.failed;
  }

  return {
    systemsProcessed: lowSystems.length,
    totalPromoted,
    totalPending,
    totalFailed,
  };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const system = args.find((a) => a.startsWith('--system='))?.split('=')[1];
  const count = parseInt(args.find((a) => a.startsWith('--count='))?.split('=')[1] || '10');

  (async () => {
    if (system) {
      const result = await generateBatchForSystem(system, count);
      console.log(`Batch complete: ${result.promoted} promoted, ${result.pending} pending, ${result.failed} failed`);
    } else {
      const result = await generateForAllLowSystems();
      console.log(`All systems: ${result.totalPromoted} promoted, ${result.totalPending} pending, ${result.totalFailed} failed`);
    }
    process.exit(0);
  })();
}
