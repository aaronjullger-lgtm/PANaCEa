/**
 * Batch Question Generator
 *
 * Generates questions in batches for the question pool.
 * Called by poolMonitorService when pool levels drop.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
 * Generate a batch of questions for a specific system
 */
export async function generateBatchForSystem(
  system: string,
  count: number = 25
): Promise<{ generated: number; failed: number; questions: any[] }> {

  // Get conditions for this system from MedicalContent
  const conditions = await prisma.medicalContent.findMany({
    where: { system },
    select: { id: true, conditionId: true, condition: true, content: true },
    take: Math.min(count * 2, 50), // Get more than needed for variety
  });

  if (conditions.length === 0) {
    return { generated: 0, failed: 0, questions: [] };
  }

  let generated = 0;
  let failed = 0;
  const questions: any[] = [];

  // Shuffle conditions for variety
  const shuffled = conditions.sort(() => Math.random() - 0.5);

  for (let i = 0; i < count && i < shuffled.length; i++) {
    const condition = shuffled[i];

    try {
      const question = await generateQuestionForCondition(condition, system);

      if (question) {
        // Save directly to PreGeneratedQuestion pool
        const saved = await prisma.preGeneratedQuestion.create({
          data: {
            id: uuidv4(),
            questionData: {
              question: question.question,
              options: question.options,
              correctIndex: question.correctIndex,
              explanation: question.explanation,
              tags: question.tags,
            } as any,
            system: system,
            conditionId: condition.conditionId,
            difficulty: question.difficulty,
            questionType: question.questionType,
            generatedAt: new Date(),
          },
        });

        questions.push(saved);
        generated++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ✗ Failed for ${condition.condition}:`, err);
      failed++;
    }
  }

  return { generated, failed, questions };
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
  totalGenerated: number;
  totalFailed: number;
}> {
  // Get pool levels
  const { checkPoolLevels } = await import('./poolMonitorService');
  const poolStatus = await checkPoolLevels();

  const lowSystems = poolStatus.filter((s) => s.unused < threshold);

  let totalGenerated = 0;
  let totalFailed = 0;

  for (const systemStatus of lowSystems) {
    const needed = threshold - systemStatus.unused;

    const result = await generateBatchForSystem(systemStatus.system, needed);
    totalGenerated += result.generated;
    totalFailed += result.failed;
  }

  return {
    systemsProcessed: lowSystems.length,
    totalGenerated,
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
      await generateBatchForSystem(system, count);
    } else {
      const result = await generateForAllLowSystems();
    }
    process.exit(0);
  })();
}
