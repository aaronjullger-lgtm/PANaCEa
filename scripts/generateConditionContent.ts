// scripts/generateConditionContent.ts
//
// Generates high-yield PANCE notes for each condition in CONDITION_REGISTRY
// using Google's Gemini 2.5 Pro model and writes them into
// src/conditionContent.generated.json.
//
// Requirements:
//   - npm install @google/genai
//   - Environment variable GEMINI_API_KEY must be set
//   - Run from repo root, e.g.:
//       npx tsx scripts/generateConditionContent.ts

import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import {
  CONDITION_REGISTRY,
  type ConditionMeta,
  buildConditionDefinition,
} from "../conditionRegistry";

// Keep this in sync with src/conditionContent.generated.(ts|json) usage
export interface ConditionContent {
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
}

type ContentMap = Record<string, ConditionContent>;

// How many *new* conditions to generate in a single run.
// Re-running the script will pick up where it left off.
const MAX_NEW_PER_RUN = 60;

// Base delay between successful requests (ms)
// 2500ms ≈ 24 calls/minute, well under your 150/min ceiling.
const BASE_DELAY_MS = 2500;

// ─────────────────────────────────────────────
// Gemini setup
// ─────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(
    "ERROR: GEMINI_API_KEY is not set.\n" +
      "Get a key from Google AI Studio and then set it, for example:\n" +
      '  export GEMINI_API_KEY="your-key-here"\n'
  );
  process.exit(1);
}

// The client picks up GEMINI_API_KEY from env (per official docs)
const ai = new GoogleGenAI({});

// Use Gemini 2.5 Pro explicitly
const MODEL_ID = "gemini-2.5-pro";

// ─────────────────────────────────────────────
// JSON file helpers
// ─────────────────────────────────────────────

const JSON_PATH = path.resolve(
  process.cwd(),
  "src/conditionContent.generated.json"
);

function loadExistingContent(): ContentMap {
  if (!fs.existsSync(JSON_PATH)) return {};
  try {
    const raw = fs.readFileSync(JSON_PATH, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as ContentMap;
  } catch (err) {
    console.error("Failed to parse existing condition content JSON:", err);
    return {};
  }
}

function saveContent(content: ContentMap) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(content, null, 2), "utf8");
  console.log(
    `\n✅ Saved content for ${Object.keys(content).length} conditions → ${JSON_PATH}`
  );
}

// ─────────────────────────────────────────────
// Prompt + generation
// ─────────────────────────────────────────────

function buildPrompt(meta: ConditionMeta): string {
  return `
You are generating concise, high-yield study notes for a Physician Assistant student preparing for the PANCE.

Condition: "${meta.condition}"
System: "${meta.system}"
Subcategory: "${meta.subcategory}"

Return ONLY valid JSON with this exact shape (no markdown, no comments, no extra text):

{
  "overview": string,
  "keyPoints": string[],
  "redFlags": string[],
  "treatmentPearls": string[]
}

Guidelines:
- overview: 1–3 sentences, clinical, PANCE-level, no fluff.
- keyPoints: 3–6 bullets with classic presentation, buzzwords, or key diagnostic clues.
- redFlags: 2–4 bullets with “must-not-miss” features or dangerous complications.
- treatmentPearls: 2–4 bullets with first-line management and big exam pearls.
- Do NOT include exact drug dosing or super niche guideline trivia.
- Focus on NCCPA/PANCE-style general principles.

Again: respond with ONLY the JSON object, nothing else.
`.trim();
}

async function generateContentForCondition(
  meta: ConditionMeta,
  attempt = 1
): Promise<ConditionContent | null> {
  const prompt = buildPrompt(meta);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      // Ask Gemini to return strict JSON
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text();
    if (!text) {
      console.warn(
        `⚠️  Empty response text for condition "${meta.condition}" – skipping.`
      );
      return null;
    }

    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      console.error(
        `⚠️  Failed to parse JSON for "${meta.condition}". Raw text:\n${text}\n`,
        err
      );
      return null;
    }

    const cleanArray = (val: unknown): string[] | undefined => {
      if (!Array.isArray(val)) return undefined;
      return val
        .map((v) => String(v).trim())
        .filter((s) => s.length > 0);
    };

    const content: ConditionContent = {
      overview:
        typeof raw.overview === "string" ? raw.overview.trim() : undefined,
      keyPoints: cleanArray(raw.keyPoints),
      redFlags: cleanArray(raw.redFlags),
      treatmentPearls: cleanArray(raw.treatmentPearls),
    };

    return content;
  } catch (err: any) {
    const status = err?.status ?? err?.error?.code;
    const raw = JSON.stringify(err);

    // Handle quota / rate limit errors with backoff + retry
    if (
      (status === 429 || raw.includes("RESOURCE_EXHAUSTED")) &&
      attempt < 4
    ) {
      const backoffMs = 15000 * attempt; // 15s, 30s, 45s...
      console.warn(
        `⏳ Quota/rate limit for "${meta.condition}" (attempt ${attempt}). ` +
          `Sleeping ${backoffMs / 1000}s then retrying...`
      );
      await sleep(backoffMs);
      return generateContentForCondition(meta, attempt + 1);
    }

    console.error(
      `❌ Error generating content for "${meta.condition}" (${meta.system} / ${meta.subcategory}):`,
      err
    );
    return null;
  }
}

// Simple throttle so we don't hammer the API
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Main driver
// ─────────────────────────────────────────────

async function main() {
  const existing = loadExistingContent();
  const contentMap: ContentMap = { ...existing };

  const allMetas: ConditionMeta[] = CONDITION_REGISTRY;

  const allWithIds = allMetas.map((meta) => {
    const def = buildConditionDefinition(meta);
    return { meta, id: def.id };
  });

  const toGenerate = allWithIds.filter(({ id }) => !contentMap[id]);

  console.log(
    `Found ${allMetas.length} conditions total.\n` +
      `${Object.keys(existing).length} already have content.\n` +
      `${toGenerate.length} remain to be generated.\n`
  );

  let i = 0;
  let generatedThisRun = 0;

  for (const { meta, id } of toGenerate) {
    if (generatedThisRun >= MAX_NEW_PER_RUN) {
      console.log(
        `\n⛳️ Reached MAX_NEW_PER_RUN (${MAX_NEW_PER_RUN}). ` +
          `Re-run the script later to keep going.`
      );
      break;
    }

    i += 1;
    console.log(
      `\n[${i}/${toGenerate.length}] Generating: ${meta.system} / ${meta.subcategory} / ${meta.condition} (${id})`
    );

    const generated = await generateContentForCondition(meta);
    if (generated) {
      contentMap[id] = generated;
      generatedThisRun += 1;
      console.log(
        `✅ Saved in-memory for "${meta.condition}" (${id}) – will write to disk at the end.`
      );
    } else {
      console.warn(
        `⚠️  Skipped "${meta.condition}" due to an error or empty response.`
      );
    }

    // Gentle throttle between *successful* requests
    await sleep(BASE_DELAY_MS);
  }

  saveContent(contentMap);
}


main().catch((err) => {
  console.error("Fatal error while generating condition content:", err);
  process.exit(1);
});
