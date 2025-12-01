// scripts/generateLabContent.ts
// Generates lab cases for Mini Mode training using Gemini API
//
// KEY CONCEPT: All tests are orderable, only pertinent ones have results
// - All 300+ tests from LAB_TEST_DATABASE are orderable by the user
// - Each case includes default panels (BMP, CBC, LFT) that are always shown
// - Each case includes 3-6 "pertinent" tests that have actual results (normal or abnormal)
// - Pertinent tests are relevant to the diagnosis and appear when ordered
// - Non-pertinent tests can still be ordered but won't show results (realistic workflow)

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LabCase } from "../src/types/content";
import { parseDirtyJson } from "./utils/parseDirtyJson";
import { LAB_DRIVEN_CONDITIONS } from "../src/data/labDrivenConditions";
import { LAB_TEST_DATABASE, DEFAULT_TESTS } from "../src/data/labTests";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.0-flash-exp";
const OUTPUT_FILE = path.resolve("src/data/labCases.json");
const TARGET_CASES = 300; // Increased to cover more conditions
const BATCH_SIZE = 20; // Generate in batches to handle rate limits
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

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
// HIGH-YIELD CONDITIONS TO PRIORITIZE
// ======================================================
const HIGH_YIELD_CONDITIONS = [
  "Diabetic Ketoacidosis (DKA)",
  "SIADH (Syndrome of Inappropriate ADH)",
  "Acute Kidney Injury (AKI)",
  "Chronic Kidney Disease",
  "Acute Liver Failure",
  "Cirrhosis",
  "Hepatitis",
  "Hyperkalemia",
  "Hypokalemia",
  "Hypernatremia",
  "Hyponatremia",
  "Hypercalcemia",
  "Hypocalcemia",
  "Acute Pancreatitis",
  "Addison's Disease",
  "Cushing's Syndrome",
  "Hyperthyroidism",
  "Hypothyroidism",
  "Tumor Lysis Syndrome",
  "Rhabdomyolysis",
  "Metabolic Acidosis",
  "Metabolic Alkalosis",
  "Respiratory Acidosis",
  "Respiratory Alkalosis",
  "Acute Myocardial Infarction",
  "Sepsis",
  "Dehydration",
  "Hemolytic Anemia",
  "Iron Deficiency Anemia",
  "Vitamin B12 Deficiency",
  "Folate Deficiency",
  "Aplastic Anemia",
  "Leukemia",
  "Multiple Myeloma",
  "Polycythemia Vera",
  "Thrombocytopenia",
  "Disseminated Intravascular Coagulation (DIC)",
  "Hemophilia",
  "Von Willebrand Disease",
];

// ======================================================
// GENERATE LAB CASES
// ======================================================

// Get a random subset of conditions for this batch
function getConditionsForBatch(count: number): string[] {
  const shuffled = [...LAB_DRIVEN_CONDITIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Get list of pertinent tests that could have results for various conditions
function getPertinentTestsList(): string[] {
  // Return a curated list of commonly pertinent tests across various conditions
  // These are tests that frequently aid in diagnosis beyond the default panels
  return LAB_TEST_DATABASE
    .filter(test => {
      const category = test.category;
      // Exclude basic panels as they're always shown by default
      return category !== "Basic Panels" && 
             !test.name.includes("Basic Metabolic") &&
             !test.name.includes("Complete Blood Count") &&
             !test.name.includes("Liver Function Tests");
    })
    .map(test => test.name)
    .slice(0, 80); // Include top 80 most common diagnostic tests
}

async function generateLabCaseBatch(batchNumber: number, casesInBatch: number, retryCount = 0): Promise<LabCase[]> {
  const startId = batchNumber * casesInBatch + 1;
  const endId = (batchNumber + 1) * casesInBatch;
  const MAX_RETRIES = 3;
  
  const conditionsForBatch = getConditionsForBatch(casesInBatch);
  const pertinentTestsList = getPertinentTestsList();
  
  const prompt = `You are a medical education expert generating lab interpretation cases for PANCE preparation.

Generate exactly ${casesInBatch} unique, complex lab cases in JSON format. Each case must:
1. Focus on one of these conditions: ${conditionsForBatch.join(", ")}
2. Include a brief clinical vignette (2-3 sentences) with age, sex, chief complaint, and relevant history
3. Have at least 2-3 medically plausible abnormal lab values
4. Include the THREE default lab panels that are ALWAYS shown initially:
   - BMP (Basic Metabolic Panel): Sodium, Potassium, Chloride, Bicarbonate, BUN, Creatinine, Glucose
   - CBC (Complete Blood Count): WBC, Hemoglobin, Hematocrit, Platelets, MCV (optional)
   - LFT (Liver Function Tests): AST, ALT, Alkaline Phosphatase, Total Bilirubin, Albumin
5. Include 3-6 PERTINENT additional tests in a "pertinentResults" field. These should be:
   - Tests that are RELEVANT to the specific condition (helpful for diagnosis)
   - Can have NORMAL or ABNORMAL values (normal values are useful to rule out other conditions)
   - Selected from this list: ${pertinentTestsList.slice(0, 30).join(", ")}
   - Will be shown ONLY when the user orders them (not shown initially)
6. Each lab value must have: name, value, unit, and flag (H=High, L=Low, N=Normal)
7. Use realistic reference ranges and clinically accurate values

IMPORTANT: The "pertinentResults" field should contain tests organized by their panel/category name as the key.
For example, Arterial Blood Gas tests go under "Arterial Blood Gas", Thyroid tests under "Thyroid Function", etc.

Return ONLY a valid JSON array with the following structure (no markdown, no code blocks):
[
  {
    "id": "lab_case_${startId}",
    "correctDiagnosis": "Diabetic Ketoacidosis (DKA)",
    "clinicalVignette": "A 24-year-old male with type 1 diabetes presents to the ED with nausea, vomiting, and abdominal pain for 2 days. He reports running out of insulin 3 days ago.",
    "labs": {
      "BMP": [
        {"name": "Sodium", "value": "132", "unit": "mEq/L", "flag": "L"},
        {"name": "Potassium", "value": "5.8", "unit": "mEq/L", "flag": "H"},
        {"name": "Chloride", "value": "98", "unit": "mEq/L", "flag": "N"},
        {"name": "Bicarbonate", "value": "8", "unit": "mEq/L", "flag": "L"},
        {"name": "BUN", "value": "28", "unit": "mg/dL", "flag": "H"},
        {"name": "Creatinine", "value": "1.4", "unit": "mg/dL", "flag": "H"},
        {"name": "Glucose", "value": "485", "unit": "mg/dL", "flag": "H"}
      ],
      "CBC": [
        {"name": "WBC", "value": "14.2", "unit": "k/μL", "flag": "H"},
        {"name": "Hemoglobin", "value": "15.1", "unit": "g/dL", "flag": "N"},
        {"name": "Hematocrit", "value": "45.3", "unit": "%", "flag": "N"},
        {"name": "Platelets", "value": "285", "unit": "k/μL", "flag": "N"}
      ],
      "LFT": [
        {"name": "AST", "value": "28", "unit": "U/L", "flag": "N"},
        {"name": "ALT", "value": "32", "unit": "U/L", "flag": "N"},
        {"name": "Alkaline Phosphatase", "value": "78", "unit": "U/L", "flag": "N"},
        {"name": "Total Bilirubin", "value": "0.8", "unit": "mg/dL", "flag": "N"},
        {"name": "Albumin", "value": "4.2", "unit": "g/dL", "flag": "N"}
      ]
    },
    "pertinentResults": {
      "Arterial Blood Gas": [
        {"name": "pH", "value": "7.18", "unit": "", "flag": "L"},
        {"name": "pCO2", "value": "22", "unit": "mmHg", "flag": "L"},
        {"name": "HCO3", "value": "8", "unit": "mEq/L", "flag": "L"}
      ],
      "Ketones": [
        {"name": "Serum Ketones", "value": "5.2", "unit": "mmol/L", "flag": "H"}
      ],
      "Urinalysis": [
        {"name": "Glucose", "value": "3+", "unit": "", "flag": "H"},
        {"name": "Ketones", "value": "3+", "unit": "", "flag": "H"}
      ],
      "Anion Gap": [
        {"name": "Anion Gap", "value": "24", "unit": "mEq/L", "flag": "H"}
      ]
    }
  }
]

Generate ${casesInBatch} diverse cases. Start IDs at lab_case_${startId} and end at lab_case_${endId}.
Make sure each case uses a DIFFERENT condition from the list provided.
REMEMBER: All tests in LAB_TEST_DATABASE are orderable, but only include pertinent ones in pertinentResults.`;


  try {
    console.log(`   Generating batch ${batchNumber + 1} (cases ${batchNumber * casesInBatch + 1}-${(batchNumber + 1) * casesInBatch})...`);
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    let parsed: LabCase[];
    try {
      parsed = parseDirtyJson(text);
      
      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }
      
      // Validate structure of each case
      for (const labCase of parsed) {
        if (!labCase.id || !labCase.correctDiagnosis || !labCase.clinicalVignette || !labCase.labs) {
          throw new Error(`Invalid case structure: missing required fields`);
        }
        if (!labCase.labs.BMP || !labCase.labs.CBC || !labCase.labs.LFT) {
          throw new Error(`Invalid case structure: missing required lab panels (BMP, CBC, or LFT)`);
        }
        // pertinentResults is optional, so we don't validate its presence
        if (labCase.pertinentResults && typeof labCase.pertinentResults !== 'object') {
          throw new Error(`Invalid case structure: pertinentResults must be an object`);
        }
      }
      
      console.log(`   ✓ Successfully generated ${parsed.length} cases`);
      return parsed;
      
    } catch (parseError) {
      console.error(`   ✗ Failed to parse batch ${batchNumber + 1}`);
      console.error("   Response length:", text.length, "characters");
      console.error("   Response snippet (first 500):", text.substring(0, 500));
      console.error("   Response snippet (last 500):", text.slice(-500));
      
      if (retryCount < MAX_RETRIES) {
        console.log(`   ⟳ Retrying batch ${batchNumber + 1} (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return generateLabCaseBatch(batchNumber, casesInBatch, retryCount + 1);
      }
      
      throw new Error(`JSON parse error in batch ${batchNumber + 1}: ${parseError}`);
    }
    
  } catch (error) {
    console.error(`   ✗ Error generating batch ${batchNumber + 1}:`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`   ⟳ Retrying batch ${batchNumber + 1} (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generateLabCaseBatch(batchNumber, casesInBatch, retryCount + 1);
    }
    
    throw error;
  }
}

// ======================================================
// MAIN EXECUTION
// ======================================================
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("LAB CASES CONTENT GENERATOR");
  console.log("=".repeat(60));
  console.log(`Target: ${TARGET_CASES} unique lab cases`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Batch size: ${BATCH_SIZE} cases per batch`);
  console.log("=".repeat(60) + "\n");
  
  const allCases: LabCase[] = [];
  const numberOfBatches = Math.ceil(TARGET_CASES / BATCH_SIZE);
  
  try {
    for (let batchNum = 0; batchNum < numberOfBatches; batchNum++) {
      const casesInThisBatch = Math.min(BATCH_SIZE, TARGET_CASES - allCases.length);
      
      const batchCases = await generateLabCaseBatch(batchNum, casesInThisBatch);
      allCases.push(...batchCases);
      
      console.log(`   Progress: ${allCases.length}/${TARGET_CASES} cases generated\n`);
      
      // Delay between batches to respect rate limits
      if (batchNum < numberOfBatches - 1) {
        console.log(`   Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...\n`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write to file
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(allCases, null, 2),
      "utf-8"
    );
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ SUCCESS!");
    console.log("=".repeat(60));
    console.log(`Generated: ${allCases.length} lab cases`);
    console.log(`Saved to: ${OUTPUT_FILE}`);
    console.log(`File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
    console.log("=".repeat(60) + "\n");
    
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ GENERATION FAILED");
    console.error("=".repeat(60));
    console.error(error);
    console.error("=".repeat(60) + "\n");
    process.exit(1);
  }
}

// Run the script
main();
