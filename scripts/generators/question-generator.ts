/**
 * Question Generator V2
 * Generates PANCE-style practice questions from database conditions
 * Links questions to MedicalContent and Condition tables
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface QuestionData {
  vignette: string;
  question: string;
  options: { A: string; B: string; C: string; D: string; E?: string };
  correctAnswer: string;
  explanation: string;
  system: string;
  tags: string[];
}

interface ConditionWithContent {
  conditionId: string;
  medicalContentId: string;
  name: string;
  system: string;
  overview?: string;
  symptoms?: string[];
  treatment?: string;
}

// PANCE Blueprint System weights for distribution
const SYSTEM_WEIGHTS: Record<string, number> = {
  cardiovascular: 16,
  pulmonary: 12,
  gastrointestinal: 10,
  musculoskeletal: 10,
  eent: 9,
  neurologic: 6,
  psychiatric: 6,
  psychiatry: 6,
  renal: 6,
  reproductive: 8,
  endocrine: 6,
  dermatology: 5,
  hematology: 3,
  'infectious disease': 3,
};

/**
 * Fetch conditions from MedicalContent (database-first approach)
 */
async function fetchConditionsFromDatabase(): Promise<ConditionWithContent[]> {
  const medicalContent = await prisma.medicalContent.findMany({
    where: {
      status: 'published',
    },
    select: {
      id: true,
      conditionId: true,
      condition: true, // This is the condition name string
      system: true,
      overview: true,
      symptoms: true,
      treatment: true,
    },
  });

  return medicalContent.map((mc) => ({
    conditionId: mc.conditionId,
    medicalContentId: mc.id,
    name: mc.condition, // condition field is the name string
    system: mc.system,
    overview: mc.overview ?? undefined,
    symptoms: mc.symptoms ? mc.symptoms.split(',').map((s) => s.trim()) : undefined,
    treatment: mc.treatment ?? undefined,
  }));
}

/**
 * Build a contextual prompt using condition data from database
 */
function buildPrompt(condition: ConditionWithContent): string {
  let conditionContext = '';

  if (condition.overview) {
    conditionContext += `\nCondition Overview: ${condition.overview.substring(0, 500)}`;
  }
  if (condition.symptoms && condition.symptoms.length > 0) {
    conditionContext += `\nKey Symptoms: ${condition.symptoms.slice(0, 8).join(', ')}`;
  }
  if (condition.treatment) {
    conditionContext += `\nTreatment Notes: ${condition.treatment.substring(0, 300)}`;
  }

  return `You are an expert medical educator creating PANCE-style board exam questions.

Create a multiple choice question about: ${condition.name}
Body System: ${condition.system}
Difficulty: PANCE-level - typical board exam difficulty, moderate complexity, clinically relevant
${conditionContext}

Requirements:
1. Write a realistic clinical vignette (2-4 sentences) with patient demographics, history, and findings
2. Include relevant vital signs, physical exam findings, or lab values when appropriate
3. Ask about diagnosis, next best step, treatment, or mechanism
4. Provide 4-5 answer options (A-E) that are plausible
5. One clearly correct answer
6. Detailed explanation covering why the answer is correct AND why each distractor is wrong

Return valid JSON:
{
  "vignette": "A 45-year-old woman presents with...",
  "question": "What is the most likely diagnosis?",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option",
    "E": "Fifth option"
  },
  "correctAnswer": "B",
  "explanation": "The correct answer is B because... Option A is incorrect because... Option C is incorrect because...",
  "system": "${condition.system}",
  "tags": ["${condition.name}", "diagnosis", "high-yield"]
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown
- Use straight quotes only
- Write "greater than" not ">" 
- NO special characters like ≥ ≤ × → 
- All answer options must be distinct and medically plausible`;
}

async function generateQuestion(
  condition: ConditionWithContent,
  retryCount = 0
): Promise<QuestionData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = buildPrompt(condition);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    // Clean
    jsonStr = jsonStr
      .trim()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');

    const parsed: QuestionData = JSON.parse(jsonStr);

    // Validate required fields
    if (
      !parsed.vignette ||
      !parsed.question ||
      !parsed.options ||
      !parsed.correctAnswer ||
      !parsed.explanation
    ) {
      throw new Error('Missing required fields');
    }

    return {
      ...parsed,
      system: condition.system,
    };
  } catch (error) {
    console.error(`    ⚠️  Parse error: ${error}`);
    if (retryCount < 2) {
      await new Promise((r) => setTimeout(r, 1000));
      return generateQuestion(condition, retryCount + 1);
    }
    return null;
  }
}

/**
 * Get weight for a system (case-insensitive lookup)
 */
function getSystemWeight(system: string): number {
  const normalizedSystem = system.toLowerCase();
  return SYSTEM_WEIGHTS[normalizedSystem] ?? 3; // Default weight of 3
}

/**
 * Select conditions based on PANCE blueprint weights
 */
function selectConditionsWeighted(
  conditions: ConditionWithContent[],
  count: number
): ConditionWithContent[] {
  // Group conditions by system
  const bySystem: Record<string, ConditionWithContent[]> = {};
  for (const c of conditions) {
    const system = c.system.toLowerCase();
    if (!bySystem[system]) bySystem[system] = [];
    bySystem[system].push(c);
  }

  // Calculate total weight for systems we have conditions for
  let totalWeight = 0;
  for (const system of Object.keys(bySystem)) {
    totalWeight += getSystemWeight(system);
  }

  // Distribute count across systems by weight
  const selected: ConditionWithContent[] = [];

  for (const [system, systemConditions] of Object.entries(bySystem)) {
    const weight = getSystemWeight(system);
    const systemCount = Math.max(1, Math.round((weight / totalWeight) * count));

    // Shuffle conditions in this system
    const shuffled = [...systemConditions].sort(() => Math.random() - 0.5);

    // Take up to systemCount conditions
    selected.push(...shuffled.slice(0, Math.min(systemCount, shuffled.length)));
  }

  // Shuffle final selection and trim to exact count
  return selected.sort(() => Math.random() - 0.5).slice(0, count);
}

async function main() {
  console.log('📝 Question Generator V2 (Database-Linked)');
  console.log('═'.repeat(60));

  // Fetch conditions from MedicalContent
  console.log('\n📊 Fetching conditions from MedicalContent...');
  const conditions = await fetchConditionsFromDatabase();
  console.log(`   Found ${conditions.length} conditions with published content`);

  if (conditions.length === 0) {
    console.log('❌ No published conditions found in MedicalContent!');
    console.log('   Run content seeding scripts first.');
    await prisma.$disconnect();
    return;
  }

  // Log system distribution
  const systemCounts: Record<string, number> = {};
  for (const c of conditions) {
    const system = c.system.toLowerCase();
    systemCounts[system] = (systemCounts[system] || 0) + 1;
  }
  console.log('\n   System distribution:');
  for (const [system, count] of Object.entries(systemCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${system}: ${count} conditions`);
  }

  const existing = await prisma.question.count();
  console.log(`\nCurrent questions: ${existing}`);

  const TARGET = 500;
  const toGenerate = Math.max(0, TARGET - existing);
  console.log(`Target: ${TARGET}, Need to generate: ${toGenerate}`);

  if (toGenerate === 0) {
    console.log('✅ Already at target!');
    await prisma.$disconnect();
    return;
  }

  // Get existing question hashes to avoid duplicates
  const existingQuestions = await prisma.question.findMany({
    select: { question: true, vignette: true },
  });
  const existingHashes = new Set(
    existingQuestions.map((q) => `${q.vignette.substring(0, 50)}-${q.question}`.toLowerCase())
  );

  // Select conditions weighted by PANCE blueprint
  const selectedConditions = selectConditionsWeighted(conditions, toGenerate);
  console.log(`\n📋 Selected ${selectedConditions.length} conditions for question generation`);

  let created = 0;
  let failed = 0;

  for (let i = 0; i < selectedConditions.length && created < toGenerate; i++) {
    const condition = selectedConditions[i];

    console.log(`\n  🔄 [${created + 1}/${toGenerate}] ${condition.name} (${condition.system})...`);

    const data = await generateQuestion(condition);

    if (!data) {
      failed++;
      continue;
    }

    // Check for duplicate
    const hash = `${data.vignette.substring(0, 50)}-${data.question}`.toLowerCase();
    if (existingHashes.has(hash)) {
      console.log(`    ⏭️  Duplicate, skipping`);
      continue;
    }

    try {
      await prisma.question.create({
        data: {
          id: uuidv4(),
          vignette: data.vignette,
          question: data.question,
          options: data.options,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          system: data.system,
          tags: data.tags,
          difficulty: 'medium', // All questions are PANCE-level
          source: 'ai-generated',
          conditionId: condition.conditionId, // Link to Condition
          medicalContentId: condition.medicalContentId, // Link to MedicalContent
        } as any,
      });

      existingHashes.add(hash);
      created++;
      console.log(`    ✅ Created (linked to condition: ${condition.conditionId})`);
    } catch (error) {
      console.error(`    ❌ Save failed: ${error}`);
      failed++;
    }

    // Rate limiting
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Failed: ${failed}`);

  const total = await prisma.question.count();
  console.log(`   Total in database: ${total}`);

  await prisma.$disconnect();
}

main().catch(console.error);
