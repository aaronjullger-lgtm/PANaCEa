// src/services/geminiService.ts

import {
  PANCE_TOPICS,
  TOPIC_MAP,
  ABBREVIATION_TO_TOPIC_MAP,
  PANCE_DECK,
  TASK_DECK,
} from "../constants";
import type { Question, SessionSettings } from "../types";

/**
 * Call the Netlify serverless function, which talks to Gemini securely.
 */
async function callGeminiText(
  modelName: string,
  prompt: string,
  temperature: number = 0.8
): Promise<string> {
  const response = await fetch("/.netlify/functions/geminiProxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelName, prompt, temperature }),
  });

  if (!response.ok) {
    console.error(
      "Gemini proxy returned error status",
      response.status,
      await response.text().catch(() => "<no body>")
    );
    throw new Error("Gemini proxy error");
  }

  const data = await response.json().catch((err) => {
    console.error("Failed to parse JSON from proxy:", err);
    throw new Error("Gemini proxy returned invalid JSON");
  });

  if (!data || typeof data.text !== "string") {
    console.error("Proxy returned unexpected shape:", data);
    throw new Error("Gemini proxy returned invalid data");
  }

  return data.text;
}

/**
 * Clean up Gemini's text so it's valid JSON:
 * - Remove ```json / ``` fences if present
 * - Trim whitespace
 * - Slice from first '{' to last '}' in case of extra text
 */
function cleanJsonText(raw: string): string {
  if (!raw) {
    throw new Error("Empty response from Gemini");
  }

  let text = raw.trim();

  // Strip ```json ... ``` fences if present
  if (text.startsWith("```")) {
    // Remove first line (``` or ```json)
    const firstNewline = text.indexOf("\n");
    if (firstNewline !== -1) {
      text = text.slice(firstNewline + 1);
    }
    // Remove trailing ``` if present
    const lastFence = text.lastIndexOf("```");
    if (lastFence !== -1) {
      text = text.slice(0, lastFence);
    }
    text = text.trim();
  }

  // As a final safety, slice from first '{' to last '}'.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

// Deck queues + recent history
let shuffledContentQueue: string[] = [];
let shuffledTaskQueue: string[] = [];
let recentQuestionHistory: string[] = [];
const RECENT_HISTORY_COUNT = 10;

// Shuffle helpers
export function refillShuffledContentQueue() {
  const deck = [...PANCE_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  shuffledContentQueue = deck;
}

export function refillShuffledTaskQueue() {
  const deck = [...TASK_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  shuffledTaskQueue = deck;
}

export async function fetchNewQuestion(
  settings: SessionSettings,
  growthAreas: string[]
): Promise<Question> {
  const { focus, difficulty } = settings;

  let detailedDifficultyInstruction = "";
  switch (difficulty) {
    case "easier":
      detailedDifficultyInstruction =
        "Generate an 'Easier' question. This question should be easier than a standard PANCE question and must test the foundational characteristics of a common, core topic. Focus on 'classic' textbook presentations and first-order knowledge to help me build competence.";
      break;
    case "same":
      detailedDifficultyInstruction =
        "Generate a 'PANCE-level' question. This question must be on-par with the difficulty of a real PANCE question. It should be a clinical vignette with plausible distractors that tests second-order thinking (e.g., diagnosis, management, or next diagnostic step).";
      break;
    case "harder":
      detailedDifficultyInstruction =
        "Generate a 'Harder' question that is more difficult than a standard PANCE question. You can do this by using a complex patient (multiple comorbidities), testing a less common 'zebra' condition, or asking a multi-step reasoning question (e.g., 'What is the mechanism of action of the second-line treatment for this complex patient?').";
      break;
  }

  const uniquenessInstruction =
    recentQuestionHistory.length > 0
      ? `Critically, avoid generating a question that is substantively or thematically similar to any of these recently generated questions: 
- "${recentQuestionHistory.join('"\n- "')}"`
      : "Avoid generating questions that are substantively identical or too similar to common practice questions. The goal is to provide a fresh challenge.";

  let prompt = "";

  if (focus === "all") {
    if (shuffledContentQueue.length === 0) {
      refillShuffledContentQueue();
    }
    const contentTopicAbbr = shuffledContentQueue.pop()!;
    const fullContentTopicName = ABBREVIATION_TO_TOPIC_MAP[contentTopicAbbr];

    if (contentTopicAbbr === "PRO") {
      prompt = `You are generating a structured JSON object for a PANCE practice question.

Generate one new, unique, PANCE-style multiple-choice question on the topic of "Professional Practice".

Difficulty:
${detailedDifficultyInstruction}

Core Instructions:
1. Scenario-Based: The question must present a realistic scenario involving professional practice issues relevant to PAs, such as medical ethics, legal responsibilities, patient safety, or public health principles.
2. Plausible Options: The options must represent plausible courses of action or interpretations of the scenario, with one clear best answer according to current professional standards.
3. HTML Formatting: The "rationale" string and all strings in the "pearls" array MUST use simple HTML tags (<b>, <i>) for formatting, NOT markdown.
4. Key Pearls Formatting: The "pearls" array MUST contain 3–4 single, high-yield sentences related to the core principle being tested. Each sentence is a concise, complete thought.
5. Uniqueness: ${uniquenessInstruction}
6. Topic: The "topic" field in the JSON output MUST be exactly "Professional Practice".

Output Format:
Return ONLY a single JSON object (no prose before or after) with the exact structure:
{
  "question": string,
  "options": [string, string, string, string],
  "correctAnswerIndex": number,
  "rationale": string,
  "topic": string,
  "condition": string,
  "pearls": [string, string, string]
}`;
    } else {
      if (shuffledTaskQueue.length === 0) {
        refillShuffledTaskQueue();
      }
      const taskTopic = shuffledTaskQueue.pop()!;

      prompt = `You are generating a structured JSON object for a PANCE practice question.

Generate one new, unique, PANCE-style multiple-choice question for the topic "${fullContentTopicName}" that specifically tests the task "${taskTopic}".

Difficulty:
${detailedDifficultyInstruction}

Core Instructions:
1. Vignette with Subtle Red Herring: The question MUST contain a patient case/vignette and include one subtle "red herring" detail that is not relevant to the final diagnosis.
2. Task-Focused Question: The vignette must end with a clear, single-sentence question that directly relates to the specified task ("${taskTopic}").
3. Plausible, Crafted Distractors: The three distractors MUST be highly plausible (common misconceptions, similar diagnoses, or common mistakes).
4. Vignette Formatting: Insert "\\n" in the question string to separate paragraphs; do NOT return a single wall of text.
5. Data Table Formatting: If you include vitals or labs, embed a simple HTML <table> in the question string.
6. HTML Formatting: The "rationale" and all "pearls" MUST use simple HTML tags (<b>, <i>) instead of markdown.
7. Key Pearls: "pearls" must be 3–4 high-yield, single-sentence clinical pearls.
8. Uniqueness: ${uniquenessInstruction}
9. Topic field: The "topic" field in the JSON output MUST be exactly "${fullContentTopicName}".

Output Format:
Return ONLY a single JSON object (no prose before or after) with the exact structure:
{
  "question": string,
  "options": [string, string, string, string],
  "correctAnswerIndex": number,
  "rationale": string,
  "topic": string,
  "condition": string,
  "pearls": [string, string, string]
}`;
    }
  } else {
    let topicInstruction = "";
    if (focus === "topic" && settings.topic) {
      const fullTopicName =
        ABBREVIATION_TO_TOPIC_MAP[settings.topic] || settings.topic;
      topicInstruction = `The "topic" field in the JSON MUST be exactly "${fullTopicName}".`;
    } else if (focus === "growth" && growthAreas.length > 0) {
      const fullGrowthAreas = growthAreas
        .map((abbr) => ABBREVIATION_TO_TOPIC_MAP[abbr] || abbr)
        .join(", ");
      topicInstruction = `First choose exactly ONE topic from: [${fullGrowthAreas}] and use that value in the "topic" field.`;
    } else {
      topicInstruction = `First choose exactly ONE topic from: [${PANCE_TOPICS.join(
        ", "
      )}] and use that value in the "topic" field.`;
    }

    prompt = `You are generating a structured JSON object for a PANCE practice question.

Generate one new, unique, PANCE-style multiple-choice question.

Core Instructions:
1. Vignette with subtle red herring.
2. Second-order question (diagnosis, next best step, mechanism, etc.).
3. Highly plausible distractors.
4. Use "\\n" inside the question string for paragraph breaks.
5. If including vitals/labs, embed an HTML <table> in the question string.
6. "rationale" and "pearls" MUST use simple HTML tags (<b>, <i>), no markdown.
7. "pearls" = 3–4 high-yield single-sentence pearls.
8. Uniqueness: ${uniquenessInstruction}

Topic and Difficulty:
- ${topicInstruction}
- ${detailedDifficultyInstruction}

Output Format:
Return ONLY a single JSON object (no prose before or after) with the exact structure:
{
  "question": string,
  "options": [string, string, string, string],
  "correctAnswerIndex": number,
  "rationale": string,
  "topic": string,
  "condition": string,
  "pearls": [string, string, string]
}`;
  }

  try {
    const raw = await callGeminiText("gemini-2.5-flash", prompt, 0.8);
    const jsonString = cleanJsonText(raw);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(
        "Failed to parse JSON from Gemini. Raw text:",
        raw,
        "Cleaned JSON string:",
        jsonString,
        "Error:",
        parseError
      );
      throw new Error(
        "The API returned a malformed JSON response. Please try again."
      );
    }

    if (
      !parsed.question ||
      !parsed.question.includes("?") ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4 ||
      typeof parsed.correctAnswerIndex !== "number" ||
      !parsed.rationale ||
      !parsed.topic ||
      !parsed.condition ||
      !Array.isArray(parsed.pearls)
    ) {
      console.warn(
        "Received malformed JSON data from API, retrying once...",
        parsed
      );
      return fetchNewQuestion(settings, growthAreas);
    }

    if (recentQuestionHistory.length >= RECENT_HISTORY_COUNT) {
      recentQuestionHistory.shift();
    }
    recentQuestionHistory.push(parsed.question);

    const topicAbbreviation = TOPIC_MAP[parsed.topic] || parsed.topic;
    if (!TOPIC_MAP[parsed.topic]) {
      console.warn(
        `API returned an unknown topic "${parsed.topic}". Storing it as-is.`
      );
    }

    return { ...parsed, topic: topicAbbreviation } as Question;
  } catch (error) {
    console.error("Error during fetchNewQuestion:", error);
    if (
      error instanceof Error &&
      (error.message.startsWith("The API returned an invalid response") ||
        error.message.startsWith("The API returned a malformed JSON"))
    ) {
      throw error;
    }
    throw new Error(
      "Failed to generate a new question. Please check your Gemini API key and network connection."
    );
  }
}

export async function prefetchQuestions(
  count: number,
  settings: SessionSettings,
  growthAreas: string[]
): Promise<Question[]> {
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    const q = await fetchNewQuestion(settings, growthAreas);
    questions.push(q);
  }
  return questions;
}

export async function generateContent(
  type: "study-guide" | "flashcards",
  topic: string,
  useProModel: boolean
): Promise<string> {
  const fullTopicName = ABBREVIATION_TO_TOPIC_MAP[topic] || topic;

  let prompt: string;
  if (type === "study-guide") {
    prompt = `Generate a concise, high-yield study guide for a PA student on the PANCE topic: "${fullTopicName}". Focus on pathophysiology, clinical presentation, diagnosis, and treatment. Format clearly with headings and bullet points.`;
  } else {
    prompt = `Generate 10 high-yield PANCE flashcards for the topic "${fullTopicName}". Format them as:

Q: [Question]
A: [Answer]

(one per block).`;
  }

  const modelName = useProModel ? "gemini-2.5-pro" : "gemini-2.5-flash";
  const temperature = useProModel ? 0.5 : 0.7;

  try {
    const text = await callGeminiText(modelName, prompt, temperature);
    return text;
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error(
      "Failed to generate content. The API may be busy or an error occurred."
    );
  }
}

export async function generateAlternateRationale(
  question: Question,
  userAnswer: string,
  correctAnswer: string
): Promise<string> {
  const prompt = `You are an expert medical tutor for a Physician Assistant student. The student answered a practice question incorrectly. Provide a new, comparative explanation.

Question:
${question.question}

Correct Answer:
"${correctAnswer}"

Student's Incorrect Answer:
"${userAnswer}"

Original Rationale (for your context only, do NOT repeat verbatim):
${question.rationale}

Your Task:
1. Explain why the student's choice ("${userAnswer}") is incorrect for this specific patient.
2. Explain why "${correctAnswer}" is the best choice, using key details from the vignette.
3. Use a supportive, educational tone.
4. Format your response clearly with short paragraphs and bullet points where helpful.`;

  try {
    const text = await callGeminiText("gemini-2.5-flash", prompt, 0.6);
    return text;
  } catch (error) {
    console.error("Error generating alternate rationale:", error);
    throw new Error(
      "Failed to generate an explanation. The API may be busy or an error occurred."
    );
  }
}
