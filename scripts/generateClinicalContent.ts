// scripts/generateClinicalContent.ts
// Generates clinical cases for Mini Mode training using Gemini API

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ClinicalCase } from "../src/types/content";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.0-flash-exp";
const OUTPUT_FILE = path.resolve("src/data/clinicalCases.json");
const TARGET_CASES = 250;
const BATCH_SIZE = 25; // Generate in batches to handle rate limits
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
const HIGH_YIELD_NEURO_CONDITIONS = [
  "Stroke (Ischemic)",
  "Hemorrhagic Stroke",
  "Subarachnoid Hemorrhage",
  "Subdural Hematoma",
  "Epidural Hematoma",
  "Meningitis",
  "Encephalitis",
  "Guillain-Barré Syndrome",
  "Myasthenia Gravis",
  "Multiple Sclerosis",
  "Parkinson's Disease",
  "Alzheimer's Disease",
  "Seizure Disorder",
  "Status Epilepticus",
  "Migraine with Aura",
  "Cluster Headache",
  "Temporal Arteritis",
  "Bell's Palsy",
  "Trigeminal Neuralgia",
  "Peripheral Neuropathy",
];

const HIGH_YIELD_MSK_CONDITIONS = [
  "Septic Arthritis",
  "Osteomyelitis",
  "Compartment Syndrome",
  "Rheumatoid Arthritis",
  "Osteoarthritis",
  "Gout",
  "Pseudogout",
  "Ankylosing Spondylitis",
  "Lumbar Disc Herniation",
  "Spinal Stenosis",
  "Cauda Equina Syndrome",
  "Rotator Cuff Tear",
  "Carpal Tunnel Syndrome",
  "Anterior Cruciate Ligament (ACL) Tear",
  "Meniscal Tear",
  "Hip Fracture",
  "Pelvic Fracture",
  "Femoral Neck Fracture",
  "Compression Fracture",
  "Pathologic Fracture",
];

const HIGH_YIELD_CARDIAC_CONDITIONS = [
  "Acute Coronary Syndrome",
  "STEMI",
  "NSTEMI",
  "Unstable Angina",
  "Aortic Dissection",
  "Cardiac Tamponade",
  "Acute Pericarditis",
  "Endocarditis",
  "Myocarditis",
  "Hypertrophic Cardiomyopathy",
  "Dilated Cardiomyopathy",
  "Restrictive Cardiomyopathy",
  "Acute Heart Failure",
  "Atrial Fibrillation",
  "Ventricular Tachycardia",
  "Atrial Flutter",
  "Bradycardia",
  "Heart Block (Complete)",
  "Pulmonary Embolism",
  "Deep Vein Thrombosis",
];

const ALL_CONDITIONS = [
  ...HIGH_YIELD_NEURO_CONDITIONS,
  ...HIGH_YIELD_MSK_CONDITIONS,
  ...HIGH_YIELD_CARDIAC_CONDITIONS,
];

// ======================================================
// GENERATE CLINICAL CASES
// ======================================================
async function generateClinicalCaseBatch(batchNumber: number, casesInBatch: number): Promise<ClinicalCase[]> {
  const startId = batchNumber * casesInBatch + 1;
  const endId = (batchNumber + 1) * casesInBatch;
  
  const prompt = `You are a medical education expert generating clinical presentation cases for PANCE preparation.

Generate exactly ${casesInBatch} unique, complex clinical cases in JSON format. Each case must:
1. Focus on high-yield conditions from Neurology, Musculoskeletal, or Complex Cardiac presentations
2. Include a detailed clinical vignette (3-4 sentences) with patient demographics, chief complaint, history, and context
3. Include 4-6 presentation clues of different types:
   - "buzzword": Classic terminology or key phrases (e.g., "thunderclap headache", "worst headache of my life")
   - "physical_exam": Specific examination findings (e.g., "nuchal rigidity", "positive Kernig's sign")
   - "history": Historical elements or risk factors (e.g., "recent URI", "smoking history")
4. Focus on differential diagnosis skills and pattern recognition

Return ONLY a valid JSON array with the following structure (no markdown, no code blocks):
[
  {
    "id": "clinical_case_${startId}",
    "correctDiagnosis": "Subarachnoid Hemorrhage",
    "vignette": "A 52-year-old woman presents to the ED with sudden-onset severe headache that began 2 hours ago while exercising. She describes it as 'the worst headache of my life' and reports associated nausea, vomiting, and photophobia. She has no prior history of migraines.",
    "presentationClues": [
      {
        "type": "buzzword",
        "description": "Thunderclap headache - sudden, severe onset"
      },
      {
        "type": "buzzword",
        "description": "Worst headache of my life"
      },
      {
        "type": "physical_exam",
        "description": "Nuchal rigidity on examination"
      },
      {
        "type": "physical_exam",
        "description": "Photophobia present"
      },
      {
        "type": "history",
        "description": "Onset during physical exertion (Valsalva)"
      },
      {
        "type": "history",
        "description": "No prior history of similar headaches"
      }
    ]
  }
]

Generate ${casesInBatch} diverse cases covering different high-yield conditions from: ${ALL_CONDITIONS.slice(0, 15).join(", ")}, and similar conditions.
Start IDs at clinical_case_${startId} and end at clinical_case_${endId}.
Ensure each case has clinically accurate and distinctive presentation clues that would help a PA student recognize the pattern.`;

  try {
    console.log(`   Generating batch ${batchNumber + 1} (cases ${batchNumber * casesInBatch + 1}-${(batchNumber + 1) * casesInBatch})...`);
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Clean up response - remove markdown code blocks if present
    const cleanedText = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    let parsed: ClinicalCase[];
    try {
      parsed = JSON.parse(cleanedText);
      
      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }
      
      // Validate structure of each case
      for (const clinicalCase of parsed) {
        if (!clinicalCase.id || !clinicalCase.correctDiagnosis || !clinicalCase.vignette || !clinicalCase.presentationClues) {
          throw new Error(`Invalid case structure: missing required fields`);
        }
        if (!Array.isArray(clinicalCase.presentationClues) || clinicalCase.presentationClues.length < 3) {
          throw new Error(`Invalid case structure: must have at least 3 presentation clues`);
        }
        // Validate each clue
        for (const clue of clinicalCase.presentationClues) {
          if (!clue.type || !clue.description) {
            throw new Error(`Invalid clue structure: missing type or description`);
          }
          if (!['buzzword', 'physical_exam', 'history'].includes(clue.type)) {
            throw new Error(`Invalid clue type: ${clue.type}`);
          }
        }
      }
      
      console.log(`   ✓ Successfully generated ${parsed.length} cases`);
      return parsed;
      
    } catch (parseError) {
      console.error(`   ✗ Failed to parse batch ${batchNumber + 1}`);
      console.error("   Response snippet:", cleanedText.substring(0, 500));
      throw new Error(`JSON parse error in batch ${batchNumber + 1}: ${parseError}`);
    }
    
  } catch (error) {
    console.error(`   ✗ Error generating batch ${batchNumber + 1}:`, error);
    throw error;
  }
}

// ======================================================
// MAIN EXECUTION
// ======================================================
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("CLINICAL CASES CONTENT GENERATOR");
  console.log("=".repeat(60));
  console.log(`Target: ${TARGET_CASES} unique clinical cases`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Batch size: ${BATCH_SIZE} cases per batch`);
  console.log("=".repeat(60) + "\n");
  
  const allCases: ClinicalCase[] = [];
  const numberOfBatches = Math.ceil(TARGET_CASES / BATCH_SIZE);
  
  try {
    for (let batchNum = 0; batchNum < numberOfBatches; batchNum++) {
      const casesInThisBatch = Math.min(BATCH_SIZE, TARGET_CASES - allCases.length);
      
      const batchCases = await generateClinicalCaseBatch(batchNum, casesInThisBatch);
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
    console.log(`Generated: ${allCases.length} clinical cases`);
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
