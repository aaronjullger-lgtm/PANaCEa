
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONDITION_REGISTRY_ADDITIONAL } from "../conditionRegistry";

console.log("Script started");

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.0-flash-exp";
const OUTPUT_FILE = path.resolve("conditionContent.generated.json");
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

// ======================================================
// API KEY
// ======================================================
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("[ERROR] Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// ======================================================
// HELPERS
// ======================================================
function toSlug(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildConditionId(system: string, subcategory: string, condition: string): string {
  return `${system}__${toSlug(subcategory)}__${toSlug(condition)}`;
}

async function generateContent(conditionName: string, system: string) {
  const prompt = `
    You are a medical education expert creating content for PA students preparing for the PANCE.
    Create a comprehensive study guide entry for the condition: "${conditionName}" (System: ${system}).
    
    Return ONLY a valid JSON object with the following structure (no markdown formatting):
    {
      "overview": "1-3 sentences defining the condition.",
      "etiologyPathophysiology": "Brief explanation of causes and mechanism.",
      "epidemiology": "Who gets it? (Age, gender, risk factors).",
      "riskFactors": ["List of 3-5 key risk factors"],
      "clinicalPresentation": "Typical patient presentation.",
      "symptoms": ["List of key symptoms"],
      "examFindings": ["List of key physical exam findings"],
      "diagnostics": {
        "notes": "Gold standard test and other relevant labs/imaging."
      },
      "treatment": ["First-line treatment", "Second-line/alternatives"],
      "management": ["Long-term management or lifestyle changes"],
      "complications": ["Potential complications"],
      "prognosis": "Brief prognosis statement.",
      "basicScienceLinks": []
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();
    
    // Clean up markdown code blocks if present
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error(`Failed to generate content for ${conditionName}:`, error);
    return null;
  }
}

async function run() {
  console.log(`🚀 Starting content generation for ${CONDITION_REGISTRY_ADDITIONAL.length} new conditions...`);
  
  // Load existing content
  let existingContent: any = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    existingContent = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
  }

  let successCount = 0;

  for (const item of CONDITION_REGISTRY_ADDITIONAL) {
    const id = buildConditionId(item.system, item.subcategory, item.condition);
    
    if (existingContent[id]) {
      console.log(`⏭️  Skipping ${item.condition} (already exists)`);
      continue;
    }

    console.log(`Generating content for: ${item.condition}...`);
    
    const content = await generateContent(item.condition, item.system);
    
    if (content) {
      existingContent[id] = content;
      successCount++;
      
      // Save incrementally
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingContent, null, 2));
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }

  console.log(`\n✅ Generation complete! Added ${successCount} new conditions.`);
}

run().catch(console.error);
