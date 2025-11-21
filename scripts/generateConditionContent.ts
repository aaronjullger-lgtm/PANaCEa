// scripts/generateConditionContent.ts

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ✅ Correct import based on your registry structure
import { CONDITION_REGISTRY as conditions } from "../conditionRegistry";

// ==========================================
// CONFIG
// ==========================================
const MODEL_NAME = "gemini-2.5-flash";
const OUTPUT_DIR = "generated";
const CONCURRENCY = 8; // parallel tasks
const MAX_RETRIES = 3;

// ==========================================
// API KEY
// ==========================================
const apiKey =
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

if (!apiKey) {
  console.error("❌ Missing GOOGLE_API_KEY (or GEMINI_API_KEY).");
  process.exit(1);
}

const client = new GoogleGenerativeAI(apiKey);
const model = client.getGenerativeModel({ model: MODEL_NAME });

// Ensure output folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ==========================================
// HELPERS
// ==========================================
function normalizeText(str: string): string {
  return str.normalize("NFKC"); // fixes Unicode >255 issues
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================
// GENERATE CONTENT FOR ONE CONDITION
// ==========================================
async function generateForCondition(condition: any) {
  const cleanName = normalizeText(condition.condition ?? condition.name);

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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔵 [${condition.condition}] Generating (attempt ${attempt})`);

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
        }
      }

      const id =
        condition.id ||
        `${condition.system}__${condition.subcategory}__${cleanName.replace(
          /\s+/g,
          "_"
        )}`;

      const outputPath = path.join(OUTPUT_DIR, `${id}.md`);
      fs.writeFileSync(outputPath, fullText, "utf8");

      console.log(`✅ [${id}] Saved`);
      return;
    } catch (err: any) {
      console.error(`⚠ [${cleanName}] Error: ${err.message}`);

      if (attempt === MAX_RETRIES) {
        console.error(`❌ [${cleanName}] Failed after ${MAX_RETRIES} attempts`);
        return;
      }

      await sleep(500 * attempt); // simple adaptive backoff
    }
  }
}

// ==========================================
// PARALLEL EXECUTION QUEUE
// ==========================================
async function runInParallel(items: any[], limit: number, worker: Function) {
  const queue = [...items];
  const active: Promise<void>[] = [];

  async function startNext() {
    if (queue.length === 0) return;

    const item = queue.shift();
    const p = worker(item).finally(() => {
      active.splice(active.indexOf(p), 1);
    });

    active.push(p);

    if (active.length < limit) startNext();

    await p;
    startNext();
  }

  for (let i = 0; i < limit && i < items.length; i++) {
    startNext();
  }

  while (active.length > 0) {
    await Promise.race(active);
  }
}

// ==========================================
// MAIN
// ==========================================
(async () => {
  console.log(`🚀 Starting generator (Gemini 2.5 Flash)`);
  console.log(`📌 Loaded ${conditions.length} conditions`);
  console.log(`📌 Concurrency: ${CONCURRENCY}`);

  await runInParallel(conditions, CONCURRENCY, generateForCondition);

  console.log("\n🎉 All conditions processed.");
})();
