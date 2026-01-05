/**
 * Seed Question Pool Script - V2
 * 
 * Generates PANCE-style questions using Gemini API and seeds them into the PreGeneratedQuestion table.
 * Now properly links to existing Condition and MedicalContent records in the database.
 * 
 * Flow:
 * 1. Fetch conditions from MedicalContent table by system
 * 2. Generate questions for actual conditions
 * 3. Store with proper conditionId and medicalContentId links
 * 
 * Usage: npx tsx scripts/seed-question-pool.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEMS = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];
const QUESTIONS_PER_CONDITION = 2; // Questions per condition
const MIN_QUESTIONS_PER_SYSTEM = 10;

interface ConditionInfo {
  conditionId: string;
  medicalContentId: string;
  name: string;
  system: string;
  subcategory: string;
  overview?: string;
  symptoms?: string;
  treatment?: string;
}

interface GeneratedQuestion {
  vignette: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  conditionName: string;
}

/**
 * Fetch conditions from database for a given system
 */
async function getConditionsForSystem(system: string): Promise<ConditionInfo[]> {
  const medicalContent = await prisma.medicalContent.findMany({
    where: {
      system,
      status: 'published',
    },
    select: {
      id: true,
      conditionId: true,
      condition: true,
      system: true,
      subcategory: true,
      overview: true,
      symptoms: true,
      treatment: true,
    },
    take: 20, // Limit per system to keep seeding manageable
  });

  return medicalContent.map(mc => ({
    conditionId: mc.conditionId,
    medicalContentId: mc.id,
    name: mc.condition,
    system: mc.system,
    subcategory: mc.subcategory,
    overview: mc.overview || undefined,
    symptoms: mc.symptoms || undefined,
    treatment: mc.treatment || undefined,
  }));
}

/**
 * Generate questions for a specific condition using Gemini
 */
async function generateQuestionsForCondition(
  condition: ConditionInfo,
  count: number
): Promise<GeneratedQuestion[]> {
  const contextInfo = [
    condition.overview ? `Overview: ${condition.overview.slice(0, 500)}` : '',
    condition.symptoms ? `Key Symptoms: ${condition.symptoms.slice(0, 300)}` : '',
    condition.treatment ? `Treatment: ${condition.treatment.slice(0, 300)}` : '',
  ].filter(Boolean).join('\n\n');

  const prompt = `Generate ${count} unique PANCE-style medical multiple choice questions specifically about "${condition.name}" (${condition.system} system - ${condition.subcategory}).

Condition Context:
${contextInfo || 'General knowledge about this condition.'}

Requirements:
1. Each question MUST be specifically about ${condition.name}
2. Include a brief clinical vignette (2-4 sentences) presenting a realistic patient scenario
3. The question stem should test clinical decision-making (diagnosis, treatment, next step)
4. Provide exactly 4 answer options (A, B, C, D)
5. Include one correct answer and three plausible distractors
6. The explanation should be educational and reference specific features of ${condition.name}
7. Questions should be appropriate for PA certification exam preparation (PANCE-level)

Return ONLY a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "vignette": "Brief clinical scenario specific to ${condition.name}...",
    "question": "What is the most appropriate next step?",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A",
    "explanation": "Detailed explanation referencing ${condition.name}...",
    "conditionName": "${condition.name}"
  }
]`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      console.error('No text in Gemini response');
      return [];
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const questions = JSON.parse(jsonText);
    
    if (!Array.isArray(questions)) {
      console.error('Invalid questions format - not an array');
      return [];
    }

    return questions.filter((q: GeneratedQuestion) => 
      q.question && 
      Array.isArray(q.options) && 
      q.options.length === 4 &&
      q.correctAnswer &&
      q.explanation
    ).map(q => ({
      ...q,
      conditionName: condition.name, // Ensure condition name is set
    }));
  } catch (error) {
    console.error('Error generating questions with Gemini:', error);
    return [];
  }
}

/**
 * Generate a unique question ID
 */
function generateQuestionId(system: string): string {
  const uuid = crypto.randomUUID();
  return `q-${system.toLowerCase()}-${uuid}`;
}

async function seedPool() {
  console.log('🌱 Starting question pool seeding (V2 - with condition linking)...\n');

  // Check current pool status
  const currentCount = await prisma.preGeneratedQuestion.count({ where: { usedAt: null } });
  console.log(`📊 Current pool size: ${currentCount} unused questions\n`);

  let totalGenerated = 0;
  let totalFailed = 0;
  let totalConditions = 0;

  for (const system of SYSTEMS) {
    console.log(`\n📋 Processing ${system} system...`);

    // Get conditions from database
    const conditions = await getConditionsForSystem(system);
    
    if (conditions.length === 0) {
      console.log(`   ⚠ No published conditions found for ${system}, skipping`);
      continue;
    }

    console.log(`   Found ${conditions.length} conditions`);
    totalConditions += conditions.length;

    // Check existing questions for this system
    const existing = await prisma.preGeneratedQuestion.count({
      where: {
        system,
        usedAt: null,
      },
    });

    if (existing >= MIN_QUESTIONS_PER_SYSTEM) {
      console.log(`   ✅ Already has ${existing} questions, skipping`);
      continue;
    }

    // Generate questions for each condition
    for (const condition of conditions) {
      // Check if we already have questions for this condition
      const conditionQuestions = await prisma.preGeneratedQuestion.count({
        where: {
          conditionId: condition.conditionId,
          usedAt: null,
        },
      });

      if (conditionQuestions >= QUESTIONS_PER_CONDITION) {
        console.log(`   ⏭ ${condition.name}: Already has ${conditionQuestions} questions`);
        continue;
      }

      const needed = QUESTIONS_PER_CONDITION - conditionQuestions;
      console.log(`   ⏳ ${condition.name}: Generating ${needed} questions...`);

      try {
        const questions = await generateQuestionsForCondition(condition, needed);

        if (questions.length > 0) {
          const records = questions.map((q) => ({
            id: generateQuestionId(system),
            questionType: 'general',
            system,
            conditionId: condition.conditionId,
            medicalContentId: condition.medicalContentId,
            difficulty: 'medium', // PANCE-level
            questionData: {
              vignette: q.vignette,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              conditionName: condition.name,
              system: system,
              subcategory: condition.subcategory,
              tags: [system, condition.subcategory, condition.name].filter(Boolean),
            } as unknown as Prisma.InputJsonValue,
            generatedAt: new Date(),
          }));

          const result = await prisma.preGeneratedQuestion.createMany({
            data: records,
            skipDuplicates: true,
          });

          console.log(`      ✓ Created ${result.count} questions (linked to ${condition.name})`);
          totalGenerated += result.count;
        } else {
          console.log(`      ⚠ No questions generated`);
          totalFailed += needed;
        }

        // Rate limiting - wait between API calls
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(`      ❌ Error: ${error}`);
        totalFailed += needed;
      }
    }
  }

  // Final stats
  const finalCount = await prisma.preGeneratedQuestion.count({ where: { usedAt: null } });
  const linkedCount = await prisma.preGeneratedQuestion.count({ 
    where: { 
      usedAt: null,
      conditionId: { not: null },
    } 
  });
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Seeding Complete:');
  console.log(`   Conditions processed: ${totalConditions}`);
  console.log(`   Questions generated: ${totalGenerated}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Final pool size: ${finalCount} unused questions`);
  console.log(`   Questions with condition links: ${linkedCount}`);
}

// Run the seeding
seedPool()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
