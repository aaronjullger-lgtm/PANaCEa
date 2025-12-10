
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

// Load env vars explicitly
dotenv.config();

console.log("Script started: Filling placeholders (Retry)");

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.5-pro";
const OUTPUT_FILE = path.resolve("conditionContent.generated.json");
const DELAY_BETWEEN_REQUESTS = 5000; // 5 seconds to be very safe

// ======================================================
// API KEY
// ======================================================
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("[ERROR] Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  process.exit(1);
}

console.log(`Using API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

async function generateContent(conditionName: string, system: string) {
  const prompt = `
    You are a medical education expert creating content for PA students preparing for the PANCE.
    Create a comprehensive study guide entry for the condition: "${conditionName}" (System: ${system}).
    
    Return ONLY a valid JSON object with the following structure (no markdown formatting):
    {
      "overview": "1-3 sentences defining the condition.",
      "keyPoints": ["List of 3-5 high-yield facts"],
      "redFlags": ["List of 1-3 warning signs or emergencies"],
      "treatmentPearls": ["List of 1-3 treatment pearls"],
      "synonyms": ["List of synonyms if any"],
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
      "prognosis": "Brief prognosis statement."
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();
    
    // Clean up markdown code blocks if present
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error(`Failed to generate content for ${conditionName}:`);
    if (error.message) console.error(error.message);
    if (error.statusText) console.error(`Status: ${error.statusText}`);
    return null;
  }
}

async function run() {
  // Load existing content
  let contentData: any[] = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    const raw = fs.readFileSync(OUTPUT_FILE, "utf8");
    contentData = JSON.parse(raw);
  } else {
    console.error("Content file not found!");
    process.exit(1);
  }

  // Find items with placeholder content
  const pendingItems = contentData.filter(item => item.overview === "Content pending generation.");
  
  console.log(`Found ${pendingItems.length} items with pending content.`);

  let successCount = 0;

  for (const item of pendingItems) {
    // Extract system from ID (e.g. "CV__...")
    const system = item.conditionId.split("__")[0] || "General";
    
    console.log(`Generating content for: ${item.condition} (${system})...`);
    
    const generated = await generateContent(item.condition, system);
    
    if (generated) {
      // Update the item in place
      Object.assign(item, generated);
      
      successCount++;
      
      // Save incrementally
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(contentData, null, 2));
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    } else {
        console.log("Skipping due to error, waiting 10s before next...");
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  console.log(`\n✅ Generation complete! Updated ${successCount} conditions.`);
}

run().catch(console.error);
