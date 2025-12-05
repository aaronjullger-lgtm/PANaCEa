// scripts/testContentGeneration.ts
// Test script to verify content generation works with a small sample

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LabCase, ClinicalCase } from "../src/types/content";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.0-flash-exp";
const TEST_CASES = 2; // Generate just 2 cases for testing

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

console.log(`✅ Using Gemini model: ${MODEL_NAME}\n`);

// ======================================================
// TEST LAB CASE GENERATION
// ======================================================
async function testLabGeneration(): Promise<void> {
  console.log("Testing Lab Case Generation...");
  console.log("=".repeat(50));
  
  const prompt = `You are a medical education expert generating lab interpretation cases for PANCE preparation.

Generate exactly ${TEST_CASES} unique, complex lab cases in JSON format. Each case must:
1. Focus on a high-yield condition like DKA, SIADH, or AKI
2. Include a brief clinical vignette (2-3 sentences)
3. Have at least 2-3 medically plausible abnormal lab values
4. Include all three lab panels: BMP, CBC, and LFT
5. Each lab value must have: name, value, unit, and flag (H=High, L=Low, N=Normal)

Return ONLY a valid JSON array (no markdown, no code blocks):
[
  {
    "id": "test_lab_1",
    "correctDiagnosis": "Diabetic Ketoacidosis",
    "clinicalVignette": "A 24-year-old male with type 1 diabetes presents to the ED with nausea, vomiting, and abdominal pain for 2 days.",
    "labs": {
      "BMP": [
        {"name": "Glucose", "value": "485", "unit": "mg/dL", "flag": "H"},
        {"name": "Sodium", "value": "132", "unit": "mEq/L", "flag": "L"}
      ],
      "CBC": [
        {"name": "WBC", "value": "14.2", "unit": "k/μL", "flag": "H"}
      ],
      "LFT": [
        {"name": "AST", "value": "28", "unit": "U/L", "flag": "N"}
      ]
    }
  }
]`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const cleanedText = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const parsed: LabCase[] = JSON.parse(cleanedText);
    
    console.log(`[OK] Generated ${parsed.length} lab cases`);
    console.log("\nSample Lab Case:");
    console.log(JSON.stringify(parsed[0], null, 2));
    console.log("\n✅ Lab generation test PASSED!\n");
    
  } catch (error) {
    console.error("[ERROR] Lab generation test FAILED:", error);
    throw error;
  }
}

// ======================================================
// TEST CLINICAL CASE GENERATION
// ======================================================
async function testClinicalGeneration(): Promise<void> {
  console.log("Testing Clinical Case Generation...");
  console.log("=".repeat(50));
  
  const prompt = `You are a medical education expert generating clinical presentation cases for PANCE preparation.

Generate exactly ${TEST_CASES} unique clinical cases in JSON format. Each case must:
1. Focus on a high-yield neurological or cardiac condition
2. Include a detailed clinical vignette (3-4 sentences)
3. Include 4-6 presentation clues with types: buzzword, physical_exam, or history

Return ONLY a valid JSON array (no markdown, no code blocks):
[
  {
    "id": "test_clinical_1",
    "correctDiagnosis": "Subarachnoid Hemorrhage",
    "vignette": "A 52-year-old woman presents to the ED with sudden-onset severe headache.",
    "presentationClues": [
      {
        "type": "buzzword",
        "description": "Thunderclap headache"
      },
      {
        "type": "physical_exam",
        "description": "Nuchal rigidity"
      }
    ]
  }
]`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    const cleanedText = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const parsed: ClinicalCase[] = JSON.parse(cleanedText);
    
    console.log(`[OK] Generated ${parsed.length} clinical cases`);
    console.log("\nSample Clinical Case:");
    console.log(JSON.stringify(parsed[0], null, 2));
    console.log("\n✅ Clinical generation test PASSED!\n");
    
  } catch (error) {
    console.error("[ERROR] Clinical generation test FAILED:", error);
    throw error;
  }
}

// ======================================================
// MAIN
// ======================================================
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("CONTENT GENERATION TEST SUITE");
  console.log("=".repeat(60) + "\n");
  
  try {
    await testLabGeneration();
    await testClinicalGeneration();
    
    console.log("=".repeat(60));
    console.log("✅ ALL TESTS PASSED!");
    console.log("=".repeat(60));
    console.log("\nYou can now run the full generation scripts:");
    console.log("  npm run generate:lab");
    console.log("  npm run generate:clinical\n");
    
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("[ERROR] TEST SUITE FAILED");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  }
}

main();
