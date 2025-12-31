/**
 * Seed Question Pool Script
 * 
 * Generates initial questions using Gemini API and seeds them into the PreGeneratedQuestion table.
 * Run this script to populate the pool before users start sessions.
 * 
 * Usage: npx tsx scripts/seed-question-pool.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SYSTEMS = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const QUESTIONS_PER_SYSTEM_DIFFICULTY = 10;

interface GeneratedQuestion {
  vignette?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  tags?: string[];
}

async function generateQuestionsWithGemini(
  apiKey: string,
  system: string,
  difficulty: string,
  count: number
): Promise<GeneratedQuestion[]> {
  const systemDescriptions: Record<string, string> = {
    CV: 'Cardiovascular system - heart, blood vessels, circulation',
    PULM: 'Pulmonary/Respiratory system - lungs, airways, breathing',
    GI: 'Gastrointestinal system - digestive tract, liver, pancreas',
    NEURO: 'Neurological system - brain, spinal cord, peripheral nerves',
    MSK: 'Musculoskeletal system - bones, joints, muscles',
    DERM: 'Dermatology - skin, hair, nails',
    HEME: 'Hematology/Oncology - blood, lymph, malignancies',
    ENDO: 'Endocrine system - hormones, thyroid, adrenal, diabetes',
    HEENT: 'Head, Eyes, Ears, Nose, Throat',
    RENAL: 'Renal/Genitourinary - kidneys, bladder, electrolytes',
    REPRO: 'Reproductive system - male and female reproductive health',
    PSYCH: 'Psychiatry - mental health, behavioral conditions',
    ID: 'Infectious Disease - bacterial, viral, fungal, parasitic',
    GU: 'Genitourinary - urinary tract, reproductive system',
  };

  const difficultyDescriptions: Record<string, string> = {
    easy: 'straightforward concepts, clear presentations, common conditions',
    medium: 'moderate complexity, some nuance required, typical PANCE-style',
    hard: 'complex cases, atypical presentations, differential diagnosis challenges',
  };

  const prompt = `Generate ${count} unique PANCE-style medical multiple choice questions for the ${system} (${systemDescriptions[system] || system}) system.

Category: general
Difficulty: ${difficulty} - ${difficultyDescriptions[difficulty] || difficulty}

Requirements:
1. Each question should have a brief clinical vignette (2-4 sentences) presenting a realistic patient scenario
2. The question stem should be clear and test clinical decision-making
3. Provide exactly 4 answer options (A, B, C, D)
4. Include one correct answer and three plausible distractors
5. The explanation should be educational and explain why the correct answer is right and why others are wrong
6. Questions should be appropriate for PA certification exam preparation

Return ONLY a JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "vignette": "Brief clinical scenario...",
    "question": "What is the most appropriate next step?",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A",
    "explanation": "Detailed explanation...",
    "tags": ["${system}", "general"]
  }
]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return [];
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
    );
  } catch (error) {
    console.error('Error generating questions with Gemini:', error);
    return [];
  }
}

async function seedPool() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    process.exit(1);
  }

  console.log('🌱 Starting question pool seeding...\n');

  // Check current pool status
  const currentCount = await prisma.preGeneratedQuestion.count({ where: { usedAt: null } });
  console.log(`📊 Current pool size: ${currentCount} unused questions\n`);

  let totalGenerated = 0;
  let totalFailed = 0;

  for (const system of SYSTEMS) {
    for (const difficulty of DIFFICULTIES) {
      // Check if we already have enough for this combination
      const existing = await prisma.preGeneratedQuestion.count({
        where: {
          system,
          difficulty,
          usedAt: null,
        },
      });

      if (existing >= QUESTIONS_PER_SYSTEM_DIFFICULTY) {
        console.log(`✅ ${system}/${difficulty}: Already has ${existing} questions, skipping`);
        continue;
      }

      const needed = QUESTIONS_PER_SYSTEM_DIFFICULTY - existing;
      console.log(`⏳ ${system}/${difficulty}: Generating ${needed} questions...`);

      try {
        const questions = await generateQuestionsWithGemini(apiKey, system, difficulty, needed);

        if (questions.length > 0) {
          const records = questions.map((q, idx) => ({
            id: `pregen-${system}-${difficulty}-${Date.now()}-${idx}`,
            questionType: 'general',
            system,
            difficulty,
            questionData: q,
            generatedAt: new Date(),
          }));

          const result = await prisma.preGeneratedQuestion.createMany({
            data: records,
            skipDuplicates: true,
          });

          console.log(`   ✓ Generated ${result.count} questions`);
          totalGenerated += result.count;
        } else {
          console.log(`   ⚠ No questions generated`);
          totalFailed += needed;
        }

        // Rate limiting - wait between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`   ❌ Error: ${error}`);
        totalFailed += needed;
      }
    }
  }

  // Final stats
  const finalCount = await prisma.preGeneratedQuestion.count({ where: { usedAt: null } });
  
  console.log('\n📊 Seeding Complete:');
  console.log(`   Total generated: ${totalGenerated}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Final pool size: ${finalCount} unused questions`);
}

// Run the seeding
seedPool()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
