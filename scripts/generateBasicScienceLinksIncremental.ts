// scripts/generateBasicScienceLinksIncremental.ts
// Incremental version that respects rate limits and can resume

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BasicScienceLink } from "../src/types/content";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.5-pro";
const CONDITION_CONTENT_FILE = path.resolve("/workspaces/PANaCEa/conditionContent.correct.json");
const REQUESTS_PER_MINUTE = 8; // Stay under 10/min limit
// Add 20% buffer to account for API call processing time
const DELAY_BETWEEN_REQUESTS = Math.ceil((60000 / REQUESTS_PER_MINUTE) * 1.2); // ~9 seconds

// Type for condition content structure
interface ConditionContent {
  diagnostics?: any;
  overview?: string;
  etiologyPathophysiology?: string;
  epidemiology?: string;
  riskFactors?: string[];
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis?: string;
  basicScienceLinks?: BasicScienceLink[];
}

type ConditionsDatabase = Record<string, ConditionContent>;

// ======================================================
// API KEY
// ======================================================
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("[ERROR] Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
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
    console.error(`   [WARNING]  Error: ${error}`);
    return [];
  }
}

/**
 * Get human-readable condition name from condition ID
 */
function getConditionName(conditionId: string): string {
  // Convert condition ID like "CV__ecg__sinus_bradycardia" to "Sinus Bradycardia"
  const parts = conditionId.split("__");
  const namePart = parts[parts.length - 1];
  return namePart
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Process conditions incrementally with rate limiting
 */
async function processConditionsIncremental(
  conditions: ConditionsDatabase,
  outputFile: string
): Promise<ConditionsDatabase> {
  const conditionIds = Object.keys(conditions);
  
  // Filter conditions that need processing
  const conditionsNeedingLinks = conditionIds.filter(
    (id) => !conditions[id].basicScienceLinks || conditions[id].basicScienceLinks.length === 0
  );
  const conditionsWithLinks = conditionIds.filter(
    (id) => conditions[id].basicScienceLinks && conditions[id].basicScienceLinks.length > 0
  );

  console.log(`[INFO] Total conditions: ${conditionIds.length}`);
  console.log(`   [OK] Already have links: ${conditionsWithLinks.length}`);
  console.log(`   ⏳ Need links: ${conditionsNeedingLinks.length}`);

  if (conditionsNeedingLinks.length === 0) {
    console.log(`\n✅ All conditions already have basic science links!\n`);
    return conditions;
  }

  const estimatedMinutes = Math.ceil(
    (conditionsNeedingLinks.length * DELAY_BETWEEN_REQUESTS) / 60000
  );
  console.log(`\n⏱️  Estimated time: ~${estimatedMinutes} minutes\n`);

  let processed = 0;
  const updatedConditions = { ...conditions };

  for (const conditionId of conditionsNeedingLinks) {
    processed++;
    const progress = `[${processed}/${conditionsNeedingLinks.length}]`;
    const conditionName = getConditionName(conditionId);

    console.log(`${progress} ${conditionName} (${conditionId})`);

    const basicScienceLinks = await generateBasicScienceLinks(conditionName);

    updatedConditions[conditionId] = {
      ...updatedConditions[conditionId],
      basicScienceLinks,
    };

    console.log(`   [OK] Generated ${basicScienceLinks.length} link(s)`);

    // Save incrementally every 10 conditions
    if (processed % 10 === 0) {
      fs.writeFileSync(outputFile, JSON.stringify(updatedConditions, null, 2), "utf-8");
      console.log(`   💾 Progress saved (${processed}/${conditionsNeedingLinks.length})\n`);
    }

    // Rate limiting delay (except for last item)
    if (processed < conditionsNeedingLinks.length) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(updatedConditions, null, 2), "utf-8");
  console.log(`\n✅ All conditions processed and saved!\n`);

  return updatedConditions;
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
    // PROCESS CONDITIONS
    // ======================================================
    console.log("\n📋 PROCESSING CONDITIONS FROM DATABASE");
    console.log("=".repeat(60));

    if (!fs.existsSync(CONDITION_CONTENT_FILE)) {
      console.error(`[ERROR] Error: Condition content file not found at ${CONDITION_CONTENT_FILE}`);
      process.exit(1);
    }

    const conditionsData = fs.readFileSync(CONDITION_CONTENT_FILE, "utf-8");
    const conditions: ConditionsDatabase = JSON.parse(conditionsData);

    const updatedConditions = await processConditionsIncremental(
      conditions,
      CONDITION_CONTENT_FILE
    );

    // ======================================================
    // SUMMARY
    // ======================================================
    console.log("\n" + "=".repeat(60));
    console.log("✨ GENERATION COMPLETE!");
    console.log("=".repeat(60));

    const totalConditions = Object.keys(updatedConditions).length;
    const conditionsWithLinks = Object.keys(updatedConditions).filter(
      (id) => updatedConditions[id].basicScienceLinks && updatedConditions[id].basicScienceLinks.length > 0
    ).length;

    console.log(`\n📈 Final results:`);
    console.log(`   - Conditions: ${conditionsWithLinks}/${totalConditions} with basic science links`);
    console.log(`   - Coverage: ${((conditionsWithLinks / totalConditions) * 100).toFixed(1)}%\n`);

    console.log("✅ All done!\n");
  } catch (error) {
    console.error("\n[ERROR] Fatal error:", error);
    console.error("\n💡 You can safely re-run this script to continue from where it stopped.\n");
    process.exit(1);
  }
}

// Run the script
main();
