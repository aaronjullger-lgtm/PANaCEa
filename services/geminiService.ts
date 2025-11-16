// services/geminiService.ts

import {
  PANCE_TOPICS,
  TOPIC_MAP,
  ABBREVIATION_TO_TOPIC_MAP,
  PANCE_DECK,
  TASK_DECK,
} from "../constants";
import type { Question, SessionSettings } from "../types";

// --- Helper: call Netlify serverless function, which talks to Gemini ---

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
    console.error("Gemini proxy returned error status", response.status);
    throw new Error("Gemini proxy error");
  }

  const data = await response.json();
  const text = typeof data === "string" ? data : data.text;

  if (!text || !text.trim()) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}

// --- Helper: strip any HTML tags from a string (for options/condition) ---

const stripHtmlTags = (text: string): string =>
  typeof text === "string" ? text.replace(/<\/?[^>]+(>|$)/g, "") : text;

// --- Deck / history state ---

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

// --- Main question generator ---

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

  // -------- FOCUS: ALL (use content + task decks) --------
  if (focus === "all") {
    if (shuffledContentQueue.length === 0) {
      refillShuffledContentQueue();
    }
    const contentTopicAbbr = shuffledContentQueue.pop()!;
    const fullContentTopicName = ABBREVIATION_TO_TOPIC_MAP[contentTopicAbbr];

    if (contentTopicAbbr === "PRO") {
      // Professional Practice special handling
      prompt = `You are generating a structured JSON object for a PANCE practice question.

Generate one new, unique, PANCE-style multiple-choice question on the topic of "Professional Practice".

Difficulty:
${detailedDifficultyInstruction}

Core Instructions:
1. Scenario-Based: The question must present a realistic scenario involving professional practice issues relevant to PAs, such as medical ethics, legal responsibilities, patient safety, or public health principles.
2. Plausible Options: The options must represent plausible courses of action or interpretations of the scenario, with one clear best answer according to current professional standards.
3. HTML Formatting: The "rationale" string and all strings in the "pearls" array MUST use simple HTML tags (<b>, <i>) for formatting, NOT markdown.
4. Key Pearls Formatting: The "pearls" array MUST contain 3–4 single, high-yield sentences related to the core principle being tested. Each sentence is a concise, complete thought.
5. Question HTML: The "question" string MAY include a simple HTML <table> (using only <table>, <thead>, <tbody>, <tr>, <th>, <td>) and <br> tags for formatting vitals/labs. Do NOT use <b> or <i> tags in the question.
6. Options & Condition: The "options" and "condition" fields MUST be plain text only (no HTML tags).
7. Uniqueness: ${uniquenessInstruction}
8. Topic: The "topic" field in the JSON output MUST be exactly "Professional Practice".

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
      // Regular medical content with task deck
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
5. Data Table Formatting: If you include ANY vital signs and/or laboratory values, you MUST place ALL of them into a single simple HTML <table> with a header row in the question string. Use exactly two columns labeled "Parameter" and "Value". Do NOT repeat vitals or labs in plain text outside the table.
6. HTML Formatting: The "rationale" and all "pearls" MUST use simple HTML tags (<b>, <i>) instead of markdown.
7. Key Pearls: "pearls" must be 3–4 high-yield, single-sentence clinical pearls.
8. Question HTML: The "question" string MAY use the table tags above and <br> for line breaks. Do NOT use <b> or <i> tags in the question.
9. Options & Condition: The "options" and "condition" fields MUST be plain text only (no HTML tags).
10. Uniqueness: ${uniquenessInstruction}
11. Topic field: The "topic" field in the JSON output MUST be exactly "${fullContentTopicName}".

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
    // -------- FOCUS: topic / growth / generic --------
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
5. Data Table Formatting: If you include ANY vital signs and/or laboratory values, you MUST place ALL of them into a single simple HTML <table> with a header row in the question string. Use exactly two columns labeled "Parameter" and "Value". Do NOT repeat vitals or labs in plain text outside the table.
6. "rationale" and "pearls" MUST use simple HTML tags (<b>, <i>), no markdown.
7. "pearls" = 3–4 high-yield single-sentence pearls.
8. Question HTML: The "question" string MAY use the table tags above and <br> for line breaks, but should not use <b> or <i>.
9. Options & Condition: The "options" and "condition" fields MUST be plain text only (no HTML tags).
10. Uniqueness: ${uniquenessInstruction}

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

  // --- Call Gemini through proxy and parse JSON ---

  try {
    const jsonString = await callGeminiText("gemini-2.5-flash", prompt, 0.8);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(
        "Failed to parse JSON from Gemini. String that failed:",
        jsonString
      );
      throw new Error(
        "The API returned a malformed JSON response. Please try again."
      );
    }

    // Basic sanity checks
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

    // Keep question HTML (for tables), sanitize options & condition only
    parsed.options = parsed.options.map((opt: string) => stripHtmlTags(opt));
    parsed.condition = stripHtmlTags(parsed.condition);

    // Track recent questions for uniqueness
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

// --- Prefetch multiple questions ---

export async function prefetchQuestions(
  count: number,
  settings: SessionSettings,
  growthAreas: string[]
): Promise<Question[]> {
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    const question = await fetchNewQuestion(settings, growthAreas);
    questions.push(question);
  }
  return questions;
}

// --- Study-guide / flashcard generator ---

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

// --- Alternate rationale generator ---

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
