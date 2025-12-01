// scripts/testBasicScienceLinks.ts
// Test script to validate basic science link generation with a small sample

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
const TEST_OUTPUT_DIR = path.resolve("/tmp/basic-science-test");
const TEST_CASES_PER_TYPE = 3; // Test with 3 cases of each type

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

// ======================================================
// HELPER FUNCTIONS
// ======================================================

/**
 * Clean JSON response from Gemini (removes markdown code blocks)
 */
function cleanJsonResponse(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
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
      throw new Error(`JSON parse failed for "${diagnosis}". Raw response: ${cleanedText.substring(0, 200)}...`);
    }

    // Validate structure
    if (!Array.isArray(links)) {
      throw new Error("Response is not an array");
    }

    // Validate each link
    for (const link of links) {
      if (!link.title || !link.conceptId) {
        throw new Error("Link missing required fields: title or conceptId");
      }
    }

    // Limit to 3 links
    return links.slice(0, 3);
  } catch (error) {
    console.error(`   ⚠️  Error generating links for "${diagnosis}":`, error);
    return []; // Return empty array on error
  }
}

// ======================================================
// MAIN EXECUTION
// ======================================================

async function main() {
  try {
    console.log("\n🧪 Testing Basic Science Links Generation\n");
    console.log("=".repeat(60));

    // Create test output directory
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }

    // ======================================================
    // TEST CLINICAL CASES
    // ======================================================
    console.log("\n📋 TESTING CLINICAL CASES");
    console.log("=".repeat(60));

    const clinicalCasesData = fs.readFileSync(CLINICAL_CASES_FILE, "utf-8");
    const clinicalCases: ClinicalCase[] = JSON.parse(clinicalCasesData);
    const testClinicalCases = clinicalCases.slice(0, TEST_CASES_PER_TYPE);

    console.log(`📊 Testing with ${testClinicalCases.length} clinical cases\n`);

    const updatedClinicalCases = [];
    for (const caseItem of testClinicalCases) {
      console.log(`   Diagnosis: ${caseItem.correctDiagnosis}`);
      const basicScienceLinks = await generateBasicScienceLinks(caseItem.correctDiagnosis);

      console.log(`   Generated ${basicScienceLinks.length} links:`);
      for (const link of basicScienceLinks) {
        console.log(`      - ${link.title} (${link.conceptId})`);
      }
      console.log();

      updatedClinicalCases.push({
        ...caseItem,
        basicScienceLinks,
      });
    }

    // Save test output
    const clinicalOutputFile = path.join(TEST_OUTPUT_DIR, "clinicalCases-test.json");
    fs.writeFileSync(
      clinicalOutputFile,
      JSON.stringify(updatedClinicalCases, null, 2),
      "utf-8"
    );
    console.log(`✅ Test clinical cases saved to ${clinicalOutputFile}\n`);

    // ======================================================
    // TEST LAB CASES
    // ======================================================
    console.log("📋 TESTING LAB CASES");
    console.log("=".repeat(60));

    const labCasesData = fs.readFileSync(LAB_CASES_FILE, "utf-8");
    const labCases: LabCase[] = JSON.parse(labCasesData);
    const testLabCases = labCases.slice(0, TEST_CASES_PER_TYPE);

    console.log(`📊 Testing with ${testLabCases.length} lab cases\n`);

    const updatedLabCases = [];
    for (const caseItem of testLabCases) {
      console.log(`   Diagnosis: ${caseItem.correctDiagnosis}`);
      const basicScienceLinks = await generateBasicScienceLinks(caseItem.correctDiagnosis);

      console.log(`   Generated ${basicScienceLinks.length} links:`);
      for (const link of basicScienceLinks) {
        console.log(`      - ${link.title} (${link.conceptId})`);
      }
      console.log();

      updatedLabCases.push({
        ...caseItem,
        basicScienceLinks,
      });
    }

    // Save test output
    const labOutputFile = path.join(TEST_OUTPUT_DIR, "labCases-test.json");
    fs.writeFileSync(labOutputFile, JSON.stringify(updatedLabCases, null, 2), "utf-8");
    console.log(`✅ Test lab cases saved to ${labOutputFile}\n`);

    // ======================================================
    // SUMMARY
    // ======================================================
    console.log("=".repeat(60));
    console.log("✨ TEST COMPLETE!");
    console.log("=".repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   - Clinical cases tested: ${testClinicalCases.length}`);
    console.log(`   - Lab cases tested: ${testLabCases.length}`);
    console.log(`   - Test output directory: ${TEST_OUTPUT_DIR}`);

    const clinicalWithLinks = updatedClinicalCases.filter(
      (c) => c.basicScienceLinks && c.basicScienceLinks.length > 0
    ).length;
    const labWithLinks = updatedLabCases.filter(
      (c) => c.basicScienceLinks && c.basicScienceLinks.length > 0
    ).length;

    console.log(`\n📈 Cases with basic science links:`);
    console.log(`   - Clinical: ${clinicalWithLinks}/${testClinicalCases.length}`);
    console.log(`   - Lab: ${labWithLinks}/${testLabCases.length}`);

    console.log("\n✅ Test successful! Review the output files to validate quality.");
    console.log("   If satisfied, run: npm run generate:basic-science-links\n");
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
main();
