// scripts/generateBasicScienceLinks.ts
// Generates basic science links for clinical and lab cases using Gemini API

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ClinicalCase, LabCase, BasicScienceLink } from '../src/types/content';

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = 'gemini-2.5-pro';
const CLINICAL_CASES_FILE = path.resolve('src/data/clinicalCases.json');
const LAB_CASES_FILE = path.resolve('src/data/labCases.json');
const BATCH_SIZE = 10; // Process in batches to handle rate limits
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

// ======================================================
// API KEY
// ======================================================
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  console.error('[ERROR] Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
  console.error('   Please set your API key before running this script:');
  console.error('   export GEMINI_API_KEY=your_key_here');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

console.log(`✅ Using Gemini model: ${MODEL_NAME}`);

// ======================================================
// HELPER FUNCTIONS
// ======================================================

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean JSON response from Gemini (removes markdown code blocks)
 */
function cleanJsonResponse(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Generate basic science links for a given diagnosis
 */
async function generateBasicScienceLinks(diagnosis: string): Promise<BasicScienceLink[]> {
  const prompt = `Given the medical diagnosis "${diagnosis}", generate an array of up to 3 foundational basic science concepts that a medical student should review to understand this condition.

For each concept, provide:
1. A title in the format "Review: [Concept Name]" (e.g., "Review: The RAAS", "Review: Insulin Signaling")
2. A conceptId which is a kebab-case identifier (e.g., "raas-system", "insulin-signaling")

Focus on:
- Fundamental physiological processes
- Key biochemical pathways
- Important anatomical structures
- Core pathophysiological mechanisms

Return ONLY a valid JSON array with this structure:
[
  {
    "title": "Review: The RAAS",
    "conceptId": "raas-system"
  },
  {
    "title": "Review: Sodium Homeostasis",
    "conceptId": "sodium-homeostasis"
  }
]

Return between 1-3 concepts, prioritizing the most relevant and foundational.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanedText = cleanJsonResponse(text);

    let links;
    try {
      links = JSON.parse(cleanedText);
    } catch (parseError) {
      throw new Error(
        `JSON parse failed for "${diagnosis}". Raw response: ${cleanedText.substring(0, 200)}...`
      );
    }

    // Validate structure
    if (!Array.isArray(links)) {
      throw new Error('Response is not an array');
    }

    // Validate each link
    for (const link of links) {
      if (!link.title || !link.conceptId) {
        throw new Error('Link missing required fields: title or conceptId');
      }
    }

    // Limit to 3 links
    return links.slice(0, 3);
  } catch (error) {
    console.error(`   [WARNING]  Error generating links for "${diagnosis}":`, error);
    return []; // Return empty array on error
  }
}

/**
 * Process cases in batches
 */
async function processCasesInBatches<T extends { id: string; correctDiagnosis: string }>(
  cases: T[],
  caseType: 'clinical' | 'lab'
): Promise<T[]> {
  const updatedCases: T[] = [];
  const totalBatches = Math.ceil(cases.length / BATCH_SIZE);

  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const batch = cases.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} cases)...`);

    for (const caseItem of batch) {
      console.log(`   Generating links for: ${caseItem.correctDiagnosis}`);
      const basicScienceLinks = await generateBasicScienceLinks(caseItem.correctDiagnosis);

      updatedCases.push({
        ...caseItem,
        basicScienceLinks,
      } as T);

      console.log(`   [OK] Generated ${basicScienceLinks.length} link(s)`);
    }

    // Rate limiting between batches
    if (batchNumber < totalBatches) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  return updatedCases;
}

// ======================================================
// MAIN EXECUTION
// ======================================================

async function main() {
  try {
    console.log('\n🚀 Starting Basic Science Links Generation\n');
    console.log('='.repeat(60));

    // ======================================================
    // PROCESS CLINICAL CASES
    // ======================================================
    console.log('\n📋 PROCESSING CLINICAL CASES');
    console.log('='.repeat(60));

    if (!fs.existsSync(CLINICAL_CASES_FILE)) {
      console.error(`[ERROR] Error: Clinical cases file not found at ${CLINICAL_CASES_FILE}`);
      process.exit(1);
    }

    const clinicalCasesData = fs.readFileSync(CLINICAL_CASES_FILE, 'utf-8');
    const clinicalCases: ClinicalCase[] = JSON.parse(clinicalCasesData);
    console.log(`[INFO] Loaded ${clinicalCases.length} clinical cases`);

    const updatedClinicalCases = await processCasesInBatches<ClinicalCase>(
      clinicalCases,
      'clinical'
    );

    // Save updated clinical cases
    fs.writeFileSync(CLINICAL_CASES_FILE, JSON.stringify(updatedClinicalCases, null, 2), 'utf-8');
    console.log(`\n✅ Updated clinical cases saved to ${CLINICAL_CASES_FILE}`);

    // ======================================================
    // PROCESS LAB CASES
    // ======================================================
    console.log('\n📋 PROCESSING LAB CASES');
    console.log('='.repeat(60));

    if (!fs.existsSync(LAB_CASES_FILE)) {
      console.error(`[ERROR] Error: Lab cases file not found at ${LAB_CASES_FILE}`);
      process.exit(1);
    }

    const labCasesData = fs.readFileSync(LAB_CASES_FILE, 'utf-8');
    const labCases: LabCase[] = JSON.parse(labCasesData);
    console.log(`[INFO] Loaded ${labCases.length} lab cases`);

    const updatedLabCases = await processCasesInBatches<LabCase>(labCases, 'lab');

    // Save updated lab cases
    fs.writeFileSync(LAB_CASES_FILE, JSON.stringify(updatedLabCases, null, 2), 'utf-8');
    console.log(`\n✅ Updated lab cases saved to ${LAB_CASES_FILE}`);

    // ======================================================
    // SUMMARY
    // ======================================================
    console.log('\n' + '='.repeat(60));
    console.log('✨ GENERATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`\n[INFO] Summary:`);
    console.log(`   - Clinical cases: ${updatedClinicalCases.length} cases processed`);
    console.log(`   - Lab cases: ${updatedLabCases.length} cases processed`);
    console.log(`   - Total: ${updatedClinicalCases.length + updatedLabCases.length} cases`);

    // Count cases with links
    const clinicalWithLinks = updatedClinicalCases.filter(
      (c) => c.basicScienceLinks && c.basicScienceLinks.length > 0
    ).length;
    const labWithLinks = updatedLabCases.filter(
      (c) => c.basicScienceLinks && c.basicScienceLinks.length > 0
    ).length;

    console.log(`\n📈 Cases with basic science links:`);
    console.log(`   - Clinical: ${clinicalWithLinks}/${updatedClinicalCases.length}`);
    console.log(`   - Lab: ${labWithLinks}/${updatedLabCases.length}`);

    console.log('\n✅ All done!\n');
  } catch (error) {
    console.error('\n[ERROR] Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
