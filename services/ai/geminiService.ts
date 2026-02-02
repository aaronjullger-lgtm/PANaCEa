// services/geminiService.ts

import {
  PANCE_TOPICS,
  TOPIC_MAP,
  ABBREVIATION_TO_TOPIC_MAP,
  PANCE_DECK,
  TASK_DECK,
  GEMINI_FLASH_MODEL,
  GEMINI_PRO_MODEL,
} from '@/src/constants';
import type { Question, SessionSettings, SystemCode, ConditionDefinition } from '@/types';
import type { PatientEncounterCase, PatientPersona } from '@/types/drill-modes';
import type { ConditionMeta } from '@/src/types/conditions';
import {
  getConditionByIdSync,
  isMeaningfulContent,
  normalizeConditionContent,
} from '@/lib/loadConditions';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { getConditionsBySystem, getAllConditions } from '../conditionService';

// ============================================================================
// CONDITION REGISTRY HELPERS (Replacing deprecated conditionRegistryService)
// ============================================================================

/**
 * Condition metadata type for internal use
 */
interface ConditionMetadata {
  name: string;
  system: string;
  subcategory?: string;
}

/**
 * Get a random condition for a specific organ system
 */
async function getRandomConditionForSystemDB(
  systemCode: string
): Promise<ConditionMetadata | null> {
  try {
    const conditions = await getConditionsBySystem(systemCode);

    // Defensive: Ensure we have a valid array with conditions
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      console.warn(`[getRandomConditionForSystemDB] No conditions found for system ${systemCode}`);
      return null;
    }

    const randomIndex = Math.floor(Math.random() * conditions.length);
    const condition = conditions[randomIndex];

    // Defensive: Validate the condition object has required fields
    if (!condition || typeof condition !== 'object') {
      console.warn(
        `[getRandomConditionForSystemDB] Invalid condition at index ${randomIndex} for ${systemCode}`
      );
      return null;
    }

    // Safely access properties with fallbacks
    // ConditionMeta uses 'condition' field, but some responses may use 'name'
    const conditionName = condition.condition || (condition as any).name;
    const conditionSystem = condition.system || systemCode;

    if (!conditionName) {
      console.warn(
        `[getRandomConditionForSystemDB] Condition missing name field for ${systemCode}:`,
        condition
      );
      return null;
    }

    return {
      name: conditionName,
      system: conditionSystem,
      subcategory: condition.subcategory,
    };
  } catch (error) {
    console.error(`Error getting random condition for ${systemCode}:`, error);
    return null;
  }
}

/**
 * Find a condition by name across all systems
 */
async function findConditionByName(conditionName: string): Promise<ConditionMetadata | null> {
  // Safety check: validate input
  if (!conditionName || typeof conditionName !== 'string') {
    console.warn('[findConditionByName] Invalid conditionName:', conditionName);
    return null;
  }

  try {
    const allConditions = await getAllConditions();

    // Defensive: Ensure we have a valid array
    if (!allConditions || !Array.isArray(allConditions)) {
      console.error(
        '[findConditionByName] getAllConditions did not return an array:',
        typeof allConditions
      );
      return null;
    }

    if (allConditions.length === 0) {
      console.warn('[findConditionByName] No conditions available in database');
      return null;
    }

    const normalizedSearch = conditionName.toLowerCase().trim();

    // Use a safer find with explicit null checks
    const match = allConditions.find((c) => {
      if (!c || typeof c !== 'object') return false;

      // Check primary condition name
      const conditionNameField = c.condition || (c as any).name;
      if (conditionNameField && typeof conditionNameField === 'string') {
        if (conditionNameField.toLowerCase().trim() === normalizedSearch) {
          return true;
        }
      }

      // Check aliases
      if (c.aliases && Array.isArray(c.aliases)) {
        return c.aliases.some(
          (a: string) => a && typeof a === 'string' && a.toLowerCase().trim() === normalizedSearch
        );
      }

      return false;
    });

    if (!match) return null;

    // Safely extract the condition name
    const matchedName = match.condition || (match as any).name;
    if (!matchedName || !match.system) {
      console.warn('[findConditionByName] Matched condition missing required fields:', match);
      return null;
    }

    return {
      name: matchedName,
      system: match.system,
      subcategory: match.subcategory,
    };
  } catch (error) {
    console.error(`Error finding condition by name "${conditionName}":`, error);
    return null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely convert any value to a string for toLowerCase operations
 * Prevents "Cannot read properties of null (reading 'toLowerCase')" errors
 */
function safeString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

/**
 * Normalize a string for ID generation (handles null/undefined gracefully)
 */
function normalizeId(value: unknown): string {
  const str = safeString(value, 'unknown');
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Build a standardized condition ID from metadata
 * Replaces the old buildConditionDefinition from conditionRegistry
 */
function buildConditionId(meta: ConditionMeta): string {
  // Use normalizeId for all fields to ensure safety
  const safeSystem = safeString(meta.system, 'UNKNOWN');
  const safeSubcategory = normalizeId(meta.subcategory);
  const safeCondition = normalizeId(meta.condition);

  return `${safeSystem}__${safeSubcategory}__${safeCondition}`;
}

/**
 * Build a ConditionDefinition from ConditionMeta
 */
function buildConditionDefinition(meta: ConditionMeta): ConditionDefinition {
  return {
    id: buildConditionId(meta),
    system: meta.system,
    subcategory: meta.subcategory,
    condition: meta.condition,
  };
}

/**
 * Validate that a ConditionMeta object has all required fields
 */
function isValidConditionMeta(meta: ConditionMeta | null | undefined): meta is ConditionMeta {
  if (!meta) return false;
  if (!meta.system || typeof meta.system !== 'string') return false;
  if (!meta.condition || typeof meta.condition !== 'string') return false;
  return true;
}

/**
 * Find condition metadata by name using the API
 */
async function findConditionMeta(conditionName: string): Promise<ConditionMeta | undefined> {
  // Safety check: if conditionName is null/undefined/empty, return undefined
  if (!conditionName) {
    console.warn('findConditionMeta called with empty conditionName');
    return undefined;
  }

  try {
    const conditionData = await findConditionByName(conditionName);
    if (!conditionData) return undefined;

    // Validate required fields exist before using them
    if (!conditionData.system || !conditionData.name) {
      console.warn(
        'findConditionMeta: conditionData missing required fields (system or name)',
        conditionData
      );
      return undefined;
    }

    return {
      system: conditionData.system as SystemCode,
      subcategory: conditionData.subcategory || 'General',
      condition: conditionData.name,
      aliases: [],
    };
  } catch (error) {
    console.error('Error finding condition meta:', error);
    return undefined;
  }
}

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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callGeminiText(
  modelName: string = 'gemini-2.5-flash',
  prompt: string,
  temperature: number = 0.8,
  options: { maxRetries?: number } = {}
): Promise<string> {
  const { maxRetries = 2 } = options;

  const isTestEnv =
    typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');
  if (isTestEnv) {
    const hash = Array.from(prompt || '').reduce(
      (acc, char) => (acc + char.charCodeAt(0)) % 100000,
      0
    );
    const preview = prompt.replace(/\s+/g, ' ').trim();
    const mock = `[Gemini mock ${hash}] ${preview}`;
    return mock.length < 40 ? mock.padEnd(40, '.') : mock;
  }

  let lastError: GeminiApiError | Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(getApiEndpoint(API_ENDPOINTS.GEMINI_PROXY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName, prompt, temperature }),
      });

      if (!response.ok) {
        const { retryable, retryAfterMs } = getRetryInfo(response.status);

        // If retryable and we have retries left, wait and continue
        if (retryable && attempt < maxRetries) {
          console.warn(
            `[Gemini] Request failed with ${response.status}, retrying in ${retryAfterMs}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(retryAfterMs);
          continue;
        }

        // Non-retryable or out of retries
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || errorData.details || response.statusText;
        } catch {
          errorDetails = response.statusText;
        }

        throw new GeminiApiError(
          `Gemini API error: ${response.status} ${errorDetails}`,
          response.status,
          retryable,
          retryAfterMs
        );
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(
          'Backend server returned non-JSON response. Please ensure the server is running (npm run dev:all).'
        );
      }

      const data = await response.json();
      const text = typeof data === 'string' ? data : (data.data?.text ?? data.text);

      if (!text || !text.trim()) {
        throw new Error('Empty response from Gemini');
      }

      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's already a GeminiApiError, rethrow (already handled retry logic above)
      if (error instanceof GeminiApiError) {
        throw error;
      }

      // For network errors, attempt retry
      if (
        attempt < maxRetries &&
        (error instanceof TypeError || // Network error
          (error instanceof Error && error.message.includes('fetch')))
      ) {
        console.warn(
          `[Gemini] Network error, retrying in 2000ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(2000);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Gemini request failed after retries');
}

/**
 * Streaming version of callGeminiText for progressive rendering
 * Uses Server-Sent Events (SSE) for real-time text chunks
 *
 * @param modelName - Gemini model to use (default: gemini-2.5-flash)
 * @param prompt - The prompt to send to Gemini
 * @param temperature - Temperature parameter (default: 0.8)
 * @param options - Streaming options with callbacks
 * @returns Promise that resolves with complete text
 *
 * @example
 * ```typescript
 * await callGeminiTextStreaming('gemini-2.5-flash', prompt, 0.8, {
 *   onChunk: (chunk) => setPartialText(prev => prev + chunk),
 *   onComplete: (fullText) => setIsLoading(false),
 *   onError: (error) => setError(error.message)
 * });
 * ```
 */
export async function callGeminiTextStreaming(
  modelName: string = 'gemini-2.5-flash',
  prompt: string,
  temperature: number = 0.8,
  options: {
    /** Optional: Gemini context cache name for "Chat with your Library" / Tutor grounding */
    cachedContent?: string;
    /** Optional: get Clerk session token for authenticated proxy requests (required when backend requires auth) */
    getToken?: () => Promise<string | null>;
    /** Optional: Gemini 3 thinking level for reasoning depth control */
    thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
    onChunk?: (chunk: string) => void;
    onComplete?: (fullText: string) => void;
    onError?: (error: Error) => void;
    signal?: AbortSignal;
  } = {}
): Promise<string> {
  // Input validation
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    const error = new Error(
      '[callGeminiTextStreaming] Prompt is required and must be a non-empty string'
    );
    console.error(error.message);
    options.onError?.(error);
    throw error;
  }

  if (typeof modelName !== 'string' || modelName.trim().length === 0) {
    const error = new Error(
      '[callGeminiTextStreaming] Model name is required and must be a non-empty string'
    );
    console.error(error.message);
    options.onError?.(error);
    throw error;
  }

  if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
    const error = new Error(
      '[callGeminiTextStreaming] Temperature must be a number between 0 and 2'
    );
    console.error(error.message);
    options.onError?.(error);
    throw error;
  }

  const isTestEnv =
    typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');

  if (isTestEnv) {
    console.log('[callGeminiTextStreaming] Running in test mode, using mock response');
    // Mock behavior for tests: simulate streaming
    const hash = Array.from(prompt || '').reduce(
      (acc, char) => (acc + char.charCodeAt(0)) % 100000,
      0
    );
    const preview = prompt.replace(/\s+/g, ' ').trim();
    const mockText = `[Gemini mock ${hash}] ${preview}`;
    const finalText = mockText.length < 40 ? mockText.padEnd(40, '.') : mockText;

    // Simulate chunks
    const chunks = finalText.match(/.{1,10}/g) || [finalText];
    for (const chunk of chunks) {
      options.onChunk?.(chunk);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate latency
    }
    options.onComplete?.(finalText);
    return finalText;
  }

  try {
    console.log(`[callGeminiTextStreaming] Starting streaming request with model: ${modelName}`);

    // Dynamic import to avoid circular dependency
    // Type assertion for the imported module
    type StreamingClientModule = {
      streamGeminiText: (
        prompt: string,
        options: {
          modelName: string;
          temperature: number;
          cachedContent?: string;
          token?: string | null;
          thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
          onChunk?: (chunk: string) => void;
          onComplete?: (fullText: string) => void;
          onError?: (error: Error) => void;
          signal?: AbortSignal;
        }
      ) => Promise<string>;
    };

    let streamingModule: StreamingClientModule;

    try {
      streamingModule = (await import('@/lib/utils/streamingClient')) as StreamingClientModule;
    } catch (importError) {
      const error = new Error(
        `[callGeminiTextStreaming] Failed to load streaming client module: ${importError instanceof Error ? importError.message : String(importError)}`
      );
      console.error(error.message, importError);
      options.onError?.(error);
      throw error;
    }

    // Validate that the imported function exists
    if (
      !streamingModule.streamGeminiText ||
      typeof streamingModule.streamGeminiText !== 'function'
    ) {
      const error = new Error(
        '[callGeminiTextStreaming] streamGeminiText function not found in streaming client module'
      );
      console.error(error.message);
      options.onError?.(error);
      throw error;
    }

    const token = options.getToken ? await options.getToken() : null;
    const result = await streamingModule.streamGeminiText(prompt, {
      modelName,
      temperature,
      cachedContent: options.cachedContent,
      token: token ?? undefined,
      thinkingLevel: options.thinkingLevel,
      onChunk: options.onChunk,
      onComplete: options.onComplete,
      onError: options.onError,
      signal: options.signal,
    });

    console.log('[callGeminiTextStreaming] Streaming request completed successfully');
    return result;
  } catch (error) {
    // Structured error handling with proper logging
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[callGeminiTextStreaming] Streaming request failed:', {
      message: err.message,
      name: err.name,
      stack: err.stack,
    });

    // Ensure error callback is invoked
    options.onError?.(err);
    throw err;
  }
}

/**
 * Create a cancellable streaming request
 * Returns an object with the promise and an abort function
 *
 * @example
 * ```typescript
 * const { promise, abort } = createCancellableGeminiStream(prompt, {
 *   onChunk: (chunk) => setPartialText(prev => prev + chunk)
 * });
 *
 * // Later, if user clicks "Stop"
 * abort();
 * ```
 */
export function createCancellableGeminiStream(
  modelName: string = 'gemini-2.5-flash',
  prompt: string,
  temperature: number = 0.8,
  options: {
    onChunk?: (chunk: string) => void;
    onComplete?: (fullText: string) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const abortController = new AbortController();

  return {
    promise: callGeminiTextStreaming(modelName, prompt, temperature, {
      ...options,
      signal: abortController.signal,
    }),
    abort: () => abortController.abort(),
  };
}

// --- Helper: strip any HTML tags from a string (for options/condition) ---

const stripHtmlTags = (text: string | null | undefined): string => {
  const safe = safeString(text);
  return safe.replace(/<\/?[^>]+(>|$)/g, '');
};

const slugify = (value: string | null | undefined): string => normalizeId(value);

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

  maybeAdd('overview', 'Overview');
  maybeAdd('etiology', 'Etiology');
  maybeAdd('diagnostics', 'Diagnostics');
  maybeAdd('clinicalPresentation', 'Clinical Presentation');
  maybeAdd('riskFactors', 'Risk Factors');
  maybeAdd('prognosis', 'Prognosis');

  return pieces.join('\n');
}

// --- Deck / history state ---

let shuffledContentQueue: string[] = [];
let shuffledTaskQueue: string[] = [];
const recentQuestionHistory: string[] = [];
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
  let deck = PANCE_DECK.filter((system) => enabledSystems.has(system as SystemCode));

  // If no systems are enabled, use all systems (fallback)
  if (deck.length === 0) {
    console.warn('No systems enabled, using all systems as fallback');
    deck = [...PANCE_DECK];
  }

  // Shuffle the filtered deck using Fisher-Yates algorithm
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Use temporary variable to avoid strictNullChecks issues with destructuring
    const temp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = temp;
  }
  shuffledContentQueue = deck;
}

export function refillShuffledTaskQueue() {
  const deck = [...TASK_DECK];
  // Fisher-Yates shuffle with temp variable for strictNullChecks
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = temp;
  }
  shuffledTaskQueue = deck;
}

// --- Main question generator ---

export async function fetchNewQuestion(
  settings: SessionSettings,
  growthAreas: string[]
): Promise<Question> {
  const { focus, difficulty } = settings;

  // Get user context for career-aware prompting
  // NOTE: userContextService.ts does not exist yet, using default PANCE context
  let userContextInstruction = '';
  // Default to PANCE student context (foundational learning)
  userContextInstruction = `
Context: This question is for a PA STUDENT preparing for the initial PANCE certification exam.
- Focus on building foundational knowledge and recognition of classic presentations.
- Emphasize first-order clinical reasoning (diagnosis, classic findings, first-line treatments).
- Use clear, textbook presentations for "easier" difficulty, and standard PANCE complexity for "same" difficulty.`;

  let detailedDifficultyInstruction = '';
  switch (difficulty) {
    case 'easier':
      detailedDifficultyInstruction =
        "Generate an 'Easier' question. Use a classic, textbook presentation with clear physical exam findings. The diagnosis should be identifiable from the described findings, but you must still DESCRIBE findings rather than naming them. Include 1-2 'normal' findings to practice filtering. Focus on first-line treatment or most likely diagnosis.";
      break;
    case 'same':
      detailedDifficultyInstruction =
        "Generate a 'PANCE-level' question. This must test SECOND-ORDER thinking: the student must first synthesize the clinical description to identify the condition, THEN answer a question about management, mechanism, or complications. Include a subtle red herring finding. Vitals may hint at acuity without explicitly stating 'unstable.'";
      break;
    case 'harder':
      detailedDifficultyInstruction =
        "Generate a 'Harder' question. Use an atypical presentation, a complex patient with comorbidities, or a less common variant of a common condition. The question should require THIRD-ORDER thinking: identify the condition from subtle clues, consider how a comorbidity affects treatment, then select the appropriate modified management.";
      break;
  }

  const uniquenessInstruction =
    recentQuestionHistory.length > 0
      ? `Critically, avoid generating a question that is substantively or thematically similar to any of these recently generated questions: 
- "${recentQuestionHistory.join('"\n- "')}"`
      : 'Avoid generating questions that are substantively identical or too similar to common practice questions. The goal is to provide a fresh challenge.';

  let prompt = '';

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
    const meta = await findConditionMeta(settings.conditionName);
    if (meta) {
      chosenConditionMeta = meta;
      chosenConditionDef = buildConditionDefinition(meta);

      // Load database content via API (browser-safe)
      try {
        const { fetchConditionContent, hasCompleteContent, buildDatabaseContext } =
          await import('../conditionContentService');
        const dbContent = await fetchConditionContent(settings.conditionName);

        if (dbContent && hasCompleteContent(dbContent)) {
          conditionRegistryNotes = buildDatabaseContext(dbContent);
          console.log(`✓ Using database content for requested condition ${settings.conditionName}`);
        } else {
          console.warn(
            `⚠ Incomplete database content for ${settings.conditionName}, will use registry/API knowledge`
          );
        }
      } catch (error) {
        console.error(`Error loading database content for ${settings.conditionName}:`, error);
      }
    }
  }

  // -------- FOCUS: ALL (use content + task decks) --------
  if (focus === 'all') {
    if (shuffledContentQueue.length === 0) {
      refillShuffledContentQueue();
    }
    const contentTopicAbbr = shuffledContentQueue.pop()!;
    const fullContentTopicName = ABBREVIATION_TO_TOPIC_MAP[contentTopicAbbr];

    const systemCode = contentTopicAbbr as SystemCode;

    // Hybrid: pick a random condition within this system (except PRO/OTHER)
    let selectedConditionMeta: ConditionMeta | undefined;
    if (systemCode !== 'PRO' && systemCode !== 'OTHER') {
      // NEW: Use database-driven registry instead of static import
      try {
        const dbCondition = await getRandomConditionForSystemDB(systemCode);
        // Validate dbCondition has required fields before using
        if (dbCondition && dbCondition.name && dbCondition.system) {
          // Convert database metadata to ConditionMeta for compatibility
          const compatMeta = await findConditionMeta(dbCondition.name);
          if (compatMeta) {
            selectedConditionMeta = compatMeta;
            chosenConditionMeta = selectedConditionMeta;
            chosenConditionDef = buildConditionDefinition(selectedConditionMeta);
          }
        } else if (dbCondition) {
          console.warn(`Skipping condition with missing fields:`, dbCondition);
        }
      } catch (error) {
        console.error(`Error fetching random condition for ${systemCode}:`, error);
      }

      if (selectedConditionMeta && isValidConditionMeta(selectedConditionMeta)) {
        chosenConditionMeta = selectedConditionMeta;
        chosenConditionDef = buildConditionDefinition(selectedConditionMeta);

        // Load database content via API (browser-safe)
        try {
          const { fetchConditionContent, hasCompleteContent, buildDatabaseContext } =
            await import('../conditionContentService');
          const dbContent = await fetchConditionContent(
            safeString(selectedConditionMeta.condition)
          );

          if (dbContent && hasCompleteContent(dbContent)) {
            conditionRegistryNotes = buildDatabaseContext(dbContent);
            console.log(
              `✓ Using database content for ${safeString(selectedConditionMeta.condition)}`
            );
          } else {
            console.warn(
              `⚠ Incomplete database content for ${safeString(selectedConditionMeta.condition)}, using registry/API knowledge`
            );
            conditionRegistryNotes = getConditionRegistryContext(selectedConditionMeta);
          }
        } catch (error) {
          console.error(
            `Error loading database content for ${safeString(selectedConditionMeta.condition)}:`,
            error
          );
          conditionRegistryNotes = getConditionRegistryContext(selectedConditionMeta);
        }
      }
    }

    if (contentTopicAbbr === 'PRO') {
      // Professional Practice special handling (no condition registry)
      prompt = `You are generating a structured JSON object for a PANCE practice question.
${userContextInstruction}

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
        : '';

      // Validate selectedConditionMeta before using in string template
      const conditionContext =
        selectedConditionMeta && isValidConditionMeta(selectedConditionMeta)
          ? `You are targeting the subcategory "${safeString(selectedConditionMeta.subcategory, 'General')}" in the "${fullContentTopicName}" system. Where clinically appropriate, focus the vignette on the specific condition "${safeString(selectedConditionMeta.condition)}". However, if a very closely related variant would make for a better, more realistic PANCE-style question, you may use it instead – just ensure the "condition" field in your JSON exactly matches the condition you used.${registryInstruction}`
          : `You are targeting the "${fullContentTopicName}" system.`;

      const topicFieldInstruction = `The "topic" field in the JSON output MUST be exactly "${fullContentTopicName}".`;

      prompt = `You are generating a structured JSON object for a PANCE practice question.
${userContextInstruction}

${conditionContext}

Generate one new, unique, PANCE-style multiple-choice question for the topic "${fullContentTopicName}" that specifically tests the task "${taskTopic}".

Difficulty:
${detailedDifficultyInstruction}

=== CRITICAL: "DESCRIBE, DON'T DIAGNOSE" RULE ===
You are STRICTLY FORBIDDEN from stating the diagnosis in the vignette or using classic "buzzwords" that give away the answer. You must DESCRIBE clinical findings as they would appear to a provider seeing the patient for the first time.

BUZZWORD POLICY (Mixed Mode):
- For 70% of questions: Strictly describe the clinical finding without naming it.
  - BAD: "Patient has a butterfly rash."
  - GOOD: "Physical exam reveals an erythematous, maculopapular eruption over the malar eminences, sparing the nasolabial folds."
  - BAD: "Chest X-ray confirms a pneumothorax."
  - GOOD: "Chest radiography demonstrates a visceral pleural line with absence of lung markings in the right periphery."
- For 30% of questions: You MAY include a classic buzzword, but the question must ask for a SECOND-ORDER fact (treatment, mechanism, complication) NOT the diagnosis.
  - Example: Give "Kayser-Fleischer rings" but ask for the treatment of Wilson's Disease, not the diagnosis.

IMAGING-AS-TEXT RULE:
Since users cannot see images, provide the "Radiologist's Report" or "Pathology Read" as descriptive text.
- BAD: "X-ray shows pneumonia." or "Imaging was normal."
- GOOD: "Plain radiographs reveal preserved joint space, no osteophytes, and normal bony alignment."
- GOOD: "Chest radiography demonstrates a focal consolidation in the right lower lobe with associated air bronchograms."

VIGNETTE STRUCTURE (follow this order):
1. Patient Demographics & Chief Complaint: Age, gender, complaint, duration.
2. History of Present Illness: Character of symptoms, modifying factors, relevant negatives.
3. Vitals: Realistic numbers. Include at least one "distractor" normal vital OR use abnormal vitals without explicitly labeling the clinical state.
4. Physical Exam: Focused findings described ANATOMICALLY, not by diagnosis name.
5. Diagnostics: The descriptive REPORT of findings (labs, imaging), not the interpretation.

Core Instructions (question quality matters):
1. Vignette with Subtle Red Herring: Include one detail that could mislead toward a wrong diagnosis but is actually a distractor.
2. Second-Order Task-Focused Question: The vignette must end with a clear question testing "${taskTopic}" that requires SYNTHESIS, not just recall.
3. Plausible, Crafted Distractors: Three distractors must be highly plausible (common misconceptions, similar diagnoses, or treatments for related conditions).
4. Vignette Formatting: Insert "\\n" in the question string to separate paragraphs; do NOT return a single wall of text.
5. Data Table Formatting: If you include ANY vital signs and/or laboratory values, you MUST place ALL of them into a single simple HTML <table> with a header row. Use exactly two columns labeled "Parameter" and "Value". Do NOT repeat vitals or labs in plain text outside the table.
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
    let topicInstruction = '';
    if (focus === 'topic' && settings.topic) {
      const fullTopicName = ABBREVIATION_TO_TOPIC_MAP[settings.topic] || settings.topic;
      topicInstruction = `The "topic" field in the JSON MUST be exactly "${fullTopicName}".`;
    } else if (focus === 'growth' && growthAreas.length > 0) {
      const fullGrowthAreas = growthAreas
        .map((abbr) => ABBREVIATION_TO_TOPIC_MAP[abbr] || abbr)
        .join(', ');
      topicInstruction = `First choose exactly ONE topic from: [${fullGrowthAreas}] and use that value in the "topic" field.`;
    } else {
      topicInstruction = `First choose exactly ONE topic from: [${PANCE_TOPICS.join(
        ', '
      )}] and use that value in the "topic" field.`;
    }
    let subcategoryInstruction = '';
    if (chosenSubcategory) {
      subcategoryInstruction = `- Subcategory targeting: Choose ONE condition from the "${chosenSubcategory}" subcategory of this system. The JSON "subcategory" must be exactly "${chosenSubcategory}".`;
    }
    // Optional: tighten the question onto a specific condition
    let conditionInstruction = '';
    if (chosenConditionDef) {
      const fullTopicName =
        ABBREVIATION_TO_TOPIC_MAP[chosenConditionDef.system] || chosenConditionDef.system;

      // If we have the meta, get the context to ensure accuracy
      if (
        chosenConditionMeta &&
        isValidConditionMeta(chosenConditionMeta) &&
        !conditionRegistryNotes
      ) {
        // Fetch database content via API (browser-safe)
        try {
          const { fetchConditionContent, hasCompleteContent, buildDatabaseContext } =
            await import('../conditionContentService');
          const dbContent = await fetchConditionContent(safeString(chosenConditionMeta.condition));

          if (dbContent && hasCompleteContent(dbContent)) {
            conditionRegistryNotes = buildDatabaseContext(dbContent);
            console.log(
              `✓ Using database content for ${safeString(chosenConditionMeta.condition)}`
            );
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
        : '';

      conditionInstruction = chosenConditionDef
        ? `- Condition targeting: The question's PRIMARY condition MUST be "${safeString(chosenConditionDef.condition)}" within the "${safeString(chosenConditionDef.subcategory, 'General')}" subcategory of the "${fullTopicName}" system. The "condition" field in the JSON MUST be exactly "${safeString(chosenConditionDef.condition)}".${registryInstruction}`
        : '';
    }

    prompt = `You are generating a structured JSON object for a PANCE practice question.
${userContextInstruction}

Generate one new, unique, PANCE-style multiple-choice question.

=== CRITICAL: "DESCRIBE, DON'T DIAGNOSE" RULE ===
You are STRICTLY FORBIDDEN from stating the diagnosis in the vignette or using classic "buzzwords" that give away the answer. You must DESCRIBE clinical findings as they would appear to a provider seeing the patient for the first time.

BUZZWORD POLICY (Mixed Mode):
- For 70% of questions: Strictly describe the clinical finding without naming it.
  - BAD: "Patient has target lesions." → GOOD: "Erythematous papules with a dusky, vesicular center and surrounding pale ring."
  - BAD: "EKG shows atrial fibrillation." → GOOD: "EKG demonstrates irregularly irregular rhythm with absent P waves."
- For 30% of questions: You MAY include a classic buzzword, but ask for treatment/mechanism/complication, NOT the diagnosis.

IMAGING-AS-TEXT RULE:
Provide the "Radiologist's Report" as descriptive text, not interpretation.
- BAD: "CT shows appendicitis."
- GOOD: "CT abdomen demonstrates a dilated, fluid-filled tubular structure in the right lower quadrant with surrounding fat stranding."

VIGNETTE STRUCTURE:
1. Patient Demographics & Chief Complaint
2. History of Present Illness (character, modifying factors, relevant negatives)
3. Vitals (in table format - include realistic numbers)
4. Physical Exam (anatomical descriptions, not diagnosis names)
5. Diagnostics (descriptive REPORT, not interpretation)

Core Instructions:
1. Vignette with subtle red herring.
2. Second-order question (diagnosis, next best step, mechanism, etc.) requiring SYNTHESIS.
3. Highly plausible distractors that test common misconceptions.
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
${conditionInstruction ? conditionInstruction + '\n' : ''}

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
    const jsonString = rawText.replace(/>\s*\n\s*</g, '><');

    let parsed: ParsedQuestionResponse;
    try {
      parsed = JSON.parse(jsonString) as ParsedQuestionResponse;
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini. String that failed:', rawText);
      throw new Error('The API returned a malformed JSON response. Please try again.');
    }

    // Basic sanity checks
    if (
      !parsed.question ||
      !parsed.question.includes('?') ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4 ||
      typeof parsed.correctAnswerIndex !== 'number' ||
      !parsed.rationale ||
      !parsed.topic ||
      !parsed.condition ||
      !Array.isArray(parsed.pearls)
    ) {
      console.warn('Received malformed JSON data from API, retrying once...', parsed);
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
      console.warn(`API returned an unknown topic "${parsed.topic}". Storing it as-is.`);
    }

    // Build the base question object
    const baseQuestion: Question = {
      ...parsed,
      topic: topicAbbreviation,
      conditionId: parsed.conditionId || '',
      condition: parsed.condition || 'Unknown Condition',
    };

    // If we pre-selected a condition (hybrid mode), lock it in here
    if (chosenConditionDef) {
      baseQuestion.system = chosenConditionDef.system;
      baseQuestion.subcategory = chosenConditionDef.subcategory;
      baseQuestion.conditionId = chosenConditionDef.id;
      baseQuestion.condition = chosenConditionDef.condition;
    }

    if (!baseQuestion.conditionId) {
      const matchedMeta = await findConditionMeta(baseQuestion.condition);
      if (matchedMeta) {
        const def = buildConditionDefinition(matchedMeta);
        baseQuestion.conditionId = def.id;
        baseQuestion.system = baseQuestion.system ?? def.system;
        baseQuestion.subcategory = baseQuestion.subcategory ?? def.subcategory;
      } else {
        baseQuestion.conditionId = `OTHER__unspecified__${slugify(baseQuestion.condition)}`;
        baseQuestion.system = baseQuestion.system ?? 'OTHER';
        baseQuestion.subcategory = baseQuestion.subcategory ?? 'Uncategorized';
      }
    }

    return baseQuestion;
  } catch (error) {
    console.error('Error during fetchNewQuestion:', error);
    if (
      error instanceof Error &&
      (error.message.startsWith('The API returned an invalid response') ||
        error.message.startsWith('The API returned a malformed JSON'))
    ) {
      throw error;
    }
    throw new Error(
      'Failed to generate a new question. Please check your Gemini API key and network connection.'
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
  type: 'study-guide' | 'flashcards',
  topic: string,
  useProModel: boolean
): Promise<string> {
  const fullTopicName = ABBREVIATION_TO_TOPIC_MAP[topic] || topic;

  let prompt: string;
  if (type === 'study-guide') {
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
    console.error('Error generating content:', error);
    throw new Error('Failed to generate content. The API may be busy or an error occurred.');
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
    console.error('Error generating alternate rationale:', error);
    throw new Error('Failed to generate an explanation. The API may be busy or an error occurred.');
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
  persona?: PatientPersona | null
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

  let fullPrompt = systemPrompt + '\n\nCONVERSATION HISTORY:\n';
  chatHistory.forEach((msg) => {
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
    const cleanJson = stripHtmlTags(response)
      .replace(/```json|```/g, '')
      .trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error evaluating diagnosis:', error);
    // Fallback to simple string match if AI fails
    const normalizedUser = (userDiagnosis || '').toLowerCase();
    const normalizedCorrect = (correctDiagnosis || '').toLowerCase();
    const isCorrect =
      normalizedUser &&
      normalizedCorrect &&
      (normalizedUser.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedUser));
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect
        ? 'Correct diagnosis.'
        : `Incorrect. The correct diagnosis was ${correctDiagnosis}.`,
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
    const cleanJson = stripHtmlTags(response)
      .replace(/```json|```/g, '')
      .trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error generating diagnostic result:', error);
    return {
      result: 'Result unavailable.',
      interpretation: 'Test could not be processed.',
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
    const cleanJson = stripHtmlTags(response)
      .replace(/```json|```/g, '')
      .trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    return { isCorrect: false, score: 0, feedback: 'Error evaluating plan.' };
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
  patientCase: {
    patientInfo: string;
    chiefComplaint: string;
    history: string;
    vitals?: string;
    physicalExam?: string;
  }
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
    console.error('Error grading SOAP note:', error);
    // Fallback to a basic error result
    return {
      overallScore: 0,
      sectionScores: { subjective: 0, objective: 0, assessment: 0, plan: 0 },
      feedback: {
        strengths: [],
        improvements: ['Failed to grade note due to AI service error.'],
        criticalMissing: [],
        billingElements: [],
      },
      grade: 'F',
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
    return (responseText || '').toLowerCase().includes('true');
  } catch (error) {
    console.error('Semantic validation error:', error);
    return false; // Fallback to strict
  }
}
