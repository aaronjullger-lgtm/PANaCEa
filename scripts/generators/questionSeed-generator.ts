/**
 * QuestionSeed Generator V2
 * Creates template seeds for dynamic question generation
 * Links to MedicalContent conditions for proper database integration
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface ConditionWithContent {
  conditionId: string;
  medicalContentId: string;
  name: string;
  system: string;
  overview?: string;
  symptoms?: string[];
  treatment?: string;
}

interface QuestionSeedData {
  conditionId: string;
  medicalContentId: string;
  questionType: string;
  system: string;
  corePathology: string;
  variables: Record<string, string[]>;
  template: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  tags: string[];
}

// Question types for variety
const QUESTION_TYPES = [
  'diagnosis',
  'next-best-step',
  'first-line-treatment',
  'mechanism',
  'risk-factor',
  'complication',
  'lab-interpretation',
  'imaging-interpretation',
];

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
 * Build prompt with condition context from database
 */
function buildPrompt(condition: ConditionWithContent, questionType: string): string {
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

  return `You are a medical education expert creating question templates (seeds) for dynamic question generation.

Create a question seed template for: ${condition.name}
System: ${condition.system}
Question Type: ${questionType}
Difficulty: PANCE-level (standard board exam difficulty)
${conditionContext}

A question seed is a TEMPLATE that can generate multiple unique questions by substituting variables.

Return valid JSON:
{
  "questionType": "${questionType}",
  "system": "${condition.system}",
  "corePathology": "Brief description of the key pathology being tested",
  "variables": {
    "age": ["35-year-old", "45-year-old", "55-year-old", "65-year-old"],
    "gender": ["male", "female"],
    "symptom1": ["chest pain", "crushing chest pressure", "substernal discomfort"],
    "symptom2": ["shortness of breath", "dyspnea on exertion", "difficulty breathing"],
    "finding": ["ST elevation in leads II, III, aVF", "ST elevation in V1-V4", "ST depression in lateral leads"]
  },
  "template": "A {age} {gender} presents with {symptom1} and {symptom2}. ECG shows {finding}. What is the most likely diagnosis?",
  "correctAnswer": "Acute myocardial infarction",
  "distractors": ["Unstable angina", "Pulmonary embolism", "Pericarditis", "Aortic dissection"],
  "explanation": "The presentation of chest pain with ST elevation on ECG is classic for acute MI. The location of ST changes indicates the affected coronary territory. Unstable angina would not show ST elevation. Pericarditis shows diffuse ST elevation. PE typically shows sinus tachycardia or S1Q3T3 pattern.",
  "tags": ["${condition.system.toLowerCase()}", "${condition.name.toLowerCase().replace(/\s+/g, '-')}", "high-yield"]
}

CRITICAL:
- Variables should have 3-5 variations each
- Template uses {variableName} placeholders
- Distractors must be medically plausible
- Explanation should address all options
- Return ONLY valid JSON, no markdown`;
}

async function generateSeed(
  condition: ConditionWithContent,
  questionType: string
): Promise<QuestionSeedData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  const prompt = buildPrompt(condition, questionType);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    jsonStr = jsonStr
      .trim()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1');

    const parsed = JSON.parse(jsonStr);

    return {
      conditionId: condition.conditionId,
      medicalContentId: condition.medicalContentId,
      questionType,
      system: condition.system,
      corePathology: parsed.corePathology || condition.name,
      variables: parsed.variables || {},
      template: parsed.template,
      correctAnswer: parsed.correctAnswer,
      distractors: parsed.distractors || [],
      explanation: parsed.explanation,
      tags: parsed.tags || [condition.system.toLowerCase()],
    };
  } catch (error) {
    console.error(`    ⚠️  Error: ${error}`);
    return null;
  }
}

async function main() {
  console.log('🌱 QuestionSeed Generator V2 (Database-Linked)');
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

  const existing = await prisma.questionSeed.count();
  console.log(`\nCurrent seeds: ${existing}`);

  const TARGET = 150;
  const toGenerate = Math.max(0, TARGET - existing);
  console.log(`Target: ${TARGET}, Need to generate: ${toGenerate}`);

  if (toGenerate === 0) {
    console.log('✅ Already at target!');
    await prisma.$disconnect();
    return;
  }

  // Get existing seeds to avoid duplicates
  const existingSeeds = await prisma.questionSeed.findMany({
    select: { conditionId: true, questionType: true },
  });
  const existingKeys = new Set(existingSeeds.map((s) => `${s.conditionId}-${s.questionType}`));

  let created = 0;
  let failed = 0;

  for (const condition of conditions) {
    if (created >= toGenerate) break;

    // Create different question types for each condition
    for (const qType of QUESTION_TYPES) {
      if (created >= toGenerate) break;

      const key = `${condition.conditionId}-${qType}`;
      if (existingKeys.has(key)) continue;

      console.log(`  🔄 [${created + 1}/${toGenerate}] ${condition.name} - ${qType}...`);

      const data = await generateSeed(condition, qType);

      if (!data) {
        failed++;
        continue;
      }

      try {
        await prisma.questionSeed.create({
          data: {
            id: crypto.randomUUID(),
            conditionId: data.conditionId,
            medicalContentId: data.medicalContentId,
            questionType: data.questionType,
            system: data.system,
            corePathology: data.corePathology,
            variables: data.variables,
            template: data.template,
            correctAnswer: data.correctAnswer,
            distractors: data.distractors,
            explanation: data.explanation,
            difficulty: 'medium', // All seeds are PANCE-level
            tags: data.tags,
            updatedAt: new Date(),
          },
        });

        existingKeys.add(key);
        created++;
        console.log(`    ✅ Created (linked to: ${data.conditionId})`);
      } catch (error) {
        console.error(`    ❌ Save failed: ${error}`);
        failed++;
      }

      await new Promise((r) => setTimeout(r, 600));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Failed: ${failed}`);

  const total = await prisma.questionSeed.count();
  console.log(`   Total in database: ${total}`);

  await prisma.$disconnect();
}

main().catch(console.error);
