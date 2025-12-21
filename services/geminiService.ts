// services/geminiService.ts

import {
  PANCE_TOPICS,
  TOPIC_MAP,
  ABBREVIATION_TO_TOPIC_MAP,
  PANCE_DECK,
  TASK_DECK,
  GEMINI_FLASH_MODEL,
  GEMINI_PRO_MODEL,
} from "../constants";
import type {
  Question,
  SessionSettings,
  SystemCode,
  ConditionDefinition,
} from "../types";
import type { PatientEncounterCase, PatientPersona } from '../types/drill-modes';
import {
  buildConditionDefinition,
  getRandomConditionForSystem,
  findConditionMeta,
  type ConditionMeta,
} from "../conditionRegistry";
import {
  getConditionByIdSync,
  isMeaningfulContent,
  normalizeConditionContent,
} from "../lib/loadConditions";
import { getApiEndpoint, API_ENDPOINTS } from "../lib/utils/apiConfig";

// ============================================================================
// TYPE DEFINITIONS FOR GEMINI SERVICE
// ============================================================================

/**
 * Chat message in patient simulator
 */
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
  phase?: 'history' | 'physical' | 'diagnostic' | 'diagnosis' | 'treatment';
}

/**
 * Session data for after-action reports
 */
export interface SessionData {
  sessionId: string;
  startTime: string;
  endTime: string;
  chatHistory: ChatMessage[];
  actionsPerformed: string[];
  testsOrdered: string[];
  diagnosisSubmitted?: string;
  treatmentPlan?: string[];
  score?: number;
}

/**
 * Parsed question response from Gemini
 */
export interface ParsedQuestionResponse {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  pearls: string[];
  topic?: string;
  system?: SystemCode;
  condition?: string;
  conditionId?: string;
}

// --- Helper: call serverless function, which talks to Gemini ---

/**
 * Custom error class for Gemini API errors with retry metadata
 */
export class GeminiApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable: boolean = false,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

/**
 * Determines if an error is retryable and how long to wait
 */
function getRetryInfo(status: number): { retryable: boolean; retryAfterMs: number } {
  switch (status) {
    case 429: // Rate limited
      return { retryable: true, retryAfterMs: 60000 };
    case 503: // Service unavailable
    case 502: // Bad gateway
    case 504: // Gateway timeout
      return { retryable: true, retryAfterMs: 3000 };
    case 408: // Request timeout
      return { retryable: true, retryAfterMs: 1000 };
    default:
      return { retryable: status >= 500, retryAfterMs: 2000 };
  }
}

/**
 * Sleep helper for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function callGeminiText(
  modelName: string = GEMINI_FLASH_MODEL,
  prompt: string,
  temperature: number = 0.8,
  options: { maxRetries?: number } = {}
): Promise<string> {
  const { maxRetries = 2 } = options;
  
  const isTestEnv = typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');
  if (isTestEnv) {
    const hash = Array.from(prompt || '').reduce((acc, char) => (acc + char.charCodeAt(0)) % 100000, 0);
    const preview = prompt.replace(/\s+/g, ' ').trim();
    const mock = `[Gemini mock ${hash}] ${preview}`;
    return mock.length < 40 ? mock.padEnd(40, '.') : mock;
  }

  let lastError: GeminiApiError | Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.GEMINI_PROXY), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName, prompt, temperature }),
      });

      if (!response.ok) {
        const { retryable, retryAfterMs } = getRetryInfo(response.status);
        
        // If retryable and we have retries left, wait and continue
        if (retryable && attempt < maxRetries) {
          console.warn(`[Gemini] Request failed with ${response.status}, retrying in ${retryAfterMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await sleep(retryAfterMs);
          continue;
        }
        
        // Non-retryable or out of retries
        throw new GeminiApiError(
          `Gemini API error: ${response.status} ${response.statusText}`,
          response.status,
          retryable,
          retryAfterMs
        );
      }

      const data = await response.json();
      const text = typeof data === "string" ? data : data.text;

      if (!text || !text.trim()) {
        throw new Error("Empty response from Gemini");
      }

      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If it's already a GeminiApiError, rethrow (already handled retry logic above)
      if (error instanceof GeminiApiError) {
        throw error;
      }
      
      // For network errors, attempt retry
      if (attempt < maxRetries && (
        error instanceof TypeError || // Network error
        (error instanceof Error && error.message.includes('fetch'))
      )) {
        console.warn(`[Gemini] Network error, retrying in 2000ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(2000);
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error("Gemini request failed after retries");
}

// --- Helper: strip any HTML tags from a string (for options/condition) ---

const stripHtmlTags = (text: string): string =>
  typeof text === "string" ? text.replace(/<\/?[^>]+(>|$)/g, "") : text;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

function getConditionRegistryContext(meta: ConditionMeta): string | undefined {
  const id = buildConditionDefinition(meta).id;
  // Note: Using getConditionByIdSync here is safe because this function is only called
  // during question generation (from fetchNewQuestion), and conditions are loaded
  // during app initialization. Returns undefined if not loaded yet, which is handled gracefully.
  const content = getConditionByIdSync(id)?.sections;
  if (!content) return undefined;

  const pieces: string[] = [];

  const maybeAdd = (key: string, label: string) => {
    const value = content[key];
    if (isMeaningfulContent(value)) {
      const normalized = normalizeConditionContent(value);
      if (normalized) {
        pieces.push(`${label}: ${normalized}`);
      }
    }
  };

  maybeAdd("overview", "Overview");
  maybeAdd("etiology", "Etiology");
  maybeAdd("diagnostics", "Diagnostics");
  maybeAdd("clinicalPresentation", "Clinical Presentation");
  maybeAdd("riskFactors", "Risk Factors");
  maybeAdd("prognosis", "Prognosis");

  return pieces.join("\n");
}

// --- Deck / history state ---

let shuffledContentQueue: string[] = [];
let shuffledTaskQueue: string[] = [];
let recentQuestionHistory: string[] = [];
const RECENT_HISTORY_COUNT = 10;

// Shuffle helpers
/**
 * Helper to get enabled systems from localStorage with caching
 */
let cachedEnabledSystems: Set<SystemCode> | null = null;
let enabledSystemsCacheKey: string | null = null;

function getEnabledSystems(): Set<SystemCode> {
  const saved = localStorage.getItem('panceai_enabled_systems');
  
  // Return cached result if localStorage value hasn't changed
  if (saved === enabledSystemsCacheKey && cachedEnabledSystems) {
    return cachedEnabledSystems;
  }
  
  // Update cache
  enabledSystemsCacheKey = saved;
  
  if (saved) {
    try {
      cachedEnabledSystems = new Set(JSON.parse(saved) as SystemCode[]);
      return cachedEnabledSystems;
    } catch {
      cachedEnabledSystems = new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
      return cachedEnabledSystems;
    }
  }
  cachedEnabledSystems = new Set(Object.keys(ABBREVIATION_TO_TOPIC_MAP) as SystemCode[]);
  return cachedEnabledSystems;
}

export function refillShuffledContentQueue() {
  const enabledSystems = getEnabledSystems();
  
  // Filter deck to only include enabled systems
  let deck = PANCE_DECK.filter(system => enabledSystems.has(system as SystemCode));
  
  // If no systems are enabled, use all systems (fallback)
  if (deck.length === 0) {
    console.warn('No systems enabled, using all systems as fallback');
    deck = [...PANCE_DECK];
  }
  
  // Shuffle the filtered deck
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

  // Optional condition chosen client-side (for hybrid targeting and stats)
  let chosenConditionDef: ConditionDefinition | undefined;
  let chosenConditionMeta: ConditionMeta | undefined;
  let conditionRegistryNotes: string | undefined;
  
  // If the client requested a specific condition (e.g. drill from heatmap),
  // resolve it into a ConditionDefinition from the registry.
  let chosenSubcategory: string | undefined;
  if (settings.subcategoryName) {
    chosenSubcategory = settings.subcategoryName;
  }
  if (settings.conditionName) {
    const meta = findConditionMeta(settings.conditionName);
    if (meta) {
      chosenConditionMeta = meta;
      chosenConditionDef = buildConditionDefinition(meta);
      
      // NEW: Load database content for specifically requested condition
      try {
        const { loadConditionData } = await import('../services/conditionDataLoader');
        const { hasCompleteContent, buildDatabaseContext } = await import('../lib/contentHelpers');
        const dbContent = await loadConditionData(settings.conditionName);
        
        if (dbContent && hasCompleteContent(dbContent)) {
          conditionRegistryNotes = buildDatabaseContext(dbContent);
          console.log(`✓ Using database content for requested condition ${settings.conditionName}`);
        } else {
          console.warn(`⚠ Incomplete database content for ${settings.conditionName}, will use registry/API knowledge`);
        }
      } catch (error) {
        console.error(`Error loading database content for ${settings.conditionName}:`, error);
      }
    }
  }

  // -------- FOCUS: ALL (use content + task decks) --------
  if (focus === "all") {
    if (shuffledContentQueue.length === 0) {
      refillShuffledContentQueue();
    }
    const contentTopicAbbr = shuffledContentQueue.pop()!;
    const fullContentTopicName = ABBREVIATION_TO_TOPIC_MAP[contentTopicAbbr];

    const systemCode = contentTopicAbbr as SystemCode;

    // Hybrid: pick a random condition within this system (except PRO/OTHER)
    let selectedConditionMeta: ConditionMeta | undefined;
    if (systemCode !== "PRO" && systemCode !== "OTHER") {
      selectedConditionMeta = getRandomConditionForSystem(systemCode);
      if (selectedConditionMeta) {
        chosenConditionMeta = selectedConditionMeta;
        chosenConditionDef = buildConditionDefinition(selectedConditionMeta);
        
        // NEW: Load database content first
        try {
          const { loadConditionData } = await import('../services/conditionDataLoader');
          const { hasCompleteContent, buildDatabaseContext } = await import('../lib/contentHelpers');
          const dbContent = await loadConditionData(selectedConditionMeta.condition);
          
          if (dbContent && hasCompleteContent(dbContent)) {
            conditionRegistryNotes = buildDatabaseContext(dbContent);
            console.log(`✓ Using database content for ${selectedConditionMeta.condition}`);
          } else {
            console.warn(`⚠ Incomplete database content for ${selectedConditionMeta.condition}, using registry/API knowledge`);
            conditionRegistryNotes = getConditionRegistryContext(selectedConditionMeta);
          }
        } catch (error) {
          console.error(`Error loading database content for ${selectedConditionMeta.condition}:`, error);
          conditionRegistryNotes = getConditionRegistryContext(selectedConditionMeta);
        }
      }
    }

    if (contentTopicAbbr === "PRO") {
      // Professional Practice special handling (no condition registry)
      prompt = `You are generating a structured JSON object for a PANCE practice question.

Generate one new, unique, PANCE-style multiple-choice question on the topic of "Professional Practice".

Difficulty:
${detailedDifficultyInstruction}

Core Instructions:
1. Scenario-Based: The question must present a realistic scenario involving professional practice issues relevant to PAs, such as medical ethics, legal responsibilities, patient safety, or public health principles.
2. Plausible Options: The options must represent plausible courses of action or interpretations of the scenario, with one clear best answer according to current professional standards.
3. Question Quality: The stem should be clear, focused, and clinically realistic. Avoid vague wording and "gotcha" phrasing.
4. HTML Formatting: The "rationale" string and all strings in the "pearls" array MUST use simple HTML tags (<b>, <i>) for formatting, NOT markdown.
5. Key Pearls Formatting: The "pearls" array MUST contain 3–4 single, high-yield sentences related to the core principle being tested. Each sentence is a concise, complete thought.
6. Question HTML: The "question" string MAY include a simple HTML <table> (using only <table>, <thead>, <tbody>, <tr>, <th>, <td>) and <br> tags for formatting vitals/labs. Do NOT use <b> or <i> tags in the question.
7. Options & Condition: The "options" and "condition" fields MUST be plain text only (no HTML tags).
8. Uniqueness: ${uniquenessInstruction}
9. Topic: The "topic" field in the JSON output MUST be exactly "Professional Practice".

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

      const registryInstruction = conditionRegistryNotes
        ? `\n\nCondition registry summary (use this to stay accurate without re-deriving facts):\n${conditionRegistryNotes}`
        : "";

      const conditionContext = selectedConditionMeta
        ? `You are targeting the subcategory "${selectedConditionMeta.subcategory}" in the "${fullContentTopicName}" system. Where clinically appropriate, focus the vignette on the specific condition "${selectedConditionMeta.condition}". However, if a very closely related variant would make for a better, more realistic PANCE-style question, you may use it instead – just ensure the "condition" field in your JSON exactly matches the condition you used.${registryInstruction}`
        : `You are targeting the "${fullContentTopicName}" system.`;

      const topicFieldInstruction = `The "topic" field in the JSON output MUST be exactly "${fullContentTopicName}".`;

      prompt = `You are generating a structured JSON object for a PANCE practice question.

${conditionContext}

Generate one new, unique, PANCE-style multiple-choice question for the topic "${fullContentTopicName}" that specifically tests the task "${taskTopic}".

Difficulty:
${detailedDifficultyInstruction}

Core Instructions (question quality matters):
1. Vignette with Subtle Red Herring: The question MUST contain a realistic patient case/vignette and include one subtle "red herring" detail that is not relevant to the final diagnosis.
2. Second-Order Task-Focused Question: The vignette must end with a clear, single-sentence question that directly relates to the specified task ("${taskTopic}") and tests second-order thinking (diagnosis, next best step, mechanism, complication, or most appropriate test).
3. Plausible, Crafted Distractors: The three distractors MUST be highly plausible (common misconceptions, similar diagnoses, or common mistakes) and be clearly wrong once the vignette is understood correctly.
4. Vignette Formatting: Insert "\\n" in the question string to separate paragraphs; do NOT return a single wall of text.
5. Data Table Formatting: If you include ANY vital signs and/or laboratory values, you MUST place ALL of them into a single simple HTML <table> with a header row in the question string. Use exactly two columns labeled "Parameter" and "Value". Do NOT repeat vitals or labs in plain text outside the table.
6. HTML Formatting: The "rationale" and all "pearls" MUST use simple HTML tags (<b>, <i>) instead of markdown.
7. Key Pearls: "pearls" must be 3–4 high-yield, single-sentence clinical pearls focusing on diagnosis, classic presentation, red flags, and first-line management.
8. Question HTML: The "question" string MAY use the table tags above and <br> for line breaks. Do NOT use <b> or <i> tags in the question.
9. Options & Condition: The "options" and "condition" fields MUST be plain text only (no HTML tags). The "condition" string should be the single best descriptive name of the main condition tested.
10. Uniqueness: ${uniquenessInstruction}
11. Topic field: ${topicFieldInstruction}

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
    // -------- FOCUS: topic / growth / generic (non-ALL) --------
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
    let subcategoryInstruction = "";
    if (chosenSubcategory) {
      subcategoryInstruction = `- Subcategory targeting: Choose ONE condition from the "${chosenSubcategory}" subcategory of this system. The JSON "subcategory" must be exactly "${chosenSubcategory}".`;
    }
    // Optional: tighten the question onto a specific condition
    let conditionInstruction = "";
    if (chosenConditionDef) {
      const fullTopicName =
        ABBREVIATION_TO_TOPIC_MAP[chosenConditionDef.system] ||
        chosenConditionDef.system;

      // If we have the meta, get the context to ensure accuracy
      if (chosenConditionMeta && !conditionRegistryNotes) {
        // Try database first, fallback to registry
        try {
          const { loadConditionData } = await import('../services/conditionDataLoader');
          const { hasCompleteContent, buildDatabaseContext } = await import('../lib/contentHelpers');
          const dbContent = await loadConditionData(chosenConditionMeta.condition);
          
          if (dbContent && hasCompleteContent(dbContent)) {
            conditionRegistryNotes = buildDatabaseContext(dbContent);
            console.log(`✓ Using database content for ${chosenConditionMeta.condition}`);
          } else {
            conditionRegistryNotes = getConditionRegistryContext(chosenConditionMeta);
          }
        } catch (error) {
          console.error(`Error loading database content:`, error);
          conditionRegistryNotes = getConditionRegistryContext(chosenConditionMeta);
        }
      }

      const registryInstruction = conditionRegistryNotes
        ? `\n\nCondition registry summary (use this to stay accurate without re-deriving facts):\n${conditionRegistryNotes}`
        : "";

       conditionInstruction = `- Condition targeting: The question's PRIMARY condition MUST be "${chosenConditionDef.condition}" within the "${chosenConditionDef.subcategory}" subcategory of the "${fullTopicName}" system. The "condition" field in the JSON MUST be exactly "${chosenConditionDef.condition}".${registryInstruction}`;
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
${conditionInstruction ? conditionInstruction + "\n" : ""}

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
    const rawText = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.8);

    // Repair common HTML-table newline bug:
    // Gemini sometimes puts a real newline between tags like </td>\n    <td>,
    // which is illegal inside a JSON string. This collapses any ">\n<" into "><".
    const jsonString = rawText.replace(/>\s*\n\s*</g, "><");

    let parsed: ParsedQuestionResponse;
    try {
      parsed = JSON.parse(jsonString) as ParsedQuestionResponse;
    } catch (parseError) {
      console.error(
        "Failed to parse JSON from Gemini. String that failed:",
        rawText
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

    // Build the base question object
    const baseQuestion: Question = {
      ...parsed,
      topic: topicAbbreviation,
      conditionId: parsed.conditionId || "",
      condition: parsed.condition || "Unknown Condition",
    };

    // If we pre-selected a condition (hybrid mode), lock it in here
    if (chosenConditionDef) {
      baseQuestion.system = chosenConditionDef.system;
      baseQuestion.subcategory = chosenConditionDef.subcategory;
      baseQuestion.conditionId = chosenConditionDef.id;
      baseQuestion.condition = chosenConditionDef.condition;
    }

    if (!baseQuestion.conditionId) {
      const matchedMeta = findConditionMeta(baseQuestion.condition);
      if (matchedMeta) {
        const def = buildConditionDefinition(matchedMeta);
        baseQuestion.conditionId = def.id;
        baseQuestion.system = baseQuestion.system ?? def.system;
        baseQuestion.subcategory = baseQuestion.subcategory ?? def.subcategory;
      } else {
        baseQuestion.conditionId = `OTHER__unspecified__${slugify(
          baseQuestion.condition
        )}`;
        baseQuestion.system = baseQuestion.system ?? "OTHER";
        baseQuestion.subcategory = baseQuestion.subcategory ?? "Uncategorized";
      }
    }

    return baseQuestion;
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

  const modelName = useProModel ? GEMINI_PRO_MODEL : GEMINI_FLASH_MODEL;
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
    const text = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.6);
    return text;
  } catch (error) {
    console.error("Error generating alternate rationale:", error);
    throw new Error(
      "Failed to generate an explanation. The API may be busy or an error occurred."
    );
  }
}

// --- Patient Encounter / OSCE Simulation ---

/**
 * Simulates a patient encounter using Gemini Flash for speed.
 * Acts as both the patient (dialogue) and the system (exam/lab results).
 */
export async function chatWithPatientSimulator(
  caseData: PatientEncounterCase,
  chatHistory: ChatMessage[],
  userMessage: string,
  persona?: PatientPersona | null,
): Promise<string> {
  const personaHeader = persona
    ? `
PATIENT PERSONA (for internal consistency – NEVER reveal directly):
- Name: ${persona.demographics.name}
- Age: ${persona.demographics.age}
- Gender: ${persona.demographics.gender}
- Personality: ${persona.personality}
- Secret Diagnosis: ${persona.secretDiagnosis}
- Core HPI Narrative: ${persona.history}
- Critical Cues: ${persona.criticalCues.join('; ')}

Use this persona to guide how the patient speaks, what details they volunteer, and how their emotional tone feels. Do NOT state the secret diagnosis explicitly or list "critical cues" to the learner.
`
    : '';

  const systemPrompt = `
You are a Virtual OSCE Patient Simulator. You are playing the role of the patient and the clinical environment.

PATIENT DATA (STRUCTURED CASE):
Name: ${caseData.patientName}
Age: ${caseData.age}
Sex: ${caseData.sex}
Chief Complaint: ${caseData.chiefComplaint}
Vitals: BP ${caseData.vitalSigns.bp}, HR ${caseData.vitalSigns.hr}, RR ${caseData.vitalSigns.rr}, Temp ${caseData.vitalSigns.temp}, O2 ${caseData.vitalSigns.o2sat}%
${personaHeader}

HISTORY DATA (Reveal only if asked):
${JSON.stringify(caseData.historyData, null, 2)}

PHYSICAL EXAM FINDINGS (Reveal only if user performs exam):
${JSON.stringify(caseData.physicalExamData, null, 2)}

LABS/IMAGING RESULTS (Reveal only if user orders tests):
${JSON.stringify(caseData.labData, null, 2)}

INSTRUCTIONS:
1. ROLEPLAY: Act as the patient. Speak in first person ("I feel..."). Be realistic. Do not volunteer information unless specifically asked.
2. PERSONALITY: If a persona is provided, let it influence how forthcoming or guarded the patient is, their anxiety level, and their communication style.
3. PHYSICAL EXAMS: If the user says "I listen to the heart" or "Examine abdomen", provide the specific finding from the PHYSICAL EXAM FINDINGS section. Format these findings in brackets, e.g., "[Exam Finding] The abdomen is soft, non-tender."
4. LABS/IMAGING: If the user orders a test (e.g., "Order CBC", "Get a CXR"), provide the result from the LABS/IMAGING RESULTS section. If the test is not listed, assume it is normal/unremarkable. Format as "[Lab Result] CBC: WBC 12k...".
5. LANGUAGE: If the user speaks Spanish, respond in Spanish.
6. DO NOT reveal the diagnosis or the "correct" answer. You are the simulation, not the grader.

Current conversation history is provided below. Respond to the last user message.
`;

  // Format history for Gemini
  // Note: In a real production app, we'd use the proper 'contents' array structure with 'parts'.
  // For this proxy helper, we'll concatenate the prompt since callGeminiText takes a string prompt.
  // However, to maintain context, we should append the history to the prompt.
  
  let fullPrompt = systemPrompt + "\n\nCONVERSATION HISTORY:\n";
  chatHistory.forEach(msg => {
    fullPrompt += `${msg.role === 'user' ? 'Doctor' : 'Patient'}: ${msg.content}\n`;
  });
  fullPrompt += `Doctor: ${userMessage}\nPatient:`;

  return callGeminiText(GEMINI_FLASH_MODEL, fullPrompt, 0.7);
}

/**
 * Evaluates a user's diagnosis against the correct diagnosis using Gemini.
 * Returns a JSON object with correctness and feedback.
 */
export async function evaluateDiagnosis(
  correctDiagnosis: string,
  userDiagnosis: string,
  caseContext: string
): Promise<{ isCorrect: boolean; feedback: string; score: number }> {
  const prompt = `
You are a medical examiner grading a PA student's diagnosis.

Case Context: ${caseContext}
Correct Diagnosis: "${correctDiagnosis}"
Student's Diagnosis: "${userDiagnosis}"

Task:
1. Determine if the student's diagnosis is correct. Allow for synonyms, abbreviations (e.g., "MI" for "Myocardial Infarction"), and close variations.
2. Provide a score from 0 to 100 based on accuracy and specificity.
3. Provide brief feedback explaining why it is correct or incorrect.

Return ONLY raw JSON (no markdown formatting) with this structure:
{
  "isCorrect": boolean,
  "score": number,
  "feedback": "string"
}
`;

  try {
    const response = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.0);
    const cleanJson = stripHtmlTags(response).replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error evaluating diagnosis:", error);
    // Fallback to simple string match if AI fails
    const normalizedUser = userDiagnosis.toLowerCase();
    const normalizedCorrect = correctDiagnosis.toLowerCase();
    const isCorrect = normalizedUser.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedUser);
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? "Correct diagnosis." : `Incorrect. The correct diagnosis was ${correctDiagnosis}.`
    };
  }
}

/**
 * Simulates a physical exam finding based on user request.
 * Filters for specific requests vs general exams.
 */
export async function performPhysicalExam(
  action: string,
  caseData: PatientEncounterCase
): Promise<string> {
  const prompt = `
You are the physical exam simulator for a Virtual OSCE.
Patient: ${caseData.patientName}, ${caseData.age}yo ${caseData.sex}.
CC: ${caseData.chiefComplaint}.
Diagnosis: ${caseData.correctDiagnosis}.

Physical Exam Data (Ground Truth):
${JSON.stringify(caseData.physicalExamData, null, 2)}

User Action: "${action}"

Instructions:
1. Interpret the user's action.
2. If the user asks for a general exam (e.g., "listen to heart", "examine abdomen"), return the corresponding finding from the Ground Truth.
3. If the user asks for a SPECIAL TEST (e.g., "Lachman test", "Fundoscopic exam", "Murphy's sign") that is NOT explicitly in the Ground Truth, generate a medically accurate result consistent with the patient's diagnosis.
   - If the diagnosis implies a positive finding (e.g., Cholecystitis -> Positive Murphy's), generate it.
   - If the diagnosis implies a negative finding, generate a normal result.
4. If the user's action is vague or invalid, ask for clarification.
5. Return ONLY the finding description. Do not add conversational filler.

Example:
User: "Check Murphy's sign"
Output: "Inspiratory arrest on deep palpation of the RUQ (Positive Murphy's sign)."
`;

  return callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.3);
}

/**
 * Simulates a diagnostic test result.
 * Generates realistic reports for Labs, Imaging, etc.
 */
export async function orderDiagnosticTest(
  testName: string,
  caseData: PatientEncounterCase
): Promise<{ result: string; interpretation: string }> {
  const prompt = `
You are the diagnostic result generator for a Virtual OSCE.
Patient: ${caseData.patientName}, ${caseData.age}yo ${caseData.sex}.
Diagnosis: ${caseData.correctDiagnosis}.

Lab Data (Ground Truth):
${JSON.stringify(caseData.labData, null, 2)}

User Order: "${testName}"

Instructions:
1. If the test is in the Ground Truth, return that exact data.
2. If the test is NOT in the Ground Truth, generate a realistic result consistent with the diagnosis.
   - If the test should be abnormal for this diagnosis, generate the abnormal values.
   - If the test should be normal, generate normal reference ranges.
3. For Imaging (X-ray, CT, MRI), provide a "Radiologist Interpretation".
4. Return JSON format: { "result": "raw values or description", "interpretation": "clinical significance" }
`;

  try {
    const response = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.4);
    const cleanJson = stripHtmlTags(response).replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error generating diagnostic result:", error);
    return {
      result: "Result unavailable.",
      interpretation: "Test could not be processed."
    };
  }
}

/**
 * Evaluates a treatment plan.
 */
export async function evaluateTreatmentPlan(
  plan: string,
  caseData: PatientEncounterCase
): Promise<{ isCorrect: boolean; feedback: string; score: number }> {
  const prompt = `
You are grading a treatment plan for a PA student.
Case: ${caseData.patientName}, ${caseData.age}yo ${caseData.sex}.
Diagnosis: ${caseData.correctDiagnosis}.

Student Plan: "${plan}"

Instructions:
1. Evaluate if the plan is appropriate for the diagnosis.
2. Check for CRITICAL dosing if applicable (e.g., Adenosine 6mg, Epinephrine 1mg). For general meds, standard dosing is assumed if not specified, but critical ACLS/acute meds need specific doses.
3. Score from 0-100.
4. Provide brief feedback.

Return JSON: { "isCorrect": boolean, "score": number, "feedback": "string" }
`;

  try {
    const response = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.2);
    const cleanJson = stripHtmlTags(response).replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    return { isCorrect: false, score: 0, feedback: "Error evaluating plan." };
  }
}

/**
 * Generates a brief After Action Report (AAR).
 */
export async function generateAfterActionReport(
  sessionData: SessionData,
  caseData: PatientEncounterCase
): Promise<string> {
  const prompt = `
Generate a brief, bulleted After Action Report (AAR) for a medical student's OSCE performance.
Case: ${caseData.correctDiagnosis}

Session Data:
${JSON.stringify(sessionData, null, 2)}

Format:
- **Strengths**: 2-3 bullets
- **Areas for Improvement**: 2-3 bullets
- **Clinical Pearl**: 1 high-yield fact about this case.
`;

  return callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.6);
}

// --- SOAP Note Grading ---

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface GradingResult {
  overallScore: number;
  sectionScores: {
    subjective: number;
    objective: number;
    assessment: number;
    plan: number;
  };
  feedback: {
    strengths: string[];
    improvements: string[];
    criticalMissing: string[];
    billingElements: string[];
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export async function gradeSOAPNote(
  soapNote: SOAPNote,
  patientCase: { patientInfo: string; chiefComplaint: string; history: string; vitals?: string; physicalExam?: string; }
): Promise<GradingResult> {
  const prompt = `
    You are an expert medical educator grading a PA student's SOAP note.
    
    Patient Case:
    Info: ${patientCase.patientInfo}
    CC: ${patientCase.chiefComplaint}
    History: ${patientCase.history}
    Vitals: ${patientCase.vitals || 'N/A'}
    Physical Exam: ${patientCase.physicalExam || 'N/A'}

    Student's SOAP Note:
    Subjective: ${soapNote.subjective}
    Objective: ${soapNote.objective}
    Assessment: ${soapNote.assessment}
    Plan: ${soapNote.plan}

    Evaluate the note based on medical accuracy, completeness, and professional formatting.
    Return a JSON object with the following structure (no markdown formatting):
    {
      "overallScore": number (0-100),
      "sectionScores": {
        "subjective": number (0-100),
        "objective": number (0-100),
        "assessment": number (0-100),
        "plan": number (0-100)
      },
      "feedback": {
        "strengths": ["string", "string"],
        "improvements": ["string", "string"],
        "criticalMissing": ["string"],
        "billingElements": ["string"]
      },
      "grade": "A" | "B" | "C" | "D" | "F"
    }
  `;

  try {
    const responseText = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.3);
    // Clean up potential markdown code blocks
    const jsonString = responseText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonString) as GradingResult;
  } catch (error) {
    console.error("Error grading SOAP note:", error);
    // Fallback to a basic error result
    return {
      overallScore: 0,
      sectionScores: { subjective: 0, objective: 0, assessment: 0, plan: 0 },
      feedback: {
        strengths: [],
        improvements: ["Failed to grade note due to AI service error."],
        criticalMissing: [],
        billingElements: []
      },
      grade: 'F'
    };
  }
}

// --- Semantic Validation ---

export async function validateSemanticMatch(
  userAnswer: string,
  correctAnswer: string,
  context?: string
): Promise<boolean> {
  // Fast path: exact match (normalized)
  if (slugify(userAnswer) === slugify(correctAnswer)) return true;

  const prompt = `
    You are a medical terminology expert.
    Determine if the user's answer is semantically equivalent to the correct answer, 
    or if it is a correct diagnosis for the given context (buzzword).

    Context/Buzzword: "${context || 'N/A'}"
    Correct Answer: "${correctAnswer}"
    User Answer: "${userAnswer}"

    Rules:
    1. Accept synonyms (e.g., "Kidney Stones" = "Nephrolithiasis").
    2. Accept abbreviations if standard (e.g., "CHF" = "Congestive Heart Failure").
    3. Accept minor spelling errors if phonetically clear.
    4. Reject if the user's answer is a different condition or too vague.

    Respond with ONLY "true" or "false".
  `;

  try {
    const responseText = await callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.1);
    return responseText.toLowerCase().includes("true");
  } catch (error) {
    console.error("Semantic validation error:", error);
    return false; // Fallback to strict
  }
}
