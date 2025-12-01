// scripts/generateBasicScienceLinksIncremental.ts
// Incremental version that respects rate limits and can resume

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ClinicalCase, LabCase, BasicScienceLink } from "../src/types/content";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.0-flash-exp";
const CLINICAL_CASES_FILE = path.resolve("src/data/clinicalCases.json");
const LAB_CASES_FILE = path.resolve("src/data/labCases.json");
const REQUESTS_PER_MINUTE = 8; // Stay under 10/min limit
// Add 20% buffer to account for API call processing time
const DELAY_BETWEEN_REQUESTS = Math.ceil((60000 / REQUESTS_PER_MINUTE) * 1.2); // ~9 seconds

// ======================================================
// API KEY
// ======================================================
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("❌ Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  console.error("   Please set your API key before running this script:");
  console.error("   export GEMINI_API_KEY=your_key_here");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

console.log(`✅ Using Gemini model: ${MODEL_NAME}`);
console.log(`⏱️  Rate limit: ${REQUESTS_PER_MINUTE} requests/minute (${DELAY_BETWEEN_REQUESTS}ms between requests)`);

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
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
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
      throw new Error(`JSON parse failed. Raw response: ${cleanedText.substring(0, 200)}...`);
    }

    if (!Array.isArray(links)) {
      throw new Error("Response is not an array");
    }

    for (const link of links) {
      if (!link.title || !link.conceptId) {
        throw new Error("Link missing required fields: title or conceptId");
      }
    }

    return links.slice(0, 3);
  } catch (error) {
    console.error(`   ⚠️  Error: ${error}`);
    return [];
  }
}

/**
 * Process cases incrementally with rate limiting
 */
async function processCasesIncremental<T extends { id: string; correctDiagnosis: string; basicScienceLinks?: BasicScienceLink[] }>(
  cases: T[],
  caseType: "clinical" | "lab",
  outputFile: string
): Promise<T[]> {
  // Filter cases that need processing
  const casesNeedingLinks = cases.filter(
    (c) => !c.basicScienceLinks || c.basicScienceLinks.length === 0
  );
  const casesWithLinks = cases.filter(
    (c) => c.basicScienceLinks && c.basicScienceLinks.length > 0
  );

  console.log(`📊 Total cases: ${cases.length}`);
  console.log(`   ✓ Already have links: ${casesWithLinks.length}`);
  console.log(`   ⏳ Need links: ${casesNeedingLinks.length}`);

  if (casesNeedingLinks.length === 0) {
    console.log(`\n✅ All ${caseType} cases already have basic science links!\n`);
    return cases;
  }

  const estimatedMinutes = Math.ceil(
    (casesNeedingLinks.length * DELAY_BETWEEN_REQUESTS) / 60000
  );
  console.log(`\n⏱️  Estimated time: ~${estimatedMinutes} minutes\n`);

  let processed = 0;
  const updatedCases = [...cases];

  for (let i = 0; i < updatedCases.length; i++) {
    const caseItem = updatedCases[i];

    // Skip if already has links
    if (caseItem.basicScienceLinks && caseItem.basicScienceLinks.length > 0) {
      continue;
    }

    processed++;
    const progress = `[${processed}/${casesNeedingLinks.length}]`;

    console.log(`${progress} ${caseItem.correctDiagnosis}`);

    const basicScienceLinks = await generateBasicScienceLinks(caseItem.correctDiagnosis);

    updatedCases[i] = {
      ...caseItem,
      basicScienceLinks,
    };

    console.log(`   ✓ Generated ${basicScienceLinks.length} link(s)`);

    // Save incrementally every 10 cases
    if (processed % 10 === 0) {
      fs.writeFileSync(outputFile, JSON.stringify(updatedCases, null, 2), "utf-8");
      console.log(`   💾 Progress saved (${processed}/${casesNeedingLinks.length})\n`);
    }

    // Rate limiting delay (except for last item)
    if (processed < casesNeedingLinks.length) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(updatedCases, null, 2), "utf-8");
  console.log(`\n✅ All ${caseType} cases processed and saved!\n`);

  return updatedCases;
}

// ======================================================
// MAIN EXECUTION
// ======================================================

async function main() {
  try {
    console.log("\n🚀 Starting Incremental Basic Science Links Generation\n");
    console.log("=".repeat(60));
    console.log("💡 This script can be safely stopped and restarted");
    console.log("   It will resume from where it left off.\n");
    console.log("=".repeat(60));

    // ======================================================
    // PROCESS CLINICAL CASES
    // ======================================================
    console.log("\n📋 PROCESSING CLINICAL CASES");
    console.log("=".repeat(60));

    if (!fs.existsSync(CLINICAL_CASES_FILE)) {
      console.error(`❌ Error: Clinical cases file not found at ${CLINICAL_CASES_FILE}`);
      process.exit(1);
    }

    const clinicalCasesData = fs.readFileSync(CLINICAL_CASES_FILE, "utf-8");
    const clinicalCases: ClinicalCase[] = JSON.parse(clinicalCasesData);

    const updatedClinicalCases = await processCasesIncremental<ClinicalCase>(
      clinicalCases,
      "clinical",
      CLINICAL_CASES_FILE
    );

    // ======================================================
    // PROCESS LAB CASES
    // ======================================================
    console.log("\n📋 PROCESSING LAB CASES");
    console.log("=".repeat(60));

    if (!fs.existsSync(LAB_CASES_FILE)) {
      console.error(`❌ Error: Lab cases file not found at ${LAB_CASES_FILE}`);
      process.exit(1);
    }

    const labCasesData = fs.readFileSync(LAB_CASES_FILE, "utf-8");
    const labCases: LabCase[] = JSON.parse(labCasesData);

    const updatedLabCases = await processCasesIncremental<LabCase>(
      labCases,
      "lab",
      LAB_CASES_FILE
    );

    // ======================================================
    // SUMMARY
    // ======================================================
    console.log("\n" + "=".repeat(60));
    console.log("✨ GENERATION COMPLETE!");
    console.log("=".repeat(60));

    const clinicalWithLinks = updatedClinicalCases.filter(
      (c) => c.basicScienceLinks && c.basicScienceLinks.length > 0
    ).length;
    const labWithLinks = updatedLabCases.filter(
      (c) => c.basicScienceLinks && c.basicScienceLinks.length > 0
    ).length;

    console.log(`\n📈 Final results:`);
    console.log(`   - Clinical: ${clinicalWithLinks}/${updatedClinicalCases.length} cases with links`);
    console.log(`   - Lab: ${labWithLinks}/${updatedLabCases.length} cases with links`);
    console.log(`   - Total: ${clinicalWithLinks + labWithLinks}/${updatedClinicalCases.length + updatedLabCases.length} cases\n`);

    console.log("✅ All done!\n");
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    console.error("\n💡 You can safely re-run this script to continue from where it stopped.\n");
    process.exit(1);
  }
}

// Run the script
main();
