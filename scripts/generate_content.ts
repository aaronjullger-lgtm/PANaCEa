#!/usr/bin/env tsx
/**
 * Automated Content Generator using Gemini API
 * Generates missing content sections for MedicalContent records
 */
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
  }
});

interface GenerationTask {
  recordId: string;
  conditionId: string;
  condition: string;
  system: string;
  missingFields: string[];
  existingData: any;
}

const SECTION_PROMPTS: { [key: string]: string } = {
  overview: `Write a comprehensive clinical overview (200-300 words) for {condition}, a {system} system condition. Include:
- Brief pathophysiologic mechanism
- Key clinical presentation
- Diagnostic criteria highlights
- Treatment approach overview
Use medical terminology appropriate for PA students. Format with **bold** for high-yield terms.`,

  pathophysiology: `Explain the pathophysiology of {condition} (150-250 words). Include:
- Underlying mechanism at cellular/molecular level
- Cascade of events leading to clinical manifestation
- Why specific symptoms occur
Be detailed but clear. Use **bold** for key pathophysiologic terms.`,

  etiology: `Describe the etiology of {condition} (100-200 words). Include:
- Primary causes (if known)
- Risk factors that contribute to development
- Genetic vs environmental factors
- Idiopathic considerations if applicable
Use **bold** for major etiologic factors.`,

  epidemiology: `Provide epidemiology for {condition} (100-150 words). Include:
- Prevalence/incidence rates
- Age predilection
- Gender distribution
- Geographic/ethnic variations
- Temporal trends
Use specific numbers when possible. Format with **bold** for key stats.`,

  symptoms: `List 5-8 key clinical symptoms of {condition} as a JSON array of strings. Each symptom should:
- Be concise but descriptive (1-2 sentences)
- Include qualifiers (acute/chronic, location, severity)
- Use **bold** for cardinal symptoms
- Be clinically observable or patient-reported
Format: ["Symptom 1 description", "Symptom 2 description", ...]`,

  physicalExam: `List 5-7 physical exam findings for {condition} as a JSON array of strings. Each finding should:
- Be organized by system (HEENT, CV, Resp, Abd, etc)
- Use **bold** for pathognomonic signs
- Include expected vs possible findings
- Be specific and actionable
Format: ["**System**: Finding description", ...]`,

  diagnostics: `Write diagnostic approach for {condition} (200-400 words). Include:
- Initial workup (labs, imaging)
- Gold standard diagnostic test
- Confirmatory findings
- Criteria (if applicable, e.g., Jones, Rome)
- Tests to rule out differentials
Use **bold** for key tests. Organize with headers if needed.`,

  differentialDiagnosis: `List 4-7 key differential diagnoses for {condition} as a JSON array of strings. Each should:
- Include condition name and brief distinguishing feature
- Use **bold** for the condition name
- Focus on most common/important differentials
Format: ["**Condition Name**: Distinguishing feature", ...]`,

  treatment: `Write comprehensive treatment plan for {condition} (300-500 words). Include:
### Acute/Emergency Management (if applicable)
### Pharmacotherapy
- First-line agents with **bold** drug names
- Alternatives/adjuncts
### Non-pharmacologic/Surgical interventions
Be specific with drug classes, doses, and indications.`,

  complications: `List 4-6 major complications of {condition} as a JSON array of strings. Each should:
- Be clinically significant
- Include mechanism if relevant
- Use **bold** for complication name
Format: ["**Complication**: Brief description", ...]`,

  prognosis: `Describe prognosis for {condition} (100-200 words). Include:
- Natural history if untreated
- Expected outcomes with treatment
- Factors affecting prognosis
- Mortality/morbidity rates if applicable
Use **bold** for key prognostic factors.`,

  riskFactors: `List 4-7 major risk factors for {condition} as a JSON array of strings. Each should:
- Be evidence-based
- Include relative importance
- Use **bold** for modifiable vs non-modifiable
Format: ["**Type**: Risk factor description", ...]`,

  buzzwords: `List 5-10 high-yield buzzwords/clinical pearls for {condition} as a JSON array of strings. Each should:
- Be concise (1-2 sentences max)
- Use **bold** for the key term/finding
- Be PANCE-relevant
- Focus on pathognomonic features, classic presentations, or "can't miss" associations
Format: ["**Buzzword**: Brief context", ...]`,
};

async function generateContent(task: GenerationTask, field: string): Promise<any> {
  const promptTemplate = SECTION_PROMPTS[field];
  if (!promptTemplate) {
    console.warn(`⚠️  No prompt template for field: ${field}`);
    return null;
  }

  const prompt = promptTemplate
    .replace(/{condition}/g, task.condition)
    .replace(/{system}/g, task.system);

  // Add context from existing data
  let contextPrompt = `Generate the following content for the medical condition: ${task.condition} (${task.system} system)\n\n`;
  
  if (task.existingData.overview) {
    contextPrompt += `Overview: ${task.existingData.overview.substring(0, 300)}...\n\n`;
  }
  if (task.existingData.pathophysiology) {
    contextPrompt += `Pathophysiology: ${task.existingData.pathophysiology.substring(0, 200)}...\n\n`;
  }

  contextPrompt += `Task: ${prompt}\n\nProvide ONLY the requested content with no preamble or explanation.`;

  try {
    const result = await model.generateContent(contextPrompt);
    const response = result.response;
    let text = response.text();

    // Parse JSON arrays if needed
    if (field === 'symptoms' || field === 'physicalExam' || field === 'differentialDiagnosis' || 
        field === 'complications' || field === 'riskFactors' || field === 'buzzwords') {
      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error(`Failed to parse JSON for ${field}:`, text);
          return null;
        }
      } else {
        console.error(`No JSON array found in response for ${field}`);
        return null;
      }
    }

    // Clean up markdown artifacts
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return text;
  } catch (error: any) {
    console.error(`Error generating ${field} for ${task.condition}:`, error.message);
    return null;
  }
}

async function findRecordsNeedingContent(limit: number = 10): Promise<GenerationTask[]> {
  console.log('🔍 Finding records needing content generation...\n');

  const records = await prisma.medicalContent.findMany({
    where: {
      status: {
        in: ['draft', 'pending_review']
      }
    },
    take: limit * 2 // Get more than needed to filter
  });

  const tasks: GenerationTask[] = [];

  for (const record of records) {
    const missingFields: string[] = [];

    // Check each required field
    for (const field of Object.keys(SECTION_PROMPTS)) {
      const value = record[field as keyof typeof record];
      
      if (!value || 
          (typeof value === 'string' && value.trim().length < 50) ||
          (Array.isArray(value) && value.length === 0)) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      tasks.push({
        recordId: record.id,
        conditionId: record.conditionId,
        condition: record.condition,
        system: record.system,
        missingFields,
        existingData: record
      });
    }

    if (tasks.length >= limit) break;
  }

  console.log(`   Found ${tasks.length} records needing content`);
  return tasks;
}

async function generateMissingContent(dryRun: boolean = false, limit: number = 10) {
  console.log(`📝 Generating missing content (${dryRun ? 'DRY RUN' : 'LIVE'})...\n`);

  const tasks = await findRecordsNeedingContent(limit);

  if (tasks.length === 0) {
    console.log('✅ No records need content generation!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n[${i + 1}/${tasks.length}] ${task.condition}`);
    console.log(`   Missing: ${task.missingFields.join(', ')}`);

    const updates: any = {};
    let fieldSuccessCount = 0;

    for (const field of task.missingFields) {
      try {
        console.log(`   Generating ${field}...`);
        const content = await generateContent(task, field);
        
        if (content) {
          updates[field] = content;
          fieldSuccessCount++;
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`   ❌ Failed to generate ${field}:`, error.message);
        errorCount++;
      }
    }

    if (Object.keys(updates).length > 0) {
      if (!dryRun) {
        try {
          await prisma.medicalContent.update({
            where: { id: task.recordId },
            data: {
              ...updates,
              updatedAt: new Date(),
              updatedBy: 'ai_generator'
            }
          });
          console.log(`   ✅ Updated ${fieldSuccessCount} fields`);
          successCount++;
        } catch (error: any) {
          console.error(`   ❌ Failed to save updates:`, error.message);
          errorCount++;
        }
      } else {
        console.log(`   🔍 Would update ${fieldSuccessCount} fields (dry run)`);
        successCount++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Successfully processed: ${successCount} records`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`${'='.repeat(60)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  console.log('🤖 Starting Automated Content Generator...\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit} records\n`);

  try {
    await generateMissingContent(dryRun, limit);
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
