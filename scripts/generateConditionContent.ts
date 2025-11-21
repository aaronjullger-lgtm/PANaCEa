// scripts/generateConditionContent.ts

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// -----------------------------
// CONFIG
// -----------------------------
const MODEL_NAME = "gemini-2.5-flash";   // << REQUIRED MODEL
const OUTPUT_DIR = "generated";
const MAX_RETRIES = 3;

// -----------------------------
// API KEY
// -----------------------------
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("❌ Missing GOOGLE_API_KEY in environment variables.");
  process.exit(1);
}

// Gemini client
const client = new GoogleGenerativeAI(apiKey);
const model = client.getGenerativeModel({ model: MODEL_NAME });

// -----------------------------
// LOAD CONDITIONS
// -----------------------------
const conditionsPath = path.join(process.cwd(), "conditionRegistry.json");

if (!fs.existsSync(conditionsPath)) {
  console.error(`❌ Could not find conditionRegistry.json at: ${conditionsPath}`);
  process.exit(1);
}

const conditions = JSON.parse(fs.readFileSync(conditionsPath, "utf8"));

// -----------------------------
// Ensure output directory exists
// -----------------------------
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// -----------------------------
// Unicode Normalization
// (Fixes your ByteString >255 error)
// -----------------------------
function normalizeText(str: string): string {
  return str.normalize("NFKC"); // Converts “smart quotes” → "normal quotes"
}

// -----------------------------
// Generate Content For One Condition
// -----------------------------
async function generateForCondition(condition: any) {
  const cleanName = normalizeText(condition.name);

  let prompt = `
You are a medical content generator for the condition "${cleanName}".

Write detailed content that includes:

- Overview of the condition
- Suicide risks
- Self-care recommendations
- Hospital treatments
- OTC treatments
- Herbal medicine options
- Notes for clinicians producing patient-friendly explanations
`;

  prompt = normalizeText(prompt);

  let attempt = 1;

  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`\n🔵 Generating content for: ${cleanName} (attempt ${attempt})`);

      // -----------------------------
      // Gemini 2.5 Flash call (correct format)
      // -----------------------------
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      let fullText = "";

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          process.stdout.write(text);
        }
      }

      const filename = path.join(OUTPUT_DIR, `${condition.id}.md`);
      fs.writeFileSync(filename, fullText, "utf8");

      console.log(`\n✅ Saved: ${filename}`);

      return;
    } catch (err: any) {
      console.error(`\n⚠ Error on attempt ${attempt}:`, err.message);

      if (attempt === MAX_RETRIES) {
        console.error("❌ Max retries reached. Skipping this condition.");
        return;
      }

      attempt++;
      await new Promise((res) => setTimeout(res, 800 * attempt));
    }
  }
}

// -----------------------------
// MAIN RUNNER
// -----------------------------
(async () => {
  console.log("🚀 Starting Offline Content Generator (Gemini 2.5 Flash)");

  for (const condition of conditions) {
    await generateForCondition(condition);
  }

  console.log("\n🎉 All conditions processed.");
})();
