import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Correct import from your registry:
import { CONDITION_REGISTRY as conditions } from "../conditionRegistry";

// ================================
// CONFIG
// ================================
const MODEL_NAME = "gemini-2.5-flash";
const OUTPUT_DIR = "generated";
const MAX_RETRIES = 3;

// ================================
// API KEY
// ================================
const apiKey =
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

if (!apiKey) {
  console.error("❌ Missing GOOGLE_API_KEY or GEMINI_API_KEY");
  process.exit(1);
}

const client = new GoogleGenerativeAI(apiKey);
const model = client.getGenerativeModel({ model: MODEL_NAME });

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ================================
// UNICODE SANITIZER — Fixes ByteString crash
// ================================
function asciiClean(str: string = ""): string {
  return str
    .normalize("NFKC")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/[^\x00-\x7F]/g, " "); // removes any remaining non-ASCII chars
}

// ================================
// GENERATE CONTENT (SEQUENTIAL)
// ================================
async function generateForCondition(condition: any) {
  const cleanName = asciiClean(condition.condition || condition.name);

  let prompt = asciiClean(`
You are a medical content generator for the condition "${cleanName}".

Write detailed content that includes:

- Overview of the condition
- Suicide risks
- Self-care recommendations
- Hospital treatments
- OTC treatments
- Herbal medicine options
- Notes for clinicians producing patient-friendly explanations
`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔵 Generating: ${cleanName} (attempt ${attempt})`);

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
        const t = chunk.text();
        if (t) fullText += t;
      }

      const id = asciiClean(
        condition.id ||
          `${condition.system}_${condition.subcategory}_${cleanName}`
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9_]/g, "")
      );

      const outputPath = path.join(OUTPUT_DIR, `${id}.md`);
      fs.writeFileSync(outputPath, fullText, "utf8");

      console.log(`✅ Saved: ${outputPath}`);
      return;
    } catch (err: any) {
      console.error(`⚠ Error on ${cleanName}: ${err.message}`);

      if (attempt === MAX_RETRIES) {
        console.error(`❌ Giving up on ${cleanName}`);
        return;
      }
    }
  }
}

// ================================
// MAIN LOOP (SEQUENTIAL)
// ================================
(async () => {
  console.log(`🚀 Starting sequential generator`);
  console.log(`📌 Total conditions: ${conditions.length}`);

  for (const cond of conditions) {
    await generateForCondition(cond);
  }

  console.log("\n🎉 Done — all sequential tasks completed.");
})();
