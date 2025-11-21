// scripts/generateConditionContent.ts

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import {
  CONDITION_REGISTRY,
  type ConditionMeta,
} from "../src/conditionRegistry";

// Keep this in sync with src/conditionContent.generated.ts
export interface ConditionContent {
  overview?: string;
  keyPoints?: string[];
  redFlags?: string[];
  treatmentPearls?: string[];
}

type ContentMap = Record<string, ConditionContent>;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Where the JSON lives
const JSON_PATH = path.resolve(
  __dirname,
  "../src/conditionContent.generated.json"
);

function loadExistingContent(): ContentMap {
  if (!fs.existsSync(JSON_PATH)) {
    return {};
  }
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
    `Saved content for ${Object.keys(content).length} conditions → ${JSON_PATH}`
  );
}

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
- Do NOT include dosing numbers or country-specific guideline trivia.
- Focus on NCCPA/PANCE-style general principles, not rare edge cases.

Again: respond with ONLY the JSON object, nothing else.
`;
}

async function generateContentForCondition(
  meta: ConditionMeta
): Promise<ConditionContent | null> {
  const prompt = buildPrompt(meta);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a concise, accurate medical study-note writer for PA students preparing for the PANCE.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(raw) as ConditionContent;
    return parsed;
  } catch (err) {
    console.error(
      `JSON parse error for condition "${meta.condition}". Raw content:`,
      raw
    );
    return null;
  }
}

async function main() {
  const existing = loadExistingContent();
  const updated: ContentMap = { ...existing };

  const allConditions = CONDITION_REGISTRY;
  console.log(`Total conditions in registry: ${allConditions.length}`);

  // You can temporarily limit this for testing, e.g. `slice(0, 20)`
  for (const meta of allConditions) {
    const key = meta.condition;

    if (updated[key]) {
      // Already have content, skip
      continue;
    }

    console.log(`Generating content for: ${key} (${meta.system} / ${meta.subcategory})`);

    try {
      const generated = await generateContentForCondition(meta);
      if (!generated) {
        console.warn(`Skipping "${key}" due to generation/parse failure.`);
        continue;
      }

      updated[key] = generated;
      saveContent(updated);

      // Small delay to avoid hammering the API / hitting rate limits
      await new Promise((res) => setTimeout(res, 750));
    } catch (err) {
      console.error(`Error while generating for "${key}":`, err);
      // brief delay on error as well
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  console.log(
    `Done. Generated content for ${Object.keys(updated).length} conditions total.`
  );
}

main().catch((err) => {
  console.error("Fatal error in generator:", err);
  process.exit(1);
});
