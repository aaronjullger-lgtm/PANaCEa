// scripts/generateConditionContent.ts

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Directly import your condition registry
import { conditionRegistry as conditions } from "../conditionRegistry";

// ==========================================
// CONFIG
// ==========================================
const MODEL_NAME = "gemini-2.5-flash";
const OUTPUT_DIR = "generated";
const CONCURRENCY = 8; // Fast but safe
const MAX_RETRIES = 3;

// ==========================================
// API KEY
// ==========================================
const apiKey =
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY || // backup variable
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

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔵 [${condition.id}] Generating (attempt ${attempt})`);

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

      const outputPath = path.join(OUTPUT_DIR, `${condition.id}.md`);
      fs.writeFileSync(outputPath, fullText, "utf8");

      console.log(`✅ [${condition.id}] Saved`);
      return;
    } catch (err: any) {
      console.error(`⚠ [${condition.id}] Error: ${err.message}`);

      if (attempt === MAX_RETRIES) {
        console.error(`❌ [${condition.id}] Failed after ${MAX_RETRIES} attempts`);
        return;
      }

      await sleep(500 * attempt); // simple adaptive backoff
    }
  }
}

// ==========================================
// PARALLEL QUEUE RUNNER
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
  console.log(`🚀 Starting parallel generator using Gemini 2.5 Flash`);
  console.log(`📌 Conditions loaded: ${conditions.length}`);
  console.log(`📌 Concurrency: ${CONCURRENCY}`);

  await runInParallel(conditions, CONCURRENCY, generateForCondition);

  console.log("\n🎉 All conditions processed.");
})();
