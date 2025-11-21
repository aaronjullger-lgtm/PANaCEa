// scripts/generateConditionContent.ts

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Import your registry
import { CONDITION_REGISTRY } from "../conditionRegistry";

// ======================================================
// CONFIG
// ======================================================
const MODEL_NAME = "gemini-2.5-pro";
const OUTPUT_DIR = "generated";
const MAX_RETRIES = 3;

// Tune this based on rate limits
// Start with 2–3; increase only if you're not hitting quota errors
const MAX_CONCURRENCY = 3;

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

// Make sure output folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ======================================================
// ASCII CLEANER — removes ALL unicode safely
// ======================================================
function asciiClean(str: string = ""): string {
  return str
    .normalize("NFKC")
    .replace(/[“”„‟]/g, '"') // curly → "
    .replace(/[‘’‚‛]/g, "'") // curly → '
    .replace(/[–—]/g, "-") // dashes → -
    .replace(/\u00A0/g, " ") // non-breaking space
    .replace(/[^\x00-\x7F]/g, ""); // remove any remaining unicode
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
// BUILD SAFE OUTPUT PATH FOR A CONDITION
// ======================================================
function getOutputPath(rawCondition: any): { cleanName: string; outputPath: string } {
  const condition = sanitizeCondition(rawCondition);
  const cleanName = condition.condition;

  const safeId = asciiClean(
    `${condition.system}_${condition.subcategory}_${cleanName}`
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "")
  );

  const outputPath = path.join(OUTPUT_DIR, `${safeId}.md`);
  return { cleanName, outputPath };
}

// ======================================================
// GENERATE FOR ONE CONDITION (RESUME-SAFE)
// ======================================================
async function generateForCondition(rawCondition: any) {
  const condition = sanitizeCondition(rawCondition);
  const { cleanName, outputPath } = getOutputPath(condition);

  // Resume-safe: skip if file already exists
  if (fs.existsSync(outputPath)) {
    console.log(`⏩ Skipping (already exists): ${cleanName}`);
    return;
  }

  const prompt = asciiClean(`
Generate detailed medical content for the condition "${cleanName}".

Include:

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

      const streamResult = await model.generateContentStream(prompt);

      let fullText = "";
      for await (const chunk of (streamResult as any).stream) {
        const t = chunk.text();
        if (t) fullText += asciiClean(t);
      }

      fs.writeFileSync(outputPath, fullText, "utf8");
      console.log(`✅ Saved: ${outputPath}`);
      return;
    } catch (err: any) {
      console.error(`\n=================== FULL ERROR (START) ===================`);
      console.error(`Condition: ${cleanName}`);
      console.error(err);
      console.error(err?.stack);
      console.error(`==================== FULL ERROR (END) ====================\n`);

      if (attempt === MAX_RETRIES) {
        console.error(`❌ Giving up on ${cleanName}`);
        return;
      }

      // brief delay before retrying
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
}

// ======================================================
// MAIN: CONCURRENT WORKER POOL
// ======================================================
(async () => {
  console.log(`🚀 Starting ASCII-clean concurrent generator`);
  console.log(`📌 Total conditions: ${CONDITION_REGISTRY.length}`);
  console.log(`📌 Max concurrency: ${MAX_CONCURRENCY}`);
  console.log(`📂 Output dir: ${OUTPUT_DIR}\n`);

  let index = 0;
  const total = CONDITION_REGISTRY.length;

  async function worker(workerId: number) {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= total) {
        return;
      }

      const condition = CONDITION_REGISTRY[currentIndex];
      console.log(
        `👷 Worker ${workerId}: processing ${currentIndex + 1}/${total} – ${condition.condition}`
      );

      await generateForCondition(condition);
    }
  }

  // Launch worker pool
  const workers: Promise<void>[] = [];
  for (let i = 0; i < MAX_CONCURRENCY; i++) {
    workers.push(worker(i + 1));
  }

  await Promise.all(workers);

  console.log("\n🎉 All conditions processed (or skipped if already generated).");
})();
