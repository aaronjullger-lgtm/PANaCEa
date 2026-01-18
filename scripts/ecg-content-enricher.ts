#!/usr/bin/env npx tsx
/**
 * ECG CONTENT ENRICHER
 *
 * Populates empty MedicalContent fields for ECG conditions using AI.
 * Specifically targets pathophysiology, clinicalPearls, boardYieldFacts, etc.
 *
 * Usage:
 *   unset GEMINI_API_KEY && npx tsx scripts/ecg-content-enricher.ts
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const MODEL_NAME = 'gemini-2.5-pro';

// Rate limiting
const RATE_LIMIT = {
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  callsBeforeCooldown: 10,
  cooldownMs: 15000,
};

let apiCallCount = 0;
let consecutiveErrors = 0;
let currentDelay = RATE_LIMIT.baseDelayMs;

async function rateLimitedDelay(): Promise<void> {
  apiCallCount++;

  // Periodic cooldown
  if (apiCallCount % RATE_LIMIT.callsBeforeCooldown === 0) {
    console.log(
      `  ⏳ Cooldown after ${apiCallCount} API calls (${RATE_LIMIT.cooldownMs / 1000}s)...`
    );
    await new Promise((r) => setTimeout(r, RATE_LIMIT.cooldownMs));
    currentDelay = RATE_LIMIT.baseDelayMs;
  } else {
    await new Promise((r) => setTimeout(r, currentDelay));
  }
}

interface ECGContent {
  pathophysiology: string;
  symptoms: string; // clinicalPresentation -> symptoms
  diagnostics: string; // diagnosticWorkup -> diagnostics
  treatment: string; // management -> treatment
  differentialDiagnosis: string; // String, not array
  clinical_pearls: string[]; // Json field
  buzzwords: string[];
  classic_patient: string;
  gold_standard_dx: string;
  first_line_rx: string;
  best_initial_test: string;
  physicalExam: string;
  complications: string;
  prognosis: string;
}

async function generateECGContent(
  conditionName: string,
  overview: string
): Promise<ECGContent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(
    `   🔑 API Key present: ${apiKey ? 'Yes (' + apiKey.substring(0, 8) + '...)' : 'NO'}`
  );

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment. Make sure .env file exists.');
    return null;
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `You are an expert PA educator specializing in ECG interpretation for the PANCE/PANRE exams.

Generate comprehensive, PANCE-exam-focused content for this ECG condition:

CONDITION: ${conditionName}
CURRENT OVERVIEW: ${overview || 'None provided'}

Generate a JSON object with these fields (all required):
{
  "pathophysiology": "Detailed mechanism explaining WHY this ECG pattern occurs. Be specific about electrical conduction abnormalities, ion channel changes, or structural issues. 2-3 paragraphs.",
  
  "symptoms": "How patients with this condition typically present. Include symptoms, vital signs, and relevant history. Format as markdown with bullet points for each symptom.",
  
  "physicalExam": "Physical examination findings. Format as markdown with bullet points.",
  
  "diagnostics": "Complete diagnostic approach including ECG criteria, labs, imaging if relevant. Be specific about what to order and why. Include specific ECG findings and measurements.",
  
  "treatment": "Treatment approach including acute management and long-term therapy. Include specific medications, doses if standard, and interventions.",
  
  "differentialDiagnosis": "Comma-separated list of 4-6 conditions that may present similarly or mimic this ECG pattern",
  
  "clinical_pearls": ["Array of 4-5 HIGH-YIELD clinical pearls that are frequently tested on boards. Focus on recognition, treatment priorities, and common pitfalls."],
  
  "buzzwords": ["Array of 3-5 pathognomonic buzzwords or classic associations for this condition"],
  
  "classic_patient": "One-sentence classic patient presentation (e.g., 'Elderly patient with palpitations and irregularly irregular pulse')",
  
  "gold_standard_dx": "Gold standard diagnostic test in < 8 words",
  
  "first_line_rx": "First-line treatment in < 8 words",
  
  "best_initial_test": "Best initial test to order",
  
  "complications": "Potential complications of this condition",
  
  "prognosis": "Expected outcomes and prognosis"
}

IMPORTANT:
- This is for PA students preparing for PANCE - content must be testable and high-yield
- ECG-specific content should be detailed enough for visual recognition practice
- Include specific diagnostic criteria and measurements in the diagnostics field
- Return ONLY valid JSON`;

  try {
    await rateLimitedDelay();
    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json\n?|```/g, '')
      .trim();
    consecutiveErrors = 0;
    return JSON.parse(text);
  } catch (err: any) {
    consecutiveErrors++;
    console.error(`   ❌ AI error: ${err.message}`);

    if (err.message?.includes('429') || err.message?.includes('rate')) {
      currentDelay = Math.min(currentDelay * 2, RATE_LIMIT.maxDelayMs);
      console.log(`   ⏳ Rate limited - increasing delay to ${currentDelay}ms`);
      await new Promise((r) => setTimeout(r, currentDelay));
    }

    return null;
  }
}

async function enrichECGConditions(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            ECG CONTENT ENRICHER                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Get all ECG conditions with their MedicalContent
  const ecgConditions = await prisma.condition.findMany({
    where: { id: { contains: 'ecg' } },
  });

  const ecgIds = ecgConditions.map((c) => c.id);
  const medicalContents = await prisma.medicalContent.findMany({
    where: { conditionId: { in: ecgIds } },
  });

  const mcMap = new Map(medicalContents.map((mc) => [mc.conditionId, mc]));

  console.log(`Found ${ecgConditions.length} ECG conditions\n`);

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (const cond of ecgConditions) {
    const mc = mcMap.get(cond.id);

    if (!mc) {
      console.log(`⚠️ ${cond.name} - No MedicalContent record (skipping)`);
      skipped++;
      continue;
    }

    // Check if already enriched (has clinical_pearls)
    const pearls = mc.clinical_pearls as any[] | null;
    if (pearls && Array.isArray(pearls) && pearls.length > 0) {
      console.log(`⏭️ ${cond.name} - Already enriched (${pearls.length} pearls)`);
      skipped++;
      continue;
    }

    console.log(`\n🔄 Enriching: ${cond.name}`);
    console.log(`   ID: ${cond.id}`);

    const content = await generateECGContent(cond.name, mc.overview || '');

    if (!content) {
      console.log(`   ❌ Failed to generate content`);
      errors++;
      continue;
    }

    // Update the MedicalContent record - using actual schema fields
    try {
      await prisma.medicalContent.update({
        where: { conditionId: cond.id },
        data: {
          pathophysiology: content.pathophysiology || mc.pathophysiology,
          symptoms: content.symptoms || mc.symptoms,
          physicalExam: content.physicalExam || mc.physicalExam,
          diagnostics: content.diagnostics || mc.diagnostics,
          treatment: content.treatment || mc.treatment,
          differentialDiagnosis: content.differentialDiagnosis || mc.differentialDiagnosis,
          clinical_pearls: content.clinical_pearls || [],
          buzzwords: content.buzzwords || [],
          classic_patient: content.classic_patient || mc.classic_patient,
          gold_standard_dx: content.gold_standard_dx || mc.gold_standard_dx,
          first_line_rx: content.first_line_rx || mc.first_line_rx,
          best_initial_test: content.best_initial_test || mc.best_initial_test,
          complications: content.complications || mc.complications,
          prognosis: content.prognosis || mc.prognosis,
          updatedBy: 'ecg-content-enricher',
          updatedAt: new Date(),
        },
      });

      console.log(`   ✅ Updated with:`);
      console.log(`      - Pathophysiology: ${content.pathophysiology?.length || 0} chars`);
      console.log(`      - Clinical Pearls: ${content.clinical_pearls?.length || 0} items`);
      console.log(`      - Buzzwords: ${content.buzzwords?.length || 0} items`);
      console.log(`      - Diagnostics: ${content.diagnostics?.length || 0} chars`);

      enriched++;
    } catch (err: any) {
      console.log(`   ❌ Update error: ${err.message}`);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Enriched: ${enriched}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log(`   Errors:   ${errors}`);
  console.log('═'.repeat(60));

  await prisma.$disconnect();
}

enrichECGConditions().catch(console.error);
