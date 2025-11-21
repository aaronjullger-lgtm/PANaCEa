import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Correct import for your registry
import { CONDITION_REGISTRY } from "../conditionRegistry";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.5-flash";
const OUTPUT_DIR = "generated";
const MAX_RETRIES = 3;

// ======================================================
// API KEY
// ======================================================
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

// Ensure output folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ======================================================
// ASCII CLEANER — removes ALL unicode safely
// ======================================================
function asciiClean(str: string = ""): string {
  return str
    .normalize("NFKC")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\x7F]/g, "");
}

// ======================================================
// CLEAN A CONDITION ENTRY
// ======================================================
function sanitizeCondition(raw: any) {
  return {
    ...raw,
    condition: asciiClean(raw.condition),
    subcategory: asciiClean(raw.subcategory),
    system: asciiClean(raw.system),
    aliases: (raw.aliases || []).map((a: string) => asciiClean(a)),
  };
}

// ======================================================
// GENERATE FOR ONE CONDITION
// ======================================================
async function generateForCondition(rawCondition: any) {
  const condition = sanitizeCondition(rawCondition);

  const cleanName = condition.condition;

  const prompt = asciiClean(`
You are a medical content generator for the condition "${cleanName}".

Write detailed content including:

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
        if (t) fullText += asciiClean(t);
      }

      const safeId = asciiClean(
        `${condition.system}_${condition.subcategory}_${cleanName}`
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_]/g, "")
      );

      const outputPath = path.join(OUTPUT_DIR, `${safeId}.md`);
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

// ======================================================
// MAIN SEQUENTIAL LOOP
// ======================================================
(async () => {
  console.log(`🚀 Starting ASCII-clean sequential generator`);
  console.log(`📌 Total conditions: ${CONDITION_REGISTRY.length}`);

  for (const c of CONDITION_REGISTRY) {
    await generateForCondition(c);
  }

  console.log("\n🎉 All conditions processed.");
})();
