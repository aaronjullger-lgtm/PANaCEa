// services/geminiService.ts

import { nanoid } from "nanoid";
import {
  Question,
  SessionSettings,
  DifficultyMode,
  DeckState
} from "../types";
import {
  PANCE_DECK,
  TASK_DECK,
  TOPIC_MAP,
  ABBREVIATION_TO_TOPIC_MAP
} from "../constants";
import {
  buildConditionDefinition,
  findConditionMeta
} from "../conditionRegistry";

/** Local type used to configure model behavior based on difficulty. */
type DifficultyConfig = {
  temperature: number;
  targetDifficulty: "easy" | "medium" | "hard";
};

type GrowthArea = "history" | "diagnostics" | "treatment" | "fundamentals";

/** Shuffle helper (Fisher–Yates) */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Internal shuffled decks that persist within the session. */
let shuffledPanceDeck: string[] = shuffleArray(PANCE_DECK);
let panceIndex = 0;

let shuffledTaskDeck: string[] = shuffleArray(TASK_DECK);
let taskIndex = 0;

/** Public helpers for UI to display deck state / refill. */
export function refillShuffledContentQueue(): void {
  shuffledPanceDeck = shuffleArray(PANCE_DECK);
  panceIndex = 0;
  shuffledTaskDeck = shuffleArray(TASK_DECK);
  taskIndex = 0;
}

export function resetDecks(): void {
  refillShuffledContentQueue();
}

export function getCurrentDeckState(): DeckState {
  return {
    panceRemaining: shuffledPanceDeck.length - panceIndex,
    taskRemaining: shuffledTaskDeck.length - taskIndex
  };
}

/** Draw a PANCE system abbreviation (CV, GI, etc.) */
function drawSystemAbbreviation(): string {
  if (panceIndex >= shuffledPanceDeck.length) {
    shuffledPanceDeck = shuffleArray(PANCE_DECK);
    panceIndex = 0;
  }
  const code = shuffledPanceDeck[panceIndex++];
  return code;
}

/** Draw a task (History, Dx, Tx, etc.) */
function drawTask(): string {
  if (taskIndex >= shuffledTaskDeck.length) {
    shuffledTaskDeck = shuffleArray(TASK_DECK);
    taskIndex = 0;
  }
  const t = shuffledTaskDeck[taskIndex++];
  return t;
}

/** Map DifficultyMode → actual model config */
function getDifficultyConfig(mode: DifficultyMode): DifficultyConfig {
  switch (mode) {
    case "Easy":
      return { temperature: 0.4, targetDifficulty: "easy" };
    case "Hard":
      return { temperature: 0.9, targetDifficulty: "hard" };
    case "Mixed":
    default: {
      // Randomize within the session between easy/medium/hard
      const roll = Math.random();
      if (roll < 0.33) return { temperature: 0.5, targetDifficulty: "easy" };
      if (roll < 0.66) return { temperature: 0.7, targetDifficulty: "medium" };
      return { temperature: 0.9, targetDifficulty: "hard" };
    }
  }
}

/** Normalize growth areas into text we can feed the model. */
function formatGrowthAreas(growthAreas: GrowthArea[]): string {
  if (!growthAreas || growthAreas.length === 0) {
    return "No specific growth areas identified. Mix topics normally.";
  }

  const friendlyLabels: Record<GrowthArea, string> = {
    history: "History taking & physical exam",
    diagnostics: "Diagnostics and lab interpretation",
    treatment: "Pharmacology & clinical intervention",
    fundamentals: "Foundational physiology, pathophysiology, and mechanisms"
  };

  const parts = growthAreas.map((g) => friendlyLabels[g]);
  return `Prioritize reinforcing the following areas: ${parts.join(
    ", "
  )}, while still keeping a balanced distribution.`;
}

/**
 * The shape we expect back from the model.
 * Important: The prompt tells Gemini to respond with ONLY this JSON.
 */
interface ModelResponse {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  pearls: string[];

  // Higher-level categorization from the model
  topic: string;          // e.g. "Cardiovascular System" or "Professional Practice"
  condition?: string;     // e.g. "Atrial fibrillation" (we map this to the registry)
}

/**
 * Build the system + user prompt for Gemini, including:
 * - deck-driven PANCE system
 * - deck-driven task (History/Dx/Tx/etc.)
 * - difficulty
 * - growth areas
 */
function buildQuestionPrompt(
  sessionSettings: SessionSettings,
  growthAreas: GrowthArea[],
  systemAbbreviation: string,
  task: string,
  difficultyConfig: DifficultyConfig
): string {
  const fullTopic =
    ABBREVIATION_TO_TOPIC_MAP[systemAbbreviation] ?? "Professional Practice";

  const growthText = formatGrowthAreas(growthAreas);

  return `
You are a physician assistant PANCE exam item writer.

Your job is to generate **ONE** high-quality, single-best-answer, board-style multiple choice question.

Requirements:

- Question must be **fully self-contained**.
- Question must be at or near the PANCE level (PA student finishing didactic year).
- Provide **4 options** (A–D) where only **one** is clearly best.
- The stem should be focused and clinically realistic.
- Avoid trivial recall; test **application** and **reasoning**.
- Include relevant vitals, key exam findings, and lab/imaging when appropriate.
- Strictly avoid vague language like "all of the above".

Exam blueprints:

- PANCE system/topic for this question: "${fullTopic}" (abbreviation: "${systemAbbreviation}")
- Task focus: "${task}"
- Target difficulty: "${difficultyConfig.targetDifficulty}"
- ${growthText}

Additional constraints:

- If the system is NOT "Professional Practice", the "topic" field in your JSON MUST be exactly "${fullTopic}".
- If you clearly base the question on a specific condition (e.g. atrial fibrillation, HFrEF, DKA), set the "condition" field to that condition's common name.
- If the question is more general (e.g. "screening guidelines for colorectal cancer") you may omit "condition" or leave it null.

Response format (VERY IMPORTANT):

Return **only** a single JSON object, with no extra text, in this exact format:

{
  "question": "string, the question stem",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "correctAnswerIndex": 0,
  "rationale": "Detailed explanation of why the correct answer is correct and why the others are wrong.",
  "pearls": [
    "Short high-yield teaching pearl #1",
    "Short high-yield teaching pearl #2"
  ],
  "topic": "Must be exactly "${fullTopic}" if this is a clinical system question.",
  "condition": "Name of the condition this question is primarily about, or null."
}

User context:

Generate one question now.
  `.trim();
}

/**
 * Call the Netlify Gemini proxy function and return plain text.
 */
async function callGeminiText(prompt: string, temperature: number): Promise<string> {
  const response = await fetch("/.netlify/functions/geminiProxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      temperature
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gemini proxy error (${response.status}): ${text || response.statusText}`
    );
  }

  const data = await response.json();
  // Expect the proxy to normalize the result as { text: string }
  if (!data || typeof data.text !== "string") {
    throw new Error("Gemini proxy returned an unexpected payload.");
  }
  return data.text;
}

/**
 * Parse model JSON safely and map it into our Question type,
 * including system/condition metadata for deeper stats.
 */
function parseModelResponse(
  rawText: string,
  systemAbbreviationFromDeck: string,
  difficulty: "easy" | "medium" | "hard"
): Question {
  let parsed: ModelResponse;

  try {
    // Trim any stray markdown fences / code block markers
    const cleaned = rawText
      .trim()
      .replace(/^```json/gi, "")
      .replace(/^```/gi, "")
      .replace(/```$/gi, "")
      .trim();

    parsed = JSON.parse(cleaned) as ModelResponse;
  } catch (err) {
    console.error("Failed to parse model JSON:", err, rawText);
    throw new Error("The model returned invalid JSON.");
  }

  if (
    !parsed.question ||
    !Array.isArray(parsed.options) ||
    parsed.options.length !== 4 ||
    typeof parsed.correctAnswerIndex !== "number"
  ) {
    console.error("Malformed model response object:", parsed);
    throw new Error("The model returned a malformed question object.");
  }

  const clampedIndex = Math.min(
    Math.max(parsed.correctAnswerIndex, 0),
    parsed.options.length - 1
  );

  // Derive system abbreviation: prefer PANCE deck, but you could also try to
  // map from parsed.topic via TOPIC_MAP if needed in the future.
  const systemAbbreviation = systemAbbreviationFromDeck;

  // Attach condition metadata if we can resolve it
  const conditionMeta = findConditionMeta(parsed.condition);
  const conditionDef = conditionMeta
    ? buildConditionDefinition(conditionMeta)
    : undefined;

  const question: Question = {
    id: nanoid(),
    question: parsed.question.trim(),
    options: parsed.options.map((opt) => opt.trim()),
    correctAnswerIndex: clampedIndex,
    rationale: parsed.rationale?.trim() || "",
    pearls: Array.isArray(parsed.pearls)
      ? parsed.pearls.map((p) => p.trim()).filter(Boolean)
      : [],
    topic: parsed.topic || "Uncategorized",
    difficulty,
    system: systemAbbreviation as any,
    condition: conditionDef
  };

  return question;
}

/**
 * Main entry point used by the UI: generate a new question.
 */
export async function fetchNewQuestion(
  sessionSettings: SessionSettings,
  growthAreas: GrowthArea[]
): Promise<Question> {
  const systemAbbreviation = drawSystemAbbreviation(); // e.g. "CV"
  const task = drawTask();                             // e.g. "Formulating Diagnosis"

  const difficultyConfig = getDifficultyConfig(sessionSettings.difficultyMode);
  const prompt = buildQuestionPrompt(
    sessionSettings,
    growthAreas,
    systemAbbreviation,
    task,
    difficultyConfig
  );

  const rawText = await callGeminiText(prompt, difficultyConfig.temperature);
  const question = parseModelResponse(
    rawText,
    systemAbbreviation,
    difficultyConfig.targetDifficulty
  );

  return question;
}

/**
 * Generate an alternate rationale for the SAME question,
 * used when you click the "New Explanation" button.
 */
export async function generateAlternateRationale(
  question: Question
): Promise<string> {
  const systemAbbreviation = question.system ?? "PRO";
  const topicName =
    ABBREVIATION_TO_TOPIC_MAP[systemAbbreviation] ?? "Professional Practice";

  const baseCondition = question.condition?.name ?? null;

  const prompt = `
You will be given a PANCE-style multiple choice question with 4 options (A–D).

Your job is to generate a **completely new explanation** (rationale) for the correct answer, written in a different way from any prior explanation, but still:

- clinically accurate
- high-yield
- succinct but clear
- explicitly addressing why the correct answer is right AND why the other options are wrong.

Context:
- System/topic: ${topicName} (abbreviation: ${systemAbbreviation})
- Condition (if applicable): ${baseCondition ?? "general or multiple conditions"}

Question stem:
${question.question}

Options:
${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}

Correct answer letter:
${String.fromCharCode(65 + question.correctAnswerIndex)}

Important:
- Do NOT restate the original rationale text.
- Do NOT mention that this is an "alternate rationale".
- Just give the explanation itself, in one cohesive paragraph (you may use short bullet points if genuinely helpful, but do not label them A–D).

Now write the new explanation.
  `.trim();

  const raw = await callGeminiText(prompt, 0.6);
  return raw.trim();
}

/**
 * Optional: Pre-fetch a small pool of questions.
 * For now this is a thin convenience wrapper, but the UI expects it.
 */
export async function prefetchQuestions(
  sessionSettings: SessionSettings,
  growthAreas: GrowthArea[],
  count: number
): Promise<Question[]> {
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    // serial for now; you can parallelize with Promise.all if needed
    // but serial is simpler and avoids rate limits.
    const q = await fetchNewQuestion(sessionSettings, growthAreas);
    questions.push(q);
  }
  return questions;
}
