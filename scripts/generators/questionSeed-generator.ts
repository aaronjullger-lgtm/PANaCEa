/**
 * QuestionSeed Generator
 * Creates template seeds for dynamic question generation
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface QuestionSeedData {
  conditionId: string;
  questionType: string;
  system: string;
  corePathology: string;
  variables: Record<string, string[]>;
  template: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  difficulty: string;
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
  'imaging-interpretation'
];

const PROMPT_TEMPLATE = `You are a medical education expert creating question templates (seeds) for dynamic question generation.

Create a question seed template for: {{CONDITION}}
System: {{SYSTEM}}
Question Type: {{QUESTION_TYPE}}

A question seed is a TEMPLATE that can generate multiple unique questions by substituting variables.

Return valid JSON:
{
  "questionType": "{{QUESTION_TYPE}}",
  "system": "{{SYSTEM}}",
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
  "difficulty": "medium",
  "tags": ["cardiology", "ECG", "acute-coronary-syndrome", "high-yield"]
}

CRITICAL:
- Variables should have 3-5 variations each
- Template uses {variableName} placeholders
- Distractors must be medically plausible
- Explanation should address all options
- Return ONLY valid JSON, no markdown`;

async function generateSeed(condition: { id: string; name: string; system: string }, questionType: string): Promise<QuestionSeedData | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const prompt = PROMPT_TEMPLATE
    .replace(/{{CONDITION}}/g, condition.name)
    .replace(/{{SYSTEM}}/g, condition.system)
    .replace(/{{QUESTION_TYPE}}/g, questionType);
  
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
      conditionId: condition.id,
      questionType,
      system: condition.system,
      corePathology: parsed.corePathology || condition.name,
      variables: parsed.variables || {},
      template: parsed.template,
      correctAnswer: parsed.correctAnswer,
      distractors: parsed.distractors || [],
      explanation: parsed.explanation,
      difficulty: parsed.difficulty || 'medium',
      tags: parsed.tags || [condition.system.toLowerCase()]
    };
  } catch (error) {
    console.error(`    ⚠️  Error: ${error}`);
    return null;
  }
}

async function main() {
  console.log('🌱 QuestionSeed Generator');
  console.log('═'.repeat(60));
  
  const existing = await prisma.questionSeed.count();
  console.log(`Current seeds: ${existing}`);
  
  const TARGET = 150;
  const toGenerate = Math.max(0, TARGET - existing);
  console.log(`Target: ${TARGET}, Need to generate: ${toGenerate}`);
  
  if (toGenerate === 0) {
    console.log('✅ Already at target!');
    await prisma.$disconnect();
    return;
  }
  
  // Get high-yield conditions to create seeds from (conditions with content)
  const conditions = await prisma.condition.findMany({
    where: { status: 'published' },
    select: { id: true, name: true, system: true },
    take: 100
  });
  
  console.log(`Found ${conditions.length} high-yield conditions`);
  
  // Get existing seeds to avoid duplicates
  const existingSeeds = await prisma.questionSeed.findMany({
    select: { conditionId: true, questionType: true }
  });
  const existingKeys = new Set(existingSeeds.map(s => `${s.conditionId}-${s.questionType}`));
  
  let created = 0;
  let failed = 0;
  
  for (const condition of conditions) {
    if (created >= toGenerate) break;
    
    // Create different question types for each condition
    for (const qType of QUESTION_TYPES) {
      if (created >= toGenerate) break;
      
      const key = `${condition.id}-${qType}`;
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
            questionType: data.questionType,
            system: data.system,
            corePathology: data.corePathology,
            variables: data.variables,
            template: data.template,
            correctAnswer: data.correctAnswer,
            distractors: data.distractors,
            explanation: data.explanation,
            difficulty: data.difficulty,
            tags: data.tags,
            updatedAt: new Date()
          }
        });
        
        existingKeys.add(key);
        created++;
        console.log(`    ✅ Created`);
      } catch (error) {
        console.error(`    ❌ Save failed: ${error}`);
        failed++;
      }
      
      await new Promise(r => setTimeout(r, 600));
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
