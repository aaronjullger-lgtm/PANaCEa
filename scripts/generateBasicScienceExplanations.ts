// scripts/generateBasicScienceExplanations.ts
// Generate detailed explanations for basic science concepts linked to conditions

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BasicScienceLink } from "../src/types/content";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.5-pro";
const CONDITION_CONTENT_FILE = path.resolve("/workspaces/PANaCEa/conditionContent.correct.json");
const OUTPUT_FILE = path.resolve("/workspaces/PANaCEa/basicScienceExplanations.json");
const REQUESTS_PER_MINUTE = 8; // Stay under 10/min limit
const DELAY_BETWEEN_REQUESTS = Math.ceil((60000 / REQUESTS_PER_MINUTE) * 1.2); // ~9 seconds

// ======================================================
// TYPES
// ======================================================
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

interface ConceptExplanation {
  conceptId: string;
  title: string;
  explanation: string;
  keyPoints: string[];
  clinicalRelevance: string;
  relatedConditions: string[]; // List of condition IDs that link to this concept
}

type ExplanationsDatabase = Record<string, ConceptExplanation>;

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
 * Extract all unique concepts from conditions database
 */
function extractAllConcepts(conditions: ConditionsDatabase): Map<string, { title: string; conditionIds: string[] }> {
  const conceptsMap = new Map<string, { title: string; conditionIds: string[] }>();

  for (const [conditionId, content] of Object.entries(conditions)) {
    if (content.basicScienceLinks && content.basicScienceLinks.length > 0) {
      for (const link of content.basicScienceLinks) {
        if (link.conceptId && link.title) {
          const existing = conceptsMap.get(link.conceptId);
          if (existing) {
            existing.conditionIds.push(conditionId);
          } else {
            conceptsMap.set(link.conceptId, {
              title: link.title,
              conditionIds: [conditionId],
            });
          }
        }
      }
    }
  }

  return conceptsMap;
}

/**
 * Generate explanation for a basic science concept
 */
async function generateConceptExplanation(
  conceptId: string,
  title: string,
  relatedConditionIds: string[]
): Promise<ConceptExplanation | null> {
  // Extract the concept name from the title (remove "Review: " prefix)
  const conceptName = title.replace(/^Review:\s*/i, "").trim();

  const prompt = `Generate a comprehensive educational explanation for the basic science concept: "${conceptName}"

This concept is relevant to understanding these medical conditions: ${relatedConditionIds.slice(0, 5).join(", ")}${relatedConditionIds.length > 5 ? " and others" : ""}

Provide a detailed explanation suitable for PA/medical students that includes:

1. **Explanation**: A 2-3 paragraph explanation of the concept covering:
   - Definition and fundamental principles
   - Normal physiological/anatomical/biochemical processes
   - Key mechanisms and pathways
   - How it functions in health

2. **Key Points**: 4-6 concise bullet points highlighting the most important facts to remember

3. **Clinical Relevance**: 1-2 paragraphs explaining:
   - Why this concept is important for clinical practice
   - How dysfunction of this system/process leads to disease
   - Common pathological scenarios involving this concept

Return ONLY a valid JSON object with this structure:
{
  "explanation": "Detailed 2-3 paragraph explanation...",
  "keyPoints": [
    "First key point",
    "Second key point",
    "Third key point"
  ],
  "clinicalRelevance": "1-2 paragraphs on clinical importance..."
}

Focus on clarity, accuracy, and board exam-level detail. Use proper medical terminology.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanedText = cleanJsonResponse(text);
    
    let response;
    try {
      response = JSON.parse(cleanedText);
    } catch (parseError) {
      throw new Error(`JSON parse failed. Raw response: ${cleanedText.substring(0, 200)}...`);
    }

    if (!response.explanation || !response.keyPoints || !response.clinicalRelevance) {
      throw new Error("Response missing required fields");
    }

    return {
      conceptId,
      title,
      explanation: response.explanation,
      keyPoints: response.keyPoints,
      clinicalRelevance: response.clinicalRelevance,
      relatedConditions: relatedConditionIds,
    };
  } catch (error) {
    console.error(`   [WARNING]  Error: ${error}`);
    return null;
  }
}

/**
 * Load existing explanations if they exist
 */
function loadExistingExplanations(): ExplanationsDatabase {
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const data = fs.readFileSync(OUTPUT_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.warn(`[WARNING]  Could not load existing explanations: ${error}`);
      return {};
    }
  }
  return {};
}

/**
 * Process concepts incrementally with rate limiting
 */
async function processConceptsIncremental(
  conceptsMap: Map<string, { title: string; conditionIds: string[] }>,
  existingExplanations: ExplanationsDatabase
): Promise<ExplanationsDatabase> {
  const allConceptIds = Array.from(conceptsMap.keys());
  
  // Filter concepts that need processing
  const conceptsNeedingExplanations = allConceptIds.filter(
    (id) => !existingExplanations[id] || !existingExplanations[id].explanation
  );
  const conceptsWithExplanations = allConceptIds.filter(
    (id) => existingExplanations[id] && existingExplanations[id].explanation
  );

  console.log(`[INFO] Total unique concepts: ${allConceptIds.length}`);
  console.log(`   [OK] Already have explanations: ${conceptsWithExplanations.length}`);
  console.log(`   ⏳ Need explanations: ${conceptsNeedingExplanations.length}`);

  if (conceptsNeedingExplanations.length === 0) {
    console.log(`\n✅ All concepts already have explanations!\n`);
    return existingExplanations;
  }

  const estimatedMinutes = Math.ceil(
    (conceptsNeedingExplanations.length * DELAY_BETWEEN_REQUESTS) / 60000
  );
  console.log(`\n⏱️  Estimated time: ~${estimatedMinutes} minutes\n`);

  let processed = 0;
  const updatedExplanations = { ...existingExplanations };

  for (const conceptId of conceptsNeedingExplanations) {
    processed++;
    const progress = `[${processed}/${conceptsNeedingExplanations.length}]`;
    const conceptData = conceptsMap.get(conceptId)!;

    console.log(`${progress} ${conceptData.title}`);
    console.log(`   Related to ${conceptData.conditionIds.length} condition(s)`);

    const explanation = await generateConceptExplanation(
      conceptId,
      conceptData.title,
      conceptData.conditionIds
    );

    if (explanation) {
      updatedExplanations[conceptId] = explanation;
      console.log(`   [OK] Generated explanation`);
    } else {
      console.log(`   [ERROR] Failed to generate explanation`);
    }

    // Save incrementally every 5 concepts
    if (processed % 5 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedExplanations, null, 2), "utf-8");
      console.log(`   💾 Progress saved (${processed}/${conceptsNeedingExplanations.length})\n`);
    }

    // Rate limiting delay (except for last item)
    if (processed < conceptsNeedingExplanations.length) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedExplanations, null, 2), "utf-8");
  console.log(`\n✅ All concepts processed and saved!\n`);

  return updatedExplanations;
}

// ======================================================
// MAIN EXECUTION
// ======================================================

async function main() {
  try {
    console.log("\n🚀 Starting Basic Science Explanations Generation\n");
    console.log("=".repeat(60));
    console.log("💡 This script can be safely stopped and restarted");
    console.log("   It will resume from where it left off.\n");
    console.log("=".repeat(60));

    // ======================================================
    // LOAD CONDITIONS DATABASE
    // ======================================================
    console.log("\n📋 LOADING CONDITIONS DATABASE");
    console.log("=".repeat(60));

    if (!fs.existsSync(CONDITION_CONTENT_FILE)) {
      console.error(`[ERROR] Error: Condition content file not found at ${CONDITION_CONTENT_FILE}`);
      process.exit(1);
    }

    const conditionsData = fs.readFileSync(CONDITION_CONTENT_FILE, "utf-8");
    const conditions: ConditionsDatabase = JSON.parse(conditionsData);
    console.log(`[OK] Loaded ${Object.keys(conditions).length} conditions`);

    // ======================================================
    // EXTRACT ALL CONCEPTS
    // ======================================================
    console.log("\n[INFO] EXTRACTING BASIC SCIENCE CONCEPTS");
    console.log("=".repeat(60));

    const conceptsMap = extractAllConcepts(conditions);
    console.log(`[OK] Found ${conceptsMap.size} unique concepts across all conditions`);

    if (conceptsMap.size === 0) {
      console.log("\n[WARNING]  No basic science links found in conditions database.");
      console.log("   Please run generateBasicScienceLinksIncremental.ts first.\n");
      process.exit(0);
    }

    // Show some statistics
    const conditionCounts = Array.from(conceptsMap.values())
      .map(c => c.conditionIds.length)
      .sort((a, b) => b - a);
    
    console.log(`\n📈 Concept usage statistics:`);
    console.log(`   - Most linked concept: ${conditionCounts[0]} conditions`);
    console.log(`   - Least linked concept: ${conditionCounts[conditionCounts.length - 1]} condition(s)`);
    console.log(`   - Average: ${(conditionCounts.reduce((a, b) => a + b, 0) / conditionCounts.length).toFixed(1)} conditions per concept`);

    // ======================================================
    // LOAD EXISTING EXPLANATIONS
    // ======================================================
    console.log("\n📂 CHECKING FOR EXISTING EXPLANATIONS");
    console.log("=".repeat(60));

    const existingExplanations = loadExistingExplanations();
    console.log(`[OK] Loaded ${Object.keys(existingExplanations).length} existing explanations`);

    // ======================================================
    // GENERATE EXPLANATIONS
    // ======================================================
    console.log("\n🔬 GENERATING CONCEPT EXPLANATIONS");
    console.log("=".repeat(60));

    const updatedExplanations = await processConceptsIncremental(
      conceptsMap,
      existingExplanations
    );

    // ======================================================
    // SUMMARY
    // ======================================================
    console.log("\n" + "=".repeat(60));
    console.log("✨ GENERATION COMPLETE!");
    console.log("=".repeat(60));

    const totalConcepts = conceptsMap.size;
    const conceptsWithExplanations = Object.keys(updatedExplanations).filter(
      (id) => updatedExplanations[id].explanation
    ).length;

    console.log(`\n📈 Final results:`);
    console.log(`   - Concepts: ${conceptsWithExplanations}/${totalConcepts} with explanations`);
    console.log(`   - Coverage: ${((conceptsWithExplanations / totalConcepts) * 100).toFixed(1)}%`);
    console.log(`   - Output file: ${OUTPUT_FILE}\n`);

    console.log("✅ All done!\n");
  } catch (error) {
    console.error("\n[ERROR] Fatal error:", error);
    console.error("\n💡 You can safely re-run this script to continue from where it stopped.\n");
    process.exit(1);
  }
}

// Run the script
main();
