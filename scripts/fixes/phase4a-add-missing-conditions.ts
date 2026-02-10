#!/usr/bin/env npx tsx
/**
 * Phase 4a: Add missing PANCE-blueprint conditions
 *
 * Creates Condition + MedicalContent records for each missing condition,
 * using Gemini to generate comprehensive content.
 *
 * Usage: npx tsx scripts/fixes/phase4a-add-missing-conditions.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
config({ override: true });

const DRY_RUN = process.argv.includes('--dry-run');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface NewCondition {
  name: string;
  system: string;
  subcategory: string;
}

const MISSING_CONDITIONS: NewCondition[] = [
  // DERM
  { name: 'Tinea Capitis', system: 'DERM', subcategory: 'Infectious Diseases' },
  { name: 'Tinea Cruris', system: 'DERM', subcategory: 'Infectious Diseases' },
  { name: 'DRESS Syndrome (Drug Reaction with Eosinophilia and Systemic Symptoms)', system: 'DERM', subcategory: 'Drug Reactions' },
  { name: 'Keratoacanthoma', system: 'DERM', subcategory: 'Neoplasms' },

  // ENDO
  { name: 'Secondary Adrenal Insufficiency', system: 'ENDO', subcategory: 'Adrenal Disorders' },
  { name: 'Sick Euthyroid Syndrome (Nonthyroidal Illness Syndrome)', system: 'ENDO', subcategory: 'Thyroid Disorders' },

  // GI
  { name: "Meckel's Diverticulum", system: 'GI', subcategory: 'Small Bowel Disorders' },
  { name: 'Femoral Hernia', system: 'GI', subcategory: 'Hernias' },
  { name: 'Perianal Abscess and Fistula', system: 'GI', subcategory: 'Anorectal Disorders' },

  // ID
  { name: 'West Nile Virus', system: 'ID', subcategory: 'Viral Diseases' },

  // MSK
  { name: 'Sacroiliac Joint Dysfunction', system: 'MSK', subcategory: 'Spinal Disorders' },
  { name: 'Meniscal Cyst', system: 'MSK', subcategory: 'Lower Extremity Disorders' },

  // NEURO
  { name: 'Brown-Sequard Syndrome', system: 'NEURO', subcategory: 'Spinal Disorders' },
  { name: 'Central Cord Syndrome', system: 'NEURO', subcategory: 'Spinal Disorders' },
  { name: 'Anterior Cord Syndrome', system: 'NEURO', subcategory: 'Spinal Disorders' },
  { name: 'Wernicke Encephalopathy', system: 'NEURO', subcategory: 'Cognitive Disorders' },

  // PULM
  { name: 'Lung Abscess', system: 'PULM', subcategory: 'Infectious Disorders' },

  // RENAL
  { name: 'Uremia', system: 'RENAL', subcategory: 'Chronic Kidney Disease' },

  // GU
  { name: 'Renal Colic', system: 'GU', subcategory: 'Urolithiasis' },
  { name: 'Urinary Retention', system: 'GU', subcategory: 'Bladder Disorders' },
];

async function generateContent(cond: NewCondition): Promise<any> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a medical content expert creating board-relevant content for PANCE/PANRE preparation.

Condition: ${cond.name}
System: ${cond.system}

Generate comprehensive, accurate medical content as a JSON object with these fields:

{
  "overview": "2-3 sentence definition/description",
  "epidemiology": "Prevalence, demographics, risk populations (2-3 sentences)",
  "etiology": "Causes and triggers (2-3 sentences)",
  "pathophysiology": "Mechanism of disease (2-3 sentences)",
  "riskFactors": "Key risk factors (2-3 sentences)",
  "symptoms": "Common symptoms and presentation (2-4 sentences)",
  "physicalExam": "Key physical exam findings (2-3 sentences)",
  "diagnostics": "Diagnostic workup including labs, imaging (2-3 sentences)",
  "treatment": "First-line and management approach (2-4 sentences)",
  "complications": "Potential complications (2-3 sentences)",
  "differentialDiagnosis": "Key differentials to consider (2-3 sentences)",
  "prognosis": "Expected outcomes (1-2 sentences)",
  "buzzwords": ["keyword1", "keyword2", "keyword3"],
  "first_line_rx": "First-line treatment name",
  "gold_standard_dx": "Gold standard diagnostic test",
  "best_initial_test": "Best initial test to order",
  "classic_patient": "Classic patient description (1 sentence)",
  "pance_yield": 1-5 (integer, how high-yield for PANCE)
}

Return ONLY valid JSON, no markdown.`;

  try {
    await new Promise((r) => setTimeout(r, 2000)); // Rate limit
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const first = jsonStr.indexOf('{');
    const last = jsonStr.lastIndexOf('}');
    if (first === -1 || last === -1) throw new Error('No JSON found');
    jsonStr = jsonStr.substring(first, last + 1);
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error(`  ❌ AI error: ${e.message?.substring(0, 100)}`);
    return null;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 4a: Add Missing PANCE Conditions                   ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const cond of MISSING_CONDITIONS) {
    // Check if already exists
    const existing = await prisma.medicalContent.findFirst({
      where: { condition: { equals: cond.name, mode: 'insensitive' as any } },
    });
    if (existing) {
      console.log(`  ⏭️  "${cond.name}" already exists. Skipping.`);
      skipped++;
      continue;
    }

    console.log(`  🏥 Generating: "${cond.name}" (${cond.system})...`);

    const content = await generateContent(cond);
    if (!content) {
      failed++;
      continue;
    }

    const conditionId = `${cond.system}__${cond.subcategory.toLowerCase().replace(/[^a-z0-9]/g, '_')}__${cond.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    if (!DRY_RUN) {
      try {
        // Create Condition
        await prisma.condition.create({
          data: {
            id: conditionId,
            name: cond.name,
            displayName: cond.name,
            system: cond.system,
            subcategory: cond.subcategory,
            status: 'published',
            updatedAt: new Date(),
          },
        });

        // Create MedicalContent
        await prisma.medicalContent.create({
          data: {
            id: uuidv4(),
            conditionId,
            condition: cond.name,
            system: cond.system,
            subcategory: cond.subcategory,
            status: 'published',
            version: 1,
            createdBy: 'system_phase4a',
            updatedBy: 'system_phase4a',
            updatedAt: new Date(),
            overview: content.overview || null,
            epidemiology: content.epidemiology || null,
            etiology: content.etiology || null,
            pathophysiology: content.pathophysiology || null,
            riskFactors: content.riskFactors || null,
            symptoms: content.symptoms || null,
            physicalExam: content.physicalExam || null,
            diagnostics: content.diagnostics || null,
            treatment: content.treatment || null,
            complications: content.complications || null,
            differentialDiagnosis: content.differentialDiagnosis || null,
            prognosis: content.prognosis || null,
            buzzwords: content.buzzwords || [],
            first_line_rx: content.first_line_rx || null,
            gold_standard_dx: content.gold_standard_dx || null,
            best_initial_test: content.best_initial_test || null,
            classic_patient: content.classic_patient || null,
            pance_yield: content.pance_yield || null,
          },
        });

        console.log(`  ✅ Created "${cond.name}" with all fields`);
        created++;
      } catch (e: any) {
        console.error(`  ❌ DB error for "${cond.name}": ${e.message?.substring(0, 120)}`);
        failed++;
      }
    } else {
      console.log(`  [DRY-RUN] Would create "${cond.name}"`);
      created++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Created: ${created}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Failed: ${failed}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
